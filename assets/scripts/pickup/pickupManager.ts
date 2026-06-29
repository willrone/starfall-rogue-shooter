import {
    Color,
    Graphics,
    Layers,
    Label,
    Node,
    Sprite,
    SpriteFrame,
    UITransform,
} from 'cc';
import type { PanelManager, ButtonView } from '../ui/panels';
import type { GameEventBus } from '../core/gameContext';
import {
    RESOURCE_DEFS,
    createEmptyWallet as createResourceWallet,
    formatWallet as formatResourceWallet,
    getResourceDef as getResourceDefinition,
    hasResources as walletHasResources,
    spendResources as spendWalletResources,
} from '../core/resources';
import type {
    ResourceType,
    ResourceWallet,
    StatEffect,
    CharacterStats,
    StatKey,
    ChestPickupType,
    PickupType,
    ItemChoiceQuality,
    EquipmentDef,
    LevelUpgrade,
    LootChoice,
} from '../core/types';
import {
    addCharacterStats as addStats,
    createEmptyCharacterStats,
} from '../core/stats';
import {
    LEVEL_UPGRADES,
    RUN_ITEMS,
} from '../catalogs/runItemCatalog';
import {
    applyEquipmentLootChoiceSpec,
    createEquipmentLootChoiceSpecs,
    type EquipmentLootChoiceSpec,
} from '../catalogs/equipmentLootChoices';
import type { CombatState } from '../state/combatState';
import { AdManager } from '../ad/AdManager';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PICKUP_MERGE_RADIUS = 78;
export const PICKUP_COMPACT_RADIUS = 240;
export const PICKUP_SOFT_CAP = 190;
export const PICKUP_HARD_CAP = 260;
export const FLOATING_TEXT_LIMIT = 90;
const LEVEL_REFRESH_COST = 28;
const CHEST_REFRESH_COST = 34;

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface Pickup {
    node: Node;
    gfx: Graphics;
    sprite: Sprite | null;
    type: PickupType;
    amount: number;
    x: number;
    y: number;
    radius: number;
    age: number;
}

export interface FloatingText {
    node: Node;
    label: Label;
    x: number;
    y: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
}

export interface PickupHostContext {
    bus: GameEventBus;

    cs: CombatState;
    worldNode: Node | null;
    panels: PanelManager;
    ownedEquipment: Set<string>;
    equipmentLevels: Record<string, number>;

    hex(color: string, alpha?: number): Color;
    clamp(value: number, min: number, max: number): number;
    randomRange(min: number, max: number): number;
    shuffle<T>(items: T[]): T[];
    addSpriteChild(parent: Node, name: string, frameName: string, width: number, height: number): Sprite | null;
    scheduleOnce(fn: () => void, delay: number): void;

    playSfx(name: string, volume?: number, cooldown?: number): void;
    showToast(message: string): void;
    spawnFloatingText(text: string, x: number, y: number, color: string, fontSize?: number): void;

    getCharacterStats(): CharacterStats;
    getMaxHp(): number;
    getShieldMax(): number;
    getResourceDef(type: ResourceType): { name: string; color: string };
    getResourceMultiplier(): number;
    addBattleResource(type: ResourceType, amount: number): void;
    getSpendableAlloy(): number;
    spendRunAlloy(cost: number): boolean;

    pickLevelChoices(): LevelUpgrade[];
    rumbleVfx(effect: string): void;
    getIcon(name: string): SpriteFrame | null;
    pickItemChoices(quality: ItemChoiceQuality): LevelUpgrade[];

    drawButton(button: ButtonView, disabled: boolean): void;

    saveProgress(): void;
    showHangar(message: string): void;
    getEquipmentLevel(id: string): number;
    isEquipmentLootEligible?(equipment: EquipmentDef, rare: boolean): boolean;
    refreshHud(): void;
}

// ---------------------------------------------------------------------------
// PickupManager
// ---------------------------------------------------------------------------

export class PickupManager {
    public pickups: Pickup[] = [];
    public floatingTexts: FloatingText[] = [];
    public floatingTextPool: FloatingText[] = [];
    public pendingLevelChoices: LevelUpgrade[] = [];
    public pendingItemChoices: LevelUpgrade[] = [];
    public currentItemChoiceQuality: ItemChoiceQuality = 'common';
    public pendingLootChoices: LootChoice[] = [];
    public runStats: CharacterStats = this.createEmptyStats();
    public acquiredRunItemIds: Set<string> = new Set();
    public acquiredStatUpgradeIds: Set<string> = new Set();

    constructor(public ctx: PickupHostContext) {}

    // ── Host helpers ───────────────────────────────────────────────────────

    private get cs() { return this.ctx.cs; }
    private get panels() { return this.ctx.panels; }

    private createEmptyStats(): CharacterStats {
        return createEmptyCharacterStats();
    }

    // ── Pickup art helpers ─────────────────────────────────────────────────

    pickupArtName(type: PickupType): string {
        if (this.isChestPickup(type)) return '';
        if (type === 'cores') return 'pickup_core';
        return `pickup_${type}`;
    }

    isChestPickup(type: PickupType): type is ChestPickupType {
        return type === 'chest-common' || type === 'chest-rare';
    }

    getPickupRadius(): number {
        return Math.max(42, this.ctx.getCharacterStats().pickupRange);
    }

    // ── Update ─────────────────────────────────────────────────────────────

    updatePickups(dt: number): void {
        if (this.pickups.length > PICKUP_HARD_CAP) {
            this.compactPickupOverflow();
        }
        const basePickupRadius = this.getPickupRadius();
        const removing: Pickup[] = [];
        for (const pickup of this.pickups) {
            pickup.age += dt;
            const dx = this.cs.playerX - pickup.x;
            const dy = this.cs.playerY - pickup.y;
            const dist = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
            if (dist < basePickupRadius) {
                const pull = (basePickupRadius - dist) / basePickupRadius;
                const speed = 180 + Math.max(0, pull) * 620;
                pickup.x += (dx / dist) * speed * dt;
                pickup.y += (dy / dist) * speed * dt;
                pickup.node.setPosition(pickup.x, pickup.y, 5);
            }
            if (dist < this.cs.playerRadius + pickup.radius + 8) {
                this.collectPickup(pickup);
                removing.push(pickup);
                if (this.cs.phase !== 'combat') break;
            }
        }
        for (const pickup of removing) {
            this.removePickup(pickup);
        }
    }

    // ── Drop ───────────────────────────────────────────────────────────────

    tryDropChest(type: ChestPickupType, x: number, y: number): boolean {
        if (this.cs.waveChestDrops >= 2) return false; // MAX_CHESTS_PER_WAVE = 2
        this.cs.waveChestDrops += 1;
        this.dropPickup(type, 1, x, y);
        return true;
    }

    dropPickup(type: PickupType, amount: number, x: number, y: number): void {
        const chest = this.isChestPickup(type);
        const pickupAmount = type === 'xp' || chest ? amount : this.scaleResourceAmount(amount);
        if (!chest) {
            const nearbyPickup = this.findMergeablePickup(type, x, y, PICKUP_MERGE_RADIUS);
            if (nearbyPickup) {
                this.addAmountToPickup(nearbyPickup, pickupAmount, x, y);
                return;
            }
            if (this.pickups.length >= PICKUP_SOFT_CAP) {
                this.compactPickupOverflow();
                const widerPickup = this.findMergeablePickup(type, x, y, PICKUP_COMPACT_RADIUS);
                if (widerPickup) {
                    this.addAmountToPickup(widerPickup, pickupAmount, x, y);
                    return;
                }
            }
        }

        const node = new Node(`Pickup_${type}`);
        node.layer = Layers.Enum.UI_2D;
        this.ctx.worldNode!.addChild(node);
        node.setPosition(x, y, 5);
        node.addComponent(UITransform).setContentSize(chest ? 38 : 28, chest ? 34 : 28);
        const gfx = node.addComponent(Graphics);
        const sprite = this.ctx.addSpriteChild(node, 'PickupArt', this.pickupArtName(type), type === 'xp' ? 30 : 34, type === 'xp' ? 30 : 34);
        const pickup: Pickup = {
            node,
            gfx,
            sprite,
            type,
            amount: pickupAmount,
            x,
            y,
            radius: this.getPickupVisualRadius(type, pickupAmount),
            age: 0,
        };
        this.drawPickup(pickup);
        this.pickups.push(pickup);
        if (this.pickups.length > PICKUP_HARD_CAP) {
            this.compactPickupOverflow();
        }
    }

    // ── Find / Merge / Absorb ──────────────────────────────────────────────

    private findMergeablePickup(type: PickupType, x: number, y: number, radius: number, exclude: Pickup | null = null): Pickup | null {
        if (this.isChestPickup(type)) return null;
        let bestPickup: Pickup | null = null;
        let bestDistSq = radius * radius;
        for (const pickup of this.pickups) {
            if (pickup === exclude || pickup.type !== type || this.isChestPickup(pickup.type)) continue;
            const dx = pickup.x - x;
            const dy = pickup.y - y;
            const distSq = dx * dx + dy * dy;
            if (distSq <= bestDistSq) {
                bestDistSq = distSq;
                bestPickup = pickup;
            }
        }
        return bestPickup;
    }

    private addAmountToPickup(pickup: Pickup, amount: number, x: number, y: number): void {
        const nextAmount = pickup.amount + amount;
        const weight = this.ctx.clamp(amount / Math.max(1, nextAmount), 0.08, 0.42);
        pickup.x = pickup.x * (1 - weight) + x * weight;
        pickup.y = pickup.y * (1 - weight) + y * weight;
        pickup.amount = nextAmount;
        pickup.radius = this.getPickupVisualRadius(pickup.type, nextAmount);
        pickup.age = Math.min(pickup.age, 18);
        pickup.node.setPosition(pickup.x, pickup.y, 5);
        const transform = pickup.node.getComponent(UITransform);
        if (transform) {
            const size = pickup.radius * 2 + 16;
            transform.setContentSize(size, size);
        }
        this.drawPickup(pickup);
    }

    private absorbPickupInto(source: Pickup, target: Pickup): void {
        if (source === target) return;
        this.addAmountToPickup(target, source.amount, source.x, source.y);
        const index = this.pickups.indexOf(source);
        if (index >= 0) this.pickups.splice(index, 1);
        source.node.destroy();
    }

    compactPickupOverflow(): void {
        if (this.pickups.length <= PICKUP_SOFT_CAP) return;

        let overflow = this.pickups.length - PICKUP_SOFT_CAP;
        const ordinaryPickups = this.pickups
            .filter((pickup) => !this.isChestPickup(pickup.type))
            .sort((a, b) => b.age - a.age);

        for (const source of ordinaryPickups) {
            if (overflow <= 0) break;
            if (this.pickups.indexOf(source) < 0) continue;
            const target = this.findMergeablePickup(source.type, source.x, source.y, PICKUP_COMPACT_RADIUS, source);
            if (!target) continue;
            this.absorbPickupInto(source, target);
            overflow -= 1;
        }

        if (this.pickups.length <= PICKUP_HARD_CAP) return;

        const forcedPickups = this.pickups
            .filter((pickup) => !this.isChestPickup(pickup.type))
            .sort((a, b) => b.age - a.age);
        for (const source of forcedPickups) {
            if (this.pickups.length <= PICKUP_HARD_CAP) break;
            if (this.pickups.indexOf(source) < 0) continue;
            const target = this.findMergeablePickup(source.type, source.x, source.y, 99999, source);
            if (target) this.absorbPickupInto(source, target);
        }
    }

    // ── Visual radius ──────────────────────────────────────────────────────

    getPickupVisualRadius(type: PickupType, amount: number): number {
        if (this.isChestPickup(type)) return 14;
        const stackBonus = Math.log2(Math.max(1, Math.abs(amount))) * (type === 'xp' ? 0.65 : 1);
        return type === 'xp'
            ? Math.min(16, 8 + stackBonus)
            : Math.min(20, 10 + stackBonus);
    }

    // ── Collect / XP ───────────────────────────────────────────────────────

    private collectPickup(pickup: Pickup): void {
        if (pickup.type === 'xp') {
            this.ctx.playSfx('sfx_pickup', 0.22, 0.09);
            this.gainXp(pickup.amount);
        } else if (this.isChestPickup(pickup.type)) {
            if (this.cs.phase !== 'combat') return;
            this.ctx.playSfx('sfx_chest_open', 0.7, 0.35);
            this.openItemChoices(pickup.type === 'chest-rare' ? 'rare' : 'common');
        } else {
            this.ctx.playSfx('sfx_pickup', pickup.type === 'cores' || pickup.type === 'crystals' ? 0.52 : 0.32, 0.08);
            this.ctx.addBattleResource(pickup.type, pickup.amount);
            if (pickup.type === 'cores' || pickup.type === 'crystals') {
                const resource = this.ctx.getResourceDef(pickup.type);
                this.ctx.showToast(`获得${resource.name}，撤离后可用于高阶升级。`);
            }
        }
    }

    gainXp(amount: number): void {
        this.cs.xp += amount * (1 + this.ctx.getCharacterStats().xpGain);
        while (this.cs.xp >= this.cs.xpToNext && this.cs.phase === 'combat') {
            this.cs.xp -= this.cs.xpToNext;
            this.cs.level += 1;
            this.cs.xpToNext = Math.round(this.cs.xpToNext * 1.24 + 22 + this.cs.level * 5);
            // HP auto-growth every 3 levels
            if (this.cs.level % 3 === 0) {
                this.cs.playerMaxHp += 20;
                this.cs.playerHp += 20;
            }
            this.ctx.playSfx('sfx_level_up', 0.78, 0.45);
            this.openLevelChoices();
        }
    }

    // ── Draw / Remove ──────────────────────────────────────────────────────

    private drawPickup(pickup: Pickup): void {
        const chest = this.isChestPickup(pickup.type);
        let color = '#4CC9F0';
        if (this.isChestPickup(pickup.type)) {
            color = pickup.type === 'chest-rare' ? '#F59E0B' : '#43AA8B';
        } else if (pickup.type !== 'xp') {
            color = this.ctx.getResourceDef(pickup.type).color;
        }
        pickup.gfx.clear();
        if (pickup.sprite) {
            pickup.gfx.fillColor = this.ctx.hex('#020617', 60);
            pickup.gfx.circle(2, -2, pickup.radius + 6);
            pickup.gfx.fill();
            pickup.gfx.strokeColor = this.ctx.hex(color, 170);
            pickup.gfx.lineWidth = 2;
            pickup.gfx.circle(0, 0, pickup.radius + 9);
            pickup.gfx.stroke();
            return;
        }
        pickup.gfx.fillColor = this.ctx.hex('#020617', 90);
        pickup.gfx.circle(2, -2, pickup.radius + 3);
        pickup.gfx.fill();
        pickup.gfx.fillColor = this.ctx.hex(color);
        if (pickup.type === 'xp') {
            pickup.gfx.circle(0, 0, pickup.radius);
        } else if (chest) {
            pickup.gfx.roundRect(-pickup.radius - 3, -pickup.radius + 2, pickup.radius * 2 + 6, pickup.radius * 1.55, 5);
            pickup.gfx.fill();
            pickup.gfx.fillColor = this.ctx.hex('#F8FAFC', 190);
            pickup.gfx.roundRect(-pickup.radius - 3, -pickup.radius + 1, pickup.radius * 2 + 6, 5, 3);
            pickup.gfx.fill();
            pickup.gfx.fillColor = this.ctx.hex(pickup.type === 'chest-rare' ? '#B5179E' : '#0F172A', 210);
            pickup.gfx.roundRect(-4, -pickup.radius + 4, 8, pickup.radius * 1.22, 3);
        } else {
            pickup.gfx.moveTo(0, pickup.radius + 2);
            pickup.gfx.lineTo(pickup.radius + 2, 0);
            pickup.gfx.lineTo(0, -pickup.radius - 2);
            pickup.gfx.lineTo(-pickup.radius - 2, 0);
            pickup.gfx.close();
        }
        pickup.gfx.fill();
        pickup.gfx.strokeColor = this.ctx.hex('#F8FAFC', 190);
        pickup.gfx.lineWidth = 2;
        pickup.gfx.circle(0, 0, pickup.radius + 1);
        pickup.gfx.stroke();
    }

    removePickup(pickup: Pickup): void {
        const index = this.pickups.indexOf(pickup);
        if (index >= 0) this.pickups.splice(index, 1);
        pickup.node.destroy();
    }

    // ── Floating text ──────────────────────────────────────────────────────

    updateFloatingTexts(dt: number): void {
        if (this.floatingTexts.length <= 0) return;
        const removing: FloatingText[] = [];
        for (const floatingText of this.floatingTexts) {
            floatingText.life -= dt;
            floatingText.y += floatingText.vy * dt;
            floatingText.node.setPosition(floatingText.x, floatingText.y, 24);
            const alpha = Math.round(255 * this.ctx.clamp(floatingText.life / floatingText.maxLife, 0, 1));
            floatingText.label.color = this.ctx.hex(floatingText.color, alpha);
            if (floatingText.life <= 0) {
                removing.push(floatingText);
            }
        }
        for (const floatingText of removing) {
            this.recycleFloatingText(floatingText, true);
        }
    }

    private recycleFloatingText(floatingText: FloatingText, removeFromActive: boolean): void {
        if (removeFromActive) {
            const index = this.floatingTexts.indexOf(floatingText);
            if (index >= 0) this.floatingTexts.splice(index, 1);
        }
        floatingText.label.string = '';
        floatingText.node.active = false;
        this.floatingTextPool.push(floatingText);
    }

    private acquireFloatingText(): FloatingText {
        const pooled = this.floatingTextPool.pop();
        if (pooled) return pooled;

        const node = new Node('FloatingText');
        node.layer = Layers.Enum.UI_2D;
        this.ctx.worldNode!.addChild(node);
        node.addComponent(UITransform).setContentSize(120, 34);
        const label = node.addComponent(Label);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.enableWrapText = false;
        return {
            node,
            label,
            x: 0,
            y: 0,
            vy: 0,
            life: 0,
            maxLife: 0.72,
            color: '#F8FAFC',
        };
    }

    spawnFloatingText(text: string, x: number, y: number, color: string, fontSize?: number): void {
        if (!this.ctx.worldNode) return;
        if (this.floatingTexts.length >= FLOATING_TEXT_LIMIT) {
            const oldest = this.floatingTexts.shift();
            if (oldest) this.recycleFloatingText(oldest, false);
        }

        const floatingText = this.acquireFloatingText();
        floatingText.x = x;
        floatingText.y = y;
        floatingText.vy = 58 + Math.random() * 34;
        floatingText.life = 0.72;
        floatingText.maxLife = 0.72;
        floatingText.color = color;
        floatingText.node.active = true;
        floatingText.node.setPosition(x, y, 24);
        floatingText.label.string = text;
        floatingText.label.fontSize = fontSize || 20;
        floatingText.label.lineHeight = Math.round((fontSize || 20) * 1.12);
        floatingText.label.color = this.ctx.hex(color);
        this.floatingTexts.push(floatingText);
    }

    // ── Resource scaling ───────────────────────────────────────────────────

    private scaleResourceAmount(amount: number): number {
        const scaled = amount * this.ctx.getResourceMultiplier();
        const whole = Math.floor(scaled);
        return Math.max(1, whole + (Math.random() < scaled - whole ? 1 : 0));
    }

    // ── Choice panels ──────────────────────────────────────────────────────

    openLevelChoices(): void {
        this.cs.phase = 'level-up';
        if (this.ctx.rumbleVfx) this.ctx.rumbleVfx('levelUp');
        this.pendingLevelChoices = this.ctx.pickLevelChoices();
        this.renderChoicePanel(
            `角色 Lv.${this.cs.level} 属性成长`,
            `选择 1 项自身属性成长。刷新消耗 ${LEVEL_REFRESH_COST} 合金。`,
            this.pendingLevelChoices,
            LEVEL_REFRESH_COST,
        );
    }

    openItemChoices(quality: ItemChoiceQuality, refreshed = false): void {
        this.cs.phase = 'item-choice';
        this.currentItemChoiceQuality = quality;
        this.pendingItemChoices = this.ctx.pickItemChoices(quality);
        const title = quality === 'rare' ? '高级宝箱' : '普通宝箱';
        const hint = quality === 'rare'
            ? `选择 1 件高级本局道具。刷新消耗 ${CHEST_REFRESH_COST} 合金。`
            : `选择 1 件普通本局道具。刷新消耗 ${CHEST_REFRESH_COST} 合金。`;
        this.renderChoicePanel(title, hint, this.pendingItemChoices, CHEST_REFRESH_COST);
        if (!refreshed) this.ctx.showToast(`${title}开启，选择一件道具。`);
    }

    renderChoicePanel(title: string, hint: string, choices: LevelUpgrade[], refreshCost: number): void {
        if (this.panels.levelPanel) this.panels.levelPanel.active = true;
        if (this.panels.levelPanelShadow) this.panels.levelPanelShadow.active = true;
        if (this.panels.levelTitleLabel) this.panels.levelTitleLabel.string = title;
        if (this.panels.levelHintLabel) this.panels.levelHintLabel.string = hint;
        const iconMap: Record<string, string> = {
            'fire-control': 'stat_attack_power', 'neural-rapid': 'stat_attack_speed',
            'pierce-drill': 'stat_defense', 'multi-control': 'dmg_physical',
            'drone-command': 'wpn_drone_spirit', 'crit-instinct': 'stat_crit_chance',
            'weakpoint-study': 'stat_crit_damage', 'lethal-judgement': 'stat_lethal_chance',
        };
        this.panels.levelChoiceButtons.forEach((button, index) => {
            const choice = choices[index];
            button.node.active = !!choice;
            if (!choice) return;
            button.color = choice.color;
            button.label.string = `${choice.category}｜${choice.name}\n${choice.desc}`;
            this.ctx.drawButton(button, false);
            // Add icon to button
            const iconNodeName = `ChoiceIcon_${index}`;
            let iconNode = button.node.getChildByName(iconNodeName);
            const iconKey = iconMap[choice.id] || '';
            const sf = iconKey ? this.ctx.getIcon(iconKey) : null;
            if (sf) {
                if (!iconNode) {
                    iconNode = new Node(iconNodeName);
                    iconNode.layer = Layers.Enum.UI_2D;
                    button.node.addChild(iconNode);
                    const it = iconNode.addComponent(UITransform);
                    it.setContentSize(28, 28);
                    iconNode.addComponent(Sprite);
                }
                const sp = iconNode!.getComponent(Sprite)!;
                sp.spriteFrame = sf;
                sp.sizeMode = Sprite.SizeMode.CUSTOM;
                iconNode!.setPosition(-button.width / 2 + 22, 0);
            } else if (iconNode) {
                iconNode.active = false;
            }
        });
        if (this.panels.levelRefreshButton) {
            this.panels.levelRefreshButton.node.active = true;
            this.panels.levelRefreshButton.label.string = `刷新 -${refreshCost}合金`;
            this.ctx.drawButton(this.panels.levelRefreshButton, this.ctx.getSpendableAlloy() < refreshCost);
        }
    }

    choosePanelChoice(index: number): void {
        if (this.cs.phase === 'level-up') {
            this.chooseLevelUpgrade(index);
        } else if (this.cs.phase === 'item-choice') {
            this.chooseRunItem(index);
        }
    }

    chooseLevelUpgrade(index: number): void {
        if (this.cs.phase !== 'level-up') return;
        const choice = this.pendingLevelChoices[index];
        if (!choice) return;
        this.applyLevelUpgrade(choice.id);
        if (this.panels.levelPanel) this.panels.levelPanel.active = false;
        if (this.panels.levelPanelShadow) this.panels.levelPanelShadow.active = false;
        this.resumeCombatAfterChoice();
        this.ctx.showToast(`属性成长：${choice.name}`);
    }

    chooseRunItem(index: number): void {
        if (this.cs.phase !== 'item-choice') return;
        const choice = this.pendingItemChoices[index];
        if (!choice) return;
        this.applyRunItem(choice.id);
        if (this.panels.levelPanel) this.panels.levelPanel.active = false;
        if (this.panels.levelPanelShadow) this.panels.levelPanelShadow.active = false;
        this.resumeCombatAfterChoice();
        this.ctx.showToast(`获得本局道具：${choice.name}`);
    }

    resumeCombatAfterChoice(): void {
        this.cs.phase = 'combat';
        if (this.cs.xp >= this.cs.xpToNext) {
            this.openLevelChoices();
        }
    }

    applyLevelUpgrade(id: string): void {
        const upgrade = LEVEL_UPGRADES.find((item) => item.id === id);
        if (!upgrade) return;
        this.acquiredStatUpgradeIds.add(id);
        this.applyStatEffects(upgrade.effects);
    }

    applyRunItem(id: string): void {
        const item = RUN_ITEMS.find((upgrade) => upgrade.id === id);
        if (!item) return;
        this.acquiredRunItemIds.add(id);
        this.applyStatEffects(item.effects);
    }

    refreshCurrentChoices(): void {
        if (this.cs.phase === 'level-up') {
            if (!this.ctx.spendRunAlloy(LEVEL_REFRESH_COST)) {
                // Try ad refresh instead
                this.ctx.showToast(`合金不足，正在尝试视频免费刷新...`);
                if (this.ctx.rumbleVfx) this.ctx.rumbleVfx('adRefresh');
                AdManager.playRewardedAd((result) => {
                    if (!result.success) {
                        this.ctx.showToast('刷新失败，请重试。');
                        return;
                    }
                    this.pendingLevelChoices = this.ctx.pickLevelChoices();
                    this.renderChoicePanel(
                        `角色 Lv.${this.cs.level} 属性成长`,
                        `免费刷新成功！选择 1 项成长。`,
                        this.pendingLevelChoices,
                        LEVEL_REFRESH_COST,
                    );
                    this.ctx.showToast('看视频免费刷新成功！');
                });
                return;
            }
            this.pendingLevelChoices = this.ctx.pickLevelChoices();
            this.renderChoicePanel(
                `角色 Lv.${this.cs.level} 属性成长`,
                `选择 1 项自身属性成长。刷新消耗 ${LEVEL_REFRESH_COST} 合金。`,
                this.pendingLevelChoices,
                LEVEL_REFRESH_COST,
            );
            this.ctx.showToast('属性成长选项已刷新。');
            return;
        }

        if (this.cs.phase === 'item-choice') {
            if (!this.ctx.spendRunAlloy(CHEST_REFRESH_COST)) {
                this.ctx.showToast(`合金不足，刷新需要 ${CHEST_REFRESH_COST}。`);
                return;
            }
            this.openItemChoices(this.currentItemChoiceQuality, true);
            this.ctx.showToast('宝箱选项已刷新。');
        }
    }

    applyStatEffects(effects: StatEffect[]): void {
        const hpBefore = this.ctx.getMaxHp();
        const shieldBefore = this.ctx.getShieldMax();
        const stats = this.runStats as Record<StatKey, number>;
        for (const effect of effects) {
            stats[effect.stat] += effect.amount;
        }
        this.cs.playerMaxHp = this.ctx.getMaxHp();
        this.cs.playerShieldMax = this.ctx.getShieldMax();
        const hpDelta = this.cs.playerMaxHp - hpBefore;
        const shieldDelta = this.cs.playerShieldMax - shieldBefore;
        if (hpDelta > 0) this.cs.playerHp += hpDelta * 0.65;
        if (shieldDelta > 0) this.cs.playerShield += shieldDelta * 0.55;
        this.cs.playerHp = this.ctx.clamp(this.cs.playerHp, 1, this.cs.playerMaxHp);
        this.cs.playerShield = this.ctx.clamp(this.cs.playerShield, 0, this.cs.playerShieldMax);
    }

    // ── Loot ───────────────────────────────────────────────────────────────

    createLootChoices(): LootChoice[] {
        return createEquipmentLootChoiceSpecs({
            ownedEquipment: this.ctx.ownedEquipment,
            equipmentLevels: this.ctx.equipmentLevels,
            battleIndex: this.cs.battleIndex,
            getEquipmentLevel: (id: string) => this.ctx.getEquipmentLevel(id),
            isEquipmentLootEligible: (equipment, rare) => this.ctx.isEquipmentLootEligible
                ? this.ctx.isEquipmentLootEligible(equipment, rare)
                : !this.ctx.ownedEquipment.has(equipment.id),
        }, (items) => this.ctx.shuffle(items), true).map((spec) => this.toLootChoice(spec));
    }

    private toLootChoice(spec: EquipmentLootChoiceSpec): LootChoice {
        return {
            title: spec.title,
            desc: spec.desc,
            color: spec.color,
            apply: () => this.applyLootChoiceSpec(spec),
        };
    }

    private applyLootChoiceSpec(spec: EquipmentLootChoiceSpec): void {
        applyEquipmentLootChoiceSpec({
            ownedEquipment: this.ctx.ownedEquipment,
            equipmentLevels: this.ctx.equipmentLevels,
            getEquipmentLevel: (id: string) => this.ctx.getEquipmentLevel(id),
            addResources: (wallet: ResourceWallet) => {
                this.cs.shards += wallet.shards;
                this.cs.biomass += wallet.biomass;
                this.cs.circuits += wallet.circuits;
                this.cs.cores += wallet.cores;
                this.cs.crystals += wallet.crystals;
            },
        }, spec);
    }

    public refreshHud(): void {
        this.ctx.refreshHud();
    }
    chooseLoot(index: number): void {
        if (this.cs.phase !== 'loot') return;
        const choice = this.pendingLootChoices[index];
        if (!choice) return;
        choice.apply();
        this.ctx.saveProgress();
        this.ctx.showHangar(`战利品已获取：${choice.title}`);
    }

    // ── Clear / Reset ──────────────────────────────────────────────────────

    clearAll(): void {
        for (const pickup of this.pickups) pickup.node.destroy();
        for (const floatingText of [...this.floatingTexts]) this.recycleFloatingText(floatingText, true);
        this.pickups = [];
        this.floatingTexts = [];
    }

    resetRun(): void {
        this.runStats = this.createEmptyStats();
        this.acquiredRunItemIds = new Set();
        this.acquiredStatUpgradeIds = new Set();
        this.pendingItemChoices = [];
        this.currentItemChoiceQuality = 'common';
        this.pendingLevelChoices = [];
        this.pendingLootChoices = [];
    }
}

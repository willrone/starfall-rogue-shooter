import { Color, Graphics, Label, Node, sys, Vec2 } from 'cc';
import { PanelManager } from '../ui/panels';
import { CombatState } from '../state/combatState';
import { EQUIPMENT, GEAR_COUNT, STARTER_EQUIPMENT_IDS } from '../catalogs/equipmentCatalog';
import { WEAPON_CATALOG, WEAPON_COUNT, getWeaponStyleName } from '../catalogs/weaponCatalog';
import { RUN_ITEMS, RUN_ITEM_COUNT, formatRunItemEffect } from '../catalogs/runItemCatalog';
import {
    createEmptyWallet as createResourceWallet,
    formatWallet as formatResourceWallet,
    hasResources as walletHasResources,
    spendResources as spendWalletResources,
} from '../core/resources';
import type {
    ResourceWallet,
    EquipmentDef,
    LevelUpgrade,
    GearSlot,
    CharacterStats,
    LootChoice,
} from '../core/types';

// ── Constants ──────────────────────────────────────────────────────────────
const SHOP_REFRESH_COST = 22;
const SHOP_ITEM_COUNT = 6;
const CHEST_REFRESH_COST = 34;
const SAVE_KEY = 'starfall-rogue-shooter-progress-v1';
const HANGAR_EQUIPMENT_SLOTS = 8;
const EQUIPPED_SLOT_COUNT = 6;
const MAX_EQUIPPED_WEAPONS = 2;
const MAX_EQUIPPED_GEAR = 4;

const GEAR_SLOT_ORDER: GearSlot[] = ['hat', 'armor', 'boots', 'accessory'];
const GEAR_SLOT_LABELS: Record<GearSlot, string> = {
    hat: '帽子',
    armor: '护甲',
    boots: '鞋子',
    accessory: '首饰',
};

// ── Types ──────────────────────────────────────────────────────────────────
interface ButtonView {
    node: Node;
    gfx: Graphics;
    label: Label;
    width: number;
    height: number;
    color: string;
    disabledColor: string;
    disabled: boolean;
}

export interface ShopHostContext {
    cs: CombatState;
    panels: PanelManager;
    pickupMgr: { acquiredRunItemIds: Set<string>; applyRunItem(id: string): void };

    showToast(msg: string): void;
    refreshHud(): void;
    requestBgm(name: string): void;
    hex(hex: string, alpha?: number): Color;
    drawButton(button: ButtonView, disabled: boolean): void;
    formatWallet(wallet: ResourceWallet): string;
    shuffle<T>(arr: T[]): T[];
    clamp(value: number, min: number, max: number): number;
    formatTime(seconds: number): string;
    formatStat(value: number): string;
    getCharacterStats(): CharacterStats;
    getActiveWeapon(): EquipmentDef | null;
    getDroneStrikeInterval(dronePower: number): number;
    getDroneStrikeCount(dronePower: number): number;
    getWeaponStat(key: string): number;
    getOwnedWeaponCount(): number;
    addCharacterStats(target: CharacterStats, source: CharacterStats): void;
    updateJoystickView(): void;
    touchActive: boolean;
    touchVector: Vec2;
}

// ── EquipmentManager ───────────────────────────────────────────────────────
export class EquipmentManager {
    equipmentLevels: Record<string, number> = {};
    ownedEquipment = new Set<string>();
    equippedEquipment: string[] = [];
    selectedEquipmentId = '';
    equipmentPage = 0;
    visibleHangarEquipment: EquipmentDef[] = [];
    shopOffers: (LevelUpgrade | null)[] = [];

    private ctx: ShopHostContext;

    constructor(ctx: ShopHostContext) {
        this.ctx = ctx;
    }

    // ── Persistence ──────────────────────────────────────────────────────
    loadProgress() {
        this.ownedEquipment = new Set(STARTER_EQUIPMENT_IDS);
        this.equippedEquipment = [...STARTER_EQUIPMENT_IDS];
        this.ctx.cs.shards = 24;
        this.ctx.cs.biomass = 12;
        this.ctx.cs.circuits = 10;
        this.ctx.cs.crystals = 0;
        this.equipmentLevels = {};
        for (const id of STARTER_EQUIPMENT_IDS) this.equipmentLevels[id] = 1;
        try {
            const raw = sys.localStorage.getItem(SAVE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            this.ctx.cs.battlesWon = Math.max(0, Number(data.battlesWon) || 0);
            this.ctx.cs.alloy = 0;
            this.ctx.cs.cores = Math.max(0, Number(data.cores) || 0);
            this.ctx.cs.shards = Math.max(0, Number(data.shards) || this.ctx.cs.shards);
            this.ctx.cs.biomass = Math.max(0, Number(data.biomass) || this.ctx.cs.biomass);
            this.ctx.cs.circuits = Math.max(0, Number(data.circuits) || this.ctx.cs.circuits);
            this.ctx.cs.crystals = Math.max(0, Number(data.crystals) || 0);
            if (Array.isArray(data.ownedEquipment)) {
                this.ownedEquipment = new Set(data.ownedEquipment);
            }
            if (data.equipmentLevels && typeof data.equipmentLevels === 'object') {
                this.equipmentLevels = data.equipmentLevels;
            }
            if (Array.isArray(data.equippedEquipment)) {
                this.equippedEquipment = data.equippedEquipment.filter((id: string) => typeof id === 'string');
            }
            for (const id of STARTER_EQUIPMENT_IDS) {
                this.ownedEquipment.add(id);
                this.equipmentLevels[id] = Math.max(1, this.getEquipmentLevel(id));
            }
            this.normalizeEquippedEquipment();
        } catch (error) {
            console.warn('Failed to load rogue shooter progress', error);
        }
    }

    saveProgress() {
        try {
            sys.localStorage.setItem(SAVE_KEY, JSON.stringify({
                battlesWon: this.ctx.cs.battlesWon,
                cores: this.ctx.cs.cores,
                shards: this.ctx.cs.shards,
                biomass: this.ctx.cs.biomass,
                circuits: this.ctx.cs.circuits,
                crystals: this.ctx.cs.crystals,
                ownedEquipment: [...this.ownedEquipment],
                equippedEquipment: this.equippedEquipment,
                equipmentLevels: this.equipmentLevels,
            }));
        } catch (error) {
            console.warn('Failed to save rogue shooter progress', error);
        }
    }

    // ── Equipment lookup helpers ─────────────────────────────────────────
    findEquipment(id: string | undefined): EquipmentDef | null {
        if (!id) return null;
        for (const equipment of EQUIPMENT) {
            if (equipment.id === id) return equipment;
        }
        return null;
    }

    isEquipped(id: string): boolean {
        return this.equippedEquipment.indexOf(id) >= 0;
    }

    getEquipmentLevel(id: string): number {
        if (!this.ownedEquipment.has(id)) return 0;
        return Math.max(1, Math.floor(this.equipmentLevels[id] || 1));
    }

    getActiveEquipmentLevel(id: string): number {
        if (!this.isEquipped(id)) return 0;
        return this.getEquipmentLevel(id);
    }

    getSelectedEquipment(): EquipmentDef | null {
        return this.findEquipment(this.selectedEquipmentId) || this.visibleHangarEquipment[0] || EQUIPMENT[0] || null;
    }

    getEquippedEquipmentDefs(): EquipmentDef[] {
        const equipment: EquipmentDef[] = [];
        for (const id of this.equippedEquipment) {
            const found = this.findEquipment(id);
            if (found && this.ownedEquipment.has(found.id)) {
                equipment.push(found);
            }
        }
        return equipment;
    }

    getEquippedWeapons(): EquipmentDef[] {
        return this.getEquippedEquipmentDefs().filter((equipment) => equipment.kind === 'weapon');
    }

    getEquippedGear(): EquipmentDef[] {
        return this.getEquippedEquipmentDefs().filter((equipment) => equipment.kind === 'gear');
    }

    getEquippedGearForSlot(slot: GearSlot): EquipmentDef | null {
        return this.getEquippedGear().find((equipment) => equipment.gearSlot === slot) || null;
    }

    getActiveWeapon(): EquipmentDef | null {
        const weapons = this.getEquippedWeapons();
        if (weapons.length <= 0) return null;
        this.ctx.cs.activeWeaponIndex = this.ctx.clamp(this.ctx.cs.activeWeaponIndex, 0, weapons.length - 1);
        return weapons[this.ctx.cs.activeWeaponIndex] || weapons[0] || null;
    }

    getOwnedWeapons(): EquipmentDef[] {
        return WEAPON_CATALOG.filter((equipment) => this.ownedEquipment.has(equipment.id));
    }

    getOwnedWeaponCount(): number {
        return this.getOwnedWeapons().length;
    }

    // ── Warehouse / hangar display ───────────────────────────────────────
    getWarehouseSortScore(equipment: EquipmentDef): number {
        if (this.isEquipped(equipment.id)) return 0;
        if (this.ownedEquipment.has(equipment.id) && this.getEquipmentLevel(equipment.id) < equipment.maxLevel) return 1;
        if (this.ownedEquipment.has(equipment.id)) return 2;
        if (equipment.kind === 'weapon') return 3;
        return 4 + Math.max(0, GEAR_SLOT_ORDER.indexOf(equipment.gearSlot || 'accessory'));
    }

    getWarehouseEquipmentList(): EquipmentDef[] {
        return [...EQUIPMENT].sort((a, b) => {
            const aScore = this.getWarehouseSortScore(a);
            const bScore = this.getWarehouseSortScore(b);
            if (aScore !== bScore) return aScore - bScore;
            return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
        });
    }

    getEquipmentPageCount(): number {
        return Math.max(1, Math.ceil(this.getWarehouseEquipmentList().length / HANGAR_EQUIPMENT_SLOTS));
    }

    getVisibleHangarEquipment(): EquipmentDef[] {
        const list = this.getWarehouseEquipmentList();
        const maxPage = this.getEquipmentPageCount() - 1;
        this.equipmentPage = this.ctx.clamp(this.equipmentPage, 0, Math.max(0, maxPage));
        const start = this.equipmentPage * HANGAR_EQUIPMENT_SLOTS;
        return list.slice(start, start + HANGAR_EQUIPMENT_SLOTS);
    }

    normalizeEquippedEquipment() {
        const weapons: string[] = [];
        const gearBySlot: Partial<Record<GearSlot, string>> = {};
        for (const id of this.equippedEquipment) {
            if (weapons.indexOf(id) >= 0) continue;
            const equipment = this.findEquipment(id);
            if (!equipment || !this.ownedEquipment.has(equipment.id)) continue;
            if (equipment.kind === 'weapon') {
                if (weapons.length >= MAX_EQUIPPED_WEAPONS) continue;
                weapons.push(equipment.id);
                continue;
            }
            if (!equipment.gearSlot || gearBySlot[equipment.gearSlot]) continue;
            gearBySlot[equipment.gearSlot] = equipment.id;
        }

        if (weapons.length <= 0 && this.ownedEquipment.has('storm-rifle')) {
            weapons.unshift('storm-rifle');
        }

        this.equippedEquipment = [
            ...weapons,
            ...GEAR_SLOT_ORDER
                .map((slot) => gearBySlot[slot])
                .filter((id): id is string => !!id),
        ].slice(0, EQUIPPED_SLOT_COUNT);
        this.ctx.cs.activeWeaponIndex = this.ctx.clamp(this.ctx.cs.activeWeaponIndex, 0, Math.max(0, weapons.length - 1));
        if (!this.findEquipment(this.selectedEquipmentId)) {
            this.selectedEquipmentId = this.equippedEquipment[0] || 'storm-rifle';
        }
    }

    // ── Resource helpers ─────────────────────────────────────────────────
    private createEmptyWallet(): ResourceWallet {
        return createResourceWallet();
    }

    getInventoryWallet(): ResourceWallet {
        return {
            alloy: 0,
            cores: this.ctx.cs.cores,
            shards: this.ctx.cs.shards,
            biomass: this.ctx.cs.biomass,
            circuits: this.ctx.cs.circuits,
            crystals: this.ctx.cs.crystals,
        };
    }

    getSpendableAlloy(): number {
        return Math.max(0, this.ctx.cs.battleAlloy);
    }

    spendRunAlloy(cost: number): boolean {
        const amount = Math.max(0, Math.floor(cost));
        if (this.getSpendableAlloy() < amount) return false;
        this.ctx.cs.battleAlloy -= amount;
        this.ctx.refreshHud();
        return true;
    }

    hasResources(cost: ResourceWallet): boolean {
        return walletHasResources(this.getInventoryWallet(), cost);
    }

    spendResources(cost: ResourceWallet) {
        const next = spendWalletResources(this.getInventoryWallet(), cost);
        if (!next) return;
        this.ctx.cs.cores = next.cores;
        this.ctx.cs.shards = next.shards;
        this.ctx.cs.biomass = next.biomass;
        this.ctx.cs.circuits = next.circuits;
        this.ctx.cs.crystals = next.crystals;
    }

    addWalletToInventory(wallet: ResourceWallet) {
        this.ctx.cs.cores += wallet.cores;
        this.ctx.cs.shards += wallet.shards;
        this.ctx.cs.biomass += wallet.biomass;
        this.ctx.cs.circuits += wallet.circuits;
        this.ctx.cs.crystals += wallet.crystals;
    }

    formatCost(cost: ResourceWallet): string {
        return this.ctx.formatWallet(cost);
    }

    // ── Upgrade / craft costs ───────────────────────────────────────────
    getUpgradeCost(equipment: EquipmentDef): ResourceWallet {
        const level = this.getEquipmentLevel(equipment.id);
        const cost = this.createEmptyWallet();
        if (equipment.kind === 'weapon') {
            cost.shards = Math.ceil(level * 1.8 + equipment.baseCost / 38);
            cost.circuits = Math.ceil(level * 1.05 + equipment.baseCost / 70);
        } else {
            const slot = equipment.gearSlot || 'accessory';
            const base = Math.max(1, equipment.baseCost);
            if (slot === 'hat') {
                cost.circuits = Math.ceil(level * 1.25 + base / 58);
                cost.shards = Math.ceil(level * 1.1 + base / 64);
            } else if (slot === 'armor') {
                cost.biomass = Math.ceil(level * 1.65 + base / 46);
                cost.cores = Math.max(cost.cores, Math.floor(level / 4));
            } else if (slot === 'boots') {
                cost.biomass = Math.ceil(level * 1.15 + base / 60);
                cost.circuits = Math.ceil(level * 1.1 + base / 68);
            } else {
                cost.shards = Math.ceil(level * 1.45 + base / 48);
                cost.circuits = Math.ceil(level * 0.9 + base / 78);
            }
        }
        if (level >= 4) cost.cores = Math.ceil((level - 3) / 2);
        if (level >= 7) cost.crystals = Math.ceil((level - 6) / 2);
        return cost;
    }

    getCraftCost(equipment: EquipmentDef): ResourceWallet {
        const cost = this.createEmptyWallet();
        if (equipment.kind === 'weapon') {
            cost.shards = 18 + Math.ceil(equipment.baseCost / 14);
            cost.circuits = 6 + Math.ceil(equipment.baseCost / 26);
        } else {
            const slot = equipment.gearSlot || 'accessory';
            if (slot === 'hat') {
                cost.circuits = 6 + Math.ceil(equipment.baseCost / 28);
                cost.shards = 8 + Math.ceil(equipment.baseCost / 35);
            } else if (slot === 'armor') {
                cost.biomass = 10 + Math.ceil(equipment.baseCost / 24);
                cost.cores = equipment.baseCost >= 120 ? 2 : equipment.baseCost >= 70 ? 1 : 0;
            } else if (slot === 'boots') {
                cost.biomass = 8 + Math.ceil(equipment.baseCost / 32);
                cost.circuits = 5 + Math.ceil(equipment.baseCost / 40);
            } else {
                cost.shards = 12 + Math.ceil(equipment.baseCost / 24);
                cost.circuits = 4 + Math.ceil(equipment.baseCost / 52);
            }
        }
        if (equipment.baseCost >= 60) cost.crystals = 1;
        if (equipment.baseCost >= 160) cost.crystals += 1;
        return cost;
    }

    // ── Formatting ──────────────────────────────────────────────────────
    formatStat(value: number): string {
        return Number(value.toFixed(1)).toString();
    }

    formatGearStats(equipment: EquipmentDef, level: number): string {
        if (!equipment.gearStats || equipment.gearStats.length <= 0) return '暂无属性词条。';
        return equipment.gearStats
            .map((effect) => formatRunItemEffect({ stat: effect.stat, amount: effect.amount * level }))
            .join('  ');
    }

    formatEquipmentDetail(equipment: EquipmentDef): string {
        const owned = this.ownedEquipment.has(equipment.id);
        const equipped = this.isEquipped(equipment.id);
        const level = this.getEquipmentLevel(equipment.id);
        const detailLevel = owned ? level : 1;
        const activeWeapon = this.getActiveWeapon();
        const equippedState = equipment.kind === 'weapon'
            ? activeWeapon?.id === equipment.id ? '  当前武器' : equipped ? '  出战中-可切换' : ''
            : equipped ? '  出战中-被动生效' : '';
        const state = `${owned ? `Lv.${level}/${equipment.maxLevel}` : '未获得'}${equippedState}`;
        const slotName = equipment.kind === 'weapon' ? '武器' : equipment.gearSlot ? GEAR_SLOT_LABELS[equipment.gearSlot] : '装备';
        const rarity = equipment.rarity || '普通';
        const lines = [`${equipment.name}  [${rarity}] ${slotName}  ${state}`, equipment.desc];
        if (equipment.weaponStats) {
            if (equipment.attackStyle) {
                lines.push(`攻击风格：${getWeaponStyleName(equipment.attackStyle)}${equipment.kind === 'weapon' && equipped ? '；战斗中只有当前武器属性生效' : ''}`);
            }
            const dmg = equipment.weaponStats.damage * detailLevel;
            const rate = equipment.weaponStats.fireRate * detailLevel;
            const pier = equipment.weaponStats.pierce * detailLevel;
            const multi = equipment.weaponStats.multiShot * detailLevel;
            lines.push(`伤害 ${this.formatStat(dmg)}  |  射速 ${this.formatStat(rate)}次/秒  |  穿透 ${this.formatStat(pier)}`);
            lines.push(`弹丸 +${this.formatStat(multi)}  |  弹速倍率 ${this.formatStat(equipment.weaponStats.bulletSpeed * detailLevel)}`);
        } else {
            lines.push(this.formatGearStats(equipment, detailLevel));
        }
        if (!owned) {
            lines.push(`合成消耗：${this.formatCost(this.getCraftCost(equipment))}`);
        } else if (level < equipment.maxLevel) {
            lines.push(`升级消耗：${this.formatCost(this.getUpgradeCost(equipment))}`);
        }
        return lines.join('\n');
    }

    // ── Shop logic ──────────────────────────────────────────────────────
    ensureShopOffers() {
        while (this.shopOffers.length < SHOP_ITEM_COUNT) {
            this.shopOffers.push(this.pickShopOfferForSlot(this.shopOffers.length));
        }
        for (let i = 0; i < SHOP_ITEM_COUNT; i++) {
            if (!this.shopOffers[i] || this.ctx.pickupMgr.acquiredRunItemIds.has(this.shopOffers[i]!.id)) {
                this.shopOffers[i] = this.pickShopOfferForSlot(i);
            }
        }
        this.shopOffers = this.shopOffers.slice(0, SHOP_ITEM_COUNT);
    }

    pickShopOfferForSlot(index: number): LevelUpgrade {
        const maxTier = this.getRunItemTierLimit();
        const excluded = new Set<string>();
        for (let i = 0; i < this.shopOffers.length; i++) {
            if (i !== index && this.shopOffers[i]) excluded.add(this.shopOffers[i]!.id);
        }
        for (const id of this.ctx.pickupMgr.acquiredRunItemIds) excluded.add(id);

        const available = RUN_ITEMS.filter((item) => item.tier <= maxTier && !excluded.has(item.id));
        const fallback = RUN_ITEMS.filter((item) => item.tier <= maxTier && !this.ctx.pickupMgr.acquiredRunItemIds.has(item.id));
        const pool = available.length > 0 ? available : fallback.length > 0 ? fallback : RUN_ITEMS.filter((item) => item.tier <= maxTier);
        return this.pickDistinctItems(pool, 1)[0] || RUN_ITEMS[0];
    }

    pickDistinctItems(pool: LevelUpgrade[], count: number): LevelUpgrade[] {
        const picked: LevelUpgrade[] = [];
        const usedCategories = new Set<string>();
        const shuffled = this.ctx.shuffle(pool);
        for (const item of shuffled) {
            if (picked.length >= count) break;
            if (usedCategories.has(item.category) && picked.length < Math.ceil(count * 0.6)) continue;
            picked.push(item);
            usedCategories.add(item.category);
        }
        for (const item of shuffled) {
            if (picked.length >= count) break;
            if (picked.indexOf(item) < 0) picked.push(item);
        }
        return picked.slice(0, count);
    }

    getRunItemTierLimit(): number {
        const minutes = Math.floor(this.ctx.cs.combatTime / 150);
        return this.ctx.clamp(2 + Math.floor(this.ctx.cs.endlessCycle / 2) + minutes, 2, 5);
    }

    getShopItemCost(item: LevelUpgrade): number {
        const waveFee = Math.floor(this.ctx.cs.waveIndex / 4) * 5;
        const cycleFee = (this.ctx.cs.endlessCycle - 1) * 10;
        const baseCost = 44 + item.tier * 22 + waveFee + cycleFee;
        return Math.max(50, Math.round(baseCost * this.getRunItemShopPriceMultiplier(item)));
    }

    getRunItemShopPriceMultiplier(item: LevelUpgrade): number {
        let multiplier = 1;
        let offense = 0;
        let defense = 0;
        let utility = 0;
        let drawback = 0;

        for (const effect of item.effects) {
            const amount = effect.amount;
            if (amount > 0) {
                switch (effect.stat) {
                    case 'attackPower':
                        offense += amount / 18;
                        break;
                    case 'attackSpeed':
                        offense += amount * 3.5;
                        break;
                    case 'pierce':
                        offense += amount * 0.55;
                        break;
                    case 'multiShot':
                        offense += amount * 0.5;
                        break;
                    case 'dronePower':
                        offense += amount * 0.26;
                        break;
                    case 'critChance':
                    case 'lethalChance':
                        offense += amount * 7.5;
                        break;
                    case 'critDamage':
                    case 'lethalDamage':
                        offense += amount * 0.28;
                        break;
                    case 'lethalMaxHpPct':
                        offense += amount * 8;
                        break;
                    case 'maxHp':
                    case 'shieldMax':
                    case 'physicalDefense':
                    case 'magicDefense':
                    case 'fireDefense':
                    case 'lightningDefense':
                    case 'poisonDefense':
                    case 'iceDefense':
                    case 'shieldRegen':
                    case 'hpRegen':
                    case 'damageReduction':
                    case 'dodgeChance':
                        defense += 1;
                        break;
                    case 'moveSpeed':
                    case 'pickupRange':
                    case 'luck':
                    case 'xpGain':
                    case 'resourceGain':
                    case 'attackRange':
                    case 'bulletSpeed':
                        utility += 1;
                        break;
                    default:
                        break;
                }
            } else {
                switch (effect.stat) {
                    case 'attackPower':
                        drawback += Math.abs(amount) / 14;
                        break;
                    case 'attackSpeed':
                    case 'damageReduction':
                        drawback += Math.abs(amount) * 4;
                        break;
                    case 'maxHp':
                    case 'shieldMax':
                        drawback += Math.abs(amount) / 80;
                        break;
                    case 'moveSpeed':
                    case 'physicalDefense':
                    case 'magicDefense':
                    case 'fireDefense':
                    case 'lightningDefense':
                    case 'poisonDefense':
                    case 'iceDefense':
                        drawback += Math.abs(amount) / 45;
                        break;
                    default:
                        drawback += 0.05;
                        break;
                }
            }
        }

        multiplier += Math.min(0.52, offense * 0.18);
        if (offense < 0.3 && defense > 0) multiplier -= 0.08;
        if (offense < 0.35 && utility > 0) multiplier -= 0.12;
        multiplier -= Math.min(0.14, drawback * 0.06);
        return this.ctx.clamp(multiplier, 0.72, 1.55);
    }

    // ── Shop UI ─────────────────────────────────────────────────────────
    openShop() {
        if (this.ctx.cs.phase !== 'combat') return;
        this.ctx.cs.phase = 'shop';
        this.ctx.touchActive = false;
        this.ctx.touchVector.set(0, 0);
        this.ctx.updateJoystickView();
        this.ensureShopOffers();
        this.ctx.panels.setShopPanelActive(true);
        if (this.ctx.panels.levelPanel) this.ctx.panels.levelPanel.active = false;
        if (this.ctx.panels.levelPanelShadow) this.ctx.panels.levelPanelShadow.active = false;
        this.renderShop();
        this.ctx.showToast('战场商店已打开，购买或刷新单个格子。');
    }

    buyShopItem(index: number) {
        if (this.ctx.cs.phase !== 'shop') return;
        const item = this.shopOffers[index];
        if (!item) return;
        const cost = this.getShopItemCost(item);
        if (!this.spendRunAlloy(cost)) {
            this.ctx.showToast(`合金不足，需要 ${cost}。`);
            return;
        }
        this.ctx.pickupMgr.applyRunItem(item.id);
        this.shopOffers[index] = this.pickShopOfferForSlot(index);
        this.renderShop();
        this.ctx.showToast(`购买本局道具：${item.name}，该格已补货。`);
    }

    refreshShopSlot(index: number) {
        if (this.ctx.cs.phase !== 'shop') return;
        if (!this.spendRunAlloy(SHOP_REFRESH_COST)) {
            this.ctx.showToast(`合金不足，刷新需要 ${SHOP_REFRESH_COST}。`);
            return;
        }
        this.shopOffers[index] = this.pickShopOfferForSlot(index);
        this.renderShop();
        this.ctx.showToast('该格商品已刷新。');
    }

    closeShop() {
        if (this.ctx.cs.phase !== 'shop') return;
        this.ctx.panels.setShopPanelActive(false);
        this.ctx.cs.phase = 'combat';
        this.ctx.showToast('商店离开，战斗继续。');
    }

    renderShop() {
        if (this.ctx.panels.shopTitleLabel) this.ctx.panels.shopTitleLabel.string = `战场商店  ${this.ctx.formatTime(this.ctx.cs.combatTime)}`;
        if (this.ctx.panels.shopTipLabel) {
            this.ctx.panels.shopTipLabel.string = `可用合金 ${this.getSpendableAlloy()}。购买后自动补货；单格刷新 -${SHOP_REFRESH_COST} 合金。`;
        }
        this.ctx.panels.shopButtons.forEach((button: ButtonView, index: number) => {
            const item = this.shopOffers[index];
            button.node.active = !!item;
            if (!item) return;
            const cost = this.getShopItemCost(item);
            button.color = item.color;
            button.label.string = `${item.category} T${item.tier}  合金${cost}\n${item.name}\n${item.desc}`;
            this.ctx.drawButton(button, this.getSpendableAlloy() < cost);
        });
        this.ctx.panels.shopSlotRefreshButtons.forEach((button: ButtonView) => {
            button.label.string = `刷新此格 -${SHOP_REFRESH_COST}`;
            this.ctx.drawButton(button, this.getSpendableAlloy() < SHOP_REFRESH_COST);
        });
        if (this.ctx.panels.shopCloseButton) {
            this.ctx.panels.shopCloseButton.label.string = '继续战斗';
            this.ctx.drawButton(this.ctx.panels.shopCloseButton, false);
        }
    }

    // ── Hangar / equipment UI ───────────────────────────────────────────
    showHangar(message: string) {
        this.ctx.cs.phase = 'hangar';
        this.ctx.requestBgm('bgm_hangar');
        this.ctx.panels.setMenuPanelActive(false);
        if (this.ctx.panels.pausePanel) this.ctx.panels.pausePanel.active = false;
        if (this.ctx.panels.pausePanelShadow) this.ctx.panels.pausePanelShadow.active = false;
        if (this.ctx.panels.settingsPanel) this.ctx.panels.settingsPanel.active = false;
        if (this.ctx.panels.settingsPanelShadow) this.ctx.panels.settingsPanelShadow.active = false;
        if (this.ctx.panels.infoPanel) this.ctx.panels.infoPanel.active = false;
        if (this.ctx.panels.infoPanelShadow) this.ctx.panels.infoPanelShadow.active = false;
        if (this.ctx.panels.hangarPanel) this.ctx.panels.hangarPanel.active = true;
        if (this.ctx.panels.hangarPanelShadow) this.ctx.panels.hangarPanelShadow.active = true;
        if (this.ctx.panels.levelPanel) this.ctx.panels.levelPanel.active = false;
        if (this.ctx.panels.levelPanelShadow) this.ctx.panels.levelPanelShadow.active = false;
        this.ctx.panels.setShopPanelActive(false);
        this.ctx.panels.setCombatHudControlsActive(false);
        this.ctx.panels.lootButtons.forEach((button: ButtonView) => button.node.active = false);
        this.ctx.panels.setHangarControlsActive(true);
        if (this.ctx.panels.startButton) {
            this.ctx.panels.startButton.node.active = true;
            this.ctx.panels.startButton.label.string = `开始第 ${this.ctx.cs.battlesWon + 1} 次出击`;
        }
        if (this.ctx.panels.hangarTitleLabel) this.ctx.panels.hangarTitleLabel.string = '机库整备';
        if (this.ctx.panels.hangarTipLabel) this.ctx.panels.hangarTipLabel.string = message;
        this.refreshEquipmentButtons();
        this.ctx.refreshHud();
    }

    createLootChoices(): LootChoice[] {
        const choices: LootChoice[] = [];
        const locked = this.ctx.shuffle(EQUIPMENT.filter((equipment) => !this.ownedEquipment.has(equipment.id)));
        if (locked.length > 0) {
            const unlock = locked[0];
            choices.push({
                title: `新装备：${unlock.name}`,
                desc: unlock.desc,
                color: unlock.color,
                apply: () => {
                    this.ownedEquipment.add(unlock.id);
                    this.equipmentLevels[unlock.id] = Math.max(1, this.getEquipmentLevel(unlock.id));
                },
            });
        }

        const owned = this.ctx.shuffle(EQUIPMENT.filter((equipment) => this.ownedEquipment.has(equipment.id) && this.getEquipmentLevel(equipment.id) < equipment.maxLevel));
        for (const equipment of owned.slice(0, 2)) {
            choices.push({
                title: `强化：${equipment.name}`,
                desc: `免费升 1 级。${equipment.desc}`,
                color: equipment.color,
                apply: () => {
                    this.equipmentLevels[equipment.id] = Math.min(equipment.maxLevel, this.getEquipmentLevel(equipment.id) + 1);
                },
            });
        }

        choices.push({
            title: '资源箱',
            desc: '立刻获得装备碎片、生体样本、电路板和 1 核心。',
            color: '#43AA8B',
            apply: () => {
                this.ctx.cs.shards += 8 + this.ctx.cs.battleIndex * 2;
                this.ctx.cs.biomass += 5 + this.ctx.cs.battleIndex;
                this.ctx.cs.circuits += 4 + Math.floor(this.ctx.cs.battleIndex / 2);
                this.ctx.cs.cores += 1;
            },
        });

        while (choices.length < 3) {
            const equipment = owned[choices.length % Math.max(1, owned.length)] || EQUIPMENT[0];
            choices.push({
                title: `校准：${equipment.name}`,
                desc: '免费升 1 级，若已满级则转化为装备碎片和核心。',
                color: equipment.color,
                apply: () => {
                    if (this.getEquipmentLevel(equipment.id) < equipment.maxLevel) {
                        this.equipmentLevels[equipment.id] = this.getEquipmentLevel(equipment.id) + 1;
                    } else {
                        this.ctx.cs.shards += 10;
                        this.ctx.cs.cores += 1;
                    }
                },
            });
        }

        return this.ctx.shuffle(choices).slice(0, 3);
    }

    selectVisibleEquipment(index: number) {
        const equipment = this.visibleHangarEquipment[index];
        if (!equipment) return;
        this.selectedEquipmentId = equipment.id;
        this.refreshEquipmentButtons();
        this.ctx.refreshHud();
    }

    selectEquippedSlot(index: number) {
        const equipment = this.getEquipmentForDisplaySlot(index);
        if (!equipment) return;
        this.selectedEquipmentId = equipment.id;
        this.refreshEquipmentButtons();
        this.ctx.refreshHud();
    }

    changeEquipmentPage(delta: number) {
        const maxPage = this.getEquipmentPageCount() - 1;
        this.equipmentPage = this.ctx.clamp(this.equipmentPage + delta, 0, Math.max(0, maxPage));
        this.refreshEquipmentButtons();
    }

    toggleSelectedEquipment() {
        if (this.ctx.cs.phase !== 'hangar') return;
        const equipment = this.getSelectedEquipment();
        if (!equipment) return;
        if (!this.ownedEquipment.has(equipment.id)) {
            this.craftEquipment(equipment);
            return;
        }

        if (this.isEquipped(equipment.id)) {
            if (equipment.kind === 'weapon' && this.getEquippedWeapons().length <= 1) {
                this.ctx.showToast('至少保留 1 把出战武器。');
                return;
            }
            this.equippedEquipment = this.equippedEquipment.filter((id) => id !== equipment.id);
            this.ctx.showToast(`${equipment.name} 已卸下。`);
        } else {
            if (equipment.kind === 'weapon') {
                if (this.equippedEquipment.length >= EQUIPPED_SLOT_COUNT) {
                    this.ctx.showToast(`出战槽已满，最多携带 ${EQUIPPED_SLOT_COUNT} 件装备。`);
                    return;
                }
                if (this.getEquippedWeapons().length >= MAX_EQUIPPED_WEAPONS) {
                    this.ctx.showToast(`武器最多携带 ${MAX_EQUIPPED_WEAPONS} 把。`);
                    return;
                }
            } else {
                if (!equipment.gearSlot) return;
                const sameSlot = this.getEquippedGearForSlot(equipment.gearSlot);
                if (sameSlot) {
                    this.equippedEquipment = this.equippedEquipment.filter((id) => id !== sameSlot.id);
                } else {
                    if (this.equippedEquipment.length >= EQUIPPED_SLOT_COUNT) {
                        this.ctx.showToast(`出战槽已满，最多携带 ${EQUIPPED_SLOT_COUNT} 件装备。`);
                        return;
                    }
                    if (this.getEquippedGear().length >= MAX_EQUIPPED_GEAR) {
                        this.ctx.showToast(`装备最多携带 ${MAX_EQUIPPED_GEAR} 件。`);
                        return;
                    }
                }
            }
            this.equippedEquipment.push(equipment.id);
            this.ctx.showToast(`${equipment.name} 已加入出战。`);
        }

        this.normalizeEquippedEquipment();
        this.saveProgress();
        this.refreshEquipmentButtons();
        this.ctx.refreshHud();
    }

    upgradeSelectedEquipment() {
        const equipment = this.getSelectedEquipment();
        if (!equipment) return;
        this.upgradeEquipment(equipment);
    }

    upgradeEquipment(equipment: EquipmentDef) {
        if (this.ctx.cs.phase !== 'hangar') return;
        if (!this.ownedEquipment.has(equipment.id)) {
            this.craftEquipment(equipment);
            return;
        }
        const level = this.getEquipmentLevel(equipment.id);
        if (level >= equipment.maxLevel) {
            this.ctx.showToast(`${equipment.name} 已达到当前上限。`);
            return;
        }
        const cost = this.getUpgradeCost(equipment);
        if (!this.hasResources(cost)) {
            this.ctx.showToast(`资源不足：需要 ${this.formatCost(cost)}`);
            return;
        }
        this.spendResources(cost);
        this.equipmentLevels[equipment.id] = level + 1;
        this.saveProgress();
        this.refreshEquipmentButtons();
        this.ctx.refreshHud();
        this.ctx.showToast(`${equipment.name} 升到 Lv.${level + 1}`);
    }

    craftEquipment(equipment: EquipmentDef) {
        if (this.ownedEquipment.has(equipment.id)) return;
        const cost = this.getCraftCost(equipment);
        if (!this.hasResources(cost)) {
            this.ctx.showToast(`合成资源不足：需要 ${this.formatCost(cost)}`);
            return;
        }
        this.spendResources(cost);
        this.ownedEquipment.add(equipment.id);
        this.equipmentLevels[equipment.id] = 1;
        this.selectedEquipmentId = equipment.id;
        this.saveProgress();
        this.refreshEquipmentButtons();
        this.ctx.refreshHud();
        this.ctx.showToast(`合成新装备：${equipment.name}`);
    }

    // ── Equipment button refresh ─────────────────────────────────────────
    refreshEquipmentButtons() {
        this.normalizeEquippedEquipment();
        this.visibleHangarEquipment = this.getVisibleHangarEquipment();
        this.refreshEquippedButtons();
        this.ctx.panels.equipmentButtons.forEach((button: ButtonView, index: number) => {
            const equipment = this.visibleHangarEquipment[index];
            if (!equipment) {
                button.node.active = false;
                return;
            }
            button.node.active = true;
            const selected = equipment.id === this.selectedEquipmentId;
            const equipped = this.isEquipped(equipment.id);
            const owned = this.ownedEquipment.has(equipment.id);
            const level = this.getEquipmentLevel(equipment.id);
            button.color = selected ? '#0F172A' : equipped ? '#2563EB' : owned ? equipment.color : '#64748B';
            if (!owned) {
                button.label.string = `${equipment.name}\n未获得`;
            } else {
                button.label.string = `${equipment.name} Lv.${level}\n${equipped ? '出战中' : '仓库中'}${selected ? '  选中' : ''}`;
            }
            this.ctx.drawButton(button, false);
        });
        this.refreshHangarActions();
        if (this.ctx.panels.hangarStatsLabel && this.ctx.cs.phase === 'hangar') {
            const gearSummary = GEAR_SLOT_ORDER
                .map((slot) => `${GEAR_SLOT_LABELS[slot]}${this.getEquippedGearForSlot(slot) ? '1' : '0'}/1`)
                .join('  ');
            this.ctx.panels.hangarStatsLabel.string = [
                `已完成出击 ${this.ctx.cs.battlesWon} 次  下一次 ${this.ctx.cs.battlesWon + 1}`,
                `库存：${this.ctx.formatWallet(this.getInventoryWallet())}`,
                `出战：武器 ${this.getEquippedWeapons().length}/${MAX_EQUIPPED_WEAPONS}（战斗中切换）  ${gearSummary}`,
                `仓库：武器 ${this.getOwnedWeaponCount()}/${WEAPON_COUNT}  装备 ${GEAR_COUNT}  道具 ${RUN_ITEM_COUNT}  成长 ${8}  图鉴 ${12}`,
            ].join('\n');
        }
    }

    private refreshEquippedButtons() {
        this.ctx.panels.equippedButtons.forEach((button: ButtonView, index: number) => {
            const equipment = this.getEquipmentForDisplaySlot(index);
            const slotName = this.getEquippedSlotName(index);
            if (!equipment) {
                button.color = '#1E293B';
                button.label.string = `${slotName}\n空`;
                this.ctx.drawButton(button, false);
                return;
            }
            const level = this.getEquipmentLevel(equipment.id);
            button.color = equipment.id === this.selectedEquipmentId ? '#0F172A' : equipment.color;
            button.label.string = `${slotName}\n${equipment.name} Lv.${level}`;
            this.ctx.drawButton(button, false);
        });
    }

    getEquippedSlotName(index: number): string {
        if (index < MAX_EQUIPPED_WEAPONS) return `武器槽 ${index + 1}`;
        const gearSlot = GEAR_SLOT_ORDER[index - MAX_EQUIPPED_WEAPONS];
        return gearSlot ? GEAR_SLOT_LABELS[gearSlot] : `装备槽 ${index - MAX_EQUIPPED_WEAPONS + 1}`;
    }

    getEquipmentForDisplaySlot(index: number): EquipmentDef | null {
        if (index < MAX_EQUIPPED_WEAPONS) {
            return this.getEquippedWeapons()[index] || null;
        }
        const gearSlot = GEAR_SLOT_ORDER[index - MAX_EQUIPPED_WEAPONS];
        return gearSlot ? this.getEquippedGearForSlot(gearSlot) : null;
    }

    private refreshHangarActions() {
        const selected = this.getSelectedEquipment();
        const pageCount = this.getEquipmentPageCount();
        if (this.ctx.panels.prevEquipmentButton) {
            this.ctx.panels.prevEquipmentButton.label.string = '上一页';
            this.ctx.drawButton(this.ctx.panels.prevEquipmentButton, this.equipmentPage <= 0);
        }
        if (this.ctx.panels.nextEquipmentButton) {
            this.ctx.panels.nextEquipmentButton.label.string = '下一页';
            this.ctx.drawButton(this.ctx.panels.nextEquipmentButton, this.equipmentPage >= pageCount - 1);
        }

        if (this.ctx.panels.equipActionButton) {
            if (!selected || !this.ownedEquipment.has(selected.id)) {
                this.ctx.panels.equipActionButton.label.string = selected ? '合成' : '未解锁';
                this.ctx.drawButton(this.ctx.panels.equipActionButton, !selected || !this.hasResources(this.getCraftCost(selected)));
            } else {
                const replacingGear = selected.kind === 'gear'
                    && !!selected.gearSlot
                    && !!this.getEquippedGearForSlot(selected.gearSlot)
                    && !this.isEquipped(selected.id);
                this.ctx.panels.equipActionButton.label.string = this.isEquipped(selected.id) ? '卸下' : replacingGear ? '替换' : '加入出战';
                this.ctx.drawButton(this.ctx.panels.equipActionButton, false);
            }
        }

        if (this.ctx.panels.upgradeActionButton) {
            if (!selected || !this.ownedEquipment.has(selected.id)) {
                this.ctx.panels.upgradeActionButton.label.string = '升级';
                this.ctx.drawButton(this.ctx.panels.upgradeActionButton, true);
            } else {
                const level = this.getEquipmentLevel(selected.id);
                const cost = this.getUpgradeCost(selected);
                const disabled = level >= selected.maxLevel || !this.hasResources(cost);
                this.ctx.panels.upgradeActionButton.label.string = level >= selected.maxLevel
                    ? '已满级'
                    : `升级 ${this.formatCost(cost)}`;
                this.ctx.drawButton(this.ctx.panels.upgradeActionButton, disabled);
            }
        }

        if (this.ctx.panels.startButton) {
            const canStart = this.getEquippedWeapons().length > 0;
            this.ctx.panels.startButton.label.string = `开始第 ${this.ctx.cs.battlesWon + 1} 次出击`;
            this.ctx.drawButton(this.ctx.panels.startButton, !canStart);
        }

        if (this.ctx.panels.equipmentDetailLabel) {
            this.ctx.panels.equipmentDetailLabel.string = selected ? this.formatEquipmentDetail(selected) : '仓库为空';
        }
    }

    switchActiveWeapon() {
        if (this.ctx.cs.phase !== 'combat') return;
        const weapons = this.getEquippedWeapons();
        if (weapons.length <= 1) {
            this.ctx.showToast('只携带 1 把武器，无法切换。');
            return;
        }
        const current = this.getActiveWeapon();
        if (current) {
            const idx = weapons.indexOf(current);
            this.ctx.cs.activeWeaponIndex = (idx + 1) % weapons.length;
        }
    }
}

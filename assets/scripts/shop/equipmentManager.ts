import { Color, Graphics, Label, Layers, Node, Sprite, SpriteFrame, UITransform, sys, Vec2 } from 'cc';
import { PanelManager } from '../ui/panels';
import { CombatState } from '../state/combatState';
import { EQUIPMENT, GEAR_COUNT, STARTER_EQUIPMENT_IDS } from '../catalogs/equipmentCatalog';
import { WEAPON_CATALOG, WEAPON_COUNT, getWeaponStyleName, getWeaponTierForId } from '../catalogs/weaponCatalog';
import { RUN_ITEMS, RUN_ITEM_COUNT, formatRunItemEffect } from '../catalogs/runItemCatalog';
import {
    applyEquipmentLootChoiceSpec,
    createEquipmentLootChoiceSpecs,
    type EquipmentLootChoiceSpec,
} from '../catalogs/equipmentLootChoices';
import {
    formatEquipmentBlueprintProgress,
    getEquipmentBlueprintCount,
    getEquipmentBlueprintRequirement,
    getEquipmentUnlockReason as getProgressionUnlockReason,
    hasEquipmentBlueprints,
    isEquipmentCraftable as isProgressionEquipmentCraftable,
    isEquipmentDiscoverable as isProgressionEquipmentDiscoverable,
    isEquipmentLootEligible as isProgressionEquipmentLootEligible,
    type EquipmentProgressionState,
} from '../catalogs/equipmentProgression';
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
    WeaponStats,
    LootChoice,
} from '../core/types';
import { AdManager } from '../ad/AdManager';

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

const BLUEPRINT_DROP_CHANCE_BASE = 0.16;
const BLUEPRINT_DROP_CHANCE_MAX = 0.26;

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
    getIcon(name: string): SpriteFrame | null;
}

// ── EquipmentManager ───────────────────────────────────────────────────────
export class EquipmentManager {
    equipmentLevels: Record<string, number> = {};
    equipmentBlueprints: Record<string, number> = {};
    ownedEquipment = new Set<string>();
    equippedEquipment: string[] = [];
    selectedEquipmentId = '';
    equipmentPage = 0;
    visibleHangarEquipment: EquipmentDef[] = [];
    shopOffers: (LevelUpgrade | null)[] = [];

    private ctx: ShopHostContext;

    // ── Equipment → icon key mapping ──────────────────────────────────
    private equipIconKey(equipment: EquipmentDef): string {
        if (equipment.id.startsWith('wpn_') || equipment.id.startsWith('weapon_')) {
            // Map weapon id to icon key: weapon_storm_rifle → wpn_assault_rifle
            const id = equipment.id.replace('weapon_', '').replace('wpn_', '');
            const map: Record<string, string> = {
                'storm_rifle': 'wpn_assault_rifle', 'split_barrel': 'wpn_shotgun',
                'rail_cannon': 'wpn_railgun', 'nova_shotgun': 'wpn_shotgun',
                'ion_lance': 'wpn_laser_gun', 'orbital_drone': 'wpn_drone_spirit',
                'pulse_rifle': 'wpn_assault_rifle', 'tesla_coil': 'wpn_tesla',
                'meteor_launcher': 'wpn_meteor', 'chain_lightning': 'wpn_chain_lightning',
                'frost_emitter': 'wpn_ice_gun', 'inferno_cannon': 'wpn_fire_wand',
                'venom_sprayer': 'wpn_poison_sprayer', 'arc_crossbow': 'wpn_crossbow',
            };
            return map[id] || 'wpn_assault_rifle';
        }
        if (equipment.gearSlot) {
            const slotMap: Record<string, string> = {
                'hat': 'slot_helmet', 'armor': 'slot_armor',
                'boots': 'slot_boots', 'accessory': 'slot_accessory',
            };
            return slotMap[equipment.gearSlot] || 'stat_shield';
        }
        const runMap: Record<string, string> = {
            'reactor_core': 'resource_core', 'magnet_coil': 'stat_lightning_def',
            'vampire_chip': 'stat_hp', 'phase_armor': 'stat_defense',
            'kinetic_boots': 'stat_attack_speed', 'tactical_visor': 'stat_crit_chance',
        };
        return runMap[equipment.id] || 'stat_shield';
    }

    // ── Button icon helper ───────────────────────────────────────────
    private setButtonIcon(button: ButtonView, iconKey: string): void {
        const nodeName = `${button.node.name}_Icon`;
        let iconNode = button.node.getChildByName(nodeName);
        const sf = iconKey ? this.ctx.getIcon(iconKey) : null;
        if (!sf) { if (iconNode) iconNode.active = false; return; }
        if (!iconNode) {
            iconNode = new Node(nodeName);
            iconNode.layer = Layers.Enum.UI_2D;
            button.node.addChild(iconNode);
            const it = iconNode.addComponent(UITransform);
            it.setContentSize(24, 24);
            iconNode.addComponent(Sprite).sizeMode = Sprite.SizeMode.CUSTOM;
        }
        const sp = iconNode!.getComponent(Sprite)!;
        sp.spriteFrame = sf;
        iconNode!.setPosition(-button.width / 2 + 20, 0);
        iconNode!.active = true;
    }

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
        this.equipmentBlueprints = {};
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
            if (data.equipmentBlueprints && typeof data.equipmentBlueprints === 'object') {
                this.equipmentBlueprints = data.equipmentBlueprints;
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
                equipmentBlueprints: this.equipmentBlueprints,
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

    private getProgressionState(): EquipmentProgressionState {
        return {
            battlesWon: this.ctx.cs.battlesWon,
            ownedEquipment: this.ownedEquipment,
            equipmentBlueprints: this.equipmentBlueprints,
        };
    }

    getBlueprintCount(id: string): number {
        return getEquipmentBlueprintCount(this.getProgressionState(), id);
    }

    getBlueprintRequirement(equipment: EquipmentDef): number {
        return getEquipmentBlueprintRequirement(equipment);
    }

    hasRequiredBlueprints(equipment: EquipmentDef): boolean {
        return hasEquipmentBlueprints(this.getProgressionState(), equipment);
    }

    formatBlueprintProgress(equipment: EquipmentDef): string {
        return formatEquipmentBlueprintProgress(this.getProgressionState(), equipment);
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

    getEquipmentUnlockReason(equipment: EquipmentDef): string {
        return getProgressionUnlockReason(this.getProgressionState(), equipment);
    }

    isEquipmentDiscoverable(equipment: EquipmentDef): boolean {
        return isProgressionEquipmentDiscoverable(this.getProgressionState(), equipment);
    }

    isEquipmentCraftable(equipment: EquipmentDef): boolean {
        return isProgressionEquipmentCraftable(this.getProgressionState(), equipment);
    }

    isEquipmentLootEligible(equipment: EquipmentDef, rare: boolean): boolean {
        return isProgressionEquipmentLootEligible(this.getProgressionState(), equipment, rare);
    }

    tryDropBossBlueprint(): EquipmentDef | null {
        const dropChance = Math.min(
            BLUEPRINT_DROP_CHANCE_MAX,
            BLUEPRINT_DROP_CHANCE_BASE + Math.max(0, this.ctx.cs.battlesWon) * 0.006,
        );
        if (Math.random() >= dropChance) return null;

        const candidates = WEAPON_CATALOG.filter((weapon) => {
            if (this.ownedEquipment.has(weapon.id)) return false;
            if (!this.isEquipmentDiscoverable(weapon)) return false;
            const required = this.getBlueprintRequirement(weapon);
            if (required <= 0) return false;
            return this.getBlueprintCount(weapon.id) < required;
        });
        if (candidates.length <= 0) return null;

        const weighted: EquipmentDef[] = [];
        for (const weapon of candidates) {
            const tier = getWeaponTierForId(weapon.id);
            const missing = this.getBlueprintRequirement(weapon) - this.getBlueprintCount(weapon.id);
            const weight = Math.max(1, Math.min(6, missing + Math.floor(tier / 3)));
            for (let i = 0; i < weight; i++) weighted.push(weapon);
        }
        const target = this.ctx.shuffle(weighted)[0] || candidates[0];
        this.equipmentBlueprints[target.id] = this.getBlueprintCount(target.id) + 1;
        this.saveProgress();
        this.refreshEquipmentButtons();
        this.ctx.showToast(`Boss 数据芯片解析成功：${target.name} 蓝图 ${this.getBlueprintCount(target.id)}/${this.getBlueprintRequirement(target)}`);
        return target;
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
        return EQUIPMENT.filter((equipment) => this.isEquipmentDiscoverable(equipment)).sort((a, b) => {
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
            // 武器升级成本: 线性递增, 高等级需核心/晶体
            cost.shards = 8 + Math.ceil(level * 3 + equipment.baseCost / 30);
            cost.circuits = 5 + Math.ceil(level * 2 + equipment.baseCost / 50);
        } else {
            const slot = equipment.gearSlot || 'accessory';
            const base = Math.max(1, equipment.baseCost);
            if (slot === 'hat') {
                cost.circuits = 6 + Math.ceil(level * 2.5 + base / 48);
                cost.shards = 4 + Math.ceil(level * 2 + base / 56);
            } else if (slot === 'armor') {
                cost.biomass = 8 + Math.ceil(level * 3 + base / 38);
                cost.cores = Math.max(cost.cores, Math.floor(level / 3));
            } else if (slot === 'boots') {
                cost.biomass = 6 + Math.ceil(level * 2 + base / 50);
                cost.circuits = 4 + Math.ceil(level * 2.2 + base / 58);
            } else {
                cost.shards = 8 + Math.ceil(level * 2.8 + base / 40);
                cost.circuits = 3 + Math.ceil(level * 1.8 + base / 68);
            }
        }
        if (level >= 4) cost.cores = Math.max(cost.cores || 0, Math.ceil((level - 2) / 2));
        if (level >= 7) cost.crystals = Math.max(cost.crystals || 0, Math.ceil((level - 5) / 2));
        return cost;
    }

    getCraftCost(equipment: EquipmentDef): ResourceWallet {
        const cost = this.createEmptyWallet();
        if (equipment.kind === 'weapon') {
            const tier = getWeaponTierForId(equipment.id);
            if (tier <= 3) {
                cost.shards = 18 + Math.ceil(equipment.baseCost / 14) + tier * 5;
                cost.circuits = 6 + Math.ceil(equipment.baseCost / 26) + tier * 2;
            } else {
                cost.shards = Math.ceil(42 + equipment.baseCost / 6 + tier * tier * 4.2);
                cost.circuits = Math.ceil(14 + equipment.baseCost / 14 + tier * tier * 1.8);
                cost.cores = Math.ceil((tier - 3) * 1.35);
                if (tier >= 5) cost.crystals = Math.ceil((tier - 4) * 0.9);
                if (equipment.baseCost >= 160) cost.crystals += 1;
            }
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
        if (equipment.kind !== 'weapon') {
            if (equipment.baseCost >= 60) cost.crystals = 1;
            if (equipment.baseCost >= 160) cost.crystals += 1;
        }
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
            lines.push(`伤害 ${this.formatStat(dmg)}  |  射速 ${this.formatStat(rate)}次/秒  |  穿透 ${this.formatStat(pier)}`);
            lines.push(`弹速倍率 ${this.formatStat(equipment.weaponStats.bulletSpeed * detailLevel)}`);
        } else {
            lines.push(this.formatGearStats(equipment, detailLevel));
        }
        if (!owned) {
            const blueprint = this.formatBlueprintProgress(equipment);
            if (blueprint) lines.push(blueprint);
            const reason = this.getEquipmentUnlockReason(equipment);
            if (reason) lines.push(`解锁条件：${reason}`);
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
        // 11 波后：高 tier 道具权重更高，鼓励玩家花钱买强力道具迎战无尽模式
        if (pool.length > 0 && this.ctx.cs.waveIndex >= 11) {
            const weighted: LevelUpgrade[] = [];
            for (const item of pool) {
                const weight = Math.max(1, item.tier);
                for (let w = 0; w < weight; w++) weighted.push(item);
            }
            return this.ctx.shuffle(weighted)[0];
        }
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
        // 11 波后：逐步解锁更高 tier，最高 10
        if (this.ctx.cs.waveIndex >= 11) {
            const endlessTier = Math.floor((this.ctx.cs.waveIndex - 10) / 3) + 2;
            return this.ctx.clamp(endlessTier + minutes, 2, 10);
        }
        return this.ctx.clamp(2 + Math.floor(this.ctx.cs.endlessCycle / 2) + minutes, 2, 5);
    }

    getShopItemCost(item: LevelUpgrade): number {
        const waveFee = Math.floor(this.ctx.cs.waveIndex / 4) * 5;
        const cycleFee = (this.ctx.cs.endlessCycle - 1) * 10;
        const baseCost = 44 + item.tier * 22 + waveFee + cycleFee;
        // 11 波后：每波价格指数增长 5%
        let endlessMultiplier = 1;
        if (this.ctx.cs.waveIndex >= 11) {
            endlessMultiplier = Math.pow(1.05, this.ctx.cs.waveIndex - 10);
        }
        return Math.max(50, Math.round(baseCost * this.getRunItemShopPriceMultiplier(item) * endlessMultiplier));
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
                    case 'weaponDamagePct':
                        offense += amount * 5.2;
                        break;
                    case 'weaponFireRatePct':
                        offense += amount * 5.5;
                        break;
                    case 'attackPower':
                        offense += amount / 18;
                        break;
                    case 'attackSpeed':
                        offense += amount * 3.5;
                        break;
                    case 'pierce':
                        offense += amount * 0.45;
                        break;
                    case 'pierceDamagePct':
                        offense += amount * 2.2;
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

    chooseShopItemByIndex(index: number): void {
        this.buyShopItem(index);
    }

    refreshShopSlot(index: number) {
        if (this.ctx.cs.phase !== 'shop') return;
        if (!this.spendRunAlloy(SHOP_REFRESH_COST)) {
            AdManager.playRewardedAd((result) => {
                if (!result.success) {
                    this.ctx.showToast('刷新失败，请重试。');
                    return;
                }
                this.shopOffers[index] = this.pickShopOfferForSlot(index);
                this.renderShop();
                this.ctx.showToast('看视频免费刷新！');
            });
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
            this.setButtonIcon(button, item.id.startsWith('fire-') || item.id.startsWith('neural-') ? 'stat_attack_power' : 'stat_shield');
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
        return createEquipmentLootChoiceSpecs({
            ownedEquipment: this.ownedEquipment,
            equipmentLevels: this.equipmentLevels,
            battleIndex: this.ctx.cs.battleIndex,
            getEquipmentLevel: (id: string) => this.getEquipmentLevel(id),
            isEquipmentLootEligible: (equipment, rare) => this.isEquipmentLootEligible(equipment, rare),
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
            ownedEquipment: this.ownedEquipment,
            equipmentLevels: this.equipmentLevels,
            getEquipmentLevel: (id: string) => this.getEquipmentLevel(id),
            addResources: (wallet: ResourceWallet) => {
                this.ctx.cs.shards += wallet.shards;
                this.ctx.cs.biomass += wallet.biomass;
                this.ctx.cs.circuits += wallet.circuits;
                this.ctx.cs.cores += wallet.cores;
                this.ctx.cs.crystals += wallet.crystals;
            },
        }, spec);
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
        const reason = this.getEquipmentUnlockReason(equipment);
        if (reason) {
            this.ctx.showToast(reason);
            return;
        }
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

    // ── Upgrade preview ─────────────────────────────────────────────────
    /** 返回选中装备的升级预览文本（下一级属性变化 + 花费） */
    private getUpgradePreviewText(equipment: EquipmentDef): string {
        const level = this.getEquipmentLevel(equipment.id);
        if (level >= equipment.maxLevel) return '已达到最高等级。';
        if (equipment.kind === 'weapon') {
            const ws = equipment.weaponStats;
            if (!ws) return '';
            // 武器每级固定增长比例（与 projectileManager.ts 对齐）
            const dmgBonus = 0.12 * 100;
            const rateBonus = 0.10 * 100;
            const pieBonus = 0.10 * 100;
            const parts: string[] = [`伤害+${dmgBonus.toFixed(0)}%`, `射速+${rateBonus.toFixed(0)}%`];
            if (ws.pierce > 0) parts.push(`穿透+${pieBonus.toFixed(0)}%`);
            if (ws.drone > 0) parts.push('无人机+8%');
            const cost = this.getUpgradeCost(equipment);
            return `下一级: ${parts.join(' ')}  花费 ${this.formatCost(cost)}`;
        } else {
            // 装备每级固定 +100% 效果（gearStats × level，每升一级 +1）
            const cost = this.getUpgradeCost(equipment);
            return `下一级: 属性效果+100%  花费 ${this.formatCost(cost)}`;
        }
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
            } else if (selected && level < equipment.maxLevel) {
                // 选中且可升级 → 显示升级预览
                const preview = this.getUpgradePreviewText(equipment);
                button.label.string = `${equipment.name} Lv.${level}\n${equipped ? '出战中' : '仓库中'} 选中\n${preview}`;
            } else {
                button.label.string = `${equipment.name} Lv.${level}\n${equipped ? '出战中' : '仓库中'}${selected ? '  选中' : ''}`;
            }
            this.ctx.drawButton(button, false);
            this.setButtonIcon(button, this.equipIconKey(equipment));
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
                this.setButtonIcon(button, index < MAX_EQUIPPED_WEAPONS ? 'wpn_assault_rifle' : 'stat_shield');
                return;
            }
            const level = this.getEquipmentLevel(equipment.id);
            button.color = equipment.id === this.selectedEquipmentId ? '#0F172A' : equipment.color;
            button.label.string = `${slotName}\n${equipment.name} Lv.${level}`;
            this.ctx.drawButton(button, false);
            this.setButtonIcon(button, this.equipIconKey(equipment));
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
                const craftable = !!selected && this.isEquipmentCraftable(selected);
                this.ctx.panels.equipActionButton.label.string = craftable ? '合成' : '未解锁';
                this.ctx.drawButton(this.ctx.panels.equipActionButton, !craftable || !this.hasResources(this.getCraftCost(selected)));
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

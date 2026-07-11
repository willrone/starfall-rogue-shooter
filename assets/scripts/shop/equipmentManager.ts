import { Color, Graphics, Label, Layers, Node, Sprite, SpriteFrame, UITransform, sys, Vec2 } from 'cc';
import { PanelManager } from '../ui/panels';
import { CombatState } from '../state/combatState';
import { EQUIPMENT, GEAR_COUNT, STARTER_EQUIPMENT_IDS } from '../catalogs/equipmentCatalog';
import { WEAPON_CATALOG, WEAPON_COUNT, getWeaponStyleName, getWeaponTierForId, getWeaponFamilyId } from '../catalogs/weaponCatalog';
import { RUN_ITEMS, RUN_ITEM_COUNT, formatRunItemEffect } from '../catalogs/runItemCatalog';
import { OFFHAND_CATALOG, findOffhand } from '../catalogs/offhandCatalog';
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
import { uiMgr } from '../ui/UIManager';
import { ShopPopup } from '../ui/ShopPopup';
import { replaceMainWeaponInLoadout } from './equipmentLoadout';

// ── Constants ──────────────────────────────────────────────────────────────
const SHOP_REFRESH_COST = 22;
const SHOP_ITEM_COUNT = 6;
const CHEST_REFRESH_COST = 34;
const SAVE_KEY = 'starfall-rogue-shooter-progress-v1';
const HANGAR_EQUIPMENT_SLOTS = 9;
const EQUIPPED_SLOT_COUNT = 5;
const MAX_EQUIPPED_WEAPONS = 1;
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
    pickupMgr: { acquiredRunItemIds: Set<string>; applyRunItem(id: string): void; pendingNewItem: LevelUpgrade | null };

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
    hangarTab: 'weapon' | 'gear' | 'all' = 'weapon';
    visibleHangarEquipment: EquipmentDef[] = [];
    shopOffers: (LevelUpgrade | null)[] = [];

    // ── 副武器 ─────────────────────────────────────────────────
    equippedOffhandId: string | null = null;
    offhandLevels: Record<string, number> = {};

    private ctx: ShopHostContext;

    // ── Equipment → icon key mapping ──────────────────────────────────
    private equipIconKey(equipment: EquipmentDef): string {
        // Weapon: extract family id → wpn_family_id icon
        const familyId = getWeaponFamilyId(equipment.id);
        if (familyId) return `wpn_${familyId.replace(/-/g, '_')}`;
        // Gear slot icon
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
            this.ctx.cs.alloy = Math.max(0, Number(data.alloy) || 0);
            this.ctx.cs.cores = Math.max(0, Number(data.cores) || 0);
            this.ctx.cs.shards = Math.max(0, Number(data.shards) || this.ctx.cs.shards);
            this.ctx.cs.biomass = Math.max(0, Number(data.biomass) || this.ctx.cs.biomass);
            this.ctx.cs.circuits = Math.max(0, Number(data.circuits) || this.ctx.cs.circuits);
            this.ctx.cs.crystals = Math.max(0, Number(data.crystals) || 0);
            this.ctx.cs.voidFragment = Math.max(0, Number(data.voidFragment) || 0);
            this.ctx.cs.energyCore = Math.max(0, Number(data.energyCore) || 0);
            this.ctx.cs.frostCore = Math.max(0, Number(data.frostCore) || 0);
            this.ctx.cs.infernoCore = Math.max(0, Number(data.infernoCore) || 0);
            this.ctx.cs.webSilk = Math.max(0, Number(data.webSilk) || 0);
            if (Array.isArray(data.ownedEquipment)) {
                this.ownedEquipment = new Set(data.ownedEquipment);
            }
            if (data.equipmentLevels && typeof data.equipmentLevels === 'object') {
                this.equipmentLevels = data.equipmentLevels;
            }
            if (data.equipmentBlueprints && typeof data.equipmentBlueprints === 'object') {
                this.equipmentBlueprints = data.equipmentBlueprints;
            }
            if (data.offhandLevels && typeof data.offhandLevels === 'object') {
                this.offhandLevels = data.offhandLevels;
            }
            if (typeof data.equippedOffhandId === 'string' || data.equippedOffhandId === null) {
                this.equippedOffhandId = data.equippedOffhandId;
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
                alloy: this.ctx.cs.alloy,
                cores: this.ctx.cs.cores,
                shards: this.ctx.cs.shards,
                biomass: this.ctx.cs.biomass,
                circuits: this.ctx.cs.circuits,
                crystals: this.ctx.cs.crystals,
                voidFragment: this.ctx.cs.voidFragment,
                energyCore: this.ctx.cs.energyCore,
                frostCore: this.ctx.cs.frostCore,
                infernoCore: this.ctx.cs.infernoCore,
                webSilk: this.ctx.cs.webSilk,
                ownedEquipment: [...this.ownedEquipment],
                equippedEquipment: this.equippedEquipment,
                equipmentLevels: this.equipmentLevels,
                equipmentBlueprints: this.equipmentBlueprints,
                equippedOffhandId: this.equippedOffhandId,
                offhandLevels: this.offhandLevels,
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

    // ── 副武器 ─────────────────────────────────────────────────
    getEquippedOffhandId(): string | null {
        return this.equippedOffhandId;
    }

    getOffhandLevel(id: string): number {
        return this.offhandLevels[id] || 1;
    }

    hasOffhand(id: string): boolean {
        return !!this.offhandLevels[id];
    }

    /** 装备/切换副武器 */
    equipOffhand(id: string | null): void {
        this.equippedOffhandId = id;
        this.saveProgress();
    }

    /** 检查是否可合成某副武器 */
    canSynthesizeOffhand(id: string): { ok: boolean; reason?: string } {
        const def = findOffhand(id);
        if (!def) return { ok: false, reason: '未知副武器' };
        if (this.offhandLevels[id]) return { ok: false, reason: '已拥有' };
        // 材料检查由上级 UI 层读取钱包完成
        return { ok: true };
    }

    /** 合成副武器（T1） */
    synthesizeOffhand(id: string): boolean {
        const def = findOffhand(id);
        if (!def || this.offhandLevels[id]) return false;
        if (this.ctx.cs.alloy < def.recipeAlloy) return false;
        this.ctx.cs.alloy -= def.recipeAlloy;
        this.offhandLevels[id] = 1;
        this.saveProgress();
        return true;
    }

    /** 副武器升级花费 */
    getOffhandUpgradeCost(id: string, targetLevel: number): { alloy: number; material: string; materialQty: number } | null {
        const def = findOffhand(id);
        if (!def) return null;
        const current = this.offhandLevels[id] || 0;
        if (targetLevel <= current || targetLevel > 5) return null;
        const tier = targetLevel - 1; // T2→T5 = index 1-4
        const qty = [3, 5, 8, 12][tier - 1] || 3;
        const alloy = [100, 180, 280, 400][tier - 1] || 100;
        return { alloy, material: '通用金粉', materialQty: qty };
    }

    /** 升级副武器 */
    upgradeOffhand(id: string): boolean {
        const current = this.offhandLevels[id] || 0;
        if (current >= 5) return false;
        const cost = this.getOffhandUpgradeCost(id, current + 1);
        if (!cost) return false;
        if (this.ctx.cs.alloy < cost.alloy) return false;
        this.ctx.cs.alloy -= cost.alloy;
        this.offhandLevels[id] = current + 1;
        this.saveProgress();
        return true;
    }

    // ── 传说武器合成 ─────────────────────────────────────────────
    /** 传说武器配方 */
    static readonly LEGENDARY_RECIPES: Record<string, { name: string; material: string; materialQty: number; alloy: number; desc: string }> = {
        'void-tearer': { name: '虚空撕裂者', material: 'voidFragment', materialQty: 3, alloy: 200, desc: '高速穿透型，每穿透一层减目标防御。' },
        'icefire-judge': { name: '冰狱审判', material: 'frostCore', materialQty: 2, alloy: 200, desc: '冰火交替爆发，冰冻减速+火焰爆炸。' },
        'webmaster': { name: '织网支配者', material: 'webSilk', materialQty: 2, alloy: 200, desc: '召唤续航型，子弹缓速+击杀回血。' },
    };

    /** 获取传说武器合成配方 */
    getLegendaryRecipes(): { id: string; name: string; material: string; materialQty: number; alloy: number; desc: string; owned: boolean }[] {
        const recipes: { id: string; name: string; material: string; materialQty: number; alloy: number; desc: string; owned: boolean }[] = [];
        const keys = Object.keys(EquipmentManager.LEGENDARY_RECIPES);
        for (const id of keys) {
            const recipe = EquipmentManager.LEGENDARY_RECIPES[id];
            recipes.push({ id, ...recipe, owned: this.ownedEquipment.has(id) });
        }
        return recipes;
    }

    /** 合成传说武器 */
    synthesizeLegendary(id: string): boolean {
        const recipe = EquipmentManager.LEGENDARY_RECIPES[id];
        if (!recipe) return false;
        if (this.ownedEquipment.has(id)) return false;
        // 检查材料
        const wallet = this.ctx.cs as unknown as Record<string, number>;
        const materialKey = recipe.material;
        if ((wallet[materialKey] || 0) < recipe.materialQty) return false;
        if (this.ctx.cs.alloy < recipe.alloy) return false;
        // 消耗材料
        wallet[materialKey] -= recipe.materialQty;
        this.ctx.cs.alloy -= recipe.alloy;
        // 获得武器
        this.ownedEquipment.add(id);
        this.equipmentLevels[id] = 1;
        // 如果还没装备武器，自动装备
        if (this.equippedEquipment.length === 0 || this.equippedEquipment.every(e => e.startsWith('tactical') || e.startsWith('phase') || e.startsWith('kinetic') || e.startsWith('magnet'))) {
            this.equippedEquipment.unshift(id);
        }
        this.saveProgress();
        return true;
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
        return EQUIPMENT
            .filter((equipment) => this.isEquipmentDiscoverable(equipment))
            .filter((equipment) => {
                if (this.hangarTab === 'weapon') return equipment.kind === 'weapon';
                if (this.hangarTab === 'gear') return equipment.kind === 'gear';
                return true;
            })
            .sort((a, b) => {
            const aScore = this.getWarehouseSortScore(a);
            const bScore = this.getWarehouseSortScore(b);
            if (aScore !== bScore) return aScore - bScore;
            return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
        });
    }

    changeHangarTab(tab: 'weapon' | 'gear' | 'all'): void {
        this.hangarTab = tab;
        this.equipmentPage = 0;
        this.refreshEquipmentButtons();
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
            alloy: this.ctx.cs.alloy,
            cores: this.ctx.cs.cores,
            shards: this.ctx.cs.shards,
            biomass: this.ctx.cs.biomass,
            circuits: this.ctx.cs.circuits,
            crystals: this.ctx.cs.crystals,
            voidFragment: this.ctx.cs.voidFragment,
            energyCore: this.ctx.cs.energyCore,
            frostCore: this.ctx.cs.frostCore,
            infernoCore: this.ctx.cs.infernoCore,
            webSilk: this.ctx.cs.webSilk,
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
        this.ctx.cs.alloy = next.alloy;
        this.ctx.cs.cores = next.cores;
        this.ctx.cs.shards = next.shards;
        this.ctx.cs.biomass = next.biomass;
        this.ctx.cs.circuits = next.circuits;
        this.ctx.cs.crystals = next.crystals;
        this.ctx.cs.voidFragment = next.voidFragment;
        this.ctx.cs.energyCore = next.energyCore;
        this.ctx.cs.frostCore = next.frostCore;
        this.ctx.cs.infernoCore = next.infernoCore;
        this.ctx.cs.webSilk = next.webSilk;
    }

    addWalletToInventory(wallet: ResourceWallet) {
        this.ctx.cs.alloy += wallet.alloy;
        this.ctx.cs.cores += wallet.cores;
        this.ctx.cs.shards += wallet.shards;
        this.ctx.cs.biomass += wallet.biomass;
        this.ctx.cs.circuits += wallet.circuits;
        this.ctx.cs.crystals += wallet.crystals;
        this.ctx.cs.voidFragment += wallet.voidFragment;
        this.ctx.cs.energyCore += wallet.energyCore;
        this.ctx.cs.frostCore += wallet.frostCore;
        this.ctx.cs.infernoCore += wallet.infernoCore;
        this.ctx.cs.webSilk += wallet.webSilk;
    }

    formatCost(cost: ResourceWallet): string {
        return this.ctx.formatWallet(cost);
    }

    // ── Upgrade / craft costs ───────────────────────────────────────────
    getUpgradeCost(equipment: EquipmentDef): ResourceWallet {
        const level = this.getEquipmentLevel(equipment.id);
        const cost = this.createEmptyWallet();
        if (equipment.kind === 'weapon') {
            // 武器升级成本: 指数递增, 高等级需核心/晶体 (2026-06-29 翻倍)
            cost.shards = 12 + Math.ceil(level * 8 + equipment.baseCost / 12);
            cost.circuits = 8 + Math.ceil(level * 5 + equipment.baseCost / 24);
        } else {
            const slot = equipment.gearSlot || 'accessory';
            const base = Math.max(1, equipment.baseCost);
            if (slot === 'hat') {
                cost.circuits = 10 + Math.ceil(level * 6 + base / 24);
                cost.shards = 6 + Math.ceil(level * 5 + base / 30);
            } else if (slot === 'armor') {
                cost.biomass = 14 + Math.ceil(level * 7 + base / 18);
                cost.cores = Math.max(cost.cores, Math.floor(level / 3));
            } else if (slot === 'boots') {
                cost.biomass = 10 + Math.ceil(level * 5 + base / 24);
                cost.circuits = 6 + Math.ceil(level * 5 + base / 28);
            } else {
                cost.shards = 14 + Math.ceil(level * 6 + base / 18);
                cost.circuits = 5 + Math.ceil(level * 4 + base / 32);
            }
        }
        if (level >= 2) cost.cores = Math.max(cost.cores || 0, level - 1);
        if (level >= 5) cost.crystals = Math.max(cost.crystals || 0, level - 3);
        // Lv.9+ 升级额外消耗 Boss 材料（5种任意其一）
        const nextLevel = level + 1;
        if (nextLevel >= 9) {
            const matCount = nextLevel >= 13 ? 3 : nextLevel >= 11 ? 2 : 1;
            const matKeys = ['voidFragment', 'energyCore', 'frostCore', 'infernoCore', 'webSilk'] as const;
            const cs = this.ctx.cs as unknown as Record<string, number>;
            for (const k of matKeys) {
                if (cs[k] >= matCount) { (cost as Record<string, number>)[k] = matCount; break; }
            }
        }
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
        // Legendary 传说武器：需要 Boss 材料
        if (equipment.kind === 'weapon') {
            const LEGENDARY_BOSS_MATERIALS: Record<string, Record<string, number>> = {
                'void-tearer': { voidFragment: 3, energyCore: 2 },
                'icefire-judge': { frostCore: 3, infernoCore: 2 },
                'webmaster': { webSilk: 3, energyCore: 2 },
            };
            const mat = LEGENDARY_BOSS_MATERIALS[equipment.id];
            if (mat) {
                if (mat.voidFragment) (cost as Record<string, number>).voidFragment = mat.voidFragment;
                if (mat.energyCore) (cost as Record<string, number>).energyCore = mat.energyCore;
                if (mat.frostCore) (cost as Record<string, number>).frostCore = mat.frostCore;
                if (mat.infernoCore) (cost as Record<string, number>).infernoCore = mat.infernoCore;
                if (mat.webSilk) (cost as Record<string, number>).webSilk = mat.webSilk;
            }
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
        const equippedState = equipment.kind === 'weapon'
            ? equipped ? ' · 已装备' : ''
            : equipped ? ' · 被动生效' : '';
        const state = `${owned ? `Lv.${level}/${equipment.maxLevel}` : '未获得'}${equippedState}`;
        const slotName = equipment.kind === 'weapon' ? '武器' : equipment.gearSlot ? GEAR_SLOT_LABELS[equipment.gearSlot] : '装备';
        const rarity = equipment.rarity || '普通';
        const lines = [`${equipment.name} · ${rarity} ${slotName} · ${state}`, equipment.desc];
        if (equipment.weaponStats) {
            const dmg = equipment.weaponStats.damage * (1 + (detailLevel - 1) * 0.12);
            const fireRate = equipment.weaponStats.fireRate * (1 + (detailLevel - 1) * 0.10);
            const rps = Math.min(Math.max(0.15, fireRate), 14.28);
            const pier = equipment.weaponStats.pierce * (1 + (detailLevel - 1) * 0.10);
            const bulletSpeed = equipment.weaponStats.bulletSpeed * (1 + (detailLevel - 1) * 0.08);
            lines.push(`伤害 ${this.formatStat(dmg)} · 射速 ${this.formatStat(rps)}/秒 · 穿透 ${this.formatStat(pier)} · 弹速 ${this.formatStat(bulletSpeed)}`);
        } else {
            lines.push(this.formatGearStats(equipment, detailLevel));
        }

        let actionText = '';
        if (!owned) {
            const blueprint = this.formatBlueprintProgress(equipment);
            const reason = this.getEquipmentUnlockReason(equipment);
            actionText = `${blueprint ? `${blueprint} · ` : ''}${reason ? `${reason} · ` : ''}合成 ${this.formatCost(this.getCraftCost(equipment))}`;
        } else if (level < equipment.maxLevel) {
            actionText = `升级 ${this.formatCost(this.getUpgradeCost(equipment))}`;
        } else {
            actionText = '已达到最高等级';
        }
        const styleText = equipment.attackStyle ? `${getWeaponStyleName(equipment.attackStyle)} · ` : '';
        lines.push(`${styleText}${actionText}`);
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
        // 累计涨价：每买一件本局道具（含宝箱和商店），下一件贵 35%
        const itemsBought = this.ctx.pickupMgr.acquiredRunItemIds.size;
        const cumulativeMultiplier = 1 + itemsBought * 0.35;
        return Math.max(50, Math.round(baseCost * this.getRunItemShopPriceMultiplier(item) * endlessMultiplier * cumulativeMultiplier));
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
    async openShop() {
        if (this.ctx.cs.phase !== 'combat') return;
        this.ctx.cs.phase = 'shop';
        this.ctx.touchActive = false;
        this.ctx.touchVector.set(0, 0);
        this.ctx.updateJoystickView();
        this.ensureShopOffers();

        // Bot mode: skip popup, auto-buy first affordable item
        if ((this.ctx as any).__cdpBotMode) {
            for (let i = 0; i < this.shopOffers.length; i++) {
                const offer = this.shopOffers[i];
                if (!offer) continue;
                const cost = this.getShopItemCost(offer);
                if (this.ctx.cs.battleAlloy >= cost) {
                    this.buyShopItem(i);
                    this.ctx.showToast(`[Bot] 购买道具：${offer.name}`);
                    break;
                }
            }
            this.ctx.cs.phase = 'combat';
            return;
        }

        const popupResult = await uiMgr.showDynamicPopupAsync(() => {
            const node = new Node('ShopPopup');
            const scpt = node.addComponent(ShopPopup);
            scpt.setup(this._buildShopOptions());
            return node;
        }, 'ShopPopup');

        // After popup: return to combat
        if (this.ctx.cs.phase === 'shop') {
            this.ctx.cs.phase = 'combat';
            this.ctx.showToast('商店离开，战斗继续。');
        }
    }

    private _buildShopOptions() {
        return {
            combatTime: this.ctx.cs.combatTime,
            spendableAlloy: this.getSpendableAlloy(),
            slots: this.shopOffers.map((item: LevelUpgrade | null) => ({
                item,
                cost: item ? this.getShopItemCost(item) : 0,
                canAfford: item ? this.getSpendableAlloy() >= this.getShopItemCost(item) : false,
            })),
            getState: () => ({
                spendableAlloy: this.getSpendableAlloy(),
                slots: this.shopOffers.map((item: LevelUpgrade | null) => ({
                    item,
                    cost: item ? this.getShopItemCost(item) : 0,
                    canAfford: item ? this.getSpendableAlloy() >= this.getShopItemCost(item) : false,
                })),
            }),
            onBuy: async (index: number) => {
                if (this.ctx.cs.phase !== 'shop') return { success: false, message: '商店已关闭' };
                const item = this.shopOffers[index];
                if (!item) return { success: false, message: '该格已空' };
                const cost = this.getShopItemCost(item);
                if (!this.spendRunAlloy(cost)) {
                    return { success: false, message: `合金不足，需要 ${cost}。` };
                }
                this.ctx.pickupMgr.applyRunItem(item.id);
                if (this.ctx.pickupMgr.pendingNewItem) {
                    // Discard mode — reopen shop later via popup
                    return { success: true, message: `购买${item.name}，但道具栏已满，请选择丢弃。` };
                }
                this.shopOffers[index] = this.pickShopOfferForSlot(index);
                return { success: true, message: `购买${item.name}，该格已补货。` };
            },
            onRefresh: async (index: number) => {
                if (this.ctx.cs.phase !== 'shop') return { success: false, message: '商店已关闭' };
                if (!this.spendRunAlloy(SHOP_REFRESH_COST)) {
                    return { success: false, message: `合金不足，刷新需要 ${SHOP_REFRESH_COST}。` };
                }
                this.shopOffers[index] = this.pickShopOfferForSlot(index);
                return { success: true, message: '该格商品已刷新。' };
            },
            onClose: () => {
                // popup handles close
            },
        };
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
        // If slots are full, this will enter discard mode
        this.ctx.pickupMgr.applyRunItem(item.id);
        if (this.ctx.pickupMgr.pendingNewItem) {
            // Discard pending — close shop, discard panel shows instead
            this.ctx.panels.setShopPanelActive(false);
            return;
        }
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
            let equipMessage = `${equipment.name} 已加入出战。`;
            let replacedMainWeapon = false;
            if (equipment.kind === 'weapon') {
                const equippedWeapons = this.getEquippedWeapons();
                if (equippedWeapons.length >= MAX_EQUIPPED_WEAPONS) {
                    this.equippedEquipment = replaceMainWeaponInLoadout(
                        this.equippedEquipment,
                        equippedWeapons.map((weapon) => weapon.id),
                        equipment.id,
                    );
                    replacedMainWeapon = true;
                    equipMessage = `${equippedWeapons[0]?.name || '当前武器'} 已替换为 ${equipment.name}。`;
                } else if (this.equippedEquipment.length >= EQUIPPED_SLOT_COUNT) {
                    this.ctx.showToast(`出战槽已满，最多携带 ${EQUIPPED_SLOT_COUNT} 件装备。`);
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
            if (!replacedMainWeapon) this.equippedEquipment.push(equipment.id);
            this.ctx.showToast(equipMessage);
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
    private refreshHangarTabButtons(): void {
        const labels = [
            { text: '武器', tab: 'weapon' },
            { text: '副武器', tab: 'offhand' },
            { text: '装备', tab: 'gear' },
            { text: '熔炉', tab: 'forge' },
            { text: '全部', tab: 'all' },
        ];
        this.ctx.panels.hangarTabButtons.forEach((button: ButtonView, index: number) => {
            const item = labels[index];
            if (!item) { button.node.active = false; return; }
            button.node.active = this.ctx.cs.phase === 'hangar';
            const active = item.tab === this.hangarTab;
            // Tab: dark base when inactive, bright cyan when active
            button.color = active ? '#22D3EE' : '#1E293B';
            button.label.string = item.text;
            this.ctx.drawButton(button, false);
            // Active tab gets brighter label
            button.label.color = this.ctx.hex(active ? '#FFFFFF' : '#64748B');
        });
    }

    private refreshLoadoutCards(): void {
        const weapons = this.getEquippedWeapons();
        this.ctx.panels.loadoutWeaponButtons.forEach((button: ButtonView, index: number) => {
            const weapon = weapons[index];
            const slotName = '主武器';
            button.node.active = this.ctx.cs.phase === 'hangar';
            if (!weapon) {
                button.color = '#1E293B';
                button.label.string = `${slotName}\n未装备\n从武器库选择`;
                this.ctx.drawButton(button, false);
                this.setButtonIcon(button, 'wpn_storm_rifle');
                return;
            }
            button.color = weapon.color;
            button.label.string = `${slotName}\n${weapon.name}\nLv.${this.getEquipmentLevel(weapon.id)}`;
            this.ctx.drawButton(button, false);
            this.setButtonIcon(button, this.equipIconKey(weapon));
        });

        if (this.ctx.panels.offhandLoadoutButton) {
            const button = this.ctx.panels.offhandLoadoutButton;
            const def = this.equippedOffhandId ? findOffhand(this.equippedOffhandId) : undefined;
            button.node.active = this.ctx.cs.phase === 'hangar';
            if (!def) {
                button.color = '#1E293B';
                button.label.string = '副武器\n未装备\n点击选择';
                this.ctx.drawButton(button, false);
                this.setButtonIcon(button, 'stat_shield');
            } else {
                const level = this.getOffhandLevel(def.id);
                button.color = def.color;
                button.label.string = `副武器\n${def.name}\nT${level} · ${this.getOffhandCategoryName(def.category)}`;
                this.ctx.drawButton(button, false);
                this.setButtonIcon(button, def.iconKey);
            }
        }

        const gearSlots = GEAR_SLOT_ORDER;
        this.ctx.panels.gearLoadoutButtons.forEach((button: ButtonView, index: number) => {
            const slot = gearSlots[index];
            const gear = slot ? this.getEquippedGearForSlot(slot) : null;
            button.node.active = this.ctx.cs.phase === 'hangar';
            if (!gear) {
                button.color = '#1E293B';
                button.label.string = `${slot ? GEAR_SLOT_LABELS[slot] : '装备'}\n空`;
                this.ctx.drawButton(button, false);
                this.setButtonIcon(button, 'stat_shield');
                return;
            }
            button.color = gear.color;
            button.label.string = `${GEAR_SLOT_LABELS[slot]}\n${gear.name}\nLv.${this.getEquipmentLevel(gear.id)}`;
            this.ctx.drawButton(button, false);
            this.setButtonIcon(button, this.equipIconKey(gear));
        });
    }

    private getOffhandCategoryName(category: string): string {
        switch (category) {
            case 'orbit': return '环绕';
            case 'summon': return '召唤';
            case 'control': return '控场';
            case 'burst': return '爆发';
            case 'support': return '防御';
            default: return '协同';
        }
    }

    refreshEquipmentButtons() {
        this.normalizeEquippedEquipment();
        this.visibleHangarEquipment = this.getVisibleHangarEquipment();
        this.refreshLoadoutCards();
        this.refreshHangarTabButtons();
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
            this.ctx.panels.hangarStatsLabel.string = [
                `完成出击 ${this.ctx.cs.battlesWon} 次  ·  主武器 ${this.getEquippedWeapons().length}/1  ·  副武器 ${this.equippedOffhandId ? '已装备' : '未装备'}`,
                `库存：${this.ctx.formatWallet(this.getInventoryWallet())}`,
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
                this.setButtonIcon(button, index < MAX_EQUIPPED_WEAPONS ? 'wpn_storm_rifle' : 'stat_shield');
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
                const equipped = this.isEquipped(selected.id);
                const lockedMainWeapon = selected.kind === 'weapon'
                    && equipped
                    && this.getEquippedWeapons().length <= 1;
                const replacingWeapon = selected.kind === 'weapon'
                    && !equipped
                    && this.getEquippedWeapons().length >= MAX_EQUIPPED_WEAPONS;
                const replacingGear = selected.kind === 'gear'
                    && !!selected.gearSlot
                    && !!this.getEquippedGearForSlot(selected.gearSlot)
                    && !equipped;
                this.ctx.panels.equipActionButton.label.string = lockedMainWeapon
                    ? '出战中'
                    : equipped
                        ? '卸下'
                        : replacingWeapon || replacingGear
                            ? '替换'
                            : '加入出战';
                this.ctx.drawButton(this.ctx.panels.equipActionButton, lockedMainWeapon);
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
        if (this.ctx.cs.phase === 'combat') {
            this.ctx.showToast('主武器与副武器同时生效，无需切换。');
        }
    }
}

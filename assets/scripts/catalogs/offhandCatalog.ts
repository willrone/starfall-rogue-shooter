/**
 * 副武器 Catalog — 15 把副武器数据
 * 设计基线：docs/offhand_weapon_design.md
 *
 * 每把副武器：基础数值 + T1→T5 每级升级提升
 * 升级公式：实际值 = baseStats + sum(levelUpgrades[0]..[level-2])
 */
import type { OffhandDef, OffhandTierUpgrade } from '../core/types';

// ── 升级档位 helper ──────────────────────────────────────────────
function T(partial: Partial<typeof defaultStats>): OffhandTierUpgrade {
    return { stats: partial as any };
}

const defaultStats = {
    damage: 0, damagePct: 0, cooldown: 0, duration: 0, radius: 0,
    count: 0, speed: 0, pierce: 0, slowFactor: 0, slowDuration: 0,
    shieldAmount: 0, healPct: 0, triggerHpPct: 0,
    attackSpeedMultiplier: 0, burstDuration: 0,
};

// ══════════════════════════════════════════════════════════════════
// 🔵 环绕型（3把）
// ══════════════════════════════════════════════════════════════════

export const OFFHAND_CATALOG: OffhandDef[] = [
    // ── 1 回旋利刃 ──────────────────────────────────────────────
    {
        id: 'orbit-blade', name: '回旋利刃', category: 'orbit',
        mechanic: 'orbit_blade', color: '#F97316', iconKey: 'wpn_assault_rifle',
        baseStats: { damage: 12, damagePct: 0, cooldown: 0, duration: 0, radius: 180, count: 3, speed: 1.0, pierce: 1, slowFactor: 0, slowDuration: 0, shieldAmount: 0, healPct: 0, triggerHpPct: 0, attackSpeedMultiplier: 0, burstDuration: 0 },
        levelUpgrades: [
            T({ count: 4, speed: 1.2, damage: 16 }),
            T({ count: 5, speed: 1.4, radius: 200 }),
            T({ count: 5, speed: 1.6, damage: 20, pierce: 2 }),
            T({ count: 6, speed: 1.8, damage: 25, radius: 220 }),
        ],
        desc: '刀刃绕玩家旋转，碰触敌人造成伤害。',
        recipeMaterial: 'purifyCrystal', recipeAlloy: 50,
    },
    // ── 2 守护星环 ──────────────────────────────────────────────
    {
        id: 'orbit-block', name: '守护星环', category: 'orbit',
        mechanic: 'orbit_block', color: '#4CC9F0', iconKey: 'stat_defense',
        baseStats: { damage: 0, damagePct: 0, cooldown: 0.33, duration: 0, radius: 160, count: 6, speed: 0, pierce: 0, slowFactor: 0, slowDuration: 0, shieldAmount: 1, healPct: 0, triggerHpPct: 0, attackSpeedMultiplier: 0, burstDuration: 0 },
        levelUpgrades: [
            T({ cooldown: 0.28, count: 7 }),
            T({ cooldown: 0.22, count: 8 }),
            T({ cooldown: 0.16, count: 9, radius: 200 }),
            T({ cooldown: 0.12, count: 10, radius: 220 }),
        ],
        desc: '星点围绕玩家飞行，自动格挡敌方弹幕。',
        recipeMaterial: 'purifyCrystal', recipeAlloy: 55,
    },
    // ── 3 烈焰漩涡 ──────────────────────────────────────────────
    {
        id: 'orbit-burn', name: '烈焰漩涡', category: 'orbit',
        mechanic: 'orbit_burn', color: '#EF4444', iconKey: 'stat_shield',
        baseStats: { damage: 8, damagePct: 0, cooldown: 0.5, duration: 2.0, radius: 150, count: 0, speed: 0, pierce: 0, slowFactor: 0, slowDuration: 0, shieldAmount: 0, healPct: 0, triggerHpPct: 0, attackSpeedMultiplier: 0, burstDuration: 0 },
        levelUpgrades: [
            T({ damage: 12, duration: 2.5, radius: 170 }),
            T({ damage: 16, duration: 3.0 }),
            T({ damage: 20, duration: 3.5, radius: 200 }),
            T({ damage: 25, duration: 4.0, radius: 250 }),
        ],
        desc: '玩家移动路径留下灼烧痕迹，持续伤害敌人。',
        recipeMaterial: 'purifyCrystal', recipeAlloy: 60,
    },

    // ══════════════════════════════════════════════════════════════
    // 🟢 召唤型（4把）
    // ══════════════════════════════════════════════════════════════

    // ── 4 影刃猎手 ──────────────────────────────────────────────
    {
        id: 'summon-blade', name: '影刃猎手', category: 'summon',
        mechanic: 'summon_blade', color: '#B5179E', iconKey: 'wpn_railgun',
        baseStats: { damage: 18, damagePct: 0, cooldown: 2.0, duration: 0, radius: 400, count: 3, speed: 400, pierce: 0, slowFactor: 0, slowDuration: 0, shieldAmount: 0, healPct: 0, triggerHpPct: 0, attackSpeedMultiplier: 0, burstDuration: 0 },
        levelUpgrades: [
            T({ cooldown: 1.6, count: 4, damage: 22 }),
            T({ cooldown: 1.3, count: 4, damage: 26 }),
            T({ cooldown: 1.0, count: 5, damage: 30 }),
            T({ cooldown: 0.8, count: 5, damage: 35, speed: 500 }),
        ],
        desc: '自动追踪最近的敌人，飞刀命中后自毁。',
        recipeMaterial: 'voidShard', recipeAlloy: 65,
    },
    // ── 5 静电蜂群 ──────────────────────────────────────────────
    {
        id: 'summon-bee', name: '静电蜂群', category: 'summon',
        mechanic: 'summon_bee', color: '#FACC15', iconKey: 'wpn_chain_lightning',
        baseStats: { damage: 8, damagePct: 0, cooldown: 1.0, duration: 0, radius: 300, count: 4, speed: 200, pierce: 2, slowFactor: 0, slowDuration: 0, shieldAmount: 0, healPct: 0, triggerHpPct: 0, attackSpeedMultiplier: 0, burstDuration: 0 },
        levelUpgrades: [
            T({ damage: 11, count: 5, pierce: 3 }),
            T({ damage: 14, count: 6 }),
            T({ damage: 17, count: 7, pierce: 4, speed: 250 }),
            T({ damage: 20, count: 8, pierce: 4, cooldown: 0.5 }),
        ],
        desc: '蜜蜂自动移动电击敌人，伤害弹射到下一个目标。',
        recipeMaterial: 'voidShard', recipeAlloy: 65,
    },
    // ── 6 幽影分身 ──────────────────────────────────────────────
    {
        id: 'summon-clone', name: '幽影分身', category: 'summon',
        mechanic: 'summon_clone', color: '#8B5CF6', iconKey: 'stat_attack_power',
        baseStats: { damage: 0, damagePct: 0.50, cooldown: 0, duration: 10.0, radius: 0, count: 1, speed: 0, pierce: 0, slowFactor: 0, slowDuration: 0, shieldAmount: 0, healPct: 0, triggerHpPct: 0, attackSpeedMultiplier: 0, burstDuration: 0 },
        levelUpgrades: [
            T({ damagePct: 0.55, duration: 14.0 }),
            T({ damagePct: 0.60, duration: 18.0 }),
            T({ damagePct: 0.70, count: 2, duration: 22.0 }),
            T({ damagePct: 0.75, count: 2, duration: 30.0 }),
        ],
        desc: '生成镜像分身，复制主武器伤害。',
        recipeMaterial: 'voidShard', recipeAlloy: 70,
    },
    // ── 7 治愈蜂鸟 ──────────────────────────────────────────────
    {
        id: 'summon-bird', name: '治愈蜂鸟', category: 'summon',
        mechanic: 'summon_bird', color: '#43AA8B', iconKey: 'stat_hp',
        baseStats: { damage: 0, damagePct: 0, cooldown: 3.0, duration: 0, radius: 150, count: 0, speed: 0, pierce: 0, slowFactor: 0, slowDuration: 0, shieldAmount: 0, healPct: 3.0, triggerHpPct: 0, attackSpeedMultiplier: 0, burstDuration: 0 },
        levelUpgrades: [
            T({ healPct: 4.0, radius: 180 }),
            T({ healPct: 5.0, cooldown: 2.0 }),
            T({ healPct: 6.5, radius: 220, cooldown: 1.5 }),
            T({ healPct: 8.0, radius: 260, cooldown: 1.0 }),
        ],
        desc: '定期恢复生命值，并对附近受伤敌人释放微伤诅咒。',
        recipeMaterial: 'voidShard', recipeAlloy: 75,
    },

    // ══════════════════════════════════════════════════════════════
    // 🟡 控场型（3把）
    // ══════════════════════════════════════════════════════════════

    // ── 8 冰霜地雷 ──────────────────────────────────────────────
    {
        id: 'control-mine', name: '冰霜地雷', category: 'control',
        mechanic: 'control_mine', color: '#A7F3D0', iconKey: 'wpn_ice_gun',
        baseStats: { damage: 0, damagePct: 0, cooldown: 3.0, duration: 1.5, radius: 60, count: 3, speed: 0, pierce: 0, slowFactor: 0.40, slowDuration: 1.5, shieldAmount: 0, healPct: 0, triggerHpPct: 0, attackSpeedMultiplier: 0, burstDuration: 0 },
        levelUpgrades: [
            T({ count: 4, cooldown: 2.5, radius: 70, slowFactor: 0.45 }),
            T({ count: 5, cooldown: 2.0, slowDuration: 2.0 }),
            T({ count: 5, cooldown: 1.5, radius: 85, slowFactor: 0.50 }),
            T({ count: 6, cooldown: 1.2, radius: 100, slowFactor: 0.60, slowDuration: 2.5 }),
        ],
        desc: '自动在路径上释放冰冻地雷，敌人踩到减速。',
        recipeMaterial: 'purifyCrystal', recipeAlloy: 55,
    },
    // ── 9 静电力场 ──────────────────────────────────────────────
    {
        id: 'control-field', name: '静电力场', category: 'control',
        mechanic: 'control_field', color: '#60A5FA', iconKey: 'stat_lightning_def',
        baseStats: { damage: 5, damagePct: 0, cooldown: 0, duration: 0, radius: 180, count: 0, speed: 0, pierce: 0, slowFactor: 0.20, slowDuration: 0, shieldAmount: 0, healPct: 0, triggerHpPct: 0, attackSpeedMultiplier: 0, burstDuration: 0 },
        levelUpgrades: [
            T({ damage: 8, radius: 200, slowFactor: 0.25 }),
            T({ damage: 11, radius: 220, slowFactor: 0.30 }),
            T({ damage: 14, radius: 240, slowFactor: 0.35 }),
            T({ damage: 18, radius: 260, slowFactor: 0.40 }),
        ],
        desc: '范围内敌人持续减速，并受到微弱的电击伤害。',
        recipeMaterial: 'purifyCrystal', recipeAlloy: 50,
    },
    // ── 10 黑曜石封印 ───────────────────────────────────────────
    {
        id: 'control-seal', name: '黑曜石封印', category: 'control',
        mechanic: 'control_seal', color: '#475569', iconKey: 'stat_defense',
        baseStats: { damage: 0, damagePct: 0, cooldown: 10.0, duration: 5.0, radius: 300, count: 1, speed: 0, pierce: 0, slowFactor: 0, slowDuration: 0, shieldAmount: 0, healPct: 0, triggerHpPct: 0, attackSpeedMultiplier: 0, burstDuration: 0 },
        levelUpgrades: [
            T({ cooldown: 9.0, duration: 6.0 }),
            T({ cooldown: 8.0, duration: 7.0, count: 2 }),
            T({ cooldown: 6.0, duration: 7.0, count: 2 }),
            T({ cooldown: 4.0, duration: 8.0, count: 3 }),
        ],
        desc: '周期性冻结随机敌人，对 Boss 和精英效果减半。',
        recipeMaterial: 'purifyCrystal', recipeAlloy: 60,
    },

    // ══════════════════════════════════════════════════════════════
    // 🟣 爆发型（3把）
    // ══════════════════════════════════════════════════════════════

    // ── 11 虚空裂隙 ─────────────────────────────────────────────
    {
        id: 'burst-rift', name: '虚空裂隙', category: 'burst',
        mechanic: 'burst_rift', color: '#22D3EE', iconKey: 'resource_core',
        baseStats: { damage: 45, damagePct: 0, cooldown: 8.0, duration: 0, radius: 400, count: 3, speed: 600, pierce: 2, slowFactor: 0, slowDuration: 0, shieldAmount: 0, healPct: 0, triggerHpPct: 0, attackSpeedMultiplier: 0, burstDuration: 0 },
        levelUpgrades: [
            T({ damage: 55, count: 4, cooldown: 7.0 }),
            T({ damage: 65, count: 5, cooldown: 6.0 }),
            T({ damage: 75, count: 5, cooldown: 5.0 }),
            T({ damage: 90, count: 6, cooldown: 4.0, pierce: 3 }),
        ],
        desc: '周期性向最近敌人发射多道紫色激光。',
        recipeMaterial: 'timeLattice', recipeAlloy: 80,
    },
    // ── 12 暴风之眼 ─────────────────────────────────────────────
    {
        id: 'burst-eye', name: '暴风之眼', category: 'burst',
        mechanic: 'burst_eye', color: '#CBD5E1', iconKey: 'stat_attack_speed',
        baseStats: { damage: 0, damagePct: 0.30, cooldown: 12.0, duration: 0, radius: 200, count: 0, speed: 0, pierce: 0, slowFactor: 0, slowDuration: 0, shieldAmount: 0, healPct: 0, triggerHpPct: 0, attackSpeedMultiplier: 0, burstDuration: 0 },
        levelUpgrades: [
            T({ damagePct: 0.37, radius: 220, cooldown: 11.0 }),
            T({ damagePct: 0.45, radius: 240, cooldown: 10.0 }),
            T({ damagePct: 0.52, radius: 270, cooldown: 9.0 }),
            T({ damagePct: 0.60, radius: 300, cooldown: 7.0 }),
        ],
        desc: '周期性清空附近普通怪 HP（百分比伤害），对精英减半。',
        recipeMaterial: 'timeLattice', recipeAlloy: 85,
    },
    // ── 13 时间扭曲 ─────────────────────────────────────────────
    {
        id: 'burst-time', name: '时间扭曲', category: 'burst',
        mechanic: 'burst_time', color: '#E879F9', iconKey: 'stat_attack_speed',
        baseStats: { damage: 0, damagePct: 0, cooldown: 15.0, duration: 0, radius: 0, count: 0, speed: 0, pierce: 0, slowFactor: 0, slowDuration: 0, shieldAmount: 0, healPct: 0, triggerHpPct: 0, attackSpeedMultiplier: 2.0, burstDuration: 4.0 },
        levelUpgrades: [
            T({ attackSpeedMultiplier: 2.0, burstDuration: 5.0, cooldown: 13.0 }),
            T({ attackSpeedMultiplier: 2.0, burstDuration: 6.0, cooldown: 11.0 }),
            T({ attackSpeedMultiplier: 2.5, burstDuration: 7.0, cooldown: 10.0 }),
            T({ attackSpeedMultiplier: 2.5, burstDuration: 8.0, cooldown: 8.0 }),
        ],
        desc: '周期性爆发，短时间内主武器攻速翻倍。',
        recipeMaterial: 'timeLattice', recipeAlloy: 80,
    },

    // ══════════════════════════════════════════════════════════════
    // 🔴 防御/辅助型（2把）
    // ══════════════════════════════════════════════════════════════

    // ── 14 纳米修复器 ───────────────────────────────────────────
    {
        id: 'support-nano', name: '纳米修复器', category: 'support',
        mechanic: 'support_nano', color: '#34D399', iconKey: 'stat_hp',
        baseStats: { damage: 0, damagePct: 0, cooldown: 30.0, duration: 3.0, radius: 0, count: 0, speed: 0, pierce: 0, slowFactor: 0, slowDuration: 0, shieldAmount: 0, healPct: 30.0, triggerHpPct: 0.50, attackSpeedMultiplier: 0, burstDuration: 0 },
        levelUpgrades: [
            T({ healPct: 35.0, triggerHpPct: 0.55, cooldown: 26.0 }),
            T({ healPct: 40.0, triggerHpPct: 0.60, cooldown: 22.0 }),
            T({ healPct: 50.0, triggerHpPct: 0.65, cooldown: 18.0 }),
            T({ healPct: 60.0, triggerHpPct: 0.70, cooldown: 15.0 }),
        ],
        desc: 'HP 低于阈值时自动激活，快速恢复生命值。',
        recipeMaterial: 'timeLattice', recipeAlloy: 75,
    },
    // ── 15 铜墙护盾 ────────────────────────────────────────────
    {
        id: 'support-shield', name: '铜墙护盾', category: 'support',
        mechanic: 'support_shield', color: '#F9C74F', iconKey: 'stat_defense',
        baseStats: { damage: 0, damagePct: 0, cooldown: 0, duration: 0, radius: 0, count: 0, speed: 0, pierce: 0, slowFactor: 0, slowDuration: 0, shieldAmount: 10, healPct: 0, triggerHpPct: 0, attackSpeedMultiplier: 0, burstDuration: 0 },
        levelUpgrades: [
            T({ shieldAmount: 8 }),
            T({ shieldAmount: 7 }),
            T({ shieldAmount: 6 }),
            T({ shieldAmount: 5, healPct: 15 }),
        ],
        desc: '每受 N 次攻击自动格挡 1 次完全免伤。',
        recipeMaterial: 'timeLattice', recipeAlloy: 70,
    },
];

export const OFFHAND_COUNT = OFFHAND_CATALOG.length;

/** 根据 id 查找副武器 */
export function findOffhand(id: string): OffhandDef | undefined {
    return OFFHAND_CATALOG.find(o => o.id === id);
}

/** 获取副武器在某个等级的实际数值（T1=index 0） */
export function getOffhandStats(def: OffhandDef, level: number): typeof def.baseStats {
    const stats = { ...def.baseStats };
    for (let i = 0; i < Math.min(level - 1, def.levelUpgrades.length); i++) {
        const upgrade = def.levelUpgrades[i];
        for (const key of Object.keys(upgrade.stats) as (keyof typeof stats)[]) {
            (stats as any)[key] += (upgrade.stats as any)[key];
        }
    }
    return stats;
}

/** 获取副武器最大等级 */
export function getOffhandMaxLevel(def: OffhandDef): number {
    return 1 + def.levelUpgrades.length; // T1 + 4 upgrades = T5
}

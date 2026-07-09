/**
 * BotAIController — CDP/自动测试用战斗 AI
 *
 * 从 RogueShooterGame.ts 提取。保留原有走位/拾取/升级选择逻辑，
 * 通过 host context 访问主游戏状态，避免主类继续膨胀。
 */
import { KeyCode, Vec2 } from 'cc';

const WORLD_LEFT = -900;
const WORLD_RIGHT = 900;
const WORLD_BOTTOM = -1200;
const WORLD_TOP = 1200;

export interface BotAIHost {
    cs: any;
    pickupMgr: any;
    enemyMgr: any;
    proj: any;
    pressedKeys: Set<KeyCode>;
    getCharacterStats(): any;
    getAttackRange(): number;
    getMoveSpeed(): number;
}

export class BotAIController {
    private state: 'idle' | 'moving' | 'fighting' | 'fleeing' = 'idle';
    private targetPos: Vec2 | null = null;
    private moveTimer = 0;
    private stuckTimer = 0;
    private lastPlayerPos: Vec2 | null = null;
    private lastKillCount = 0;
    private pickupChaseTimer = 0;

    constructor(private host: BotAIHost) {}

    tick(dt: number): void {
        const h = this.host;
        if (h.cs.killCount > this.lastKillCount) {
            this.pickupChaseTimer = 5.5;
        }
        const xpPickups = (h.pickupMgr.pickups || []).filter((p: { type: string }) => p.type === 'xp');
        if (xpPickups.length > 0 && this.pickupChaseTimer <= 1) {
            this.pickupChaseTimer = Math.max(this.pickupChaseTimer, 2);
        }
        this.lastKillCount = h.cs.killCount;
        this.pickupChaseTimer = Math.max(0, this.pickupChaseTimer - dt);

        const px = h.cs.playerX;
        const py = h.cs.playerY;
        const hpRatio = h.cs.playerMaxHp > 0 ? h.cs.playerHp / h.cs.playerMaxHp : 1;
        const attackRange = h.getAttackRange();
        const speed = h.getMoveSpeed();
        const lookahead = clamp(speed > 0 ? 96 / speed : 0.34, 0.24, 0.48);

        if (this.lastPlayerPos && this.state !== 'idle') {
            const movedX = px - this.lastPlayerPos.x;
            const movedY = py - this.lastPlayerPos.y;
            const moved = Math.sqrt(movedX * movedX + movedY * movedY);
            const expectedStep = Math.max(1.2, speed * dt * 0.16);
            this.stuckTimer = moved < expectedStep ? this.stuckTimer + dt : 0;
        } else {
            this.stuckTimer = 0;
        }
        this.lastPlayerPos = new Vec2(px, py);

        if (this.stuckTimer >= 1.05 && (!this.targetPos || this.moveTimer <= 0)) {
            this.targetPos = this.findSafestEscapePoint(px, py, speed, lookahead, attackRange, hpRatio);
            this.moveTimer = 0.9;
        }

        let bestMoveX = 0;
        let bestMoveY = 0;
        let bestScore = Number.NEGATIVE_INFINITY;
        let bestState: 'idle' | 'moving' | 'fighting' | 'fleeing' = 'idle';

        for (const dir of this.candidateDirections()) {
            const candidateX = clamp(px + dir.x * speed * lookahead, WORLD_LEFT + 42, WORLD_RIGHT - 42);
            const candidateY = clamp(py + dir.y * speed * lookahead, WORLD_BOTTOM + 42, WORLD_TOP - 42);
            const scored = this.scoreMoveCandidate(candidateX, candidateY, dir.x, dir.y, attackRange, hpRatio);
            if (scored.score > bestScore) {
                bestScore = scored.score;
                bestMoveX = dir.x;
                bestMoveY = dir.y;
                bestState = scored.state;
            }
        }

        if (this.targetPos && this.moveTimer > 0) {
            this.moveTimer = Math.max(0, this.moveTimer - dt);
            if (distanceSq(px, py, this.targetPos.x, this.targetPos.y) < 70 * 70 || this.moveTimer <= 0) {
                this.targetPos = null;
                this.stuckTimer = 0;
            }
        }

        this.state = bestState;
        this.setMoveKeys(bestMoveX, bestMoveY);
    }

    pickUpgrade(): void {
        const h = this.host;
        const externalOptions = (h as unknown as { pendingUpgradeOptions?: any[] }).pendingUpgradeOptions;
        const isLevelChoice = h.cs.phase === 'level-up';
        const isItemChoice = h.cs.phase === 'item-choice';
        if (!isLevelChoice && !isItemChoice) return;

        const options = isLevelChoice
            ? (externalOptions && externalOptions.length > 0 ? externalOptions : h.pickupMgr.pendingLevelChoices)
            : h.pickupMgr.pendingItemChoices;
        if (!options || options.length <= 0) return;

        const index = this.chooseUpgradeIndex(options);
        if (isLevelChoice) h.pickupMgr.chooseLevelUpgrade(index);
        else h.pickupMgr.chooseRunItem(index);
    }

    private candidateDirections(): Vec2[] {
        const dirs: Vec2[] = [new Vec2(0, 0)];
        for (let i = 0; i < 16; i++) {
            const angle = (Math.PI * 2 * i) / 16;
            dirs.push(new Vec2(Math.cos(angle), Math.sin(angle)));
        }
        return dirs;
    }

    private scoreMoveCandidate(
        candidateX: number,
        candidateY: number,
        dirX: number,
        dirY: number,
        attackRange: number,
        hpRatio: number,
    ): { score: number; state: 'idle' | 'moving' | 'fighting' | 'fleeing' } {
        const h = this.host;
        const px = h.cs.playerX;
        const py = h.cs.playerY;
        const playerRadius = h.cs.playerRadius;
        const lowHpRiskMultiplier = hpRatio < 0.32 ? 2.2 : hpRatio < 0.52 ? 1.45 : 1;
        let score = 0;
        let dangerScore = 0;
        let nearestEnemyDist = Number.POSITIVE_INFINITY;
        let nearestEnemyInRange = false;

        for (const enemy of h.enemyMgr.enemies) {
            if (!h.enemyMgr.enemySet.has(enemy) || enemy.hp <= 0) continue;
            const pos = h.enemyMgr.getEnemyPosition(enemy);
            const dx = candidateX - pos.x;
            const dy = candidateY - pos.y;
            const dist = Math.sqrt(Math.max(0.001, dx * dx + dy * dy));
            nearestEnemyDist = Math.min(nearestEnemyDist, dist);
            if (dist <= attackRange) nearestEnemyInRange = true;

            const contactRadius = playerRadius + enemy.radius + 6;
            if (dist < contactRadius) {
                score -= 220000 + (contactRadius - dist) * 2600;
            }

            const threatRadius = Math.min(
                980,
                Math.max(280, enemy.radius + enemy.speed * 1.05 + (enemy.boss ? 250 : enemy.elite ? 190 : 145)),
            );
            if (dist < threatRadius) {
                const t = (threatRadius - dist) / threatRadius;
                const threatWeight = (enemy.boss ? 135 : enemy.elite ? 58 : 30) * (enemy.damage + 6) * lowHpRiskMultiplier;
                const penalty = t * t * threatWeight;
                score -= penalty;
                dangerScore += penalty;
            }

            const fromPlayerToEnemyX = pos.x - px;
            const fromPlayerToEnemyY = pos.y - py;
            const playerEnemyLen = Math.sqrt(Math.max(0.001, fromPlayerToEnemyX * fromPlayerToEnemyX + fromPlayerToEnemyY * fromPlayerToEnemyY));
            const movingTowardEnemy = (dirX * fromPlayerToEnemyX + dirY * fromPlayerToEnemyY) / playerEnemyLen;
            if (movingTowardEnemy > 0.45 && playerEnemyLen < 420) {
                score -= movingTowardEnemy * 180 * lowHpRiskMultiplier;
            }
        }

        for (const projectile of h.proj.enemyProjectiles) {
            const futureX = projectile.x + projectile.vx * 0.38;
            const futureY = projectile.y + projectile.vy * 0.38;
            const nowDistSq = distanceSq(candidateX, candidateY, projectile.x, projectile.y);
            const futureDistSq = distanceSq(candidateX, candidateY, futureX, futureY);
            const dangerRadius = playerRadius + projectile.radius + 48;
            const dangerSq = dangerRadius * dangerRadius;
            if (nowDistSq < dangerSq || futureDistSq < dangerSq) {
                const d = Math.sqrt(Math.max(0.001, Math.min(nowDistSq, futureDistSq)));
                const t = (dangerRadius - d) / dangerRadius;
                const penalty = 4200 * t * t * lowHpRiskMultiplier;
                score -= penalty;
                dangerScore += penalty;
            }
        }

        if (Number.isFinite(nearestEnemyDist)) {
            const desiredDistance = clamp(attackRange * 0.64, 220, 480);
            if (nearestEnemyInRange) score += 430;
            score -= Math.abs(nearestEnemyDist - desiredDistance) * 0.34;
            if (nearestEnemyDist < desiredDistance * 0.68) {
                score -= (desiredDistance * 0.68 - nearestEnemyDist) * 1.3 * lowHpRiskMultiplier;
            }
            if (nearestEnemyDist > attackRange) {
                score -= Math.min(420, (nearestEnemyDist - attackRange) * 1.2);
            }
        }

        const pickupScore = this.scorePickupRoute(candidateX, candidateY, dangerScore, hpRatio);
        score += pickupScore;

        const edgeMargin = 686;
        const leftEdge = candidateX - WORLD_LEFT;
        const rightEdge = WORLD_RIGHT - candidateX;
        const bottomEdge = candidateY - WORLD_BOTTOM;
        const topEdge = WORLD_TOP - candidateY;
        const currentEdgeMin = Math.min(px - WORLD_LEFT, WORLD_RIGHT - px, py - WORLD_BOTTOM, WORLD_TOP - py);
        const candidateEdgeMin = Math.min(leftEdge, rightEdge, bottomEdge, topEdge);
        for (const edgeDist of [leftEdge, rightEdge, bottomEdge, topEdge]) {
            if (edgeDist < edgeMargin) {
                const t = (edgeMargin - edgeDist) / edgeMargin;
                score -= t * t * 7600;
            }
            if (edgeDist < 266) score -= 90000;
        }
        if (currentEdgeMin < edgeMargin) {
            score += (candidateEdgeMin - currentEdgeMin) * 9.5;
        }

        const absX = Math.abs(candidateX);
        const absY = Math.abs(candidateY);
        if (absX > 1120) score -= (absX - 1120) * 7.2;
        if (absY > 1520) score -= (absY - 1520) * 7.2;
        if (absX > 1435 || absY > 1870) score -= 80000;
        score -= Math.sqrt(candidateX * candidateX + candidateY * candidateY) * 0.05;

        if (this.targetPos) {
            const currentTargetDist = Math.sqrt(distanceSq(px, py, this.targetPos.x, this.targetPos.y));
            const candidateTargetDist = Math.sqrt(distanceSq(candidateX, candidateY, this.targetPos.x, this.targetPos.y));
            score += (currentTargetDist - candidateTargetDist) * 3.2;
        }

        const standingStill = Math.abs(dirX) + Math.abs(dirY) <= 0.001;
        if (standingStill && dangerScore < 80 && nearestEnemyInRange) score += 120;
        if (standingStill && (dangerScore > 160 || hpRatio < 0.42)) score -= 260;

        let state: 'idle' | 'moving' | 'fighting' | 'fleeing' = 'idle';
        if (dangerScore > 180 || hpRatio < 0.34) state = 'fleeing';
        else if (pickupScore > 90) state = 'moving';
        else if (nearestEnemyInRange && standingStill) state = 'fighting';
        else if (Number.isFinite(nearestEnemyDist)) state = nearestEnemyInRange ? 'fighting' : 'moving';
        return { score, state };
    }

    private scorePickupRoute(candidateX: number, candidateY: number, dangerScore: number, hpRatio: number): number {
        const h = this.host;
        if (hpRatio < 0.32) return 0;
        const px = h.cs.playerX;
        const py = h.cs.playerY;
        let score = 0;
        const chaseWindow = this.pickupChaseTimer > 0;
        const maxXpDistance = chaseWindow ? 2000 : 1100;
        for (const pickup of h.pickupMgr.pickups) {
            const isXp = pickup.type === 'xp';
            const isChest = pickup.type === 'chest-common' || pickup.type === 'chest-rare';
            if (!isXp && !isChest && pickup.type !== 'alloy') continue;
            const currentDist = Math.sqrt(distanceSq(px, py, pickup.x, pickup.y));
            const candidateDist = Math.sqrt(distanceSq(candidateX, candidateY, pickup.x, pickup.y));
            const maxDistance = isXp ? maxXpDistance : isChest ? 620 : 360;
            if (currentDist > maxDistance) continue;
            const value = isXp
                ? 700 + Math.min(360, pickup.amount * 20)
                : isChest
                    ? (pickup.type === 'chest-rare' ? 240 : 170)
                    : 44;
            const safety = dangerScore > 800 ? 0.2 : dangerScore > 420 ? 0.5 : dangerScore > 120 ? 0.8 : 1;
            const progress = Math.max(-80, currentDist - candidateDist);
            const nearCollectBonus = isXp && candidateDist < 220 ? 520 : 0;
            score += ((1 - candidateDist / maxDistance) * value + progress * 6.2 + nearCollectBonus) * safety;
        }
        return score;
    }

    private findSafestEscapePoint(
        px: number,
        py: number,
        speed: number,
        lookahead: number,
        attackRange: number,
        hpRatio: number,
    ): Vec2 {
        let best = new Vec2(clamp(-px, -1, 1), clamp(-py, -1, 1));
        let bestScore = Number.NEGATIVE_INFINITY;
        for (const dir of this.candidateDirections()) {
            if (Math.abs(dir.x) + Math.abs(dir.y) <= 0.001) continue;
            const candidateX = clamp(px + dir.x * speed * lookahead * 2.2, WORLD_LEFT + 80, WORLD_RIGHT - 80);
            const candidateY = clamp(py + dir.y * speed * lookahead * 2.2, WORLD_BOTTOM + 80, WORLD_TOP - 80);
            const score = this.scoreMoveCandidate(candidateX, candidateY, dir.x, dir.y, attackRange, hpRatio).score;
            if (score > bestScore) {
                bestScore = score;
                best = new Vec2(candidateX, candidateY);
            }
        }
        return best;
    }

    private setMoveKeys(x: number, y: number): void {
        const keys = this.host.pressedKeys;
        keys.delete(KeyCode.KEY_A);
        keys.delete(KeyCode.KEY_D);
        keys.delete(KeyCode.KEY_W);
        keys.delete(KeyCode.KEY_S);

        const len = Math.sqrt(x * x + y * y);
        if (len <= 0.001) return;

        const nx = x / len;
        const ny = y / len;
        const threshold = 0.25;
        if (nx < -threshold) keys.add(KeyCode.KEY_A);
        if (nx > threshold) keys.add(KeyCode.KEY_D);
        if (ny > threshold) keys.add(KeyCode.KEY_W);
        if (ny < -threshold) keys.add(KeyCode.KEY_S);
    }

    private chooseUpgradeIndex(options: any[]): number {
        const stats = this.host.getCharacterStats();
        const statsAreHigh = stats.dronePower >= 12
            && stats.attackPower >= 72
            && stats.attackSpeed >= 0.9
            && stats.pierce >= 3
            && stats.critChance >= 0.2;
        if (statsAreHigh) return 0;

        const priority: Record<string, number> = {
            dronePower: 10000,
            attackPower: 8000,
            attackSpeed: 7000,
            pierce: 6000,
            critChance: 5000,
        };
        const weakness: Record<string, boolean> = {
            dronePower: stats.dronePower < 8,
            attackPower: stats.attackPower < 56,
            attackSpeed: stats.attackSpeed < 0.6,
            pierce: stats.pierce < 2,
            critChance: stats.critChance < 0.14,
        };

        let bestIndex = 0;
        let bestScore = Number.NEGATIVE_INFINITY;
        options.forEach((option, index) => {
            let score = option.tier * 20 - index;
            for (const effect of option.effects) {
                const base = priority[effect.stat] ?? 0;
                const normalizedAmount = (effect.stat === 'attackSpeed' || effect.stat === 'critChance')
                    ? effect.amount * 1000
                    : effect.amount * 10;
                score += base + normalizedAmount;
                if (weakness[effect.stat]) score += 4500;
            }
            if (score > bestScore) {
                bestScore = score;
                bestIndex = index;
            }
        });
        return bestIndex;
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function distanceSq(ax: number, ay: number, bx: number, by: number): number {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
}

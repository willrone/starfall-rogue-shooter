import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('assets/scripts/projectile/projectileManager.ts', 'utf8');

function sliceBetween(startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    assert(start >= 0, `missing source marker: ${startMarker}`);
    const end = source.indexOf(endMarker, start);
    assert(end > start, `missing source marker after ${startMarker}: ${endMarker}`);
    return source.slice(start, end);
}

function testBulletUpdateDoesNotAllocateUnusedTrailPoints(): void {
    const updateBody = sliceBetween('updateBullets(dt: number)', 'private tickBurnZones');
    assert(!updateBody.includes('bullet.trail.push'), 'bullet updates must not allocate trail points without a frame-time visual consumer');
    assert(!updateBody.includes('bullet.trail.shift'), 'bullet updates must not shift an unused trail array every frame');
    assert(updateBody.includes('bullet.node.setPosition'), 'the allocation removal must preserve bullet movement');
}

function testExpiredBulletsUseOneBatchCompaction(): void {
    const recycleBody = sliceBetween('private recycleRemovedBullets', 'updateBullets(dt: number)');
    const updateBody = sliceBetween('updateBullets(dt: number)', 'private tickBurnZones');

    assert(updateBody.includes('const removing = new Set<Bullet>()'), 'same-frame duplicate removals must be idempotent');
    assert(updateBody.includes('this.recycleRemovedBullets(removing)'), 'bullet removals must finish through one batch compaction');
    assert(!updateBody.includes('this.removeBullet(bullet)'), 'batch removal must not perform indexOf/splice once per expired bullet');
    assert(recycleBody.includes('this.bullets[writeIndex++] = bullet'), 'surviving bullets must be compacted in place');
    assert(recycleBody.includes('this.bullets.length = writeIndex'), 'batch compaction must truncate the active array once');
    assert(recycleBody.includes('const recycled = new Set<Bullet>()'), 'recycling must remain duplicate-safe');
    assert(!recycleBody.includes('.indexOf('), 'batch compaction must not search the active array once per removal');
    assert(!recycleBody.includes('.splice('), 'batch compaction must not splice the active array once per removal');

    const splitAppend = updateBody.indexOf('this.bullets.push(splitBullet)');
    const batchRecycle = updateBody.lastIndexOf('this.recycleRemovedBullets(removing)');
    assert(splitAppend >= 0 && splitAppend < batchRecycle, 'split bullets appended during iteration must remain visible to final compaction');
    assert(recycleBody.includes('readIndex < this.bullets.length'), 'compaction must include bullets appended during the current update');
}

function testOptionalSpawnSnapshotKeepsLegacyFallbacks(): void {
    const snapshotBody = sliceBetween('createBulletSpawnSnapshot()', 'createBullet(');
    const createBody = sliceBetween('createBullet(', 'acquireBullet(): Bullet');

    assert(source.includes('export interface BulletSpawnSnapshot'), 'spawn snapshots must have a public type for callers');
    assert(snapshotBody.includes('speed: this.getBulletSpeed()'));
    assert(snapshotBody.includes('pierceDamageRetention: this.getPierceDamageRetention()'));
    assert(createBody.includes('spawnSnapshot?: BulletSpawnSnapshot'), 'the snapshot must remain optional for existing callers');
    assert(createBody.includes('spawnSnapshot?.speed ?? this.getBulletSpeed()'), 'legacy calls must keep runtime speed calculation');
    assert(createBody.includes('spawnSnapshot?.pierceDamageRetention ?? this.getPierceDamageRetention()'), 'legacy calls must keep runtime retention calculation');
    assert(createBody.includes('this.drawBullet(bullet)'), 'snapshot reuse must not bypass existing bullet rendering');
}

testBulletUpdateDoesNotAllocateUnusedTrailPoints();
testExpiredBulletsUseOneBatchCompaction();
testOptionalSpawnSnapshotKeepsLegacyFallbacks();

console.log('projectileLifecyclePerformance tests passed.');

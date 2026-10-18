import type { MissileSpec } from './missile-types.js';

export interface MutableUnit {
  x: number;
  y: number;
  alive: boolean;
  team: number;
}

export function makeUnit(x: number, y: number, team = 1, alive = true): MutableUnit {
  return { x, y, alive, team };
}

/** F01 直線、速度 10、碰撞圓 8、命中即停、存活 20 tick。 */
export const BASE_SPEC: MissileSpec = {
  id: 'bone',
  calibrationId: 'bone',
  blend: 'normal',
  motion: { speed: 10, accel: 0, maxSpeed: 10 },
  lifetime: { maxLifeTicks: 20, rangePx: null },
  collision: { radiusPx: 8, pierce: 0 },
  explosion: null,
  behavior: { family: 'F01' },
};

export function specOf(id: string, patch: Partial<MissileSpec> = {}): MissileSpec {
  return { ...BASE_SPEC, ...patch, id, calibrationId: id };
}

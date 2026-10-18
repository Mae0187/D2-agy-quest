import { describe, expect, it } from 'vitest';
import { NO_TARGET } from './targets.js';
import {
  ExpireReason,
  FAMILY_IDS,
  MissileEventKind,
  MissileState,
  UNLIMITED_PIERCE,
  canPierce,
  canTransition,
  consumePierce,
  createMissileRuntime,
  dispatchMissileEvent,
  explodesOn,
  resetMissileRuntime,
  stateName,
  validateMissileSpec,
  type MissileHooks,
  type MissileSpec,
} from './missile-types.js';

const BASE: MissileSpec = {
  id: 'bonespear',
  calibrationId: 'bonespear',
  blend: 'normal',
  motion: { speed: 12, accel: 0, maxSpeed: 12 },
  lifetime: { maxLifeTicks: 50, rangePx: null },
  collision: { radiusPx: 10, pierce: UNLIMITED_PIERCE },
  explosion: null,
  behavior: { family: 'F01' },
};

describe('lifecycle transitions', () => {
  const S = MissileState;
  const legal = new Set(['0>1', '0>3', '1>2', '1>3', '2>3']);
  const all = [S.INIT, S.ACTIVE, S.EXPLODING, S.DEAD] as const;

  for (const from of all) {
    for (const to of all) {
      const ok = legal.has(`${from}>${to}`);
      it(`${stateName(from)} → ${stateName(to)} is ${ok ? 'legal' : 'illegal'}`, () => {
        expect(canTransition(from, to)).toBe(ok);
      });
    }
  }

  it('state names', () => {
    expect(all.map(stateName)).toEqual(['INIT', 'ACTIVE', 'EXPLODING', 'DEAD']);
  });
});

describe('pierce semantics', () => {
  it('pierce = 0 stops at the first hit', () => {
    expect(canPierce(0)).toBe(false);
    expect(consumePierce(0)).toBe(0);
  });

  it('pierce = 2 passes through exactly 2 targets, stops on the 3rd', () => {
    let left = 2;
    const passes: boolean[] = [];
    for (let i = 0; i < 3; i++) {
      const pass = canPierce(left);
      passes.push(pass);
      if (pass) left = consumePierce(left);
    }
    expect(passes).toEqual([true, true, false]);
  });

  it('UNLIMITED_PIERCE never runs out', () => {
    let left = UNLIMITED_PIERCE;
    for (let i = 0; i < 1000; i++) {
      expect(canPierce(left)).toBe(true);
      left = consumePierce(left);
    }
    expect(left).toBe(UNLIMITED_PIERCE);
  });
});

describe('validateMissileSpec', () => {
  const F02: MissileSpec = {
    ...BASE,
    id: 'bonespirit',
    behavior: { family: 'F02', turnRateDegPerTick: 6, acquireRadiusPx: 300, reacquire: true, fallback: 'straight' },
  };
  const F04: MissileSpec = {
    ...BASE,
    id: 'chargedbolt',
    behavior: { family: 'F04', stepJitterDeg: 30, retargetEveryTicks: 3 },
  };
  const WITH_EXPLOSION: MissileSpec = {
    ...BASE,
    id: 'fireball',
    blend: 'additive',
    collision: { radiusPx: 12, pierce: 0 },
    explosion: { durationTicks: 10, onHit: true, onExpire: false, spawnMissileId: null },
  };

  it.each([
    ['F01 baseline', BASE],
    ['F02', F02],
    ['F04', F04],
    ['with explosion', WITH_EXPLOSION],
  ])('accepts %s', (_name, spec) => {
    expect(validateMissileSpec(spec)).toEqual([]);
  });

  const bad: Array<[string, MissileSpec, string]> = [
    ['empty id', { ...BASE, id: '' }, 'id'],
    ['empty calibrationId', { ...BASE, calibrationId: '' }, 'calibrationId'],
    ['unknown blend', { ...BASE, blend: 'glow' as never }, 'blend'],
    ['negative speed', { ...BASE, motion: { speed: -1, accel: 0, maxSpeed: 5 } }, 'motion.speed'],
    ['NaN speed', { ...BASE, motion: { speed: NaN, accel: 0, maxSpeed: 5 } }, 'motion.speed'],
    ['maxSpeed < speed', { ...BASE, motion: { speed: 10, accel: 0, maxSpeed: 5 } }, 'motion.maxSpeed'],
    ['infinite accel', { ...BASE, motion: { speed: 1, accel: Infinity, maxSpeed: 5 } }, 'motion.accel'],
    ['maxLifeTicks 0', { ...BASE, lifetime: { maxLifeTicks: 0, rangePx: null } }, 'maxLifeTicks'],
    ['maxLifeTicks 1.5', { ...BASE, lifetime: { maxLifeTicks: 1.5, rangePx: null } }, 'maxLifeTicks'],
    ['rangePx 0', { ...BASE, lifetime: { maxLifeTicks: 10, rangePx: 0 } }, 'rangePx'],
    ['negative radius', { ...BASE, collision: { radiusPx: -1, pierce: 0 } }, 'radiusPx'],
    ['pierce -2', { ...BASE, collision: { radiusPx: 1, pierce: -2 } }, 'pierce'],
    ['pierce 1.5', { ...BASE, collision: { radiusPx: 1, pierce: 1.5 } }, 'pierce'],
    [
      'negative explosion duration',
      { ...BASE, explosion: { durationTicks: -1, onHit: true, onExpire: false, spawnMissileId: null } },
      'durationTicks',
    ],
    [
      'empty spawnMissileId',
      { ...BASE, explosion: { durationTicks: 1, onHit: true, onExpire: false, spawnMissileId: '' } },
      'spawnMissileId',
    ],
    [
      'F02 turnRate 0',
      { ...F02, behavior: { family: 'F02', turnRateDegPerTick: 0, acquireRadiusPx: 1, reacquire: true, fallback: 'straight' } },
      'turnRateDegPerTick',
    ],
    [
      'F02 bad fallback',
      { ...F02, behavior: { family: 'F02', turnRateDegPerTick: 1, acquireRadiusPx: 1, reacquire: true, fallback: 'spin' as never } },
      'fallback',
    ],
    [
      'F04 jitter 200',
      { ...F04, behavior: { family: 'F04', stepJitterDeg: 200, retargetEveryTicks: 1 } },
      'stepJitterDeg',
    ],
    [
      'F04 retarget 0',
      { ...F04, behavior: { family: 'F04', stepJitterDeg: 10, retargetEveryTicks: 0 } },
      'retargetEveryTicks',
    ],
    ['unsupported family', { ...BASE, behavior: { family: 'F99' } as never }, 'unsupported'],
  ];

  it.each(bad)('rejects: %s', (_name, spec, fragment) => {
    const errors = validateMissileSpec(spec);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join(' | ')).toContain(fragment);
  });

  it('reports multiple problems at once', () => {
    const errors = validateMissileSpec({
      ...BASE,
      id: '',
      motion: { speed: -1, accel: NaN, maxSpeed: -5 },
    });
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('explodesOn', () => {
  it('no explosion block → never', () => {
    expect(explodesOn(BASE, 'hit')).toBe(false);
    expect(explodesOn(BASE, 'expire')).toBe(false);
  });

  it('follows onHit / onExpire flags', () => {
    const s: MissileSpec = {
      ...BASE,
      explosion: { durationTicks: 5, onHit: true, onExpire: false, spawnMissileId: null },
    };
    expect(explodesOn(s, 'hit')).toBe(true);
    expect(explodesOn(s, 'expire')).toBe(false);
  });
});

describe('MissileRuntime', () => {
  it('a fresh record is DEAD with sentinel values', () => {
    const rt = createMissileRuntime(3);
    expect(rt.state).toBe(MissileState.DEAD);
    expect(rt.handle).toBe(3);
    expect(rt.targetId).toBe(NO_TARGET);
    expect(rt.specIndex).toBe(-1);
    expect(rt.teleported).toBe(false);
  });

  it('reset restores every field, keeps handle and bumps generation', () => {
    const rt = createMissileRuntime(7);
    rt.state = MissileState.ACTIVE;
    rt.specIndex = 4;
    rt.ageTicks = 9;
    rt.x = 1;
    rt.y = 2;
    rt.prevX = 3;
    rt.prevY = 4;
    rt.phi = 123;
    rt.speed = 8;
    rt.travelled = 99;
    rt.pierceLeft = 3;
    rt.hitCount = 2;
    rt.targetId = 55;
    rt.rngState = 777;
    rt.explodeTicksLeft = 6;
    rt.animAcc = 100;
    rt.animFrame = 5;
    rt.teleported = true;

    resetMissileRuntime(rt);
    expect(rt).toEqual({ ...createMissileRuntime(7), generation: 1 });

    resetMissileRuntime(rt);
    expect(rt.generation).toBe(2);
  });

  it('generation wraps as uint32', () => {
    const rt = createMissileRuntime(0);
    rt.generation = 4294967295;
    resetMissileRuntime(rt);
    expect(rt.generation).toBe(0);
  });
});

describe('dispatchMissileEvent', () => {
  it('routes each event kind to the matching hook with the right arguments', () => {
    const calls: Array<[string, number]> = [];
    const hooks: MissileHooks = {
      onSpawn: () => calls.push(['spawn', 0]),
      onActivate: () => calls.push(['activate', 0]),
      onHit: (_rt, _s, t) => calls.push(['hit', t]),
      onExpire: (_rt, _s, r) => calls.push(['expire', r]),
      onExplode: () => calls.push(['explode', 0]),
      onDead: () => calls.push(['dead', 0]),
    };
    const rt = createMissileRuntime(0);
    dispatchMissileEvent(hooks, MissileEventKind.SPAWN, rt, BASE);
    dispatchMissileEvent(hooks, MissileEventKind.ACTIVATE, rt, BASE);
    dispatchMissileEvent(hooks, MissileEventKind.HIT, rt, BASE, 42);
    dispatchMissileEvent(hooks, MissileEventKind.EXPIRE, rt, BASE, ExpireReason.RANGE);
    dispatchMissileEvent(hooks, MissileEventKind.EXPLODE, rt, BASE);
    dispatchMissileEvent(hooks, MissileEventKind.DEAD, rt, BASE);
    expect(calls).toEqual([
      ['spawn', 0],
      ['activate', 0],
      ['hit', 42],
      ['expire', ExpireReason.RANGE],
      ['explode', 0],
      ['dead', 0],
    ]);
  });

  it('null hooks and missing optional hooks are no-ops', () => {
    const rt = createMissileRuntime(0);
    expect(() => dispatchMissileEvent(null, MissileEventKind.HIT, rt, BASE, 1)).not.toThrow();
    expect(() => dispatchMissileEvent({}, MissileEventKind.DEAD, rt, BASE)).not.toThrow();
  });

  it('preserves `this` for class-based hooks', () => {
    class Recorder implements MissileHooks {
      hits = 0;
      onHit(): void {
        this.hits++;
      }
    }
    const r = new Recorder();
    dispatchMissileEvent(r, MissileEventKind.HIT, createMissileRuntime(0), BASE, 1);
    expect(r.hits).toBe(1);
  });
});

describe('family ids', () => {
  it('are F01..F20, unique and in order', () => {
    expect(FAMILY_IDS).toHaveLength(20);
    expect(new Set(FAMILY_IDS).size).toBe(20);
    FAMILY_IDS.forEach((id, i) => expect(id).toBe(`F${String(i + 1).padStart(2, '0')}`));
  });
});

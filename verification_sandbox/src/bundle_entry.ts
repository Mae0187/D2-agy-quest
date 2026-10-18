// bundle_entry.ts — Web 整合入口：匯出完整 D2 投射物系統
import { MissileManager, MissileManagerOptions, ManagerStats } from './manager.js';
import { TargetRegistry, TargetUnit, NO_TARGET } from './targets.js';
import { MissileRenderer, SpriteInfo, SpriteResolver } from './render.js';
import { MissileObjectPool } from './pool.js';
import { MissileState, MissileSpec, MissileRuntime } from './missile-types.js';
import { createDefaultBehaviors, BehaviorRegistry, BehaviorImpl, StepOutcome } from './behaviors.js';
import { OFFICIAL_D2_SPECS } from './data/d2-missile-specs.js';
import { DEG2RAD, normalizeDeg, groundToScreen, screenToGround } from './geometry.js';
import { spiralInit, spiralStep, SpiralParams } from './spiral.js';

// F03 螺旋行為 (祝聖之槌等)
export const F03_SPIRAL: BehaviorImpl = {
  family: 'F03',
  init(rt, spec, env) {
    const o = rt.handle * 8;
    const p: SpiralParams = {
      r0: 16,
      b: 24,
      speed: spec.motion.speed || 14,
      rMax: spec.lifetime.rangePx || 360,
      maxDTheta: 0.22,
      ySquash: 0.5,
    };
    spiralInit(env.state, o, rt.x, rt.y, rt.phi * DEG2RAD, 1, p);
  },
  update(rt, spec, env) {
    const o = rt.handle * 8;
    const p: SpiralParams = {
      r0: 16,
      b: 24,
      speed: spec.motion.speed || 14,
      rMax: spec.lifetime.rangePx || 360,
      maxDTheta: 0.22,
      ySquash: 0.5,
    };
    const out = { x: 0, y: 0, phi: 0, done: false };
    spiralStep(env.state, o, p, out);
    rt.x = out.x;
    rt.y = out.y;
    rt.phi = normalizeDeg(out.phi * (180 / Math.PI));
    if (out.done) return StepOutcome.RANGE;
    return StepOutcome.CONTINUE;
  },
};

// 完整行為註冊表 (包含 F01 直線、F02 導引、F03 螺旋、F04 折線)
export function createAllBehaviors(): BehaviorRegistry {
  const reg = createDefaultBehaviors();
  reg.register(F03_SPIRAL);
  return reg;
}

export interface MissileSystemOptions {
  capacity?: number;
  specs?: MissileSpec[];
  onHit?: (rt: MissileRuntime, spec: MissileSpec, targetId: number) => void;
  onExplode?: (rt: MissileRuntime, spec: MissileSpec) => void;
  onExpire?: (rt: MissileRuntime, spec: MissileSpec) => void;
}

/**
 * MissileSystem — 開箱即用的高階整合控制器
 */
export class MissileSystem {
  readonly targets: TargetRegistry;
  readonly manager: MissileManager;
  renderer: MissileRenderer | null = null;
  readonly behaviors: BehaviorRegistry;
  readonly specs: MissileSpec[];

  constructor(options: MissileSystemOptions = {}) {
    this.targets = new TargetRegistry();
    this.behaviors = createAllBehaviors();
    this.specs = options.specs || (Object.values(OFFICIAL_D2_SPECS) as MissileSpec[]);
    this.manager = new MissileManager({
      specs: this.specs,
      targets: this.targets,
      capacity: options.capacity || 512,
      behaviors: this.behaviors,
      hooks: {
        onHit: (rt, spec, targetId) => {
          if (options.onHit) {
            options.onHit(rt, spec, targetId);
          }
        },
        onExplode: (rt, spec) => {
          if (options.onExplode) {
            options.onExplode(rt, spec);
          }
        },
        onExpire: (rt, spec) => {
          if (options.onExpire) {
            options.onExpire(rt, spec);
          }
        },
      },
    });
  }

  attachRenderer(ctx: any, resolve: SpriteResolver): MissileRenderer {
    this.renderer = new MissileRenderer(ctx, this.manager, resolve);
    return this.renderer;
  }

  step(): void {
    this.manager.step();
    if (this.renderer) {
      this.renderer.tickAnimations();
    }
  }

  render(alpha: number): void {
    if (this.renderer) {
      this.renderer.render(alpha);
    }
  }
}

// 統整輸出給全域命名空間
export {
  MissileManager,
  TargetRegistry,
  MissileRenderer,
  MissileObjectPool,
  MissileState,
  BehaviorRegistry,
  OFFICIAL_D2_SPECS,
  DEG2RAD,
  normalizeDeg,
  groundToScreen,
  screenToGround,
  NO_TARGET,
};

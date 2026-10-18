"use strict";
var D2MissileSystem = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/bundle_entry.ts
  var bundle_entry_exports = {};
  __export(bundle_entry_exports, {
    BehaviorRegistry: () => BehaviorRegistry,
    DEG2RAD: () => DEG2RAD,
    F03_SPIRAL: () => F03_SPIRAL,
    MissileManager: () => MissileManager,
    MissileObjectPool: () => MissileObjectPool,
    MissileRenderer: () => MissileRenderer,
    MissileState: () => MissileState,
    MissileSystem: () => MissileSystem,
    NO_TARGET: () => NO_TARGET,
    OFFICIAL_D2_SPECS: () => OFFICIAL_D2_SPECS,
    TargetRegistry: () => TargetRegistry,
    createAllBehaviors: () => createAllBehaviors,
    normalizeDeg: () => normalizeDeg
  });

  // src/geometry.ts
  var DEG2RAD = Math.PI / 180;
  var RAD2DEG = 180 / Math.PI;
  var ISO_Y_SCALE = 0.5;
  var ISO_Y_UNSQUASH = 1 / ISO_Y_SCALE;
  function assertFinite(value, name) {
    if (!Number.isFinite(value)) {
      throw new RangeError(`${name} must be a finite number, got ${value}`);
    }
  }
  function normalizeDeg(deg) {
    assertFinite(deg, "deg");
    return (deg % 360 + 360) % 360;
  }

  // src/rng.ts
  var LCG_A = 1664525;
  var LCG_C = 1013904223;
  var TWO32 = 4294967296;
  function toSeed32(seed) {
    if (!Number.isFinite(seed)) {
      throw new RangeError(`seed must be a finite number, got ${seed}`);
    }
    return Math.trunc(seed) >>> 0;
  }
  function lcgStep(state) {
    return Math.imul(state, LCG_A) + LCG_C >>> 0;
  }
  function lcgUnit(state) {
    return state / TWO32;
  }
  function deriveSeed(base, stream) {
    let h = toSeed32(base) + Math.imul(toSeed32(stream), 2654435761) >>> 0;
    h ^= h >>> 16;
    h = Math.imul(h, 2246822507);
    h ^= h >>> 13;
    h = Math.imul(h, 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  }

  // src/targets.ts
  var NO_TARGET = -1;
  function groundToPhi(dx, dy) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      throw new RangeError(`dx, dy must be finite, got (${dx}, ${dy})`);
    }
    return normalizeDeg(Math.atan2(dy, dx) * RAD2DEG);
  }
  function assertFinitePair(x, y, what) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new RangeError(`${what} must be finite, got (${x}, ${y})`);
    }
  }
  var PointTarget = class {
    constructor(id, x, y) {
      this.id = id;
      assertFinitePair(x, y, "point");
      this.px = x;
      this.py = y;
    }
    kind = "point";
    px;
    py;
    set(x, y) {
      assertFinitePair(x, y, "point");
      this.px = x;
      this.py = y;
    }
    resolve(out) {
      out.x = this.px;
      out.y = this.py;
      return true;
    }
  };
  var UnitTarget = class {
    constructor(id, unit, offsetX = 0, offsetY = 0) {
      this.id = id;
      this.unit = unit;
      assertFinitePair(offsetX, offsetY, "aim offset");
      this.offsetX = offsetX;
      this.offsetY = offsetY;
    }
    kind = "unit";
    offsetX;
    offsetY;
    get team() {
      return this.unit.team;
    }
    resolve(out) {
      if (!this.unit.alive) return false;
      out.x = this.unit.x + this.offsetX;
      out.y = this.unit.y + this.offsetY;
      return true;
    }
  };
  var TargetRegistry = class {
    list = [];
    slot = /* @__PURE__ */ new Map();
    scratch = { x: 0, y: 0 };
    nextId = 1;
    get size() {
      return this.list.length;
    }
    createPoint(x, y) {
      const t = new PointTarget(this.nextId, x, y);
      this.register(t);
      return t;
    }
    createUnit(unit, offsetX = 0, offsetY = 0) {
      const t = new UnitTarget(this.nextId, unit, offsetX, offsetY);
      this.register(t);
      return t;
    }
    register(t) {
      this.nextId++;
      this.slot.set(t.id, this.list.length);
      this.list.push(t);
    }
    get(id) {
      const idx = this.slot.get(id);
      return idx === void 0 ? void 0 : this.list[idx];
    }
    has(id) {
      return this.slot.has(id);
    }
    /** 移除目標。回傳是否真的移除。id 不會被重用。 */
    remove(id) {
      const idx = this.slot.get(id);
      if (idx === void 0) return false;
      const lastIdx = this.list.length - 1;
      const last = this.list[lastIdx];
      this.list[idx] = last;
      this.slot.set(last.id, idx);
      this.list.pop();
      this.slot.delete(id);
      return true;
    }
    /** 清空全部目標;id 計數器不重置,舊 id 永遠失效。 */
    clear() {
      this.list.length = 0;
      this.slot.clear();
    }
    /** NO_TARGET、未註冊、已移除或單位已死亡,一律回傳 false 且不修改 out。 */
    resolve(id, out) {
      if (id === NO_TARGET) return false;
      const t = this.get(id);
      return t !== void 0 && t.resolve(out);
    }
    /**
     * 從 (x, y) 看向目標的 φ(度)。目標失效或與出發點重合(沒有方向)時回傳 fallbackPhi。
     * 零配置。
     */
    phiToTarget(id, fromX, fromY, fallbackPhi) {
      if (!this.resolve(id, this.scratch)) return fallbackPhi;
      const dx = this.scratch.x - fromX;
      const dy = this.scratch.y - fromY;
      if (dx === 0 && dy === 0) return fallbackPhi;
      return groundToPhi(dx, dy);
    }
    /**
     * 在半徑內找最近的存活單位(只看指定陣營)。找不到回傳 NO_TARGET。
     * 距離相同時 id 較小者優先。零配置。
     */
    findNearestUnit(x, y, radius, team, excludeId = NO_TARGET) {
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius < 0) {
        throw new RangeError(`invalid search (x=${x}, y=${y}, radius=${radius})`);
      }
      const r2 = radius * radius;
      let bestId = NO_TARGET;
      let bestD2 = Infinity;
      const p = this.scratch;
      for (let i = 0; i < this.list.length; i++) {
        const t = this.list[i];
        if (!(t instanceof UnitTarget) || t.team !== team || t.id === excludeId) continue;
        if (!t.resolve(p)) continue;
        const dx = p.x - x;
        const dy = p.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        if (d2 < bestD2 || d2 === bestD2 && t.id < bestId) {
          bestD2 = d2;
          bestId = t.id;
        }
      }
      return bestId;
    }
    /**
     * 同 findNearestUnit,但略過 skip[skipOffset .. skipOffset+skipCount) 內列出的 id。
     * 供穿透投射物「每個目標只命中一次」使用。零配置。
     */
    findNearestUnitSkipping(x, y, radius, team, skip, skipOffset, skipCount) {
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius < 0) {
        throw new RangeError(`invalid search (x=${x}, y=${y}, radius=${radius})`);
      }
      if (!Number.isInteger(skipOffset) || !Number.isInteger(skipCount) || skipOffset < 0 || skipCount < 0 || skipOffset + skipCount > skip.length) {
        throw new RangeError(`invalid skip range (${skipOffset}, ${skipCount}) for length ${skip.length}`);
      }
      const r2 = radius * radius;
      let bestId = NO_TARGET;
      let bestD2 = Infinity;
      const p = this.scratch;
      for (let i = 0; i < this.list.length; i++) {
        const t = this.list[i];
        if (!(t instanceof UnitTarget) || t.team !== team) continue;
        let skipped = false;
        for (let k = 0; k < skipCount; k++) {
          if (skip[skipOffset + k] === t.id) {
            skipped = true;
            break;
          }
        }
        if (skipped) continue;
        if (!t.resolve(p)) continue;
        const dx = p.x - x;
        const dy = p.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        if (d2 < bestD2 || d2 === bestD2 && t.id < bestId) {
          bestD2 = d2;
          bestId = t.id;
        }
      }
      return bestId;
    }
  };

  // src/behaviors.ts
  var STATE_STRIDE = 8;
  var StepOutcome = {
    /** 本 tick 正常移動。 */
    CONTINUE: 0,
    /** 本 tick 到達射程上限(位置已夾在射程終點)。 */
    RANGE: 1,
    /** 行為要求立刻到期(如追蹤彈失去目標且 fallback = 'expire')。 */
    EXPIRE: 2
  };
  function createBehaviorEnv(targets, slotCount) {
    return {
      targets,
      team: -1,
      state: new Float64Array(slotCount * STATE_STRIDE),
      scratch: { x: 0, y: 0 }
    };
  }
  function clearBehaviorState(env, slot) {
    env.state.fill(0, slot * STATE_STRIDE, (slot + 1) * STATE_STRIDE);
  }
  function advanceLinear(rt, spec2) {
    const m = spec2.motion;
    let v = rt.speed + m.accel;
    if (v > m.maxSpeed) v = m.maxSpeed;
    if (v < 0) v = 0;
    rt.speed = v;
    let step = v;
    let outcome = StepOutcome.CONTINUE;
    const range = spec2.lifetime.rangePx;
    if (range !== null) {
      const remaining = range - rt.travelled;
      if (step >= remaining) {
        step = remaining > 0 ? remaining : 0;
        outcome = StepOutcome.RANGE;
      }
    }
    const rad = rt.phi * DEG2RAD;
    rt.x += step * Math.cos(rad);
    rt.y += step * Math.sin(rad);
    rt.travelled = outcome === StepOutcome.RANGE && range !== null ? range : rt.travelled + step;
    return outcome;
  }
  function mismatch(expected, spec2) {
    return new Error(`behavior ${expected} used with spec "${spec2.id}" of family ${spec2.behavior.family}`);
  }
  var F01_STRAIGHT = {
    family: "F01",
    init() {
    },
    update(rt, spec2) {
      return advanceLinear(rt, spec2);
    }
  };
  var F02_HOMING = {
    family: "F02",
    init(rt, spec2, env) {
      const p = spec2.behavior;
      if (p.family !== "F02") throw mismatch("F02", spec2);
      if (rt.targetId !== NO_TARGET && env.targets.resolve(rt.targetId, env.scratch)) return;
      rt.targetId = env.targets.findNearestUnit(rt.x, rt.y, p.acquireRadiusPx, env.team);
    },
    update(rt, spec2, env) {
      const p = spec2.behavior;
      if (p.family !== "F02") throw mismatch("F02", spec2);
      const sc = env.scratch;
      let have = false;
      if (rt.targetId !== NO_TARGET) {
        have = env.targets.resolve(rt.targetId, sc);
        if (!have) rt.targetId = NO_TARGET;
      }
      if (!have && p.reacquire) {
        rt.targetId = env.targets.findNearestUnit(rt.x, rt.y, p.acquireRadiusPx, env.team);
        if (rt.targetId !== NO_TARGET) {
          have = env.targets.resolve(rt.targetId, sc);
          if (!have) rt.targetId = NO_TARGET;
        }
      }
      if (have) {
        const dx = sc.x - rt.x;
        const dy = sc.y - rt.y;
        if (dx !== 0 || dy !== 0) {
          let d = normalizeDeg(groundToPhi(dx, dy) - rt.phi);
          if (d > 180) d -= 360;
          const lim = p.turnRateDegPerTick;
          if (d > lim) d = lim;
          else if (d < -lim) d = -lim;
          rt.phi = normalizeDeg(rt.phi + d);
        }
      } else if (p.fallback === "expire") {
        return StepOutcome.EXPIRE;
      }
      return advanceLinear(rt, spec2);
    }
  };
  var F04_ZIGZAG = {
    family: "F04",
    init(rt, spec2, env) {
      if (spec2.behavior.family !== "F04") throw mismatch("F04", spec2);
      env.state[rt.handle * STATE_STRIDE] = rt.phi;
    },
    update(rt, spec2, env) {
      const p = spec2.behavior;
      if (p.family !== "F04") throw mismatch("F04", spec2);
      if (rt.ageTicks % p.retargetEveryTicks === 0) {
        const base = rt.handle * STATE_STRIDE;
        if (rt.targetId !== NO_TARGET) {
          if (env.targets.resolve(rt.targetId, env.scratch)) {
            const dx = env.scratch.x - rt.x;
            const dy = env.scratch.y - rt.y;
            if (dx !== 0 || dy !== 0) env.state[base] = groundToPhi(dx, dy);
          } else {
            rt.targetId = NO_TARGET;
          }
        }
        rt.rngState = lcgStep(rt.rngState);
        const jitter = (lcgUnit(rt.rngState) * 2 - 1) * p.stepJitterDeg;
        rt.phi = normalizeDeg(env.state[base] + jitter);
      }
      return advanceLinear(rt, spec2);
    }
  };
  var BehaviorRegistry = class {
    map = /* @__PURE__ */ new Map();
    register(impl) {
      if (this.map.has(impl.family)) throw new Error(`behavior already registered: ${impl.family}`);
      this.map.set(impl.family, impl);
      return this;
    }
    get(family) {
      return this.map.get(family);
    }
    has(family) {
      return this.map.has(family);
    }
  };
  function createDefaultBehaviors() {
    return new BehaviorRegistry().register(F01_STRAIGHT).register(F02_HOMING).register(F04_ZIGZAG);
  }

  // src/blend.ts
  var BLEND_MODES = [
    "normal",
    "alpha25",
    "alpha50",
    "alpha75",
    "additive",
    "screen",
    "luminance",
    "multiply",
    "shadow"
  ];
  function spec(composite, alpha) {
    return Object.freeze({ composite, alpha });
  }
  var BLEND_TABLE = Object.freeze({
    normal: spec("source-over", 1),
    alpha25: spec("source-over", 0.25),
    alpha50: spec("source-over", 0.5),
    alpha75: spec("source-over", 0.75),
    additive: spec("lighter", 1),
    screen: spec("screen", 1),
    luminance: spec("source-over", 1),
    multiply: spec("multiply", 1),
    shadow: spec("source-over", 0.5)
    // 待校準
  });
  function isBlendMode(value) {
    return typeof value === "string" && BLEND_MODES.includes(value);
  }
  function effectiveAlpha(mode, alpha = 1) {
    if (!Number.isFinite(alpha)) throw new RangeError(`alpha must be finite, got ${alpha}`);
    const v = BLEND_TABLE[mode].alpha * alpha;
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }
  function applyBlend(ctx, mode, alpha = 1) {
    ctx.globalCompositeOperation = BLEND_TABLE[mode].composite;
    ctx.globalAlpha = effectiveAlpha(mode, alpha);
  }

  // src/missile-types.ts
  var MissileState = {
    INIT: 0,
    ACTIVE: 1,
    EXPLODING: 2,
    DEAD: 3
  };
  var ALLOWED = [
    1 << MissileState.ACTIVE | 1 << MissileState.DEAD,
    // INIT
    1 << MissileState.EXPLODING | 1 << MissileState.DEAD,
    // ACTIVE
    1 << MissileState.DEAD,
    // EXPLODING
    0
    // DEAD:只能由物件池 reset 重新配置,不屬於狀態轉移
  ];
  var UNLIMITED_PIERCE = -1;
  function canPierce(pierceLeft) {
    return pierceLeft !== 0;
  }
  function consumePierce(pierceLeft) {
    if (pierceLeft === UNLIMITED_PIERCE) return UNLIMITED_PIERCE;
    return pierceLeft > 0 ? pierceLeft - 1 : 0;
  }
  function validateMissileSpec(spec2) {
    const e = [];
    const fin = Number.isFinite;
    if (spec2.id.length === 0) e.push("id must be non-empty");
    if (spec2.calibrationId.length === 0) e.push("calibrationId must be non-empty");
    if (!isBlendMode(spec2.blend)) e.push(`blend is not a known BlendMode: ${String(spec2.blend)}`);
    const m = spec2.motion;
    if (!(fin(m.speed) && m.speed >= 0)) e.push("motion.speed must be a finite number >= 0");
    if (!fin(m.accel)) e.push("motion.accel must be finite");
    if (!(fin(m.maxSpeed) && m.maxSpeed >= m.speed)) e.push("motion.maxSpeed must be finite and >= motion.speed");
    const l = spec2.lifetime;
    if (!(Number.isInteger(l.maxLifeTicks) && l.maxLifeTicks >= 1)) {
      e.push("lifetime.maxLifeTicks must be an integer >= 1");
    }
    if (l.rangePx !== null && !(fin(l.rangePx) && l.rangePx > 0)) {
      e.push("lifetime.rangePx must be null or a finite number > 0");
    }
    const c = spec2.collision;
    if (!(fin(c.radiusPx) && c.radiusPx >= 0)) e.push("collision.radiusPx must be a finite number >= 0");
    if (!(Number.isInteger(c.pierce) && (c.pierce >= 0 || c.pierce === UNLIMITED_PIERCE))) {
      e.push("collision.pierce must be an integer >= 0 or UNLIMITED_PIERCE (-1)");
    }
    if (spec2.explosion !== null) {
      const x = spec2.explosion;
      if (!(Number.isInteger(x.durationTicks) && x.durationTicks >= 0)) {
        e.push("explosion.durationTicks must be an integer >= 0");
      }
      if (x.spawnMissileId !== null && x.spawnMissileId.length === 0) {
        e.push("explosion.spawnMissileId must be null or non-empty");
      }
    }
    const b = spec2.behavior;
    switch (b.family) {
      case "F01":
        break;
      case "F02":
        if (!(fin(b.turnRateDegPerTick) && b.turnRateDegPerTick > 0)) {
          e.push("behavior.turnRateDegPerTick must be a finite number > 0");
        }
        if (!(fin(b.acquireRadiusPx) && b.acquireRadiusPx >= 0)) {
          e.push("behavior.acquireRadiusPx must be a finite number >= 0");
        }
        if (b.fallback !== "straight" && b.fallback !== "expire") {
          e.push("behavior.fallback must be 'straight' or 'expire'");
        }
        break;
      case "F04":
        if (!(fin(b.stepJitterDeg) && b.stepJitterDeg >= 0 && b.stepJitterDeg <= 180)) {
          e.push("behavior.stepJitterDeg must be in [0, 180]");
        }
        if (!(Number.isInteger(b.retargetEveryTicks) && b.retargetEveryTicks >= 1)) {
          e.push("behavior.retargetEveryTicks must be an integer >= 1");
        }
        break;
      default:
        e.push(`behavior.family unsupported: ${String(b.family)}`);
    }
    return e;
  }
  function createMissileRuntime(handle) {
    return {
      state: MissileState.DEAD,
      handle,
      generation: 0,
      specIndex: -1,
      ageTicks: 0,
      x: 0,
      y: 0,
      prevX: 0,
      prevY: 0,
      phi: 0,
      speed: 0,
      travelled: 0,
      pierceLeft: 0,
      hitCount: 0,
      targetId: NO_TARGET,
      rngState: 0,
      explodeTicksLeft: 0,
      animAcc: 0,
      animFrame: 0,
      teleported: false
    };
  }
  function resetMissileRuntime(rt) {
    rt.state = MissileState.DEAD;
    rt.generation = rt.generation + 1 >>> 0;
    rt.specIndex = -1;
    rt.ageTicks = 0;
    rt.x = 0;
    rt.y = 0;
    rt.prevX = 0;
    rt.prevY = 0;
    rt.phi = 0;
    rt.speed = 0;
    rt.travelled = 0;
    rt.pierceLeft = 0;
    rt.hitCount = 0;
    rt.targetId = NO_TARGET;
    rt.rngState = 0;
    rt.explodeTicksLeft = 0;
    rt.animAcc = 0;
    rt.animFrame = 0;
    rt.teleported = false;
  }
  var MissileEventKind = {
    SPAWN: 0,
    ACTIVATE: 1,
    HIT: 2,
    EXPIRE: 3,
    EXPLODE: 4,
    DEAD: 5
  };
  var ExpireReason = {
    LIFETIME: 0,
    RANGE: 1
  };
  function dispatchMissileEvent(hooks, kind, rt, spec2, aux = NO_TARGET) {
    if (hooks === null) return;
    switch (kind) {
      case MissileEventKind.SPAWN:
        hooks.onSpawn?.(rt, spec2);
        break;
      case MissileEventKind.ACTIVATE:
        hooks.onActivate?.(rt, spec2);
        break;
      case MissileEventKind.HIT:
        hooks.onHit?.(rt, spec2, aux);
        break;
      case MissileEventKind.EXPIRE:
        hooks.onExpire?.(rt, spec2, aux);
        break;
      case MissileEventKind.EXPLODE:
        hooks.onExplode?.(rt, spec2);
        break;
      case MissileEventKind.DEAD:
        hooks.onDead?.(rt, spec2);
        break;
    }
  }
  function explodesOn(spec2, trigger) {
    const x = spec2.explosion;
    if (x === null) return false;
    return trigger === "hit" ? x.onHit : x.onExpire;
  }

  // src/pool.ts
  var NO_HANDLE = -1;
  var POOL_INDEX_RADIX = 65536;
  var MAX_POOL_CAPACITY = POOL_INDEX_RADIX;
  var MissileObjectPool = class {
    capacity;
    records;
    nextFree;
    live;
    freeHead = 0;
    liveN = 0;
    hw = 0;
    peak = 0;
    exhausted = 0;
    acquired = 0;
    released = 0;
    constructor(capacity) {
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_POOL_CAPACITY) {
        throw new RangeError(`capacity must be an integer in [1, ${MAX_POOL_CAPACITY}], got ${capacity}`);
      }
      this.capacity = capacity;
      this.records = Array.from({ length: capacity }, (_, i) => createMissileRuntime(i));
      this.nextFree = new Int32Array(capacity);
      this.live = new Uint8Array(capacity);
      this.rebuildFreeList();
    }
    get liveCount() {
      return this.liveN;
    }
    get freeCount() {
      return this.capacity - this.liveN;
    }
    /** 曾使用過的最大槽位 + 1。迭代上限。 */
    get highWater() {
      return this.hw;
    }
    get peakLive() {
      return this.peak;
    }
    /** acquire() 因池已滿而失敗的累計次數。 */
    get exhaustedCount() {
      return this.exhausted;
    }
    get acquiredTotal() {
      return this.acquired;
    }
    get releasedTotal() {
      return this.released;
    }
    /**
     * 取出一筆空閒記錄,狀態設為 INIT,其餘欄位為乾淨預設值。
     * 池已滿回傳 null 並累計 exhaustedCount。
     */
    acquire() {
      if (this.freeHead === -1) {
        this.exhausted++;
        return null;
      }
      const idx = this.freeHead;
      this.freeHead = this.nextFree[idx];
      this.nextFree[idx] = -1;
      this.live[idx] = 1;
      this.liveN++;
      this.acquired++;
      if (this.liveN > this.peak) this.peak = this.liveN;
      if (idx + 1 > this.hw) this.hw = idx + 1;
      const rt = this.records[idx];
      rt.state = MissileState.INIT;
      return rt;
    }
    /** 記錄 → handle。只對仍存活的記錄有意義。 */
    handleOf(rt) {
      return rt.generation * POOL_INDEX_RADIX + rt.handle;
    }
    /** handle → 記錄。過期、已釋放、格式錯誤一律回傳 null。 */
    get(handle) {
      if (!Number.isInteger(handle) || handle < 0) return null;
      const idx = handle % POOL_INDEX_RADIX;
      if (idx >= this.capacity || this.live[idx] === 0) return null;
      const rt = this.records[idx];
      return rt.generation * POOL_INDEX_RADIX + idx === handle ? rt : null;
    }
    isValid(handle) {
      return this.get(handle) !== null;
    }
    /** 依索引取記錄(迭代用,不檢查範圍;請用 0 ≤ i < highWater)。可能是 DEAD 狀態的空閒槽位。 */
    at(index) {
      return this.records[index];
    }
    /** 以 handle 釋放。過期或重複釋放回傳 false。 */
    release(handle) {
      const rt = this.get(handle);
      return rt === null ? false : this.releaseRecord(rt);
    }
    /** 以記錄釋放:重置所有欄位、遞增 generation、放回 free-list 頭。重複釋放回傳 false。 */
    releaseRecord(rt) {
      const idx = rt.handle;
      if (idx < 0 || idx >= this.capacity || this.records[idx] !== rt || this.live[idx] === 0) {
        return false;
      }
      resetMissileRuntime(rt);
      this.live[idx] = 0;
      this.nextFree[idx] = this.freeHead;
      this.freeHead = idx;
      this.liveN--;
      this.released++;
      return true;
    }
    /** 釋放全部存活記錄並重建 free-list。計數器保留。 */
    clear() {
      for (let i = 0; i < this.hw; i++) {
        if (this.live[i] === 1) {
          resetMissileRuntime(this.records[i]);
          this.released++;
        }
      }
      this.liveN = 0;
      this.live.fill(0);
      this.rebuildFreeList();
    }
    /** 診斷用(會配置記憶體,請勿放在熱路徑)。回傳空陣列代表結構完整。 */
    checkIntegrity() {
      const errors = [];
      const cap = this.capacity;
      const seen = new Uint8Array(cap);
      let n = 0;
      let cur = this.freeHead;
      while (cur !== -1) {
        if (cur < 0 || cur >= cap) {
          errors.push(`free list index out of range: ${cur}`);
          break;
        }
        if (seen[cur]) {
          errors.push(`free list cycle or duplicate at slot ${cur}`);
          break;
        }
        seen[cur] = 1;
        n++;
        if (this.live[cur] === 1) errors.push(`live slot ${cur} is in the free list`);
        if (this.records[cur].state !== MissileState.DEAD) errors.push(`free slot ${cur} is not DEAD`);
        cur = this.nextFree[cur];
      }
      if (n !== cap - this.liveN) errors.push(`free list length ${n} != capacity - live (${cap - this.liveN})`);
      let flags = 0;
      for (let i = 0; i < cap; i++) if (this.live[i] === 1) flags++;
      if (flags !== this.liveN) errors.push(`live flags ${flags} != liveCount ${this.liveN}`);
      return errors;
    }
    rebuildFreeList() {
      const cap = this.capacity;
      for (let i = 0; i < cap - 1; i++) this.nextFree[i] = i + 1;
      this.nextFree[cap - 1] = -1;
      this.freeHead = 0;
    }
  };

  // src/manager.ts
  var NO_TEAM = -1;
  var HIT_MEMORY = 8;
  var MissileManager = class {
    pool;
    stats = {
      spawned: 0,
      rejected: 0,
      evicted: 0,
      hits: 0,
      expired: 0,
      exploded: 0,
      died: 0
    };
    /** 已執行的 step() 次數。 */
    tickCount = 0;
    specs;
    specIndexById = /* @__PURE__ */ new Map();
    behaviors = [];
    childIndex;
    env;
    targets;
    hitTeam;
    hitMem;
    spawnTick;
    worldSeed;
    policy;
    hooks;
    spawnCounter = 0;
    constructor(opts) {
      const capacity = opts.capacity ?? 512;
      this.pool = new MissileObjectPool(capacity);
      this.targets = opts.targets;
      this.worldSeed = opts.worldSeed ?? 1;
      this.hooks = opts.hooks ?? null;
      this.policy = opts.onExhausted ?? "reject";
      this.specs = [...opts.specs];
      const registry = opts.behaviors ?? createDefaultBehaviors();
      const n = this.specs.length;
      const errors = [];
      this.specs.forEach((s, i) => {
        for (const e of validateMissileSpec(s)) errors.push(`${s.id || `#${i}`}: ${e}`);
        if (this.specIndexById.has(s.id)) errors.push(`duplicate spec id: ${s.id}`);
        else this.specIndexById.set(s.id, i);
      });
      this.childIndex = new Int32Array(n).fill(-1);
      this.specs.forEach((s, i) => {
        const impl = registry.get(s.behavior.family);
        if (impl === void 0) errors.push(`${s.id}: no behavior registered for ${s.behavior.family}`);
        else this.behaviors.push(impl);
        const child = s.explosion?.spawnMissileId ?? null;
        if (child !== null) {
          const ci = this.specIndexById.get(child);
          if (ci === void 0) errors.push(`${s.id}: explosion.spawnMissileId "${child}" does not exist`);
          else this.childIndex[i] = ci;
        }
      });
      for (let i = 0; i < n; i++) {
        let cur = i;
        let k = 0;
        for (; k <= n; k++) {
          cur = this.childIndex[cur];
          if (cur < 0) break;
        }
        if (k > n) errors.push(`${this.specs[i].id}: spawn chain contains a cycle`);
      }
      if (errors.length > 0) throw new Error(`invalid missile specs:
${errors.join("\n")}`);
      this.env = createBehaviorEnv(this.targets, capacity);
      this.hitTeam = new Int16Array(capacity).fill(NO_TEAM);
      this.hitMem = new Int32Array(capacity * HIT_MEMORY).fill(NO_TARGET);
      this.spawnTick = new Float64Array(capacity);
    }
    get liveCount() {
      return this.pool.liveCount;
    }
    setHooks(hooks) {
      this.hooks = hooks;
    }
    /** 規格 id → 索引,找不到回傳 -1。請在載入時查一次,熱路徑用索引。 */
    specIndexOf(id) {
      return this.specIndexById.get(id) ?? -1;
    }
    specAt(index) {
      return this.specs[index];
    }
    // ───────────────────────── 生成與銷毀 ─────────────────────────
    /**
     * 生成投射物。
     * @param specIndex 規格索引
     * @param x,y       Ground 座標
     * @param phi       方向(度)
     * @param hitTeam   要攻擊的陣營;NO_TEAM(-1)= 不做碰撞
     * @param targetId  初始目標(NO_TARGET 則由行為自行索敵)
     * @returns handle;池滿且無法回收時回傳 NO_HANDLE
     */
    spawn(specIndex, x, y, phi, hitTeam = NO_TEAM, targetId = NO_TARGET) {
      return this.spawnInternal(specIndex, x, y, phi, hitTeam, targetId, -1);
    }
    spawnById(id, x, y, phi, hitTeam = NO_TEAM, targetId = NO_TARGET) {
      const idx = this.specIndexOf(id);
      if (idx < 0) throw new RangeError(`unknown missile spec id: ${id}`);
      return this.spawnInternal(idx, x, y, phi, hitTeam, targetId, -1);
    }
    /** 立即銷毀(會分派 DEAD 鉤子)。過期或已死亡的 handle 回傳 false。 */
    kill(handle) {
      const rt = this.pool.get(handle);
      if (rt === null || rt.state === MissileState.DEAD) return false;
      this.terminate(rt);
      return true;
    }
    isAlive(handle) {
      const rt = this.pool.get(handle);
      return rt !== null && rt.state !== MissileState.DEAD;
    }
    /** 清空所有投射物,不分派鉤子(換場景、從隱藏狀態恢復時使用)。 */
    clearAll() {
      this.pool.clear();
    }
    // ───────────────────────── 單 tick 推進 ─────────────────────────
    step() {
      this.tickCount++;
      const tick = this.tickCount;
      const pool = this.pool;
      const hw = pool.highWater;
      for (let i = 0; i < hw; i++) {
        const rt = pool.at(i);
        const st = rt.state;
        if (st === MissileState.DEAD) continue;
        if (st === MissileState.INIT) {
          if (this.spawnTick[i] >= tick) continue;
          this.activate(rt);
          if (rt.state !== MissileState.ACTIVE) continue;
          this.stepActive(rt);
        } else if (st === MissileState.ACTIVE) {
          this.stepActive(rt);
        } else {
          this.stepExploding(rt);
        }
      }
    }
    // ───────────────────────── 內部實作 ─────────────────────────
    spawnInternal(specIndex, x, y, phi, hitTeam, targetId, protectSlot) {
      if (!Number.isInteger(specIndex) || specIndex < 0 || specIndex >= this.specs.length) {
        throw new RangeError(`specIndex out of range: ${specIndex}`);
      }
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(phi)) {
        throw new RangeError(`spawn position/direction must be finite, got (${x}, ${y}, ${phi})`);
      }
      if (!Number.isInteger(hitTeam) || hitTeam < -1 || hitTeam > 32767) {
        throw new RangeError(`hitTeam must be an integer in [-1, 32767], got ${hitTeam}`);
      }
      if (!Number.isInteger(targetId)) throw new RangeError(`targetId must be an integer, got ${targetId}`);
      let rt = this.pool.acquire();
      if (rt === null && this.policy === "evict-oldest" && this.evictOne(protectSlot)) {
        rt = this.pool.acquire();
      }
      if (rt === null) {
        this.stats.rejected++;
        return NO_HANDLE;
      }
      const spec2 = this.specs[specIndex];
      const slot = rt.handle;
      rt.specIndex = specIndex;
      rt.ageTicks = 0;
      rt.x = x;
      rt.y = y;
      rt.prevX = x;
      rt.prevY = y;
      rt.phi = normalizeDeg(phi);
      rt.speed = spec2.motion.speed;
      rt.travelled = 0;
      rt.pierceLeft = spec2.collision.pierce;
      rt.hitCount = 0;
      rt.targetId = targetId;
      rt.rngState = deriveSeed(this.worldSeed, this.spawnCounter++);
      rt.explodeTicksLeft = 0;
      rt.teleported = true;
      this.hitTeam[slot] = hitTeam;
      this.hitMem.fill(NO_TARGET, slot * HIT_MEMORY, (slot + 1) * HIT_MEMORY);
      this.spawnTick[slot] = this.tickCount;
      clearBehaviorState(this.env, slot);
      this.env.team = hitTeam;
      this.behaviors[specIndex].init(rt, spec2, this.env);
      this.stats.spawned++;
      dispatchMissileEvent(this.hooks, MissileEventKind.SPAWN, rt, spec2);
      return this.pool.handleOf(rt);
    }
    activate(rt) {
      rt.state = MissileState.ACTIVE;
      dispatchMissileEvent(this.hooks, MissileEventKind.ACTIVATE, rt, this.specs[rt.specIndex]);
    }
    stepActive(rt) {
      const spec2 = this.specs[rt.specIndex];
      const team = this.hitTeam[rt.handle];
      rt.prevX = rt.x;
      rt.prevY = rt.y;
      rt.teleported = false;
      this.env.team = team;
      const outcome = this.behaviors[rt.specIndex].update(rt, spec2, this.env);
      rt.ageTicks++;
      if (team >= 0 && this.resolveHits(rt, spec2, team)) return;
      if (outcome === StepOutcome.RANGE) {
        this.expire(rt, spec2, ExpireReason.RANGE);
      } else if (outcome === StepOutcome.EXPIRE || rt.ageTicks >= spec2.lifetime.maxLifeTicks) {
        this.expire(rt, spec2, ExpireReason.LIFETIME);
      }
    }
    /** 處理本 tick 的所有命中。回傳 true 表示該記錄已不再是 ACTIVE(轉換、死亡或被鉤子改動)。 */
    resolveHits(rt, spec2, team) {
      const gen = rt.generation;
      const base = rt.handle * HIT_MEMORY;
      for (let n = 0; n < HIT_MEMORY; n++) {
        const known = rt.hitCount < HIT_MEMORY ? rt.hitCount : HIT_MEMORY;
        const id = this.targets.findNearestUnitSkipping(
          rt.x,
          rt.y,
          spec2.collision.radiusPx,
          team,
          this.hitMem,
          base,
          known
        );
        if (id === NO_TARGET) return false;
        this.hitMem[base + rt.hitCount % HIT_MEMORY] = id;
        rt.hitCount++;
        this.stats.hits++;
        dispatchMissileEvent(this.hooks, MissileEventKind.HIT, rt, spec2, id);
        if (rt.generation !== gen || rt.state !== MissileState.ACTIVE) return true;
        if (canPierce(rt.pierceLeft)) {
          rt.pierceLeft = consumePierce(rt.pierceLeft);
          continue;
        }
        this.finish(rt, spec2, "hit");
        return true;
      }
      return false;
    }
    expire(rt, spec2, reason) {
      const gen = rt.generation;
      this.stats.expired++;
      dispatchMissileEvent(this.hooks, MissileEventKind.EXPIRE, rt, spec2, reason);
      if (rt.generation !== gen || rt.state !== MissileState.ACTIVE) return;
      this.finish(rt, spec2, "expire");
    }
    finish(rt, spec2, trigger) {
      if (explodesOn(spec2, trigger)) this.beginExplosion(rt, spec2);
      else this.terminate(rt);
    }
    beginExplosion(rt, spec2) {
      const x = spec2.explosion;
      if (x === null) {
        this.terminate(rt);
        return;
      }
      const gen = rt.generation;
      const slot = rt.handle;
      rt.state = MissileState.EXPLODING;
      rt.explodeTicksLeft = x.durationTicks;
      rt.speed = 0;
      this.stats.exploded++;
      dispatchMissileEvent(this.hooks, MissileEventKind.EXPLODE, rt, spec2);
      if (rt.generation !== gen || rt.state !== MissileState.EXPLODING) return;
      const child = this.childIndex[rt.specIndex];
      if (child >= 0) {
        this.spawnInternal(child, rt.x, rt.y, rt.phi, this.hitTeam[slot], NO_TARGET, slot);
        if (rt.generation !== gen || rt.state !== MissileState.EXPLODING) return;
      }
      if (x.durationTicks === 0) this.terminate(rt);
    }
    stepExploding(rt) {
      rt.prevX = rt.x;
      rt.prevY = rt.y;
      rt.teleported = false;
      rt.ageTicks++;
      rt.explodeTicksLeft--;
      if (rt.explodeTicksLeft <= 0) this.terminate(rt);
    }
    /** 標為 DEAD → DEAD 鉤子(此時資料仍完整)→ 放回池。 */
    terminate(rt) {
      const spec2 = this.specs[rt.specIndex];
      rt.state = MissileState.DEAD;
      this.stats.died++;
      dispatchMissileEvent(this.hooks, MissileEventKind.DEAD, rt, spec2);
      this.pool.releaseRecord(rt);
    }
    /** 池滿時回收一筆:優先 EXPLODING 中最接近結束的,否則存活最久的。同分取較小槽位。 */
    evictOne(protectSlot) {
      const pool = this.pool;
      let victim = null;
      let best = -1;
      for (let i = 0; i < pool.highWater; i++) {
        const rt = pool.at(i);
        if (rt.state === MissileState.DEAD || i === protectSlot) continue;
        const score = rt.state === MissileState.EXPLODING ? 1e9 - rt.explodeTicksLeft : rt.ageTicks;
        if (score > best) {
          best = score;
          victim = rt;
        }
      }
      if (victim === null) return false;
      this.stats.evicted++;
      this.terminate(victim);
      return true;
    }
  };

  // src/render.ts
  function advanceAnim(m, speed, frameCount, loop = true) {
    if (frameCount <= 0) return;
    const acc = (m.animAcc | 0) + (speed | 0);
    const carry = acc >> 8;
    m.animAcc = acc & 255;
    if (carry === 0) return;
    const next = m.animFrame + carry;
    m.animFrame = loop ? next % frameCount : Math.min(next, frameCount - 1);
  }
  var MissileRenderer = class {
    constructor(ctx, manager, resolve) {
      this.ctx = ctx;
      this.manager = manager;
      this.resolve = resolve;
    }
    /** 每個邏輯 Tick 呼叫一次（掛在 MissileLoop.onTick），動畫不可跟著畫面幀跑 */
    tickAnimations() {
      const pool = this.manager.pool;
      for (let i = 0; i < pool.highWater; i++) {
        const m = pool.at(i);
        if (m.state === MissileState.DEAD || m.state === MissileState.INIT) continue;
        const s = this.resolve(m);
        if (s) advanceAnim(m, s.speed, s.frameCount, s.loop ?? true);
      }
    }
    /** 每個畫面幀呼叫一次；alpha 為 MissileLoop 提供的插值比例 */
    render(alpha) {
      if (this.manager.liveCount === 0) return;
      const ctx = this.ctx;
      const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
      const inv = 1 - a;
      if (ctx.imageSmoothingEnabled !== void 0) {
        ctx.imageSmoothingEnabled = false;
      }
      const pool = this.manager.pool;
      for (let i = 0; i < pool.highWater; i++) {
        const m = pool.at(i);
        if (m.state === MissileState.DEAD || m.state === MissileState.INIT) continue;
        let rx, ry;
        if (m.teleported) {
          rx = Math.round(m.x);
          ry = Math.round(m.y);
        } else {
          rx = Math.round(m.prevX * inv + m.x * a);
          ry = Math.round(m.prevY * inv + m.y * a);
        }
        const s = this.resolve(m);
        if (s && s.image && s.image.complete && s.image.naturalWidth > 0) {
          const frame = m.animFrame % (s.frameCount > 0 ? s.frameCount : 1);
          const sx = frame * s.frameW;
          const sy = (s.row ?? 0) * s.frameH;
          const dx = rx - Math.round(s.anchorX);
          const dy = ry - Math.round(s.anchorY);
          const blend = s.blendMode ?? (this.manager.specs[m.specIndex]?.blend ?? "normal");
          try {
            applyBlend(ctx, blend, s.opacity ?? 1);
            if (s.placement) {
              ctx.save();
              ctx.translate(rx, ry);
              if (s.placement.rotate !== 0) ctx.rotate(s.placement.rotate);
              const f = s.placement.frame;
              ctx.drawImage(s.image, f.x, f.y, f.width, f.height, -s.placement.pivotX, -s.placement.pivotY, f.width, f.height);
              ctx.restore();
            } else {
              ctx.drawImage(s.image, sx, sy, s.frameW, s.frameH, dx, dy, s.frameW, s.frameH);
            }
          } finally {
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = 1;
          }
        }
        if (m.teleported) {
          m.teleported = false;
          m.prevX = m.x;
          m.prevY = m.y;
        }
      }
    }
  };

  // src/data/d2-missile-specs.ts
  var OFFICIAL_D2_SPECS = {
    "fireball": {
      "id": "fireball",
      "calibrationId": "fireball",
      "blend": "additive",
      "motion": {
        "speed": 20,
        "accel": 0,
        "maxSpeed": 20
      },
      "lifetime": {
        "maxLifeTicks": 50,
        "rangePx": 1e3
      },
      "collision": {
        "radiusPx": 22,
        "pierce": 0
      },
      "explosion": {
        "durationTicks": 6,
        "onHit": true,
        "onExpire": true,
        "spawnMissileId": null
      },
      "behavior": {
        "family": "F01"
      }
    },
    "bonespirit": {
      "id": "bonespirit",
      "calibrationId": "bonespirit",
      "blend": "additive",
      "motion": {
        "speed": 12,
        "accel": 0,
        "maxSpeed": 12
      },
      "lifetime": {
        "maxLifeTicks": 128,
        "rangePx": 1536
      },
      "collision": {
        "radiusPx": 22,
        "pierce": 0
      },
      "explosion": {
        "durationTicks": 6,
        "onHit": true,
        "onExpire": true,
        "spawnMissileId": null
      },
      "behavior": {
        "family": "F02",
        "turnRateDegPerTick": 12,
        "acquireRadiusPx": 360,
        "reacquire": true,
        "fallback": "straight",
        "retargetEveryTicks": 5
      }
    },
    "chargedbolt": {
      "id": "chargedbolt",
      "calibrationId": "chargedbolt",
      "blend": "additive",
      "motion": {
        "speed": 12,
        "accel": 0,
        "maxSpeed": 12
      },
      "lifetime": {
        "maxLifeTicks": 98,
        "rangePx": 1176
      },
      "collision": {
        "radiusPx": 22,
        "pierce": 1
      },
      "explosion": null,
      "behavior": {
        "family": "F04",
        "stepJitterDeg": 50,
        "retargetEveryTicks": 2
      }
    },
    "guidedarrow": {
      "id": "guidedarrow",
      "calibrationId": "guidedarrow",
      "blend": "additive",
      "motion": {
        "speed": 24,
        "accel": 0,
        "maxSpeed": 24
      },
      "lifetime": {
        "maxLifeTicks": 128,
        "rangePx": 3072
      },
      "collision": {
        "radiusPx": 22,
        "pierce": 0
      },
      "explosion": null,
      "behavior": {
        "family": "F02",
        "turnRateDegPerTick": 12,
        "acquireRadiusPx": 360,
        "reacquire": true,
        "fallback": "straight",
        "retargetEveryTicks": 5
      }
    },
    "frozenorb": {
      "id": "frozenorb",
      "calibrationId": "frozenorb",
      "blend": "additive",
      "motion": {
        "speed": 10,
        "accel": 0,
        "maxSpeed": 10
      },
      "lifetime": {
        "maxLifeTicks": 30,
        "rangePx": 300
      },
      "collision": {
        "radiusPx": 22,
        "pierce": 0
      },
      "explosion": null,
      "behavior": {
        "family": "F01"
      }
    }
  };

  // src/spiral.ts
  var SP = { THETA: 0, R: 1, CX: 2, CY: 3, DIR: 4, SIZE: 5 };
  function spiralInit(s, o, cx, cy, theta0, dir, p) {
    s[o + SP.THETA] = theta0;
    s[o + SP.R] = p.r0;
    s[o + SP.CX] = cx;
    s[o + SP.CY] = cy;
    s[o + SP.DIR] = dir;
  }
  function spiralStep(s, o, p, out) {
    const r = s[o + SP.R];
    const dir = s[o + SP.DIR];
    const dTheta = Math.min(p.speed / Math.hypot(r, p.b), p.maxDTheta);
    const theta = s[o + SP.THETA] + dir * dTheta;
    const nr = r + p.b * dTheta;
    s[o + SP.THETA] = theta;
    s[o + SP.R] = nr;
    const c = Math.cos(theta), sn = Math.sin(theta);
    out.x = s[o + SP.CX] + nr * c;
    out.y = s[o + SP.CY] + nr * sn * p.ySquash;
    out.phi = Math.atan2(p.b * sn + dir * nr * c, p.b * c - dir * nr * sn);
    out.done = nr >= p.rMax;
  }

  // src/bundle_entry.ts
  var F03_SPIRAL = {
    family: "F03",
    init(rt, spec2, env) {
      const o = rt.handle * 8;
      const p = {
        r0: 16,
        b: 24,
        speed: spec2.motion.speed || 14,
        rMax: spec2.lifetime.rangePx || 360,
        maxDTheta: 0.22,
        ySquash: 0.5
      };
      spiralInit(env.state, o, rt.x, rt.y, rt.phi * DEG2RAD, 1, p);
    },
    update(rt, spec2, env) {
      const o = rt.handle * 8;
      const p = {
        r0: 16,
        b: 24,
        speed: spec2.motion.speed || 14,
        rMax: spec2.lifetime.rangePx || 360,
        maxDTheta: 0.22,
        ySquash: 0.5
      };
      const out = { x: 0, y: 0, phi: 0, done: false };
      spiralStep(env.state, o, p, out);
      rt.x = out.x;
      rt.y = out.y;
      rt.phi = normalizeDeg(out.phi * (180 / Math.PI));
      if (out.done) return StepOutcome.RANGE;
      return StepOutcome.CONTINUE;
    }
  };
  function createAllBehaviors() {
    const reg = createDefaultBehaviors();
    reg.register(F03_SPIRAL);
    return reg;
  }
  var MissileSystem = class {
    targets;
    manager;
    renderer = null;
    behaviors;
    specs;
    constructor(options = {}) {
      this.targets = new TargetRegistry();
      this.behaviors = createAllBehaviors();
      this.specs = options.specs || Object.values(OFFICIAL_D2_SPECS);
      this.manager = new MissileManager({
        specs: this.specs,
        targets: this.targets,
        capacity: options.capacity || 512,
        behaviors: this.behaviors,
        hooks: {
          onHit: (rt, spec2, targetId) => {
            if (options.onHit) {
              options.onHit(rt, spec2, targetId);
            }
          },
          onExplode: (rt, spec2) => {
            if (options.onExplode) {
              options.onExplode(rt, spec2);
            }
          },
          onExpire: (rt, spec2) => {
            if (options.onExpire) {
              options.onExpire(rt, spec2);
            }
          }
        }
      });
    }
    attachRenderer(ctx, resolve) {
      this.renderer = new MissileRenderer(ctx, this.manager, resolve);
      return this.renderer;
    }
    step() {
      this.manager.step();
      if (this.renderer) {
        this.renderer.tickAnimations();
      }
    }
    render(alpha) {
      if (this.renderer) {
        this.renderer.render(alpha);
      }
    }
  };
  return __toCommonJS(bundle_entry_exports);
})();

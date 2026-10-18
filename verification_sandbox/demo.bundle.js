"use strict";
(() => {
  // verification_sandbox/src/geometry.ts
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

  // verification_sandbox/src/targets.ts
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
    id;
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
    id;
    unit;
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

  // verification_sandbox/src/demo.ts
  var ROW_ANGLES = [
    [7, 0],
    // 東 (East)
    [14, 11.25],
    // 東微偏東南
    [3, 22.5],
    // 東南東
    [15, 45],
    // 東南 (South-East)
    [4, 90],
    // 南 (South)
    [8, 135],
    // 西南 (South-West)
    [0, 157.5],
    // 西南西
    [9, 170],
    // 西偏微南
    [5, 180],
    // 西 (West)
    [10, 192],
    // 西偏微北
    [1, 202.5],
    // 西北西
    [11, 225],
    // 西北 (North-West)
    [6, 270],
    // 北 (North)
    [12, 315],
    // 東北 (North-East)
    [2, 337.5],
    // 東北東
    [13, 348.75]
    // 東微偏東北
  ];
  function getDcc16Dir(screenAngleDeg) {
    const a = (screenAngleDeg % 360 + 360) % 360;
    let bestRow = 7;
    let bestDiff = 999;
    for (const [r, ra] of ROW_ANGLES) {
      const diff = Math.abs((ra - a + 180) % 360 - 180);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestRow = r;
      }
    }
    return bestRow;
  }
  var HYDRA_DIR8 = [
    [7, 0],
    // 東
    [3, 45],
    // 東南
    [4, 90],
    // 南
    [0, 135],
    // 西南
    [5, 180],
    // 西
    [1, 225],
    // 西北
    [6, 270],
    // 北
    [2, 315]
    // 東北
  ];
  function getHydra8Dir(screenAngleDeg) {
    const a = (screenAngleDeg % 360 + 360) % 360;
    let bestRow = 7;
    let bestDiff = 999;
    for (const [r, ra] of HYDRA_DIR8) {
      const diff = Math.abs((ra - a + 180) % 360 - 180);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestRow = r;
      }
    }
    return bestRow;
  }
  var HYDRA_FIRE_OFFSETS = [[-11, -6], [-10, -6], [-8, -6]];
  function getHydraConfig() {
    if (typeof window !== "undefined" && window.__hydraConfig__) return window.__hydraConfig__;
    return {
      heads: [
        { ox: -22, oy: -8 },
        // 蛇頭0（左後）
        { ox: 0, oy: 6 },
        // 蛇頭1（中央）
        { ox: 22, oy: -8 }
        // 蛇頭2（右後）
      ],
      fires: [
        { fox: -11, foy: -6 },
        // 火焰0
        { fox: -10, foy: -6 },
        // 火焰1
        { fox: -8, foy: -6 }
        // 火焰2
      ]
    };
  }
  var HYDRA_MOUTH_OFFSETS = {
    7: [36, -41],
    // 東 (Dir 7): 蛇頭向右甩，嘴巴咬合火花於 [+36, -41]
    3: [14, -22],
    // 東南 (Dir 3): 蛇頭前探微低，嘴巴咬合火花於 [+14, -22]
    4: [-22, -19],
    // 南 (Dir 4): 蛇頭正向低頭，嘴巴咬合火花於 [-22, -19]
    0: [-48, -38],
    // 西南 (Dir 0): 蛇頭左傾下探，嘴巴咬合火花於 [-48, -38]
    5: [-51, -45],
    // 西 (Dir 5): 蛇身左仰，嘴巴咬合火花於 [-51, -45]
    1: [-18, -58],
    // 西北 (Dir 1): 蛇頭高揚向左上，嘴巴咬合火花於 [-18, -58]
    6: [0, -60],
    // 北 (Dir 6): 蛇頭正向高聳向北，嘴巴咬合火花於 [0, -60]
    2: [26, -42]
    // 東北 (Dir 2): 蛇頭向右上揚，嘴巴咬合火花於 [+26, -42]
  };
  function loadImage(src) {
    const img = new Image();
    img.src = src;
    return img;
  }
  var atlases = {
    // 火彈: 118x70, pivot: (59, 35), 5 幀, 16 方向
    firebolt: {
      img: loadImage("assets/atlases/firebolt_norm.png"),
      cellW: 118,
      cellH: 70,
      pivotX: 59,
      pivotY: 35,
      frames: 5,
      dirs: 16
    },
    // 火球: 148x86, pivot: (74, 30), 5 幀, 16 方向
    fireball: {
      img: loadImage("assets/atlases/fireball_norm.png"),
      cellW: 148,
      cellH: 86,
      pivotX: 74,
      pivotY: 30,
      frames: 5,
      dirs: 16
    },
    // 火球專屬爆炸 (FireArrowExplode2): 80x72, pivot: (40, 36), 12 幀
    fireballExplode: {
      img: loadImage("assets/atlases/fireball_explode.png"),
      cellW: 80,
      cellH: 72,
      pivotX: 40,
      pivotY: 36,
      frames: 12,
      dirs: 1
    },
    // 地獄火: 78x78, pivot: (37, 40), 15 幀
    flamethrower: {
      img: loadImage("assets/atlases/flamethrower_norm.png"),
      cellW: 78,
      cellH: 78,
      pivotX: 37,
      pivotY: 40,
      frames: 15,
      dirs: 1
    },
    // 火牆 (firewall): 68x169, pivot: (34, 158), 37 幀
    groundfireBig: {
      img: loadImage("assets/atlases/groundfire_big.png"),
      cellW: 68,
      cellH: 169,
      pivotX: 34,
      pivotY: 158,
      frames: 37,
      dirs: 1
    },
    // 隕石地表殘火 (meteorfire / groundFireMedium): 68x138, pivot: (34, 127), 37 幀
    groundfireMed: {
      img: loadImage("assets/atlases/groundfire_med.png"),
      cellW: 68,
      cellH: 138,
      pivotX: 34,
      pivotY: 127,
      frames: 37,
      dirs: 1
    },
    // 隕石天降巨石本體: 24x26, 12 幀
    meteor: {
      img: loadImage("assets/atlases/meteor.png"),
      cellW: 24,
      cellH: 26,
      pivotX: 12,
      pivotY: 13,
      frames: 12,
      dirs: 1
    },
    // 隕石俯衝烈焰拖尾 (MeteorTail): 79x128, 12 幀, 高光核在 (47, 83)
    meteorTail: {
      img: loadImage("assets/atlases/meteor_tail.png"),
      cellW: 79,
      cellH: 128,
      pivotX: 47,
      pivotY: 83,
      frames: 12,
      dirs: 1
    },
    // 隕石落點預警紅圈: 114x76, pivot: (57, 45), 17 幀
    meteorIndicator: {
      img: loadImage("assets/atlases/meteor_indicator.png"),
      cellW: 114,
      cellH: 76,
      pivotX: 57,
      pivotY: 45,
      frames: 17,
      dirs: 1
    },
    // 隕石砸地巨轟 (ExpArrowExplode): 210x176, pivot: (109, 125), 16 幀
    meteorExplode: {
      img: loadImage("assets/atlases/meteor_explode.png"),
      cellW: 210,
      cellH: 176,
      pivotX: 109,
      pivotY: 125,
      frames: 16,
      dirs: 1
    },
    // 九頭海蛇待命 (NU): 66x84, pivot: (46, 77), 12 幀, 8 方向 (原廠 DCC 官方 Union-Box 原點)
    hydraNu: {
      img: loadImage("assets/atlases/hydra_nu.png"),
      cellW: 66,
      cellH: 84,
      pivotX: 46,
      pivotY: 77,
      frames: 12,
      dirs: 8
    },
    // 九頭海蛇攻擊甩頭 (A1): 111x88, pivot: (63, 79), 12 幀, 8 方向 (去除 S1 加法黑底殘留後精確尺寸)
    hydraA1: {
      img: loadImage("assets/atlases/hydra_a1.png"),
      cellW: 111,
      cellH: 88,
      pivotX: 63,
      pivotY: 79,
      frames: 12,
      dirs: 8
    },
    // 九頭海蛇地表常駐烈火 (HydraGroundFire): 65x92, pivot: (32, 71), 20 幀 (d2_proj_toolkit 原廠 Union-Box 基準線)
    hydraFire: {
      img: loadImage("assets/atlases/hydra_groundfire.png"),
      cellW: 65,
      cellH: 92,
      pivotX: 32,
      pivotY: 71,
      frames: 20,
      dirs: 1
    },
    // 九頭海蛇地表竄火召喚 (HydraGroundFireStart): 116x101, pivot: (59, 61), 16 幀 (d2_proj_toolkit 原廠 Union-Box 基準線)
    hydraFireStart: {
      img: loadImage("assets/atlases/hydra_groundfire_start.png"),
      cellW: 116,
      cellH: 101,
      pivotX: 59,
      pivotY: 61,
      frames: 16,
      dirs: 1
    },
    // 九頭海蛇地表滅火消散 (HydraGroundFireEnd): 62x83, pivot: (30, 63), 16 幀 (d2_proj_toolkit 原廠 Union-Box 基準線)
    hydraFireEnd: {
      img: loadImage("assets/atlases/hydra_groundfire_end.png"),
      cellW: 62,
      cellH: 83,
      pivotX: 30,
      pivotY: 63,
      frames: 16,
      dirs: 1
    }
  };
  var DemoTargetRegistry = class extends TargetRegistry {
    dummies = [];
    addDummy(x, y, team = 1) {
      const dummy = {
        id: 0,
        x,
        y,
        team,
        maxHp: 200,
        hp: 200,
        hitTime: 0,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.35,
        get alive() {
          return this.hp > 0;
        },
        isAlive: () => dummy.hp > 0
      };
      const reg = this.createUnit(dummy, 0, -18);
      dummy.id = reg.id;
      this.dummies.push(dummy);
      return dummy;
    }
    updateDummies() {
      const now = performance.now();
      for (const d of this.dummies) {
        if (d.hp <= 0) {
          if (now - d.hitTime > 3e3) {
            d.hp = d.maxHp;
          }
          continue;
        }
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 150 || d.x > 850) d.vx *= -1;
        if (d.y < 120 || d.y > 500) d.vy *= -1;
      }
    }
  };
  function startDemo() {
    const canvas = document.getElementById("demo-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const targets = new DemoTargetRegistry();
    targets.addDummy(280, 220);
    targets.addDummy(700, 200);
    targets.addDummy(750, 380);
    targets.addDummy(260, 420);
    targets.addDummy(500, 220);
    targets.addDummy(480, 450);
    const player = { x: 500, y: 340 };
    let currentSkill = 0;
    let isMouseDown = false;
    let mousePos = { x: 500, y: 340 };
    let debugEnabled = true;
    const missiles = [];
    const explosions = [];
    const infernoStreams = [];
    const firewallPillars = [];
    const meteorCalls = [];
    const hydras = [];
    const floatingTexts = [];
    function addDamageText(x, y, text, color = "#F59E0B") {
      if (!text.match(/^[-+0-9]/)) return;
      floatingTexts.push({ x: x + (Math.random() - 0.5) * 20, y: y - 20, text, alpha: 1, color });
    }
    function castFirebolt(tx, ty) {
      const sx = player.x;
      const sy = player.y - 32;
      const dx = tx - sx;
      const dy = ty - sy;
      const dist = Math.hypot(dx, dy) || 1;
      const phi = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      const dirRow = getDcc16Dir(phi);
      const speed = 20;
      missiles.push({
        type: "firebolt",
        x: sx + dx / dist * 20,
        y: sy + dy / dist * 20,
        vx: dx / dist * speed,
        vy: dy / dist * speed,
        phiDeg: phi,
        dirRow,
        life: 0,
        maxLife: 50,
        animFrame: 0,
        animTimer: 0
      });
    }
    function castFireball(tx, ty) {
      const sx = player.x;
      const sy = player.y - 32;
      const dx = tx - sx;
      const dy = ty - sy;
      const dist = Math.hypot(dx, dy) || 1;
      const phi = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      const dirRow = getDcc16Dir(phi);
      const speed = 20;
      missiles.push({
        type: "fireball",
        x: sx + dx / dist * 22,
        y: sy + dy / dist * 22,
        vx: dx / dist * speed,
        vy: dy / dist * speed,
        phiDeg: phi,
        dirRow,
        life: 0,
        maxLife: 50,
        animFrame: 0,
        animTimer: 0
      });
    }
    function emitInferno(tx, ty) {
      const hx = player.x;
      const hy = player.y - 32;
      const dx = tx - hx;
      const dy = ty - hy;
      const baseAngle = Math.atan2(dy, dx);
      for (let i = 0; i < 2; i++) {
        const spread = baseAngle + (Math.random() - 0.5) * 0.22;
        const spd = 12 + (Math.random() - 0.5) * 2;
        infernoStreams.push({
          x: hx + Math.cos(baseAngle) * 24,
          y: hy + Math.sin(baseAngle) * 24,
          vx: Math.cos(spread) * spd,
          vy: Math.sin(spread) * spd,
          life: 0,
          maxLife: 30,
          animFrame: 0
        });
      }
    }
    function castFirewall(tx, ty) {
      const dx = tx - player.x;
      const dy = ty - player.y;
      const angle = Math.atan2(dy, dx);
      const perp = angle + Math.PI / 2;
      const spacing = 38;
      for (let i = -3; i <= 3; i++) {
        const px = tx + Math.cos(perp) * (i * spacing);
        const py = ty + Math.sin(perp) * (i * spacing * 0.5);
        firewallPillars.push({
          x: px,
          y: py,
          life: 0,
          maxLife: 90,
          // 3.6 秒 (Missiles.txt firewall Range: 90)
          animFrame: Math.floor(Math.random() * 37),
          animTimer: 0,
          type: "big"
        });
      }
    }
    function castMeteor(tx, ty) {
      meteorCalls.push({
        targetX: tx,
        targetY: ty,
        tick: 0,
        exploded: false
      });
    }
    function castHydra(tx, ty) {
      const cfg = getHydraConfig();
      hydras.push({
        x: tx,
        y: ty,
        lifeTicks: 0,
        maxLifeTicks: 250,
        // 10 秒
        heads: [
          // 0: 左後蛇頭 (對應 HydraLoop1)
          { offsetX: cfg.heads[0].ox, offsetY: cfg.heads[0].oy, dir: 5, state: "idle", animFrame: 4, animTimer: 0, attackCooldown: 30 },
          // 1: 中央前蛇頭 (對應 HydraLoop2)
          { offsetX: cfg.heads[1].ox, offsetY: cfg.heads[1].oy, dir: 4, state: "idle", animFrame: 0, animTimer: 0, attackCooldown: 15 },
          // 2: 右後蛇頭 (對應 HydraLoop3)
          { offsetX: cfg.heads[2].ox, offsetY: cfg.heads[2].oy, dir: 3, state: "idle", animFrame: 8, animTimer: 0, attackCooldown: 45 }
        ]
      });
    }
    function castCurrentSkill(tx, ty) {
      if (currentSkill === 0) castFirebolt(tx, ty);
      else if (currentSkill === 1) castFireball(tx, ty);
      else if (currentSkill === 2) emitInferno(tx, ty);
      else if (currentSkill === 3) castFirewall(tx, ty);
      else if (currentSkill === 4) castMeteor(tx, ty);
      else if (currentSkill === 5) castHydra(tx, ty);
    }
    let lastTime = performance.now();
    let accumulator = 0;
    const TICK_MS = 40;
    function logicTick() {
      targets.updateDummies();
      if (isMouseDown && currentSkill === 2) {
        emitInferno(mousePos.x, mousePos.y);
      }
      for (let i = missiles.length - 1; i >= 0; i--) {
        const m = missiles[i];
        m.x += m.vx;
        m.y += m.vy;
        m.life++;
        m.animTimer++;
        if (m.animTimer >= 2) {
          m.animTimer = 0;
          m.animFrame = (m.animFrame + 1) % 5;
        }
        let hit = false;
        for (const d of targets.dummies) {
          if (d.hp <= 0) continue;
          const dist = Math.hypot(d.x - m.x, (d.y - 18 - m.y) * 2);
          if (dist <= 26) {
            hit = true;
            if (m.type === "fireball") {
              for (const near of targets.dummies) {
                if (near.hp <= 0) continue;
                const dNear = Math.hypot(near.x - m.x, (near.y - 18 - m.y) * 2);
                if (dNear <= 80) {
                  near.hp = Math.max(0, near.hp - 65);
                  near.hitTime = performance.now();
                  addDamageText(near.x, near.y - 20, "-65", "#EF4444");
                }
              }
              explosions.push({
                type: "fireball",
                x: m.x,
                y: m.y,
                animFrame: 0,
                maxFrames: 12,
                frameTimer: 0
              });
            } else {
              d.hp = Math.max(0, d.hp - 35);
              d.hitTime = performance.now();
              addDamageText(d.x, d.y - 20, "-35", "#F59E0B");
            }
            break;
          }
        }
        if (hit || m.life >= m.maxLife) {
          missiles.splice(i, 1);
        }
      }
      for (let i = infernoStreams.length - 1; i >= 0; i--) {
        const inf = infernoStreams[i];
        inf.life++;
        inf.x += inf.vx;
        inf.y += inf.vy;
        inf.animFrame = Math.min(14, Math.floor(inf.life / inf.maxLife * 15));
        for (const d of targets.dummies) {
          if (d.hp <= 0) continue;
          const dist = Math.hypot(d.x - inf.x, (d.y - 18 - inf.y) * 2);
          if (dist <= 28) {
            d.hp = Math.max(0, d.hp - 4);
            d.hitTime = performance.now();
            if (Math.random() < 0.25) addDamageText(d.x, d.y - 20, "-8", "#F97316");
          }
        }
        if (inf.life >= inf.maxLife) {
          infernoStreams.splice(i, 1);
        }
      }
      for (let i = firewallPillars.length - 1; i >= 0; i--) {
        const fp = firewallPillars[i];
        fp.life++;
        fp.animTimer++;
        if (fp.animTimer >= 1) {
          fp.animTimer = 0;
          fp.animFrame = (fp.animFrame + 1) % 37;
        }
        for (const d of targets.dummies) {
          if (d.hp <= 0) continue;
          const dist = Math.hypot(d.x - fp.x, (d.y - fp.y) * 2);
          if (dist <= 35) {
            d.hp = Math.max(0, d.hp - 3);
            d.hitTime = performance.now();
            if (Math.random() < 0.15) addDamageText(d.x, d.y - 20, "-15", "#EA580C");
          }
        }
        if (fp.life >= fp.maxLife) {
          firewallPillars.splice(i, 1);
        }
      }
      for (let i = meteorCalls.length - 1; i >= 0; i--) {
        const mc = meteorCalls[i];
        mc.tick++;
        if (mc.tick === 42 && !mc.exploded) {
          mc.exploded = true;
          explosions.push({
            type: "meteor",
            x: mc.targetX,
            y: mc.targetY,
            animFrame: 0,
            maxFrames: 16,
            frameTimer: 0
          });
          for (const d of targets.dummies) {
            if (d.hp <= 0) continue;
            const dist = Math.hypot(d.x - mc.targetX, (d.y - 18 - mc.targetY) * 2);
            if (dist <= 120) {
              d.hp = Math.max(0, d.hp - 120);
              d.hitTime = performance.now();
              addDamageText(d.x, d.y - 25, "-120", "#DC2626");
            }
          }
          for (let j = 0; j < 5; j++) {
            const ox = (Math.random() - 0.5) * 50;
            const oy = (Math.random() - 0.5) * 25;
            firewallPillars.push({
              x: mc.targetX + ox,
              y: mc.targetY + oy,
              life: 0,
              maxLife: 90,
              animFrame: Math.floor(Math.random() * 37),
              animTimer: 0,
              type: "med"
            });
          }
        }
        if (mc.tick > 60) {
          meteorCalls.splice(i, 1);
        }
      }
      for (let i = hydras.length - 1; i >= 0; i--) {
        const hydra = hydras[i];
        hydra.lifeTicks++;
        for (const head of hydra.heads) {
          const hx = hydra.x + head.offsetX;
          const hy = hydra.y + head.offsetY;
          let nearest = null;
          let minDist = 500;
          for (const d of targets.dummies) {
            if (d.hp <= 0) continue;
            const dist = Math.hypot(d.x - hx, (d.y - 18 - hy) * 2);
            if (dist < minDist) {
              minDist = dist;
              nearest = d;
            }
          }
          if (nearest) {
            const dx = nearest.x - hx;
            const dy = nearest.y - 18 - hy;
            const angleDeg = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
            head.dir = getHydra8Dir(angleDeg);
          }
          head.animTimer++;
          if (head.animTimer >= 2) {
            head.animTimer = 0;
            head.animFrame++;
            if (head.state === "attack") {
              if (head.animFrame === 8 && nearest) {
                const [mxOff, myOff] = HYDRA_MOUTH_OFFSETS[head.dir] || [0, -40];
                const mx = hx + mxOff;
                const my = hy + myOff;
                const mdx = nearest.x - mx;
                const mdy = nearest.y - 18 - my;
                const mdist = Math.hypot(mdx, mdy) || 1;
                const boltPhi = (Math.atan2(mdy, mdx) * 180 / Math.PI + 360) % 360;
                const boltDir = getDcc16Dir(boltPhi);
                const boltSpeed = 14;
                const forwardPush = 4;
                missiles.push({
                  type: "firebolt",
                  x: mx + mdx / mdist * forwardPush,
                  y: my + mdy / mdist * forwardPush,
                  vx: mdx / mdist * boltSpeed,
                  vy: mdy / mdist * boltSpeed,
                  phiDeg: boltPhi,
                  dirRow: boltDir,
                  life: 0,
                  maxLife: 30,
                  // 依據 d2_reference_tables Missiles.txt: hydra (Id: 247) Range: 30
                  animFrame: 0,
                  animTimer: 0
                });
              }
              if (head.animFrame >= 12) {
                head.state = "idle";
                head.animFrame = 0;
              }
            } else {
              head.animFrame = head.animFrame % 12;
            }
          }
          head.attackCooldown--;
          if (head.attackCooldown <= 0 && nearest && head.state === "idle") {
            head.state = "attack";
            head.animFrame = 0;
            head.animTimer = 0;
            head.attackCooldown = 55 + Math.floor(Math.random() * 20);
          }
        }
        if (hydra.lifeTicks >= hydra.maxLifeTicks) {
          hydras.splice(i, 1);
        }
      }
      for (let i = explosions.length - 1; i >= 0; i--) {
        const exp = explosions[i];
        exp.frameTimer++;
        if (exp.frameTimer >= 2) {
          exp.frameTimer = 0;
          exp.animFrame++;
          if (exp.animFrame >= exp.maxFrames) {
            explosions.splice(i, 1);
          }
        }
      }
      for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y -= 0.8;
        ft.alpha -= 0.025;
        if (ft.alpha <= 0) floatingTexts.splice(i, 1);
      }
    }
    function render() {
      ctx.fillStyle = "#060709";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
      ctx.lineWidth = 1;
      for (let x = -800; x < 1800; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 1200, 600);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - 1200, 600);
        ctx.stroke();
      }
      for (const mc of meteorCalls) {
        if (mc.tick < 42) {
          const at = atlases.meteorIndicator;
          const frameIdx = mc.tick % at.frames;
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = 0.85;
          ctx.drawImage(
            at.img,
            frameIdx * at.cellW,
            0,
            at.cellW,
            at.cellH,
            mc.targetX - at.pivotX,
            mc.targetY - at.pivotY,
            at.cellW,
            at.cellH
          );
          ctx.restore();
        }
      }
      for (const fp of firewallPillars) {
        const at = fp.type === "med" ? atlases.groundfireMed : atlases.groundfireBig;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.drawImage(
          at.img,
          fp.animFrame * at.cellW,
          0,
          at.cellW,
          at.cellH,
          fp.x - at.pivotX,
          fp.y - at.pivotY,
          at.cellW,
          at.cellH
        );
        ctx.restore();
        if (debugEnabled) {
          ctx.save();
          ctx.strokeStyle = "rgba(249, 115, 22, 0.5)";
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.ellipse(fp.x, fp.y, 35, 17.5, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
      for (const hydra of hydras) {
        const indexed = hydra.heads.map((h, i) => ({ h, i }));
        indexed.sort((a, b) => a.h.offsetY - b.h.offsetY);
        for (const { h: head, i: headIdx } of indexed) {
          const hx = hydra.x + head.offsetX;
          const hy = hydra.y + head.offsetY;
          const fireCfg = getHydraConfig().fires[headIdx] ?? { fox: HYDRA_FIRE_OFFSETS[headIdx][0], foy: HYDRA_FIRE_OFFSETS[headIdx][1] };
          const fox = fireCfg.fox;
          const foy = fireCfg.foy;
          const fx = hx + fox;
          const fy = hy + foy;
          let fat = atlases.hydraFire;
          let ff = 0;
          const endStart = hydra.maxLifeTicks - 16 * 25 / 16;
          const startTicks = Math.ceil(16 * 25 / 16);
          if (hydra.lifeTicks < startTicks) {
            fat = atlases.hydraFireStart;
            ff = Math.min(15, Math.floor(hydra.lifeTicks * 16 / 25));
          } else if (hydra.lifeTicks >= endStart) {
            fat = atlases.hydraFireEnd;
            ff = Math.min(15, Math.floor((hydra.lifeTicks - endStart) * 16 / 25));
          } else {
            ff = (Math.floor(hydra.lifeTicks * 16 / 25) + headIdx * 7) % fat.frames;
          }
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = 0.45;
          ctx.drawImage(
            fat.img,
            ff * fat.cellW,
            0,
            fat.cellW,
            fat.cellH,
            fx - fat.pivotX,
            fy - fat.pivotY,
            fat.cellW,
            fat.cellH
          );
          ctx.restore();
          const at = head.state === "attack" ? atlases.hydraA1 : atlases.hydraNu;
          const frameIdx = head.animFrame % at.frames;
          ctx.drawImage(
            at.img,
            frameIdx * at.cellW,
            head.dir * at.cellH,
            at.cellW,
            at.cellH,
            hx - at.pivotX,
            hy - at.pivotY,
            at.cellW,
            at.cellH
          );
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = 0.95;
          ctx.drawImage(
            fat.img,
            ff * fat.cellW,
            0,
            fat.cellW,
            fat.cellH,
            fx - fat.pivotX,
            fy - fat.pivotY,
            fat.cellW,
            fat.cellH
          );
          ctx.restore();
          if (debugEnabled) {
            ctx.strokeStyle = "#00FF00";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(hx - 6, hy);
            ctx.lineTo(hx + 6, hy);
            ctx.moveTo(hx, hy - 6);
            ctx.lineTo(hx, hy + 6);
            ctx.stroke();
            ctx.strokeStyle = "#FF8C00";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(fx - 5, fy - 5);
            ctx.lineTo(fx + 5, fy + 5);
            ctx.moveTo(fx + 5, fy - 5);
            ctx.lineTo(fx - 5, fy + 5);
            ctx.stroke();
            const [mxOff, myOff] = HYDRA_MOUTH_OFFSETS[head.dir] || [0, -40];
            const mouthX = hx + mxOff;
            const mouthY = hy + myOff;
            let nearestDummy = null;
            let minDist = 450;
            for (const d of targets.dummies) {
              if (d.hp <= 0) continue;
              const dist = Math.hypot(d.x - hx, d.y - 18 - hy);
              if (dist < minDist) {
                minDist = dist;
                nearestDummy = d;
              }
            }
            ctx.save();
            ctx.fillStyle = "#F59E0B";
            ctx.beginPath();
            ctx.arc(mouthX, mouthY, 2.5, 0, Math.PI * 2);
            ctx.fill();
            if (nearestDummy) {
              ctx.setLineDash([2, 3]);
              ctx.strokeStyle = "rgba(245, 158, 11, 0.7)";
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(mouthX, mouthY);
              ctx.lineTo(nearestDummy.x, nearestDummy.y - 18);
              ctx.stroke();
            }
            ctx.restore();
          }
        }
      }
      const now = performance.now();
      for (const d of targets.dummies) {
        const isHit = now - d.hitTime < 120;
        const isDead = d.hp <= 0;
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, 20, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = isDead ? "#4B5563" : isHit ? "#F87171" : "#E2E8F0";
        ctx.beginPath();
        ctx.arc(d.x, d.y - 18, 14, 0, Math.PI * 2);
        ctx.fill();
        if (debugEnabled && !isDead) {
          ctx.save();
          ctx.strokeStyle = "#22C55E";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(d.x, d.y - 18, 24, 12, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = "#86EFAC";
          ctx.beginPath();
          ctx.moveTo(d.x - 5, d.y - 18);
          ctx.lineTo(d.x + 5, d.y - 18);
          ctx.moveTo(d.x, d.y - 23);
          ctx.lineTo(d.x, d.y - 13);
          ctx.stroke();
          ctx.fillStyle = "#4ADE80";
          ctx.font = "9px monospace";
          ctx.fillText(`Center Y-18`, d.x, d.y - 32);
          ctx.restore();
        }
        const barW = 36;
        const bx = d.x - barW / 2;
        const by = d.y - 42;
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(bx, by, barW, 5);
        ctx.fillStyle = isDead ? "#6B7280" : "#EF4444";
        ctx.fillRect(bx, by, d.hp / d.maxHp * barW, 5);
        ctx.fillStyle = "#94A3B8";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`Target #${d.id} [${d.hp}/100]`, d.x, d.y + 14);
      }
      ctx.fillStyle = "rgba(234, 88, 12, 0.3)";
      ctx.beginPath();
      ctx.ellipse(player.x, player.y, 28, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#F97316";
      ctx.beginPath();
      ctx.arc(player.x, player.y - 14, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#FEF08A";
      ctx.lineWidth = 2;
      ctx.stroke();
      const mAngle = Math.atan2(mousePos.y - (player.y - 32), mousePos.x - player.x);
      ctx.strokeStyle = "#FDE047";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - 32);
      ctx.lineTo(player.x + Math.cos(mAngle) * 22, player.y - 32 + Math.sin(mAngle) * 22);
      ctx.stroke();
      if (debugEnabled) {
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "rgba(253, 224, 71, 0.5)";
        ctx.beginPath();
        ctx.moveTo(player.x, player.y - 32);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.stroke();
        ctx.restore();
      }
      for (const m of missiles) {
        const at = m.type === "firebolt" ? atlases.firebolt : atlases.fireball;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.drawImage(
          at.img,
          m.animFrame * at.cellW,
          m.dirRow * at.cellH,
          at.cellW,
          at.cellH,
          m.x - at.pivotX,
          m.y - at.pivotY,
          at.cellW,
          at.cellH
        );
        ctx.restore();
        if (debugEnabled) {
          ctx.save();
          ctx.strokeStyle = "#06B6D4";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(m.x, m.y, 16, 8, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.moveTo(m.x - 3, m.y);
          ctx.lineTo(m.x + 3, m.y);
          ctx.moveTo(m.x, m.y - 3);
          ctx.lineTo(m.x, m.y + 3);
          ctx.stroke();
          ctx.strokeStyle = "#FACC15";
          ctx.lineWidth = 2;
          const vLen = Math.hypot(m.vx, m.vy) || 1;
          const ax = m.x + m.vx / vLen * 26;
          const ay = m.y + m.vy / vLen * 26;
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(ax, ay);
          ctx.stroke();
          for (const d of targets.dummies) {
            if (d.hp <= 0) continue;
            const dx = d.x - m.x;
            const dy = d.y - 18 - m.y;
            const dot = dx * m.vx + dy * m.vy;
            if (dot > 0 && Math.hypot(dx, dy) < 400) {
              ctx.setLineDash([4, 4]);
              ctx.strokeStyle = "rgba(236, 72, 153, 0.7)";
              ctx.beginPath();
              ctx.moveTo(m.x, m.y);
              ctx.lineTo(d.x, d.y - 18);
              ctx.stroke();
              ctx.setLineDash([]);
              break;
            }
          }
          ctx.restore();
        }
      }
      for (const inf of infernoStreams) {
        const at = atlases.flamethrower;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.drawImage(
          at.img,
          inf.animFrame * at.cellW,
          0,
          at.cellW,
          at.cellH,
          inf.x - at.pivotX,
          inf.y - at.pivotY,
          at.cellW,
          at.cellH
        );
        ctx.restore();
        if (debugEnabled && Math.random() < 0.2) {
          ctx.save();
          ctx.strokeStyle = "rgba(249, 115, 22, 0.6)";
          ctx.beginPath();
          ctx.ellipse(inf.x, inf.y, 14, 7, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
      for (const mc of meteorCalls) {
        if (debugEnabled) {
          ctx.save();
          ctx.strokeStyle = "rgba(239, 68, 68, 0.8)";
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(mc.targetX, mc.targetY, 80, 40, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        if (mc.tick >= 25 && mc.tick < 42) {
          const atRock = atlases.meteor;
          const atTail = atlases.meteorTail;
          const progress = (mc.tick - 25) / (42 - 25);
          const startX = mc.targetX - 160;
          const startY = mc.targetY - 280;
          const curX = startX + (mc.targetX - startX) * progress;
          const curY = startY + (mc.targetY - startY) * progress;
          const frameIdx = (mc.tick - 25) % 12;
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.drawImage(
            atTail.img,
            frameIdx * atTail.cellW,
            0,
            atTail.cellW,
            atTail.cellH,
            curX - atTail.pivotX,
            curY - atTail.pivotY,
            atTail.cellW,
            atTail.cellH
          );
          ctx.drawImage(
            atRock.img,
            frameIdx * atRock.cellW,
            0,
            atRock.cellW,
            atRock.cellH,
            curX - atRock.pivotX,
            curY - atRock.pivotY,
            atRock.cellW,
            atRock.cellH
          );
          ctx.restore();
          if (debugEnabled) {
            ctx.save();
            ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(mc.targetX, mc.targetY);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
      for (const exp of explosions) {
        const at = exp.type === "fireball" ? atlases.fireballExplode : atlases.meteorExplode;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.drawImage(
          at.img,
          exp.animFrame * at.cellW,
          0,
          at.cellW,
          at.cellH,
          exp.x - at.pivotX,
          exp.y - at.pivotY,
          at.cellW,
          at.cellH
        );
        ctx.restore();
        if (debugEnabled) {
          ctx.save();
          ctx.strokeStyle = exp.type === "fireball" ? "#F59E0B" : "#EF4444";
          ctx.lineWidth = 1;
          ctx.beginPath();
          const r = exp.type === "fireball" ? 40 : 80;
          ctx.ellipse(exp.x, exp.y, r, r * 0.5, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
      for (const ft of floatingTexts) {
        ctx.save();
        ctx.globalAlpha = ft.alpha;
        ctx.fillStyle = ft.color;
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.shadowColor = "#000000";
        ctx.shadowBlur = 4;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }
      if (debugEnabled) {
        ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
        ctx.fillRect(10, 10, 280, 126);
        ctx.strokeStyle = "#38BDF8";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(10, 10, 280, 126);
        ctx.fillStyle = "#F59E0B";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText("DIABLO II \u7D14\u706B\u9AD4\u7CFB\u539F\u5EE0\u52D5\u614B\u6C99\u76D2", 20, 28);
        ctx.fillStyle = "#38BDF8";
        ctx.font = "10px sans-serif";
        ctx.fillText("\u3010\u8996\u89BA\u9664\u932F\u5DF2\u958B\u555F - \u5F48\u9053 / \u78B0\u649E\u5708 / \u8EC0\u5E79\u4E2D\u5FC3\u3011", 20, 44);
        ctx.fillStyle = "#E2E8F0";
        ctx.font = "11px monospace";
        ctx.fillText(`\u7576\u524D\u62DB\u5F0F: [${currentSkill + 1}] ${["\u706B\u5F48", "\u706B\u7403", "\u5730\u7344\u706B", "\u706B\u7246", "\u9695\u77F3", "\u4E5D\u982D\u86C7"][currentSkill]}`, 20, 64);
        ctx.fillText(`\u98DB\u884C\u98DB\u5F48\u6578: ${missiles.length} | \u6D3B\u8E8D\u706B\u67F1: ${firewallPillars.length}`, 20, 82);
        ctx.fillText(`\u6D3B\u8E8D\u6D77\u86C7\u6578: ${hydras.length} | \u5674\u6D41\u7C92\u5B50: ${infernoStreams.length}`, 20, 100);
        ctx.fillText(`FPS: 60 (25Hz \u7269\u7406\u9396\u983B) | \u6309 [D] \u9375\u53EF\u96B1\u85CF`, 20, 118);
      }
    }
    function loop(now) {
      const elapsed = now - lastTime;
      lastTime = now;
      accumulator += elapsed;
      while (accumulator >= TICK_MS) {
        logicTick();
        accumulator -= TICK_MS;
      }
      render();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame((t) => {
      lastTime = t;
      loop(t);
    });
    window.addEventListener("keydown", (e) => {
      let skillNum = -1;
      if (e.key >= "1" && e.key <= "6") {
        skillNum = parseInt(e.key, 10);
      } else if (e.code && e.code.startsWith("Digit") && e.code[5] >= "1" && e.code[5] <= "6") {
        skillNum = parseInt(e.code[5], 10);
      } else if (e.code && e.code.startsWith("Numpad") && e.code[6] >= "1" && e.code[6] <= "6") {
        skillNum = parseInt(e.code[6], 10);
      }
      if (skillNum !== -1) {
        currentSkill = skillNum - 1;
        updateToolbarUI();
        if (currentSkill === 5 && hydras.length === 0) {
          castHydra(canvas.width / 2, canvas.height / 2);
        }
      } else if (e.key === "d" || e.key === "D") {
        debugEnabled = !debugEnabled;
        updateToolbarUI();
      } else if (e.key === "p" || e.key === "P") {
        const btn = document.getElementById("btn-toggle-panel");
        if (btn) btn.click();
      }
    });
    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      mousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    });
    canvas.addEventListener("mousedown", (e) => {
      isMouseDown = true;
      const rect = canvas.getBoundingClientRect();
      const tx = e.clientX - rect.left;
      const ty = e.clientY - rect.top;
      castCurrentSkill(tx, ty);
    });
    window.addEventListener("mouseup", () => {
      isMouseDown = false;
    });
    function updateToolbarUI() {
      for (let i = 0; i < 6; i++) {
        const btn = document.getElementById(`btn-skill-${i}`);
        if (btn) {
          if (i === currentSkill) btn.classList.add("active");
          else btn.classList.remove("active");
        }
      }
      const btnDebug = document.getElementById("btn-toggle-debug");
      if (btnDebug) {
        if (debugEnabled) btnDebug.classList.add("active");
        else btnDebug.classList.remove("active");
      }
    }
    for (let i = 0; i < 6; i++) {
      const btn = document.getElementById(`btn-skill-${i}`);
      if (btn) {
        btn.addEventListener("click", () => {
          currentSkill = i;
          updateToolbarUI();
          if (currentSkill === 5 && hydras.length === 0) {
            castHydra(canvas.width / 2, canvas.height / 2);
          }
        });
      }
    }
    const btnToggleDebug = document.getElementById("btn-toggle-debug");
    if (btnToggleDebug) {
      btnToggleDebug.addEventListener("click", () => {
        debugEnabled = !debugEnabled;
        updateToolbarUI();
      });
    }
    updateToolbarUI();
    window.castSandboxSkill = (skillIdx, tx, ty) => {
      const idx = typeof skillIdx === "string" ? parseInt(skillIdx, 10) : skillIdx;
      currentSkill = isNaN(idx) ? 0 : idx;
      updateToolbarUI();
      castCurrentSkill(tx, ty);
    };
    window.getHydras = () => hydras;
  }
  if (typeof window !== "undefined") {
    if (document.readyState === "loading") {
      window.addEventListener("DOMContentLoaded", () => {
        startDemo();
      });
    } else {
      startDemo();
    }
  }
})();

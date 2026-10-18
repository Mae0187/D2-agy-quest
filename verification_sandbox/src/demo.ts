// demo.ts — 魔法使【純火體系】原廠 MPQ 技能實機動態播放沙盒 (純真理源精準校準版)
import { DEG2RAD, normalizeDeg } from './geometry.js';
import { TargetRegistry, type TargetUnit } from './targets.js';

// ───────── 原廠 16 方向與 8 方向精準方位角映射 ─────────

const ROW_ANGLES: [number, number][] = [
  [7, 0.0],     // 東 (East)
  [14, 11.25],  // 東微偏東南
  [3, 22.5],    // 東南東
  [15, 45.0],   // 東南 (South-East)
  [4, 90.0],    // 南 (South)
  [8, 135.0],   // 西南 (South-West)
  [0, 157.5],   // 西南西
  [9, 170.0],   // 西偏微南
  [5, 180.0],   // 西 (West)
  [10, 192.0],  // 西偏微北
  [1, 202.5],   // 西北西
  [11, 225.0],  // 西北 (North-West)
  [6, 270.0],   // 北 (North)
  [12, 315.0],  // 東北 (North-East)
  [2, 337.5],   // 東北東
  [13, 348.75], // 東微偏東北
];

export function getDcc16Dir(screenAngleDeg: number): number {
  const a = ((screenAngleDeg % 360) + 360) % 360;
  let bestRow = 7;
  let bestDiff = 999;
  for (const [r, ra] of ROW_ANGLES) {
    const diff = Math.abs(((ra - a + 180) % 360) - 180);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestRow = r;
    }
  }
  return bestRow;
}

// 九頭海蛇 8 方向原廠 DCC 行順序 [0:SW, 1:NW, 2:NE, 3:SE, 4:S, 5:W, 6:N, 7:E]
const HYDRA_DIR8: [number, number][] = [
  [7, 0.0],   // 東
  [3, 45.0],  // 東南
  [4, 90.0],  // 南
  [0, 135.0], // 西南
  [5, 180.0], // 西
  [1, 225.0], // 西北
  [6, 270.0], // 北
  [2, 315.0], // 東北
];

export function getHydra8Dir(screenAngleDeg: number): number {
  const a = ((screenAngleDeg % 360) + 360) % 360;
  let bestRow = 7;
  let bestDiff = 999;
  for (const [r, ra] of HYDRA_DIR8) {
    const diff = Math.abs(((ra - a + 180) % 360) - 180);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestRow = r;
    }
  }
  return bestRow;
}

// 使用者視覺精準校準數據：每顆蛇頭腳下各一團火的偏移 (Xoffset, Yoffset)
// 確保地表火舌中心點恰好位於每條火蛇接地點下方一點點
const HYDRA_FIRE_OFFSETS: [number, number][] = [[-11, -6], [-10, -6], [-8, -6]];

// ── 即時調整介面橋接 (透過 window.__hydraConfig__ 與 sandbox.html 面板溝通) ──
declare const window: Window & {
  __hydraConfig__?: {
    heads: { ox: number; oy: number }[];    // 三個蛇頭相對召喚點偏移
    fires: { fox: number; foy: number }[];  // 三個火焰相對蛇身底部偏移
  };
};
function getHydraConfig() {
  if (typeof window !== 'undefined' && window.__hydraConfig__) return window.__hydraConfig__;
  return {
    heads: [
      { ox: -22, oy: -8 },  // 蛇頭0（左後）
      { ox:   0, oy:  6 },  // 蛇頭1（中央）
      { ox:  22, oy: -8 },  // 蛇頭2（右後）
    ],
    fires: [
      { fox: -11, foy: -6 },  // 火焰0
      { fox: -10, foy: -6 },  // 火焰1
      { fox:  -8, foy: -6 },  // 火焰2
    ],
  };
}

// 原廠 8 方向真嘴巴開口座標 (相對於官方 Union-Box 基準點 pivotX: 65, pivotY: 82)：
// 嚴格對齊蛇頭張嘴咬合點與上下顎正中央，杜絕從頭頂天花板或後頸射出
const HYDRA_MOUTH_OFFSETS: Record<number, [number, number]> = {
  7: [36, -41],  // 東 (Dir 7): 蛇頭向右甩，嘴巴咬合火花於 [+36, -41]
  3: [14, -22],  // 東南 (Dir 3): 蛇頭前探微低，嘴巴咬合火花於 [+14, -22]
  4: [-22, -19], // 南 (Dir 4): 蛇頭正向低頭，嘴巴咬合火花於 [-22, -19]
  0: [-48, -38], // 西南 (Dir 0): 蛇頭左傾下探，嘴巴咬合火花於 [-48, -38]
  5: [-51, -45], // 西 (Dir 5): 蛇身左仰，嘴巴咬合火花於 [-51, -45]
  1: [-18, -58], // 西北 (Dir 1): 蛇頭高揚向左上，嘴巴咬合火花於 [-18, -58]
  6: [0, -60],   // 北 (Dir 6): 蛇頭正向高聳向北，嘴巴咬合火花於 [0, -60]
  2: [26, -42],  // 東北 (Dir 2): 蛇頭向右上揚，嘴巴咬合火花於 [+26, -42]
};

// ───────── 載入原廠圖集資產 ─────────

function loadImage(src: string): HTMLImageElement {
  const img = new Image();
  img.src = src;
  return img;
}

const atlases = {
  // 火彈: 118x70, pivot: (59, 35), 5 幀, 16 方向
  firebolt: {
    img: loadImage('assets/atlases/firebolt_norm.png'),
    cellW: 118, cellH: 70, pivotX: 59, pivotY: 35, frames: 5, dirs: 16
  },
  // 火球: 148x86, pivot: (74, 30), 5 幀, 16 方向
  fireball: {
    img: loadImage('assets/atlases/fireball_norm.png'),
    cellW: 148, cellH: 86, pivotX: 74, pivotY: 30, frames: 5, dirs: 16
  },
  // 火球專屬爆炸 (FireArrowExplode2): 80x72, pivot: (40, 36), 12 幀
  fireballExplode: {
    img: loadImage('assets/atlases/fireball_explode.png'),
    cellW: 80, cellH: 72, pivotX: 40, pivotY: 36, frames: 12, dirs: 1
  },
  // 地獄火: 78x78, pivot: (37, 40), 15 幀
  flamethrower: {
    img: loadImage('assets/atlases/flamethrower_norm.png'),
    cellW: 78, cellH: 78, pivotX: 37, pivotY: 40, frames: 15, dirs: 1
  },
  // 火牆 (firewall): 68x169, pivot: (34, 158), 37 幀
  groundfireBig: {
    img: loadImage('assets/atlases/groundfire_big.png'),
    cellW: 68, cellH: 169, pivotX: 34, pivotY: 158, frames: 37, dirs: 1
  },
  // 隕石地表殘火 (meteorfire / groundFireMedium): 68x138, pivot: (34, 127), 37 幀
  groundfireMed: {
    img: loadImage('assets/atlases/groundfire_med.png'),
    cellW: 68, cellH: 138, pivotX: 34, pivotY: 127, frames: 37, dirs: 1
  },
  // 隕石天降巨石本體: 24x26, 12 幀
  meteor: {
    img: loadImage('assets/atlases/meteor.png'),
    cellW: 24, cellH: 26, pivotX: 12, pivotY: 13, frames: 12, dirs: 1
  },
  // 隕石俯衝烈焰拖尾 (MeteorTail): 79x128, 12 幀, 高光核在 (47, 83)
  meteorTail: {
    img: loadImage('assets/atlases/meteor_tail.png'),
    cellW: 79, cellH: 128, pivotX: 47, pivotY: 83, frames: 12, dirs: 1
  },
  // 隕石落點預警紅圈: 114x76, pivot: (57, 45), 17 幀
  meteorIndicator: {
    img: loadImage('assets/atlases/meteor_indicator.png'),
    cellW: 114, cellH: 76, pivotX: 57, pivotY: 45, frames: 17, dirs: 1
  },
  // 隕石砸地巨轟 (ExpArrowExplode): 210x176, pivot: (109, 125), 16 幀
  meteorExplode: {
    img: loadImage('assets/atlases/meteor_explode.png'),
    cellW: 210, cellH: 176, pivotX: 109, pivotY: 125, frames: 16, dirs: 1
  },
  // 九頭海蛇待命 (NU): 66x84, pivot: (46, 77), 12 幀, 8 方向 (原廠 DCC 官方 Union-Box 原點)
  hydraNu: {
    img: loadImage('assets/atlases/hydra_nu.png'),
    cellW: 66, cellH: 84, pivotX: 46, pivotY: 77, frames: 12, dirs: 8
  },
  // 九頭海蛇攻擊甩頭 (A1): 111x88, pivot: (63, 79), 12 幀, 8 方向 (去除 S1 加法黑底殘留後精確尺寸)
  hydraA1: {
    img: loadImage('assets/atlases/hydra_a1.png'),
    cellW: 111, cellH: 88, pivotX: 63, pivotY: 79, frames: 12, dirs: 8
  },
  // 九頭海蛇地表常駐烈火 (HydraGroundFire): 65x92, pivot: (32, 71), 20 幀 (d2_proj_toolkit 原廠 Union-Box 基準線)
  hydraFire: {
    img: loadImage('assets/atlases/hydra_groundfire.png'),
    cellW: 65, cellH: 92, pivotX: 32, pivotY: 71, frames: 20, dirs: 1
  },
  // 九頭海蛇地表竄火召喚 (HydraGroundFireStart): 116x101, pivot: (59, 61), 16 幀 (d2_proj_toolkit 原廠 Union-Box 基準線)
  hydraFireStart: {
    img: loadImage('assets/atlases/hydra_groundfire_start.png'),
    cellW: 116, cellH: 101, pivotX: 59, pivotY: 61, frames: 16, dirs: 1
  },
  // 九頭海蛇地表滅火消散 (HydraGroundFireEnd): 62x83, pivot: (30, 63), 16 幀 (d2_proj_toolkit 原廠 Union-Box 基準線)
  hydraFireEnd: {
    img: loadImage('assets/atlases/hydra_groundfire_end.png'),
    cellW: 62, cellH: 83, pivotX: 30, pivotY: 63, frames: 16, dirs: 1
  },
};

// ───────── 訓練假人目標 ─────────

interface DummyTarget extends TargetUnit {
  maxHp: number;
  hp: number;
  hitTime: number;
  vx: number;
  vy: number;
  alive: boolean;
}

class DemoTargetRegistry extends TargetRegistry {
  public dummies: DummyTarget[] = [];

  addDummy(x: number, y: number, team = 1): DummyTarget {
    const dummy: DummyTarget = {
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
      isAlive: () => dummy.hp > 0,
    };
    const reg = this.createUnit(dummy, 0, -18);
    dummy.id = reg.id;
    this.dummies.push(dummy);
    return dummy;
  }

  updateDummies(): void {
    const now = performance.now();
    for (const d of this.dummies) {
      if (d.hp <= 0) {
        if (now - d.hitTime > 3000) {
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
}

// ───────── 投射物與特效實體 ─────────

interface ActiveMissile {
  type: 'firebolt' | 'fireball';
  x: number;
  y: number;
  vx: number;
  vy: number;
  phiDeg: number;
  dirRow: number;
  life: number;
  maxLife: number;
  animFrame: number;
  animTimer: number;
}

interface ActiveExplosion {
  type: 'fireball' | 'meteor';
  x: number;
  y: number;
  animFrame: number;
  maxFrames: number;
  frameTimer: number;
}

interface ActiveInferno {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  animFrame: number;
}

interface ActiveFirewallPillar {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  animFrame: number;
  animTimer: number;
  type?: 'big' | 'med';
}

interface ActiveMeteorCall {
  targetX: number;
  targetY: number;
  tick: number;
  exploded: boolean;
}

interface ActiveHydra {
  x: number;
  y: number;
  lifeTicks: number;
  maxLifeTicks: number;
  heads: Array<{
    offsetX: number;
    offsetY: number;
    dir: number;
    state: 'idle' | 'attack';
    animFrame: number;
    animTimer: number;
    attackCooldown: number;
  }>;
}

interface FloatingDamage {
  x: number;
  y: number;
  text: string;
  alpha: number;
  color: string;
}

// ───────── 主入口 ─────────

export function startDemo(): void {
  const canvas = document.getElementById('demo-canvas') as HTMLCanvasElement;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;

  const targets = new DemoTargetRegistry();
  targets.addDummy(280, 220);
  targets.addDummy(700, 200);
  targets.addDummy(750, 380);
  targets.addDummy(260, 420);
  targets.addDummy(500, 220);
  targets.addDummy(480, 450);

  const player = { x: 500, y: 340 };
  let currentSkill = 0; // 0:火彈, 1:火球, 2:地獄火, 3:火牆, 4:隕石, 5:海蛇
  let isMouseDown = false;
  let mousePos = { x: 500, y: 340 };
  let debugEnabled = true;

  const missiles: ActiveMissile[] = [];
  const explosions: ActiveExplosion[] = [];
  const infernoStreams: ActiveInferno[] = [];
  const firewallPillars: ActiveFirewallPillar[] = [];
  const meteorCalls: ActiveMeteorCall[] = [];
  const hydras: ActiveHydra[] = [];
  const floatingTexts: FloatingDamage[] = [];

  function addDamageText(x: number, y: number, text: string, color = '#F59E0B') {
    // 依據使用者指令：施展技能時絕不跳出技能名稱或公告文字，僅保留數值傷害跳字
    if (!text.match(/^[-+0-9]/)) return;
    floatingTexts.push({ x: x + (Math.random() - 0.5) * 20, y: y - 20, text, alpha: 1.0, color });
  }

  // 1. 發射火彈 (Firebolt) — 手杖前端射出，直線無爆炸
  // 依據 d2_reference_tables Missiles.txt: firebolt (Id: 58) Vel: 20, Range: 50, InitSteps: 1
  function castFirebolt(tx: number, ty: number) {
    const sx = player.x;
    const sy = player.y - 32;
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.hypot(dx, dy) || 1;
    const phi = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    const dirRow = getDcc16Dir(phi);
    const speed = 20;

    missiles.push({
      type: 'firebolt',
      x: sx + (dx / dist) * 20,
      y: sy + (dy / dist) * 20,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      phiDeg: phi,
      dirRow,
      life: 0,
      maxLife: 50,
      animFrame: 0,
      animTimer: 0,
    });
  }

  // 2. 發射火球 (Fireball) — 16 方向貼圖直飛，命中產生 80px AoE 與正統火球爆炸
  // 依據 d2_reference_tables Missiles.txt: fireball (Id: 62) Vel: 20, Range: 50, InitSteps: 1
  function castFireball(tx: number, ty: number) {
    const sx = player.x;
    const sy = player.y - 32;
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.hypot(dx, dy) || 1;
    const phi = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    const dirRow = getDcc16Dir(phi);
    const speed = 20;

    missiles.push({
      type: 'fireball',
      x: sx + (dx / dist) * 22,
      y: sy + (dy / dist) * 22,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      phiDeg: phi,
      dirRow,
      life: 0,
      maxLife: 50,
      animFrame: 0,
      animTimer: 0,
    });
  }

  // 3. 噴射地獄火 (Inferno) — 掌心外緣連續錐形火焰噴流
  // 依據 d2_reference_tables Missiles.txt: infernoflame1/2 (Id: 60/61) Vel: 12, Range: 30, InitSteps: 1
  function emitInferno(tx: number, ty: number) {
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
        animFrame: 0,
      });
    }
  }

  // 4. 召喚地表火牆 (Firewall) — 45 度等距傾角連續鋪設 7 道地表烈火
  // 依據 d2_reference_tables Missiles.txt: firewall (Id: 69) groundFireBig, Range: 90
  function castFirewall(tx: number, ty: number) {
    const dx = tx - player.x;
    const dy = ty - player.y;
    const angle = Math.atan2(dy, dx);
    const perp = angle + Math.PI / 2;
    const spacing = 38;
    for (let i = -3; i <= 3; i++) {
      const px = tx + Math.cos(perp) * (i * spacing);
      const py = ty + Math.sin(perp) * (i * spacing * 0.5); // 2:1 等角菱形壓縮
      firewallPillars.push({
        x: px,
        y: py,
        life: 0,
        maxLife: 90, // 3.6 秒 (Missiles.txt firewall Range: 90)
        animFrame: Math.floor(Math.random() * 37),
        animTimer: 0,
        type: 'big',
      });
    }
  }

  // 5. 召喚隕石天降 (Meteor) — 四階段連動：地表預警紅光 ➔ 巨石伴隨火焰拖尾天降 ➔ 砸地巨轟 ➔ 地表殘火
  function castMeteor(tx: number, ty: number) {
    meteorCalls.push({
      targetX: tx,
      targetY: ty,
      tick: 0,
      exploded: false,
    });
  }

  // 6. 召喚九頭海蛇 (Hydra) — 3 蛇頭獨立索敵 ➔ 甩頭攻擊並自嘴吻噴吐火彈
  // 依據 d2_reference_tables Skills.txt: Param1: 250 (10秒生命週期)
  function castHydra(tx: number, ty: number) {
    const cfg = getHydraConfig();
    hydras.push({
      x: tx,
      y: ty,
      lifeTicks: 0,
      maxLifeTicks: 250, // 10 秒
      heads: [
        // 0: 左後蛇頭 (對應 HydraLoop1)
        { offsetX: cfg.heads[0].ox, offsetY: cfg.heads[0].oy, dir: 5, state: 'idle', animFrame: 4, animTimer: 0, attackCooldown: 30 },
        // 1: 中央前蛇頭 (對應 HydraLoop2)
        { offsetX: cfg.heads[1].ox, offsetY: cfg.heads[1].oy, dir: 4, state: 'idle', animFrame: 0, animTimer: 0, attackCooldown: 15 },
        // 2: 右後蛇頭 (對應 HydraLoop3)
        { offsetX: cfg.heads[2].ox, offsetY: cfg.heads[2].oy, dir: 3, state: 'idle', animFrame: 8, animTimer: 0, attackCooldown: 45 },
      ],
    });
  }

  function castCurrentSkill(tx: number, ty: number) {
    if (currentSkill === 0) castFirebolt(tx, ty);
    else if (currentSkill === 1) castFireball(tx, ty);
    else if (currentSkill === 2) emitInferno(tx, ty);
    else if (currentSkill === 3) castFirewall(tx, ty);
    else if (currentSkill === 4) castMeteor(tx, ty);
    else if (currentSkill === 5) castHydra(tx, ty);
  }

  // ───────── 25Hz 固定邏輯步進 ─────────
  let lastTime = performance.now();
  let accumulator = 0;
  const TICK_MS = 40; // 25Hz

  function logicTick() {
    targets.updateDummies();

    // 地獄火連續滑鼠按壓噴射
    if (isMouseDown && currentSkill === 2) {
      emitInferno(mousePos.x, mousePos.y);
    }

    // 更新直飛投射物 (火彈、火球)
    for (let i = missiles.length - 1; i >= 0; i--) {
      const m = missiles[i];
      m.x += m.vx;
      m.y += m.vy;
      m.life++;

      // 動畫幀
      m.animTimer++;
      if (m.animTimer >= 2) {
        m.animTimer = 0;
        m.animFrame = (m.animFrame + 1) % 5;
      }

      // 碰撞檢測
      let hit = false;
      for (const d of targets.dummies) {
        if (d.hp <= 0) continue;
        const dist = Math.hypot(d.x - m.x, (d.y - 18 - m.y) * 2);
        if (dist <= 26) {
          hit = true;
          if (m.type === 'fireball') {
            // 火球 80px 範圍爆炸 AoE + 正統火球爆炸
            for (const near of targets.dummies) {
              if (near.hp <= 0) continue;
              const dNear = Math.hypot(near.x - m.x, (near.y - 18 - m.y) * 2);
              if (dNear <= 80) {
                near.hp = Math.max(0, near.hp - 65);
                near.hitTime = performance.now();
                addDamageText(near.x, near.y - 20, '-65', '#EF4444');
              }
            }
            explosions.push({
              type: 'fireball',
              x: m.x,
              y: m.y,
              animFrame: 0,
              maxFrames: 12,
              frameTimer: 0
            });
          } else {
            // 火彈 單體打擊，直接扣血，絕無大爆炸！
            d.hp = Math.max(0, d.hp - 35);
            d.hitTime = performance.now();
            addDamageText(d.x, d.y - 20, '-35', '#F59E0B');
          }
          break;
        }
      }

      if (hit || m.life >= m.maxLife) {
        missiles.splice(i, 1);
      }
    }

    // 更新地獄火粒子 (擴散煙圈噴流)
    for (let i = infernoStreams.length - 1; i >= 0; i--) {
      const inf = infernoStreams[i];
      inf.life++;
      inf.x += inf.vx;
      inf.y += inf.vy;
      inf.animFrame = Math.min(14, Math.floor((inf.life / inf.maxLife) * 15));

      // 貫通灼燒判定
      for (const d of targets.dummies) {
        if (d.hp <= 0) continue;
        const dist = Math.hypot(d.x - inf.x, (d.y - 18 - inf.y) * 2);
        if (dist <= 28) {
          d.hp = Math.max(0, d.hp - 4);
          d.hitTime = performance.now();
          if (Math.random() < 0.25) addDamageText(d.x, d.y - 20, '-8', '#F97316');
        }
      }

      if (inf.life >= inf.maxLife) {
        infernoStreams.splice(i, 1);
      }
    }

    // 更新火牆
    for (let i = firewallPillars.length - 1; i >= 0; i--) {
      const fp = firewallPillars[i];
      fp.life++;
      fp.animTimer++;
      if (fp.animTimer >= 1) {
        fp.animTimer = 0;
        fp.animFrame = (fp.animFrame + 1) % 37;
      }

      // 火牆地表持續灼燒
      for (const d of targets.dummies) {
        if (d.hp <= 0) continue;
        const dist = Math.hypot(d.x - fp.x, (d.y - fp.y) * 2);
        if (dist <= 35) {
          d.hp = Math.max(0, d.hp - 3);
          d.hitTime = performance.now();
          if (Math.random() < 0.15) addDamageText(d.x, d.y - 20, '-15', '#EA580C');
        }
      }

      if (fp.life >= fp.maxLife) {
        firewallPillars.splice(i, 1);
      }
    }

    // 更新隕石天降四階段連動
    for (let i = meteorCalls.length - 1; i >= 0; i--) {
      const mc = meteorCalls[i];
      mc.tick++;

      // 階段 3: 抵達地表 (第 42 Tick = 1.68s) 觸發巨轟與地面殘火
      if (mc.tick === 42 && !mc.exploded) {
        mc.exploded = true;
        explosions.push({
          type: 'meteor',
          x: mc.targetX,
          y: mc.targetY,
          animFrame: 0,
          maxFrames: 16,
          frameTimer: 0
        });

        // 巨爆範圍判定 120px
        for (const d of targets.dummies) {
          if (d.hp <= 0) continue;
          const dist = Math.hypot(d.x - mc.targetX, (d.y - 18 - mc.targetY) * 2);
          if (dist <= 120) {
            d.hp = Math.max(0, d.hp - 120);
            d.hitTime = performance.now();
            addDamageText(d.x, d.y - 25, '-120', '#DC2626');
          }
        }

        // 階段 4: 鋪設地表餘燼殘火 (依據 Missiles.txt: meteorfire Id 240, CelFile: groundFireMedium, Range: 90 = 3.6秒)
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
            type: 'med',
          });
        }
      }

      // 總生命週期結束
      if (mc.tick > 60) {
        meteorCalls.splice(i, 1);
      }
    }

    // 更新九頭海蛇 (8 向獨立索敵、甩頭攻擊、嘴巴正中心噴吐火彈)
    for (let i = hydras.length - 1; i >= 0; i--) {
      const hydra = hydras[i];
      hydra.lifeTicks++;

      for (const head of hydra.heads) {
        const hx = hydra.x + head.offsetX;
        const hy = hydra.y + head.offsetY;

        // 尋找最近活著的目標
        let nearest: DummyTarget | null = null;
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
          const dy = (nearest.y - 18) - hy;
          const angleDeg = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
          head.dir = getHydra8Dir(angleDeg);
        }

        head.animTimer++;
        if (head.animTimer >= 2) {
          head.animTimer = 0;
          head.animFrame++;

          if (head.state === 'attack') {
            // 原廠 AnimData.D2 鐵證: 第 8 幀為出招脫手幀 (Release Frame)
            if (head.animFrame === 8 && nearest) {
              const [mxOff, myOff] = HYDRA_MOUTH_OFFSETS[head.dir] || [0, -40];
              const mx = hx + mxOff;
              const my = hy + myOff;
              const mdx = nearest.x - mx;
              const mdy = (nearest.y - 18) - my;
              const mdist = Math.hypot(mdx, mdy) || 1;
              const boltPhi = (Math.atan2(mdy, mdx) * 180 / Math.PI + 360) % 360;
              const boltDir = getDcc16Dir(boltPhi);
              const boltSpeed = 14; // 依據 d2_reference_tables Missiles.txt: hydra (Id: 247) Vel: 14
              const forwardPush = 4; // 朝目標方向微推 4px，對齊 InitSteps: 2

              missiles.push({
                type: 'firebolt',
                x: mx + (mdx / mdist) * forwardPush,
                y: my + (mdy / mdist) * forwardPush,
                vx: (mdx / mdist) * boltSpeed,
                vy: (mdy / mdist) * boltSpeed,
                phiDeg: boltPhi,
                dirRow: boltDir,
                life: 0,
                maxLife: 30, // 依據 d2_reference_tables Missiles.txt: hydra (Id: 247) Range: 30
                animFrame: 0,
                animTimer: 0,
              });
            }

            // 攻擊動畫播完 12 幀，平滑回歸待命 (NU) 狀態
            if (head.animFrame >= 12) {
              head.state = 'idle';
              head.animFrame = 0;
            }
          } else {
            // 待命循環
            head.animFrame = head.animFrame % 12;
          }
        }

        // 冷卻判定觸發甩頭攻擊
        head.attackCooldown--;
        if (head.attackCooldown <= 0 && nearest && head.state === 'idle') {
          head.state = 'attack';
          head.animFrame = 0;
          head.animTimer = 0;
          head.attackCooldown = 55 + Math.floor(Math.random() * 20);
        }
      }

      if (hydra.lifeTicks >= hydra.maxLifeTicks) {
        hydras.splice(i, 1);
      }
    }

    // 更新爆炸
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

    // 更新浮動傷害文字
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y -= 0.8;
      ft.alpha -= 0.025;
      if (ft.alpha <= 0) floatingTexts.splice(i, 1);
    }
  }

  // ───────── 渲染管線 ─────────

  function render() {
    ctx.fillStyle = '#060709';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 1. 2:1 等角地磚格線
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = -800; x < 1800; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 1200, 600); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - 1200, 600); ctx.stroke();
    }

    // 2. 渲染地表落點預警光 (Meteor Indicator)
    for (const mc of meteorCalls) {
      if (mc.tick < 42) {
        const at = atlases.meteorIndicator;
        const frameIdx = mc.tick % at.frames;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.85;
        ctx.drawImage(
          at.img,
          frameIdx * at.cellW, 0, at.cellW, at.cellH,
          mc.targetX - at.pivotX, mc.targetY - at.pivotY, at.cellW, at.cellH
        );
        ctx.restore();
      }
    }

    // 3. 渲染地表火柱 (Fire Wall 用 groundfireBig / Meteor 殘火用 groundfireMed)
    for (const fp of firewallPillars) {
      const at = fp.type === 'med' ? atlases.groundfireMed : atlases.groundfireBig;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(
        at.img,
        fp.animFrame * at.cellW, 0, at.cellW, at.cellH,
        fp.x - at.pivotX, fp.y - at.pivotY, at.cellW, at.cellH
      );
      ctx.restore();

      if (debugEnabled) {
        ctx.save();
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.5)';
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.ellipse(fp.x, fp.y, 35, 17.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 4. 渲染九頭海蛇 (Hydra 正統完全體：符合 Overlay.txt PreDraw: 0 前景烈火覆蓋 + 雙層立體火光包覆 + S1 烈焰鬃毛)
    // 依據 Overlay.txt: HydraStart/Loop/End 1~3，每顆蛇頭各一組，偏移 (-6,-11) / (0,-7) / (4,-15)，AnimRate 16 (= 16 FPS)
    for (const hydra of hydras) {
      const indexed = hydra.heads.map((h, i) => ({ h, i }));
      // 依據等角深度 (Y 軸) 由後向前嚴格排序，避免前後蛇身穿模
      indexed.sort((a, b) => a.h.offsetY - b.h.offsetY);
      for (const { h: head, i: headIdx } of indexed) {
        const hx = hydra.x + head.offsetX;
        const hy = hydra.y + head.offsetY;
        // 讀取即時調整面板設定 (若面板未設定則回退原廠 Overlay.txt 預設值)
        const fireCfg = getHydraConfig().fires[headIdx] ?? { fox: HYDRA_FIRE_OFFSETS[headIdx][0], foy: HYDRA_FIRE_OFFSETS[headIdx][1] };
        const fox = fireCfg.fox;
        const foy = fireCfg.foy;
        // 火焰錨點：蛇頭底部接地點 + 面板調整偏移
        const fx = hx + fox;
        const fy = hy + foy;

        // 計算火焰動畫幀 (Start 16 幀 -> Loop 20 幀 -> End 16 幀)
        let fat = atlases.hydraFire;
        let ff = 0;
        const endStart = hydra.maxLifeTicks - 16 * 25 / 16; // End 階段 16 幀 @16FPS = 25 tick
        const startTicks = Math.ceil(16 * 25 / 16);          // Start 階段 16 幀 @16FPS = 25 tick
        if (hydra.lifeTicks < startTicks) {
          fat = atlases.hydraFireStart;
          ff = Math.min(15, Math.floor(hydra.lifeTicks * 16 / 25));
        } else if (hydra.lifeTicks >= endStart) {
          fat = atlases.hydraFireEnd;
          ff = Math.min(15, Math.floor((hydra.lifeTicks - endStart) * 16 / 25));
        } else {
          ff = (Math.floor(hydra.lifeTicks * 16 / 25) + headIdx * 7) % fat.frames;
        }

        // 4.1 背後地表火光襯底 (Back Glow)：錨定於火焰調整座標 (fx, fy)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.45;
        ctx.drawImage(
          fat.img,
          ff * fat.cellW, 0, fat.cellW, fat.cellH,
          fx - fat.pivotX, fy - fat.pivotY, fat.cellW, fat.cellH
        );
        ctx.restore();

        // 4.2 蛇身本體實體 (Middle Body: Tr 肉身軀幹 + S1 烈焰鬃毛複合體)
        // 腳底接觸點嚴格釘死在 (hx, hy)，攻擊甩頭時底座 0 位移
        const at = head.state === 'attack' ? atlases.hydraA1 : atlases.hydraNu;
        const frameIdx = head.animFrame % at.frames;
        ctx.drawImage(
          at.img,
          frameIdx * at.cellW, head.dir * at.cellH, at.cellW, at.cellH,
          hx - at.pivotX, hy - at.pivotY, at.cellW, at.cellH
        );

        // 4.3 前景竄升烈火 (Foreground Flame: 嚴格遵循 Overlay.txt PreDraw: 0 規範)
        // 錨定於火焰調整座標 (fx, fy)，竄升火舌直接包覆下半身，絕不隨甩頭噴火上下擺動
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.95;
        ctx.drawImage(
          fat.img,
          ff * fat.cellW, 0, fat.cellW, fat.cellH,
          fx - fat.pivotX, fy - fat.pivotY, fat.cellW, fat.cellH
        );
        ctx.restore();

        // [D 鍵視覺除錯] 蛇底接地點 + 火焰錨點 + 嘴巴插槽
        if (debugEnabled) {
          // 蛇底接地點：綠色 +
          ctx.strokeStyle = '#00FF00'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(hx - 6, hy); ctx.lineTo(hx + 6, hy); ctx.moveTo(hx, hy - 6); ctx.lineTo(hx, hy + 6); ctx.stroke();
          // 火焰錨點：橙色 ×
          ctx.strokeStyle = '#FF8C00'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(fx - 5, fy - 5); ctx.lineTo(fx + 5, fy + 5); ctx.moveTo(fx + 5, fy - 5); ctx.lineTo(fx - 5, fy + 5); ctx.stroke();
          const [mxOff, myOff] = HYDRA_MOUTH_OFFSETS[head.dir] || [0, -40];
          const mouthX = hx + mxOff;
          const mouthY = hy + myOff;

          let nearestDummy: any = null;
          let minDist = 450;
          for (const d of targets.dummies) {
            if (d.hp <= 0) continue;
            const dist = Math.hypot(d.x - hx, (d.y - 18) - hy);
            if (dist < minDist) {
              minDist = dist;
              nearestDummy = d;
            }
          }

          ctx.save();
          // 繪製嘴巴發射插槽金色光圈
          ctx.fillStyle = '#F59E0B';
          ctx.beginPath();
          ctx.arc(mouthX, mouthY, 2.5, 0, Math.PI * 2);
          ctx.fill();

          if (nearestDummy) {
            ctx.setLineDash([2, 3]);
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
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

    // 5. 渲染訓練靶子
    const now = performance.now();
    for (const d of targets.dummies) {
      const isHit = now - d.hitTime < 120;
      const isDead = d.hp <= 0;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath(); ctx.ellipse(d.x, d.y, 20, 10, 0, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = isDead ? '#4B5563' : isHit ? '#F87171' : '#E2E8F0';
      ctx.beginPath(); ctx.arc(d.x, d.y - 18, 14, 0, Math.PI * 2); ctx.fill();

      // [D 鍵視覺除錯] 假人怪物受擊盒：胸膛中心 (-18px) 綠色 2:1 等角受擊橢圓
      if (debugEnabled && !isDead) {
        ctx.save();
        ctx.strokeStyle = '#22C55E';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y - 18, 24, 12, 0, 0, Math.PI * 2);
        ctx.stroke();

        // 受擊中心十字
        ctx.strokeStyle = '#86EFAC';
        ctx.beginPath();
        ctx.moveTo(d.x - 5, d.y - 18); ctx.lineTo(d.x + 5, d.y - 18);
        ctx.moveTo(d.x, d.y - 23); ctx.lineTo(d.x, d.y - 13);
        ctx.stroke();

        // 標籤
        ctx.fillStyle = '#4ADE80';
        ctx.font = '9px monospace';
        ctx.fillText(`Center Y-18`, d.x, d.y - 32);
        ctx.restore();
      }

      // 血條
      const barW = 36;
      const bx = d.x - barW / 2;
      const by = d.y - 42;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(bx, by, barW, 5);
      ctx.fillStyle = isDead ? '#6B7280' : '#EF4444';
      ctx.fillRect(bx, by, (d.hp / d.maxHp) * barW, 5);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Target #${d.id} [${d.hp}/100]`, d.x, d.y + 14);
    }

    // 6. 渲染施法者法師主角
    ctx.fillStyle = 'rgba(234, 88, 12, 0.3)';
    ctx.beginPath(); ctx.ellipse(player.x, player.y, 28, 14, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#F97316';
    ctx.beginPath(); ctx.arc(player.x, player.y - 14, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#FEF08A'; ctx.lineWidth = 2; ctx.stroke();

    // 施法手杖前端指示
    const mAngle = Math.atan2(mousePos.y - (player.y - 32), mousePos.x - player.x);
    ctx.strokeStyle = '#FDE047'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y - 32);
    ctx.lineTo(player.x + Math.cos(mAngle) * 22, player.y - 32 + Math.sin(mAngle) * 22);
    ctx.stroke();

    // [D 鍵視覺除錯] 施法手杖出射基準線
    if (debugEnabled) {
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.5)';
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - 32);
      ctx.lineTo(mousePos.x, mousePos.y);
      ctx.stroke();
      ctx.restore();
    }

    // 7. 渲染直飛投射物 (火彈、火球)
    for (const m of missiles) {
      const at = m.type === 'firebolt' ? atlases.firebolt : atlases.fireball;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(
        at.img,
        m.animFrame * at.cellW, m.dirRow * at.cellH, at.cellW, at.cellH,
        m.x - at.pivotX, m.y - at.pivotY, at.cellW, at.cellH
      );
      ctx.restore();

      // [D 鍵視覺除錯] 飛彈彈道、碰撞圈、朝向箭頭與鎖定線
      if (debugEnabled) {
        ctx.save();
        // 青色 2:1 碰撞橢圓
        ctx.strokeStyle = '#06B6D4';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(m.x, m.y, 16, 8, 0, 0, Math.PI * 2);
        ctx.stroke();

        // 中心十字
        ctx.strokeStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(m.x - 3, m.y); ctx.lineTo(m.x + 3, m.y);
        ctx.moveTo(m.x, m.y - 3); ctx.lineTo(m.x, m.y + 3);
        ctx.stroke();

        // 朝向向量黃色箭頭
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 2;
        const vLen = Math.hypot(m.vx, m.vy) || 1;
        const ax = m.x + (m.vx / vLen) * 26;
        const ay = m.y + (m.vy / vLen) * 26;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(ax, ay);
        ctx.stroke();

        // 彈道虛線導引（飛彈朝正前方活著的目標連出洋紅色命中預測虛線）
        for (const d of targets.dummies) {
          if (d.hp <= 0) continue;
          const dx = d.x - m.x;
          const dy = (d.y - 18) - m.y;
          const dot = dx * m.vx + dy * m.vy;
          if (dot > 0 && Math.hypot(dx, dy) < 400) {
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = 'rgba(236, 72, 153, 0.7)';
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

    // 8. 渲染地獄火連續噴流 (掌心噴湧烈火)
    for (const inf of infernoStreams) {
      const at = atlases.flamethrower;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(
        at.img,
        inf.animFrame * at.cellW, 0, at.cellW, at.cellH,
        inf.x - at.pivotX, inf.y - at.pivotY, at.cellW, at.cellH
      );
      ctx.restore();

      // [D 鍵視覺除錯] 地獄火噴流碰撞點
      if (debugEnabled && Math.random() < 0.2) {
        ctx.save();
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.6)';
        ctx.beginPath();
        ctx.ellipse(inf.x, inf.y, 14, 7, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 9. 渲染天降隕石 (巨石本體 + 烈焰拖尾)
    for (const mc of meteorCalls) {
      // [D 鍵視覺除錯] 隕石天降 80px AoE 碰撞紅圈與預警線
      if (debugEnabled) {
        ctx.save();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
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
        // 從左上方天頂疾速斜向墜落
        const startX = mc.targetX - 160;
        const startY = mc.targetY - 280;
        const curX = startX + (mc.targetX - startX) * progress;
        const curY = startY + (mc.targetY - startY) * progress;
        const frameIdx = (mc.tick - 25) % 12;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // 先繪製烈焰拖尾 (包裹住巨石並朝左上方拖曳)
        ctx.drawImage(
          atTail.img,
          frameIdx * atTail.cellW, 0, atTail.cellW, atTail.cellH,
          curX - atTail.pivotX, curY - atTail.pivotY, atTail.cellW, atTail.cellH
        );
        // 再繪製巨石實體
        ctx.drawImage(
          atRock.img,
          frameIdx * atRock.cellW, 0, atRock.cellW, atRock.cellH,
          curX - atRock.pivotX, curY - atRock.pivotY, atRock.cellW, atRock.cellH
        );
        ctx.restore();

        if (debugEnabled) {
          ctx.save();
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(mc.targetX, mc.targetY);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // 10. 渲染爆炸特效 (火球爆炸 / 隕石落地巨轟)
    for (const exp of explosions) {
      const at = exp.type === 'fireball' ? atlases.fireballExplode : atlases.meteorExplode;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(
        at.img,
        exp.animFrame * at.cellW, 0, at.cellW, at.cellH,
        exp.x - at.pivotX, exp.y - at.pivotY, at.cellW, at.cellH
      );
      ctx.restore();

      if (debugEnabled) {
        ctx.save();
        ctx.strokeStyle = exp.type === 'fireball' ? '#F59E0B' : '#EF4444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const r = exp.type === 'fireball' ? 40 : 80;
        ctx.ellipse(exp.x, exp.y, r, r * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 11. 渲染浮動傷害文字
    for (const ft of floatingTexts) {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 12. 除錯 HUD 面板
    if (debugEnabled) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(10, 10, 280, 126);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(10, 10, 280, 126);

      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('DIABLO II 純火體系原廠動態沙盒', 20, 28);

      ctx.fillStyle = '#38BDF8';
      ctx.font = '10px sans-serif';
      ctx.fillText('【視覺除錯已開啟 - 彈道 / 碰撞圈 / 軀幹中心】', 20, 44);

      ctx.fillStyle = '#E2E8F0';
      ctx.font = '11px monospace';
      ctx.fillText(`當前招式: [${currentSkill + 1}] ${['火彈', '火球', '地獄火', '火牆', '隕石', '九頭蛇'][currentSkill]}`, 20, 64);
      ctx.fillText(`飛行飛彈數: ${missiles.length} | 活躍火柱: ${firewallPillars.length}`, 20, 82);
      ctx.fillText(`活躍海蛇數: ${hydras.length} | 噴流粒子: ${infernoStreams.length}`, 20, 100);
      ctx.fillText(`FPS: 60 (25Hz 物理鎖頻) | 按 [D] 鍵可隱藏`, 20, 118);
    }
  }

  // ───────── 事件監聽與主迴圈 ─────────

  function loop(now: number) {
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

  // 操作事件
  window.addEventListener('keydown', (e) => {
    let skillNum = -1;
    if (e.key >= '1' && e.key <= '6') {
      skillNum = parseInt(e.key, 10);
    } else if (e.code && e.code.startsWith('Digit') && e.code[5] >= '1' && e.code[5] <= '6') {
      skillNum = parseInt(e.code[5], 10);
    } else if (e.code && e.code.startsWith('Numpad') && e.code[6] >= '1' && e.code[6] <= '6') {
      skillNum = parseInt(e.code[6], 10);
    }

    if (skillNum !== -1) {
      currentSkill = skillNum - 1;
      updateToolbarUI();
      // 切換至九頭海蛇時，若場上無海蛇，自動於畫布中央召喚一隻供即時調試
      if (currentSkill === 5 && hydras.length === 0) {
        castHydra(canvas.width / 2, canvas.height / 2);
      }
    } else if (e.key === 'd' || e.key === 'D') {
      debugEnabled = !debugEnabled;
      updateToolbarUI();
    } else if (e.key === 'p' || e.key === 'P') {
      const btn = document.getElementById('btn-toggle-panel');
      if (btn) btn.click();
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mousePos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  });

  canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    const rect = canvas.getBoundingClientRect();
    const tx = e.clientX - rect.left;
    const ty = e.clientY - rect.top;
    castCurrentSkill(tx, ty);
  });

  window.addEventListener('mouseup', () => {
    isMouseDown = false;
  });

  function updateToolbarUI() {
    for (let i = 0; i < 6; i++) {
      const btn = document.getElementById(`btn-skill-${i}`);
      if (btn) {
        if (i === currentSkill) btn.classList.add('active');
        else btn.classList.remove('active');
      }
    }
    const btnDebug = document.getElementById('btn-toggle-debug');
    if (btnDebug) {
      if (debugEnabled) btnDebug.classList.add('active');
      else btnDebug.classList.remove('active');
    }
  }

  // 工具列按鈕事件綁定
  for (let i = 0; i < 6; i++) {
    const btn = document.getElementById(`btn-skill-${i}`);
    if (btn) {
      btn.addEventListener('click', () => {
        currentSkill = i;
        updateToolbarUI();
        if (currentSkill === 5 && hydras.length === 0) {
          castHydra(canvas.width / 2, canvas.height / 2);
        }
      });
    }
  }

  const btnToggleDebug = document.getElementById('btn-toggle-debug');
  if (btnToggleDebug) {
    btnToggleDebug.addEventListener('click', () => {
      debugEnabled = !debugEnabled;
      updateToolbarUI();
    });
  }

  // 初始化工具列外觀
  updateToolbarUI();

  // 測試與外部控制 API
  (window as any).castSandboxSkill = (skillIdx: number | string, tx: number, ty: number) => {
    const idx = typeof skillIdx === 'string' ? parseInt(skillIdx, 10) : skillIdx;
    currentSkill = isNaN(idx) ? 0 : idx;
    updateToolbarUI();
    castCurrentSkill(tx, ty);
  };
  (window as any).getHydras = () => hydras;
}

// 自動啟動
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => {
      startDemo();
    });
  } else {
    startDemo();
  }
}


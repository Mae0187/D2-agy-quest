// =======================================================================
// Diablo II 通用直飛投射物模板 (Linear Missile Template)
// 支援 16 方向直飛、生命週期驅動、碰撞檢測與爆炸子動畫生成
// =======================================================================

import { SkillManifestData, TargetDummy } from './types';
import { DirectionResolver } from './direction_resolver';

export interface ActiveLinearMissile {
  skillId: string;
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

export interface ActiveExplosion {
  atlasFile: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  dirRow?: number;
  animFrame: number;
  maxFrames: number;
  frameTimer: number;
  cellW: number;
  cellH: number;
  pivotX: number;
  pivotY: number;
}

export class LinearMissileTemplate {
  public static spawn(
    manifest: SkillManifestData,
    sx: number,
    sy: number,
    tx: number,
    ty: number
  ): ActiveLinearMissile {
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.hypot(dx, dy) || 1;
    // 依據 readfirst/SKILL_RECONSTRUCTION_WORKFLOW.md 形態 A 標準直線等速彈道
    const phi = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    const vel = manifest.parameters.velocity || 16;
    const range = manifest.parameters.range || 60;
    const preset = manifest.direction?.preset || 'standard_16';

    return {
      skillId: manifest.skillId,
      x: sx + (dx / dist) * 20,
      y: sy + (dy / dist) * 20,
      vx: (dx / dist) * vel,
      vy: (dy / dist) * vel,
      phiDeg: phi,
      dirRow: DirectionResolver.resolve(preset, phi),
      life: 0,
      maxLife: range,
      animFrame: 0,
      animTimer: 0,
    };
  }

  public static tick(
    missiles: ActiveLinearMissile[],
    explosions: ActiveExplosion[],
    manifestMap: Record<string, SkillManifestData>,
    dummies: TargetDummy[],
    onDamage: (d: TargetDummy, dmg: number, isCold?: boolean) => void
  ) {
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

      const mf = manifestMap[m.skillId];
      const isCold = mf?.category === 'cold';
      let hit = false;

      for (const d of dummies) {
        if (d.hp <= 0 || d.isDead || d.remove) continue;
        // 2D 螢幕精確受擊圓形判定 (木人軀幹球心 d.x, d.y - 18)
        const dist = Math.hypot(d.x - m.x, d.y - 18 - m.y);
        const hitRadius = mf?.parameters.hitboxRadius || 26;
        if (dist <= hitRadius) {
          hit = true;
          // 範圍傷害 (火球) 或 單體傷害 (火彈/冰彈)
          const aoe = mf?.parameters.aoeRadius || 0;
          if (aoe > 0) {
            for (const near of dummies) {
              if (near.hp <= 0 || near.isDead || near.remove) continue;
              const dNear = Math.hypot(near.x - m.x, (near.y - 18 - m.y) * 2);
              if (dNear <= aoe) onDamage(near, 65, isCold);
            }
          } else {
            onDamage(d, 35, isCold);
          }

          // 1. 中心爆炸圖層 (FreezeExplodeCenter 等)
          const expLayer = mf?.layers.find(l => l.role === 'impact_burst');
          if (expLayer) {
            explosions.push({
              atlasFile: expLayer.atlasFile,
              x: m.x,
              y: m.y,
              animFrame: 0,
              maxFrames: expLayer.frames,
              frameTimer: 0,
              cellW: expLayer.cellW,
              cellH: expLayer.cellH,
              pivotX: expLayer.pivotX,
              pivotY: expLayer.pivotY,
            });
          }

          // 2. 次級噴射碎冰圖層 (冰川之刺 8 方向碎冰 Ejecta Shards: Missiles.txt CltHitSubMissile2)
          const ejectaLayer = mf?.layers.find(l => l.role === 'impact_ejecta');
          if (ejectaLayer) {
            const numDirs = ejectaLayer.dirs || 8;
            for (let ed = 0; ed < numDirs; ed++) {
              const ang = (ed / numDirs) * Math.PI * 2;
              explosions.push({
                atlasFile: ejectaLayer.atlasFile,
                x: m.x,
                y: m.y,
                vx: Math.cos(ang) * 5.0,
                vy: Math.sin(ang) * 2.5, // 2:1 等軸測地面推進
                dirRow: ed,
                animFrame: 0,
                maxFrames: ejectaLayer.frames,
                frameTimer: 0,
                cellW: ejectaLayer.cellW,
                cellH: ejectaLayer.cellH,
                pivotX: ejectaLayer.pivotX,
                pivotY: ejectaLayer.pivotY,
              });
            }
          }
          break;
        }
      }

      if (hit || m.life >= m.maxLife) {
        missiles.splice(i, 1);
      }
    }
  }
}

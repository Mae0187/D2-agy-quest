// =======================================================================
// Diablo II 通用複合多實體召喚模板 (Composite Minion Template)
// 支援九頭海蛇多頭索敵、前後景 PreDraw 雙層包覆、發射插槽火彈脫手
// =======================================================================

import { SkillManifestData, TargetDummy } from './types';
import { DirectionResolver } from './direction_resolver';
import { LinearMissileTemplate, ActiveLinearMissile } from './linear_missile_template';

export interface MinionHead {
  offsetX: number;
  offsetY: number;
  dir: number;
  state: 'idle' | 'attack';
  animFrame: number;
  targetId: number | null;
  attackCooldown: number;
}

export interface ActiveCompositeMinion {
  skillId: string;
  x: number;
  y: number;
  lifeTicks: number;
  maxLifeTicks: number;
  heads: MinionHead[];
}

export class CompositeMinionTemplate {
  public static spawn(
    manifest: SkillManifestData,
    x: number,
    y: number,
    customConfig?: { heads: { ox: number; oy: number }[] }
  ): ActiveCompositeMinion {
    const p = manifest.parameters;
    const headsCfg = customConfig?.heads || p.calibratedHeads || [
      { ox: -22, oy: -8 },
      { ox: 0, oy: 6 },
      { ox: 22, oy: -8 },
    ];

    const heads: MinionHead[] = headsCfg.map((cfg: any, idx: number) => ({
      offsetX: cfg.ox,
      offsetY: cfg.oy,
      dir: [5, 4, 3][idx] ?? 4,
      state: 'idle',
      animFrame: 0,
      targetId: null,
      attackCooldown: 12 + idx * 8,
    }));

    return {
      skillId: manifest.skillId,
      x,
      y,
      lifeTicks: 0,
      maxLifeTicks: manifest.timing.durationTicks || 250,
      heads,
    };
  }

  public static tick(
    minions: ActiveCompositeMinion[],
    manifest: SkillManifestData,
    fireboltManifest: SkillManifestData,
    missiles: ActiveLinearMissile[],
    dummies: TargetDummy[]
  ) {
    const mouthOffsets = manifest.parameters.mouthOffsets || {};

    for (let i = minions.length - 1; i >= 0; i--) {
      const minion = minions[i];
      minion.lifeTicks++;

      for (const head of minion.heads) {
        const hx = minion.x + head.offsetX;
        const hy = minion.y + head.offsetY;

        // 索敵
        let nearest: TargetDummy | null = null;
        let minDist = manifest.parameters.targetRadius || 280;
        for (const d of dummies) {
          if (d.hp <= 0) continue;
          const dist = Math.hypot(d.x - hx, (d.y - 18) - hy);
          if (dist < minDist) {
            minDist = dist;
            nearest = d;
          }
        }

        if (nearest) {
          const angle = (Math.atan2((nearest.y - 18) - hy, nearest.x - hx) * 180 / Math.PI + 360) % 360;
          head.dir = DirectionResolver.resolve8Hydra(angle);
          head.targetId = nearest.id;

          if (head.state === 'idle') {
            head.attackCooldown--;
            if (head.attackCooldown <= 0) {
              head.state = 'attack';
              head.animFrame = 0;
            }
          }
        } else {
          head.state = 'idle';
        }

        // 動作播放與脫手判定
        if (head.state === 'attack') {
          head.animFrame++;
          // 第 8 幀脫手出招 (AnimData.D2)
          if (head.animFrame === 8 && nearest) {
            const [mxOff, myOff] = mouthOffsets[String(head.dir)] || [0, -40];
            const mx = hx + mxOff;
            const my = hy + myOff;
            const firebolt = LinearMissileTemplate.spawn(fireboltManifest, mx, my, nearest.x, nearest.y - 18);
            missiles.push(firebolt);
          }
          if (head.animFrame >= 12) {
            head.state = 'idle';
            head.animFrame = 0;
            head.attackCooldown = 25 + Math.floor(Math.random() * 10);
          }
        } else {
          head.animFrame = (head.animFrame + 1) % 12;
        }
      }

      if (minion.lifeTicks >= minion.maxLifeTicks) {
        minions.splice(i, 1);
      }
    }
  }
}

// =======================================================================
// Diablo II Universal Archetype A Linear Missile Template
// Core Rules: Uniform linear screen motion, chest launch at Y-32, target hit at Y-18
// =======================================================================

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

export interface TargetDummy {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  hitTimer: number;
  shakeTimer: number;
}

export class LinearMissileTemplate {
  /**
   * Spawns an Archetype A linear projectile.
   * @param manifest Skill specification manifest
   * @param sx Origin point X (playerPos.x)
   * @param sy Origin point Y (playerPos.y - 32 chest height)
   * @param tx Target point X
   * @param ty Target point Y
   * @param resolveDirection Direction resolution callback
   */
  public static spawn(
    manifest: any,
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    resolveDirection: (preset: string, phi: number) => number
  ): ActiveLinearMissile {
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.hypot(dx, dy) || 1;

    // Standard uniform linear trajectory per 01_UNIVERSAL_ARCHETYPES.md Archetype A
    const phi = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    const vel = manifest.parameters?.velocity || 16;
    const range = manifest.parameters?.range || 60;
    const preset = manifest.direction?.preset || 'standard_16';

    return {
      skillId: manifest.skillId,
      // Offset 20 pixels forward along the firing vector (InitSteps = 1)
      x: sx + (dx / dist) * 20,
      y: sy + (dy / dist) * 20,
      // Pure Euclidean linear uniform velocity vector (Strictly forbid halving Y-axis speed)
      vx: (dx / dist) * vel,
      vy: (dy / dist) * vel,
      phiDeg: phi,
      dirRow: resolveDirection(preset, phi),
      life: 0,
      maxLife: range,
      animFrame: 0,
      animTimer: 0,
    };
  }

  /**
   * 25Hz fixed-step physics advance and collision detection.
   */
  public static tick(
    missiles: ActiveLinearMissile[],
    explosions: ActiveExplosion[],
    manifestMap: Record<string, any>,
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
        if (d.hp <= 0) continue;
        // Core rule: Target dummy hit center locked at d.y - 18px (torso/chest)
        const dist = Math.hypot(d.x - m.x, d.y - 18 - m.y);
        const hitRadius = mf?.parameters?.hitboxRadius || 26;

        if (dist <= hitRadius) {
          hit = true;
          // Evaluated as AoE explosive skill (e.g., Fire Ball, Glacial Spike)
          if (mf?.parameters?.aoeRadius && mf.parameters.aoeRadius > 0) {
            this.triggerExplosion(m, mf, explosions);
            for (const other of dummies) {
              if (other.hp <= 0) continue;
              const aoeDist = Math.hypot(other.x - m.x, other.y - 18 - m.y);
              if (aoeDist <= mf.parameters.aoeRadius) {
                onDamage(other, 65, isCold);
              }
            }
          } else {
            // Single-target projectile (e.g., Fire Bolt, Ice Bolt)
            onDamage(d, 35, isCold);
          }
          break;
        }
      }

      // Destroy upon collision or reaching maximum range lifetime
      if (hit || m.life >= m.maxLife) {
        if (!hit && mf?.parameters?.aoeRadius && mf.parameters.aoeRadius > 0) {
          this.triggerExplosion(m, mf, explosions);
        }
        missiles.splice(i, 1);
      }
    }
  }

  private static triggerExplosion(
    m: ActiveLinearMissile,
    mf: any,
    explosions: ActiveExplosion[]
  ) {
    const burstLayer = mf.layers.find((l: any) => l.role === 'impact_burst');
    if (burstLayer) {
      explosions.push({
        atlasFile: burstLayer.atlasFile,
        x: m.x,
        y: m.y,
        animFrame: 0,
        maxFrames: burstLayer.frames,
        frameTimer: 0,
        cellW: burstLayer.cellW,
        cellH: burstLayer.cellH,
        pivotX: burstLayer.pivotX,
        pivotY: burstLayer.pivotY,
      });
    }
  }
}

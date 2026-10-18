// =======================================================================
// Diablo II Universal Archetype B (Channeled Stream) & Archetype C (Ground Hazard Array) Template
// Supports Inferno particle stream, Fire Wall 7-column 2:1 isometric diamond layout, and DoT damage evaluation
// =======================================================================

export interface ActiveStreamParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  animFrame: number;
  cellW: number;
  cellH: number;
  pivotX: number;
  pivotY: number;
}

export interface ActiveGroundHazard {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  animFrame: number;
  animTimer: number;
  cellW: number;
  cellH: number;
  pivotX: number;
  pivotY: number;
}

export class HazardAndStreamTemplate {
  /**
   * Archetype B: Spawns stream particles (e.g., Inferno, Arctic Blast).
   */
  public static spawnStreamParticle(
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    layerCfg: any
  ): ActiveStreamParticle {
    const dx = tx - sx;
    const dy = ty - sy;
    const baseAngle = Math.atan2(dy, dx);
    // Stream cone angle jitter (+-12 degrees)
    const jitter = (Math.random() - 0.5) * 0.4;
    const angle = baseAngle + jitter;
    const vel = 12 + Math.random() * 3;

    return {
      x: sx + Math.cos(angle) * 24,
      y: sy + Math.sin(angle) * 24,
      vx: Math.cos(angle) * vel,
      vy: Math.sin(angle) * vel,
      life: 0,
      maxLife: 28 + Math.floor(Math.random() * 8),
      animFrame: 0,
      cellW: layerCfg.cellW,
      cellH: layerCfg.cellH,
      pivotX: layerCfg.pivotX,
      pivotY: layerCfg.pivotY,
    };
  }

  /**
   * Archetype C: Lays out 2:1 isometric ground hazard array (e.g., Fire Wall 7 fire columns).
   */
  public static spawnGroundWall(
    cx: number,
    cy: number,
    tx: number,
    ty: number,
    layerCfg: any,
    count: number = 7,
    spacing: number = 38
  ): ActiveGroundHazard[] {
    const dx = tx - cx;
    const dy = ty - cy;
    // Tangent angle perpendicular to the casting vector
    const perpAngle = Math.atan2(dy, dx) + Math.PI / 2;
    const hazards: ActiveGroundHazard[] = [];
    const half = Math.floor(count / 2);

    for (let i = -half; i <= half; i++) {
      const dist = i * spacing;
      // 2:1 isometric projected coordinates
      const px = tx + Math.cos(perpAngle) * dist;
      const py = ty + Math.sin(perpAngle) * dist * 0.5;

      hazards.push({
        x: px,
        y: py,
        life: 0,
        maxLife: 90, // 3.6 seconds
        animFrame: Math.floor(Math.random() * layerCfg.frames),
        animTimer: 0,
        cellW: layerCfg.cellW,
        cellH: layerCfg.cellH,
        pivotX: layerCfg.pivotX,
        pivotY: layerCfg.pivotY,
      });
    }

    return hazards;
  }
}

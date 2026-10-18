// =======================================================================
// Diablo II Universal Archetype E Composite Minion Template
// Includes Hydra triangular array layout, two-layer PreDraw glow wrapper, 8-direction mouth sockets, and independent targeting
// =======================================================================

export interface HydraHeadEntity {
  id: number;
  offsetX: number;
  offsetY: number;
  dir: number; // 0~7 Blizzard 8 directions
  state: 'idle' | 'attack';
  animFrame: number;
  animTimer: number;
  attackCooldown: number;
  fireOffsetX: number;
  fireOffsetY: number;
  fireFrame: number;
}

export interface ActiveHydraMinion {
  x: number;
  y: number;
  lifeTicks: number;
  maxLifeTicks: number; // 250 ticks = 10.0 seconds
  heads: HydraHeadEntity[];
}

export class CompositeMinionTemplate {
  // 8-direction mouth launch sockets (relative to anchor pivotX: 56, pivotY: 83)
  public static readonly MOUTH_OFFSETS: Record<number, [number, number]> = {
    7: [+44, -43], // East (E)
    3: [+20, -21], // South-East (SE)
    4: [-22, -13], // South (S)
    0: [-42, -38], // South-West (SW)
    5: [-41, -47], // West (W)
    1: [-14, -55], // North-West (NW)
    6: [ +1, -62], // North (N)
    2: [+39, -49], // North-East (NE)
  };

  /**
   * Spawns standard triangular isometric Hydra minion.
   */
  public static spawnHydra(x: number, y: number): ActiveHydraMinion {
    return {
      x,
      y,
      lifeTicks: 0,
      maxLifeTicks: 250, // Official Param1 = 250 (10 seconds)
      heads: [
        {
          id: 0, // Rear-left head
          offsetX: -22,
          offsetY: -8,
          dir: 0,
          state: 'idle',
          animFrame: 0,
          animTimer: 0,
          attackCooldown: 15,
          fireOffsetX: -11,
          fireOffsetY: -6,
          fireFrame: 0,
        },
        {
          id: 1, // Foreground-center head
          offsetX: 0,
          offsetY: 6,
          dir: 4,
          state: 'idle',
          animFrame: 2,
          animTimer: 0,
          attackCooldown: 25,
          fireOffsetX: -10,
          fireOffsetY: -6,
          fireFrame: 4,
        },
        {
          id: 2, // Rear-right head
          offsetX: 22,
          offsetY: -8,
          dir: 3,
          state: 'idle',
          animFrame: 4,
          animTimer: 0,
          attackCooldown: 35,
          fireOffsetX: -8,
          fireOffsetY: -6,
          fireFrame: 8,
        },
      ],
    };
  }

  /**
   * Computes precise coordinates for fire bolt emission from head mouth socket.
   */
  public static getMouthPosition(
    baseX: number,
    baseY: number,
    head: HydraHeadEntity,
    targetX: number,
    targetY: number
  ): { sx: number; sy: number } {
    const headX = baseX + head.offsetX;
    const headY = baseY + head.offsetY;
    const socket = this.MOUTH_OFFSETS[head.dir] || [0, -35];

    // Forward push 4px along the target vector
    const dx = targetX - (headX + socket[0]);
    const dy = targetY - (headY + socket[1]);
    const dist = Math.hypot(dx, dy) || 1;

    return {
      sx: headX + socket[0] + (dx / dist) * 4,
      sy: headY + socket[1] + (dy / dist) * 4,
    };
  }
}

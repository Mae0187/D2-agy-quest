// =======================================================================
// Diablo II 通用方向解析器 (Direction Resolver)
// 支援 16 方向直飛投射物 與 8 方向九頭海蛇原廠 DCC 行映射
// =======================================================================

export interface DirectionMapping {
  count: number;
  resolveRow(screenAngleDeg: number): number;
}

// 16 方向 DCC 行順序 (Row -> Angle)
const ROW_ANGLES_16: [number, number][] = [
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

// 8 方向九頭海蛇原廠 DCC 行順序 [0:SW, 1:NW, 2:NE, 3:SE, 4:S, 5:W, 6:N, 7:E]
const ROW_ANGLES_8_HYDRA: [number, number][] = [
  [7, 0.0],   // 東
  [3, 45.0],  // 東南
  [4, 90.0],  // 南
  [0, 135.0], // 西南
  [5, 180.0], // 西
  [1, 225.0], // 西北
  [6, 270.0], // 北
  [2, 315.0], // 東北
];

export class DirectionResolver {
  public static resolve16(screenAngleDeg: number): number {
    const a = ((screenAngleDeg % 360) + 360) % 360;
    let bestRow = 7;
    let bestDiff = 999;
    for (const [r, ra] of ROW_ANGLES_16) {
      const diff = Math.abs(((ra - a + 180) % 360) - 180);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestRow = r;
      }
    }
    return bestRow;
  }

  public static resolve8Hydra(screenAngleDeg: number): number {
    const a = ((screenAngleDeg % 360) + 360) % 360;
    let bestRow = 7;
    let bestDiff = 999;
    for (const [r, ra] of ROW_ANGLES_8_HYDRA) {
      const diff = Math.abs(((ra - a + 180) % 360) - 180);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestRow = r;
      }
    }
    return bestRow;
  }

  public static resolveSequential16(screenAngleDeg: number): number {
    const a = ((screenAngleDeg % 360) + 360) % 360;
    return Math.round(a / 22.5) % 16;
  }

  public static resolve(preset: string, screenAngleDeg: number): number {
    if (preset === 'dcc_8_hydra') return this.resolve8Hydra(screenAngleDeg);
    if (preset === 'sequential_16') return this.resolveSequential16(screenAngleDeg);
    if (preset === 'standard_32') return this.resolve32(screenAngleDeg);
    return this.resolve16(screenAngleDeg);
  }

  public static resolve32(screenAngleDeg: number): number {
    const headingDeg = (screenAngleDeg + 90) % 360;
    const sector = Math.round(((headingDeg - 180 + 360) % 360) / (360 / 64)) % 64;
    const DIR32_TABLE = [
      4, 16, 16, 8, 8, 17, 17, 0, 0, 18, 18, 9, 9, 19, 19, 5,
      5, 20, 20, 10, 10, 21, 21, 1, 1, 22, 22, 11, 11, 23, 23, 6,
      6, 24, 24, 12, 12, 25, 25, 2, 2, 26, 26, 13, 13, 27, 27, 7,
      7, 28, 28, 14, 14, 29, 29, 3, 3, 30, 30, 15, 15, 31, 31, 4
    ];
    return DIR32_TABLE[sector];
  }

  public static angleToDirection16(rad: number, preset?: string): number {
    const deg = ((rad * 180 / Math.PI) + 360) % 360;
    if (preset === 'sequential_16') return this.resolveSequential16(deg);
    return this.resolve16(deg);
  }

  public static angleToDirection32(rad: number): number {
    const deg = ((rad * 180 / Math.PI) + 360) % 360;
    return this.resolve32(deg);
  }
}



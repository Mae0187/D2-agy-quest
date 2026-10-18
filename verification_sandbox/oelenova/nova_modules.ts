// =======================================================================
// D2 Electric Nova 模組化幾何與渲染架構 (Nova Decoupled Architecture)
// 遵循 suggestions/Oelenova.txt 第七階段職責劃分
// =======================================================================

export interface NovaAtlasMeta {
  cellW: number;
  cellH: number;
  pivotX: number;
  pivotY: number;
  frames: number;
  dirs: number;
  blendMode: string;
}

export const DEFAULT_NOVA_META: NovaAtlasMeta = {
  cellW: 72,
  cellH: 50,
  pivotX: 36,
  pivotY: 26,
  frames: 13,
  dirs: 16,
  blendMode: 'lighter'
};

// ── 1. DirectionResolver (方向解析器) ──
// 暴雪原廠 DCC 16 方向標準幾何角 (0=East 順時針推進，每步 22.5 度)
// DCC 行索引與螢幕幾何角 (Degrees) 對照表
export const DCC_16_ANGLES: { row: number; deg: number; label: string }[] = [
  { row: 7,  deg: 0.0,   label: 'E' },
  { row: 14, deg: 22.5,  label: 'ESE' },
  { row: 3,  deg: 45.0,  label: 'SE' },
  { row: 15, deg: 67.5,  label: 'SSE' },
  { row: 4,  deg: 90.0,  label: 'S' },
  { row: 8,  deg: 112.5, label: 'SSW' },
  { row: 0,  deg: 135.0, label: 'SW' },
  { row: 9,  deg: 157.5, label: 'WSW' },
  { row: 5,  deg: 180.0, label: 'W' },
  { row: 10, deg: 202.5, label: 'WNW' },
  { row: 1,  deg: 225.0, label: 'NW' },
  { row: 11, deg: 247.5, label: 'NNW' },
  { row: 6,  deg: 270.0, label: 'N' },
  { row: 12, deg: 292.5, label: 'NNE' },
  { row: 2,  deg: 315.0, label: 'NE' },
  { row: 13, deg: 337.5, label: 'ENE' }
];

export class DirectionResolver {
  public static resolveDcc16(angleDeg: number): { row: number; diff: number; label: string } {
    const a = ((angleDeg % 360) + 360) % 360;
    let best = DCC_16_ANGLES[0];
    let minDiff = 999;
    for (const item of DCC_16_ANGLES) {
      const diff = Math.abs(((item.deg - a + 180) % 360) - 180);
      if (diff < minDiff) {
        minDiff = diff;
        best = item;
      }
    }
    return { row: best.row, diff: minDiff, label: best.label };
  }
}

// ── 2. NovaGeometry (幾何與弧長查找表) ──
export class NovaGeometry {
  public radiusX: number;
  public radiusY: number;
  public isoRatio: number;
  public lutAngles: number[] = [];
  public lutCumDist: number[] = [];
  public totalPerimeter: number = 0;

  constructor(radiusX: number, isoRatio: number = 0.54) {
    this.radiusX = radiusX;
    this.isoRatio = isoRatio;
    this.radiusY = radiusX * isoRatio;
    this.buildArcLengthLut(180);
  }

  // 預先計算 180 個區間的累積弧長 LUT (Arc-Length Parameterization)
  private buildArcLengthLut(steps: number): void {
    this.lutAngles = [0];
    this.lutCumDist = [0];
    let cum = 0;
    let prevX = this.radiusX;
    let prevY = 0;

    for (let i = 1; i <= steps; i++) {
      const theta = (i / steps) * Math.PI * 2;
      const x = this.radiusX * Math.cos(theta);
      const y = this.radiusY * Math.sin(theta);
      const ds = Math.hypot(x - prevX, y - prevY);
      cum += ds;
      this.lutAngles.push(theta);
      this.lutCumDist.push(cum);
      prevX = x;
      prevY = y;
    }
    this.totalPerimeter = cum;
  }

  // 給定目標累積距離，透過二分搜尋取得對應的參數角 theta
  public getAngleAtDistance(dist: number): number {
    const d = dist % this.totalPerimeter;
    let low = 0;
    let high = this.lutCumDist.length - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this.lutCumDist[mid] < d) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idx = Math.max(1, low);
    const d0 = this.lutCumDist[idx - 1];
    const d1 = this.lutCumDist[idx];
    const t0 = this.lutAngles[idx - 1];
    const t1 = this.lutAngles[idx];
    const frac = (d1 > d0) ? (d - d0) / (d1 - d0) : 0;
    return t0 + (t1 - t0) * frac;
  }
}

// ── 3. RingSampler (等距環形取樣器) ──
export interface SamplePoint {
  x: number;
  y: number;
  theta: number;
  radialAngleDeg: number;
  dccRow: number;
  neighborDist: number;
}

export class RingSampler {
  public static sampleEqualArc(
    centerX: number,
    centerY: number,
    geom: NovaGeometry,
    targetSpacing: number = 10
  ): SamplePoint[] {
    const count = Math.max(16, Math.round(geom.totalPerimeter / targetSpacing));
    const stepDist = geom.totalPerimeter / count;
    const points: SamplePoint[] = [];

    for (let i = 0; i < count; i++) {
      const dist = i * stepDist;
      const theta = geom.getAngleAtDistance(dist);
      const px = centerX + geom.radiusX * Math.cos(theta);
      const py = centerY + geom.radiusY * Math.sin(theta);

      // 徑向發散角 (以未壓縮的真實幾何角計算方向)
      const radialDeg = (Math.atan2(Math.sin(theta), Math.cos(theta)) * 180 / Math.PI + 360) % 360;
      const { row } = DirectionResolver.resolveDcc16(radialDeg);

      points.push({
        x: px,
        y: py,
        theta,
        radialAngleDeg: radialDeg,
        dccRow: row,
        neighborDist: stepDist
      });
    }

    return points;
  }

  // 原版 64 顆獨立飛彈等角度取樣模式 (對照測試用)
  public static sampleAuthentic64(
    centerX: number,
    centerY: number,
    geom: NovaGeometry,
    count: number = 64
  ): SamplePoint[] {
    const points: SamplePoint[] = [];
    for (let i = 0; i < count; i++) {
      const theta = (i / count) * Math.PI * 2;
      const px = centerX + geom.radiusX * Math.cos(theta);
      const py = centerY + geom.radiusY * Math.sin(theta);
      const radialDeg = (theta * 180 / Math.PI + 360) % 360;
      const { row } = DirectionResolver.resolveDcc16(radialDeg);
      points.push({
        x: px,
        y: py,
        theta,
        radialAngleDeg: radialDeg,
        dccRow: row,
        neighborDist: 0
      });
    }
    // 計算相鄰點距離
    for (let i = 0; i < count; i++) {
      const next = points[(i + 1) % count];
      points[i].neighborDist = Math.hypot(next.x - points[i].x, next.y - points[i].y);
    }
    return points;
  }
}

// ── 4. NovaMetrics (間距與指標診斷器) ──
export interface NovaMetricsResult {
  instanceCount: number;
  minNeighborDist: number;
  maxNeighborDist: number;
  avgNeighborDist: number;
  maxVisibleGap: number;
  perimeter: number;
}

export class NovaMetrics {
  public static compute(samples: SamplePoint[], perimeter: number, spriteCoverage: number = 26): NovaMetricsResult {
    if (samples.length === 0) {
      return { instanceCount: 0, minNeighborDist: 0, maxNeighborDist: 0, avgNeighborDist: 0, maxVisibleGap: 0, perimeter: 0 };
    }

    let minDist = 9999;
    let maxDist = 0;
    let sumDist = 0;

    for (let i = 0; i < samples.length; i++) {
      const d = samples[i].neighborDist;
      if (d < minDist) minDist = d;
      if (d > maxDist) maxDist = d;
      sumDist += d;
    }

    const avgDist = sumDist / samples.length;
    const maxGap = Math.max(0, maxDist - spriteCoverage);

    return {
      instanceCount: samples.length,
      minNeighborDist: parseFloat(minDist.toFixed(2)),
      maxNeighborDist: parseFloat(maxDist.toFixed(2)),
      avgNeighborDist: parseFloat(avgDist.toFixed(2)),
      maxVisibleGap: parseFloat(maxGap.toFixed(2)),
      perimeter: parseFloat(perimeter.toFixed(2))
    };
  }
}

// ── 5. SpriteComposer & Renderer (繪製合成器) ──
export class SpriteComposer {
  public static renderRing(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    meta: NovaAtlasMeta,
    samples: SamplePoint[],
    animFrame: number,
    alpha: number = 1.0,
    blendMode: GlobalCompositeOperation = 'lighter'
  ): void {
    if (!image || !image.complete) return;

    ctx.save();
    ctx.globalCompositeOperation = blendMode;
    ctx.globalAlpha = alpha;

    const frame = animFrame % meta.frames;

    for (const pt of samples) {
      const sx = frame * meta.cellW;
      const sy = pt.dccRow * meta.cellH;
      const dx = Math.round(pt.x - meta.pivotX);
      const dy = Math.round(pt.y - meta.pivotY);

      ctx.drawImage(
        image,
        sx, sy, meta.cellW, meta.cellH,
        dx, dy, meta.cellW, meta.cellH
      );
    }

    ctx.restore();
  }
}

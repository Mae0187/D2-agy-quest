// spiral.ts — 與 3-B 介面無關的純函式，可直接單元測試
export const SP = { THETA: 0, R: 1, CX: 2, CY: 3, DIR: 4, SIZE: 5 } as const;

export interface SpiralParams {
  r0: number;         // 起始半徑（地面 px）
  b: number;          // 每弧度徑向增量（地面 px/rad），須 > 0
  speed: number;      // 沿弧線速度（地面 px/Tick）
  rMax: number;       // 半徑達此值即結束
  maxDTheta: number;  // 單 Tick 最大角增量（rad）
  ySquash: number;    // 0.5
}

export interface SpiralOut { x: number; y: number; phi: number; done: boolean }

/** 生成時呼叫一次。cx, cy 為圓心（通常 = 施法者/生成點，螢幕座標） */
export function spiralInit(
  s: ArrayLike<number> & { [i: number]: number }, o: number,
  cx: number, cy: number, theta0: number, dir: 1 | -1, p: SpiralParams,
): void {
  s[o + SP.THETA] = theta0;
  s[o + SP.R] = p.r0;
  s[o + SP.CX] = cx;
  s[o + SP.CY] = cy;
  s[o + SP.DIR] = dir;
}

/** 每 Tick 呼叫一次；結果寫入 out（無配置） */
export function spiralStep(
  s: ArrayLike<number> & { [i: number]: number }, o: number,
  p: SpiralParams, out: SpiralOut,
): void {
  const r = s[o + SP.R]!;
  const dir = s[o + SP.DIR]!;
  const dTheta = Math.min(p.speed / Math.hypot(r, p.b), p.maxDTheta);

  const theta = s[o + SP.THETA]! + dir * dTheta;
  const nr = r + p.b * dTheta;
  s[o + SP.THETA] = theta;
  s[o + SP.R] = nr;

  const c = Math.cos(theta), sn = Math.sin(theta);
  out.x = s[o + SP.CX]! + nr * c;
  out.y = s[o + SP.CY]! + nr * sn * p.ySquash;

  out.phi = Math.atan2(p.b * sn + dir * nr * c, p.b * c - dir * nr * sn);
  out.done = nr >= p.rMax;
}

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
d2_proj_toolkit.py  —  Diablo II LoD 1.13c 投射物 / 施法時序 前端中繼資料工具

  1. Union-Box 圖集封裝（零裁切、統一 cell / pivot、逐幀精確座標）
  2. PCA 頭尾特徵點 + 180° 歧義消除 + 方向映射表自動校準 + 自檢
  3. AnimData.d2 解析（256 hash bucket）→ 真實幀數 / 速率 / 事件幀
  4. 標準 JSON 導出

座標約定（全部相同）：
  * 世界座標：原點 = 單位錨點（DCC 的 (0,0)），x 向右，y 向下，單位 = 像素，
    像素中心 = (整數索引 + 0.5)。
  * cell 座標 = 世界座標 + (pivot_x, pivot_y)，可直接用於 UV。
  * axisDeg：螢幕座標角度，0°=+x(右)，90°=+y(畫面向下)，即順時針為正，範圍 [0,360)。
    另附 axisDegCCW（y 向上、逆時針為正）與 isoAxisDeg（y 方向 ×2 還原到地面空間）。
"""
from __future__ import annotations

import argparse
import json
import math
import struct
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np
from PIL import Image

TOOL_VERSION = "1.0.0"
SCHEMA_VERSION = 1


# ════════════════════════════════════════════════════════════════════════════
# 共用小工具
# ════════════════════════════════════════════════════════════════════════════
def wrap180(a: float) -> float:
    return (a + 180.0) % 360.0 - 180.0


def wrap360(a: float) -> float:
    return a % 360.0


def _r(x, n: int = 3):
    return None if x is None else round(float(x), n)


def next_pow2(n: int) -> int:
    p = 1
    while p < n:
        p <<= 1
    return p


def weighted_quantile(values: np.ndarray, weights: np.ndarray, q: float) -> float:
    order = np.argsort(values)
    v = values[order]
    w = weights[order]
    cdf = (np.cumsum(w) - 0.5 * w) / w.sum()
    return float(np.interp(q, cdf, v))


# ════════════════════════════════════════════════════════════════════════════
# Part 1  全域聯集盒圖集封裝器
# ════════════════════════════════════════════════════════════════════════════
@dataclass
class SrcFrame:
    direction: int
    frame: int
    pixels: np.ndarray        # H x W x (3|4) uint8
    offset_x: int             # 影格左邊界相對世界原點的 x
    offset_y: int             # y_mode="top"：上邊界；y_mode="bottom"：下邊界（DCC 原始語意）


@dataclass
class NormFrame:
    direction: int
    frame: int
    pixels: np.ndarray        # 去除透明邊後的 RGBA
    x0: int                   # 內容左上角（世界座標）
    y0: int
    w: int
    h: int
    empty: bool
    src_offset: Tuple[int, int]


def _to_rgba(arr: np.ndarray) -> np.ndarray:
    arr = np.asarray(arr)
    if arr.dtype != np.uint8:
        arr = np.clip(arr, 0, 255).astype(np.uint8)
    if arr.ndim != 3 or arr.shape[2] not in (3, 4):
        raise ValueError(f"像素陣列必須是 HxWx3 或 HxWx4，收到 {arr.shape}")
    if arr.shape[2] == 3:
        alpha = np.full(arr.shape[:2] + (1,), 255, np.uint8)
        arr = np.concatenate([arr, alpha], axis=2)
    return np.ascontiguousarray(arr)


def normalize_frame(f: SrcFrame, y_mode: str, trim_alpha: bool, alpha_thr: int) -> NormFrame:
    if y_mode not in ("top", "bottom"):
        raise ValueError("y_mode 必須是 'top' 或 'bottom'")
    px = _to_rgba(f.pixels)
    h, w = px.shape[:2]
    x0 = int(f.offset_x)
    y0 = int(f.offset_y) - h if y_mode == "bottom" else int(f.offset_y)
    if trim_alpha:
        ys, xs = np.nonzero(px[..., 3] > alpha_thr)
        if xs.size == 0:
            return NormFrame(f.direction, f.frame, px[:0, :0], x0, y0, 0, 0, True,
                             (f.offset_x, f.offset_y))
        l, r = int(xs.min()), int(xs.max()) + 1
        t, b = int(ys.min()), int(ys.max()) + 1
        px = np.ascontiguousarray(px[t:b, l:r])
        x0 += l
        y0 += t
        h, w = px.shape[:2]
    return NormFrame(f.direction, f.frame, px, x0, y0, w, h, False, (f.offset_x, f.offset_y))


@dataclass
class PackResult:
    atlas: np.ndarray
    layout: dict
    records: Dict[Tuple[int, int], dict]
    norm: Dict[Tuple[int, int], NormFrame]


def pack_atlas(frames: Sequence[SrcFrame], *, y_mode: str = "top", trim_alpha: bool = True,
               alpha_threshold: int = 0, padding: int = 1, max_texture: int = 4096,
               pot: bool = False, symmetric: bool = False) -> PackResult:
    """
    以所有方向×所有幀的聯集包圍盒決定統一 cell 尺寸；每幀按自身 offset 放入 cell，
    因此世界原點在每個 cell 內都在同一個 (pivot_x, pivot_y)，保證零裁切。
    symmetric=True 時聯集盒對原點對稱擴張（pivot 落在 cell 正中央，便於旋轉）。
    """
    if not frames:
        raise ValueError("沒有輸入幀")
    norm: Dict[Tuple[int, int], NormFrame] = {}
    for f in frames:
        key = (f.direction, f.frame)
        if key in norm:
            raise ValueError(f"重複的幀 {key}")
        norm[key] = normalize_frame(f, y_mode, trim_alpha, alpha_threshold)

    solid = [n for n in norm.values() if not n.empty]
    if not solid:
        raise ValueError("所有幀都完全透明")
    minx = min(n.x0 for n in solid)
    miny = min(n.y0 for n in solid)
    maxx = max(n.x0 + n.w for n in solid)
    maxy = max(n.y0 + n.h for n in solid)
    if symmetric:
        hx, hy = max(-minx, maxx), max(-miny, maxy)
        minx, maxx, miny, maxy = -hx, hx, -hy, hy

    cell_w = (maxx - minx) + 2 * padding
    cell_h = (maxy - miny) + 2 * padding
    pivot_x = -minx + padding
    pivot_y = -miny + padding

    dirs = sorted({k[0] for k in norm})
    fpd = max(k[1] for k in norm) + 1
    columns = fpd if fpd * cell_w <= max_texture else max(1, max_texture // cell_w)
    rows_per_dir = math.ceil(fpd / columns)
    atlas_w = columns * cell_w
    atlas_h = len(dirs) * rows_per_dir * cell_h
    if pot:
        atlas_w, atlas_h = next_pow2(atlas_w), next_pow2(atlas_h)
    if atlas_w > max_texture or atlas_h > max_texture:
        raise ValueError(f"圖集 {atlas_w}x{atlas_h} 超過 max_texture={max_texture}；"
                         f"cell={cell_w}x{cell_h}。請提高 --max-texture 或改為多圖集。")

    atlas = np.zeros((atlas_h, atlas_w, 4), np.uint8)
    records: Dict[Tuple[int, int], dict] = {}
    for (d, fi), n in sorted(norm.items()):
        row = dirs.index(d) * rows_per_dir + fi // columns
        col = fi % columns
        cx, cy = col * cell_w, row * cell_h
        lx, ly = n.x0 - minx + padding, n.y0 - miny + padding   # 內容在 cell 內的位置
        if not n.empty:
            assert 0 <= lx and lx + n.w <= cell_w and 0 <= ly and ly + n.h <= cell_h
            atlas[cy + ly: cy + ly + n.h, cx + lx: cx + lx + n.w] = n.pixels
        records[(d, fi)] = {
            "dir": d, "frame": fi, "empty": n.empty,
            "atlas": {"x": cx, "y": cy, "w": cell_w, "h": cell_h},
            "content": {"x": lx, "y": ly, "w": n.w, "h": n.h},
            "contentAtlas": {"x": cx + lx, "y": cy + ly, "w": n.w, "h": n.h},
            "worldRect": {"x": n.x0, "y": n.y0, "w": n.w, "h": n.h},
            "sourceOffset": {"x": n.src_offset[0], "y": n.src_offset[1]},
        }

    layout = {
        "cell_w": cell_w, "cell_h": cell_h,
        "pivot_x": pivot_x, "pivot_y": pivot_y,
        "pivotNorm": {"x": _r(pivot_x / cell_w, 6), "y": _r(pivot_y / cell_h, 6)},
        "unionBox": {"minX": minx, "minY": miny, "maxX": maxx, "maxY": maxy,
                     "w": maxx - minx, "h": maxy - miny},
        "padding": padding, "symmetric": symmetric,
        "yMode": y_mode, "trimAlpha": trim_alpha, "alphaThreshold": alpha_threshold,
        "columns": columns, "rowsPerDir": rows_per_dir,
        "directions": dirs, "directionCount": len(dirs), "framesPerDir": fpd,
        "width": atlas_w, "height": atlas_h,
    }
    return PackResult(atlas, layout, records, norm)


def verify_atlas(res: PackResult) -> None:
    """逐幀位元級比對 + 全圖 alpha 質量守恆，任何裁切 / 錯位都會 raise。"""
    total_src = 0
    for key, n in res.norm.items():
        if n.empty:
            continue
        c = res.records[key]["contentAtlas"]
        crop = res.atlas[c["y"]:c["y"] + c["h"], c["x"]:c["x"] + c["w"]]
        if not np.array_equal(crop, n.pixels):
            raise AssertionError(f"圖集內容與來源不一致：{key}")
        total_src += int(n.pixels[..., 3].astype(np.int64).sum())
    if int(res.atlas[..., 3].astype(np.int64).sum()) != total_src:
        raise AssertionError("圖集 alpha 總量與來源不符（有裁切或溢出）")


# ════════════════════════════════════════════════════════════════════════════
# Part 2  PCA 頭尾特徵 / 方向校準
# ════════════════════════════════════════════════════════════════════════════
@dataclass
class PcaParams:
    alpha_threshold: int = 8
    min_pixels: int = 6
    lum_power: float = 0.5       # PCA 質量權重 = alpha * (lum+eps)^lum_power；0 = 純輪廓
    w_lum: float = 1.0           # 頭尾判定：亮度重心偏移權重
    w_skew: float = 1.0          # 頭尾判定：偏度權重（質量集中端 = 頭，長拖尾端 = 尾）
    tail_quantile: float = 0.03  # 尾焰點：質量分位
    tip_quantile: float = 0.005  # 頭 / 尾極端點分位


@dataclass
class FrameStat:
    direction: int
    frame: int
    c: np.ndarray
    v: np.ndarray                # 單位主軸（符號任意）
    l1: float
    l2: float
    elongation: float
    conf: float
    score: float                 # >0 → 頭在 +v 側
    skew: float
    z_lum: float
    mass: float
    n_pixels: int
    t: np.ndarray                # 各像素沿 v 的投影
    w: np.ndarray                # 質量權重
    wl: np.ndarray               # 亮度核心權重


def analyze_frame(n: NormFrame, p: PcaParams) -> Optional[FrameStat]:
    if n.empty:
        return None
    rgba = n.pixels
    ys, xs = np.nonzero(rgba[..., 3] > p.alpha_threshold)
    if xs.size < p.min_pixels:
        return None
    al = rgba[ys, xs, 3].astype(np.float64) / 255.0
    lum = rgba[ys, xs, :3].astype(np.float64).max(axis=1) / 255.0
    w = al * (lum + 1e-3) ** p.lum_power
    wl = al * lum ** 2 + 1e-12
    X = xs + n.x0 + 0.5
    Y = ys + n.y0 + 0.5
    m = w.sum()
    cx, cy = (w * X).sum() / m, (w * Y).sum() / m
    dx, dy = X - cx, Y - cy
    reg = 1.0 / 12.0                       # 像素方塊本身的變異數，避免退化
    sxx = (w * dx * dx).sum() / m + reg
    syy = (w * dy * dy).sum() / m + reg
    sxy = (w * dx * dy).sum() / m
    evals, evecs = np.linalg.eigh(np.array([[sxx, sxy], [sxy, syy]]))
    l2, l1 = float(evals[0]), float(evals[1])
    v = evecs[:, 1].astype(np.float64)
    v /= np.linalg.norm(v)
    t = dx * v[0] + dy * v[1]
    sigma = math.sqrt(max(l1, 1e-12))
    skew = float((w * t ** 3).sum() / m / sigma ** 3)
    t_lum = float((wl * t).sum() / wl.sum())
    z_lum = t_lum / sigma
    score = p.w_lum * z_lum - p.w_skew * skew
    elong = math.sqrt(l1 / max(l2, 1e-12))
    conf = 1.0 - 1.0 / max(elong, 1.0)
    return FrameStat(n.direction, n.frame, np.array([cx, cy]), v, l1, l2, elong, conf,
                     float(score), skew, float(z_lum), float(m), int(xs.size), t, w, wl)


def frame_geometry(st: FrameStat, sign: int, p: PcaParams) -> dict:
    """依指定頭方向（sign * v）解出 axisDeg / 彈頭核心點 / 尾焰點 / 基準線。"""
    hv = st.v * sign
    th = st.t * sign
    sel = th >= 0
    if sel.any() and st.wl[sel].sum() > 0:
        head_t = float((st.wl[sel] * th[sel]).sum() / st.wl[sel].sum())
    else:
        head_t = float(th.max())
    tail_t = weighted_quantile(th, st.w, p.tail_quantile)
    head_tip_t = weighted_quantile(th, st.w, 1.0 - p.tip_quantile)
    tail_tip_t = weighted_quantile(th, st.w, p.tip_quantile)
    pt = lambda tt: st.c + hv * tt
    head, tail = pt(head_t), pt(tail_t)
    hdeg = wrap360(math.degrees(math.atan2(hv[1], hv[0])))
    return {
        "axisDeg": hdeg,
        "head": head, "tail": tail,
        "headTip": pt(head_tip_t), "tailTip": pt(tail_tip_t),
        "centroid": st.c.copy(),
        "length": head_t - tail_t,
        "hv": hv,
    }


@dataclass
class DirAnalysis:
    direction: int
    stats: Dict[int, FrameStat]
    base_sign: Dict[int, int]          # 每幀相對自身 v 的頭方向（含方向內共識）
    g: int = 1                         # 全域校準的整方向翻轉（±1）
    agreement: float = 1.0
    vote: float = 0.0
    u_ref: np.ndarray = field(default_factory=lambda: np.array([1.0, 0.0]))

    def sign(self, f: int) -> int:
        return self.base_sign[f] * self.g

    def head_vecs(self) -> Dict[int, np.ndarray]:
        return {f: s.v * self.sign(f) for f, s in self.stats.items()}

    def conf(self) -> float:
        return float(np.mean([s.conf for s in self.stats.values()]))

    def mean_vec(self) -> np.ndarray:
        hv = self.head_vecs()
        acc = sum((self.stats[f].conf + 1e-3) * hv[f] for f in hv)
        return acc / np.linalg.norm(acc)

    def mean_angle(self) -> float:
        m = self.mean_vec()
        return wrap360(math.degrees(math.atan2(m[1], m[0])))

    def spread(self) -> float:
        ma = self.mean_angle()
        return max(abs(wrap180(math.degrees(math.atan2(v[1], v[0])) - ma))
                   for v in self.head_vecs().values())


def analyze_direction(d: int, stats: Dict[int, Optional[FrameStat]],
                      consensus: bool = True) -> Optional[DirAnalysis]:
    fr = {f: s for f, s in stats.items() if s is not None}
    if not fr:
        return None
    # 主軸（mod 180°）以倍角法做圓周平均 → 參考軸 u_ref
    z = sum((s.conf + 1e-3) * np.exp(2j * math.atan2(s.v[1], s.v[0])) for s in fr.values())
    if abs(z) < 1e-12:
        z = np.exp(2j * math.atan2(*next(iter(fr.values())).v[::-1]))
    phi = float(np.angle(z)) / 2.0
    u = np.array([math.cos(phi), math.sin(phi)])
    aligned = {f: (1 if float(s.v @ u) >= 0 else -1) for f, s in fr.items()}
    vote = sum((s.conf + 1e-3) * aligned[f] * s.score for f, s in fr.items())
    sigma = 1 if vote >= 0 else -1
    if consensus:
        base = {f: sigma * aligned[f] for f in fr}
    else:
        base = {f: (1 if s.score >= 0 else -1) for f, s in fr.items()}
    voters = [(f, s) for f, s in fr.items() if abs(s.score) > 1e-6]
    if voters:
        agree = sum(1 for f, s in voters if (aligned[f] * s.score > 0) == (sigma > 0)) / len(voters)
    else:
        agree = 0.0
    return DirAnalysis(d, fr, base, 1, agree, float(vote), u)


def _angle_in_space(vec: np.ndarray, space: str) -> float:
    if space == "iso":
        return wrap360(math.degrees(math.atan2(2.0 * vec[1], vec[0])))
    return wrap360(math.degrees(math.atan2(vec[1], vec[0])))


def fit_slots(theta: Dict[int, float], conf: Dict[int, float], fix: bool = True) -> dict:
    """
    與方向索引順序無關的校準：N 個方向應在圓上等分（步距 360/N）。
    a0 由 N 倍角圓周平均求得（N 為偶數時對 180° 翻轉不變）。
    若兩個方向落入同一槽位，且對面槽位空缺 → 信心較低者判為 180° 翻轉並修正。
    """
    keys = sorted(theta)
    N = len(keys)
    step = 360.0 / N
    th = {k: float(theta[k]) for k in keys}
    z = sum((conf[k] + 1e-3) * np.exp(1j * math.radians(N * th[k])) for k in keys)
    a0 = math.degrees(float(np.angle(z))) / N
    slot_of = lambda t: int(round(wrap180(t - a0) / step)) % N
    slots = {k: slot_of(th[k]) for k in keys}
    flips = set()
    if fix and N % 2 == 0:
        for _ in range(N):
            occ: Dict[int, List[int]] = {}
            for k in keys:
                occ.setdefault(slots[k], []).append(k)
            done = True
            for s, ks in occ.items():
                if len(ks) > 1:
                    loser = min(ks, key=lambda k: conf[k])
                    opp = (s + N // 2) % N
                    if opp not in occ:
                        th[loser] = wrap360(th[loser] + 180.0)
                        slots[loser] = opp
                        flips ^= {loser}
                        done = False
                        break
            if done:
                break
    res = {k: wrap180(th[k] - (a0 + slots[k] * step)) for k in keys}
    return {"N": N, "step": step, "a0": a0, "slots": slots, "res": res, "flips": flips,
            "unique": len(set(slots.values())), "maxRes": max(abs(r) for r in res.values())}


@dataclass
class Calibration:
    space: str
    fit: dict
    slot_to_dir: List[Optional[int]]
    collisions: List[List[int]]


def calibrate_directions(dirs: Dict[int, DirAnalysis], space: str = "auto") -> Calibration:
    spaces = ["iso", "screen"] if space == "auto" else [space]
    best = None
    for sp in spaces:
        theta = {d: _angle_in_space(a.mean_vec(), sp) for d, a in dirs.items()}
        conf = {d: a.conf() for d, a in dirs.items()}
        fit = fit_slots(theta, conf, fix=True)
        key = (len(dirs) - fit["unique"], fit["maxRes"])
        if best is None or key < best[0]:
            best = (key, sp, fit)
    _, sp, fit = best
    for d in fit["flips"]:
        dirs[d].g *= -1
    theta = {d: _angle_in_space(a.mean_vec(), sp) for d, a in dirs.items()}
    conf = {d: a.conf() for d, a in dirs.items()}
    final = fit_slots(theta, conf, fix=False)
    final["flips"] = set(fit["flips"])
    N = final["N"]
    slot_to_dir: List[Optional[int]] = [None] * N
    occ: Dict[int, List[int]] = {}
    for d, s in final["slots"].items():
        occ.setdefault(s, []).append(d)
    collisions = []
    for s, ds in occ.items():
        ds = sorted(ds, key=lambda d: -conf[d])
        slot_to_dir[s] = ds[0]
        if len(ds) > 1:
            collisions.append(sorted(ds))
    return Calibration(sp, final, slot_to_dir, collisions)


def run_pca_pipeline(norm: Dict[Tuple[int, int], NormFrame], layout: dict, p: PcaParams,
                     consensus: bool, space: str, tol: dict) -> dict:
    per_dir: Dict[int, Dict[int, Optional[FrameStat]]] = {}
    for (d, f), n in sorted(norm.items()):
        per_dir.setdefault(d, {})[f] = analyze_frame(n, p)
    dirs: Dict[int, DirAnalysis] = {}
    for d, st in per_dir.items():
        a = analyze_direction(d, st, consensus)
        if a is not None:
            dirs[d] = a
    if not dirs:
        raise ValueError("PCA：沒有任何可分析的幀")
    cal = calibrate_directions(dirs, space)
    px, py = layout["pivot_x"], layout["pivot_y"]
    N, step, a0 = cal.fit["N"], cal.fit["step"], cal.fit["a0"]

    dir_out, map_rows = {}, []
    for d in sorted(dirs):
        a = dirs[d]
        mv = a.mean_vec()
        mean_deg = a.mean_angle()
        frames_out, heads, tails = {}, [], []
        for f in sorted(a.stats):
            st = a.stats[f]
            g = frame_geometry(st, a.sign(f), p)
            hx, hy = g["head"]
            tx, ty = g["tail"]
            heads.append(g["head"])
            tails.append(g["tail"])
            frames_out[str(f)] = {
                "axisDeg": _r(g["axisDeg"]),
                "axisDegCCW": _r(wrap360(-g["axisDeg"])),
                "devFromDirMeanDeg": _r(wrap180(g["axisDeg"] - mean_deg)),
                "head_x": _r(hx), "head_y": _r(hy),
                "tail_x": _r(tx), "tail_y": _r(ty),
                "head_cell_x": _r(hx + px), "head_cell_y": _r(hy + py),
                "tail_cell_x": _r(tx + px), "tail_cell_y": _r(ty + py),
                "headTip": [_r(g["headTip"][0]), _r(g["headTip"][1])],
                "tailTip": [_r(g["tailTip"][0]), _r(g["tailTip"][1])],
                "centroid": [_r(g["centroid"][0]), _r(g["centroid"][1])],
                "baselineLength": _r(g["length"]),
                "elongation": _r(st.elongation),
                "confidence": _r(st.conf, 4),
                "headScore": _r(st.score * a.sign(f) * (1 if True else 1) * (1 if st.v @ (st.v * a.sign(f)) > 0 else -1), 4),
                "ownOrientationAgrees": bool(st.score * a.sign(f) > 0),
                "pixels": st.n_pixels,
            }
        hmed = np.median(np.array(heads), axis=0)
        tmed = np.median(np.array(tails), axis=0)
        slot = cal.fit["slots"][d]
        dir_out[str(d)] = {
            "dir": d,
            "axisDeg": _r(mean_deg),
            "headVector": [_r(mv[0], 5), _r(mv[1], 5)],
            "baseline": {"head_x": _r(hmed[0]), "head_y": _r(hmed[1]),
                         "tail_x": _r(tmed[0]), "tail_y": _r(tmed[1]),
                         "length": _r(float(np.linalg.norm(hmed - tmed)))},
            "frames": frames_out,
        }
        map_rows.append({
            "dir": d, "slot": slot,
            "axisDeg": _r(mean_deg),
            "axisDegCCW": _r(wrap360(-mean_deg)),
            "isoAxisDeg": _r(_angle_in_space(mv, "iso")),
            "slotDeg": _r(wrap360(a0 + slot * step)),
            "residualDeg": _r(cal.fit["res"][d]),
            "intraSpreadDeg": _r(a.spread()),
            "orientationAgreement": _r(a.agreement, 4),
            "confidence": _r(a.conf(), 4),
            "flippedByGlobalFit": a.g == -1,
        })

    # ── 自檢 ──
    failures = []
    max_res = cal.fit["maxRes"]
    max_spread = max(a.spread() for a in dirs.values())
    min_agree = min(a.agreement for a in dirs.values())
    min_conf = min(a.conf() for a in dirs.values())
    if len(dirs) != N or cal.fit["unique"] != N or cal.collisions:
        failures.append(f"槽位不唯一/有缺口：unique={cal.fit['unique']}/{N}, collisions={cal.collisions}")
    if max_res > tol["slot"]:
        failures.append(f"等分槽位殘差 {max_res:.2f}° > {tol['slot']}°")
    if max_spread > tol["intra"]:
        failures.append(f"方向內幀間角度離散 {max_spread:.2f}° > {tol['intra']}°")
    if min_agree < tol["agree"]:
        failures.append(f"頭尾投票一致率 {min_agree:.2f} < {tol['agree']}")
    if min_conf < tol["conf"]:
        failures.append(f"存在近圓形（無拖尾）方向，PCA 信心 {min_conf:.2f} < {tol['conf']}")

    return {
        "directionMap": {
            "count": N, "space": cal.space,
            "slotStepDeg": _r(step, 4), "slotZeroDeg": _r(wrap360(a0), 4),
            "angleConvention": "axisDeg: 螢幕座標，0=+x，順時針為正；slotDeg 位於 space 指定空間",
            "byDirection": map_rows,
            "slotToDir": cal.slot_to_dir,
            "flippedDirs": sorted(cal.fit["flips"]),
        },
        "directions": dir_out,
        "selfCheck": {
            "passed": not failures, "failures": failures,
            "maxSlotResidualDeg": _r(max_res), "maxIntraSpreadDeg": _r(max_spread),
            "minOrientationAgreement": _r(min_agree, 4), "minConfidence": _r(min_conf, 4),
            "uniqueSlots": cal.fit["unique"], "thresholds": tol,
        },
    }


# ════════════════════════════════════════════════════════════════════════════
# Part 3  AnimData.d2 解析器
# ════════════════════════════════════════════════════════════════════════════
class AnimDataError(Exception):
    pass


@dataclass
class AnimRecord:
    cof_name: str
    frames_per_direction: int
    speed: int                   # 256 = 每遊戲 tick（1/25 s）前進 1 幀
    speed_extra: int
    events: bytes                # 144 bytes，index = 幀號
    bucket: int

    @property
    def fps(self) -> float:
        return 25.0 * self.speed / 256.0

    def event_frames(self, code: int) -> List[int]:
        n = min(self.frames_per_direction, len(self.events))
        return [i for i in range(n) if self.events[i] == code]


class AnimData:
    """
    animdata.d2 版面（little-endian，無檔頭）：
      256 × bucket：
        uint32 recordCount
        recordCount × 160 bytes：
          char[8]  cof 名稱（7 字元 + NUL，如 'NESCHTH'）
          uint32   framesPerDirection
          uint16   animationSpeed（256 = 25 fps）
          uint16   保留
          uint8[144] events（index=幀號；0 無、1 近戰命中、2 投射物發射、3 音效、4 技能）
      bucket 索引 = (cof 名稱各字元 ASCII 之和) mod 256
    """
    NUM_BUCKETS = 256
    NAME_LEN = 8
    NUM_EVENTS = 144
    RECORD_SIZE = NAME_LEN + 4 + 2 + 2 + NUM_EVENTS      # 160

    def __init__(self):
        self.buckets: List[List[AnimRecord]] = []
        self.by_name: Dict[str, AnimRecord] = {}
        self.hash_mismatch: List[str] = []
        self.trailing_bytes = 0

    @staticmethod
    def hash_name(code: str) -> int:
        return sum(code.upper().encode("ascii")) & 0xFF

    @staticmethod
    def normalize_code(code: str) -> str:
        c = code.strip().upper()
        return c[:-4] if c.endswith(".COF") else c

    @staticmethod
    def compose(token: str, mode: str, weapon: str) -> str:
        return (token + mode + weapon).upper()

    @classmethod
    def parse(cls, data: bytes, strict: bool = True) -> "AnimData":
        ad = cls()
        off, size = 0, len(data)
        for b in range(cls.NUM_BUCKETS):
            if off + 4 > size:
                raise AnimDataError(f"bucket {b}: 檔案在計數欄位處截斷")
            (cnt,) = struct.unpack_from("<I", data, off)
            off += 4
            if cnt > (size - off) // cls.RECORD_SIZE:
                raise AnimDataError(f"bucket {b}: 記錄數 {cnt} 超出檔案範圍（版面不符？）")
            recs = []
            for _ in range(cnt):
                raw = data[off:off + cls.NAME_LEN]
                name = raw.split(b"\0")[0].decode("ascii", "replace").upper()
                fpd, speed, extra = struct.unpack_from("<IHH", data, off + 8)
                ev = bytes(data[off + 16: off + 16 + cls.NUM_EVENTS])
                rec = AnimRecord(name, fpd, speed, extra, ev, b)
                recs.append(rec)
                if cls.hash_name(name) != b:
                    ad.hash_mismatch.append(name)
                ad.by_name.setdefault(name, rec)
                off += cls.RECORD_SIZE
            ad.buckets.append(recs)
        ad.trailing_bytes = size - off
        if strict and ad.trailing_bytes != 0:
            raise AnimDataError(f"解析完 256 個 bucket 後仍有 {ad.trailing_bytes} 位元組殘留，"
                                f"記錄版面可能與假設不符")
        return ad

    @classmethod
    def load(cls, path: str, strict: bool = True) -> "AnimData":
        return cls.parse(Path(path).read_bytes(), strict)

    def get(self, code: str) -> Optional[AnimRecord]:
        code = self.normalize_code(code)
        for rec in self.buckets[self.hash_name(code)]:        # 先走 hash bucket
            if rec.cof_name == code:
                return rec
        return self.by_name.get(code)                         # 退路：全域表

    def info(self, code: str, release_event: int = 2,
             fallback_events: Sequence[int] = ()) -> dict:
        code = self.normalize_code(code)
        rec = self.get(code)
        if rec is None:
            return {"cof": code, "found": False, "bucket": self.hash_name(code)}
        fpd = rec.frames_per_direction
        evs = {str(c): rec.event_frames(c) for c in (1, 2, 3, 4)}
        used, rel = None, None
        for c in (release_event, *fallback_events):
            fr = rec.event_frames(c)
            if fr:
                used, rel = c, fr[0]
                break
        fps = rec.fps
        ms = lambda fr: None if fr is None or fps <= 0 else round(fr * 1000.0 / fps, 2)
        return {
            "cof": rec.cof_name, "found": True, "bucket": rec.bucket,
            "framesPerDirection": fpd,
            "speedRaw": rec.speed, "fps": _r(fps, 4),
            "frameDurationMs": _r(1000.0 / fps, 3) if fps > 0 else None,
            "durationMs": ms(fpd),
            "eventFrames": evs,
            "releaseEventCode": used,
            "releaseFrame": rel,
            "releaseFrameOneBased": None if rel is None else rel + 1,
            "releaseTimeMs": ms(rel),
            "releaseNormalized": None if rel is None or fpd == 0 else _r(rel / fpd, 4),
            "multipleReleaseFrames": evs.get(str(used), []) if used is not None else [],
        }


# ════════════════════════════════════════════════════════════════════════════
# Part 4  JSON 導出
# ════════════════════════════════════════════════════════════════════════════
def build_metadata(name: str, pack: PackResult, atlas_file: str, pca: Optional[dict],
                   anim: dict, source: dict) -> dict:
    lay = pack.layout
    frames_geom = {}
    for (d, f), rec in sorted(pack.records.items()):
        frames_geom.setdefault(str(d), {})[str(f)] = rec
    meta = {
        "schema": SCHEMA_VERSION,
        "tool": f"d2_proj_toolkit {TOOL_VERSION}",
        "name": name,
        "source": source,
        "coordinateSystem": {
            "world": "原點=單位錨點，x右 y下，像素中心=索引+0.5",
            "cell": "cell = world + (pivot_x, pivot_y)",
        },
        "atlas": {"file": atlas_file, **lay},
        "frames": frames_geom,
        "anim": anim,
    }
    if pca is not None:
        meta["directionMap"] = pca["directionMap"]
        meta["projectileGeometry"] = pca["directions"]
        meta["selfCheck"] = pca["selfCheck"]
        # 以 cell 內像素座標彙整的「統一」頭尾基準線（所有方向×幀的中位數距離），方便引擎直接使用
        lens = [fr["baselineLength"] for d in pca["directions"].values()
                for fr in d["frames"].values() if fr["baselineLength"] is not None]
        meta["projectileSummary"] = {
            "medianBaselineLength": _r(float(np.median(lens))) if lens else None,
            "maxBaselineLength": _r(float(np.max(lens))) if lens else None,
        }
    return meta


def write_json(path: Path, obj: dict) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


# ════════════════════════════════════════════════════════════════════════════
# 輸入：manifest 載入
# ════════════════════════════════════════════════════════════════════════════
def load_manifest(path: str) -> Tuple[List[SrcFrame], str, dict]:
    """
    manifest.json:
    { "y_mode": "top" | "bottom",
      "frames": [ {"dir":0,"frame":0,"file":"d0_f0.png","offset_x":-20,"offset_y":-31}, ... ] }
    y_mode="bottom" 為 DCC 原始語意（yoffset 為影格下緣）。
    """
    mp = Path(path)
    m = json.loads(mp.read_text(encoding="utf-8"))
    frames = []
    for e in m["frames"]:
        img = Image.open(mp.parent / e["file"]).convert("RGBA")
        frames.append(SrcFrame(int(e["dir"]), int(e["frame"]), np.array(img),
                               int(e["offset_x"]), int(e["offset_y"])))
    return frames, m.get("y_mode", "top"), m


# ════════════════════════════════════════════════════════════════════════════
# 高階流程
# ════════════════════════════════════════════════════════════════════════════
def process(frames: Sequence[SrcFrame], *, name: str, out_dir: Path, y_mode: str,
            animdata: Optional[AnimData], cofs: Sequence[str], args) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    pack = pack_atlas(frames, y_mode=y_mode, trim_alpha=not args.no_trim,
                      alpha_threshold=args.alpha_threshold, padding=args.padding,
                      max_texture=args.max_texture, pot=args.pot, symmetric=args.symmetric)
    verify_atlas(pack)
    atlas_file = f"{name}.png"
    Image.fromarray(pack.atlas, "RGBA").save(out_dir / atlas_file)

    pca = None
    if not args.skip_pca:
        p = PcaParams(alpha_threshold=max(args.alpha_threshold, 8), lum_power=args.lum_power)
        tol = {"slot": args.slot_tol, "intra": args.intra_tol, "agree": args.agree_min,
               "conf": args.conf_min}
        pca = run_pca_pipeline(pack.norm, pack.layout, p, not args.per_frame_orientation,
                               args.space, tol)

    anim = {}
    if animdata is not None:
        for c in cofs:
            anim[AnimData.normalize_code(c)] = animdata.info(
                c, args.release_event, [int(x) for x in args.fallback_events.split(",") if x])
    src = {"frameCount": len(frames), "yMode": y_mode}
    meta = build_metadata(name, pack, atlas_file, pca, anim, src)
    write_json(out_dir / f"{name}.json", meta)
    return meta


# ════════════════════════════════════════════════════════════════════════════
# 自測：合成彗星投射物 + 合成 AnimData
# ════════════════════════════════════════════════════════════════════════════
def _synth_comet(phi_deg: float, tail_len: float, size: int = 64) -> np.ndarray:
    phi = math.radians(phi_deg)
    u = np.array([math.cos(phi), 0.5 * math.sin(phi)])      # 地面角 → 等軸測螢幕向量
    u /= np.linalg.norm(u)
    yy, xx = np.mgrid[0:size, 0:size]
    rx, ry = xx + 0.5 - size / 2, yy + 0.5 - size / 2
    t = rx * u[0] + ry * u[1]
    n = -rx * u[1] + ry * u[0]
    hx, hy = u * 8
    blob = np.exp(-((rx - hx) ** 2 + (ry - hy) ** 2) / (2 * 3.0 ** 2))
    k = np.clip(1 + t / tail_len, 0, 1)
    tail_mask = (t <= 2) & (t >= -tail_len)
    width = 0.8 + 2.2 * k
    tail = np.where(tail_mask, np.exp(-(n ** 2) / (2 * (width / 1.2) ** 2)) * (0.15 + 0.45 * k), 0.0)
    alpha = np.clip(np.maximum(blob, tail), 0, 1)
    lum = np.clip(blob + 0.5 * k * (tail > 0), 0, 1)
    col = np.where(blob[..., None] > 0.3, np.array([255, 250, 200]), np.array([255, 120, 20]))
    rgba = np.zeros((size, size, 4), np.uint8)
    rgba[..., :3] = (col * lum[..., None]).astype(np.uint8)
    rgba[..., 3] = (alpha * 255).astype(np.uint8)
    return rgba


def _synth_animdata() -> bytes:
    buckets: List[List[bytes]] = [[] for _ in range(256)]

    def rec(code, fpd, speed, ev):
        e = bytearray(144)
        for i, c in ev.items():
            e[i] = c
        return code.encode().ljust(8, b"\0") + struct.pack("<IHH", fpd, speed, 0) + bytes(e)

    for code, fpd, speed, ev in [("NESCHTH", 16, 256, {9: 2}), ("SOSCSTF", 14, 208, {8: 2, 3: 3}),
                                 ("AMA1BOW", 12, 256, {6: 2})]:
        buckets[AnimData.hash_name(code)].append(rec(code, fpd, speed, ev))
    out = b""
    for b in buckets:
        out += struct.pack("<I", len(b)) + b"".join(b)
    return out


def selftest() -> None:
    # 1) AnimData
    ad = AnimData.parse(_synth_animdata())
    i = ad.info("NESCHTH")
    assert i["found"] and i["framesPerDirection"] == 16 and i["releaseFrame"] == 9, i
    j = ad.info("soscstf.cof")
    assert j["releaseFrame"] == 8 and j["fps"] == round(25 * 208 / 256, 4), j
    assert not ad.hash_mismatch and not ad.info("ZZZZZZZ")["found"]

    # 2) 幾何管線：16 向、索引刻意打亂（模擬 DCC 方向順序）
    perm = [(k * 5) % 16 for k in range(16)]
    base = 30.0
    frames, truth = [], {}
    rng = np.random.default_rng(1)
    for d in range(16):
        phi = base + perm[d] * 22.5
        sx, sy = math.cos(math.radians(phi)), 0.5 * math.sin(math.radians(phi))
        truth[d] = wrap360(math.degrees(math.atan2(sy, sx)))
        for f in range(5):
            jx, jy = (int(x) for x in rng.integers(-2, 3, 2))
            frames.append(SrcFrame(d, f, _synth_comet(phi, 20 + 3 * f),
                                   -32 + jx, -32 + jy))
    ns = argparse.Namespace(no_trim=False, alpha_threshold=0, padding=1, max_texture=4096,
                            pot=False, symmetric=False, skip_pca=False, lum_power=0.5,
                            slot_tol=6.0, intra_tol=8.0, agree_min=0.6, conf_min=0.15,
                            per_frame_orientation=False, space="auto",
                            release_event=2, fallback_events="")
    with tempfile.TemporaryDirectory() as td:
        meta = process(frames, name="selftest", out_dir=Path(td), y_mode="top",
                       animdata=ad, cofs=["NESCHTH", "SOSCSTF"], args=ns)
        assert (Path(td) / "selftest.png").exists() and (Path(td) / "selftest.json").exists()
    sc = meta["selfCheck"]
    assert sc["passed"], sc
    worst = 0.0
    for row in meta["directionMap"]["byDirection"]:
        worst = max(worst, abs(wrap180(row["axisDeg"] - truth[row["dir"]])))
    assert worst < 6.0, f"方向誤差過大 {worst}"
    print(f"[selftest] OK  cell={meta['atlas']['cell_w']}x{meta['atlas']['cell_h']} "
          f"pivot=({meta['atlas']['pivot_x']},{meta['atlas']['pivot_y']}) "
          f"worstAxisErr={worst:.2f}° maxSlotRes={sc['maxSlotResidualDeg']}° "
          f"space={meta['directionMap']['space']}")


# ════════════════════════════════════════════════════════════════════════════
# CLI
# ════════════════════════════════════════════════════════════════════════════
def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="D2 投射物圖集 / 方向校準 / AnimData 工具")
    sub = ap.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("build", help="封裝圖集 + PCA 校準 + AnimData → PNG + JSON")
    b.add_argument("--manifest", required=True)
    b.add_argument("--out-dir", required=True)
    b.add_argument("--name", required=True)
    b.add_argument("--y-mode", choices=["top", "bottom"], default=None,
                   help="覆蓋 manifest 內的 y_mode（DCC 原始偏移請用 bottom）")
    b.add_argument("--animdata", help="data/global/animdata.d2")
    b.add_argument("--cof", action="append", default=[], help="如 NESCHTH，可重複")
    b.add_argument("--release-event", type=int, default=2)
    b.add_argument("--fallback-events", default="", help="例如 '4,1'（release 事件缺失時的退路）")
    b.add_argument("--padding", type=int, default=1)
    b.add_argument("--alpha-threshold", type=int, default=0)
    b.add_argument("--no-trim", action="store_true")
    b.add_argument("--pot", action="store_true")
    b.add_argument("--symmetric", action="store_true", help="聯集盒對原點對稱，pivot 在 cell 中央")
    b.add_argument("--max-texture", type=int, default=4096)
    b.add_argument("--skip-pca", action="store_true")
    b.add_argument("--space", choices=["auto", "iso", "screen"], default="auto")
    b.add_argument("--lum-power", type=float, default=0.5)
    b.add_argument("--per-frame-orientation", action="store_true",
                   help="不做方向內共識（旋轉中的投射物）")
    b.add_argument("--slot-tol", type=float, default=6.0)
    b.add_argument("--intra-tol", type=float, default=8.0)
    b.add_argument("--agree-min", type=float, default=0.6)
    b.add_argument("--conf-min", type=float, default=0.15)

    a = sub.add_parser("animdata", help="只查 AnimData")
    a.add_argument("--animdata", required=True)
    a.add_argument("--cof", action="append", required=True)
    a.add_argument("--release-event", type=int, default=2)
    a.add_argument("--fallback-events", default="")
    a.add_argument("--lenient", action="store_true", help="允許檔尾殘留")

    sub.add_parser("selftest", help="合成資料自測")
    args = ap.parse_args(argv)

    if args.cmd == "selftest":
        selftest()
        return 0
    if args.cmd == "animdata":
        ad = AnimData.load(args.animdata, strict=not args.lenient)
        fb = [int(x) for x in args.fallback_events.split(",") if x]
        print(json.dumps({AnimData.normalize_code(c): ad.info(c, args.release_event, fb)
                          for c in args.cof}, ensure_ascii=False, indent=2))
        if ad.hash_mismatch:
            print(f"警告：{len(ad.hash_mismatch)} 筆記錄 bucket 與 hash 不符", file=sys.stderr)
        return 0

    frames, y_mode, _ = load_manifest(args.manifest)
    y_mode = args.y_mode or y_mode
    ad = AnimData.load(args.animdata) if args.animdata else None
    meta = process(frames, name=args.name, out_dir=Path(args.out_dir), y_mode=y_mode,
                   animdata=ad, cofs=args.cof, args=args)
    lay = meta["atlas"]
    print(f"atlas {lay['width']}x{lay['height']}  cell {lay['cell_w']}x{lay['cell_h']}  "
          f"pivot ({lay['pivot_x']},{lay['pivot_y']})")
    if "selfCheck" in meta:
        sc = meta["selfCheck"]
        print("selfCheck:", "PASS" if sc["passed"] else "FAIL")
        for fmsg in sc["failures"]:
            print("  -", fmsg)
        return 0 if sc["passed"] else 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
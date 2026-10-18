#!/usr/bin/env python3
"""
rebuild_companions_from_dcc.py
從原版 MPQ 解碼的 DCC 重建所有夥伴精靈圖
- 正確使用 DCCDecoder(filepath) API + decode_direction(idx) 方法
- 自動計算 bounding box
- 套用 DCC_CLOCKWISE_8 方向映射
- 輸出到 web/assets/companions/
- 自動更新 companions_manifest.js
"""
import sys, os, json, logging, uuid
from pathlib import Path
from PIL import Image

# ── 日誌設定 ─────────────────────────────────────────────────────────
LOG_FILE = Path(__file__).parent.parent / "debug.log"
EXE_ID = str(uuid.uuid4())[:8]

logging.basicConfig(
    level=logging.DEBUG,
    format="[%(asctime)s][%(levelname)s][%(funcName)s][EXE:" + EXE_ID + "] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, mode="w", encoding="utf-8"),
    ]
)
logger = logging.getLogger(__name__)
console = logging.StreamHandler(sys.stderr)
console.setLevel(logging.ERROR)
logger.addHandler(console)

# ── 路徑設定 ──────────────────────────────────────────────────────────
TOOLS_DIR = Path(__file__).parent
sys.path.insert(0, str(TOOLS_DIR))
from dcc_to_png import DCCDecoder, load_palette

BASE = TOOLS_DIR / "mpq_raw"
PALETTE_PATH = BASE / "d2data/data/global/palette/ACT1/pal.dat"
WEB_COMPANIONS = TOOLS_DIR.parent / "web/assets/companions"
NORMALIZED_COMPANIONS = TOOLS_DIR.parent.parent / "diablo2_normalized_assets/companions"

# ── Blizzard DCC 方向映射 ─────────────────────────────────────────────
# Blizzard DCC 原始方向順序：0=SW, 1=NW, 2=NE, 3=SE, 4=S, 5=W, 6=N, 7=E
# 與 MonsterEntity 和全專案怪物精靈圖完全統一，直接使用原生順序輸出 0~7
# Runtime 統一使用 DCC_MAP = [7, 3, 4, 0, 5, 1, 6, 2] 進行 8 方向查表
DCC_NATURAL_8 = [0, 1, 2, 3, 4, 5, 6, 7]
# 16 方向 DCC (如狂狼 WF) 的前 8 個方向 (0~7) 正好涵蓋 8 個主方向 (順序與 8 方向完全一致)
DCC_16TO8_DIRS = [0, 1, 2, 3, 4, 5, 6, 7]




def load_pal():
    pal = load_palette(str(PALETTE_PATH))
    logger.info(f"調色盤載入：{PALETTE_PATH}")
    return pal


def decode_dcc_sprite(dcc_path: Path, pal, target_dirs: int = 8) -> dict | None:
    """
    解碼 DCC 並組裝 sprite sheet。
    DCCDecoder API:
      dec = DCCDecoder(filepath)      # 只傳路徑
      dec.directions                  # 方向數
      dec.frames_per_dir              # 每方向幀數
      frames = dec.decode_direction(d)  # 回傳 list of frame dicts
      frame dict: {'width', 'height', 'x_offset', 'y_offset', 'pixels': bytearray, 'bottom_up': bool}
    """
    logger.debug(f"開始解碼: {dcc_path}")
    try:
        dec = DCCDecoder(str(dcc_path))
    except Exception as e:
        logger.exception(f"無法載入 DCC: {e}")
        return None

    num_dirs_raw = dec.directions
    fpd = dec.frames_per_dir
    logger.info(f"DCC: {dcc_path.name}  dirs={num_dirs_raw}, fpd={fpd}")

    # 決定方向映射 (統一採用 DCC 原始 0~7 順序)
    if num_dirs_raw == 8:
        dir_map = DCC_NATURAL_8
        out_dirs = 8
    elif num_dirs_raw == 16:
        dir_map = DCC_16TO8_DIRS
        out_dirs = 8
    else:
        dir_map = list(range(num_dirs_raw))
        out_dirs = num_dirs_raw

    # 解碼所有需要方向
    all_dir_frames = {}
    for d in set(dir_map):
        if d >= num_dirs_raw:
            continue
        try:
            frames = dec.decode_direction(d)
            all_dir_frames[d] = frames
        except Exception as e:
            logger.exception(f"decode_direction({d}) 失敗: {e}")

    if not all_dir_frames:
        logger.error("所有方向解碼失敗")
        return None

    # ── 精確計算全局 bounding box（D2 座標系 Y 向上）─────────────────
    # x_offset = 幀左邊界相對角色中心（向右正）
    # y_offset = 幀底部相對腳底（D2 Y 向上正，正值=幀底在腳底上方）
    # 螢幕Y向下：paste_y_of_top = anchor_y - y_off - fh
    min_x_off = 0     # 最左偏移（通常負值）
    max_x_right = 0   # 最右邊界（x_off + fw）
    max_above = 0     # 腳底以上最高幀頂（D2 Y）= y_off + fh
    max_below = 0     # 腳底以下最低幀底（D2 Y）= -y_off（y_off<0時）
    min_y_off = 9999  # 最小 y_off（>0 表示所有幀底部都高於腳底，需浮空補正）

    for dir_frames in all_dir_frames.values():
        for fr in dir_frames:
            fw2, fh2 = fr['width'], fr['height']
            if fw2 == 0 or fh2 == 0:
                continue
            xo, yo = fr['x_offset'], fr['y_offset']
            if xo < min_x_off:
                min_x_off = xo
            if xo + fw2 > max_x_right:
                max_x_right = xo + fw2
            above = yo + fh2   # 幀在腳底上方的最高點（D2 Y，向上正）
            below = -yo        # 幀在腳底下方的最深點（yo 負時才有）
            if above > max_above:
                max_above = above
            if below > max_below:
                max_below = below
            if yo < min_y_off:
                min_y_off = yo   # 追蹤最低 y_off（最靠近腳底的幀底部）

    # min_y_off > 0 表示所有幀都不到腳底參考點，需在渲染時向下補正 min_y_off px
    y_ground_offset = max(0, min_y_off)  # 補正量（正值=浮空量）

    max_above = max(max_above, 16)
    x_left  = abs(min_x_off)
    x_right = max(max_x_right, 16)

    # cell 尺寸（各加 8px 邊距）
    cell_w = x_left + x_right + 8
    cell_h = max_above + max_below + 8
    cell_w = max(cell_w, 32)
    cell_h = max(cell_h, 32)

    # anchor：腳底在 cell 中的像素座標（螢幕Y向下）
    # 扣除 y_ground_offset (最小 y_off)，使實際精靈圖最低處精準貼齊地面 (消滅浮空)
    anchor_x = x_left + 4
    anchor_y = max_above + 4 - y_ground_offset

    logger.info("cell=(%d x %d), anchor=(%d,%d), dirs=%d, y_ground_offset=%d" % (cell_w, cell_h, anchor_x, anchor_y, out_dirs, y_ground_offset))

    # 建立 sprite sheet
    sheet_w = cell_w * fpd
    sheet_h = cell_h * out_dirs
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))

    for row_idx, d in enumerate(dir_map):
        if d >= num_dirs_raw or d not in all_dir_frames:
            continue
        frames = all_dir_frames[d]
        for f_idx, fr in enumerate(frames):
            fw = fr['width']
            fh = fr['height']
            if fw == 0 or fh == 0:
                continue

            # 將索引色幀轉為 RGBA
            frame_img = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
            raw_px = fr['pixels']
            bottom_up = fr.get('bottom_up', False)
            for py in range(fh):
                src_y = (fh - 1 - py) if bottom_up else py
                for px_i in range(fw):
                    idx = raw_px[src_y * fw + px_i]
                    frame_img.putpixel((px_i, py), pal[idx])

            # 座標換算（D2 Y↑ → 螢幕 Y↓）：
            # paste_x = cell 內 anchor_x + x_off（方向不變）
            # paste_y = cell 內 anchor_y - y_off - fh
            #   (腳底在 anchor_y；幀底部在腳底上方 y_off；幀頂再往上 fh)
            x_off = fr['x_offset']
            y_off = fr['y_offset']

            paste_x = f_idx * cell_w + anchor_x + x_off
            paste_y = row_idx * cell_h + anchor_y - y_off - fh

            # 邊界保護（限制在當前 cell 格內）
            cl = f_idx * cell_w
            ct = row_idx * cell_h
            paste_x = max(cl, min(paste_x, cl + cell_w - fw))
            paste_y = max(ct, min(paste_y, ct + cell_h - fh))

            sheet.paste(frame_img, (paste_x, paste_y), frame_img)

    return {
        'image': sheet,
        'cell_w': cell_w,
        'cell_h': cell_h,
        'anchor_x': anchor_x,
        'anchor_y': anchor_y,
        'num_dirs': out_dirs,
        'frames_per_dir': fpd,
        'y_ground_offset': y_ground_offset,
    }


def decode_and_save(dcc_path: Path, out_path: Path, pal, target_dirs: int = 8) -> dict | None:
    """解碼並儲存，回傳 manifest 用的 meta"""
    if not dcc_path.exists():
        logger.warning(f"DCC 不存在: {dcc_path}")
        print(f"  [SKIP] 找不到 {dcc_path.name}")
        return None

    result = decode_dcc_sprite(dcc_path, pal, target_dirs)
    if result is None:
        print(f"  [FAIL] {dcc_path.name}")
        return None

    out_path.parent.mkdir(parents=True, exist_ok=True)
    result['image'].save(str(out_path))
    logger.info(f"已儲存: {out_path}")
    print(f"  [OK] {out_path.name}  {result['cell_w']}×{result['cell_h']}  "
          f"dirs={result['num_dirs']}  frames={result['frames_per_dir']}  y_gnd={result['y_ground_offset']}")

    return {
        'cell_width': result['cell_w'],
        'cell_height': result['cell_h'],
        'anchor_x': result['anchor_x'],
        'anchor_y': result['anchor_y'],
        'directions': result['num_dirs'],
        'frames': result['frames_per_dir'],
        'y_ground_offset': result['y_ground_offset'],
    }


def find_dcc_ci(base_dir: Path, name: str) -> Path:
    """不分大小寫在目錄中找 DCC 檔案，找不到就回傳原始路徑（讓 decode_and_save 處理 missing）"""
    name_lower = name.lower()
    if base_dir.exists():
        for f in base_dir.iterdir():
            if f.name.lower() == name_lower:
                return f
    return base_dir / name


def build_actions(action_meta: dict, prefix: str) -> dict:
    """將解碼結果整理成 manifest actions 格式"""
    actions = {}
    for action, meta in action_meta.items():
        if meta is None:
            continue
        actions[action] = {
            "file": f"assets/companions/{prefix}",
            "directions": meta["directions"],
            "frames": meta["frames"],
            "cell_width": meta["cell_width"],
            "cell_height": meta["cell_height"],
            "anchor_x": meta["anchor_x"],
            "anchor_y": meta["anchor_y"],
            "fps": meta["fps"],
        }
    return actions


def main():
    print("=" * 60)
    print("夥伴 DCC 精靈圖重建工具")
    print("=" * 60)

    pal = load_pal()

    d2data = BASE / "d2data/data/global/monsters"
    d2exp = BASE / "d2exp/data/global/monsters"

    manifest_data = {}

    # ═══════════════════════════════════════════════════════════════════
    # 灰熊 (B7)
    # ═══════════════════════════════════════════════════════════════════
    print("\n[1/6] 灰熊 (Grizzly Bear / B7) ...")
    b7 = d2exp / "B7/TR"
    bear_dir = WEB_COMPANIONS / "bear"
    bear_actions = {}
    for action, dcc_name, fps in [
        ("idle",   "B7TRLITNUHTH.dcc", 12),
        ("walk",   "B7TRLITWLHTH.dcc", 14),
        ("attack", "B7TRLITA1HTH.dcc", 16),
        ("death",  "B7TRLITDTHTH.dcc", 14),
    ]:
        meta = decode_and_save(find_dcc_ci(b7, dcc_name), bear_dir / f"bear_{action}.png", pal)
        if meta:
            meta["fps"] = fps
            bear_actions[action] = meta

    if bear_actions:
        manifest_data["bear"] = {
            "name": "灰熊 (Grizzly Bear)", "type": "beast", "isCombat": True,
            "hp": 480, "damage": 45, "speed": 3.2, "range": 38, "collisionRadius": 28,
            "actions": {k: {
                "file": f"assets/companions/bear/bear_{k}.png",
                **{x: v[x] for x in ["directions","frames","cell_width","cell_height","anchor_x","anchor_y","fps"]}
            } for k, v in bear_actions.items()}
        }

    # ═══════════════════════════════════════════════════════════════════
    # 狂狼 (WF)
    # ═══════════════════════════════════════════════════════════════════
    print("\n[2/6] 狂狼 (Dire Wolf / WF) ...")
    wf = d2exp / "WF/TR"
    wolf_dir = WEB_COMPANIONS / "wolf"
    wolf_actions = {}
    for action, dcc_name, fps in [
        ("idle",   "WFtrlitnuhth.dcc",  14),
        ("walk",   "WFtrlitwlhth.dcc",  14),
        ("run",    "WFTRLITRNHTH.dcc",  18),
        ("attack", "WFtrlita1hth.dcc",  16),
        ("death",  "WFTRLITDTHTH.dcc",  14),
    ]:
        meta = decode_and_save(find_dcc_ci(wf, dcc_name), wolf_dir / f"wolf_{action}.png", pal)
        if meta:
            meta["fps"] = fps
            wolf_actions[action] = meta

    if wolf_actions:
        manifest_data["wolf"] = {
            "name": "狂狼 (Dire Wolf)", "type": "beast", "isCombat": True,
            "hp": 240, "damage": 30, "speed": 4.5, "range": 32, "collisionRadius": 18,
            "actions": {k: {
                "file": f"assets/companions/wolf/wolf_{k}.png",
                **{x: v[x] for x in ["directions","frames","cell_width","cell_height","anchor_x","anchor_y","fps"]}
            } for k, v in wolf_actions.items()}
        }

    # ═══════════════════════════════════════════════════════════════════
    # 黏土魔像 (G1)
    # ═══════════════════════════════════════════════════════════════════
    print("\n[3/6] 黏土魔像 (Clay Golem / G1) ...")
    g1 = d2data / "G1/tr"
    golem_dir = WEB_COMPANIONS / "golem"
    golem_actions = {}
    for action, dcc_name, fps in [
        ("idle",   "G1TRLITNUHTH.dcc", 12),
        ("walk",   "G1TRLITWLHTH.dcc", 14),
        ("attack", "G1TRLITA1HTH.dcc", 16),
        ("death",  "G1TRLITDTHTH.dcc", 14),
    ]:
        meta = decode_and_save(find_dcc_ci(g1, dcc_name), golem_dir / f"golem_{action}.png", pal)
        if meta:
            meta["fps"] = fps
            golem_actions[action] = meta

    if golem_actions:
        manifest_data["golem"] = {
            "name": "黏土石魔 (Clay Golem)", "type": "construct", "isCombat": True,
            "hp": 520, "damage": 38, "speed": 2.6, "range": 36, "collisionRadius": 24,
            "actions": {k: {
                "file": f"assets/companions/golem/golem_{k}.png",
                **{x: v[x] for x in ["directions","frames","cell_width","cell_height","anchor_x","anchor_y","fps"]}
            } for k, v in golem_actions.items()}
        }

    # ═══════════════════════════════════════════════════════════════════
    # 鋼鐵魔像 (G4)
    # ═══════════════════════════════════════════════════════════════════
    print("\n[4/6] 鋼鐵魔像 (Iron Golem / G4) ...")
    g4 = d2data / "G4/tr"
    iron_actions = {}
    for action, dcc_name, fps in [
        ("idle",   "G4TRLITNUHTH.dcc", 12),
        ("walk",   "G4TRLITWLHTH.dcc", 14),
        ("attack", "G4TRLITA1HTH.dcc", 16),
        ("death",  "G4TRLITDTHTH.dcc", 14),
    ]:
        meta = decode_and_save(find_dcc_ci(g4, dcc_name), golem_dir / f"iron_golem_{action}.png", pal)
        if meta:
            meta["fps"] = fps
            iron_actions[action] = meta

    if iron_actions:
        manifest_data["iron_golem"] = {
            "name": "鋼鐵魔像 (Iron Golem)", "type": "construct", "isCombat": True,
            "hp": 580, "damage": 46, "speed": 2.8, "range": 36, "collisionRadius": 24,
            "actions": {k: {
                "file": f"assets/companions/golem/iron_golem_{k}.png",
                **{x: v[x] for x in ["directions","frames","cell_width","cell_height","anchor_x","anchor_y","fps"]}
            } for k, v in iron_actions.items()}
        }

    # ═══════════════════════════════════════════════════════════════════
    # 火焰魔像 (G3)
    # ═══════════════════════════════════════════════════════════════════
    print("\n[5/6] 火焰魔像 (Fire Golem / G3) ...")
    g3 = d2data / "G3/tr"
    fire_actions = {}
    for action, dcc_name, fps in [
        ("idle",   "G3trlitnuhth.dcc",  12),
        ("walk",   "G3trlitwlhth.dcc",  14),
        ("attack", "G3trlita1hth.dcc",  16),
        ("death",  "G3trlitdthth.dcc",  14),
    ]:
        meta = decode_and_save(find_dcc_ci(g3, dcc_name), golem_dir / f"fire_golem_{action}.png", pal)
        if meta:
            meta["fps"] = fps
            fire_actions[action] = meta

    if fire_actions:
        manifest_data["fire_golem"] = {
            "name": "火焰魔像 (Fire Golem)", "type": "construct", "isCombat": True,
            "hp": 550, "damage": 44, "speed": 2.7, "range": 36, "collisionRadius": 24,
            "actions": {k: {
                "file": f"assets/companions/golem/fire_golem_{k}.png",
                **{x: v[x] for x in ["directions","frames","cell_width","cell_height","anchor_x","anchor_y","fps"]}
            } for k, v in fire_actions.items()}
        }

    # ═══════════════════════════════════════════════════════════════════
    # 骷髏 (SK LIT 輕甲 1HS 單手劍)
    # ═══════════════════════════════════════════════════════════════════
    print("\n[6/6] 骷髏 (Skeleton / SK) ...")
    sk = d2data / "SK/TR"
    skel_dir = WEB_COMPANIONS / "skeleton"
    skel_actions = {}
    for action, dcc_name, fps in [
        ("idle",   "SKTRLITNU1HS.dcc", 12),
        ("walk",   "SKTRLITWL1HS.dcc", 14),
        ("attack", "SKTRLITA11HS.dcc", 18),
        ("death",  "SKTRLITDT1HS.dcc", 14),
    ]:
        meta = decode_and_save(find_dcc_ci(sk, dcc_name), skel_dir / f"skeleton_{action}.png", pal)
        if meta:
            meta["fps"] = fps
            skel_actions[action] = meta

    if skel_actions:
        # 骷髏使用 assets/monsters/ 的完整合成精靈圖（1120×960, cell 140×120）
        # 原因：D2 骷髏使用 COF 多層合成架構，單一 DCC 只含軀幹部件（14×21px）
        # 不含頭部、腿部、武器等，必須用已合成的完整版才能顯示完整骷髏外觀
        SKELETON_FULL = "assets/monsters/skeleton"
        manifest_data["skeleton_minion"] = {
            "name": "骷髏僕從 (Skeleton Minion)", "type": "undead", "isCombat": True,
            "hp": 220, "damage": 26, "speed": 3.2, "range": 32, "collisionRadius": 18,
            "actions": {
                "idle":   {"file": f"{SKELETON_FULL}_idle.png",   "directions": 8, "frames": 8,  "cell_width": 140, "cell_height": 120, "anchor_x": 70, "anchor_y": 95, "fps": 12},
                "walk":   {"file": f"{SKELETON_FULL}_walk.png",   "directions": 8, "frames": 8,  "cell_width": 140, "cell_height": 120, "anchor_x": 70, "anchor_y": 95, "fps": 14},
                "run":    {"file": f"{SKELETON_FULL}_walk.png",   "directions": 8, "frames": 8,  "cell_width": 140, "cell_height": 120, "anchor_x": 70, "anchor_y": 95, "fps": 16},
                "attack": {"file": f"{SKELETON_FULL}_attack.png", "directions": 8, "frames": 16, "cell_width": 140, "cell_height": 120, "anchor_x": 70, "anchor_y": 95, "fps": 18},
                "death":  {"file": f"{SKELETON_FULL}_death.png",  "directions": 8, "frames": 19, "cell_width": 140, "cell_height": 120, "anchor_x": 70, "anchor_y": 95, "fps": 14},
            }
        }

    # ─── 保留不變夥伴 ────────────────────────────────────────────────
    manifest_data["raven"] = {
        "name": "寵物烏鴉 (Raven)", "type": "flying", "isCombat": True,
        "hp": 180, "damage": 18, "speed": 5.2, "range": 30, "collisionRadius": 14,
        "actions": {
            a: {"file": "assets/companions/raven/raven_fly.png", "directions": 8, "frames": 8,
                "cell_width": 48, "cell_height": 48, "anchor_x": 24, "anchor_y": 24, "fps": fps}
            for a, fps in [("idle",14),("walk",16),("run",20),("attack",22)]
        }
    }
    manifest_data["oak_sage"] = {
        "name": "自然之靈 (Oak Sage)", "type": "spirit", "isCombat": False,
        "hp": 200, "damage": 0, "speed": 2.0, "orbitRadius": 50, "collisionRadius": 15,
        "actions": {"idle": {
            "file": "assets/companions/oak_sage/oak_sage.png",
            "directions": 1, "frames": 11, "cell_width": 128, "cell_height": 128,
            "anchor_x": 64, "anchor_y": 64, "fps": 12
        }}
    }

    # ─── 寫出 companions_manifest.js ─────────────────────────────────
    manifest_out = WEB_COMPANIONS / "companions_manifest.js"
    content = "window.D2_COMPANIONS_MANIFEST = " + json.dumps(manifest_data, ensure_ascii=False, indent=2) + ";\n"
    manifest_out.write_text(content, encoding="utf-8")
    print(f"\n[完成] companions_manifest.js 已更新")

    # ─── 同步到 diablo2_normalized_assets ────────────────────────────
    import shutil
    for subdir in ["bear", "wolf", "golem", "skeleton"]:
        src = WEB_COMPANIONS / subdir
        dst = NORMALIZED_COMPANIONS / subdir
        if src.exists():
            dst.mkdir(parents=True, exist_ok=True)
            for f in src.glob("*.png"):
                shutil.copy2(f, dst / f.name)
    print(f"[完成] 同步至 diablo2_normalized_assets/companions/")
    print("\n全部完成！")


if __name__ == "__main__":
    main()

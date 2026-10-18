"""
生成接地驗證條帶視覺化對照圖 (Ground Strip Visualizer)
繪製水平基準紅線 (Ground Line)，將人物與夥伴各方向、各影格依 anchor 錨點繪製在地面上。
"""

import os
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path("Diablo2-Agent-Monitor/web")

def draw_action_strip(img_path, cw, ch, dirs, frames, ax, ay, title, out_path, test_direction=None):
    if not img_path.exists():
        print(f"File not found: {img_path}")
        return
        
    src = Image.open(img_path).convert("RGBA")
    
    # 決定展示方式：
    # 若指定 test_direction，展示該方向的所有連續 frames (看連續動作跳躍)
    # 若未指定，展示所有 directions 的 frame 0 (看方向轉向高低差)
    is_frame_mode = (test_direction is not None)
    count = frames if is_frame_mode else dirs
    
    padding = 10
    total_w = count * (cw + padding) + padding
    ground_y = ch + 20
    total_h = ground_y + 35
    
    canvas = Image.new("RGBA", (total_w, total_h), (25, 25, 32, 255))
    draw = ImageDraw.Draw(canvas)
    
    # 繪製地面基準紅線 (Ground Line)
    draw.line([(0, ground_y), (total_w, ground_y)], fill=(255, 60, 60, 255), width=2)
    
    for i in range(count):
        d = test_direction if is_frame_mode else i
        f = i if is_frame_mode else 0
        
        sx = f * cw
        sy = d * ch
        cell = src.crop((sx, sy, sx + cw, sy + ch))
        
        # 引擎標準貼圖座標：以 ground_y 為基準點 (drawX = posX - ax, drawY = ground_y - ay)
        slot_x = padding + i * (cw + padding)
        draw_x = slot_x
        draw_y = ground_y - ay
        
        # 貼上精靈圖
        canvas.paste(cell, (draw_x, draw_y), cell)
        
        # 標註方向或幀數
        label = f"F{i}" if is_frame_mode else f"Dir{i}"
        draw.text((slot_x + 5, ground_y + 6), label, fill=(200, 200, 210, 255))
        
    # 標題
    draw.text((10, 5), title, fill=(255, 215, 0, 255))
    canvas.save(out_path)
    print(f"✅ 已生成條帶圖: {out_path.name}")

def main():
    print("🎨 正在生成重要動畫的地面水平條帶檢驗圖...")
    
    # 1. 死靈法師普攻 16 方向 (檢查哪些角度浮空)
    necro_atk = ROOT / "assets/characters/necromancer/light/necromancer_attack.png"
    draw_action_strip(
        necro_atk, 150, 104, 16, 19, 75, 85,
        "死靈法師 (Necromancer) 普攻 16 方向起手接地線 (紅線為地平線)",
        Path("audit_necro_attack_dirs.png")
    )
    
    # 2. 黏土石魔行走 8 影格 (Dir 0，檢查一跳一跳)
    golem_walk = ROOT / "assets/companions/golem/golem_walk.png"
    draw_action_strip(
        golem_walk, 71, 82, 8, 8, 36, 61,
        "黏土石魔 (Clay Golem) 行走連續 8 幀步伐起伏 (紅線為地平線)",
        Path("audit_golem_walk_frames.png"),
        test_direction=0
    )
    
    # 3. 灰熊行走連續 12 影格 (Dir 0，檢查一跳一跳)
    bear_walk = ROOT / "assets/companions/bear/bear_walk.png"
    draw_action_strip(
        bear_walk, 148, 111, 8, 12, 74, 80,
        "德魯伊灰熊 (Grizzly Bear) 行走連續 12 幀步伐起伏 (紅線為地平線)",
        Path("audit_bear_walk_frames.png"),
        test_direction=0
    )
    
    # 4. 亞馬遜標槍普攻 16 方向 (檢查沉地與指向)
    amazon_spear = ROOT / "assets/characters/amazon/amazon_spear.png"
    draw_action_strip(
        amazon_spear, 150, 110, 16, 15, 75, 95,
        "亞馬遜 (Amazon) 標槍突刺 16 方向接地線 (紅線為地平線)",
        Path("audit_amazon_spear_dirs.png")
    )
    
    print("條帶檢驗圖生成完畢！")

if __name__ == "__main__":
    main()

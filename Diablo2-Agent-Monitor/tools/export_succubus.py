import os
import sys
import json
from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..'))
TOOLS_DIR = SCRIPT_DIR
OUT_MONSTERS_DIR = os.path.join(PROJECT_DIR, 'web', 'assets', 'monsters')
os.makedirs(OUT_MONSTERS_DIR, exist_ok=True)

sys.path.append(TOOLS_DIR)
from dcc_to_png import DCCDecoder, load_palette

PAL5 = load_palette(os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', 'd2exp', 'data', 'global', 'palette', 'ACT5', 'pal.dat'), brightness_boost=1.35)

def export_succubus():
    base_dir = os.path.join(PROJECT_DIR, 'assets', 'acts', '_monsters_exp', '0B', 'TR')
    actions = {
        'idle': '0BTRLITNUHTH.dcc',
        'walk': '0BTRLITWLHTH.dcc',
        'attack': '0BTRLITA1HTH.dcc',
        'hit': '0BTRLITGHHTH.dcc',
        'death': '0BTRLITDTHTH.dcc',
        'cast': '0BTRLITS2HTH.dcc'
    }
    
    cell_w = 180
    cell_h = 210
    anchor_x = 90
    anchor_y = 170
    
    manifest_actions = {}
    
    for act_name, fn in actions.items():
        fp = os.path.join(base_dir, fn)
        if not os.path.exists(fp):
            print(f"[ERROR] Missing {fp}")
            continue
            
        dec = DCCDecoder(fp)
        dirs = dec.directions
        fpd = dec.frames_per_dir
        sheet_w = cell_w * fpd
        sheet_h = cell_h * dirs
        sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))
        
        for d in range(dirs):
            dir_frames = dec.decode_direction(d)
            if not dir_frames:
                continue
            for f in range(fpd):
                dst_cell_x = f * cell_w
                dst_cell_y = d * cell_h
                fr = dir_frames[min(f, len(dir_frames) - 1)]
                fw, fh = fr['width'], fr['height']
                if fw == 0 or fh == 0:
                    continue
                frame_img = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
                pixels = fr['pixels']
                for y in range(fh):
                    src_y = (fh - 1 - y) if fr['bottom_up'] else y
                    for x in range(fw):
                        idx = pixels[src_y * fw + x]
                        if idx != 0:
                            r, g, b, _ = PAL5[idx]
                            frame_img.putpixel((x, y), (r, g, b, 255))
                dst_x = dst_cell_x + anchor_x + fr['x_offset']
                dst_y = dst_cell_y + anchor_y + fr['y_offset'] - fh + 1
                sheet.paste(frame_img, (dst_x, dst_y), frame_img)
                
        out_fn = f"succubus_{act_name}.png"
        out_path = os.path.join(OUT_MONSTERS_DIR, out_fn)
        sheet.save(out_path)
        print(f"  [SUCCUBUS] {out_fn} saved ({sheet_w}x{sheet_h}, {dirs} dirs x {fpd} frames)")
        manifest_actions[act_name] = {
            "file": f"assets/monsters/{out_fn}",
            "directions": dirs,
            "frames_per_dir": fpd,
            "cell_width": cell_w,
            "cell_height": cell_h,
            "anchor_x": anchor_x,
            "anchor_y": anchor_y,
            "fps": 14 if act_name in ['walk', 'attack', 'cast'] else 12,
            "loop": act_name in ['idle', 'walk']
        }
        
    return manifest_actions

if __name__ == '__main__':
    res = export_succubus()
    print("Done exporting succubus. Resulting manifest snippet:")
    print(json.dumps(res, indent=2))

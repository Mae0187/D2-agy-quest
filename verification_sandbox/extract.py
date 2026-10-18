import re
import os
from pathlib import Path

def extract_code_blocks(filepath):
    content = Path(filepath).read_text(encoding="utf-8")
    lines = content.splitlines()
    
    current_file = None
    collecting = False
    code_lines = []
    results = {}
    
    for line in lines:
        # Check header
        m = re.match(r"^##\s+(?:補丁:)?(?:`?src/([a-zA-Z0-9_\-\.]+)(?:`?.*)?)$", line.strip())
        if m:
            filename = m.group(1)
            is_patch = "補丁" in line
            current_file = (filename, is_patch)
            collecting = False
            continue
            
        if current_file:
            if line.strip().startswith("```ts") or line.strip().startswith("```typescript"):
                collecting = True
                code_lines = []
                continue
            elif line.strip().startswith("```") and collecting:
                collecting = False
                fname, is_patch = current_file
                if is_patch:
                    results[f"PATCH_{fname}"] = "\n".join(code_lines) + "\n"
                else:
                    results[fname] = "\n".join(code_lines) + "\n"
                current_file = None
                continue
                
            if collecting:
                code_lines.append(line)
                
    return results

files = [
    r"C:\Users\DUCK\Desktop\D2-agy-quest\suggestions1\sone2.txt",
    r"C:\Users\DUCK\Desktop\D2-agy-quest\suggestions1\sone3.txt",
    r"C:\Users\DUCK\Desktop\D2-agy-quest\suggestions1\sone5_3-A.txt",
    r"C:\Users\DUCK\Desktop\D2-agy-quest\suggestions1\sone5_3-B.txt"
]

all_extracted = {}
for f in files:
    res = extract_code_blocks(f)
    print(f"File {Path(f).name} extracted: {list(res.keys())}")
    all_extracted.update(res)

out_dir = Path(r"C:\Users\DUCK\Desktop\D2-agy-quest\verification_sandbox\src")
out_dir.mkdir(parents=True, exist_ok=True)

# First write non-patch files
for fname, code in all_extracted.items():
    if not fname.startswith("PATCH_"):
        out_path = out_dir / fname
        out_path.write_text(code, encoding="utf-8")
        print(f"Wrote {out_path} ({len(code)} bytes)")

# Handle patch for targets.ts if exists
if "PATCH_targets.ts" in all_extracted:
    targets_path = out_dir / "targets.ts"
    targets_code = targets_path.read_text(encoding="utf-8")
    patch_code = all_extracted["PATCH_targets.ts"]
    
    # insert before the closing brace of TargetRegistry or after findNearestUnit
    # Let's see where findNearestUnit ends
    idx = targets_code.find("findNearestUnit(")
    if idx != -1:
        # find the end of findNearestUnit method
        # It ends with 'return bestId;\n  }'
        ret_idx = targets_code.find("return bestId;\n  }", idx)
        if ret_idx != -1:
            insert_pos = ret_idx + len("return bestId;\n  }\n")
            new_code = targets_code[:insert_pos] + "\n" + patch_code + targets_code[insert_pos:]
            targets_path.write_text(new_code, encoding="utf-8")
            print("Successfully applied PATCH_targets.ts to targets.ts!")
        else:
            print("Could not find method end in targets.ts")
    else:
        print("Could not find findNearestUnit in targets.ts")

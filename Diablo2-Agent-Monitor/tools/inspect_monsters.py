import json
import os

with open('Diablo2-Agent-Monitor/web/assets/monsters/monsters_manifest.json', encoding='utf-8') as f:
    manifest = json.load(f)

print(f"Total monsters in manifest: {len(manifest)}")
for k, v in manifest.items():
    print(f"- {k:15s}: {v.get('name', '')} (act: {v.get('act')}, type: {v.get('type')})")

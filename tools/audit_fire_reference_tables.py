import csv
import json

def read_tsv(path):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        reader = csv.reader(f, delimiter='\t')
        headers = next(reader)
        rows = []
        for r in reader:
            if not r or not r[0].strip(): continue
            rows.append({headers[i]: r[i] if i < len(r) else '' for i in range(len(headers))})
        return rows

skills = read_tsv('d2_reference_tables/Skills.txt')
missiles = read_tsv('d2_reference_tables/Missiles.txt')

fire_skills = ['Fire Bolt', 'Warmth', 'Inferno', 'Blaze', 'Fire Ball', 'Fire Wall', 'Enchant', 'Meteor', 'Fire Mastery', 'Hydra']

print("=== SORCERESS FIRE SKILLS IN Skills.txt ===")
referenced_missiles = set()

for s in skills:
    sname = s.get('skill', '')
    if any(fs.lower() == sname.lower() for fs in fire_skills):
        print(f"Skill: {sname} (ID: {s.get('Id')})")
        print(f"  anim: {s.get('anim')}, seqnum: {s.get('seqnum')}")
        print(f"  srvmissile: {s.get('srvmissile')}, cltmissile: {s.get('cltmissile')}")
        print(f"  srvmissilea: {s.get('srvmissilea')}, srvmissileb: {s.get('srvmissileb')}, srvmissilec: {s.get('srvmissilec')}")
        print(f"  cltmissilea: {s.get('cltmissilea')}, cltmissileb: {s.get('cltmissileb')}, cltmissilec: {s.get('cltmissilec')}")
        print(f"  castoverlay: {s.get('castoverlay')}, targetoverlay: {s.get('targetoverlay')}")
        for k in ['srvmissile', 'cltmissile', 'srvmissilea', 'srvmissileb', 'srvmissilec', 'cltmissilea', 'cltmissileb', 'cltmissilec']:
            m = s.get(k)
            if m: referenced_missiles.add(m)

print("\n=== REFERENCED MISSILES IN Missiles.txt ===")
all_missile_names = set(referenced_missiles)

# Also find submissiles, hitmissiles, cltsubmissiles recursively
to_check = list(referenced_missiles)
checked = set()

while to_check:
    cur = to_check.pop()
    if cur in checked: continue
    checked.add(cur)
    for m in missiles:
        if m.get('Missile', '').lower() == cur.lower():
            for sub_k in ['ExplosionMissile', 'SubMissile', 'HitSubMissile', 'CltHitSubMissile', 'CltSubMissile']:
                sub_m = m.get(sub_k)
                if sub_m and sub_m not in checked:
                    all_missile_names.add(sub_m)
                    to_check.append(sub_m)

print(f"Total relevant missiles: {len(all_missile_names)} -> {all_missile_names}")

print("\n=== DETAILED MISSILE DATA ===")
for mname in sorted(all_missile_names):
    matching = [m for m in missiles if m.get('Missile', '').lower() == mname.lower()]
    if not matching:
        print(f"MISSING: {mname}")
        continue
    m = matching[0]
    print("\n=== OVERLAY.TXT AUDIT FOR FIRE OVERLAYS ===")
overlays = read_tsv('d2_reference_tables/Overlay.txt')
for o in overlays:
    oname = o.get('Overlay', '').lower()
    fname = o.get('Filename', '').lower()
    if 'fire' in oname or 'fire' in fname or 'cast' in oname:
        print(f"Overlay: {o.get('Overlay')} (Id: {o.get('Id')}) -> Filename: {o.get('Filename')}, AnimLen: {o.get('AnimLen')}, Xoffset: {o.get('Xoffset')}, Yoffset: {o.get('Yoffset')}, Height: {o.get('Height')}")

print("\n=== HYDRA IN MonStats.txt & Skills.txt ===")
monstats = read_tsv('d2_reference_tables/monstats.txt')
for m in monstats:
    if 'hydra' in m.get('Id', '').lower() or 'hydra' in m.get('NameStr', '').lower():
        print(f"Monster: {m.get('Id')} -> BaseId: {m.get('BaseId')}, Code: {m.get('Code')}, velocity: {m.get('velocity')}, run: {m.get('run')}")
        print(f"  Skill1: {m.get('Skill1')}, Skill2: {m.get('Skill2')}")

print("\n=== HYDRA MISSILE IN Missiles.txt ===")
for m in missiles:
    if m.get('Missile', '').lower() == 'hydra':
        for k, v in m.items():
            if v:
                print(f"  {k}: {v}")



# 📜 Diablo II Skill Animation & Physics Implementation Manual
> **Authoritative Specification & Standardized Pipeline for Blizzard Diablo II 1.13c Skill Animations, Asset Extraction, and Physics Assembly**

---

## 1. Executive Summary & Purpose

This manual establishes the mandatory, zero-drift engineering protocol for extracting, verifying, and assembling skill animations and projectile physics across all character classes and skill trees in the *Diablo II Agent Monitor* project.

During early development, regressions occurred due to reliance on unverified community sprites, ad-hoc velocities, incorrect animation modes (e.g., using barbarian warcry animations for melee sequences), asset confusion (e.g., mixing up large fire wall pillars with medium meteor residue), and displaced projectile launch sockets.

This specification documents the complete end-to-end pipeline tested and proven during the Sorceress Fire Tree implementation. Every subsequent skill tree (Cold Sorceress, Lightning Sorceress, Paladin, Necromancer, Amazon, Barbarian, Druid, Assassin) **MUST** strictly follow this protocol.

---

## 2. The Single Source of Truth Hierarchy & Authoritative Repositories

When resolving any conflict regarding visual appearance, animation frame counts, projectile velocities, or sound effects, follow this strict priority ladder:

```
[Level 1: Highest Authority] ──> Blizzard Official Diablo II 1.13c MPQ Archives (d2data.mpq, d2exp.mpq, patch_d2.mpq)
[Level 2: Reference Tables]  ──> Extracted d2_reference_tables/ (Skills.txt, Missiles.txt, Overlay.txt, AnimData.D2)
[Level 3: Normalized Assets] ──> diablo2_normalized_assets/ (Standardized Union-Box Atlases & Metadata)
[Level 4: Implementation]    ──> verification_sandbox/ (25Hz Logic Step & Playwright E2E Verification)
```

### 2.1 Essential Open-Source Repositories & Knowledge Bases (`D2.txt` Cross-Reference)

To maintain absolute fidelity with Blizzard's original design, cross-verify against these canonical resources:

1. **`blizzhackers/d2data`** ([GitHub](https://github.com/blizzhackers/d2data)):
   - Complete canonical data table structures and field documentations (Skills, Missiles, Overlay, MonStats, AnimData).
   - Authoritative reference for `PreDraw`, `Trans`, `AnimRate`, `InitSteps`, and `pSrvDoFunc`.
2. **`OpenDiablo2`** ([GitHub](https://github.com/OpenDiablo2)):
   - Open-source Golang re-implementation of the Diablo II engine.
   - Reference implementation for 25Hz fixed-step physical loops, COF multi-part composite assembly, and Overlay Z-order rendering pipeline (`PreDraw: 0` vs `PreDraw: 1`).
3. **`softbearlolz/iya-backup (易牙居)`** ([GitHub](https://github.com/softbearlolz/iya-backup)):
   - Traditional Chinese reference encyclopedia for all 210 skills across 7 classes, including complete skill trees, synergy formulas, and prerequisite trees.
4. **Blizzard Official Arreat Summit** ([battle.net](https://classic.battle.net/diablo2exp/skills/)):
   - Definitive visual screenshots and spell descriptions for Sorceress, Paladin, Necromancer, Amazon, Barbarian, Druid, and Assassin.
5. **Community Sprite & Asset Vaults**:
   - [The Spriters Resource](https://www.spriters-resource.com/pc_computer/diablo2diablo2lordofdestruction/): Original extracted sprite sheets across character armor tiers.
   - [nebuladevs/pcx-to-spritesheet](https://github.com/nebuladevs/pcx-to-spritesheet): DCC/DC6 palette unpacking utilities.
   - [D2R Repositories Hub](https://elmagnifico.tech/2022/01/10/Diablo2Resurrected-Repositories/): Compilation of decompiled engine tools and MOD specifications.

**Rule of Thumb**: Never guess a coordinate, frame count, or speed. If it exists in `Skills.txt` or `Missiles.txt`, that value is immutable.

---

## 3. Phase 1: Binary MPQ Asset Extraction & Verification (StormLib Pipeline)

### 3.1 MPQ Archive Scanning
Blizzard packages game assets in MoPaQ (MPQ) archives. We utilize the 64-bit `StormLib.dll` wrapper via Python (`tools/d2_proj_toolkit.py`) to access:
- `d2data.mpq`: Base game sprites, character animations, monster models, environment tiles.
- `d2exp.mpq`: Expansion (Lord of Destruction) assets, Druid/Assassin animations, Act 5 palettes.
- `patch_d2.mpq`: Version 1.13c balance patches, updated TXT data tables, and hotfix DCC files.

### 3.2 COF & DCC Decoding
1. **Component Order Format (`.COF`)**:
   - Defines composite sprite layering order for multi-part entities (e.g., Sorceress, Necromancer, Hydra).
   - Component layers include:
     - `TR` (Torso)
     - `HD` (Head)
     - `LG` (Legs)
     - `RA` (Right Arm) / `LA` (Left Arm)
     - `RH` (Right Hand Weapon: Staff, Sword, Wand)
     - `LH` (Left Hand Shield)
     - `S1` (Special 1: Flame mane, cape, aura)
     - `S2` (Special 2)
   - *Example*: For Hydra, `HXNUHTH.COF` specifies `TR` (flesh body) and `S1` (burning neck mane). If the user requests a pure flesh body, `TR` is extracted individually while omitting `S1`.

2. **Directional Cell Compression (`.DCC`)**:
   - Blizzard's proprietary vector-quantized sprite format storing 8, 16, or 32 directional views.
   - Contains variable frame counts, pixel bitmaps, directional bitmasks, and per-frame directional pixel offsets (`box_x`, `box_y`, `box_w`, `box_h`).

3. **Palette Conversion**:
   - D2 uses 8-bit indexed color palettes (`act1.dat` through `act5.dat`).
   - Index 0 is strictly transparent (`RGBA: 0, 0, 0, 0`).
   - Index 255 and specific ranges mapped through `colormaps.dat` dictate lighting, transparency blending, or cold/poison color shifts.

### 3.3 The Union-Box Normalization Protocol
Naive sprite extraction creates severe graphical bugs:
- **Jittering / Drifting**: Centering each frame individually causes the sprite to oscillate wildly during playback.
- **Flat Cuts**: Cropping each direction tightly clips protruding staffs, weapons, or tails.

**The Solution: Union-Box Atlas**:
1. Iterate across all $D$ directions and all $F$ frames of the DCC animation.
2. Determine the global bounding box extremes relative to the entity's ground reference origin $(0, 0)$:
   $$\text{min\_x} = \min_{d, f} (\text{offset\_x}_{d,f}), \quad \text{max\_x} = \max_{d, f} (\text{offset\_x}_{d,f} + \text{width}_{d,f})$$
   $$\text{min\_y} = \min_{d, f} (\text{offset\_y}_{d,f}), \quad \text{max\_y} = \max_{d, f} (\text{offset\_y}_{d,f} + \text{height}_{d,f})$$
3. Compute the unified atlas cell dimensions:
   $$\text{cell\_w} = \text{max\_x} - \text{min\_x}, \quad \text{cell\_h} = \text{max\_y} - \text{min\_y}$$
   $$\text{anchor\_x} = -\text{min\_x}, \quad \text{anchor\_y} = -\text{min\_y}$$
4. Assemble into a single PNG grid where each row represents a direction and each column represents a frame.
5. Save companion JSON metadata specifying `cellWidth`, `cellHeight`, `anchorX`, `anchorY`, `directions`, `framesPerDir`, and `fps`.

---

## 4. Phase 2: Authoritative Reference Table Audit (`d2_reference_tables/`)

Every skill implementation requires auditing four core data tables located in `d2_reference_tables/`:

### 4.1 `Skills.txt`
| Column | Purpose & Verification Rule |
| :--- | :--- |
| `Skill` | Canonical internal skill name (e.g., `Fire Bolt`, `Fire Wall`, `Hydra`). |
| `Id` | Unique numeric identifier. |
| `charclass` | Character class constraint (`sor`, `pal`, `nec`, `bar`, `ama`, `dru`, `ass`). |
| `anim` | Required player animation mode during cast (`SC` = Spell Cast, `SQ` = Sequence, `A1`/`A2` = Attack, `TH` = Throw). **Never invoke SC (warcry/roar) for weapon attacks**. |
| `srvmissile` / `cltmissile` | The primary projectile spawned by this skill, mapped to `Missiles.txt`. |
| `Param1` - `Param8` | Skill-specific duration and synergy multipliers. **Crucial**: For Hydra, `Param1 = 250` specifies a 250-frame lifetime ($250 \div 25 = 10.0\text{ seconds}$). |
| `delay` | Casting delay in frames (e.g., Blizzard or Meteor cooldown). |

### 4.2 `Missiles.txt`
| Column | Purpose & Verification Rule |
| :--- | :--- |
| `Missile` | Projectile / entity identifier. |
| `Id` | Numeric missile ID (e.g., `58` = firebolt, `62` = fireball, `240` = meteorfire). |
| `Vel` | Speed in subpixels/frame. Mandatory for projectile trajectory speed. |
| `Range` | Total missile lifetime in frames at 25 FPS (e.g., `Range: 50` = 2.0s; `Range: 90` = 3.6s). |
| `InitSteps` | Initial forward offset ticks. Prevents missile from spawning inside caster hitbox. Multiply by forward direction vector. |
| `CelFile` | The exact DCC asset filename inside MPQ (e.g., `groundFireBig` vs `groundFireMedium`). |
| `pSrvDoFunc` | Server trajectory function: `1` = standard linear ballistic, `7` = guided homing (only Guided Arrow, Bone Spirit). Linear missiles must **never** home. |
| `CollideType` | Hitbox collision rules (wall, monster, ground). |
| `ExplosionMissile` | Secondary missile triggered on impact (e.g., Fireball spawns `FireArrowExplode2`). |

### 4.3 `Overlay.txt` & The PreDraw Occlusion Protocol
Defines visual attachments, ground emitters, status indicators, and character auras:
- **The Mandatory `PreDraw` Occlusion Rule**:
  - `PreDraw: 1` (**Background / Back Layer**): The overlay is drawn **behind** the target unit's torso.
    *Examples*: Paladin back auras (`AuraHolyFireBack`, `AuraResistColdBack`, `AuraMightBack`).
  - `PreDraw: 0` (**Foreground / Front Layer**): The overlay is drawn **in front of** the target unit, partially occluding the unit's body.
    *Examples*: Paladin front auras (`AuraHolyFireFront`), cast glows (`FireCast`), Golem rising bursts (`FireGolemRise`), and **Hydra Ground Fire (`HydraStart1~3`, `HydraLoop1~3`, `HydraEnd1~3`)**.
  - *Engineering Fallacy Fixed*: Rendering ground fire strictly *behind* the Hydra entity produces an unnatural floating bug with hard sliced sprite edges. Setting `PreDraw: 0` ensures the leaping flame tongues lick upward and cover the entity base, integrating the monster seamlessly into the burning terrain.
- **Blending Mode (`Trans` column)**:
  - `Trans: 3` represents additive blending without black borders (pure black `RGBA 0,0,0` is transparent, non-black pixels are rendered additively via `lighter` composite operation).
- **Multi-Entity Overlay Mapping (`monstats.txt` Linkage)**:
  - Certain multi-entity skills spawn separate monsters that bind individual overlays:
    - `hydra1` (MonStats Id 351) ──> Binds `HydraStart1 / HydraLoop1 / HydraEnd1` (Raw Overlay.txt: `X: -6, Y: -11` | In-game visual calibration: `X: -11, Y: -6`).
    - `hydra2` (MonStats Id 352) ──> Binds `HydraStart2 / HydraLoop2 / HydraEnd2` (Raw Overlay.txt: `X: 0, Y: -7` | In-game visual calibration: `X: -10, Y: -6`).
    - `hydra3` (MonStats Id 353) ──> Binds `HydraStart3 / HydraLoop3 / HydraEnd3` (Raw Overlay.txt: `X: +4, Y: -15` | In-game visual calibration: `X: -8, Y: -6`).
  - All three overlays run at `AnimRate: 16` (16 FPS) with phase offsets, yielding a dynamic, undulating ground blaze.
  - *Note on In-Game Calibration*: Overlay.txt offsets reflect raw 3D-to-2.5D projection deltas; when rendered with bottom-aligned Union-Box atlases, the calibrated offsets `[-11, -6]`, `[-10, -6]`, `[-8, -6]` align each leaping flame tongue's visual epicenter directly below each neck's contact point.
- Other Common Overlays:
  - `MeteorTargetIndicator` (Id: 45): Renders a pulsing red runic reticle on the ground before the meteor falls.
  - `Bone Armor`, `Cyclone Armor`, `Frozen Armor`, and overhead curses.

### 4.4 `AnimData.D2` (Action Frame Extraction)
- A 256-bucket binary hash table containing frame speeds and action trigger frames for every character and monster DCC animation.
- **Action Frame (Release Frame)**: The exact frame index where the missile leaves the caster's hand:
  - Sorceress Spell Cast (`SOSC`): Frame 7.
  - Necromancer Spell Cast (`NESC`): Frame 8.
  - Amazon Bow Attack (`AMBW`): Frame 6.
  - Hydra Head Attack (`HXA1`): Frame 8.
- *Strict Rule*: The projectile or spell entity must **never** appear on Frame 0 of the cast. It must spawn precisely on `ActionFrame`.

---

## 5. Phase 3: Coordinate Systems, Sockets, and Geometric Alignment

### 5.1 The Four Decoupled Coordinate Systems
1. **World Cartesian Space $(X, Y)$**:
   - Ground logic plane where physics, movement, and distance calculations occur.
2. **Screen Isometric Space $(S_x, S_y)$**:
   - 2:1 isometric projection:
     $$S_x = (X - Y) \cdot \cos(30^\circ) + \text{Origin}_X$$
     $$S_y = (X + Y) \cdot \sin(30^\circ) \cdot 0.5 + \text{Origin}_Y$$
3. **Entity Ground Anchor $(0, 0)$**:
   - The exact point where the character's feet contact the ground diamond.
4. **Hitbox Center (Torso Center)**:
   - Hit detection is **never** checked against the feet $(0, 0)$ or overhead air $(0, -70)$.
   - Target hitbox center is anchored at **$Y - 18\text{px}$** (for monsters/dummies) or **$Y - 38\text{px}$** (for human characters).

### 5.2 Cast Sockets (Hand / Staff Sockets)
Projectiles must originate from the tip of the weapon or caster's palm, not the navel or feet.
- Store a 16-direction lookup table `castSockets[direction]` containing `[dx, dy]` relative to the character ground anchor.
- When casting towards target angle $\theta$, look up the character's facing direction, fetch `castSockets[direction]`, and spawn the projectile at:
  $$P_0 = (P_{\text{caster}.x} + dx, P_{\text{caster}.y} + dy)$$

### 5.3 Monster & Creature Sockets (e.g., Hydra Mouth Sockets)
For multi-headed or creature entities, projectiles must emit from the mouth cavity measured at `ActionFrame` (Frame 8) relative to entity anchor (`pivotX: 56, pivotY: 83`):
```
Direction 7 (East):       [+44, -43]
Direction 3 (Southeast):  [+20, -21]
Direction 4 (South):      [-22, -13]
Direction 0 (Southwest):  [-42, -38]
Direction 5 (West):       [-41, -47]
Direction 1 (Northwest):  [-14, -55]
Direction 6 (North):      [ +1, -62]
Direction 2 (Northeast):  [+39, -49]
```
Add `InitSteps` forward vector (4px forward) along the target direction vector so the fire bolt emerges cleanly from between the teeth.

### 5.4 Trilateral Formation & Dual-Layer Flame Wrapping Protocol
When rendering multi-part stationary elemental entities (such as Hydra):
1. **Trilateral Isometric Formation**:
   - The three heads must not share an identical anchor or crowd within a tight 16px radius.
   - Deploy in a 2:1 isometric triangle (relative to spawn origin `[X, Y]`):
     - Head 1 (Center-Fore): `[dx: 0, dy: +6]`, facing South / East / West.
     - Head 0 (Left-Rear): `[dx: -22, dy: -8]`, facing Southwest / Northwest.
     - Head 2 (Right-Rear): `[dx: +22, dy: -8]`, facing Southeast / Northeast.
2. **Ground Fire Anchoring & Dual-Layer Flame Wrapping**:
   - Each head's ground contact point `[hx, hy] = [spawnX + dx, spawnY + dy]` binds its own dedicated ground blaze.
   - **Calibrated Fire Offsets** (relative to each head's ground base `[hx, hy]`):
     - Fire 0 (under Head 0): `[fox: -11, foy: -6]`
     - Fire 1 (under Head 1): `[fox: -10, foy: -6]`
     - Fire 2 (under Head 2): `[fox:  -8, foy: -6]`
     - *Result*: The fire epicenter is centered just slightly below each serpent neck's contact point, creating an organic base from which the flames rise.
3. **The 3-Step Dual-Layer Render Pipeline**:
   - **Step 1 (Back Glow)**: Render `HydraGroundFire` behind the body at `[hx + fox - pivotX, hy + foy - pivotY]` with `alpha = 0.45` and `lighter` additive composite to illuminate the ground and cast ambient backlight.
   - **Step 2 (Middle Body)**: Render composite DCC body (Torso TR + S1 Burning Mane) sorted strictly by `anchor.y` depth.
   - **Step 3 (Foreground Flame, PreDraw: 0)**: Render `HydraGroundFire` in front of the body at `[hx + fox - pivotX, hy + foy - pivotY]` with `alpha = 0.95` and `lighter` composite. The leaping flame tongues lick upward and cover the root/pedestal, producing the canonical Blizzard Arreat Summit aesthetic.

### 5.5 Additive Layer De-Blacking Protocol (COF S1 Special Layer De-Occlusion)
- **The Black Patch Bug**: When combining physical bodies (e.g., `HXTR` flesh) with additive effects (e.g., `HXS1` burning mane), direct RGBA conversion causes solid black triangular blocks to appear over the head and neck.
- **Root Cause**:
  - In Diablo 2's software renderer, `S1` is an additive overlay (`DrawMode: 3`). Its falloff ramp utilizes palette indices 172 (`[5, 5, 5]`), 173 (`[11, 11, 11]`), 33 (`[11, 5, 5]`), and 34 (`[22, 5, 0]`), which produce zero additive luminance on screen (`dst + 5 ~= dst`).
  - However, when converted to an RGBA PNG atlas without filtering, these pixels become **opaque black (`alpha = 255`)**. When drawn with canvas `source-over`, they stamp opaque black silhouettes over the background flames and adjacent heads.
- **De-Occlusion Iron Rule**:
  - During DCC extraction for any additive or semi-transparent sub-layer (`S1`, glow mane, auras), all indices `172, 173, 33, 34` and any pixel with `R + G + B < 50` MUST have their alpha channel set to `0` (transparent).
  - This ensures that only luminous orange/yellow flame tongues are preserved, eliminating all black bounding residue.

---

## 6. Phase 4: Runtime Assembly & 25Hz Fixed-Tick Execution Lifecycle

### 6.1 The 25Hz Fixed-Tick Architecture
Blizzard's engine runs logic at exactly 25 FPS (1 tick = 40.0 ms), decoupled from screen refresh rates:
```
Logic Accumulator += DeltaTime
While (LogicAccumulator >= 40ms):
    Update_Projectiles_Physics_Tick()
    Update_Entity_Timers_Tick()
    LogicAccumulator -= 40ms
Interpolate_And_Render(Alpha)
```

### 6.2 Strict 3-Tier Layering System
To prevent rendering order bugs (e.g., dead bodies floating above running players):
- **Tier 0 (Ground Sub-Layer)**: Corpses, blood pools, ground indicators, Firewall pillars, Meteor residual fire.
- **Tier 1 (Middle Layer)**: Active living monsters, boss entities.
- **Tier 2 (Top Layer)**: Player character, party summons, hirelings/mercenaries.
- *Within each tier*: Sort strictly by bottom anchor screen Y coordinate for correct isometric occlusion.

### 6.3 The Four-Stage Skill Lifecycle Model

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ Stage 1: Cast   │ ────> │ Stage 2: Flight │ ────> │ Stage 3: Impact │ ────> │ Stage 4: Residue│
│ ActionFrame Sync│       │ Ballistic Move  │       │ AoE & Damage    │       │ Ground Decals   │
└─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
```

1. **Stage 1 (Cast)**:
   - Play character `SC` animation.
   - At `ActionFrame` (e.g., Frame 7), consume mana, play casting sound (`castfire.wav`), and trigger missile spawn.
2. **Stage 2 (Flight / Travel)**:
   - Move projectile by $\text{Vel} \times \Delta t$ along heading vector.
   - Advance animation frame based on atlas playback speed.
   - Increment `lifeTicks`. If `lifeTicks >= Range`, terminate or trigger explosion.
3. **Stage 3 (Impact / Collision)**:
   - Check distance to target torso hitbox: $\text{dist} < \text{Radius}$.
   - If single-target (Fire Bolt): inflict damage to single target, play hit spark, terminate missile immediately (0 explosion).
   - If AoE (Fireball, Meteor): spawn explosion atlas entity (`FireArrowExplode2`, radius 80px), query targets within radius, apply damage, play explosion sound.
4. **Stage 4 (Residue / Secondary)**:
   - If skill has secondary duration (Meteor residue, Firewall): spawn ground fire entity with `maxLifeTicks = Range` (90 ticks = 3.6s).
   - Apply continuous damage-over-time ticks to entities standing on ground fire tiles.

---

## 7. Phase 5: Complete Walkthrough of the Sorceress Fire Tree Benchmark

| Skill | Reference Table Alignment | MPQ Asset Used | Visual & Physics Behavior |
| :--- | :--- | :--- | :--- |
| **Fire Bolt** | `Id: 58`<br>`Vel: 20`<br>`Range: 50`<br>`pSrvDoFunc: 1` | `firebolt`<br>(32-dir / 16-dir) | Pure single-target missile. Emitted from staff socket on Frame 7. Flies in straight line. On contact: damages target and immediately vanishes. **Zero explosion**. |
| **Fire Ball** | `Id: 62`<br>`Vel: 20`<br>`Range: 50`<br>`Explosion: 80px` | `fireball` +<br>`FireArrowExplode2` | Linear flight at Vel 20. On impact with monster torso, triggers 80px circular AoE explosion (12 frames, 80x72). Hits all monsters within radius. |
| **Inferno** | `Id: 60/61`<br>`Vel: 12`<br>`Range: 30`<br>`InitSteps: 1` | `Flamethrower`<br>(conical fire cloud) | Continuous stream emitted from staff tip ($Y - 32$, forward 24px). Spawns overlapping expanding fire clouds with $\pm 12^\circ$ angular spread. Velocity: 12. |
| **Fire Wall** | `Id: 69`<br>`CelFile: groundFireBig`<br>`Range: 90` (3.6s) | `groundFireBig`<br>(68x169, anchor: 34, 158) | Spawns 7 pillars along a line perpendicular to cast vector. Compressed by 2:1 isometric factor. Employs large fire pillar asset. Duration: 90 ticks (3.6s). |
| **Meteor** | `Id: 72 / 240`<br>`Target: Overlay 45`<br>`meteorfire: Id 240` | `MeteorTargetIndicator` + `Meteor` + `MeteorTail` + `groundFireMedium` | Four-phase sequence: 1) Red runic circle on ground (1.2s delay); 2) Meteor rock + fire tail drop from top; 3) 210x176 ground detonation; 4) Residual fire using **medium ground fire** (`groundFireMedium`, 68x138), **not** big fire wall. |
| **Hydra** | `Skills.txt: 64`<br>`Missiles.txt: 339`<br>`MonStats: 351~353`<br>`Overlay: 174~182`<br>`Param1: 250` (10s)<br>`Missile Vel: 14`<br>`Range: 30` | `HXTRLIT` (Torso)<br>+ `HXS1LIT` (Mane)<br>+ `HydraGroundFire`<br>(Start / Loop / End) | Spawns 3 independent serpent units (`hydra1~3`) in a trilateral isometric triangle (`[0, 6]`, `[-22, -8]`, `[+22, -8]`). Fixed duration: 250 ticks (10.0s). Each head binds its respective `Overlay.txt` ground fire (`PreDraw: 0`, 16 FPS). Rendered with dual-layer wrapping (Back Glow 0.45 + Front Leaping Flame 0.95). Heads whip to Frame 8 on attack, launching Fire Bolt from 8-dir mouth socket at Vel 14, forward push 4px. |

---

## 8. Phase 6: Standardized Verification Checklist for New Skill Trees

When building the next skill tree (e.g., Sorceress Cold Tree, Paladin Combat Tree), execute this sequential checklist:

- [ ] **Step 1: Reference Table Audit**:
  - Extract rows from `Skills.txt` and `Missiles.txt` for all target skills.
  - Record exact `Vel`, `Range`, `InitSteps`, `anim`, `ActionFrame`, `Param` durations, and asset `CelFile` names into a verification table.
- [ ] **Step 2: MPQ Asset Audit & Extraction**:
  - Locate DCC files in `d2data.mpq` / `patch_d2.mpq`.
  - Check `.COF` to see if multi-part layers are required or if single-layer extraction is intended.
  - Run `d2_proj_toolkit.py` to generate normalized Union-Box PNG atlases and JSON metadata with global bounding boxes.
- [ ] **Step 3: Launch Socket & Landmark Mapping**:
  - Determine whether projectile launches from character hand, staff tip, weapon tip, or creature mouth.
  - Record direction-based offset tables.
- [ ] **Step 4: Sandbox Implementation (`verification_sandbox/src/demo.ts`)**:
  - Implement 25Hz logic step for the skills.
  - Verify trajectory function (`pSrvDoFunc`: linear vs orbital vs arc).
  - Verify hit detection checks monster torso height ($-18\text{px}$), not feet.
  - Ensure zero skill announcement text popups (floating damage numbers only).
- [ ] **Step 5: Automated E2E Regression Verification**:
  - Run headless Playwright script to test skill activation, missile flight, target hit, and lifetime expiration.
  - Verify 0 console errors (`page.on('console', msg => ...)`).
  - Capture real screenshot evidence and store strictly in `testimages/`.
- [ ] **Step 6: Production Integration & README Sync**:
  - Deploy verified bundles to `Diablo2-Agent-Monitor/web/`.
  - Update `README.md` Change Log with Taipei Time (UTC+8) and active 10-log rolling window.

---

## 9. Appendix: Authoritative All-Class Skill Matrix (`D2.txt` & Reference Table Blueprint)

This blueprint maps upcoming skill trees from `Skills.txt`, `Missiles.txt`, and `Overlay.txt`, providing the verified parameters required for rapid, zero-drift implementation:

### 9.1 Sorceress Cold Tree (Next Milestone)
| Skill Name | Skill Id | Missile Id | CelFile / DCC | Anim | Release Frame | Vel | Range | Physics / Overlay Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Ice Bolt** | 67 | 73 | `icebolt` | `SC` | 7 | 18 | 40 | Linear ballistic direct hit, freezes target. No explosion. |
| **Frost Nova** | 73 | 77 | `frostnova` | `SC` | 7 | 8 | 15 | Expanding 360-degree ring of 24 ice shards originating at caster feet ($Y - 0$). |
| **Ice Blast** | 75 | 78 | `iceblast` | `SC` | 7 | 22 | 45 | High-velocity linear ice crystal with compact impact shatter (`iceshatter`). |
| **Shiver Armor** | 83 | 91 | `shiverarmor` | `SC` | 7 | - | - | Binds `Overlay.txt` spinning icy shield reticle (`PreDraw: 0`). Retaliates against attackers. |
| **Glacial Spike** | 85 | 92 | `glacialspike` | `SC` | 7 | 24 | 50 | Heavy ice comet triggering 60px AoE freeze burst (`glacialspikeexplode`). |
| **Blizzard** | 89 | 94 | `blizzard` | `SC` | 7 | 16 | 20 | Overhead cloud spawning vertical falling ice stalactites across 120px radius over 4.0s. |
| **Frozen Orb** | 95 | 99 | `frozenorb` | `SC` | 7 | 10 | 60 | Spinning parent orb traveling along vector, emitting 16 spiral Ice Bolts per 2 ticks. Detonates in a nova at Range 60. |

### 9.2 Sorceress Lightning Tree
| Skill Name | Skill Id | Missile Id | CelFile / DCC | Anim | Release Frame | Vel | Range | Physics / Overlay Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Charged Bolt** | 38 | 40 | `chargedbolt` | `SC` | 7 | 10 | 45 | 7 erratically wandering electric sparks emitted across $\pm 27^\circ$ fan. Uses random drift vector. |
| **Static Field** | 42 | 43 | `staticfield` | `SC` | 7 | - | - | Instantaneous 360-degree electric flash (Radius: 100px). Reduces monster HP by 25%. |
| **Nova** | 48 | 49 | `nova` | `SC` | 7 | 14 | 20 | 360-degree expanding electric wave of 24 bolts expanding outward from caster. |
| **Lightning** | 53 | 54 | `lightning` | `SC` | 7 | 32 | 40 | Piercing direct lightning bolt passing through all monsters in a straight beam. |
| **Chain Lightning**| 59 | 57 | `chainlightning`| `SC`| 7 | 28 | 35 | Jumps between nearest living targets up to 5 times within 200px proximity. |
| **Thunder Storm** | 63 | 66 | `thunderstorm` | `SC` | 7 | - | - | Overhead cloud periodically strikes a single random nearby monster with vertical bolt. |

### 9.3 Paladin Combat & Aura Benchmark
| Skill / Aura | Skill Id | Overlay Id | Asset CelFile | Mode | Velocity | Physics & Occlusion Specifications |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Holy Bolt** | 101 | - | `holybolt` | Linear | 18 | Piercing divine missile damaging undead or healing allies. 0 explosion. |
| **Blessed Hammer**| 112 | - | `blessedhammer`| Spiral | 14 | Clockwise logarithmic expanding spiral orbit ($r(\theta) = a + b\theta$). Passes through walls. |
| **Fist of Heavens**| 121 | 48 | `fistofheavens`| Celestial | Instant | Lightning strike from sky, bursts into 5 Holy Bolts radiating outward. |
| **Holy Fire Aura** | 102 | 17 & 18 | `auraholyfire` | Radial | - | Dual-layer: `PreDraw: 1` (`AuraHolyFireBack`) + `PreDraw: 0` (`AuraHolyFireFront`). Periodic 50px radial fire pulse. |
| **Fanaticism** | 122 | 26 | `aurafanaticism`| Radial | - | Spinning red rune ring rendered on ground sub-layer. |

### 9.4 Necromancer, Amazon, Barbarian, Druid, Assassin Highlights
- **Necromancer Teeth** (`Id: 67` / `Missiles.txt: 71`): 28-degree tight fan of 7 teeth flying at Vel 16, Range 35. 0 explosion.
- **Necromancer Bone Spear** (`Id: 84` / `Missiles.txt: 88`): Linear piercing missile at Vel 24, Range 50 with ghost-white trail particles.
- **Amazon Guided Arrow** (`Id: 22` / `Missiles.txt: 21`): `pSrvDoFunc: 7` true homing steering towards nearest enemy torso at 8 degrees/tick.
- **Amazon Lightning Fury** (`Id: 35` / `Missiles.txt: 35`): Linear javelin split on monster collision into 8 chain lightning bolts.
- **Barbarian Whirlwind** (`Id: 151` / `anim: SQ`): Sequence attack mode. Must **never** trigger `SC` roar. Moves along continuous trajectory while spinning.
- **Druid Tornado** (`Id: 245` / `Missiles.txt: 245`): Wandering ground vortex with pseudo-random angular drift advancing at Vel 8.
- **Assassin Death Sentry** (`Id: 276`): Mechanical stationary turret firing Lightning Bolt and detonating nearby monster corpses (Corpse Explosion).


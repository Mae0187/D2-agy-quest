---
name: d2-engine
description: Use when implementing, refactoring, calibrating, debugging, or verifying Diablo II skill animations, missiles, projectiles, VFX, ground hazards, summon minions, or atlas assets across all classes and skill trees.
---

# ⚔️ Diablo II Skill Engine & Animation Reconstruction Standard (d2-engine)

This skill package serves as the **Single Source of Truth and Standard Operating Procedure (SOP)** for reconstructing skill animations, spell VFX, projectile physics, and summoned entities across all seven classic Diablo II classes (Sorceress, Paladin, Necromancer, Amazon, Barbarian, Druid, Assassin).

---

## 🏛️ 0. The 4 Authoritative Pillars from The Phrozen Keep

All kinematic formulas, client-side rendering mechanics, component skeletal layers, and data table mappings in this skill package are **strictly grounded in the four authoritative bibles from the Diablo II modding community The Phrozen Keep (d2mods.info)**:

1. **Animation Conversion Tutorial (Joel, Alkalund, Nefarius)**:
   * **URL**: `https://d2mods.info/resources/infinitum/tut_files/dcc_tutorial/index.html`
   * **Core Ground Truth**: In the DCC format, each direction and frame maintains local boundaries and origin offsets (Offset X / Y). The COF (Component Order File) dictates the compositing and z-order sorting of body components and overlay layers. A global Union Bounding Box (Union-Box) must be used to anchor the pivot origin, eliminating rotational wobbling and layer misalignments.
2. **1.10 Missile Function File Guide (Mishy23)**:
   * **URL**: `https://d2mods.info/forum/viewtopic.php?t=29595`
   * **Core Ground Truth**: Missiles operate as a state-machine chain governed by `CelFile`, `AnimLen`, `SubMissile`, `HitSubMissile`, `CltSubMissile`, and `CltHitSubMissile`. Complex spells (Chain Lightning, Fireball detonations) are constructed by seamlessly chaining parent and child missiles.
3. **Official Data Dictionary Knowledge Base (Missiles.txt & Skills.txt Guides)**:
   * **URL**: `https://d2mods.info/forum/kb/viewarticle?a=364` (Missiles) ✕ `https://d2mods.info/forum/kb/viewarticle?a=440` (Skills)
   * **Core Ground Truth**: 25 FPS fixed simulation physics step (Tick), velocity `Vel` (pixels/tick), lifespan `Range` (frames), initial step push `InitSteps`, cast animation mode (`anim`: SC/SQ), and precise release frame (`release_frame_cast`).
4. **The Guide to Almost All Missile Functions (Cypress)**:
   * **URL**: `https://d2mods.info/forum/viewtopic.php?t=67114`
   * **Core Ground Truth**: Demystifies the underlying mathematical logic of client-side rendering functions (`pCltDoFunc`) and collision functions (`pCltHitFunc`) within `D2Client.dll`. Frontend engines directly implement their geometric constraint formulas **without executing or invoking binary DLLs**:
     * **Nova (Nova 48)**: `Skills.txt (srvdofunc: 22, cltdofunc: 25)` triggers an omnidirectional radial emitter releasing 64 discrete linear missiles uniformly across 360 degrees (`nova 90, pCltDoFunc: 1, CelFile: ElectricNova, Vel: 24, Range: 13`, step 5.625°). High-density radial propagation combined with native DCC semi-transparent glows and additive blending (`lighter`) naturally fuses into a solid concentric ring.
     * **Chain Lightning (Chain Lightning 53)**: `Skills.txt (srvdofunc: 26, cltdofunc: 27)` ➔ `Missiles.txt (chainlightning 93)`. The core movement function is `pCltDoFunc: 8` (Lightning bolt trailing effect), where critical parameter `CltParam1: 3` (`Subloops`) drives lightning sub-loops and vertex snapping. Each segment of `LightningStrike.dcc` tightly interlocks along the ray vector. Collision functions `pCltHitFunc: 16` and `pSrvHitFunc: 12` trigger a 20-frame `ShockHitSm` impact detonation and search for the next jump target within radius.

---

## 🛑 I. The 11 Immutable Iron Rules

In any code implementation, calibration, or refactoring, **violating the following iron rules is strictly prohibited**. Any violation is considered a critical regression:

1. **[Form A Uniform Velocity Iron Rule] Euclidean Straight-Line Screen Space, Strictly Zero Y-Axis Half-Speed Compression**:
   * Linear missiles (Fire Bolt, Fire Ball, Ice Bolt, Ice Blast, Glacial Spike, Bone Spear, Magic Arrow, etc.) on a 2D canvas **always travel at constant Euclidean velocity along the straight line from cast origin to target point**.
   * Direction angle $\phi = \text{atan2}(dy, dx)$.
   * Velocity components: $v_x = \frac{dx}{\text{dist}} \times \text{Vel},\ v_y = \frac{dy}{\text{dist}} \times \text{Vel}$.
   * **Strictly Prohibited**: Applying isometric half-speed compression to screen velocity (e.g. `atan2(dy*2, dx)` or `vy * 0.5`). This flattens trajectory at diagonal angles, halves vertical speed, and causes severe vertical bobbing.

2. **[Cast Origin and Spatial Layer Iron Rule] Discrete Separation of Aerial Projectiles vs Ground Origins**:
   * **Aerial Linear Projectiles (Form A)**: Cast origin is uniformly anchored to the **character torso plane ($Y - 32\text{px} \sim Y - 38\text{px}$)**, paired with `InitSteps = 1` pushing forward 16 ~ 20 pixels, ensuring missiles spawn from staff tip or hand perimeter.
   * **Ground Shockwaves and Auras (Form C / Auras)**: Nova (Nova 48), Frost Nova (Frost Nova 44), and persistent Thunder Storm auras have strictly zero vertical elevation in `Missiles.txt` (`zoffset: 0`) and `Overlay.txt` (`Height: 0`). **They must be anchored to the character's ground foot contact point ($Y - 0\text{px}$)**, ensuring the 2:1 isometric electric ring expands flat along the floor concentric with the player shadow.
   * **Strictly Prohibited**: Mounting ground skills at chest height causing floating effects, or spawning aerial straight-flying missiles from the floor.

3. **[Hitbox Center Iron Rule] Target Torso Center Point ($Y - 18\text{px}$)**:
   * Collision detection for target dummies and standard monsters must use the **entity ground point $Y - 18\text{px}$** as the geometric sphere center for radial proximity checks.
   * **Strictly Prohibited**: Performing 2D distance checks directly against the ground footprint $(x, y)$, which causes chest-level missiles to miss or pass through targets.

4. **[Verified Skill Isolation Iron Rule] Do Not Mutate Verified Functional Skills**:
   * Any skill verified by the user or automated tests (e.g., Blizzard, Frozen Orb, Meteor, Hydra) **must remain completely isolated** when modifying other skills, strictly prohibiting accidental overwrites.

5. **[PreDraw and Height Foot Layer Iron Rule] Strict Compliance with `Overlay.txt`**:
   * `PreDraw: 1` = **Behind / Under Feet**: **Must be rendered underneath/behind the character entity** (e.g., Thunder Storm rotating ground ring `ThunderstormCast_operate`, Paladin background aura `AuraBack`, ambient halo). The character stands on top of the VFX, eliminating floating anomalies.
   * `PreDraw: 0` = **Foreground Overlay**: Rendered in front of the character entity (e.g., Hydra ground fire `HydraGroundFire`, foreground aura `AuraFront`, cast muzzle flash).
   * `Height1 ~ Height4 = 0`: Strictly indicates flush contact with the ground foot plane. Positive values represent torso or overhead floating elevation.

6. **[Additive Blending De-Blacking Iron Rule] Additive Pixel Filtering**:
   * For additive blended assets (DrawMode 3, auras, flames, lightning), pixels with brightness $R + G + B < 50$ or near-black palette edge indices (172, 173, 33, 34) must have their Alpha forced to 0 during extraction. Rendering must use `lighter` composite mode, thoroughly eradicating black borders and block artifacts.

7. **[25Hz Fixed Simulation Tick Iron Rule] Logic Decoupled from Rendering**:
   * Kinematic displacements and timers must advance within a fixed 25Hz tick accumulator (40ms per step); visual rendering interpolates smoothly at 60FPS. Directly multiplying projectile velocity by variable browser `requestAnimationFrame` delta times is strictly forbidden.

8. **[Authentic MPQ Extraction Iron Rule] 100% Extracted from `Diablo II 1.13c/` Archives**:
   * **Physical MPQ Directory**: `Diablo II 1.13c/` (in project workspace):
     - `Diablo II 1.13c/d2data.mpq`: Base missile DCCs (`data\global\missiles\*.dcc`), tiles, palettes (`pal.dat`).
     - `Diablo II 1.13c/Patch_D2.mpq`: 1.13c updated data tables and patched DCCs.
     - `Diablo II 1.13c/d2exp.mpq`: Expansion assets, Assassin and Druid animations.
     - `Diablo II 1.13c/d2char.mpq`: Armor and action models across seven classes.
   * **Toolchain**: Extracted via `Diablo2-Agent-Monitor/tools/stormlib/x64/StormLib.dll` driving `tools/d2_proj_toolkit.py` and `tools/extract_sorc_fire_assets.py`, compiling into Union-Box normalized atlases.
   * **Strict Ban**: **Never substitute authentic sprites with frontend Canvas vector drawing (`ctx.stroke`, `ctx.lineTo`, custom procedural fractals) or hand-coded geometric outlines!**

9. **[Official Ground Truth Alignment Iron Rule (163 Wiki / Arreat Summit / Phrozen Keep)]**:
   * Visual acceptance of any skill animation **relies exclusively on local official game screenshots in `official_visual_standards/` and Phrozen Keep engine function specs as the sole ground truth**. Passing with zero console errors or numerical hits alone is unacceptable.
   * **Nova (Nova 48)** (referencing `sorceress/nova_163.jpg`): Following `cltdofunc: 25` / `pCltDoFunc: 1`, the expanding ring must remain 100% closed, solid, and thick throughout its entire lifespan, using 64 rays or equal-arc-length high-density overlapping. The pure white incandescent core fuses tightly with the electric-blue outer glow. Cracking into dashed segments with black gaps is **strictly prohibited**.
   * **Chain Lightning (Chain Lightning 53) and Lightning (Lightning 49)** (referencing `sorceress/chain_lightning_163.jpg`): Following `pCltDoFunc: 8` (`Subloops: 3`) and `pCltHitFunc: 16`, unbroken high-voltage electric cable arcs must tightly snap vertex-to-vertex from caster staff to target 1, and target 1 to target 2. Segment fragmentation, isolated dangling lines, or pure random jitter are **strictly prohibited**. Impact vertices detonate native 20-frame `ShockHitSm`.

10. **[COF Dynamic Layer Compositing and Void Sprite Slot Iron Rule]**:
    * The 16 component layers of characters and assembled monsters must dynamically reorder their render queue based on the current facing direction (South-facing vs North-facing). Static render order is strictly prohibited. Inactive or hidden equipment slots must mount a 1x1 transparent `void_slot` sprite with frame lengths strictly synchronized 1:1 with the COF skeleton, preventing missing layer exceptions and dangling limbs.

11. **[Units Global Palette Lock Iron Rule]**:
    * All dynamic characters, monsters, and skill projectiles (Missiles & Units) must strictly bind to the `units.pal` global palette during extraction and rendering. Never decode dynamic units using local scene tile palettes, preventing hot-pink artifacts and lost specular highlights across acts.

---

## 🧭 II. Four-Table Cross-Audit Architecture (Skills.txt ✕ states.txt ✕ Overlay.txt ✕ Missiles.txt)

When reconstructing or calibrating any skill, **inspecting a single file in isolation is strictly prohibited**. The collaborative linkage between skills, states, overlays, and missiles must be rigorously audited:

```
                    ┌─────────────────────────┐
                    │       Skills.txt        │
                    │ (Skill ID & Dispatcher) │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼ (State / Aura Chain)                           ▼ (Active / Periodic Missile Chain)
┌─────────────────────────┐                   ┌─────────────────────────┐
│       states.txt        │                   │       Missiles.txt      │
│ (State-to-VFX Bridge)   │                   │ (Projectiles/Strikes)   │
├─────────────────────────┤                   ├─────────────────────────┤
│ • state (State Code)    │                   │ • CelFile (DCC Asset)   │
│ • overlay1 ~ 4          │                   │ • zoffset (0:Floor/Chest│
└───────────┬─────────────┘                   │ • pSrvDoFunc Kinematics │
            ▼                                 │ • Vel / Range / Accel   │
┌─────────────────────────┐                   └─────────────────────────┘
│       Overlay.txt       │
│ (Overlay / Spatial Layer│
├─────────────────────────┤
│ • PreDraw (0:Fore/1:Back│
│ • Height1~4 (0:Ground)  │
│ • Trans (3: Additive)   │
│ • Xoffset / Yoffset     │
└─────────────────────────┘
```

### Core Audit Criteria for the Four-Table Linkage:
1. **Skill Trigger & State Branching (`Skills.txt`)**:
   - Inspect `aurastate` / `state`: Determine whether the skill grants a persistent buff (e.g. Thunder Storm `thunderstorm`, Energy Shield `energyshield`).
   - Inspect `castoverlay`: Identify caster muzzle flashes upon casting (e.g. `light_cast_1`, `light_cast_2`).
   - Inspect `srvmissilea` / `cltmissilea`: Identify physical missiles dispatched on attack (e.g. Thunder Storm strikes `thunderstorm1`, Nova spawns `nova`).
2. **State Bridging & Overlay Mapping (`states.txt`)**:
   - Query `states.txt` using `aurastate` or `state` as key to obtain `overlayone` through `overlayfour`.
   - **Iron Rule**: `Skills.txt` never records Overlay filenames directly; blindly searching without `states.txt` is prohibited.
3. **Persistent VFX Layering & Anchor Calibration (`Overlay.txt`)**:
   - Locate entry in `Overlay.txt` using the `overlayone` name.
   - Inspect `PreDraw`:
     - If `1`: **Must be rendered before the character entity (drawn on ground behind/under feet)**, with the character standing atop it (e.g. Thunder Storm ground ring `ThunderstormCast_operate`).
     - If `0`: Rendered after the character entity (foreground overlay).
   - Inspect `Height1` ~ `Height4`:
     - If all `0` and `Yoffset = 0`: **Firmly anchored to the ground foot contact point ($Y - 0\text{px}$)**, never floating at waist or chest.
4. **Attack Missile Spatial Trajectory & Impact (`Missiles.txt`)**:
   - Inspect `zoffset`, `yoffset`:
     - If all `0` (e.g. Nova `nova`): Launch origin strictly locked to the **foot contact point**, expanding outward across 2:1 isometric ground plane.
     - If standard straight-flying missile (e.g. Fire Ball, Ice Bolt): Launch origin locked to chest ($Y - 32\text{px}$).
   - Inspect `pSrvDoFunc`: Classify as linear uniform (1), zenith drop (3), radial omnidirectional (22/25), or homing (7).
   - Inspect `ExplosionMissile` / `CltHitSubMissile`: Identify authentic explosion sprite triggered on target hit (e.g. `ShockHitSm` for Chain Lightning and Thunder Storm).

### Classic Cross-Audit Case Studies:
- **Thunder Storm (Thunder Storm 57)**:
  - Caster: `Skills.txt` assigns `aurastate: thunderstorm` ➔ Query `states.txt` for `thunderstorm` yielding `overlayone: ThunderStormBack` ➔ Query `Overlay.txt` for `ThunderStormBack` (`PreDraw: 1`, `Height: 0`, asset `ThunderstormCast_operate`) ➔ **Rendered 100% spinning exclusively at the caster's feet on the ground**.
  - Enemy Strike: Periodic timer triggers ➔ `Skills.txt` `cltmissilea` calls `thunderstorm1` ➔ Query `Missiles.txt` (CelFile `LightningboltBig`) ➔ **Drops vertically from zenith sky onto enemy head, detonating `ShockHitSm` at ground impact point**.
- **Nova (Nova 48)**:
  - `Skills.txt` (dofunc 22, srvmissilea `nova`) ➔ `Missiles.txt` (`nova`, `zoffset: 0`, CelFile `ElectricNova`, 16 directions) ➔ **Launch center anchored to ground foot plane, expanding outward in 2:1 isometric space**.

---

## 🧩 III. The 20 Behavioral Primitives Across All Classes (F01 ~ F20)

All Diablo II class and monster spell behaviors are driven by 20 underlying behavioral primitives. Any skill implementation or refactor must map directly to its corresponding family:

| Primitive | Family Name | Engine Kinematic Mechanism | Classic Skills | Standard Template / Basis |
| :--- | :--- | :--- | :--- | :--- |
| **F01** | Linear Projectile (Pierce/Burst) | Euclidean straight line, terminates on hit/range, optional child explosion | Fire Bolt, Bone Spear (Pierce), Fire Ball (Burst), Magic Arrow, Ice Blast | `linear_missile_template.ts` |
| **F02** | Homing Projectile | Searches target per tick, deflects trajectory based on angular velocity | Guided Arrow, Bone Spirit, Holy Bolt | `linear_missile_template.ts` (Homing) |
| **F03** | Archimedean Spiral / Orbit | Orbit governed by spiral formula ($r = r_0 + v_r t, \theta = \omega t$) | Blessed Hammer, Blade Sentinel | `advanced_skill_templates.ts` |
| **F04** | Random Wandering Jitter | Direction perturbed by small pseudo-random angles at fixed tick intervals | Charged Bolt, Shock Web | `advanced_skill_templates.ts` |
| **F05** | Cone / Volley Salvo | Spawns multiple projectiles in single cast with angular spread/delay | Multiple Shot, Strafe | Batch F01 Array |
| **F06** | Radial Nova Expansion | Based on `cltdofunc: 25` / `pCltDoFunc: 1`, 64 rays emitted uniformly, high-density radial advance, additive fusion | Nova, Frost Nova, Poison Nova, Fire Nova, War Cry shockwave | `radial_nova_template.ts` (Universal High-Fidelity) |
| **F07** | Sub-Missile Emission / Cluster | Emits child missiles along path or scatters child projectiles on hit | Frozen Orb, Fist of the Heavens (Holy Bolts), Lightning Fury | `advanced_skill_templates.ts` |
| **F08** | Continuous Stream / Cone Beam | Emits high-density short-lived conical particles along cast heading | Arctic Blast, Inferno | `hazard_and_stream_template.ts` |
| **F09** | Chained Arc Jump | Based on `pCltDoFunc: 8` (`Subloops: 3`) & `pCltHitFunc: 16`, continuous vertex-snapped high-voltage arc, ShockHitSm on hit | Chain Lightning, Lightning Strike (Melee), Mephisto Lightning | `chained_arc_template.ts` (Universal High-Fidelity) |
| **F10** | Area Zenith Bombardment | Randomly samples points in target radius to drop celestial projectiles | Blizzard, Armageddon, Cataclysm | `advanced_skill_templates.ts` |
| **F11** | Delayed Target Strike | Ground warning indicator ➔ high-altitude vertical plunge (residual pool) | Meteor, Fist of the Heavens (Zenith Holy Lightning) | Multi-phase Timeline State Machine |
| **F12** | Ground Hazard Area | 2:1 isometric ground layout, persistent tick damage with fade in/out | Fire Wall, Poison Cloud, Immolation Ground | `hazard_and_stream_template.ts` |
| **F13** | Stepping Linear Fissure | Consecutive ground pillars erupt sequentially along line of fire | Fissure, Volcano, Blaze | Stepping Ground Emitter |
| **F14** | Autonomous Wandering Hazard | Slowly moving persistent entity with Perlin noise or weak tracking | Tornado, Twister | Autonomous Hazard Particle |
| **F15** | Persistent Dual-Layer Aura | Dual-layer rendering: PreDraw (under feet) and PostDraw (foreground) | Energy Shield, Holy Freeze, Fanaticism, Frozen Armor, Cyclone Armor | Dual-Layer Overlay System |
| **F16** | Entity Summoning | Spawns AI minion entering companion positioning queue | Clay Golem, Valkyrie, Dire Wolf, Grizzly, Shadow Master | `composite_minion_template.ts` |
| **F17** | Deployable Sentry / Trap | Places armed ground entity firing child missiles periodically | Lightning Sentry, Wake of Fire, Death Sentry | Deployable Entity invoking F01/F04 |
| **F18** | Hero Displacement Skill | Hero moves dynamically with residual silhouettes or spinning trails | Whirlwind (high-speed spin), Leap Attack, Charge, Teleport | Character Motion State Machine |
| **F19** | Multi-Strike Melee Chain | Single cast executes multiple attack hit check frames in rapid succession | Zeal (rapid strikes), Frenzy (dual wield), Dragon Talon | Multi-Hit Sequence |
| **F20** | Status Marker / Palette Tint | Overhead curse marker or full-body color index remapping | Battle Cry stun, Decrepify, Amplify Damage curse | Palette Shifter & Status Layer |

> **Universal Architecture Principle**: Templates such as F06 and F09 are **cross-class universal foundational systems**. Whether dealing with Sorceress Nova, Frost Nova, Necromancer Poison Nova, Barbarian War Cry, or monster Fire Nova, all are uniformly driven by `radial_nova_template.ts`. Chain Lightning and Amazon Lightning Strike are uniformly driven by `chained_arc_template.ts`.
> **Composite Skill Specification (e.g. Fist of the Heavens)**: Fist of the Heavens consists of a "Zenith Holy Lightning Strike (F11)" combined with "Child Holy Bolts clustered on hit (F07)", rather than chained jumping arcs (F09).

---

## 📚 IV. Module Navigation Map

This skill package consists of the following modular documents:

* **In-Depth References (`references/`)**:
  * [01_UNIVERSAL_ARCHETYPES.md](./references/01_UNIVERSAL_ARCHETYPES.md): Detailed mathematical formulas, launch sockets, and collision specs for the 5 forms and 20 primitives.
  * [02_MPQ_REFERENCE_TABLES.md](./references/02_MPQ_REFERENCE_TABLES.md): Data table schema, unit conversions, and binary specs (`AnimData.D2`, COF, `monstats.txt`).
  * [03_RENDER_AND_BLENDING.md](./references/03_RENDER_AND_BLENDING.md): Three-tier depth sorting, PreDraw layer compositing, additive de-blacking, Foot Disk Rule, 1/6 Slicing Rule, and Union-Box.
  * [04_ALL_CLASSES_SKILL_MATRIX.md](./references/04_ALL_CLASSES_SKILL_MATRIX.md): Comprehensive authentic parameters across seven classes and dual official wiki index.
  * [05_VERIFICATION_AND_SANDBOX.md](./references/05_VERIFICATION_AND_SANDBOX.md): Isolated port topology, Playwright automated testing SOP, and the 5-Gate ground truth protocol.
  * [06_ASSET_NORMALIZATION_AND_INDEX.md](./references/06_ASSET_NORMALIZATION_AND_INDEX.md): Normalized atlas catalog across 15 categories, Void Sprite Slot specs, and Units Global Palette standard.

* **Standard Templates (`templates/`)**:
  * [skill_manifest_schema.json](./templates/skill_manifest_schema.json): Standard Skill Manifest Schema.
  * [linear_missile_template.ts](./templates/linear_missile_template.ts): Standard template for F01 Linear and F02 Homing missiles.
  * [radial_nova_template.ts](./templates/radial_nova_template.ts): High-fidelity template for F06 Radial Nova (64-direction radial emission / equal-arc-length fusion).
  * [chained_arc_template.ts](./templates/chained_arc_template.ts): High-fidelity template for F09 Chained Arc (vertex snapping, `pCltDoFunc: 8 Subloops`, `ShockHitSm` impact).
  * [hazard_and_stream_template.ts](./templates/hazard_and_stream_template.ts): Standard template for F08 Stream and F12 Ground Hazard.
  * [composite_minion_template.ts](./templates/composite_minion_template.ts): Standard template for F16 Summoned Minions.

* **Automated Verification Scripts (`scripts/`)**:
  * [verify_sandbox.py](./scripts/verify_sandbox.py): Playwright headless regression inspecting dummy hits and 0 console errors.
  * [verify_ground_truth.py](./scripts/verify_ground_truth.py): Authentic MPQ 5-Gate Ground Truth verification script (zero vector drawing, dynamic atlas intercept, side-by-side visual diff, foot disk anchor, engine assertion defense).

---

## 🌐 V. Dual Official Portals & Forum Ground Truth Gates

Visual acceptance and kinematic validation strictly cross-reference three authoritative sources:
1. **Blizzard Official Arreat Summit**:
   `https://classic.battle.net/diablo2exp/skills/alphaskills.shtml`
2. **DiabloWiki 163 Encyclopedia**:
   `https://wiki.d.163.com/index.php?title=%E5%88%86%E7%B1%BB:%E6%9A%97%E9%BB%912_%E6%8A%80%E8%83%BD`
3. **The Phrozen Keep Authoritative Guides**:
   - Animation Conversion Extended Tutorial: `https://d2mods.info/resources/infinitum/tut_files/dcc_tutorial/index.html`
   - 1.10 Missile Function File Guide: `https://d2mods.info/forum/viewtopic.php?t=29595`
   - Official Data Dictionaries: `https://d2mods.info/forum/kb/viewarticle?a=364` & `https://d2mods.info/forum/kb/viewarticle?a=440`
   - The Guide to Almost All Missile Functions (Cypress): `https://d2mods.info/forum/viewtopic.php?t=67114`

---

## 🚀 VI. Standard Operating Workflow

```
[Requirement] ➔ Query 02_MPQ_REFERENCE_TABLES.md for authentic parameters (Four-table closed loop)
              ➔ Match archetype template in 01_UNIVERSAL_ARCHETYPES.md (Forms A ~ E)
              ➔ Bind atlas in 06_ASSET_NORMALIZATION_AND_INDEX.md (Extract from Diablo II 1.13c MPQ via StormLib to Union-Box PNG)
              ➔ Assemble manifest using templates in templates/
              ➔ Execute esbuild bundle build
              ➔ Run scripts/verify_ground_truth.py passing the 5-Gate verification
              ➔ Run scripts/verify_sandbox.py verifying Playwright headless run and 0 console errors
              ➔ Update README.md Change Log (Taipei Time UTC+8)
```

---

## 🛡️ VII. The 5-Gate Ground Truth Verification Protocol

To prevent any AI short-cuts or procedural Canvas vector sketching, this project enforces an **uncompromising 5-Gate Verification System**. Every skill implementation or refactor must pass `python scripts/verify_ground_truth.py` before delivery:

### 🚪 Gate 1: Zero-Vector Static AST/Regex Audit
* **Target**: All skill templates (`templates/*.ts`) and combat coordinator (`combat_director.js`).
* **Pass Condition**:
  * Regex search stripping comments must strictly contain zero occurrences of `ctx.stroke`, `ctx.lineTo`, `ctx.ellipse`, and `ctx.arc` (violation count **strictly 0**).
  * Must contain authentic sprite `ctx.drawImage` invocations, ensuring pure sprite architecture.

### 🖥️ Gate 2: Playwright Headless Dynamic Prototype Hook Audit
* **Target**: Real browser runtime canvas context.
* **Pass Condition**:
  * Dynamic prototype hook on `CanvasRenderingContext2D.prototype.stroke` must register **strictly 0 calls** during entire cast lifecycle.
  * Dynamic prototype hook on `CanvasRenderingContext2D.prototype.drawImage` records authentic slices (`ElectricNova.png`, `lightningstrike.png`, `shockhit_sm.png`) drawn tens to hundreds of times.
  * Zero console errors (0 Console Errors), zero NaN coordinates.

### 🖼️ Gate 3: Side-by-Side Visual Ground Truth Diff & Quantitative Similarity Scoring Gate
* **Target**: Live rendered canvas screenshots vs local official master images in `official_visual_standards/`.
* **Pass Condition**:
  * Normalized aspect-ratio scaling and side-by-side rendering outputting `testimages/comparison/side_by_side_*.png`.
  * **Mandatory Quantitative Similarity Scoring (Hard Constraint >= 85/100)**: Must perform algorithmic visual comparison and similarity scoring against Blizzard's authentic official master captures. Delivery is **strictly prohibited unless the composite similarity score achieves 85% (85 / 100) or higher**.
  * **Concentric Ring Topology & Radial Energy Crest Matching (同心階數與徑向能量波峰匹配度)**:
    * In radial and multi-wave skills (such as Sorceress Nova 48, Frost Nova 44, Necromancer Poison Nova 92), algorithmic verification must perform cross-sectional radial luminance profile and crest peak detection analysis ($\ge 3$ distinct concentric wavefront crests: Inner Core Ring, Median Body Ring, Outer Fringe Ring). Missing or collapsed wavefront cascades (e.g., only 1 or 2 rings detected where ground truth displays 3) triggers an immediate structural topology deduction.
  * **Nova (Nova 48)**: Concentric ring must be fully closed, free of directional warping, zero black gaps, strictly featuring 3 concentric wavefront tiers (`[R, R - 8px, R - 16px]` cascade) with authentic electric fringes matching official master screenshots (`sorceress/nova_crop.png`).
  * **Chain Lightning (Chain Lightning 53)**: Unbroken plasma core continuously anchored from staff tip through targets, with complete `ShockHitSm` impact detonation animations matching official master screenshots (`sorceress/chain_lightning_crop.png`).

### 🌀 Gate 4: Foot Disk Aura & Anchor Alignment Gate
* **Target**: Character idle, turning, cast windup, hit recovery, and multi-directional motion anchor stability.
* **Pass Condition**:
  * An authentic 2:1 isometric concentric aura overlay is projected at ground origin. Character foot contact center displacement must be $\le 1\text{px}$ across all rotations and state transitions (Zero-Wobble).
  * Launch origins comply with the 1/6 Slicing Rule, anchored to chest/staff tip (3/6 ~ 4/6 height), while ground skills lock to foot origin (1/6 bottom edge).

### 🛡️ Gate 5: Engine Assertion & Layer Timing Gate
* **Target**: Multi-component layer timing and animation sequence lengths.
* **Pass Condition**:
  * Prevent `eComponent` assertion: All active component DCCs must synchronize frame lengths 1:1 with COF skeletons and `AnimData.D2`.
  * Prevent `(UINT)nAnimFrame` assertion: Sequence animation indices (`monseq.txt`) must strictly fall within valid bounds $[0, \text{TotalFrames}-1]$.
  * Inactive or hidden equipment slots must mount a 1x1 transparent `void_slot` safety sprite, preventing memory crashes or dangling limbs.

# 📊 Official MPQ Authoritative Data Tables Reference Guide (02_MPQ_REFERENCE_TABLES.md)

This document compiles the core field definitions, physical unit conversions, and cross-table lookup standards of the local official Diablo II MPQ unpacked asset repository (physically located in `Diablo II 1.13c/`, with extracted text tables in `readfirst/d2_reference_tables/` and project root `d2_reference_tables/`), serving as the single source of truth for all skill parameters.

---

## 0. Local MPQ Asset Repository Physical Paths and Toolchain

* **Local MPQ Storage Directory**: `Diablo II 1.13c/` (under project root), containing:
  - `d2data.mpq`: Original missile DCCs (`data\global\missiles\`), monster models, tiles, and palettes (`data\global\palette\ACT1\pal.dat`, `units.pal`).
  - `Patch_D2.mpq`: 1.13c patch revision data tables (`data\global\excel\`) and updated missile DCCs.
  - `d2exp.mpq`: Lord of Destruction expansion graphics, Assassin and Druid animations.
  - `d2char.mpq`: Base player action animations across all classes, armor DCCs, and COF skeletons.
  - `d2sfx.mpq`: Classic skill impact sound effects.
* **StormLib Dynamic Library**: `Diablo2-Agent-Monitor/tools/stormlib/x64/StormLib.dll`
* **Python Extraction and Decoding Toolchain**: `tools/d2_proj_toolkit.py`, `tools/extract_sorc_fire_assets.py`

---

## 1. Core Data Tables Overview

| Table Name | Column Count | Key Fields | Core Responsibility |
| :--- | :--- | :--- | :--- |
| **`Skills.txt`** | 256 cols | `Id`, `Skill`, `anim`, `srvmissile`, `cltmissile`, `Param1~8`, `delay`, `reqlevel` | Skill ID, cast animation mode, missile mapping, and cooldown delays |
| **`states.txt`** | 40+ cols | `state`, `overlayone` ~ `overlayfour`, `aurastate`, `group` | Key bridge mapping skill states/auras to `Overlay.txt` |
| **`Missiles.txt`** | 171 cols | `Id`, `Missile`, `Vel`, `MaxVel`, `Range`, `InitSteps`, `CelFile`, `pSrvDoFunc`, `CollideType` | Projectile physical initial velocity, lifecycle, asset filenames, and collision logic |
| **`Overlay.txt`** | 40 cols | `Id`, `Overlay`, `CelFile`, `PreDraw`, `Trans`, `AnimRate`, `Xoffset`, `Yoffset` | Foreground/background overlay layers, additive blending, animation frame rate, and pixel offsets |
| **`monstats.txt`** | 100+ cols | `Id`, `Height`, `PixHeight`, `OverlayHeight`, `HitTestHeight` | Monster physical height, torso center hit point, and base attribute stats |
| **`monstats2.txt`** | 30+ cols | `Id`, `Base`, `Height`, `mTR`, `mHD`, `mLA`, `mRA`, `mS1~8` | Monster composite visual token (Token: e.g. ZM, FA, SK) and body component animation atlas lookup table |
| **`monseq.txt`** | 4 cols | `sequence`, `mode`, `frame` | Sequence frame timing table for monsters and specific multi-stage animations |
| **`charstats.txt`** | 40 cols | `class`, `WalkVelocity`, `RunVelocity`, `StartSkill`, `baseWClass` | Base attributes and official physical walk/run velocities of the seven heroes |
| **`AnimData.D2`** | Binary | 256 Hash buckets, 160-byte records (`frames`, `speed`, `events[144]`) | Animation frame counts, playback speeds, and release event codes (1: spell cast, 2: arrow release) |
| **`pal.dat` / `units.pal`** | Binary | ACT1 256-color RGB palette (768 bytes) | Single source of truth for DCC / DC6 asset color mapping and decoding |

---

## 2. `Skills.txt` Key Fields Analysis

1. **`anim` (Player Animation Mode Code)**:
   * `SC` = Spell Cast (Sorceress / spellcasters).
   * `A1` / `A2` = One-handed / Two-handed physical attack (Attack).
   * `TH` = Throwing javelins / weapons (Throw).
   * `SQ` = Sequence mode (e.g., Barbarian Whirlwind).
   * **Iron Rule**: Strictly forbid triggering `SC` spellcast roar animations in weapon attack skills.

2. **`srvmissile` and `cltmissile`**:
   * Linked to the primary projectile name or ID in `Missiles.txt`.
   * Example: Fire Ball skill (`Skill: Fire Ball`) links to missile `fireball` (`Id: 62`).

3. **`Param1` ~ `Param8` (Skill-specific Parameters)**:
   * Used to define durations or specific phase delays.
   * **Hydra**: `Param1 = 250` (250 ticks = 10.0 seconds lifespan).
   * **Fire Wall**: `Param1 = 90` (90 ticks = 3.6 seconds lifespan).

4. **`delay` (Casting Cooldown)**:
   * Unit is official physical ticks (25 ticks = 1 second).
   * Examples: Blizzard `delay = 45` (1.8s cooldown); Meteor `delay = 30` (1.2s cooldown); Hydra `delay = 50` (2.0s cooldown).

---

## 3. `Missiles.txt` Key Fields Analysis (Per Phrozen Keep Guide 4 Reverse Engineering)

1. **`pCltDoFunc` and `pSrvDoFunc` (Kinematic Behavior Functions)**:
   * Dictate screen-space motion trajectories and rendering logic for each logical tick:
   * **`1` (Missile_Do_Linear)**: Linear constant-velocity motion. Used by standard missiles (Fire Ball, Ice Bolt, Bone Spear) and Nova's (`nova 90`) 64 sub-missiles.
   * **`8` (Missile_Do_Trailing_Beam)**: Continuous trailing electrical beam function. Dedicated to Chain Lightning (`chainlightning 93`), Lightning (`lightningbolt 98`), and Lightning Sentry. Paired with `CltParam1` (Subloops) to continuously generate and snap segments between emitter and target.

2. **`pCltHitFunc` and `pSrvHitFunc` (Impact and Collision Functions)**:
   * Dictate events triggered when a missile reaches a target or collides with obstacles:
   * **`10` (Missile_Hit_Spark)**: Spawns micro electrical sparks or elemental bursts on hit (used by Nova and Charged Bolt).
   * **`16` / `12` (Missile_Hit_ChainBounce)**: Chained arc jumping target acquisition. Upon hitting current target, detonates official 20-frame shock flash (`ShockHitSm`), and searches for target to branch next arc based on `CHitCalc1` / `SHitCalc1` (jump radius).

3. **`CltParam1` ~ `CltParam5` (Client-side Parameters)**:
   * Core parameters controlling client-side rendering features.
   * **Chain Lightning (`chainlightning`)**: `CltParam1 = 3` (annotated as `Subloops`), indicating 3 sets of zig-zag subloops deployed across each jump path, preserving high-voltage plasma thickness and seamless interlocking.

4. **`SubMissile` Hierarchy Network (Chained Sub-missiles)**:
   * `SubMissile`: Sub-missiles discharged/fired along flight path (e.g., Ice Bolts ejected by Frozen Orb).
   * `HitSubMissile` / `CltHitSubMissile`: Server/client burst or splinter sub-missiles generated on impact (e.g., Holy Bolts scattered on ground impact of Fist of the Heavens, `ShockHitSm` triggered at impact point of Chain Lightning).

5. **`Vel` / `MaxVel` (Initial Flight Velocity)**:
   * Physical velocity in pixels/step (25 steps per second).
   * Fire Bolt (Firebolt): `Vel = 18`.
   * Fire Ball (Fireball): `Vel = 16`.
   * Ice Blast: `Vel = 22`.
   * Glacial Spike: `Vel = 24`.
   * Lightning: `Vel = 32`.
   * Nova: `Vel = 24`.
   * Chain Lightning: `Vel = 30`.

6. **`Range` (Missile Lifespan / Travel Range)**:
   * Lifespan in ticks (25 ticks = 1.0 second).
   * Examples: Nova `Range = 13` (~0.52s); Chain Lightning `Range = 25` (1.0s); Fireball `Range = 55`.

7. **`InitSteps` (Forward Offset Steps)**:
   * Steps advanced forward at the instant of Tick 0 -> Tick 1.
   * Standard straight-flying missiles use `InitSteps = 1`, pushed 16 ~ 20 pixels forward along the heading vector to prevent rigid emergence from within the caster's body.

8. **`CelFile` (MPQ DCC Asset Filename)**:
   * Specifies the corresponding animation asset name (without file extension).
   * Examples: `firebolt`, `iceblast`, `ElectricNova`, `LightningStrike`, `groundFireBig`.

9. **`ExplosionMissile` (Detonation Sub-missile on Hit)**:
   * Explosion visual effect spawned when the primary missile collides or expires.
   * Examples: Fireball collision triggers `FireArrowExplode2`; Glacial Spike triggers `glacialspikeexplode`.

---

## 4. `Overlay.txt` and PreDraw Layering Standards

1. **`PreDraw` (Foreground / Background Depth Toggle)**:
   * **`PreDraw: 0` (Foreground Overlay)**:
     - Rendered in front of the entity body; flames or glow overlay the body.
     - **Representative Cases**: Hydra ground flames (`HydraStart1~3`, `HydraLoop1~3`, `HydraEnd1~3`), Paladin front aura (`AuraHolyFireFront`).
   * **`PreDraw: 1` (Background Underlay)**:
     - Rendered behind the entity body as ambient underlay glow.
     - **Representative Cases**: Paladin back aura (`AuraHolyFireBack`), back glow halo.

2. **`Trans` (Blending Mode)**:
   * `Trans: 3` = Additive Blending, transparent darks, highlights blending through (corresponds to Canvas `lighter`).

3. **`AnimRate` (Animation Frame Rate)**:
   * Typically baseline 16 FPS (16 frames per second).

---

## 5. `AnimData.D2` Release Frame Standards

Missiles must spawn strictly on the release frame; premature firing on frame 0 is strictly forbidden:

| Mode Code | Class & Weapon Mode | Action Name | Authoritative Release Frame |
| :--- | :--- | :--- | :--- |
| **`SOSCSTF`** | Sorceress with Staff | Spell Cast | **Frame 7** |
| **`NESCHTH`** | Necromancer Barehanded/Wand | Spell Cast | **Frame 8** |
| **`AMA1BOW`** | Amazon with Bow | Attack Bow | **Frame 6** |
| **`AMA11HT`** | Amazon with Javelin | Throw | **Frame 7** |
| **`HXA1`** | Hydra Head | Attack | **Frame 8** |

---

## 6. Four-Table Cross-Verification SOP: `Skills.txt` ✕ `states.txt` ✕ `Overlay.txt` ✕ `Missiles.txt`

In Blizzard's engine architecture, the full visual presentation of a single skill is collaboratively driven by four data tables. Cross-verification must be executed during table lookups:

```
                    ┌─────────────────────────┐
                    │       Skills.txt        │
                    │ (Primary Skill & Cast)  │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼ (State / Aura Chain)                           ▼ (Active / Periodic Missile Chain)
┌─────────────────────────┐                   ┌─────────────────────────┐
│       states.txt        │                   │       Missiles.txt      │
│ (State to Overlay Bridge│                   │(Missile/Lightning/Expl) │
├─────────────────────────┤                   ├─────────────────────────┤
│ • state (State Token)   │                   │ • CelFile (DCC Asset)   │
│ • overlayone ~ four     │                   │ • zoffset (0:Gnd/Chest) │
└───────────┬─────────────┘                   │ • pSrvDoFunc (Kinematics│
            ▼                                 │ • Vel / Range / Accel   │
┌─────────────────────────┐                   └─────────────────────────┘
│       Overlay.txt       │
│(Overlay / Feet / PreDraw│
├─────────────────────────┤
│ • PreDraw (0:Frnt/1:Gnd)│
│ • Height1~4 (0:Gnd/Elev)│
│ • Trans (3: Additive)   │
│ • Xoffset / Yoffset     │
└─────────────────────────┘
```

### Four-Table Verification SOP:
1. **Step 1 (Check Primary Skill Table `Skills.txt`)**:
   - Extract `aurastate` / `state`: Determine whether the skill attaches a persistent buff/state (e.g., Thunder Storm, Energy Shield, Paladin auras).
   - Extract `castoverlay`: Determine whether casting triggers an instantaneous character cast visual effect (e.g., `light_cast_1`, `light_cast_2`).
   - Extract `srvmissilea` / `cltmissilea`: Determine the missile entity spawned directly or periodically by the skill.
2. **Step 2 (Check State Bridge Table `states.txt`)**:
   - Locate the row in `states.txt` by `aurastate` or `state`, and extract values from fields `overlayone` through `overlayfour`.
   - **Key Rule**: `Skills.txt` contains no graphic filenames; bypassing `states.txt` inevitably leads to missing state sprite atlases.
3. **Step 3 (Check Overlay Table `Overlay.txt`)**:
   - Match the name of `overlayone` to entries in `Overlay.txt` to obtain `Filename` (DCC asset name).
   - **Inspect `PreDraw` Field**:
     - If `1`: **Iron Rule requires it to be rendered BEFORE the character body (bottom ground underlay)**; the character steps atop the effect.
     - If `0`: Rendered in front of the character body (foreground layer).
   - **Inspect `Height1 ~ Height4` and `Yoffset`**:
     - If all `0`: Strictly anchored at the character's ground foot contact origin ($Y - 0\text{px}$).
     - If greater than `0`: Indicates Z-axis elevation suspended according to target monster height tier.
4. **Step 4 (Check Missile Table `Missiles.txt`)**:
   - Inspect `CelFile`, `Vel`, `Range`, `AnimLen`, `NumDirections`.
   - **Inspect `zoffset` and `yoffset`**:
     - If all `0` (e.g., Nova `nova`): Spawn point must align with the **character's ground foot contact origin**, expanding 2:1 isometrically along the ground.
     - If standard airborne linear trajectory (e.g., Fireball, Ice Bolt): Spawn point anchors at caster's chest ($Y - 32\text{px}$).
   - Inspect `CltHitSubMissile` / `ExplosionMissile`: Verify the explosion atlas triggered at the hit ground contact point upon impact (e.g., shock burst `ShockHitSm`).
5. **Step 5 (Check Monster Animation Table `monstats2.txt`, Hit & Impact Feedback)**:
   - Check the target monster's `Base` or `Id`, retrieve its appearance token from `monstats2.txt` (Token: e.g., Zombie `ZM`, Fallen `FA`) and body component slots.
   - Align hitbox center uniformly to 18 pixels above ground contact point ($Y - 18\text{px}$), triggering the target's hit recovery action (Mode: `GH`) and death action (Mode: `DT`).

---

## 7. In-Depth Classic Case Studies

### Case 1: Thunder Storm (Id: 57)
* **Caster Body (Persistent Electric Ring, Foot Ground Only)**:
  - `Skills.txt`: `aurastate: thunderstorm`.
  - `Overlay.txt`: Entry `ThunderStormBack`, corresponding asset `ThunderstormCast_operate` (19-frame light-blue elliptical electric ring).
  - `PreDraw: 1` and `Height1~4: 0`: **Dictates that Thunder Storm aura MUST 100% render before the hero entity on the ground underfoot**. The hero steps atop the electric ring; torso and head remain completely clean, without any dark clouds or floating hoops.
* **Periodic Lightning Strike (Falling Thunder, Striking Target Directly)**:
  - `Skills.txt`: `periodic: 1`, client missile `cltmissilea: thunderstorm1`.
  - `Missiles.txt`: Entry `thunderstorm1`, corresponding asset `LightningboltBig` (8-frame pure white sky pillar, `NumDirections: 1`).
  - Kinematic Logic: When striking target, drops vertically from screen ceiling ($y \le 0$) straight down to target ground contact point, detonating the official 20-frame shock flash (`ShockHitSm`) at ground impact point.

### Case 2: Nova (Id: 48)
* **Casting Action and Waveform**:
  - `Skills.txt`: `srvdofunc: 22` / `cltdofunc: 25` (omnidirectional radial emitter function, generating 64 sub-missiles), `srvmissilea: nova`.
  - `Missiles.txt`: Entry `nova`, corresponding asset `ElectricNova` (16 directions, 13 frames), `pCltDoFunc: 1` (linear constant velocity), `Trans: 1` (additive blending).
  - **Key Parameters**: `zoffset: 0`, `yoffset: 0`, `xoffset: 0`, `Vel: 24`, `Range: 13`.
  - Implementation Standard: Origin must anchor at caster's foot ground contact point ($Y - 0\text{px}$). 64 missiles expand 360 degrees uniformly; adjacent sprites densely overlap under additive blending (`lighter`), naturally fusing into a blazing-white solid electrical ring.

### Case 3: Chain Lightning (Id: 53)
* **Casting Action and Arc Chain**:
  - `Skills.txt`: `srvdofunc: 26` / `cltdofunc: 27`, cast animation `SQ` (sequence action, staff aimed at target), `srvmissilea: chainlightning`.
  - `Missiles.txt`: Entry `chainlightning`, corresponding asset `LightningStrike` (32 directions, 8 frames), `Vel: 30`, `Range: 25`.
  - **Key Functions and Parameters**:
    - `pCltDoFunc: 8` (trailing beam function) with `CltParam1: 3` (`Subloops`): Responsible for laying out arc segments along ray vectors with vertex snapping constraints, eliminating disjointed fragmentation.
    - `pCltHitFunc: 16` and `pSrvHitFunc: 12` (chained jump collision function): Detonates official 20-frame `ShockHitSm` at torso center ($Y - 18\text{px}$) upon impact, and searches for next valid hostile target within jump radius for seamless redirection.

---

## 8. COF Binary Specifications and Layer Timing Structure (Per Phrozen Keep Chapter 5)

The `.COF` (Component Order File) is responsible for assembling multiple discrete DCC animations (TR, HD, LA, RA, SH, S1~S8) into a unified entity on screen:

1. **Binary Header Structure**:
   * **Byte 0**: `Layers` (Total layer count, hexadecimal).
   * **Byte 1**: `FramesPerDir` (Frame count per direction, hexadecimal).
   * **Byte 2**: `Directions` (Direction count: 08 for monsters, 10 for characters, 20 for missiles).
2. **Event Array Section (Event Section)**:
   * Length is strictly equal to `FramesPerDir` bytes.
   * Records event codes for specific frames: `01` (melee hit frame), `02` (ranged / spell release frame), sound triggers, etc.
3. **Layer Composite Order Section**:
   * Length is `FramesPerDir × Directions × Layers` bytes.
   * Records the sequential stacking order for each component layer rendered to canvas for every frame and direction.

---

## 9. Two Classic Official Assertion Crash Prevention Gates (Per Phrozen Keep Chapter 6)

In custom animation engines and loading pipelines, static defensive gates must be established to eliminate the two most common official engine crashes:

1. **`eComponent` Assertion Crash Gate (`GfxUtil.cpp #1352`)**:
   * **Root Cause**: Mismatch between the layer count defined in COF, frame count recorded in `AnimData.D2`, and actual extracted DCC frame count.
   * **Defensive Iron Rule**: When parsing sprite atlases on the client, if slice frames are missing for a given direction, strictly avoid reading `undefined` or leaving an unhandled Void Sprite Slot; frame boundary fallbacks must be enforced, and frame lengths across all composite layers must remain strictly aligned.
2. **`(UINT)nAnimFrame` Assertion Crash Gate (`CUnit.cpp #1436`)**:
   * **Root Cause**: The animation frame index referenced by an action sequence (`monseq.txt`) or skill configuration table exceeds the maximum frame count actually held by that DCC animation.
   * **Defensive Iron Rule**: When retrieving frames in the dispatcher, always enforce modulo arithmetic or boundary clamping. Passing illegal indices exceeding the total frame count is strictly prohibited to prevent NaN coordinates or blank rendering.

---

## 10. Animation Sequence Recomposition Techniques (Per Phrozen Keep Chapter 6)

Many advanced skill animations (such as monster resurrection, multi-hit combos, Barbarian Whirlwind) are not newly created dedicated DCC assets in the official engine, but are achieved through sequence recomposition techniques:

1. **Re-indexing and Reverse Playback of Existing DCC Frames**:
   * The official "Monster Resurrection" animation directly takes frames from the "Death Animation (`DT`)" and plays them in reverse.
   * "Fast Slashing Combos" directly take the windup core frames and hit frames of Normal Attack (`A1`) for high-speed looping.
2. **`Skills.txt` Association Mechanism via `anim: seq`**:
   * When a skill configures `anim: seq`, a valid base animation mode (such as `a1`, `a2`, `sk1`) must be specified in the `monanim` field, and the extracted frame sequence must be specified in `monseq.txt`.
   * Configuring undefined modes when a monster lacks the corresponding action is strictly prohibited, as it triggers immediate animation deadlocks.

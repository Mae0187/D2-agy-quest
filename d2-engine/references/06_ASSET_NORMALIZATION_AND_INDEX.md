# 🏛️ Normalized Atlas Library and Asset Index Specification (06_ASSET_NORMALIZATION_AND_INDEX.md)

This document defines the normalization standards, clockwise direction mapping, and asset lookup references for `diablo2_normalized_assets/` and `DIABLO2_SPRITES_INDEX.md` across the complete Diablo II visual asset suite.

---

## 0. Raw MPQ Extraction Source Paths

All normalized atlases must be 100% extracted from the original MPQ archives under the local `Diablo II 1.13c/` directory:
* **`Diablo II 1.13c/d2data.mpq`**: All projectile missile DCCs (`data\global\missiles\`), monster models, floor tiles, palettes.
* **`Diablo II 1.13c/Patch_D2.mpq`**: 1.13c patch revised graphics and updated missiles.
* **`Diablo II 1.13c/d2exp.mpq`**: Lord of Destruction expansion-exclusive projectiles and character animations.
* **`Diablo II 1.13c/d2char.mpq`**: All seven classes animations and armor equipment graphics.
* **Extraction Pipeline**: Uses `Diablo2-Agent-Monitor/tools/stormlib/x64/StormLib.dll` combined with `tools/d2_proj_toolkit.py` to decode DCCs, computes global Union-Box bounding boxes, and exports to `diablo2_normalized_assets/`. Using external assets not extracted from MPQs or frontend code hand-drawing is strictly prohibited!

---

## I. Normalized Atlas Standard

Raw Blizzard DCCs or community sprite sheets suffer from inconsistent dimensions, missing unified anchors, erratic direction mappings, and residual black background artifacts. All atlases integrated into the game engine must pass the following industrial standards:

### 1. Geometric Anchors and Union-Box Format
Each atlas consists of a PNG grid image and a companion JSON metadata file with the same base name:
```json
{
  "cellWidth": 128,
  "cellHeight": 128,
  "anchorX": 64,
  "anchorY": 110,
  "directions": 16,
  "framesPerDir": 15,
  "fps": 25,
  "blendMode": "lighter"
}
```
* **`cellWidth` / `cellHeight`**: Maximum Bounding Box Union across all directions and all frames.
* **`anchorX` / `anchorY`**: Precise pixel coordinates of the ground center within the cell (characters are typically anchored to the bottom center edge between both feet).

### 2. Clockwise Direction Mapping for 8 and 16 Directions
The project strictly standardizes on Blizzard's canonical clockwise indexing:
* **8-Direction Indexing**:
  `0: South (S)`, `1: Southwest (SW)`, `2: West (W)`, `3: Northwest (NW)`, `4: North (N)`, `5: Northeast (NE)`, `6: East (E)`, `7: Southeast (SE)`
* **16-Direction Indexing**:
  Mapped according to the screen-plane angle $\phi$ ($0^\circ \sim 360^\circ$), partitioned into 16 directions in $22.5^\circ$ increments.

### 3. Multi-Component "Void Sprite Slot" Specification
* **Design Origin**: Referencing Blizzard Chapter 2 and Chapter 6 skeletal specifications, Diablo entities are assembled dynamically from 16 sub-component layers (TR, HD, LA, RA, LH, RH, SH, LG, S1-S8) dictated by COF layer order. When simplifying models or hiding specific components (such as unequipping a shield SH or missing a primary hand weapon RH), setting that layer to NULL or stripping it from the skeleton is strictly prohibited.
* **Specification Requirements**:
  - Inactive component slots must uniformly mount a `void_slot` safe empty sprite (1x1 pixel transparent sprite, Alpha = 0).
  - Its metadata frame length must be strictly frame-locked 1:1 with the torso (TR).
  - This thoroughly eliminates memory out-of-bounds errors in skeletal parsers caused by missing layers, and eliminates orphan floating monster limbs.

### 4. Units Global Palette Standard
* **Palette Locking**: While ambient floor tile palettes change across Act 1 through Act 5, all hero characters, monster entities, and skill projectiles (Missiles & Units) **must be strictly bound to the global Units palette (`data\global\palette\ACT1\units.pal`) during extraction and decoding**.
* **Anti-Noise Principle**: Decoding dynamic entities using current scene regional palettes is strictly prohibited; doing so triggers the classic "Hot Pink Glitch" noise or loses specular metallic reflection palettes across Acts or inside dungeon caves.

---

## II. Asset Catalog: 15 Core Categories

| Directory | Content & File Count | Core Usage Scenario |
| :--- | :--- | :--- |
| **`characters/`** | All 16-direction animations for 7 heroes across light/medium/heavy armor tiers | Hero town idle, walk, run, cast, attack, get hit, death |
| **`skills_fx/`** | Authentic projectiles, area bursts, auras, ground fire columns | Fireball, Ice Blast, Glacial Spike, Meteor, Hydra flame jets, Nova |
| **`monsters/`** | Act minions, elites, and Act bosses (108 types) | Andariel, Duriel, Mephisto, Diablo, Baal, etc. |
| **`companions/`** | Summons and minions (Dire Wolves, Golems, Ravens) | Druid Dire Wolves, Necromancer Skeletons, and Golem minions |
| **`Act 1 ~ 5 Tiles/`** | Classic tiles, stone walls, and dungeon floors across Acts 1–5 (85 types) | Rogue Encampment, Lut Gholein tombs, Jungle temples, Chaos Sanctuary |
| **`objects/`** | Shrines, chests, hearth fires, blood pools, portals (118 types) | Interactive scene objects and ambient light sources |
| **`animals/`** | Bats, birds, camels, cows (17 types) | Camp and wilderness ambient wildlife |
| **`npcs/`** | Town NPCs and quest givers across all 5 Acts (40 types) | Akara, Cain, Charsi, Warriv, Meshif |
| **`avatars/`** | Battle.net classic chatroom character avatars (5 types) | Monitor dashboard status avatars and communication tags |
| **`parts/`** | Modular body parts for Fallen, Rogues, Zealots (66 types) | Multi-part modular monsters and dismemberment effects |

---

## III. Atlas Invocation Anti-Mistake Guide

1. **Never Confuse Ground Fire Dimensions**:
   * Fire Wall must use `groundFireBig` (68x169 high column).
   * Meteor residual fire must use `groundFireMedium` (68x138 medium fire); never mistakenly use Fire Wall's large column.
2. **Never Omit Hydra Ground Fire**:
   * When spawning Hydra, in addition to loading the main body atlas, `HydraGroundFire` must be loaded as the foreground rising fire (`PreDraw: 0`).
3. **Cold Spells Atlas Naming Reference**:
   * Ice Bolt: `icebolt`
   * Ice Blast: `iceblast` + impact shatter debris `freeze_explode_ejecta_auth`
   * Glacial Spike: `glacialspike_auth` + icicle shatter burst `glacialspike`
   * Blizzard: `blizzard` + `icestormfall`
   * Frozen Orb: `iceorb` + `iceorb_explode`
4. **Lightning Spells Atlas Naming and Layering Reference**:
   * Charged Bolt: `chargedbolt` (16 directions, 10 frames; ground random jitter crawling)
   * Nova: `electricnova` (16 directions, 13 frames; single continuous 32-arc ground-hugging 2:1 isometric concentric ring expansion; never split secondary inner rings)
   * Chain Lightning: `lightningstrike` (32 directions, 8 frames; zigzag refracting electrical arc) + hit burst `shockhit_sm` (20 frames)
   * Thunder Storm: Feet rotating electric ring `ThunderstormCast_operate` (19 frames, `PreDraw: 1` underlay, `Height: 0`, rotating in-place with 0 wobble) + zenith lightning bolt `thunderstorm` (`LightningboltBig`, 8 frames) + hit burst `shockhit_sm` (20 frames)
   * Cast Glow Overlay: `LightningCast` (10 frames additive glow, bursting in front of the staff)

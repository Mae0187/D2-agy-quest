# 🎨 Render Layering, Blending Modes, and Atlas De-Blacking Standards (03_RENDER_AND_BLENDING.md)

This document specifies the low-level rendering standards for web 2D Canvas and isometric environments to authentically recreate Blizzard's Diablo II visual lighting, 3-tier depth sorting, and atlas black border elimination.

---

## 1. 3-Tier Isometric Depth Sorting

To eliminate sprite interpenetration and corpse hovering glitches, all scene entities are strictly partitioned into three rendering tiers:

```
[Tier 0: Ground Sub-Layer]
└── Corpses, blood decals, warning indicators (Meteor Indicator), ground Fire Wall, Meteor ground residue fire (Ground Fire)

[Tier 1: Middle Entity Layer]
└── Active monsters, elite monsters, act bosses (Diablo, Mephisto, etc.)

[Tier 2: Top Player & Ally Layer]
└── Player characters, party summons (Hydra, Golems), mercenaries
```

### Same-Tier Sorting Iron Rule:
Within the same tier, all entities are **strictly sorted in ascending order based on the screen Y coordinate of their ground contact anchor point (`anchor.y`) (Painter's Algorithm)**:
* Entities with smaller $Y$ values (higher on screen, representing deeper isometric depth) are drawn first.
* Entities with larger $Y$ values (lower on screen, representing closer isometric depth) are drawn last.

---

## 2. `PreDraw` Dual-Layer 3D Wrapping and Foot Aura Rendering Architecture

Per official `Overlay.txt` `PreDraw` specifications, composite entities and character auras must enforce strict foreground/background layering:

```
[Step 1: Ground Foot Underlay / Background Base Layer (PreDraw: 1, Height: 0)] 
├── Rendered at entity/hero ground foot origin using lighter blending.
├── Representative VFX: Thunder Storm rotating electric ring (ThunderstormCast_operate), Paladin back aura (AuraBack).
└── Iron Rule: Must render BEFORE the character body; character steps on the VFX, eliminating erroneous waist-level floating.

[Step 2: Entity Body (Middle Entity)] 
└── Render entity/hero body (TR flesh + action sequences), drawn with standard source-over, participating in depth sorting.

[Step 3: Foreground Surge (PreDraw: 0)] 
├── Rendered in front of the entity body using lighter blending.
└── Representative VFX: Hydra ground flames (HydraGroundFire foreground), front aura (AuraFront), fire tongues licking and overlapping base and underbelly.
```

> **Engineering Traps Resolved**:
> 1. **Hydra Flame Clipping Trap**: If ground fire is rendered entirely behind the entity, it creates an unnatural flaw where "the entity base appears severed horizontally by scissors, hovering over the fire"; with `PreDraw: 0` foreground overlay, fire tongues naturally cover the lower edge of the entity, matching Blizzard Arreat Summit quality.
> 2. **Aura Waist-Floating Trap**: Effects marked `PreDraw: 1` and `Height: 0` in `Overlay.txt` (like Thunder Storm electric ring), if erroneously placed in front of the character or at torso center, look like "an electric hoop around the waist/chest"; enforcing `PreDraw: 1` rendered at foot ground center prior to the hero entity perfectly reproduces the authentic floor aura rotating underfoot.

---

## 3. Additive Layer De-Blacking Protocol

### 1. Root Cause of Black Artifacts
In the original Diablo II software renderer, lighting and fire effects (DrawMode: 3) have near-black transition indices at palette margins (`pal.dat`, `units.pal`):
* Index 172 (`RGB: 5, 5, 5`)
* Index 173 (`RGB: 11, 11, 11`)
* Index 33 (`RGB: 11, 5, 5`)
* Index 34 (`RGB: 22, 5, 0`)
In original additive blending, black pixels accumulated onto background had zero visual impact. However, when converted to RGBA atlases with default opacity `Alpha = 255`, Canvas `source-over` renders them as jarring solid black borders/patches.

### 2. Industrial-Grade De-Blacking Protocol
When extracting additive layers (S1 special effects, auras, fire glow, lightning), apply the following strict filters:
1. **Palette Index Filtering**: Any pixel whose palette index belongs to `[172, 173, 33, 34]` is forced to `Alpha = 0` (completely transparent).
2. **Low-Luminance Mask Filtering**: Any pixel where the RGB sum $R + G + B < 50$ is forced to `Alpha = 0`.
3. **Highlight Smooth Bleed-Through**: Only retain bright fire and lightning cores where $R + G + B \ge 50$, rendering with `globalCompositeOperation = 'lighter'` to achieve clean, black-border-free Blizzard-grade visuals.

---

## 4. Union-Box Atlas Specification

Cropping each frame directly causes severe vertical jitter due to varying dimensions; frames must be packaged using a Union-Box:

1. **Traverse All Directions and Frames**: Compute the minimum/maximum offsets of the entity across all directions $d$ and frames $f$ relative to the ground origin $(0, 0)$:
   $$\text{min\_x} = \min_{d, f}(\text{offset\_x}_{d,f}), \quad \text{max\_x} = \max_{d, f}(\text{offset\_x}_{d,f} + \text{width}_{d,f})$$
   $$\text{min\_y} = \min_{d, f}(\text{offset\_y}_{d,f}), \quad \text{max\_y} = \max_{d, f}(\text{offset\_y}_{d,f} + \text{height}_{d,f})$$
2. **Compute Cell Dimensions and Precise Anchors**:
   $$\text{cellWidth} = \text{max\_x} - \text{min\_x}, \quad \text{cellHeight} = \text{max\_y} - \text{min\_y}$$
   $$\text{anchorX} = -\text{min\_x}, \quad \text{anchorY} = -\text{min\_y}$$
3. **Anchor Mode Division**:
   * **Airborne Missiles / Projectiles**: Use geometric center anchor (`y_mode: center`).
   * **Ground Characters / Monsters / Ground Flames**: Use bottom grounding anchor (`y_mode: bottom`), anchored at foot ground contact center.

---

## 5. DCC Skeleton Origin Alignment and Additive Fusion Standards (Per Phrozen Keep DCC Tutorial & Guide 4)

1. **DCC Local Bounding Box and Origin Offset (Offset X / Y)**:
   * Per authoritative tutorials by Joel, Alkalund, and Nefarius, each direction and frame in DCC format holds independent local pixel offsets.
   * The engine must precisely anchor each sprite to the entity's geometric center (missiles) or foot ground contact point (characters/ground waves).
   * Global Union-Boxes eliminate coordinate jumping and body tearing during direction changes.

2. **High-Density Sprite Additive Fusion (Additive Blending / Lighter)**:
   * In Blizzard's software renderer, lighting effects (DrawMode 3) feature natural light energy accumulation.
   * **Nova**: As 64 sub-missiles advance outward, translucent sprite margins naturally accumulate under `lighter` blending. Central energy saturates to pure white while edges form an electro-blue halo, organically forming a closed solid beam ring without requiring artificial multi-tier displacement hacks in the frontend.
   * **Chain Lightning**: Per `pCltDoFunc: 8` and `Subloops: 3`, segment endpoints are forced to snap together via Vertex Snapping, and overlapping adjacent slices fuse into thick high-voltage plasma under additive blending.

---

## 6. Foot Disk Rule and 1/6 Slicing Rule (Per Phrozen Keep Chapter 4)

1. **The Foot Disk Rule**:
   * Golden rule for verifying anchor precision for any cast animation, summon entity, or ground skill per Joel Falcou's origin alignment bible:
   * On the isometric 2.5D canvas, render a 2:1 isometric concentric ellipse aura ring at the entity's grounding point (such as a Paladin aura or Thunder Storm foot ring).
   * **Verification Iron Rule**: Regardless of whether the character faces 8, 16, or 32 directions, or which animation frame is playing, the center point of both feet on the ground must remain 100% pinned to the exact center of the disk.
   * Even a 2~3 pixel deviation will produce noticeable eccentric wobbling or foot slippage/floating during continuous playback or turning.

2. **The 1/6 Slicing Rule**:
   * Geometric heuristic for Y-axis anchoring of humanoid creatures and standard monsters:
   * Divide entity height into 6 equal vertical slices on the canvas.
   * The optimal geometric position for the Ground Foot Pivot falls precisely at "the top of Slice 1 counting from the bottom (i.e., at 1/6 height from the bottom of the bounding box)".
   * The casting staff and chest reference plane (Cast Muzzle Socket) falls precisely at "Slice 4 (between 3/6 and 4/6 height from the bottom, i.e., $Y - 32\text{px} \sim Y - 38\text{px}$)".

---

## 7. COF Dynamic Layer Composite Order Queue (Per Phrozen Keep Chapter 5)

In the Diablo II engine, a character or multi-part monster (e.g., Hydra, Golems, armed heroes) is never simply fixed foreground/background, but driven by the **per-frame, per-direction layer draw stack** defined in the COF blue section:

1. **Directional Dynamic Occlusion for Multi-Part Entities**:
   * **Southward (Facing Screen, Dir 4 / 8)**:
     * Draw order: `Back Overlay / Cloak ➔ Torso (TR) ➔ Left/Right Arms (LA/RA) ➔ Weapon/Staff (RH/LH) ➔ Cast Foreground VFX (S1)`.
     * Cast windup flames and staff naturally cover the chest.
   * **Northward (Facing Away from Screen, Dir 6 / 12)**:
     * Draw order: `Cast VFX (S1) ➔ Weapon/Staff (RH/LH) ➔ Left/Right Arms (LA/RA) ➔ Torso (TR) ➔ Head (HD)`.
     * The torso naturally occludes forward-extended staff and arms, completely preventing arms from clipping through the back when facing away.

2. **Frontend Render Queue Implementation Standards**:
   * When rendering multi-part casting animations and summon entities in the frontend, strictly follow the layer order queue parsed from COF to execute `drawImage` in sequence, preventing flattening errors caused by hardcoded `zIndex`.

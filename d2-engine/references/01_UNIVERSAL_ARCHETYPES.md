# 🏹 Diablo II Universal Skill Archetypes Comprehensive Guide (01_UNIVERSAL_ARCHETYPES.md)

This document details the **Five Core Universal Archetypes (plus extended forms)** extracted from actual Diablo II combat mechanics. The implementation of any new skill across all classes (Sorceress, Paladin, Necromancer, Amazon, Barbarian, Druid, Assassin) can be classified under and mapped to these core archetypes.

---

## Archetype A: Linear Missile / Projectile

### 1. Physical Behavior and Mathematical Model
Projectiles are launched from the caster's chest / staff tip and travel in screen 2D space along a Euclidean straight line at constant velocity toward the clicked target:
- **Directional Fire Offset Vector ($P_{spawn}(d)$)**:
  Projectiles do not spawn from the character's ground pivot or naive torso center. They are calculated based on character orientation angle $\theta_d$ (for 8 or 16 directions $d$), polar forward offset $R_{hand}$, lateral hand offset $L_{hand}$ (distinguishing left/right casting hand), and elevation $z_{fire}$ (default 40px):
  $$\begin{bmatrix} x_{spawn}(d) \\ y_{spawn}(d) \\ z_{spawn}(d) \end{bmatrix} = \begin{bmatrix} x_{actor} \\ y_{actor} \\ 0 \end{bmatrix} + \begin{bmatrix} \cos\theta_d & -\sin\theta_d & 0 \\ \sin\theta_d & \cos\theta_d & 0 \\ 0 & 0 & 1 \end{bmatrix} \begin{bmatrix} R_{hand} \\ L_{hand} \\ z_{fire} \end{bmatrix}$$
  In screen isometric projection ($W_{tile} = 32\text{px}, H_{tile} = 16\text{px}$):
  $$x_s = (x_w - y_w) \cdot \frac{W_{tile}}{2} + X_{cam}, \quad y_s = (x_w + y_w) \cdot \frac{H_{tile}}{2} - z_w + Y_{cam}$$
  Supports direction-specific manual micro-offsets $(\delta x_s[d], \delta y_s[d])$ in `missiles.manifest.json` for pixel-perfect staff-tip alignment.

- **Velocity Vector**:
  $$v_x = \frac{\Delta x}{\text{dist}} \times \text{Vel}, \quad v_y = \frac{\Delta y}{\text{dist}} \times \text{Vel}$$
- **Orientation Angle**:
  $$\phi = (\text{atan2}(\Delta y, \Delta x) \times \frac{180}{\pi} + 360) \pmod{360}$$
- **Strict Prohibition (Red Line)**:
  **NEVER multiply $v_y$ by 0.5, and NEVER compute $\text{atan2}(\Delta y \times 2, \Delta x)$**. Projectiles travel straight in screen space rather than crawling along the isometric ground plane.

### 2. Hitbox and Impact Mechanics (Swept Circle Continuous Collision)
- **Continuous Swept Circle Collision in World XY Plane**:
  Prevents high-speed tunneling where projectiles skip over targets between frames.
  Given projectile position at tick $t-1$ as $A = (x_{t-1}, y_{t-1})$ and tick $t$ as $B = (x_t, y_t)$, and target cylinder center as $C = (x_c, y_c)$:
  1. Compute segment projection parameter $\lambda$:
     $$\lambda = \max\left(0, \min\left(1, \frac{(C - A) \cdot (B - A)}{\|B - A\|^2}\right)\right)$$
  2. Compute closest point on trajectory line segment:
     $$Q = A + \lambda (B - A)$$
  3. Collision criterion:
     $$\|C - Q\| \le R_{projectile} + R_{target}$$
  Where $R_{target}$ corresponds to `MonStats2.txt` collision radius (Small = 0.5, Medium = 1.0, Large = 1.5 sub-tiles).

- **Target Torso Anchor for Hit Overlays**:
  Upon non-piercing impact (`Pierce = false`), the projectile entity terminates and instantiates a `HitOverlay` (e.g. shock burst, ice shatter, holy bolt cloud).
  The VFX rendering origin is strictly locked to the target's torso center:
  $$(x_{fx}, y_{fx}) = (x_{s,target}, y_{s,target} - z_{torso})$$
  Rendered in the foreground overlay layer (`PreDraw: 0`), preventing hit VFX from drifting or being occluded by the monster's base sprite.

- **Dynamic Hitbox Center & Sizing**:
  - Baseline Standard Dummy / Small Monster Torso Center: $(\text{target}.x, \text{target}.y - 18\text{px})$.
  - Derived from `PixHeight` and `HitTestHeight` fields in `monstats.txt`:
    $$\text{HitCenter}_y = \text{target}.y - \left(\frac{\text{PixHeight}}{2}\right)$$
    - Small Monsters (Fallen `FA`, PixHeight = 36px): Hit sphere center is $Y - 18\text{px}$.
    - Medium Humanoid Monsters (Zombie `ZM`, PixHeight = 72px): Hit sphere center is $Y - 36\text{px}$.
    - Large Boss Monsters (Diablo `DI`, PixHeight = 160px): Hit sphere center is $Y - 80\text{px}$.

- **Single Target vs. AoE Detonation**:
  - **Single-Target Piercing / Dissipation (e.g., Fire Bolt, Ice Bolt, Bone Spear)**: Calculates damage directly within collision radius and destroys the projectile; **no explosion atlas is spawned**.
  - **Area Detonation (e.g., Fire Ball, Glacial Spike, Javelins)**: Upon reaching max range or impacting a monster, spawns a secondary explosion entity at current coordinates (e.g., `FireArrowExplode2`, `GlacialSpikeExplode`), dealing damage to all hostile targets within a 60px~80px radius.
- **Release Frame and Event Section Synchronization**:
  - Projectile spawn timestamp strictly synchronizes with the release event code (Event Code `02`) in COF and `AnimData.D2`. Damage calculation settles instantly on the frame the projectile reaches the target's hit sphere center, triggering the target's hit recovery animation (Mode: `GH`) and shock burst VFX.

### 3. Cross-Class Mapping
- **Sorceress**: Fire Bolt, Fire Ball, Ice Bolt, Ice Blast, Glacial Spike.
- **Necromancer**: Teeth (cone spread), Bone Spear (piercing linear).
- **Amazon**: Magic Arrow, Guided Arrow (angular homing), Javelin Throw.
- **Paladin**: Holy Bolt.

---

## Archetype B: Channeled Spray Stream

### 1. Physical Behavior and Particle Emission
- **Channeling Mechanism**: As long as the player holds the left/right mouse button, continuously emits 2 to 3 micro diffused fire/ice particles from the staff tip every physical tick (40ms).
- **Angular Perturbation**: Applies a slight random angular velocity perturbation of $\pm 10^\circ \sim \pm 15^\circ$ on top of the primary launch vector.
- **Particle Characteristics**: Lower initial velocity ($\text{Vel} = 10 \sim 12$), shorter lifespan ($\text{Range} = 25 \sim 35\text{ ticks}$), with particle dimensions scaling up over lifetime.

### 2. Piercing and Multi-Hit Damage Feedback
- Particles possess `Pierce = true`, piercing through all monster torsos along their trajectory.
- Each particle impact triggers low-amount multi-hit damage ticks, creating an authentic flamethrower / arctic air blast combat feel.

### 3. Cross-Class Mapping
- **Sorceress**: Inferno.
- **Druid**: Arctic Blast, Firestorm.

---

## Archetype C: Ground Area Array

### 1. 2:1 Isometric Geometric Array Placement
- **Layout Baseline**: Perpendicular to the casting orientation vector, or radiating outward from the clicked ground target.
- **Isometric Diamond Coordinate Formula**:
  $$P_{\text{offset}}.x = \text{index} \times \text{step} \times \cos(\theta)$$
  $$P_{\text{offset}}.y = \text{index} \times \text{step} \times \sin(\theta) \times 0.5$$
- Ground VFX entities (such as fire pillars) strictly use bottom grounding anchors (`y_mode: bottom`).

### 2. Lifespan and Damage over Time (DoT)
- Each ground entity independently calculates its lifespan (e.g., Fire Wall lasts 90 ticks = 3.6 seconds).
- Deals damage to entities standing within the geometric area once every 10 to 12 ticks.

### 3. Cross-Class Mapping
- **Sorceress**: Fire Wall (7 large fire pillars `groundFireBig`).
- **Assassin**: Shock Web, Wake of Fire.

---

## Archetype D: Multi-Stage Timed / Falling Delayed

### 1. Four-Stage State Machine Timeline
```
[Stage 1: Ground Indicator] ──> [Stage 2: Falling Descent] ──> [Stage 3: Impact Detonation] ──> [Stage 4: Ground Residue]
(Target Indicator)              (Falling Body + Tail)          (Detonation AoE)                 (Ground Residue)
```
- **Stage 1 (Indicator)**: Spawns a ritual circle/warning indicator at the ground target point (e.g., `MeteorTargetIndicator`), playing a breathing/pulsing animation (0 ~ 30 ticks).
- **Stage 2 (Descent)**: Celestial meteor or ice chunk swoops down from top-right screen space $(x + 180, y - 320)$ with an additive flame trail.
- **Stage 3 (Detonation)**: Reaches ground contact point, triggering subtle screen shake, spawning a large-scale detonation animation (210x176 dimensions), dealing AoE damage across a 120px radius.
- **Stage 4 (Residue)**: Spawns medium ground residue fire/ice shards (e.g., `groundFireMedium`), burning continuously for 50 ticks.

### 2. Cross-Class Mapping
- **Sorceress**: Meteor, Blizzard (falling ice cloud indicator ➔ stalactite ice descent ➔ ice shatter splash).
- **Paladin**: Fist of the Heavens (divine light descending from heavens ➔ ground impact bursting into 5 Holy Bolts).
- **Druid**: Armageddon, Volcano.

---

## Archetype E: Composite Multi-Entity Minion

### 1. Trilateral Isometric Formation
When summoning multi-part or multi-entity minions (e.g., Hydra), the three entities are anchored in a 2:1 isometric triangular formation:
- Head 1 (Center Foreground): $[dx: 0, dy: +6]$, facing South / East / West.
- Head 0 (Left-Rear Background): $[dx: -22, dy: -8]$, facing Southwest / Northwest.
- Head 2 (Right-Rear Background): $[dx: +22, dy: -8]$, facing Southeast / Northeast.

### 2. Dual-Layer Flame Wrapping Model
Per `Overlay.txt` specifications, eliminating flat edge clipping and hovering defects:
1. **Back Glow (PreDraw: 1)**: Renders soft ambient ground flame glow behind the entity with Alpha 0.45.
2. **Middle Entity**: Renders flesh body and swaying animations according to the grounding anchor $Y$ depth.
3. **Foreground Flame (PreDraw: 0)**: Renders in front of entity with Alpha 0.95 and `lighter` blending; flames directly envelop the base of the serpent body and underbelly, rising naturally.

### 3. Directional Muzzle Sockets
When attack animation plays to the release frame (Frame 8), projectiles are emitted from directional muzzle sockets:
```
Dir 7 (East):      [+44, -43]    Dir 3 (Southeast): [+20, -21]
Dir 4 (South):     [-22, -13]    Dir 0 (Southwest): [-42, -38]
Dir 5 (West):      [-41, -47]    Dir 1 (Northwest): [-14, -55]
Dir 6 (North):     [ +1, -62]    Dir 2 (Northeast): [+39, -49]
```
Combined with `InitSteps = 1` pushed 4px along the launch vector, ensuring fire bolts authentically fire from between the fangs.

### 4. Cross-Class Mapping
- **Sorceress**: Hydra.
- **Necromancer**: Clay Golem, Iron Golem, Fire Golem (dual-layer flame wrapping).
- **Druid**: Dire Wolf, Grizzly, Poison Creeper.
- **Assassin**: Lightning Sentry, Shadow Master.

---

## Archetype F: Radial Nova Spread - F06

Per The Phrozen Keep Cypress manual (`viewtopic.php?t=67114`) and official data tables `Skills.txt (srvdofunc: 22, cltdofunc: 25)` / `Missiles.txt (nova 90, pCltDoFunc: 1, CelFile: ElectricNova, Vel: 24, Range: 13)`:

### 1. Physical Behavior and Kinematic Model
- **Radial Emitter**: At the cast instant, uniformly fires **64 independent linear missiles** in screen space around the caster's grounding origin $(x_0, y_0)$ in 360 degrees (inter-submissile angular spacing $\Delta\theta = \frac{360^\circ}{64} = 5.625^\circ$).
- **Kinematic Equations**: Each missile applies `pCltDoFunc: 1` (Euclidean linear constant-velocity motion), advancing each physical tick along its fixed radial vector:
  $$x_i(t) = x_0 + \text{Vel} \cdot \cos\theta_i \cdot t$$
  $$y_i(t) = y_0 + \text{Vel} \cdot \sin\theta_i \cdot t \cdot 0.54 \quad (\text{Isometric Projection})$$
- **Lifecycle**: `Range = 13` (approx. 0.52s at 25Hz). The `ElectricNova` atlas has 13 frames total, frame-locked 1:1 with survival ticks.

### 2. Additive Fusion Ring Mechanism
- **Root Issue Elimination**: Nova is neither a frontend hand-drawn polygon nor an artificially guessed double-layered fixed-offset ring.
- **Authentic Ring Principle**: Official DCC sprite atlases possess an outward semi-transparent glow. When 64 missile beams advance outward densely, adjacent sprites naturally blend additively (`lighter` / Additive mode), driving core brightness to pure white and edges to an electro-blue feathered outer halo, rendering a complete, cohesive, continuous solid electro-ring during expansion.
- **Modern High-Res Failsafe**: Under modern 1080p/2K resolutions with larger expansion radii, uniform arc-length circumferential sampling compensation can be adopted, dynamically keeping adjacent particle spacing $\le 10\text{px}$, eradicating black gaps completely.

### 3. Cross-Class Mapping
- **Sorceress**: Nova (48), Frost Nova (44).
- **Necromancer**: Poison Nova (92).
- **Barbarian**: War Cry.
- **Bosses**: Diablo Fire Nova.

---

## Archetype G: Chained Arc Jumping Beam - F09

Per The Phrozen Keep Cypress manual (`viewtopic.php?t=67114`), Mishy23 Projectile Guide (`viewtopic.php?t=29595`), and `Missiles.txt (chainlightning 93, pCltDoFunc: 8, pCltHitFunc: 16, pSrvHitFunc: 12, CelFile: LightningStrike, CltParam1: 3 Subloops)`:

### 1. Trailing Arc Rendering Mechanism (pCltDoFunc: 8 & Subloops)
- **Trailing Beam Function (`pCltDoFunc: 8`)**: Specially designed for continuous lightning beams, paired with parameter `CltParam1: 3` (`Subloops`).
- **Vertex Snapping Constraints**:
  - The arc is not a freely flying independent bullet, but strictly constrained between two endpoints (from caster's staff tip to target 1 torso center, or from target A to target B).
  - Densely laid out along the two-point ray vector using 32-direction `LightningStrike.dcc` sprite elements. The start point of each segment snaps precisely to the tail endpoint coordinates of the preceding segment, eliminating airborne dispersal and fragmentation.
- **Elimination of Non-Spec Handcrafted Randomness**: Pure arbitrary random jitter without physical meaning (e.g. `Math.random() * 20`) is strictly forbidden. Arc tortuosity originates from the built-in high-voltage arc zig-zag silhouettes and 8-frame flicker alternation within the official 32-direction sprites.

### 2. Chained Jumping and Shock Burst Feedback (pCltHitFunc: 16 & ShockHitSm)
- **Collision Jumping Logic (`pCltHitFunc: 16` / `pSrvHitFunc: 12`)**:
  - When the arc reaches the current target, it immediately detonates the official 20-frame shock flash (`ShockHitSm.dcc`) at the target torso impact point ($Y - 18\text{px}$).
  - The client searches for the nearest un-hit hostile target within the valid chain jump radius (e.g., 280px). If a valid target exists, it spawns the next chain lightning arc segment, achieving seamless piercing jumps between multiple targets.

### 3. Cross-Class Mapping
- **Sorceress**: Chain Lightning (53), Lightning (49, `pCltDoFunc: 8`, single-line piercing).
- **Amazon**: Lightning Strike (232, melee chain), Lightning Fury split arcs (35).
- **Monsters**: Mephisto Lightning (Mephisto Light).

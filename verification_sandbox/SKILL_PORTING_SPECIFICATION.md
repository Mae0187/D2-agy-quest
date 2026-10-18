# Diablo II Skill Porting Specification: Sandbox to Combat Dungeon
### (Standard Engineering Manual for Seamless Skill Integration)

> **Document Status**: Production Standard  
> **Audience**: Technical Leads, Engine Developers, Combat Designers  
> **Target Scope**: Porting verified skills from `verification_sandbox/` (2D Cartesian Sandbox) into `Diablo2-Agent-Monitor/web/` (2.5D Isometric Combat Dungeon).

---

## 1. Architectural Foundations: Sandbox vs. Combat Dungeon

Before attempting to transfer any calibrated skill, it is crucial to recognize that the **Verification Sandbox** and the **Combat Dungeon** run on two fundamentally different architectural paradigms. 

| Dimension | Verification Sandbox (`v2_shared_engine`) | Combat Dungeon (`Diablo2-Agent-Monitor/web`) |
| :--- | :--- | :--- |
| **Coordinate Space** | Flat 2D Cartesian $(X, Y)$ plane. Fixed screen dimensions. | **2.5D Isometric (Diamond Projection)** with a 2:1 vertical foreshortening aspect ratio ($Y = Y_{world} \times 0.5$). |
| **Origin Reference** | Center of canvas $(500, 340)$ or explicit mouse clicks. | Dynamic Player Hero coordinates $(hx, hy)$ with specific cast socket offsets (Chest, Staff, or Ground level). |
| **Entity Architecture** | Plain JavaScript mock objects (`TargetDummy[]` array with mutable `.hp`). | Fully encapsulated state-machine entities (`MonsterEntity`) with death timers, collision radii, and array splicing. |
| **Pipeline & Loop** | Independent `requestAnimationFrame` loop, fixed 25Hz physical accumulator. | Unified Director loop (`CombatDirector.update` and `CombatDirector.render`) driven by `FixedTimestepAccumulator`. |
| **Asset Delivery** | Bundled ES6 / Local HTTP server fetching JSON manifests and PNG atlases. | Local `file:///` standalone browser protocol, requiring pre-cached DC6/PNG atlases in global manifests. |

---

## 2. Root Cause Analysis: The 4 Fatal Pitfalls of Direct Copy-Pasting

Attempting to mount the sandbox player directly inside the combat dungeon produces either **invisible animations** or **hard application freezes**. The core reasons are:

### 2.1 Isometric Aspect Ratio and Projection Distortion
In the sandbox, radial waves (Nova, Frost Nova) or area barrages (Blizzard, Meteor) radiate uniformly in all directions ($dx^2 + dy^2 = r^2$).  
In the dungeon, the ground is an isometric plane. Unscaled Cartesian trajectories cause:
- Circular waves to appear standing vertically rather than laying flat on the ground.
- Projectiles aiming at $(tx, ty)$ to fly in deviated directions because screen heading angles must conform to `atan2((ty - hy) * 2, tx - hx)`.
- Particles and missiles flying out of view bounds or detaching from the caster's hand.

### 2.2 Target Model & Infinite Loop Freezing
In the sandbox, skills like **Chain Lightning (`ChainedArcTemplate`)** search for targets using a simple filter:
```javascript
const unvisited = dummies.filter(d => !visitedIds.has(d.id) && d.hp > 0);
```
In the combat dungeon:
- Monsters are managed in `this.monsters`. When monsters die, they may transition through `hit` or `death` states before being spliced (`splice(i, 1)`) from the array.
- If the porting code attempts to read properties like `.hitTime` or `.chillUntil` on plain proxies or unindexed objects, JavaScript throws a `TypeError`.
- In chained algorithms (e.g., Chain Lightning jumps), if the candidate array shrinks or changes indices during iteration without distance break conditions, the jump traversal can enter an infinite loop, freezing the browser tab completely.

### 2.3 Asset Asynchrony under the `file:///` Protocol
The sandbox uses an internal cache table:
```javascript
if (img && img.complete) { ctx.drawImage(...); }
```
When running locally via `file:///C:/.../index.html`, browsers enforce strict local security boundaries. If an image is instantiated on-the-fly (`new Image()`) without being preloaded by the dungeon's asset preloader, `img.complete` evaluates to `false` during the initial cast. The render loop silently skips drawing, resulting in audible sound effects (`playSfx`) with **zero visible VFX**.

### 2.4 Canvas Render Pipeline Collision & Context Overwrites
The sandbox runtime clears the canvas on every tick:
```javascript
ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
```
Injecting this logic into the dungeon's loop will wipe out the underlying dungeon tilemap and monster renders. Furthermore, sandbox shaders leave `ctx.globalCompositeOperation = 'lighter'` active without restoring canvas states via `ctx.save()` / `ctx.restore()`, corrupting subsequent HUD and sprite draws.

---

## 3. Universal Skill Porting Standard Operating Procedure (SOP)

Follow this 5-stage engineering workflow to port any calibrated skill from the sandbox into the dungeon cleanly:

```
[Stage 1: Parameter Extraction] ──> [Stage 2: Asset Deployment] ──> [Stage 3: Isometric Adaptation]
                                                                               │
[Stage 5: Quality Checklist]    <── [Stage 4: Entity Hooking]   <──────────────┘
```

### Stage 1: Parameter Extraction from Sandbox Manifests
Do not import the entire runtime. Extract only the calibrated mathematical constants from `v2_shared_engine/schemas/*.json` or the respective template:
1. **Timing & Cadence**: Frame count, tick rate, lifetime ticks, and delay timers (e.g., Meteor impact delay: 850ms).
2. **Kinematics & Speeds**: Initial velocity `vel`, acceleration, and max range.
3. **Geometry & Scaling**: Radius, concentric wave ring counts, and layer offsets.
4. **Sprite Metadata**: Frame dimensions (`cell_width`, `cell_height`), anchor pivots (`pivot_x`, `pivot_y`), and row mappings.

### Stage 2: Asset Deployment
1. Copy required atlas PNG files from `verification_sandbox/assets/atlases/` into `Diablo2-Agent-Monitor/web/assets/atlases/` or `web/assets/fx/`.
2. Register the atlas in `Diablo2-Agent-Monitor/web/js/skills_manifest.js` or `web/assets/fx/fx_manifest.js` with its exact union-box parameters:
   - `file`: Relative path to PNG.
   - `cell_width` / `cell_height`: Grid dimensions.
   - `pivot_x` / `pivot_y`: Anchor offsets.
   - `directions`: Direction count (1, 8, or 16).
   - `frames`: Frame count per sequence.

### Stage 3: Isometric Adaptation
Translate Cartesian formulas to Blizzard 2.5D Isometric projection:

1. **Aim Angle Calculation**:
   Always multiply the vertical delta by $2$ to compensate for the isometric slope:
   $$\theta = \text{atan2}((ty - hy) \times 2, tx - hx)$$

2. **Missile Direction Resolution**:
   Pass the calculated angle through `D2_MISSILE_LANDMARKS.resolveDirectionRow` or `combatDirector.getDccDirectionRow(numDirs, phiDeg)` to select the authentic 16-direction sprite row.

3. **Radial Expansion Waves (Nova / Frost Nova)**:
   Scale the vertical radius using the Diablo II isometric aspect ratio constant:
   $$R_x = \text{Radius}, \quad R_y = \text{Radius} \times 0.485$$
   Position rings at ground level ($hy$) rather than the hero's chest.

### Stage 4: Entity Hooking & Damage Binding
Integrate collision detection with the dungeon's `this.monsters` array inside `CombatDirector`:
1. Use distance checks accounting for isometric depth:
   $$\text{Dist} = \sqrt{(mx - px)^2 + ((my - py) \times 2)^2}$$
2. Guard against deleted or dying monsters:
   ```javascript
   if (monster.isDead || monster.remove) continue;
   ```
3. Apply damage through the entity's native pipeline:
   ```javascript
   monster.takeDamage(damageAmount);
   this.spawnHitShock(monster.x, monster.y);
   ```
4. If the skill applies status effects (e.g., Cold / Chill), trigger the entity's status flags directly instead of mutating raw variables.

### Stage 5: Canvas Context Isolation
Wrap all custom rendering in isolation blocks to ensure state safety:
```javascript
ctx.save();
ctx.globalCompositeOperation = 'lighter'; // or 'source-over'
// Render skill VFX
ctx.restore(); // Mandatory: restores default blend mode and transforms
```

---

## 4. Implementation Patterns for Key Skill Archetypes

### Archetype A: Concentric Radial Waves (Nova, Frost Nova)
* **Sandbox Source**: `RadialNovaTemplate.ts` / `RadialWaveTemplate.ts`
* **Dungeon Target**: `combat_director.js` -> `spawnHeroNova` / `spawnFrostNova`
* **Adaptation Rules**:
  - Spawn origin must be grounded ($hx, hy$).
  - Render an expanding ellipse with $R_y = R_x \times 0.485$.
  - Use 3 concentric staggered layers (outer, mid, core) as calibrated in the sandbox.
  - Track hit monster IDs in a `Set` to prevent multi-hitting the same target during expansion.

### Archetype B: Chained Electrical Arcs (Chain Lightning)
* **Sandbox Source**: `ChainedArcTemplate.ts`
* **Dungeon Target**: `combat_skills_ext.js` -> `spawnHeroChainLightning`
* **Adaptation Rules**:
  - Set a hard bounce cap (typically 5 bounces max).
  - Limit the jump radius to $320\text{px}$ isometric.
  - Maintain a `visitedTargets` set.
  - If no subsequent live monster is within jump range, terminate the jump chain immediately to avoid infinite loops.

### Archetype C: Multi-Stage Area Hazards (Meteor, Blizzard)
* **Sandbox Source**: `hazard_and_stream_templates.ts` / `advanced_skill_templates.ts`
* **Dungeon Target**: `combat_director.js` -> `spawnHeroMeteor` / `spawnHeroBlizzard`
* **Adaptation Rules**:
  - Stage 1 (Warning): Render ground indicator sprite (`MeteorTargetIndicator.png` or blizzard targeting ring) for the calibrated duration (e.g., 42 ticks / 850ms).
  - Stage 2 (Impact): Spawn the descent projectile descending from $(targetX - 160, targetY - 280)$ to $(targetX, targetY)$.
  - Stage 3 (Ground Hazard): Upon landing, trigger AoE damage, spawn explosion particles, and instantiate lingering ground fire pillars for residual ticking damage.

### Archetype D: Self-Rotating Carrier Projectiles (Frozen Orb)
* **Sandbox Source**: `CarrierOrbTemplate.ts`
* **Dungeon Target**: `combat_skills_ext.js` -> `spawnHeroFrozenOrb`
* **Adaptation Rules**:
  - Orb moves linearly along heading angle $\theta$ at reduced speed ($vel \approx 0.22$).
  - Every $N$ ticks, emit secondary radial ice bolts outward in alternating angles.
  - Upon reaching terminal range or expiring, trigger terminal explosion (`iceorb_explode.png`) with an 8-direction ejecta spread.

---

## 5. Verification & Acceptance Checklist

Before declaring any ported skill complete, execute this test matrix:

- [ ] **Asset Availability**: Verify all referenced PNG atlas files exist inside `Diablo2-Agent-Monitor/web/assets/` and load without 404 errors.
- [ ] **Protocol Autonomy**: Open `file:///C:/Users/DUCK/Desktop/D2-agy-quest/Diablo2-Agent-Monitor/web/index.html` directly in the browser (without starting a web server). The animation must render immediately on the first cast.
- [ ] **Zero-Monster Edge Case**: Cast the skill into empty space with no monsters alive. The game must NOT throw exceptions or freeze.
- [ ] **Death-Transition Edge Case**: Cast the skill immediately as monsters are dying. Verify no `TypeError` occurs when entities are spliced from memory.
- [ ] **Isometric Grounding**: Verify ground hazards and radial rings lay flat on the floor at the character's feet, aligning with the 2:1 isometric tile angle.
- [ ] **Frame Rate & Memory Stability**: Rapidly cast the skill 20 times in succession. Verify FPS remains steady at 60 FPS and completed missiles are properly dereferenced.

# 🧪 Sandbox Environments, Port Topology, and Triple Ground Truth Verification Standards (05_VERIFICATION_AND_SANDBOX.md)

This document defines the sandbox testing architecture, multi-class isolated port topology, and the **mandatory "Pure MPQ Sprite Triple Ground Truth Verification Protocol" that must be unconditionally passed** prior to any delivery.

---

## I. Multi-Class Isolated Verification Port Topology

To ensure class developments do not interfere with each other, all versions are independently verified, and safe rollbacks are maintained, dedicated isolated service ports are allocated:

| Class Code | Class Name | Dedicated Port | Sandbox Entry URL | Responsibility & Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **`sor`** | **Sorceress** | **`8765`** | `http://localhost:8765/v2_sandbox.html` | Fire, Cold, and Lightning skills reproduction & comprehensive verification |
| **`pal`** | **Paladin** | **`8766`** | `http://localhost:8766/v2_sandbox.html` | Combat Skills, Offensive Auras, and Defensive Auras sandbox |
| **`ama`** | **Amazon** | **`8767`** | `http://localhost:8767/v2_sandbox.html` | Bow/Crossbow barrages, Javelin piercing, and Passive skills sandbox |
| **`nec`** | **Necromancer** | **`8768`** | `http://localhost:8768/v2_sandbox.html` | Summoning minions, Bone/Poison trajectories, and Curse auras sandbox |
| **`bar`** | **Barbarian** | **`8769`** | `http://localhost:8769/v2_sandbox.html` | Melee combat, Whirlwind, and Warcries sandbox |
| **`dru`** | **Druid** | **`8770`** | `http://localhost:8770/v2_sandbox.html` | Elemental storms, Shapeshifting (Werewolf/Werebear), and Wilderness summons sandbox |
| **`ass`** | **Assassin** | **`8771`** | `http://localhost:8771/v2_sandbox.html` | Martial Arts charge-up/finishing moves and Mechanical Traps sandbox |

---

## II. Core Runtime Architecture Acceptance Criteria

Any skill entering the sandbox must strictly adhere to three foundational engineering constraints:

1. **25Hz Fixed-Step Accumulator**:
   The main game loop decouples 60 FPS rendering from 25Hz logical physics. Physics steps advance once accumulated time reaches 40ms:
   - Projectile displacement: each step $\Delta t = 40\text{ms}$, accumulating $v_x, v_y$.
   - Lifespan tracking: `lifeTicks++`.
   - Computing missile displacement directly using unclocked render delta time is strictly prohibited.

2. **Zero-GC Object Pooling**:
   High-frequency spawned missiles (Fireball, Ice Bolt, Charged Bolt, Blizzard icicles) must never call `new Object()` every frame. Fixed-length preallocated object pools must be used, marked `active = false` upon impact or timeout for recycling.

3. **Training Dummy Hit Center Unified at $Y - 18\text{px}$**:
   Hit detection must use a circle centered 18 pixels above the dummy ground anchor point with a 26px radius. Hitboxes at ground level ($Y - 0$) or hovering in mid-air are strictly prohibited.

---

## III. Core Gates: Pure MPQ Sprite Triple Ground Truth Verification Protocol

Before any skill can be declared implemented, fixed, or delivered, it **must pass 100% of the following verification gates**. Failure of any gate constitutes a critical violation and terminates delivery immediately:

### 🚪 Gate 1: Zero-Vector Static Audit
- **Objective**: Thoroughly eliminate any frontend Canvas vector hand-drawing mimicking official animations at the source code level.
- **Audit Scope**:
  - `verification_sandbox/v2_shared_engine/templates/*.ts`
  - `Diablo2-Agent-Monitor/web/js/combat_director.js`
- **Redline Prohibited Signatures**:
  - After stripping comments via regex, custom vector drawing commands such as `ctx.stroke`, `ctx.lineTo`, `ctx.ellipse`, and `ctx.arc` are strictly prohibited.
  - Their occurrence count must be strictly **0**.
- **Mandatory Required Signatures**:
  - Must include `ctx.drawImage` calls for official 1.13c MPQ sprites, ensuring all visuals are driven by Blizzard asset slices.

### 🖥️ Gate 2: Headless Dynamic Invocation & Atlas Interception Audit
- **Objective**: Dynamically monitor the rendering pipeline within a real headless browser environment to verify that casting actually invokes official atlases and never invokes vector drawing.
- **Interception Mechanism**:
  - Inject a prototype hook on `CanvasRenderingContext2D.prototype.stroke`; count calls throughout skill execution; **assert count must be 0**.
  - Inject a prototype hook on `CanvasRenderingContext2D.prototype.drawImage`; verify asset URLs throughout skill execution:
    - Nova: Must invoke `ElectricNova.png` official sparks at high frequency.
    - Chain Lightning: Must invoke `lightningstrike.png` 32-direction arcs and `shockhit_sm.png` hit explosion atlas at high frequency.
- **Console Standards**:
  - Zero console errors (0 Console Errors), zero unhandled exceptions, and zero 404 missing resource errors across page load and the entire casting lifecycle.

### 🖼️ Gate 3: Ground Truth Visual Comparison & Quantitative Similarity Scoring Gate
- **Objective**: Rely solely on locally stored official Blizzard high-resolution ground truth captures as visual acceptance criteria, preventing visual regressions.
- **Reference Baseline Source**:
  - Official high-res in-game captures under the official_visual_standards/ directory for each class (e.g., official_visual_standards/sorceress/nova_crop.png, chain_lightning_crop.png).
- **Artifact Standards**:
  - Capture high-resolution sandbox rendering screenshots.
  - Perform scale normalization and side-by-side alignment, generating side-by-side comparison images saved to 	estimages/comparison/side_by_side_*.png.
- **Mandatory Quantitative Similarity Scoring Gate (Score >= 85 / 100)**:
  - An algorithmic visual similarity scoring evaluation (evaluating aspect ratio geometry, incandescent core thickness, continuous ring/beam closure, outer plasma glow, structural similarity, and concentric ring topology) must be executed comparing the sandbox rendering against the Blizzard ground truth capture.
  - Delivery is strictly permitted **only when the composite similarity score achieves 85% (85 / 100) or higher**. Any score below 85 triggers automatic rejection and requires geometric/blending recalibration.
  - **Concentric Ring Topology & Radial Energy Crest Matching (同心階數與徑向能量波峰匹配度)**:
    - For radial wave and nova skills (Nova 48, Frost Nova 44, Poison Nova 92), algorithmic verification performs cross-sectional radial luminance profile and crest peak detection analysis ($\ge 3$ distinct concentric wavefront crests: Inner Core Ring, Median Body Ring, Outer Fringe Ring). Missing or collapsed wavefront cascades (e.g., only 1 or 2 rings detected where ground truth displays 3) triggers an immediate structural topology deduction.
- **Visual Inspection Criteria**:
  - **Nova**: Concentric expanding ring must be completely closed; strictly featuring 3 concentric wavefront tiers (`[R, R - 8px, R - 16px]` cascade) matching Blizzard's multi-ring cascading discharge; pure white core solidly fused (18~20px width); outer edge exhibiting authentic electrical sparks; zero directional tumor artifacts; zero black gaps.
  - **Chain Lightning**: High-voltage electrical arcs must penetrate continuously between endpoints without breaks (14px step, triple normal micro-offset plasma fusion); node explosion animations (ShockHitSm) must play completely.

### 🌀 Gate 4: Foot Disk Aura & Anchor Alignment Gate
- **Objective**: Eliminate model wobbling, jittering, floating, or foot-sliding when switching animations, rotating omnidirectionally, or during cast startup.
- **Verification Logic**:
  - Inject an authentic 2:1 ratio Blizzard ground aura overlay (Ground Aura Overlay) at the entity's ground origin / pivot point.
  - Drive entity through Idle (TN/TW/NU), Cast Startup (SC), Walk/Run (WL/RN), Get Hit (GH), and 4/8/16-directional rotations, calculating dual-foot grounding displacement.
- **Acceptance Criteria**:
  - Foot disk center offset $\le 1\text{px}$ (achieving Zero-Wobble).
  - Skill projectile spawn origin must strictly follow the **1/6 Slicing Rule**, locking the release anchor within the 3/6 to 4/6 vertical height interval; never spawning from the ground plane or detaching above the head.

### 🛡️ Gate 5: Engine Assertion & Layer Timing Gate
- **Objective**: Prevent classic game crashes caused by skeletal timing mismatches and out-of-bounds animation frames in the original C++ engine.
- **Verification Standards**:
  - **`eComponent` Frame-Lock Protection**: When verifying multi-component entities, all active component layers (TR/HD/LA/RA/LH/RH/SH/LG/S1-S8) must be 1:1 frame-locked to the COF skeleton length and `AnimData.D2` per direction; layer length mismatches are strictly prohibited.
  - **`(UINT)nAnimFrame` Index Guard**: When calling sequence animations (`monseq.txt` / custom loops), rigorously guard that sequence indices fall within $[0, \text{TotalFrames}-1]$, eliminating out-of-bounds frame fetching and negative frame access.
  - **Void Sprite Slot Safe Placeholder**: All unequipped or hidden limb slots must mount a 1x1 transparent Void Sprite Slot placeholder; broken layers or null pointer exceptions are strictly forbidden.

---

## IV. Automated Verification Script Execution Guide

The project provides two automated verification test suites located in the project's `scripts/` directory and skill library:

1. **Triple Ground Truth Verification Gate Script (`scripts/verify_ground_truth.py`)**:
   ```bash
   python scripts/verify_ground_truth.py --port 8765
   ```
   - Automatically executes Gate 1 (Static Code Audit), Gate 2 (Dynamic Atlas Interception), and Gate 3 (Side-by-Side Comparison Generation) sequentially.
   - Returns exit code 0 only when all three gates pass.

2. **Standard Sandbox Multi-Tab Inspection Script (`scripts/verify_sandbox.py`)**:
   ```bash
   python scripts/verify_sandbox.py --port 8765 --out testimages
   ```
   - Verifies tab switching, mouse casting, dummy hit damage text popups, and 0 console errors.

---

## V. Official Dual-Authority Visual Reference Index

When implementing new skills or recalibrating visual effects, the following two authoritative sources serve as the sole official research baselines:

1. **[Blizzard Official Arreat Summit Skill Index](https://classic.battle.net/diablo2exp/skills/alphaskills.shtml)**:
   - Validates official animation frame rates, visual effect layering, color luminance, and particle morphology.
2. **[DiabloWiki (NetEase) Skill Encyclopedia](https://wiki.d.163.com/index.php?title=%E5%88%86%E7%B1%BB:%E6%9A%97%E9%BB%912_%E6%8A%80%E8%83%BD)**:
   - Validates skill localized nomenclature, Cast Delay, hit reactions, and numeric configurations.

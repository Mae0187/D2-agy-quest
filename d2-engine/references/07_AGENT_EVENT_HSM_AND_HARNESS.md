# 🧠 Agent Event-Driven HSM & Deterministic Test Harness Specification (07_AGENT_EVENT_HSM_AND_HARNESS.md)

This document standardizes the integration architecture between the **asynchronous AI Agent event stream (SSE / Webhooks / CLI logs)** and the **synchronous 25 FPS Diablo II Combat Dungeon engine**, alongside the **3-Tier Headless Test Harness**.

---

## I. Asynchronous Agent Event-Driven HSM Pipeline

To bridge the high-frequency asynchronous burst stream of AI agents (token streaming, concurrent tool calls, exceptions) with the deterministic 25 FPS animation loop ($\Delta t = 40\text{ms}$), the engine implements a **Three-Tier Decoupled Pipeline**:

```
[Agent Event Stream] (SSE / WS / IPC)
        │
        ▼
┌─────────────────────────┐
│     Event Normalizer    │  ➔ Ingests raw events (tokens, tool_start, error)
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Priority Command Buffer │  ➔ Sliding Window Coalescing (W = 120ms / 3 ticks)
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Hierarchical State      │  ➔ Action Frame Gate (fact) & Preemptive Interrupt
│ Machine (HSM Engine)    │
└─────────────────────────┘
```

### 1. Sliding Window Event Coalescing
For rapid burst signals such as `token_chunk` or successive atomic tool calls:
- **Sliding Window**: $W = 120\text{ms}$ (exactly 3 D2 ticks).
- Successive outputs within the window are coalesced into a single sustained state (`Zeal Multi-Hit` sequence or `Channeling Cast`), preventing animation frame clipping or 0-th frame reset stuttering.

### 2. Dual-Layer State Decoupling (Intent vs. D2 Animation Mode)

| Agent Lifecycle Event | Priority ($P$) | Coalescing Policy | Mapped D2 Anim Mode | Action Transition Rule |
| :--- | :--- | :--- | :--- | :--- |
| **Idle / Waiting** | $P = 3$ | Queue empty | `TN` (Alert Stand) $\leftrightarrow$ `WL` (Patrol) | Transitions only when current anim reaches $N - 1$ frame |
| **Thinking / Reasoning** | $P = 2$ | State persist | `TN` Alert + Persistent Floor Aura Overlay (`AuraBack` / `AuraFront`) | Dynamic aura mounting without interrupting skeletal posture |
| **Code Streaming** | $P = 2$ | 120ms sliding window | `A1` $\rightarrow$ `A2` Rapid Slashes or `SC` Cast | Locked until $f_{act}$ strike completion before chaining next cycle |
| **Tool Call / Unit Test** | $P = 1$ | Batch queue | `SC` Cast + AoE Projectiles (Nova / Fist of the Heavens) | Waits for prior attack $f_{act}$ then smoothly chains |
| **Error / Exception** | $P = 0$ (Highest) | Preemptive Interrupt | Minor: `BL` (Shield Block) / Fatal: `GH` (Hit Recovery) | **Unconditionally interrupts current frame immediately** |
| **Task Completed** | $P = 0$ | Sequence lock | `DD` Elite Monster Collapse + Gold Pillar Overlay $\rightarrow$ `NU` | Play sequence locked until loot drops settle |

### 3. Action Frame Gate Law
Let total animation frames be $N$, and the critical action trigger frame be $f_{act}$:
- **Standard States ($P \ge 1$)**: State transitions are strictly gated to occur at $f_{cur} \ge f_{act}$ or end frame $f_{cur} = N - 1$. Direct mid-swing skipping is prohibited.
- **Error State ($P = 0$)**: Has full preemptive authority, interrupting at any frame $f_{cur}$ directly into `GH` or `BL`.

---

## II. Three-Tier Deterministic Test Harness

HTML5 Canvas operates in immediate mode. To ensure 100% deterministic visual and architectural verification without flaky false-alarms, the engine exposes `window.__D2_HARNESS__`.

### 1. Deterministic Foundation
- **Loop Freezing**: Overrides `requestAnimationFrame`, stepping solely via discrete `stepFrame(deltaFrames)`.
- **Seeded PRNG**: Replaces native `Math.random()` with deterministic Mulberry32 / Xorshift.
- **Direct State Probe**: `__D2_HARNESS__.renderExact({ mode, dir, frame, equipOverrides, skillActive })`.

### 2. The 3-Tier Verification Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│ Level 1: Telemetry Assertion (RenderQueueSnapshot JSON)     │ ➔ 0ms lag, checks z-order & offsets
├─────────────────────────────────────────────────────────────┤
│ Level 2: Golden Snapshot Visual Regression (Odiff <= 0.05%) │ ➔ Pixel diff against baseline frames
├─────────────────────────────────────────────────────────────┤
│ Level 3: Temporal Centroid Continuity (J(f) <= 4px)         │ ➔ Detects single-frame offset teleport
└─────────────────────────────────────────────────────────────┘
```

1. **Level 1: Telemetry & Layer Assertion**:
   - Intercepts `RenderQueueSnapshot` JSON:
     - Asserts directional COF order: $\text{Index}(LH) > \text{Index}(TR)$ when facing South ($d = 0$).
     - Asserts fire origin distance: $\|P_{spawn} - P_{hand}\| \le 2\text{px}$.
     - Asserts hit overlay center alignment: $\Delta d_{hit} = 0\text{px}$.
2. **Level 2: Golden Baseline Visual Regression**:
   - Renders 8 directions $\times$ critical action frames (`TN:0`, `A1:fact`, `SC:fact`, `BL:1`).
   - Compares with pixel tolerance $\epsilon \le 0.05\%$.
3. **Level 3: Temporal Centroid Trajectory Continuity**:
   - For an animation sequence (e.g. 12-frame campfire step or 16-frame whirlwind):
   - Computes alpha-channel centroid $C(f) = (C_x(f), C_y(f))$.
   - Computes second-order difference jitter:
     $$J(f) = \|C(f+1) - 2C(f) + C(f-1)\|_2$$
   - Asserts $\max_f J(f) \le 4\text{px}$, automatically flagging single-frame teleportation glitches without manual inspection.

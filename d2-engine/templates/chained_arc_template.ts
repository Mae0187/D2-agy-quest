// =======================================================================
// Diablo II F09 Chained Arc Leap Template (100% Pure MPQ Sprites)
// Ground Truth Aligned with Official Blizzard Capture:
// official_visual_standards/sorceress/chain_lightning_enlarged_01.jpg & chain_lightning_crop.png
// Based on Phrozen Keep technical guides (viewtopic.php?t=67114 / viewtopic.php?t=29595):
// Skills.txt (53 Chain Lightning, srvdofunc 26, cltdofunc 27)
// Missiles.txt (chainlightning 93, pCltDoFunc 8 trailing beam, CltParam1: 3 Subloops, pCltHitFunc 16 bounce hit)
//
// Core Ground Truth Mechanisms:
// 1. Per pCltDoFunc: 8 (Subloops: 3), enforce endpoint Vertex Snapping along leap path.
// 2. High-density step sampling (STEP_SIZE: 14px) provides >75% overlap of LightningStrike sprites,
//    eliminating all dashed gaps, segment cracks, or loose jagged artifacts.
// 3. Triple normal-micro-offset additive fusion (Offsets: [-1.5, 0, 1.5] along perpendicular normal):
//    Saturates the central beam core to pure incandescent white plasma (18~22px width) while
//    naturally bleeding an authentic electric-blue outer glow.
// 4. Detonates native 20-frame ShockHitSm (ShockHitSm.png, 63x66, pivot 31,33) burst animation at hit nodes.
// 5. Strictly forbids Canvas vector primitives (zero ctx.stroke, zero ctx.lineTo, zero ctx.beginPath).
// =======================================================================

import { SkillManifestData, TargetDummy, ManifestLayer } from './types';
import { DirectionResolver } from './direction_resolver';

export interface ArcStep {
  x: number;
  y: number;
  nx: number; // Normal unit vector X
  ny: number; // Normal unit vector Y
  dir: number;
  frame: number;
}

export interface ArcBounceSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  steps: ArcStep[];
  dir: number;
}

export interface ActiveChainedArc {
  id: string;
  skillId: string;
  category: string;
  segments: ArcBounceSegment[];
  targetPoints: { x: number; y: number }[];
  life: number;
  maxLife: number;
  animFrame: number;
  atlasFile: string;
  shockAtlasFile: string;
  cellW: number;
  cellH: number;
  pivotX: number;
  pivotY: number;
  frames: number;
}

export class ChainedArcTemplate {
  public static emit(
    manifest: SkillManifestData,
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    dummies: TargetDummy[],
    arcsList: ActiveChainedArc[],
    onDamage: (d: TargetDummy, dmg: number) => void
  ): void {
    const layer = manifest.layers.find(l => l.role === 'lightning_beam') || manifest.layers[0];
    const atlasFile = layer?.atlasFile || 'assets/atlases/lightningstrike.png';
    const shockAtlasFile = 'assets/atlases/shockhit_sm.png';
    const cellW = layer?.cellW || 150;
    const cellH = layer?.cellH || 108;
    const pivotX = layer?.pivotX || 75;
    const pivotY = layer?.pivotY || 73;
    const frames = layer?.frames || 8;

    const maxBounces = manifest.parameters.pierce || 5;
    const jumpRadius = 320;
    const dmg = manifest.parameters.damage || 65;

    // Locate the first target dummy
    let currentTarget: TargetDummy | null = null;
    let bestDist = 9999;
    for (const d of dummies) {
      if (d.hp <= 0) continue;
      const dist = Math.hypot(d.x - tx, d.y - 18 - ty);
      if (dist < bestDist && dist < jumpRadius) {
        bestDist = dist;
        currentTarget = d;
      }
    }

    if (!currentTarget) {
      return;
    }

    const visitedIds = new Set<number>();
    const segments: ArcBounceSegment[] = [];
    const targetPoints: { x: number; y: number }[] = [];

    let curX = sx;
    let curY = sy;
    let bounces = 0;

    // Ground truth step size: 14px step guarantees solid continuous plasma interlocking
    const STEP_SIZE = 14;

    while (currentTarget && bounces < maxBounces) {
      visitedIds.add(currentTarget.id);
      const nextX = currentTarget.x;
      const nextY = currentTarget.y - 18; // Torso hit center
      targetPoints.push({ x: nextX, y: nextY });

      const dx = nextX - curX;
      const dy = nextY - curY;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) break;

      const mainDeg = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
      const mainDir32 = DirectionResolver.resolve32(mainDeg);

      // Perpendicular normal vector for micro-offset fusion
      const ux = dx / dist;
      const uy = dy / dist;
      const nx = -uy;
      const ny = ux;

      const steps: ArcStep[] = [];
      const subCount = Math.max(1, Math.round(dist / STEP_SIZE));

      for (let k = 0; k < subCount; k++) {
        const t = (k + 0.5) / subCount;
        const stepX = curX + dx * t;
        const stepY = curY + dy * t;
        const stepFrame = (k * 2 + bounces * 3) % frames;

        steps.push({
          x: stepX,
          y: stepY,
          nx,
          ny,
          dir: mainDir32,
          frame: stepFrame,
        });
      }

      segments.push({
        x1: curX,
        y1: curY,
        x2: nextX,
        y2: nextY,
        steps,
        dir: mainDir32,
      });

      onDamage(currentTarget, dmg);

      curX = nextX;
      curY = nextY;
      bounces++;

      // Locate the next chained target
      const unvisited = dummies.filter(d => !visitedIds.has(d.id) && d.hp > 0);
      if (unvisited.length > 0) {
        unvisited.sort((a, b) => Math.hypot(a.x - curX, a.y - 18 - curY) - Math.hypot(b.x - curX, b.y - 18 - curY));
        if (Math.hypot(unvisited[0].x - curX, unvisited[0].y - 18 - curY) <= jumpRadius) {
          currentTarget = unvisited[0];
        } else {
          break;
        }
      } else {
        break;
      }
    }

    if (segments.length > 0) {
      arcsList.push({
        id: `cl_${Date.now()}_${Math.random()}`,
        skillId: manifest.skillId,
        category: manifest.category,
        segments,
        targetPoints,
        life: 0,
        maxLife: 10,
        animFrame: 0,
        atlasFile,
        shockAtlasFile,
        cellW,
        cellH,
        pivotX,
        pivotY,
        frames,
      });
    }
  }

  public static tick(arcs: ActiveChainedArc[]): void {
    for (let i = arcs.length - 1; i >= 0; i--) {
      const arc = arcs[i];
      arc.life++;
      arc.animFrame++;

      if (arc.life >= arc.maxLife) {
        arcs.splice(i, 1);
      }
    }
  }

  public static render(
    ctx: CanvasRenderingContext2D,
    arcs: ActiveChainedArc[],
    loadedImages: Record<string, HTMLImageElement>
  ): void {
    if (arcs.length === 0) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Normal micro-offsets for authentic Subloops: 3 white-hot plasma fusion
    const OFFSETS = [-1.5, 0, 1.5];

    for (const arc of arcs) {
      const beamImg = loadedImages[arc.atlasFile];
      const shockImg = loadedImages[arc.shockAtlasFile];
      if (!beamImg || !beamImg.complete) continue;

      const lifeRatio = arc.life / arc.maxLife;
      const alpha = Math.max(0, 1.0 - Math.pow(lifeRatio, 2));
      ctx.globalAlpha = alpha;

      // ── 1. Render 32-direction native LightningStrike sprite slices along the connection ──
      for (const seg of arc.segments) {
        for (const st of seg.steps) {
          const frame = (st.frame + arc.animFrame) % arc.frames;

          // Triple normal micro-offset fusion creates unbroken incandescent core + blue glow
          for (let oi = 0; oi < OFFSETS.length; oi++) {
            const offset = OFFSETS[oi];
            const posX = Math.round(st.x + st.nx * offset - arc.pivotX);
            const posY = Math.round(st.y + st.ny * offset - arc.pivotY);

            ctx.drawImage(
              beamImg,
              frame * arc.cellW,
              st.dir * arc.cellH,
              arc.cellW,
              arc.cellH,
              posX,
              posY,
              arc.cellW,
              arc.cellH
            );
          }
        }
      }

      // ── 2. Render native 20-frame ShockHitSm electrical burst animation at target nodes ──
      if (shockImg && shockImg.complete) {
        const shockFrame = Math.min(19, arc.life * 2);
        const shCellW = 63;
        const shCellH = 66;
        const shPivotX = 31;
        const shPivotY = 33;

        for (const pt of arc.targetPoints) {
          ctx.drawImage(
            shockImg,
            shockFrame * shCellW,
            0,
            shCellW,
            shCellH,
            Math.round(pt.x - shPivotX),
            Math.round(pt.y - shPivotY),
            shCellW,
            shCellH
          );
        }
      }
    }

    ctx.restore();
  }
}

// =======================================================================
// Diablo II 通用連續噴流 / 地表區域 / 多階段天降模板
// =======================================================================

import { SkillManifestData, TargetDummy } from './types';
import { ActiveExplosion } from './linear_missile_template';

// 1. 連續噴流 (Inferno) — 依據原廠 Missiles.txt: infernoflame1/2 (Id: 60/61)
export interface ActiveStreamParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  animFrame: number;
}

export class ContinuousStreamTemplate {
  public static emit(
    manifest: SkillManifestData,
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    particles: ActiveStreamParticle[]
  ) {
    const dx = tx - sx;
    const dy = ty - sy;
    const baseAngle = Math.atan2(dy, dx);

    // 每次物理 tick 發射 2 顆粒子，形成高密度連續噴流
    for (let i = 0; i < 2; i++) {
      const spread = baseAngle + (Math.random() - 0.5) * 0.22;
      const spd = 12 + (Math.random() - 0.5) * 2;
      particles.push({
        x: sx + Math.cos(baseAngle) * 24,
        y: sy + Math.sin(baseAngle) * 24,
        vx: Math.cos(spread) * spd,
        vy: Math.sin(spread) * spd,
        life: 0,
        maxLife: 30, // 30 ticks
        animFrame: 0,
      });
    }
  }

  public static tick(
    particles: ActiveStreamParticle[],
    dummies: TargetDummy[],
    onDamage?: (d: TargetDummy, dmg: number, isCold?: boolean) => void,
    addDamageText?: (x: number, y: number, text: string, color?: string) => void
  ) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life++;
      p.animFrame = Math.min(14, Math.floor((p.life / p.maxLife) * 15));

      for (const d of dummies) {
        if (d.hp <= 0 || d.isDead || d.remove) continue;
        const dist = Math.hypot(d.x - p.x, (d.y - 18 - p.y) * 2);
        if (dist <= 28) {
          if (onDamage) {
            onDamage(d, 3, false);
          } else {
            if (typeof d.takeDamage === 'function') {
              d.takeDamage(3);
            } else {
              d.hp = Math.max(0, d.hp - 3);
              d.hitTime = performance.now();
              if (d.hp <= 0) d.isDead = true;
            }
          }
          if (p.life % 8 === 0 && addDamageText) {
            addDamageText(d.x, d.y - 20, '-16', '#F97316');
          }
        }
      }

      if (p.life >= p.maxLife) {
        particles.splice(i, 1);
      }
    }
  }
}

// 2. 地表火柱 (Firewall 火牆 & Meteor 隕石地表殘火)
// 依據 Missiles.txt: firewall (Id: 69) groundFireBig / meteorfire (Id: 240) groundFireMedium
export interface ActiveGroundPillar {
  atlasFile: string;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  animFrame: number;
  cellW: number;
  cellH: number;
  pivotX: number;
  pivotY: number;
  radius: number;
}

export class GroundHazardTemplate {
  public static spawnLine(
    manifest: SkillManifestData,
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    pillars: ActiveGroundPillar[]
  ) {
    const dx = tx - sx;
    const dy = ty - sy;
    const angle = Math.atan2(dy, dx);
    const perp = angle + Math.PI / 2; // 垂直於施法視線
    const spacing = 38; // 原版 38px 間距

    const layer = manifest.layers.find(l => l.role === 'ground_fire' || l.role === 'ground_hazard') || {
      atlasFile: 'assets/atlases/groundfire_big.png',
      cellW: 68,
      cellH: 169,
      pivotX: 34,
      pivotY: 158,
      frames: 37,
    };

    for (let i = -3; i <= 3; i++) {
      const px = tx + Math.cos(perp) * (i * spacing);
      const py = ty + Math.sin(perp) * (i * spacing * 0.5); // 2:1 等角視角壓縮
      pillars.push({
        atlasFile: layer.atlasFile,
        cellW: layer.cellW,
        cellH: layer.cellH,
        pivotX: layer.pivotX,
        pivotY: layer.pivotY,
        x: px,
        y: py,
        life: 0,
        maxLife: 90, // Missiles.txt firewall Range: 90 (3.6秒)
        animFrame: Math.floor(Math.random() * (layer.frames || 37)),
        radius: 45, // 45px 等角判定半徑，相鄰 38px 火柱無縫咬合，形成寬闊火牆判定
      });
    }
  }

  public static tick(
    pillars: ActiveGroundPillar[],
    dummies: TargetDummy[],
    onDamage?: (d: TargetDummy, dmg: number, isCold?: boolean) => void,
    addDamageText?: (x: number, y: number, text: string, color?: string) => void
  ) {
    for (let i = pillars.length - 1; i >= 0; i--) {
      const p = pillars[i];
      p.life++;
      p.animFrame = (p.animFrame + 1) % 37;

      for (const d of dummies) {
        if (d.hp <= 0 || d.isDead || d.remove) continue;
        // 地表等角距離判定（直接對齊怪物腳底接地點 d.x, d.y）
        const dist = Math.hypot(d.x - p.x, (d.y - p.y) * 2);
        if (dist <= p.radius) {
          // 站在火柱上每 tick (25Hz) 穩定扣血 3 HP，並觸發受擊高亮閃白與死亡判定
          if (onDamage) {
            onDamage(d, 3, false);
          } else {
            if (typeof d.takeDamage === 'function') {
              d.takeDamage(3);
            } else {
              d.hp = Math.max(0, d.hp - 3);
              d.hitTime = performance.now();
              if (d.hp <= 0) d.isDead = true;
            }
          }
          // 每 7 ticks (~0.28秒) 浮動跳出一次累積傷害數字
          if (p.life % 7 === 0 && addDamageText) {
            addDamageText(d.x, d.y - 20, '-21', '#EA580C');
          }
        }
      }

      if (p.life >= p.maxLife) {
        pillars.splice(i, 1);
      }
    }
  }
}

// 3. 多階段天降 (Meteor 隕石天降)
// 依據 Missiles.txt: meteor (Id: 238) / meteorexp (Id: 239) / meteorfire (Id: 240)
export interface ActiveMeteorStage {
  targetX: number;
  targetY: number;
  tick: number;
  maxTick: number;
}

export class TimedMultiStageTemplate {
  public static call(
    manifest: SkillManifestData,
    tx: number,
    ty: number,
    calls: ActiveMeteorStage[]
  ) {
    calls.push({
      targetX: tx,
      targetY: ty,
      tick: 0,
      maxTick: 65, // 天降階段總時長 (42 落地 + 爆炸播放完畢)
    });
  }

  public static tick(
    calls: ActiveMeteorStage[],
    manifest: SkillManifestData,
    explosions: ActiveExplosion[],
    pillars: ActiveGroundPillar[],
    dummies: TargetDummy[],
    onDamage: (d: TargetDummy, dmg: number) => void,
    addDamageText?: (x: number, y: number, text: string, color?: string) => void
  ) {
    const stages = manifest.timing.stages || {};
    const impactTick = stages.impact?.triggerTick || 42;
    const aoe = stages.impact?.aoeRadius || 120; // 依據原廠 120px 巨轟半徑

    for (let i = calls.length - 1; i >= 0; i--) {
      const mc = calls[i];
      mc.tick++;

      // 第 42 tick (1.68秒)：巨石落地巨轟 + 留下地表持續燃燒殘火群
      if (mc.tick === impactTick) {
        // 1. 落地巨爆範圍傷害 (120px 廣域砸轟 95 點直接傷害)
        for (const d of dummies) {
          if (d.hp <= 0 || d.isDead || d.remove) continue;
          const dist = Math.hypot(d.x - mc.targetX, (d.y - mc.targetY) * 2);
          if (dist <= aoe) {
            onDamage(d, 95);
          }
        }

        // 2. 巨轟爆炸動畫 (meteor_explode)
        const expLayer = manifest.layers.find(l => l.role === 'impact_burst');
        if (expLayer) {
          explosions.push({
            atlasFile: expLayer.atlasFile,
            x: mc.targetX,
            y: mc.targetY,
            animFrame: 0,
            maxFrames: expLayer.frames,
            frameTimer: 0,
            cellW: expLayer.cellW,
            cellH: expLayer.cellH,
            pivotX: expLayer.pivotX,
            pivotY: expLayer.pivotY,
          });
        }

        // 3. 鋪設地表餘燼殘火群 (meteorfire / groundFireMedium)
        // 依據 Missiles.txt: Id 240, Range: 90 = 3.6秒
        const resLayer = manifest.layers.find(l => l.role === 'ground_fire') || {
          atlasFile: 'assets/atlases/groundfire_med.png',
          cellW: 68,
          cellH: 138,
          pivotX: 34,
          pivotY: 127,
          frames: 37,
        };

        for (let j = 0; j < 5; j++) {
          const ox = (Math.random() - 0.5) * 54;
          const oy = (Math.random() - 0.5) * 28;
          pillars.push({
            atlasFile: resLayer.atlasFile,
            cellW: resLayer.cellW,
            cellH: resLayer.cellH,
            pivotX: resLayer.pivotX,
            pivotY: resLayer.pivotY,
            x: mc.targetX + ox,
            y: mc.targetY + oy,
            life: 0,
            maxLife: 90, // 3.6秒持續燃燒
            animFrame: Math.floor(Math.random() * (resLayer.frames || 37)),
            radius: 40, // 殘火判定半徑
          });
        }
      }

      // 天降實體生命週期結束
      if (mc.tick >= mc.maxTick) {
        calls.splice(i, 1);
      }
    }
  }
}


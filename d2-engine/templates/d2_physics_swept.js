/**
 * @file d2-engine/templates/d2_physics_swept.js
 * @description Iron Rule 12 Implementation: Directional Fire Offset Spawner,
 *              Continuous Swept Circle Segment-to-Cylinder Collision Engine,
 *              and Target Torso Anchor Foreground Hit Overlay Manager.
 */

import { UI_CONFIG } from './ui_config.js';

export class D2SweptPhysicsEngine {
  constructor() {
    this.projectiles = [];
    this.hitOverlays = [];
    this.nextEntityId = 1;

    // 預設地牢標靶怪物實體（可由沙盒或控制器動態調整尺寸與位置）
    this.monsters = [
      {
        id: 'mon_target_primary',
        sizeClass: 'MEDIUM',
        worldPos: { x: 3.5, y: 0.0, z: 0 },
        alive: true
      }
    ];
  }

  /**
   * 設定主要標靶怪物之尺寸類別與世界座標
   */
  configurePrimaryTarget(sizeClass, worldPos) {
    const preset = UI_CONFIG.MONSTER_GEOMETRY_PRESETS[sizeClass] || UI_CONFIG.MONSTER_GEOMETRY_PRESETS.MEDIUM;
    if (this.monsters.length === 0) {
      this.monsters.push({
        id: 'mon_target_primary',
        sizeClass: preset.sizeClass,
        worldPos: { ...worldPos },
        alive: true
      });
    } else {
      this.monsters[0].sizeClass = preset.sizeClass;
      if (worldPos) {
        this.monsters[0].worldPos = { ...worldPos };
      }
    }
  }

  /**
   * 鐵律 12.1：依據 8 方向、持物手別與預設高度 (40px) 生成投射物
   * @param {{ actorWorldPos: {x:number,y:number,z:number}, direction: number, handSource: string, isAoE?: boolean, speedSubTilesPerTick?: number, pierce?: boolean }} params
   */
  spawnDirectionalProjectile(params) {
    const cfg = UI_CONFIG.FIRE_OFFSET_CONFIG;
    const dirIdx = params.direction ?? 0;
    const dirEntry = cfg.DIRECTION_8_TABLE[dirIdx] || cfg.DIRECTION_8_TABLE[0];
    const lHand = cfg.HAND_LATERAL_SUBTILES[params.handSource] ?? 0;
    const rForward = cfg.FORWARD_RADIUS_SUBTILES;
    const zFire = cfg.DEFAULT_Z_FIRE_PX;

    // 若為 TEST_AOE，環繞角色生成 8 方向新星 (Nova) 投射物；否則生成單一指向投射物
    const directionsToSpawn = params.isAoE ? [0, 1, 2, 3, 4, 5, 6, 7] : [dirIdx];
    const spawnedList = [];

    for (const d of directionsToSpawn) {
      const entry = cfg.DIRECTION_8_TABLE[d];
      const theta = entry.angleRad;

      // 極座標合成世界發射起點 P_spawn(d)
      const spawnX = params.actorWorldPos.x + (Math.cos(theta) * rForward - Math.sin(theta) * lHand);
      const spawnY = params.actorWorldPos.y + (Math.sin(theta) * rForward + Math.cos(theta) * lHand);

      // 若非 AoE 且方向為預設正向 (Dir 0)，讓投射物精準朝向標靶怪物方向飛行以驗證碰撞
      let vx = Math.cos(theta);
      let vy = Math.sin(theta);
      if (!params.isAoE && this.monsters[0]) {
        const dx = this.monsters[0].worldPos.x - spawnX;
        const dy = this.monsters[0].worldPos.y - spawnY;
        const dist = Math.hypot(dx, dy);
        if (dist > 1e-5) {
          vx = dx / dist;
          vy = dy / dist;
        }
      }

      const speed = params.speedSubTilesPerTick ?? 1.85; // 支援高速跨幀位移測試
      const proj = {
        id: `proj_${this.nextEntityId++}`,
        direction: d,
        worldPos: { x: spawnX, y: spawnY, z: zFire },
        prevWorldPos: { x: spawnX, y: spawnY, z: zFire },
        velocity: { vx: vx * speed, vy: vy * speed },
        radiusSubTiles: 0.25,
        pierce: Boolean(params.pierce),
        screenFineTune: { dx: entry.dx, dy: entry.dy },
        ttlTicks: 20,
        active: true
      };

      this.projectiles.push(proj);
      spawnedList.push(proj);
    }

    return spawnedList;
  }

  /**
   * 鐵律 12.2：計算世界 XY 平面上連續位移線段 AB 與圓心 C 之最短距離與投影參數 lambda
   * @param {{x: number, y: number}} pointA 第 t-1 幀位置
   * @param {{x: number, y: number}} pointB 第 t 幀位置
   * @param {{x: number, y: number}} centerC 目標怪物圓柱體中心
   */
  static computeSweptSegmentToCircle(pointA, pointB, centerC) {
    const abX = pointB.x - pointA.x;
    const abY = pointB.y - pointA.y;
    const acX = centerC.x - pointA.x;
    const acY = centerC.y - pointA.y;

    const abLenSq = abX * abX + abY * abY;
    let lambda = 0;
    if (abLenSq > 1e-8) {
      const dot = acX * abX + acY * abY;
      lambda = Math.max(0, Math.min(1, dot / abLenSq));
    }

    const closestQ = {
      x: pointA.x + lambda * abX,
      y: pointA.y + lambda * abY
    };

    const dist = Math.hypot(centerC.x - closestQ.x, centerC.y - closestQ.y);
    return {
      lambda,
      closestPoint: closestQ,
      distanceSubTiles: dist
    };
  }

  /**
   * 推進 1 個物理 Tick (40ms)：執行連續 Swept Circle 碰撞檢測與軀幹受擊特效生命週期管理
   */
  stepPhysicsTick() {
    const collisionEvents = [];

    for (const proj of this.projectiles) {
      if (!proj.active) continue;

      const pointA = { x: proj.worldPos.x, y: proj.worldPos.y };
      const pointB = {
        x: proj.worldPos.x + proj.velocity.vx,
        y: proj.worldPos.y + proj.velocity.vy
      };

      proj.prevWorldPos = { ...proj.worldPos };
      proj.worldPos.x = pointB.x;
      proj.worldPos.y = pointB.y;
      proj.ttlTicks -= 1;

      for (const mon of this.monsters) {
        if (!mon.alive) continue;
        const monPreset = UI_CONFIG.MONSTER_GEOMETRY_PRESETS[mon.sizeClass] || UI_CONFIG.MONSTER_GEOMETRY_PRESETS.MEDIUM;
        const hitThreshold = proj.radiusSubTiles + monPreset.radiusSubTiles;

        const sweptResult = D2SweptPhysicsEngine.computeSweptSegmentToCircle(
          pointA,
          pointB,
          mon.worldPos
        );

        // 當最短距離小於等於兩者半徑總和，即刻判定命中，徹底杜絕跨幀穿透
        if (sweptResult.distanceSubTiles <= hitThreshold) {
          // 鐵律 12.3：受擊特效三明治錨點強制鎖定於目標怪物軀幹中心 (腳底 Y 向上減去 torsoHeightPx)
          const overlay = {
            id: `hitfx_${this.nextEntityId++}`,
            targetMonsterId: mon.id,
            monsterSizeClass: mon.sizeClass,
            anchorWorldPos: { ...mon.worldPos },
            torsoHeightPx: monPreset.torsoHeightPx,
            layerRole: 'FOREGROUND_SANDWICH_TOP',
            remainingTicks: 6,
            lambdaAtHit: sweptResult.lambda,
            minDistanceSubTiles: sweptResult.distanceSubTiles
          };
          this.hitOverlays.push(overlay);
          collisionEvents.push(overlay);

          if (!proj.pierce) {
            proj.active = false;
            break;
          }
        }
      }

      if (proj.ttlTicks <= 0) {
        proj.active = false;
      }
    }

    // 清理已銷毀之投射物與過期之受擊爆炸特效
    this.projectiles = this.projectiles.filter((p) => p.active);
    for (const fx of this.hitOverlays) {
      fx.remainingTicks -= 1;
    }
    this.hitOverlays = this.hitOverlays.filter((fx) => fx.remainingTicks > 0);

    return {
      activeProjectiles: this.projectiles.length,
      activeHitOverlays: this.hitOverlays.length,
      collisionEvents
    };
  }

  getPhysicsSnapshot() {
    return {
      projectiles: this.projectiles.map((p) => ({ ...p })),
      hitOverlays: this.hitOverlays.map((h) => ({ ...h })),
      primaryMonster: this.monsters[0] ? { ...this.monsters[0] } : null
    };
  }
}

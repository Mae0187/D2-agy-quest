// =======================================================================
// Diablo II 高階通用技能模板 (Advanced Skill Templates)
// 支援：環形波 (Nova/FrostNova)、天降暴風雪 (Blizzard)、冰封球 (FrozenOrb)、
// 充能彈 (ChargedBolt)、連鎖閃電 (ChainLightning)、雷暴 (ThunderStorm)
// =======================================================================

import { SkillManifestData, TargetDummy, ManifestLayer } from './types';
import { DirectionResolver } from './direction_resolver';

// ── 1. 環形波模板 (Radial Wave: Frost Nova 44, Nova 48) ──
export interface ActiveRadialSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: number;
  life: number;
  maxLife: number;
  animFrame: number;
  animTimer: number;
  skillId: string;
  category: string;
  atlasFile: string;
  cellW: number;
  cellH: number;
  pivotX: number;
  pivotY: number;
  frames: number;
}

export class RadialWaveTemplate {
  public static emit(
    manifest: SkillManifestData,
    cx: number,
    cy: number,
    sparksList: ActiveRadialSpark[]
  ) {
    const layer = manifest.layers.find(l => l.role === 'wave_body') || manifest.layers[0];
    if (!layer) return;

    const preset = manifest.direction?.preset || 'sequential_16';
    const vel = manifest.parameters.velocity || 16;
    const maxLife = manifest.parameters.range || 14;
    // 依據 163 Wiki (nova_163.jpg) 規範：64 顆高密度連續密鋪閉合實心同心圓環，全半徑擴散期 100% 保持重疊無黑縫
    const count = 64;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      // 2:1 等軸測速度補償 (長短軸比率 0.54，貼齊 Diablo II 地面投影)
      const vx = Math.cos(angle) * vel;
      const vy = Math.sin(angle) * (vel * 0.54);
      const dir = DirectionResolver.angleToDirection16(angle, preset);

      sparksList.push({
        x: cx,
        y: cy,
        vx,
        vy,
        dir,
        life: 0,
        maxLife,
        animFrame: 0,
        animTimer: 0,
        skillId: manifest.skillId,
        category: manifest.category,
        atlasFile: layer.atlasFile,
        cellW: layer.cellW,
        cellH: layer.cellH,
        pivotX: layer.pivotX,
        pivotY: layer.pivotY,
        frames: layer.frames,
      });
    }
  }

  public static tick(
    sparks: ActiveRadialSpark[],
    dummies: TargetDummy[],
    onDamage: (d: TargetDummy, dmg: number, isCold?: boolean) => void
  ) {
    const now = performance.now();
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.life++;
      s.animTimer++;
      if (s.animTimer >= 1) {
        s.animTimer = 0;
        s.animFrame = Math.min(s.frames - 1, s.animFrame + 1);
      }

      const isCold = s.category === 'cold';
      // 命中木人 (落實 NextDelay 4 幀冷卻，防止同一次新星密鋪電弧重複觸發傷害)
      for (const d of dummies) {
        if (d.hp <= 0 || d.isDead || d.remove) continue;
        if (d.hitTime && now - d.hitTime < 200) continue;
        const dist = Math.hypot(d.x - s.x, d.y - 18 - s.y);
        if (dist <= 28) {
          onDamage(d, isCold ? 45 : 55, isCold);
        }
      }

      if (s.life >= s.maxLife) {
        sparks.splice(i, 1);
      }
    }
  }
}

// ── 2. 充能彈模板 (Erratic Wave: Charged Bolt 38) ──
// 100% 移植地牢看板成熟且正確的充能彈邏輯 (每 tick 隨機微調偏角，2.5D 等軸測地面抽搐亂跳)
export interface ActiveErraticSpark {
  x: number;
  y: number;
  angle: number;
  speed: number;
  life: number;
  maxLife: number;
  animFrame: number;
  dir: number;
  atlasFile: string;
  cellW: number;
  cellH: number;
  pivotX: number;
  pivotY: number;
  frames: number;
}

export class ErraticWaveTemplate {
  public static emit(
    manifest: SkillManifestData,
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    sparksList: ActiveErraticSpark[]
  ) {
    const layer = manifest.layers.find(l => l.role === 'projectile') || manifest.layers[0];
    if (!layer) return;

    const dx = tx - sx;
    const dy = ty - sy;
    const baseAngle = Math.atan2(dy, dx);
    const count = manifest.parameters.boltCount || 7;
    const maxLife = manifest.parameters.range || 90;
    const initPush = 16;
    const sx0 = sx + Math.cos(baseAngle) * initPush;
    const sy0 = sy + Math.sin(baseAngle) * initPush;

    for (let i = 0; i < count; i++) {
      const boltAngle = baseAngle + (i - (count - 1) / 2) * 0.18 + (Math.random() - 0.5) * 0.12;
      const sector = Math.round(((boltAngle * 180 / Math.PI + 360) % 360) / 22.5) % 16;

      sparksList.push({
        x: sx0,
        y: sy0,
        angle: boltAngle,
        speed: manifest.parameters.velocity || 9.5,
        life: 0,
        maxLife,
        animFrame: Math.floor(Math.random() * (layer.frames || 10)),
        dir: sector,
        atlasFile: layer.atlasFile,
        cellW: layer.cellW,
        cellH: layer.cellH,
        pivotX: layer.pivotX,
        pivotY: layer.pivotY,
        frames: layer.frames,
      });
    }
  }

  public static tick(
    sparks: ActiveErraticSpark[],
    dummies: TargetDummy[],
    onDamage: (d: TargetDummy, dmg: number, isCold?: boolean) => void
  ) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life++;

      // 100% 移植地牢看板成熟蛇行抽搐亂跳演算法 (每 tick 隨機微調角度)
      s.angle += (Math.random() - 0.5) * 0.5;
      s.x += Math.cos(s.angle) * s.speed;
      s.y += Math.sin(s.angle) * s.speed * 0.55; // 2.5D 等軸測地面投影比率
      s.animFrame = (s.animFrame + 1) % s.frames;
      s.dir = Math.round(((s.angle * 180 / Math.PI + 360) % 360) / 22.5) % 16;

      let hit = false;
      for (const d of dummies) {
        if (d.hp <= 0 || d.isDead || d.remove) continue;
        const dist = Math.hypot(d.x - s.x, d.y - 18 - s.y);
        if (dist <= 24) {
          hit = true;
          onDamage(d, 28, false);
          break;
        }
      }

      if (hit || s.life >= s.maxLife) {
        sparks.splice(i, 1);
      }
    }
  }
}

// ── 3. 暴風雪區域冰錐打擊模板 (Area Barrage: Blizzard 59) ──
export interface ActiveBlizzardShard {
  x: number;
  y: number;
  groundX: number;
  groundY: number;
  vx: number;
  vy: number;
  animFrame: number;
  animTimer: number;
  state: 'falling' | 'impact';
  impactFrame: number;
  maxImpactFrames: number;
  shardKind: 'pillar' | 'round';
  atlasFile: string;
  cellW: number;
  cellH: number;
  pivotX: number;
  pivotY: number;
  frames: number;
  impactAtlasFile: string;
  impactCellW: number;
  impactCellH: number;
  impactPivotX: number;
  impactPivotY: number;
  impactFrames: number;
}

export interface ActiveBlizzardStorm {
  cx: number;
  cy: number;
  life: number;
  maxLife: number;
  intervalTimer: number;
  pillarLayer: ManifestLayer;
  roundLayer: ManifestLayer;
  impactLayer1: ManifestLayer;
  impactLayer2: ManifestLayer;
  shards: ActiveBlizzardShard[];
}

export class AreaBarrageTemplate {
  public static spawn(
    manifest: SkillManifestData,
    cx: number,
    cy: number,
    stormsList: ActiveBlizzardStorm[]
  ) {
    const pillarLayer = manifest.layers.find(l => l.role === 'falling_shard_pillar') ||
                        manifest.layers.find(l => l.role === 'falling_shard') || manifest.layers[0];
    const roundLayer = manifest.layers.find(l => l.role === 'falling_shard_round') || pillarLayer;
    const impactLayer1 = manifest.layers.find(l => l.role === 'impact_burst') || manifest.layers[1] || pillarLayer;
    const impactLayer2 = manifest.layers.find(l => l.role === 'impact_burst_v2') || impactLayer1;

    stormsList.push({
      cx,
      cy,
      life: 0,
      maxLife: manifest.timing.durationTicks || 90,
      intervalTimer: 0,
      pillarLayer,
      roundLayer,
      impactLayer1,
      impactLayer2,
      shards: [],
    });
  }

  public static tick(
    storms: ActiveBlizzardStorm[],
    dummies: TargetDummy[],
    onDamage: (d: TargetDummy, dmg: number, isCold?: boolean) => void
  ) {
    for (let si = storms.length - 1; si >= 0; si--) {
      const storm = storms[si];
      storm.life++;
      storm.intervalTimer++;

      // 每 4 ticks 降下一枚暴風雪落冰 (隨機交替長冰柱與圓冰球)
      if (storm.intervalTimer >= 4 && storm.life < storm.maxLife - 10) {
        storm.intervalTimer = 0;
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 150;
        const gx = storm.cx + Math.cos(angle) * dist;
        const gy = storm.cy + Math.sin(angle) * (dist * 0.55); // 2:1 等軸測地面

        // 50% 機率巨大尖銳冰柱 (Blizzard.dcc)，50% 機率重型圓冰雹 (icestormfall)
        const isPillar = Math.random() < 0.5;
        const sLayer = (isPillar || !storm.roundLayer) ? storm.pillarLayer : storm.roundLayer;
        const impLayer = Math.random() < 0.5 ? storm.impactLayer1 : storm.impactLayer2;

        // 自高空天際斜向急墜 (恢復原先的天頂下落物理動態)
        const fallDist = 140;
        const startX = gx + 35;
        const startY = gy - fallDist;
        const fallTicks = 8;

        storm.shards.push({
          x: startX,
          y: startY,
          groundX: gx,
          groundY: gy,
          vx: (gx - startX) / fallTicks,
          vy: (gy - startY) / fallTicks,
          animFrame: 0,
          animTimer: 0,
          state: 'falling',
          impactFrame: 0,
          maxImpactFrames: impLayer.frames || 6,
          shardKind: isPillar ? 'pillar' : 'round',
          atlasFile: sLayer.atlasFile,
          cellW: sLayer.cellW,
          cellH: sLayer.cellH,
          pivotX: sLayer.pivotX,
          pivotY: sLayer.pivotY,
          frames: sLayer.frames || 8,
          impactAtlasFile: impLayer.atlasFile,
          impactCellW: impLayer.cellW,
          impactCellH: impLayer.cellH,
          impactPivotX: impLayer.pivotX,
          impactPivotY: impLayer.pivotY,
          impactFrames: impLayer.frames || 6,
        });
      }

      // 更新每根冰柱/冰球
      for (let i = storm.shards.length - 1; i >= 0; i--) {
        const sh = storm.shards[i];
        if (sh.state === 'falling') {
          sh.x += sh.vx;
          sh.y += sh.vy;
          sh.animTimer++;
          if (sh.animTimer >= 1) {
            sh.animTimer = 0;
            sh.animFrame = (sh.animFrame + 1) % sh.frames;
          }

          // 到達地面接地點觸發落地衝擊
          if (sh.y >= sh.groundY) {
            sh.state = 'impact';
            sh.x = sh.groundX;
            sh.y = sh.groundY;

            // 冰錐落地瞬間觸發範圍傷害與急凍
            for (const d of dummies) {
              if (d.hp <= 0 || d.isDead || d.remove) continue;
              const dist = Math.hypot(d.x - sh.groundX, (d.y - 18 - sh.groundY) * 1.8);
              if (dist <= 48) {
                onDamage(d, 55, true);
              }
            }
          }
        } else {
          // 落地碎冰爆炸
          sh.impactFrame++;
          if (sh.impactFrame >= sh.maxImpactFrames) {
            storm.shards.splice(i, 1);
          }
        }
      }

      if (storm.life >= storm.maxLife && storm.shards.length === 0) {
        storms.splice(si, 1);
      }
    }
  }
}

// ── 4. 冰封球主體與旋轉散射模板 (Carrier Orb: Frozen Orb 64) ──
export interface ActiveOrbBolt {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  dir: number;
  animFrame: number;
}

export interface ActiveFrozenOrb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  animFrame: number;
  sprayTimer: number;
  spinAngle: number;
  state: 'flying' | 'bursting';
  burstFrame: number;
  maxBurstFrames: number;
  orbLayer: ManifestLayer;
  boltLayer: ManifestLayer;
  burstLayer: ManifestLayer;
  bolts: ActiveOrbBolt[];
}

export class CarrierOrbTemplate {
  public static spawn(
    manifest: SkillManifestData,
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    orbsList: ActiveFrozenOrb[]
  ) {
    const orbLayer = manifest.layers.find(l => l.role === 'orb_body') || manifest.layers[0];
    const boltLayer = manifest.layers.find(l => l.role === 'spray_submissile') || manifest.layers[1] || orbLayer;
    const burstLayer = manifest.layers.find(l => l.role === 'final_burst') || manifest.layers[2] || orbLayer;

    const ang = Math.atan2(ty - sy, tx - sx);
    const speed = manifest.parameters.velocity || 9;

    orbsList.push({
      x: sx,
      y: sy,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      life: 0,
      maxLife: manifest.timing.durationTicks || 36,
      animFrame: 0,
      sprayTimer: 0,
      spinAngle: 0,
      state: 'flying',
      burstFrame: 0,
      maxBurstFrames: burstLayer.frames || 17,
      orbLayer,
      boltLayer,
      burstLayer,
      bolts: [],
    });
  }

  public static tick(
    orbs: ActiveFrozenOrb[],
    dummies: TargetDummy[],
    onDamage: (d: TargetDummy, dmg: number, isCold?: boolean) => void
  ) {
    for (let oi = orbs.length - 1; oi >= 0; oi--) {
      const orb = orbs[oi];

      if (orb.state === 'flying') {
        orb.x += orb.vx;
        orb.y += orb.vy;
        orb.life++;
        orb.animFrame = (orb.animFrame + 1) % (orb.orbLayer.frames || 16);
        orb.spinAngle += 0.45;
        orb.sprayTimer++;

        // 每 2 ticks 朝螺旋旋轉方向向外噴射 2 發冰彈
        if (orb.sprayTimer >= 2) {
          orb.sprayTimer = 0;
          for (let k = 0; k < 2; k++) {
            const sprayAng = orb.spinAngle + k * Math.PI;
            const bVx = Math.cos(sprayAng) * 14;
            const bVy = Math.sin(sprayAng) * 14;
            orb.bolts.push({
              x: orb.x,
              y: orb.y,
              vx: bVx,
              vy: bVy,
              life: 0,
              maxLife: 20,
              dir: DirectionResolver.angleToDirection16(sprayAng),
              animFrame: 0,
            });
          }
        }

        // 碰觸木人
        for (const d of dummies) {
          if (d.hp <= 0 || d.isDead || d.remove) continue;
          if (Math.hypot(d.x - orb.x, d.y - 18 - orb.y) <= 32) {
            onDamage(d, 35, true);
          }
        }

        // 到達終點引爆
        if (orb.life >= orb.maxLife) {
          orb.state = 'bursting';
          // 最終爆發釋放 16 向圓形冰彈冰環
          for (let i = 0; i < 16; i++) {
            const finalAng = (i / 16) * Math.PI * 2;
            orb.bolts.push({
              x: orb.x,
              y: orb.y,
              vx: Math.cos(finalAng) * 15,
              vy: Math.sin(finalAng) * 15,
              life: 0,
              maxLife: 22,
              dir: DirectionResolver.angleToDirection16(finalAng),
              animFrame: 0,
            });
          }
          // 核心引爆範圍重傷
          for (const d of dummies) {
            if (d.hp <= 0 || d.isDead || d.remove) continue;
            if (Math.hypot(d.x - orb.x, (d.y - 18 - orb.y) * 1.5) <= 80) {
              onDamage(d, 85, true);
            }
          }
        }
      } else {
        // 引爆動畫
        orb.burstFrame++;
      }

      // 更新已噴出的冰彈
      for (let bi = orb.bolts.length - 1; bi >= 0; bi--) {
        const b = orb.bolts[bi];
        b.x += b.vx;
        b.y += b.vy;
        b.life++;
        b.animFrame = (b.animFrame + 1) % (orb.boltLayer.frames || 6);

        let hit = false;
        for (const d of dummies) {
          if (d.hp <= 0 || d.isDead || d.remove) continue;
          if (Math.hypot(d.x - b.x, d.y - 18 - b.y) <= 22) {
            hit = true;
            onDamage(d, 28, true);
            break;
          }
        }

        if (hit || b.life >= b.maxLife) {
          orb.bolts.splice(bi, 1);
        }
      }

      if (orb.state === 'bursting' && orb.burstFrame >= orb.maxBurstFrames && orb.bolts.length === 0) {
        orbs.splice(oi, 1);
      }
    }
  }
}

// ── 5. 連鎖閃電折射模板 (Chain Lightning 53: 100% 原廠 32 方向 MPQ 圖集連線) ──
// (Obsolete Chain Lightning removed per d2-engine standard; unified into ChainedArcTemplate)

// ── 6. 雷暴天雷神罰模板 (Periodic Strike: Thunder Storm 57) ──
export interface ActiveThunderBolt {
  x: number;
  y: number;
  animFrame: number;
  maxFrames: number;
  atlasFile: string;
  cellW: number;
  cellH: number;
  pivotX: number;
  pivotY: number;
}

export interface ActiveThunderStormBuff {
  life: number;
  maxLife: number;
  strikeTimer: number;
  strikeInterval: number;
  manifest: SkillManifestData;
  auraFrame: number;
  auraTimer: number;
}

export class PeriodicStrikeTemplate {
  public static activateBuff(
    manifest: SkillManifestData,
    currentBuff: { buff: ActiveThunderStormBuff | null }
  ) {
    currentBuff.buff = {
      life: 0,
      maxLife: manifest.timing.durationTicks || 300,
      strikeTimer: 0,
      strikeInterval: manifest.parameters.strikeInterval || 26,
      manifest,
      auraFrame: 0,
      auraTimer: 0,
    };
  }

  public static tick(
    buffState: { buff: ActiveThunderStormBuff | null },
    playerX: number,
    playerY: number,
    dummies: TargetDummy[],
    boltsList: ActiveThunderBolt[],
    onDamage: (d: TargetDummy, dmg: number, isCold?: boolean) => void,
    onExplosion?: (x: number, y: number) => void
  ) {
    if (buffState.buff) {
      const b = buffState.buff;
      b.life++;
      b.strikeTimer++;

      // 原廠 19 幀電環靈氣輪播
      b.auraTimer++;
      if (b.auraTimer >= 1) {
        b.auraTimer = 0;
        b.auraFrame = (b.auraFrame + 1) % 19;
      }

      if (b.strikeTimer >= b.strikeInterval) {
        b.strikeTimer = 0;
        const strikeRange = b.manifest.parameters.strikeRange || 450;
        const pool = dummies.filter(d => d.hp > 0 && !d.isDead && !d.remove && Math.hypot(d.x - playerX, d.y - playerY) <= strikeRange);
        if (pool.length > 0) {
          pool.sort((a, c) => Math.hypot(a.x - playerX, a.y - playerY) - Math.hypot(c.x - playerX, c.y - playerY));
          const target = pool[0];

          const strikeLayer = b.manifest.layers.find(l => l.role === 'sky_strike') || b.manifest.layers[1] || b.manifest.layers[0];
          boltsList.push({
            x: target.x,
            y: target.y - 12,
            animFrame: 0,
            maxFrames: strikeLayer.frames || 8,
            atlasFile: strikeLayer.atlasFile,
            cellW: strikeLayer.cellW,
            cellH: strikeLayer.cellH,
            pivotX: strikeLayer.pivotX,
            pivotY: strikeLayer.pivotY,
          });

          onDamage(target, 85, false);
          if (onExplosion) {
            onExplosion(target.x, target.y - 12);
          }
        }
      }

      if (b.life >= b.maxLife) {
        buffState.buff = null;
      }
    }

    // 更新落下中的雷霆
    for (let i = boltsList.length - 1; i >= 0; i--) {
      const bolt = boltsList[i];
      bolt.animFrame++;
      if (bolt.animFrame >= bolt.maxFrames) {
        boltsList.splice(i, 1);
      }
    }
  }
}


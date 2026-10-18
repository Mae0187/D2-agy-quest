"use strict";
(() => {
  // verification_sandbox/v2_shared_engine/templates/direction_resolver.ts
  var ROW_ANGLES_16 = [
    [7, 0],
    // 東 (East)
    [14, 11.25],
    // 東微偏東南
    [3, 22.5],
    // 東南東
    [15, 45],
    // 東南 (South-East)
    [4, 90],
    // 南 (South)
    [8, 135],
    // 西南 (South-West)
    [0, 157.5],
    // 西南西
    [9, 170],
    // 西偏微南
    [5, 180],
    // 西 (West)
    [10, 192],
    // 西偏微北
    [1, 202.5],
    // 西北西
    [11, 225],
    // 西北 (North-West)
    [6, 270],
    // 北 (North)
    [12, 315],
    // 東北 (North-East)
    [2, 337.5],
    // 東北東
    [13, 348.75]
    // 東微偏東北
  ];
  var ROW_ANGLES_8_HYDRA = [
    [7, 0],
    // 東
    [3, 45],
    // 東南
    [4, 90],
    // 南
    [0, 135],
    // 西南
    [5, 180],
    // 西
    [1, 225],
    // 西北
    [6, 270],
    // 北
    [2, 315]
    // 東北
  ];
  var DirectionResolver = class {
    static resolve16(screenAngleDeg) {
      const a = (screenAngleDeg % 360 + 360) % 360;
      let bestRow = 7;
      let bestDiff = 999;
      for (const [r, ra] of ROW_ANGLES_16) {
        const diff = Math.abs((ra - a + 180) % 360 - 180);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestRow = r;
        }
      }
      return bestRow;
    }
    static resolve8Hydra(screenAngleDeg) {
      const a = (screenAngleDeg % 360 + 360) % 360;
      let bestRow = 7;
      let bestDiff = 999;
      for (const [r, ra] of ROW_ANGLES_8_HYDRA) {
        const diff = Math.abs((ra - a + 180) % 360 - 180);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestRow = r;
        }
      }
      return bestRow;
    }
    static resolveSequential16(screenAngleDeg) {
      const a = (screenAngleDeg % 360 + 360) % 360;
      return Math.round(a / 22.5) % 16;
    }
    static resolve(preset, screenAngleDeg) {
      if (preset === "dcc_8_hydra") return this.resolve8Hydra(screenAngleDeg);
      if (preset === "sequential_16") return this.resolveSequential16(screenAngleDeg);
      if (preset === "standard_32") return this.resolve32(screenAngleDeg);
      return this.resolve16(screenAngleDeg);
    }
    static resolve32(screenAngleDeg) {
      const headingDeg = (screenAngleDeg + 90) % 360;
      const sector = Math.round((headingDeg - 180 + 360) % 360 / (360 / 64)) % 64;
      const DIR32_TABLE = [
        4,
        16,
        16,
        8,
        8,
        17,
        17,
        0,
        0,
        18,
        18,
        9,
        9,
        19,
        19,
        5,
        5,
        20,
        20,
        10,
        10,
        21,
        21,
        1,
        1,
        22,
        22,
        11,
        11,
        23,
        23,
        6,
        6,
        24,
        24,
        12,
        12,
        25,
        25,
        2,
        2,
        26,
        26,
        13,
        13,
        27,
        27,
        7,
        7,
        28,
        28,
        14,
        14,
        29,
        29,
        3,
        3,
        30,
        30,
        15,
        15,
        31,
        31,
        4
      ];
      return DIR32_TABLE[sector];
    }
    static angleToDirection16(rad, preset) {
      const deg = (rad * 180 / Math.PI + 360) % 360;
      if (preset === "sequential_16") return this.resolveSequential16(deg);
      return this.resolve16(deg);
    }
    static angleToDirection32(rad) {
      const deg = (rad * 180 / Math.PI + 360) % 360;
      return this.resolve32(deg);
    }
  };

  // verification_sandbox/v2_shared_engine/templates/linear_missile_template.ts
  var LinearMissileTemplate = class {
    static spawn(manifest, sx, sy, tx, ty) {
      const dx = tx - sx;
      const dy = ty - sy;
      const dist = Math.hypot(dx, dy) || 1;
      const phi = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      const vel = manifest.parameters.velocity || 16;
      const range = manifest.parameters.range || 60;
      const preset = manifest.direction?.preset || "standard_16";
      return {
        skillId: manifest.skillId,
        x: sx + dx / dist * 20,
        y: sy + dy / dist * 20,
        vx: dx / dist * vel,
        vy: dy / dist * vel,
        phiDeg: phi,
        dirRow: DirectionResolver.resolve(preset, phi),
        life: 0,
        maxLife: range,
        animFrame: 0,
        animTimer: 0
      };
    }
    static tick(missiles, explosions, manifestMap, dummies, onDamage) {
      for (let i = missiles.length - 1; i >= 0; i--) {
        const m = missiles[i];
        m.x += m.vx;
        m.y += m.vy;
        m.life++;
        m.animTimer++;
        if (m.animTimer >= 2) {
          m.animTimer = 0;
          m.animFrame = (m.animFrame + 1) % 5;
        }
        const mf = manifestMap[m.skillId];
        const isCold = mf?.category === "cold";
        let hit = false;
        for (const d of dummies) {
          if (d.hp <= 0 || d.isDead || d.remove) continue;
          const dist = Math.hypot(d.x - m.x, d.y - 18 - m.y);
          const hitRadius = mf?.parameters.hitboxRadius || 26;
          if (dist <= hitRadius) {
            hit = true;
            const aoe = mf?.parameters.aoeRadius || 0;
            if (aoe > 0) {
              for (const near of dummies) {
                if (near.hp <= 0 || near.isDead || near.remove) continue;
                const dNear = Math.hypot(near.x - m.x, (near.y - 18 - m.y) * 2);
                if (dNear <= aoe) onDamage(near, 65, isCold);
              }
            } else {
              onDamage(d, 35, isCold);
            }
            const expLayer = mf?.layers.find((l) => l.role === "impact_burst");
            if (expLayer) {
              explosions.push({
                atlasFile: expLayer.atlasFile,
                x: m.x,
                y: m.y,
                animFrame: 0,
                maxFrames: expLayer.frames,
                frameTimer: 0,
                cellW: expLayer.cellW,
                cellH: expLayer.cellH,
                pivotX: expLayer.pivotX,
                pivotY: expLayer.pivotY
              });
            }
            const ejectaLayer = mf?.layers.find((l) => l.role === "impact_ejecta");
            if (ejectaLayer) {
              const numDirs = ejectaLayer.dirs || 8;
              for (let ed = 0; ed < numDirs; ed++) {
                const ang = ed / numDirs * Math.PI * 2;
                explosions.push({
                  atlasFile: ejectaLayer.atlasFile,
                  x: m.x,
                  y: m.y,
                  vx: Math.cos(ang) * 5,
                  vy: Math.sin(ang) * 2.5,
                  // 2:1 等軸測地面推進
                  dirRow: ed,
                  animFrame: 0,
                  maxFrames: ejectaLayer.frames,
                  frameTimer: 0,
                  cellW: ejectaLayer.cellW,
                  cellH: ejectaLayer.cellH,
                  pivotX: ejectaLayer.pivotX,
                  pivotY: ejectaLayer.pivotY
                });
              }
            }
            break;
          }
        }
        if (hit || m.life >= m.maxLife) {
          missiles.splice(i, 1);
        }
      }
    }
  };

  // verification_sandbox/v2_shared_engine/templates/composite_minion_template.ts
  var CompositeMinionTemplate = class {
    static spawn(manifest, x, y, customConfig) {
      const p = manifest.parameters;
      const headsCfg = customConfig?.heads || p.calibratedHeads || [
        { ox: -22, oy: -8 },
        { ox: 0, oy: 6 },
        { ox: 22, oy: -8 }
      ];
      const heads = headsCfg.map((cfg, idx) => ({
        offsetX: cfg.ox,
        offsetY: cfg.oy,
        dir: [5, 4, 3][idx] ?? 4,
        state: "idle",
        animFrame: 0,
        targetId: null,
        attackCooldown: 12 + idx * 8
      }));
      return {
        skillId: manifest.skillId,
        x,
        y,
        lifeTicks: 0,
        maxLifeTicks: manifest.timing.durationTicks || 250,
        heads
      };
    }
    static tick(minions, manifest, fireboltManifest, missiles, dummies) {
      const mouthOffsets = manifest.parameters.mouthOffsets || {};
      for (let i = minions.length - 1; i >= 0; i--) {
        const minion = minions[i];
        minion.lifeTicks++;
        for (const head of minion.heads) {
          const hx = minion.x + head.offsetX;
          const hy = minion.y + head.offsetY;
          let nearest = null;
          let minDist = manifest.parameters.targetRadius || 280;
          for (const d of dummies) {
            if (d.hp <= 0) continue;
            const dist = Math.hypot(d.x - hx, d.y - 18 - hy);
            if (dist < minDist) {
              minDist = dist;
              nearest = d;
            }
          }
          if (nearest) {
            const angle = (Math.atan2(nearest.y - 18 - hy, nearest.x - hx) * 180 / Math.PI + 360) % 360;
            head.dir = DirectionResolver.resolve8Hydra(angle);
            head.targetId = nearest.id;
            if (head.state === "idle") {
              head.attackCooldown--;
              if (head.attackCooldown <= 0) {
                head.state = "attack";
                head.animFrame = 0;
              }
            }
          } else {
            head.state = "idle";
          }
          if (head.state === "attack") {
            head.animFrame++;
            if (head.animFrame === 8 && nearest) {
              const [mxOff, myOff] = mouthOffsets[String(head.dir)] || [0, -40];
              const mx = hx + mxOff;
              const my = hy + myOff;
              const firebolt = LinearMissileTemplate.spawn(fireboltManifest, mx, my, nearest.x, nearest.y - 18);
              missiles.push(firebolt);
            }
            if (head.animFrame >= 12) {
              head.state = "idle";
              head.animFrame = 0;
              head.attackCooldown = 25 + Math.floor(Math.random() * 10);
            }
          } else {
            head.animFrame = (head.animFrame + 1) % 12;
          }
        }
        if (minion.lifeTicks >= minion.maxLifeTicks) {
          minions.splice(i, 1);
        }
      }
    }
  };

  // verification_sandbox/v2_shared_engine/templates/hazard_and_stream_templates.ts
  var ContinuousStreamTemplate = class {
    static emit(manifest, sx, sy, tx, ty, particles) {
      const dx = tx - sx;
      const dy = ty - sy;
      const baseAngle = Math.atan2(dy, dx);
      for (let i = 0; i < 2; i++) {
        const spread = baseAngle + (Math.random() - 0.5) * 0.22;
        const spd = 12 + (Math.random() - 0.5) * 2;
        particles.push({
          x: sx + Math.cos(baseAngle) * 24,
          y: sy + Math.sin(baseAngle) * 24,
          vx: Math.cos(spread) * spd,
          vy: Math.sin(spread) * spd,
          life: 0,
          maxLife: 30,
          // 30 ticks
          animFrame: 0
        });
      }
    }
    static tick(particles, dummies, onDamage, addDamageText) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        p.animFrame = Math.min(14, Math.floor(p.life / p.maxLife * 15));
        for (const d of dummies) {
          if (d.hp <= 0 || d.isDead || d.remove) continue;
          const dist = Math.hypot(d.x - p.x, (d.y - 18 - p.y) * 2);
          if (dist <= 28) {
            if (onDamage) {
              onDamage(d, 3, false);
            } else {
              if (typeof d.takeDamage === "function") {
                d.takeDamage(3);
              } else {
                d.hp = Math.max(0, d.hp - 3);
                d.hitTime = performance.now();
                if (d.hp <= 0) d.isDead = true;
              }
            }
            if (p.life % 8 === 0 && addDamageText) {
              addDamageText(d.x, d.y - 20, "-16", "#F97316");
            }
          }
        }
        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
        }
      }
    }
  };
  var GroundHazardTemplate = class {
    static spawnLine(manifest, sx, sy, tx, ty, pillars) {
      const dx = tx - sx;
      const dy = ty - sy;
      const angle = Math.atan2(dy, dx);
      const perp = angle + Math.PI / 2;
      const spacing = 38;
      const layer = manifest.layers.find((l) => l.role === "ground_fire" || l.role === "ground_hazard") || {
        atlasFile: "assets/atlases/groundfire_big.png",
        cellW: 68,
        cellH: 169,
        pivotX: 34,
        pivotY: 158,
        frames: 37
      };
      for (let i = -3; i <= 3; i++) {
        const px = tx + Math.cos(perp) * (i * spacing);
        const py = ty + Math.sin(perp) * (i * spacing * 0.5);
        pillars.push({
          atlasFile: layer.atlasFile,
          cellW: layer.cellW,
          cellH: layer.cellH,
          pivotX: layer.pivotX,
          pivotY: layer.pivotY,
          x: px,
          y: py,
          life: 0,
          maxLife: 90,
          // Missiles.txt firewall Range: 90 (3.6秒)
          animFrame: Math.floor(Math.random() * (layer.frames || 37)),
          radius: 45
          // 45px 等角判定半徑，相鄰 38px 火柱無縫咬合，形成寬闊火牆判定
        });
      }
    }
    static tick(pillars, dummies, onDamage, addDamageText) {
      for (let i = pillars.length - 1; i >= 0; i--) {
        const p = pillars[i];
        p.life++;
        p.animFrame = (p.animFrame + 1) % 37;
        for (const d of dummies) {
          if (d.hp <= 0 || d.isDead || d.remove) continue;
          const dist = Math.hypot(d.x - p.x, (d.y - p.y) * 2);
          if (dist <= p.radius) {
            if (onDamage) {
              onDamage(d, 3, false);
            } else {
              if (typeof d.takeDamage === "function") {
                d.takeDamage(3);
              } else {
                d.hp = Math.max(0, d.hp - 3);
                d.hitTime = performance.now();
                if (d.hp <= 0) d.isDead = true;
              }
            }
            if (p.life % 7 === 0 && addDamageText) {
              addDamageText(d.x, d.y - 20, "-21", "#EA580C");
            }
          }
        }
        if (p.life >= p.maxLife) {
          pillars.splice(i, 1);
        }
      }
    }
  };
  var TimedMultiStageTemplate = class {
    static call(manifest, tx, ty, calls) {
      calls.push({
        targetX: tx,
        targetY: ty,
        tick: 0,
        maxTick: 65
        // 天降階段總時長 (42 落地 + 爆炸播放完畢)
      });
    }
    static tick(calls, manifest, explosions, pillars, dummies, onDamage, addDamageText) {
      const stages = manifest.timing.stages || {};
      const impactTick = stages.impact?.triggerTick || 42;
      const aoe = stages.impact?.aoeRadius || 120;
      for (let i = calls.length - 1; i >= 0; i--) {
        const mc = calls[i];
        mc.tick++;
        if (mc.tick === impactTick) {
          for (const d of dummies) {
            if (d.hp <= 0 || d.isDead || d.remove) continue;
            const dist = Math.hypot(d.x - mc.targetX, (d.y - mc.targetY) * 2);
            if (dist <= aoe) {
              onDamage(d, 95);
            }
          }
          const expLayer = manifest.layers.find((l) => l.role === "impact_burst");
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
              pivotY: expLayer.pivotY
            });
          }
          const resLayer = manifest.layers.find((l) => l.role === "ground_fire") || {
            atlasFile: "assets/atlases/groundfire_med.png",
            cellW: 68,
            cellH: 138,
            pivotX: 34,
            pivotY: 127,
            frames: 37
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
              maxLife: 90,
              // 3.6秒持續燃燒
              animFrame: Math.floor(Math.random() * (resLayer.frames || 37)),
              radius: 40
              // 殘火判定半徑
            });
          }
        }
        if (mc.tick >= mc.maxTick) {
          calls.splice(i, 1);
        }
      }
    }
  };

  // verification_sandbox/v2_shared_engine/templates/advanced_skill_templates.ts
  var RadialWaveTemplate = class {
    static emit(manifest, cx, cy, sparksList) {
      const layer = manifest.layers.find((l) => l.role === "wave_body") || manifest.layers[0];
      if (!layer) return;
      const preset = manifest.direction?.preset || "sequential_16";
      const vel = manifest.parameters.velocity || 16;
      const maxLife = manifest.parameters.range || 14;
      const count = 64;
      for (let i = 0; i < count; i++) {
        const angle = i / count * Math.PI * 2;
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
          frames: layer.frames
        });
      }
    }
    static tick(sparks, dummies, onDamage) {
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
        const isCold = s.category === "cold";
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
  };
  var ErraticWaveTemplate = class {
    static emit(manifest, sx, sy, tx, ty, sparksList) {
      const layer = manifest.layers.find((l) => l.role === "projectile") || manifest.layers[0];
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
        const sector = Math.round((boltAngle * 180 / Math.PI + 360) % 360 / 22.5) % 16;
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
          frames: layer.frames
        });
      }
    }
    static tick(sparks, dummies, onDamage) {
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life++;
        s.angle += (Math.random() - 0.5) * 0.5;
        s.x += Math.cos(s.angle) * s.speed;
        s.y += Math.sin(s.angle) * s.speed * 0.55;
        s.animFrame = (s.animFrame + 1) % s.frames;
        s.dir = Math.round((s.angle * 180 / Math.PI + 360) % 360 / 22.5) % 16;
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
  };
  var AreaBarrageTemplate = class {
    static spawn(manifest, cx, cy, stormsList) {
      const pillarLayer = manifest.layers.find((l) => l.role === "falling_shard_pillar") || manifest.layers.find((l) => l.role === "falling_shard") || manifest.layers[0];
      const roundLayer = manifest.layers.find((l) => l.role === "falling_shard_round") || pillarLayer;
      const impactLayer1 = manifest.layers.find((l) => l.role === "impact_burst") || manifest.layers[1] || pillarLayer;
      const impactLayer2 = manifest.layers.find((l) => l.role === "impact_burst_v2") || impactLayer1;
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
        shards: []
      });
    }
    static tick(storms, dummies, onDamage) {
      for (let si = storms.length - 1; si >= 0; si--) {
        const storm = storms[si];
        storm.life++;
        storm.intervalTimer++;
        if (storm.intervalTimer >= 4 && storm.life < storm.maxLife - 10) {
          storm.intervalTimer = 0;
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * 150;
          const gx = storm.cx + Math.cos(angle) * dist;
          const gy = storm.cy + Math.sin(angle) * (dist * 0.55);
          const isPillar = Math.random() < 0.5;
          const sLayer = isPillar || !storm.roundLayer ? storm.pillarLayer : storm.roundLayer;
          const impLayer = Math.random() < 0.5 ? storm.impactLayer1 : storm.impactLayer2;
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
            state: "falling",
            impactFrame: 0,
            maxImpactFrames: impLayer.frames || 6,
            shardKind: isPillar ? "pillar" : "round",
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
            impactFrames: impLayer.frames || 6
          });
        }
        for (let i = storm.shards.length - 1; i >= 0; i--) {
          const sh = storm.shards[i];
          if (sh.state === "falling") {
            sh.x += sh.vx;
            sh.y += sh.vy;
            sh.animTimer++;
            if (sh.animTimer >= 1) {
              sh.animTimer = 0;
              sh.animFrame = (sh.animFrame + 1) % sh.frames;
            }
            if (sh.y >= sh.groundY) {
              sh.state = "impact";
              sh.x = sh.groundX;
              sh.y = sh.groundY;
              for (const d of dummies) {
                if (d.hp <= 0 || d.isDead || d.remove) continue;
                const dist = Math.hypot(d.x - sh.groundX, (d.y - 18 - sh.groundY) * 1.8);
                if (dist <= 48) {
                  onDamage(d, 55, true);
                }
              }
            }
          } else {
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
  };
  var CarrierOrbTemplate = class {
    static spawn(manifest, sx, sy, tx, ty, orbsList) {
      const orbLayer = manifest.layers.find((l) => l.role === "orb_body") || manifest.layers[0];
      const boltLayer = manifest.layers.find((l) => l.role === "spray_submissile") || manifest.layers[1] || orbLayer;
      const burstLayer = manifest.layers.find((l) => l.role === "final_burst") || manifest.layers[2] || orbLayer;
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
        state: "flying",
        burstFrame: 0,
        maxBurstFrames: burstLayer.frames || 17,
        orbLayer,
        boltLayer,
        burstLayer,
        bolts: []
      });
    }
    static tick(orbs, dummies, onDamage) {
      for (let oi = orbs.length - 1; oi >= 0; oi--) {
        const orb = orbs[oi];
        if (orb.state === "flying") {
          orb.x += orb.vx;
          orb.y += orb.vy;
          orb.life++;
          orb.animFrame = (orb.animFrame + 1) % (orb.orbLayer.frames || 16);
          orb.spinAngle += 0.45;
          orb.sprayTimer++;
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
                animFrame: 0
              });
            }
          }
          for (const d of dummies) {
            if (d.hp <= 0 || d.isDead || d.remove) continue;
            if (Math.hypot(d.x - orb.x, d.y - 18 - orb.y) <= 32) {
              onDamage(d, 35, true);
            }
          }
          if (orb.life >= orb.maxLife) {
            orb.state = "bursting";
            for (let i = 0; i < 16; i++) {
              const finalAng = i / 16 * Math.PI * 2;
              orb.bolts.push({
                x: orb.x,
                y: orb.y,
                vx: Math.cos(finalAng) * 15,
                vy: Math.sin(finalAng) * 15,
                life: 0,
                maxLife: 22,
                dir: DirectionResolver.angleToDirection16(finalAng),
                animFrame: 0
              });
            }
            for (const d of dummies) {
              if (d.hp <= 0 || d.isDead || d.remove) continue;
              if (Math.hypot(d.x - orb.x, (d.y - 18 - orb.y) * 1.5) <= 80) {
                onDamage(d, 85, true);
              }
            }
          }
        } else {
          orb.burstFrame++;
        }
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
        if (orb.state === "bursting" && orb.burstFrame >= orb.maxBurstFrames && orb.bolts.length === 0) {
          orbs.splice(oi, 1);
        }
      }
    }
  };
  var PeriodicStrikeTemplate = class {
    static activateBuff(manifest, currentBuff) {
      currentBuff.buff = {
        life: 0,
        maxLife: manifest.timing.durationTicks || 300,
        strikeTimer: 0,
        strikeInterval: manifest.parameters.strikeInterval || 26,
        manifest,
        auraFrame: 0,
        auraTimer: 0
      };
    }
    static tick(buffState, playerX, playerY, dummies, boltsList, onDamage, onExplosion) {
      if (buffState.buff) {
        const b = buffState.buff;
        b.life++;
        b.strikeTimer++;
        b.auraTimer++;
        if (b.auraTimer >= 1) {
          b.auraTimer = 0;
          b.auraFrame = (b.auraFrame + 1) % 19;
        }
        if (b.strikeTimer >= b.strikeInterval) {
          b.strikeTimer = 0;
          const strikeRange = b.manifest.parameters.strikeRange || 450;
          const pool = dummies.filter((d) => d.hp > 0 && !d.isDead && !d.remove && Math.hypot(d.x - playerX, d.y - playerY) <= strikeRange);
          if (pool.length > 0) {
            pool.sort((a, c) => Math.hypot(a.x - playerX, a.y - playerY) - Math.hypot(c.x - playerX, c.y - playerY));
            const target = pool[0];
            const strikeLayer = b.manifest.layers.find((l) => l.role === "sky_strike") || b.manifest.layers[1] || b.manifest.layers[0];
            boltsList.push({
              x: target.x,
              y: target.y - 12,
              animFrame: 0,
              maxFrames: strikeLayer.frames || 8,
              atlasFile: strikeLayer.atlasFile,
              cellW: strikeLayer.cellW,
              cellH: strikeLayer.cellH,
              pivotX: strikeLayer.pivotX,
              pivotY: strikeLayer.pivotY
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
      for (let i = boltsList.length - 1; i >= 0; i--) {
        const bolt = boltsList[i];
        bolt.animFrame++;
        if (bolt.animFrame >= bolt.maxFrames) {
          boltsList.splice(i, 1);
        }
      }
    }
  };

  // verification_sandbox/v2_shared_engine/templates/radial_nova_template.ts
  var ROW_ANGLES_162 = [
    [7, 0],
    // East
    [14, 22.5],
    // East-South-East
    [3, 45],
    // South-East
    [15, 67.5],
    // South-South-East
    [4, 90],
    // South
    [8, 112.5],
    // South-South-West
    [0, 135],
    // South-West
    [9, 157.5],
    // West-South-West
    [5, 180],
    // West
    [10, 202.5],
    // West-North-West
    [1, 225],
    // North-West
    [11, 247.5],
    // North-North-West
    [6, 270],
    // North
    [12, 292.5],
    // North-North-East
    [2, 315],
    // North-East
    [13, 337.5]
    // East-North-East
  ];
  function resolveDcc16(deg) {
    const a = (deg % 360 + 360) % 360;
    let bestRow = 7;
    let minDiff = 999;
    for (const [r, ra] of ROW_ANGLES_162) {
      const diff = Math.abs((ra - a + 180) % 360 - 180);
      if (diff < minDiff) {
        minDiff = diff;
        bestRow = r;
      }
    }
    return bestRow;
  }
  var EllipseArcLut = class {
    totalPerimeter;
    angles = [];
    dists = [];
    constructor(rx, ry, steps = 180) {
      this.angles = [0];
      this.dists = [0];
      let cum = 0, px = rx, py = 0;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps * Math.PI * 2;
        const x = rx * Math.cos(t), y = ry * Math.sin(t);
        cum += Math.hypot(x - px, y - py);
        this.angles.push(t);
        this.dists.push(cum);
        px = x;
        py = y;
      }
      this.totalPerimeter = cum;
    }
    getThetaAt(dist) {
      const d = dist % this.totalPerimeter;
      let low = 0, high = this.dists.length - 1;
      while (low <= high) {
        const mid = low + high >> 1;
        if (this.dists[mid] < d) low = mid + 1;
        else high = mid - 1;
      }
      const idx = Math.max(1, low);
      const d0 = this.dists[idx - 1], d1 = this.dists[idx];
      const t0 = this.angles[idx - 1], t1 = this.angles[idx];
      const frac = d1 > d0 ? (d - d0) / (d1 - d0) : 0;
      return t0 + (t1 - t0) * frac;
    }
  };
  var RadialNovaTemplate = class _RadialNovaTemplate {
    static emit(manifest, originX, originY, pool) {
      _RadialNovaTemplate.spawn(manifest, originX, originY, pool);
    }
    static spawn(manifest, originX, originY, pool) {
      const layer = manifest.layers.find((l) => l.role === "wave_body") || manifest.layers[0];
      const p = manifest.parameters;
      const t = manifest.timing;
      const ring = {
        id: `nova_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        skillId: manifest.skillId,
        category: manifest.category,
        centerX: originX,
        centerY: originY,
        currentRadius: 15,
        maxRadius: p.maxRadius || 312,
        speed: p.velocity || 24,
        life: 0,
        maxLife: t.durationTicks || 13,
        animFrame: 0,
        frames: layer.frames || 13,
        cellW: layer.cellW,
        cellH: layer.cellH,
        pivotX: layer.pivotX,
        pivotY: layer.pivotY,
        atlasFile: layer.atlasFile,
        hitDummies: /* @__PURE__ */ new Set()
      };
      pool.push(ring);
    }
    static tick(rings, dummies, onDamage) {
      const ISO_Y = 0.485;
      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i];
        ring.life++;
        ring.currentRadius += ring.speed;
        ring.animFrame = Math.floor(ring.life * ring.frames / ring.maxLife) % ring.frames;
        const isCold = ring.category === "cold" || ring.skillId === "44";
        const dmg = isCold ? 48 : 62;
        for (const d of dummies) {
          if (d.hp <= 0 || d.isDead || d.remove || ring.hitDummies.has(String(d.id))) continue;
          const dx = d.x - ring.centerX;
          const dy = (d.y - 18 - ring.centerY) / ISO_Y;
          const dist = Math.hypot(dx, dy);
          if (Math.abs(dist - ring.currentRadius) <= 32) {
            ring.hitDummies.add(String(d.id));
            onDamage(d, dmg, isCold);
          }
        }
        if (ring.life >= ring.maxLife || ring.currentRadius >= ring.maxRadius) {
          rings.splice(i, 1);
        }
      }
    }
    static render(ctx, rings, loadedImages) {
      if (rings.length === 0) return;
      const ISO_Y = 0.54;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const ring of rings) {
        const img = loadedImages[ring.atlasFile];
        if (!img || !img.complete) continue;
        const lifeRatio = ring.life / ring.maxLife;
        const alpha = Math.max(0, Math.min(1, 1 - Math.pow(lifeRatio, 2.5)));
        const R = ring.currentRadius;
        if (R < 15) continue;
        const isCold = ring.category === "cold" || ring.skillId === "44";
        let tiers = [];
        if (isCold) {
          tiers = [{ r: R, aScale: 0.95 }, { r: R - 4, aScale: 0.85 }];
        } else {
          tiers = R >= 45 ? [{ r: R, aScale: 0.7 }, { r: R - 7.5, aScale: 0.95 }, { r: R - 15, aScale: 0.7 }] : [{ r: R, aScale: 0.95 }];
        }
        for (let ri = 0; ri < tiers.length; ri++) {
          const tier = tiers[ri];
          const curR = tier.r;
          const a = curR;
          const b = curR * ISO_Y;
          const lut = new EllipseArcLut(a, b, 180);
          ctx.globalAlpha = alpha * tier.aScale;
          const TARGET_SPACING = isCold ? 8 : 9.5;
          const numSteps = Math.max(isCold ? 12 : 20, Math.round(lut.totalPerimeter / TARGET_SPACING));
          const stepDist = lut.totalPerimeter / numSteps;
          for (let s = 0; s < numSteps; s++) {
            const theta = lut.getThetaAt(s * stepDist);
            const px = ring.centerX + a * Math.cos(theta);
            const py = ring.centerY + b * Math.sin(theta);
            const dx = Math.cos(theta);
            const dy = Math.sin(theta);
            const radialDeg = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
            const dirRow = resolveDcc16(radialDeg);
            const frame = ring.animFrame % ring.frames;
            ctx.drawImage(
              img,
              frame * ring.cellW,
              dirRow * ring.cellH,
              ring.cellW,
              ring.cellH,
              Math.round(px - ring.pivotX),
              Math.round(py - ring.pivotY),
              ring.cellW,
              ring.cellH
            );
          }
        }
      }
      ctx.restore();
    }
  };

  // verification_sandbox/v2_shared_engine/templates/chained_arc_template.ts
  var ChainedArcTemplate = class {
    static emit(manifest, sx, sy, tx, ty, dummies, arcsList, onDamage) {
      const layer = manifest.layers.find((l) => l.role === "lightning_beam") || manifest.layers[0];
      const atlasFile = layer?.atlasFile || "assets/atlases/lightningstrike.png";
      const shockAtlasFile = "assets/atlases/shockhit_sm.png";
      const cellW = layer?.cellW || 150;
      const cellH = layer?.cellH || 108;
      const pivotX = layer?.pivotX || 75;
      const pivotY = layer?.pivotY || 43;
      const frames = layer?.frames || 8;
      const maxBounces = manifest.parameters.pierce || 5;
      const jumpRadius = 320;
      const dmg = manifest.parameters.damage || 65;
      let currentTarget = null;
      let bestDist = 9999;
      for (const d of dummies) {
        if (d.hp <= 0 || d.isDead || d.remove) continue;
        const dist = Math.hypot(d.x - tx, d.y - 18 - ty);
        if (dist < bestDist && dist < jumpRadius) {
          bestDist = dist;
          currentTarget = d;
        }
      }
      const STEP_SIZE = 14;
      const visitedIds = /* @__PURE__ */ new Set();
      const segments = [];
      const targetPoints = [];
      if (!currentTarget) {
        const dx = tx - sx;
        const dy = ty - sy;
        const dist = Math.hypot(dx, dy);
        if (dist >= 10) {
          const mainDeg = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
          const mainDir32 = DirectionResolver.resolve32(mainDeg);
          const ux = dx / dist;
          const uy = dy / dist;
          const nx = -uy;
          const ny = ux;
          const startX = sx + ux * 16;
          const startY = sy + uy * 16;
          const effDist = Math.hypot(tx - startX, ty - startY);
          const steps = [];
          const startD = Math.min(36, effDist * 0.5);
          const endD = Math.max(startD, effDist - 12);
          let k = 0;
          for (let d = startD; d <= endD; d += STEP_SIZE) {
            steps.push({
              x: startX + ux * d,
              y: startY + uy * d,
              nx,
              ny,
              dir: mainDir32,
              frame: k % frames
            });
            k++;
          }
          if (steps.length === 0) {
            steps.push({
              x: (startX + tx) / 2,
              y: (startY + ty) / 2,
              nx,
              ny,
              dir: mainDir32,
              frame: 0
            });
          }
          segments.push({
            x1: sx,
            y1: sy,
            x2: tx,
            y2: ty,
            steps,
            dir: mainDir32
          });
          arcsList.push({
            id: Math.random().toString(),
            skillId: manifest.skillId,
            category: manifest.category,
            segments,
            targetPoints: [{ x: tx, y: ty }],
            life: 0,
            maxLife: 10,
            animFrame: 0,
            atlasFile,
            shockAtlasFile,
            cellW,
            cellH,
            pivotX,
            pivotY,
            frames
          });
        }
        return;
      }
      let curX = sx;
      let curY = sy;
      let bounces = 0;
      while (currentTarget && bounces < maxBounces) {
        visitedIds.add(currentTarget.id);
        const nextX = currentTarget.x;
        const nextY = currentTarget.y - 18;
        targetPoints.push({ x: nextX, y: nextY });
        const dx = nextX - curX;
        const dy = nextY - curY;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) break;
        const mainDeg = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
        const mainDir32 = DirectionResolver.resolve32(mainDeg);
        const ux = dx / dist;
        const uy = dy / dist;
        const nx = -uy;
        const ny = ux;
        const isFirstSegment = bounces === 0;
        const startX = isFirstSegment ? curX + ux * 16 : curX;
        const startY = isFirstSegment ? curY + uy * 16 : curY;
        const effDist = Math.hypot(nextX - startX, nextY - startY);
        const steps = [];
        const startD = isFirstSegment ? Math.min(36, effDist * 0.5) : Math.min(24, effDist * 0.5);
        const endD = Math.max(startD, effDist - 12);
        let k = 0;
        for (let d = startD; d <= endD; d += STEP_SIZE) {
          steps.push({
            x: startX + ux * d,
            y: startY + uy * d,
            nx,
            ny,
            dir: mainDir32,
            frame: (k * 2 + bounces * 3) % frames
          });
          k++;
        }
        if (steps.length === 0) {
          steps.push({
            x: (startX + nextX) / 2,
            y: (startY + nextY) / 2,
            nx,
            ny,
            dir: mainDir32,
            frame: 0
          });
        }
        segments.push({
          x1: curX,
          y1: curY,
          x2: nextX,
          y2: nextY,
          steps,
          dir: mainDir32
        });
        onDamage(currentTarget, dmg);
        curX = nextX;
        curY = nextY;
        bounces++;
        const unvisited = dummies.filter((d) => !visitedIds.has(d.id) && d.hp > 0 && !d.isDead && !d.remove);
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
          frames
        });
      }
    }
    static tick(arcs) {
      for (let i = arcs.length - 1; i >= 0; i--) {
        const arc = arcs[i];
        arc.life++;
        arc.animFrame++;
        if (arc.life >= arc.maxLife) {
          arcs.splice(i, 1);
        }
      }
    }
    static render(ctx, arcs, loadedImages) {
      if (arcs.length === 0) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const OFFSETS = [-1.5, 0, 1.5];
      for (const arc of arcs) {
        const beamImg = loadedImages[arc.atlasFile];
        const shockImg = loadedImages[arc.shockAtlasFile];
        if (!beamImg || !beamImg.complete) continue;
        const lifeRatio = arc.life / arc.maxLife;
        const alpha = Math.max(0, 1 - Math.pow(lifeRatio, 2));
        ctx.globalAlpha = alpha;
        for (const seg of arc.segments) {
          for (const st of seg.steps) {
            const frame = (st.frame + arc.animFrame) % arc.frames;
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
  };

  // verification_sandbox/v2_shared_engine/runtime/runtime_player.ts
  var UniversalRuntimePlayer = class {
    canvas;
    ctx;
    manifests = {};
    loadedImages = {};
    // 實體池
    missiles = [];
    explosions = [];
    minions = [];
    streams = [];
    hazards = [];
    multiStages = [];
    dummies = [];
    floatingTexts = [];
    // 高階技能實體池
    radialSparks = [];
    novaRings = [];
    erraticSparks = [];
    blizzardStorms = [];
    frozenOrbs = [];
    chainedArcs = [];
    thunderBuff = { buff: null };
    thunderBolts = [];
    isDungeonMode = false;
    playerPos = { x: 500, y: 340 };
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.initDummies();
      const coreAtlases = [
        "assets/atlases/electricnova.png",
        "assets/atlases/frost_nova.png",
        "assets/atlases/lightningstrike.png",
        "assets/atlases/shockhit_sm.png",
        "assets/atlases/meteor_indicator.png",
        "assets/skills/sorceress/MeteorTargetIndicator.png"
      ];
      for (const src of coreAtlases) {
        if (!this.loadedImages[src]) {
          const img = new Image();
          img.src = src;
          this.loadedImages[src] = img;
        }
      }
    }
    initDummies() {
      const coords = [
        [700, 200],
        [750, 380],
        [260, 420],
        [500, 220],
        [480, 450],
        [500, 180]
      ];
      this.dummies = coords.map(([x, y], idx) => ({
        id: idx + 1,
        x,
        y,
        hp: 200,
        maxHp: 200,
        hitTime: 0,
        isDead: false,
        remove: false,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.35,
        takeDamage(amount) {
          this.hp = Math.max(0, this.hp - amount);
          this.hitTime = performance.now();
          if (this.hp <= 0) this.isDead = true;
        }
      }));
    }
    registerManifest(manifest) {
      this.manifests[manifest.skillId] = manifest;
      for (const layer of manifest.layers) {
        if (!this.loadedImages[layer.atlasFile]) {
          const img = new Image();
          img.src = layer.atlasFile;
          this.loadedImages[layer.atlasFile] = img;
        }
      }
    }
    addDamageText(x, y, text, color) {
      if (!text || text === "NaN" || text.includes("NaN")) return;
      this.floatingTexts.push({ x, y, text, color, alpha: 1 });
    }
    // 施放技能 (統一分發)
    castSkill(skillId, sx, sy, tx, ty, customConfig) {
      const mf = this.manifests[skillId];
      if (!mf) return;
      switch (mf.template) {
        case "linear_missile":
          this.missiles.push(LinearMissileTemplate.spawn(mf, sx, sy, tx, ty));
          break;
        case "composite_minion":
          this.minions.push(CompositeMinionTemplate.spawn(mf, tx, ty, customConfig));
          break;
        case "continuous_stream":
          ContinuousStreamTemplate.emit(mf, sx, sy, tx, ty, this.streams);
          break;
        case "ground_hazard":
          GroundHazardTemplate.spawnLine(mf, sx, sy, tx, ty, this.hazards);
          break;
        case "timed_multistage":
          TimedMultiStageTemplate.call(mf, tx, ty, this.multiStages);
          break;
        case "radial_wave":
        case "radial_nova":
          RadialNovaTemplate.emit(mf, sx, sy, this.novaRings);
          break;
        case "erratic_wave":
          ErraticWaveTemplate.emit(mf, sx, sy, tx, ty, this.erraticSparks);
          break;
        case "area_barrage":
          AreaBarrageTemplate.spawn(mf, tx, ty, this.blizzardStorms);
          break;
        case "carrier_orb":
          CarrierOrbTemplate.spawn(mf, sx, sy, tx, ty, this.frozenOrbs);
          break;
        case "chain_lightning":
          ChainedArcTemplate.emit(
            mf,
            sx,
            sy,
            tx,
            ty,
            this.dummies,
            this.chainedArcs,
            (d, dmg) => {
              if (typeof d.takeDamage === "function") {
                d.takeDamage(dmg);
              } else {
                d.hp = Math.max(0, d.hp - dmg);
                d.hitTime = performance.now();
                if (d.hp <= 0) d.isDead = true;
              }
              this.addDamageText(d.x, d.y - 20, `-${dmg}`, "#FACC15");
            }
          );
          break;
        case "periodic_strike":
          PeriodicStrikeTemplate.activateBuff(mf, this.thunderBuff);
          this.addDamageText(sx, sy - 40, "\u26A1 \u96F7\u66B4\u8B77\u9AD4\u958B\u555F", "#FACC15");
          break;
      }
    }
    // 25Hz 物理更新 (Fixed Step)
    tick(playerPos) {
      if (playerPos) this.playerPos = playerPos;
      const onDmg = (d, dmg, isCold = false) => {
        if (typeof d.takeDamage === "function") {
          d.takeDamage(dmg);
        } else {
          d.hp = Math.max(0, d.hp - dmg);
          d.hitTime = performance.now();
          if (d.hp <= 0) {
            d.isDead = true;
          }
        }
        if (isCold) {
          d.chillUntil = performance.now() + 2500;
          if ("chilledTimer" in d) d.chilledTimer = 2500;
        }
        this.addDamageText(d.x, d.y - 20, `-${dmg}`, isCold ? "#38BDF8" : "#EF4444");
      };
      if (!this.isDungeonMode) {
        const now = performance.now();
        for (const d of this.dummies) {
          if (d.hp <= 0 || d.isDead) {
            if (now - d.hitTime > 3e3) {
              d.hp = d.maxHp;
              d.isDead = false;
              d.chillUntil = void 0;
            }
            continue;
          }
          const speedMult = d.chillUntil && d.chillUntil > now ? 0.35 : 1;
          d.x += (d.vx || 0) * speedMult;
          d.y += (d.vy || 0) * speedMult;
          if (d.x < 150 || d.x > 850) d.vx *= -1;
          if (d.y < 120 || d.y > 500) d.vy *= -1;
        }
      }
      LinearMissileTemplate.tick(this.missiles, this.explosions, this.manifests, this.dummies, onDmg);
      const fireboltMf = this.manifests["36"];
      const hydraMf = this.manifests["62"];
      if (hydraMf && fireboltMf) {
        CompositeMinionTemplate.tick(this.minions, hydraMf, fireboltMf, this.missiles, this.dummies);
      }
      ContinuousStreamTemplate.tick(this.streams, this.dummies, onDmg, (x, y, text, color) => {
        this.addDamageText(x, y, text, color || "#F97316");
      });
      GroundHazardTemplate.tick(this.hazards, this.dummies, onDmg, (x, y, text, color) => {
        this.addDamageText(x, y, text, color || "#EA580C");
      });
      const meteorMf = this.manifests["56"];
      if (meteorMf) {
        TimedMultiStageTemplate.tick(
          this.multiStages,
          meteorMf,
          this.explosions,
          this.hazards,
          this.dummies,
          onDmg,
          (x, y, text, color) => {
            this.addDamageText(x, y, text, color || "#F97316");
          }
        );
      }
      RadialWaveTemplate.tick(this.radialSparks, this.dummies, onDmg);
      RadialNovaTemplate.tick(this.novaRings, this.dummies, onDmg);
      ErraticWaveTemplate.tick(this.erraticSparks, this.dummies, onDmg);
      AreaBarrageTemplate.tick(this.blizzardStorms, this.dummies, onDmg);
      CarrierOrbTemplate.tick(this.frozenOrbs, this.dummies, onDmg);
      ChainedArcTemplate.tick(this.chainedArcs);
      PeriodicStrikeTemplate.tick(
        this.thunderBuff,
        this.playerPos.x,
        this.playerPos.y,
        this.dummies,
        this.thunderBolts,
        onDmg,
        (ex, ey) => {
          this.explosions.push({
            atlasFile: "assets/atlases/shockhit_sm.png",
            x: ex,
            y: ey,
            animFrame: 0,
            maxFrames: 20,
            frameTimer: 0,
            cellW: 63,
            cellH: 66,
            pivotX: 31,
            pivotY: 33
          });
        }
      );
      for (let i = this.explosions.length - 1; i >= 0; i--) {
        const exp = this.explosions[i];
        if (exp.vx) exp.x += exp.vx;
        if (exp.vy) exp.y += exp.vy;
        exp.frameTimer++;
        if (exp.frameTimer >= 1) {
          exp.frameTimer = 0;
          exp.animFrame++;
          if (exp.animFrame >= exp.maxFrames) {
            this.explosions.splice(i, 1);
          }
        }
      }
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.y -= 0.8;
        ft.alpha -= 0.025;
        if (ft.alpha <= 0) {
          this.floatingTexts.splice(i, 1);
        }
      }
    }
    // 畫面渲染 (純資料驅動)
    render(debug, playerPos, isDungeon = false) {
      if (playerPos) this.playerPos = playerPos;
      const ctx = this.ctx;
      const dungeonMode = isDungeon || this.isDungeonMode;
      if (!dungeonMode) {
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = "#060709";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.save();
        ctx.strokeStyle = "#1E293B";
        ctx.lineWidth = 1;
        const tileW = 80;
        const tileH = 40;
        for (let y = -tileH; y < this.canvas.height + tileH * 2; y += tileH) {
          for (let x = -tileW; x < this.canvas.width + tileW * 2; x += tileW) {
            ctx.beginPath();
            ctx.moveTo(x, y + tileH / 2);
            ctx.lineTo(x + tileW / 2, y);
            ctx.lineTo(x + tileW, y + tileH / 2);
            ctx.lineTo(x + tileW / 2, y + tileH);
            ctx.closePath();
            ctx.stroke();
          }
        }
        ctx.restore();
      }
      const targetIndicatorImg = this.loadedImages["assets/atlases/meteor_indicator.png"] || this.loadedImages["assets/skills/sorceress/MeteorTargetIndicator.png"];
      for (const ms of this.multiStages) {
        if (ms.tick < 42) {
          if (targetIndicatorImg && targetIndicatorImg.complete) {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            const tFrame = ms.tick % 17;
            const isFull106 = targetIndicatorImg.naturalHeight === 106;
            const cellH = isFull106 ? 106 : 76;
            const pivY = isFull106 ? 53 : 45;
            ctx.drawImage(
              targetIndicatorImg,
              tFrame * 114,
              0,
              114,
              cellH,
              Math.round(ms.targetX - 57),
              Math.round(ms.targetY - pivY),
              114,
              cellH
            );
            ctx.restore();
          }
        }
      }
      for (const p of this.hazards) {
        const img = this.loadedImages[p.atlasFile];
        if (img && img.complete) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.drawImage(
            img,
            p.animFrame * p.cellW,
            0,
            p.cellW,
            p.cellH,
            p.x - p.pivotX,
            p.y - p.pivotY,
            p.cellW,
            p.cellH
          );
          ctx.restore();
        }
      }
      const hydraMf = this.manifests["62"];
      const pCfg = hydraMf?.parameters;
      const customFires = window.__hydraConfig__?.fires || pCfg?.calibratedFires || [
        { fox: -11, foy: -6 },
        { fox: -10, foy: -6 },
        { fox: -8, foy: -6 }
      ];
      for (const minion of this.minions) {
        const sortedHeads = minion.heads.map((h, i) => ({ h, i })).sort((a, b) => a.h.offsetY - b.h.offsetY);
        for (const { h: head, i: headIdx } of sortedHeads) {
          const hx = minion.x + head.offsetX;
          const hy = minion.y + head.offsetY;
          const fireCfg = customFires[headIdx] || { fox: -10, foy: -6 };
          const fx = hx + fireCfg.fox;
          const fy = hy + fireCfg.foy;
          let fat = this.loadedImages["assets/atlases/hydra_groundfire.png"];
          let ff = (Math.floor(minion.lifeTicks * 16 / 25) + headIdx * 7) % 20;
          if (fat && fat.complete) {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = 0.45;
            ctx.drawImage(fat, ff * 65, 0, 65, 92, fx - 32, fy - 71, 65, 92);
            ctx.restore();
          }
          const isAtk = head.state === "attack";
          const atImg = isAtk ? this.loadedImages["assets/atlases/hydra_a1.png"] : this.loadedImages["assets/atlases/hydra_nu.png"];
          const cellW = isAtk ? 111 : 66;
          const cellH = isAtk ? 88 : 84;
          const pivX = isAtk ? 63 : 46;
          const pivY = isAtk ? 79 : 77;
          if (atImg && atImg.complete) {
            ctx.drawImage(atImg, head.animFrame % 12 * cellW, head.dir * cellH, cellW, cellH, hx - pivX, hy - pivY, cellW, cellH);
          }
          if (fat && fat.complete) {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = 0.95;
            ctx.drawImage(fat, ff * 65, 0, 65, 92, fx - 32, fy - 71, 65, 92);
            ctx.restore();
          }
        }
      }
      for (const m of this.missiles) {
        const mf = this.manifests[m.skillId];
        const pLayer = mf?.layers.find((l) => l.role === "projectile");
        if (pLayer) {
          const img = this.loadedImages[pLayer.atlasFile];
          if (img && img.complete) {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.drawImage(img, m.animFrame * pLayer.cellW, m.dirRow * pLayer.cellH, pLayer.cellW, pLayer.cellH, m.x - pLayer.pivotX, m.y - pLayer.pivotY, pLayer.cellW, pLayer.cellH);
            ctx.restore();
          }
          if (debug) {
            ctx.save();
            ctx.strokeStyle = "#38BDF8";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(m.x, m.y, 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
      for (const st of this.streams) {
        const img = this.loadedImages["assets/atlases/flamethrower_norm.png"];
        if (img && img.complete) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.drawImage(img, st.animFrame * 78, 0, 78, 78, st.x - 37, st.y - 40, 78, 78);
          ctx.restore();
        }
      }
      RadialNovaTemplate.render(ctx, this.novaRings, this.loadedImages);
      for (const sp of this.radialSparks) {
        const img = this.loadedImages[sp.atlasFile];
        if (img && img.complete) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.drawImage(img, sp.animFrame * sp.cellW, sp.dir * sp.cellH, sp.cellW, sp.cellH, Math.round(sp.x - sp.pivotX), Math.round(sp.y - sp.pivotY), sp.cellW, sp.cellH);
          ctx.restore();
        }
      }
      for (const es of this.erraticSparks) {
        const img = this.loadedImages[es.atlasFile];
        if (img && img.complete) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.drawImage(img, es.animFrame * es.cellW, es.dir * es.cellH, es.cellW, es.cellH, es.x - es.pivotX, es.y - es.pivotY, es.cellW, es.cellH);
          ctx.restore();
        }
      }
      for (const storm of this.blizzardStorms) {
        if (debug) {
          ctx.save();
          ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(storm.cx, storm.cy, 160, 90, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        for (const sh of storm.shards) {
          if (sh.state === "falling") {
            const img = this.loadedImages[sh.atlasFile];
            if (img && img.complete) {
              ctx.save();
              ctx.globalCompositeOperation = "lighter";
              ctx.drawImage(
                img,
                sh.animFrame % sh.frames * sh.cellW,
                0,
                sh.cellW,
                sh.cellH,
                sh.x - sh.pivotX,
                sh.y - sh.pivotY,
                sh.cellW,
                sh.cellH
              );
              ctx.restore();
            }
          } else {
            const img = this.loadedImages[sh.impactAtlasFile];
            if (img && img.complete) {
              ctx.save();
              ctx.globalCompositeOperation = "lighter";
              ctx.drawImage(
                img,
                sh.impactFrame * sh.impactCellW,
                0,
                sh.impactCellW,
                sh.impactCellH,
                sh.x - sh.impactPivotX,
                sh.y - sh.impactPivotY,
                sh.impactCellW,
                sh.impactCellH
              );
              ctx.restore();
            }
          }
        }
      }
      for (const orb of this.frozenOrbs) {
        if (orb.state === "flying") {
          const img = this.loadedImages[orb.orbLayer.atlasFile];
          if (img && img.complete) {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.drawImage(img, orb.animFrame * orb.orbLayer.cellW, 0, orb.orbLayer.cellW, orb.orbLayer.cellH, orb.x - orb.orbLayer.pivotX, orb.y - orb.orbLayer.pivotY, orb.orbLayer.cellW, orb.orbLayer.cellH);
            ctx.restore();
          }
        } else {
          const img = this.loadedImages[orb.burstLayer.atlasFile];
          if (img && img.complete) {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.drawImage(img, orb.burstFrame * orb.burstLayer.cellW, 0, orb.burstLayer.cellW, orb.burstLayer.cellH, orb.x - orb.burstLayer.pivotX, orb.y - orb.burstLayer.pivotY, orb.burstLayer.cellW, orb.burstLayer.cellH);
            ctx.restore();
          }
        }
        const bImg = this.loadedImages[orb.boltLayer.atlasFile];
        if (bImg && bImg.complete) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          for (const b of orb.bolts) {
            ctx.drawImage(bImg, b.animFrame * orb.boltLayer.cellW, b.dir * orb.boltLayer.cellH, orb.boltLayer.cellW, orb.boltLayer.cellH, b.x - orb.boltLayer.pivotX, b.y - orb.boltLayer.pivotY, orb.boltLayer.cellW, orb.boltLayer.cellH);
          }
          ctx.restore();
        }
      }
      ChainedArcTemplate.render(ctx, this.chainedArcs, this.loadedImages);
      for (const tb of this.thunderBolts) {
        const img = this.loadedImages[tb.atlasFile];
        if (img && img.complete) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          const stepH = 85;
          for (let py = tb.y; py >= -stepH; py -= stepH) {
            ctx.drawImage(
              img,
              tb.animFrame * tb.cellW,
              0,
              tb.cellW,
              tb.cellH,
              Math.round(tb.x - tb.pivotX),
              Math.round(py - tb.pivotY),
              tb.cellW,
              tb.cellH
            );
          }
          ctx.restore();
        }
      }
      for (const ms of this.multiStages) {
        if (ms.tick >= 25 && ms.tick < 42) {
          const progress = (ms.tick - 25) / (42 - 25);
          const startX = ms.targetX - 160;
          const startY = ms.targetY - 280;
          const curX = startX + (ms.targetX - startX) * progress;
          const curY = startY + (ms.targetY - startY) * progress;
          const fIdx = (ms.tick - 25) % 12;
          const atTail = this.loadedImages["assets/atlases/meteor_tail.png"];
          const atRock = this.loadedImages["assets/atlases/meteor.png"];
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          if (atTail && atTail.complete) ctx.drawImage(atTail, fIdx * 79, 0, 79, 128, curX - 47, curY - 83, 79, 128);
          if (atRock && atRock.complete) ctx.drawImage(atRock, fIdx * 24, 0, 24, 26, curX - 12, curY - 13, 24, 26);
          ctx.restore();
        }
      }
      for (const exp of this.explosions) {
        const img = this.loadedImages[exp.atlasFile];
        if (img && img.complete) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.drawImage(
            img,
            exp.animFrame * exp.cellW,
            (exp.dirRow || 0) * exp.cellH,
            exp.cellW,
            exp.cellH,
            exp.x - exp.pivotX,
            exp.y - exp.pivotY,
            exp.cellW,
            exp.cellH
          );
          ctx.restore();
        }
      }
      if (!dungeonMode) {
        const nowMs = performance.now();
        for (const d of this.dummies) {
          const isChilled = d.chillUntil && d.chillUntil > nowMs && d.hp > 0;
          ctx.fillStyle = d.hp <= 0 ? "rgba(75, 85, 99, 0.4)" : isChilled ? "#38BDF8" : "#E2E8F0";
          ctx.beginPath();
          ctx.ellipse(d.x, d.y, 20, 10, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = d.hp <= 0 ? "#4B5563" : isChilled ? "#0284C7" : "#CBD5E1";
          ctx.beginPath();
          ctx.arc(d.x, d.y - 18, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
          ctx.fillRect(d.x - 18, d.y - 42, 36, 5);
          ctx.fillStyle = d.hp <= 0 ? "#6B7280" : isChilled ? "#38BDF8" : "#EF4444";
          ctx.fillRect(d.x - 18, d.y - 42, d.hp / d.maxHp * 36, 5);
          if (debug && d.hp > 0) {
            ctx.strokeStyle = "#22C55E";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(d.x, d.y - 18, 26, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
      if (this.thunderBuff.buff) {
        const b = this.thunderBuff.buff;
        const auraLayer = b.manifest.layers.find((l) => l.role === "body_aura") || b.manifest.layers[0];
        const auraImg = this.loadedImages[auraLayer.atlasFile];
        if (auraImg && auraImg.complete) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.drawImage(
            auraImg,
            b.auraFrame * auraLayer.cellW,
            0,
            auraLayer.cellW,
            auraLayer.cellH,
            Math.round(playerPos.x - auraLayer.pivotX),
            Math.round(playerPos.y - auraLayer.pivotY),
            auraLayer.cellW,
            auraLayer.cellH
          );
          ctx.restore();
        }
      }
      if (!dungeonMode) {
        const sandboxChar = window.__sandboxCharacter;
        if (sandboxChar && sandboxChar.isLoaded) {
          sandboxChar.render(ctx, 1);
        } else {
          ctx.fillStyle = "rgba(234, 88, 12, 0.3)";
          ctx.beginPath();
          ctx.ellipse(playerPos.x, playerPos.y, 28, 14, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#F59E0B";
          ctx.beginPath();
          ctx.arc(playerPos.x, playerPos.y - 32, 16, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      for (const ft of this.floatingTexts) {
        if (!ft.text || ft.text === "NaN" || ft.text.includes("NaN")) continue;
        ctx.save();
        ctx.globalAlpha = ft.alpha;
        ctx.fillStyle = ft.color;
        ctx.font = "bold 15px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }
    }
  };

  // verification_sandbox/v2_shared_engine/schemas/fire_skills_manifest.json
  var fire_skills_manifest_default = {
    project: "Diablo II Sorceress Fire Skills Standard Manifests",
    version: "2.0.0",
    groundTruthCheckpoint: "checkpoint-fire-1100",
    skills: {
      "36": {
        skillId: "36",
        name: "Firebolt (\u706B\u5F48)",
        category: "fire",
        template: "linear_missile",
        timing: { stepHz: 25, tickMs: 40, durationTicks: 60, releaseFrame: 8 },
        parameters: { velocity: 18, range: 60, collideType: "unit" },
        direction: { count: 16, preset: "dcc_16_standard" },
        layers: [
          {
            layerId: "missile_body",
            role: "projectile",
            atlasFile: "assets/atlases/firebolt_norm.png",
            cellW: 118,
            cellH: 70,
            pivotX: 59,
            pivotY: 35,
            frames: 5,
            dirs: 16,
            blendMode: "lighter",
            alpha: 1
          }
        ]
      },
      "47": {
        skillId: "47",
        name: "Fireball (\u706B\u7403)",
        category: "fire",
        template: "linear_missile",
        timing: { stepHz: 25, tickMs: 40, durationTicks: 55, releaseFrame: 8 },
        parameters: { velocity: 16, range: 55, aoeRadius: 80, subMissileId: "fireball_explode" },
        direction: { count: 16, preset: "dcc_16_standard" },
        layers: [
          {
            layerId: "missile_body",
            role: "projectile",
            atlasFile: "assets/atlases/fireball_norm.png",
            cellW: 148,
            cellH: 86,
            pivotX: 74,
            pivotY: 30,
            frames: 5,
            dirs: 16,
            blendMode: "lighter",
            alpha: 1
          },
          {
            layerId: "impact_burst",
            role: "impact_burst",
            atlasFile: "assets/atlases/fireball_explode.png",
            cellW: 80,
            cellH: 72,
            pivotX: 40,
            pivotY: 36,
            frames: 12,
            dirs: 1,
            blendMode: "lighter",
            alpha: 1
          }
        ]
      },
      "41": {
        skillId: "41",
        name: "Inferno (\u5730\u7344\u4E4B\u706B)",
        category: "fire",
        template: "continuous_stream",
        timing: { stepHz: 25, tickMs: 40, durationTicks: 30, streamIntervalTicks: 2 },
        parameters: { velocity: 12, range: 30, particleLifetime: 18 },
        direction: { count: 1, preset: "omnidirectional" },
        layers: [
          {
            layerId: "stream_particle",
            role: "projectile",
            atlasFile: "assets/atlases/flamethrower_norm.png",
            cellW: 78,
            cellH: 78,
            pivotX: 37,
            pivotY: 40,
            frames: 15,
            dirs: 1,
            blendMode: "lighter",
            fadeWithLife: true
          }
        ]
      },
      "51": {
        skillId: "51",
        name: "Firewall (\u706B\u7246)",
        category: "fire",
        template: "ground_hazard",
        timing: { stepHz: 25, tickMs: 40, durationTicks: 90 },
        parameters: { pillarCount: 7, spacingPx: 24, layoutAngleDeg: 45 },
        direction: { count: 1, preset: "isometric_line" },
        layers: [
          {
            layerId: "pillar_fire",
            role: "ground_fire",
            atlasFile: "assets/atlases/groundfire_big.png",
            cellW: 68,
            cellH: 169,
            pivotX: 34,
            pivotY: 158,
            frames: 37,
            dirs: 1,
            blendMode: "lighter",
            anchor: "bottom"
          }
        ]
      },
      "56": {
        skillId: "56",
        name: "Meteor (\u9695\u77F3\u5929\u964D)",
        category: "fire",
        template: "timed_multistage",
        timing: {
          stepHz: 25,
          tickMs: 40,
          stages: {
            indicator: { startTick: 0, endTick: 42 },
            falling: { startTick: 25, endTick: 42 },
            impact: { triggerTick: 42, aoeRadius: 80 },
            residualFire: { startTick: 42, endTick: 140 }
          }
        },
        parameters: { fallingVector: { dx: 160, dy: 280 }, aoeRadius: 80 },
        layers: [
          {
            layerId: "indicator",
            role: "indicator",
            atlasFile: "assets/atlases/meteor_indicator.png",
            cellW: 114,
            cellH: 76,
            pivotX: 57,
            pivotY: 45,
            frames: 17,
            dirs: 1,
            blendMode: "lighter",
            alpha: 0.85
          },
          {
            layerId: "falling_rock",
            role: "falling_body",
            atlasFile: "assets/atlases/meteor.png",
            cellW: 24,
            cellH: 26,
            pivotX: 12,
            pivotY: 13,
            frames: 12,
            dirs: 1,
            blendMode: "lighter"
          },
          {
            layerId: "falling_tail",
            role: "falling_tail",
            atlasFile: "assets/atlases/meteor_tail.png",
            cellW: 79,
            cellH: 128,
            pivotX: 47,
            pivotY: 83,
            frames: 12,
            dirs: 1,
            blendMode: "lighter"
          },
          {
            layerId: "impact_explode",
            role: "impact_burst",
            atlasFile: "assets/atlases/meteor_explode.png",
            cellW: 210,
            cellH: 176,
            pivotX: 109,
            pivotY: 125,
            frames: 16,
            dirs: 1,
            blendMode: "lighter"
          },
          {
            layerId: "residual_fire",
            role: "ground_fire",
            atlasFile: "assets/atlases/groundfire_med.png",
            cellW: 68,
            cellH: 138,
            pivotX: 34,
            pivotY: 127,
            frames: 37,
            dirs: 1,
            blendMode: "lighter",
            anchor: "bottom"
          }
        ]
      },
      "62": {
        skillId: "62",
        name: "Hydra (\u4E5D\u982D\u6D77\u86C7)",
        category: "fire",
        template: "composite_minion",
        timing: {
          stepHz: 25,
          tickMs: 40,
          durationTicks: 250,
          fireStageTicks: { start: 25, end: 25 }
        },
        parameters: {
          headCount: 3,
          targetRadius: 280,
          mouthOffsets: {
            "0": [18, -32],
            "1": [24, -38],
            "2": [0, -42],
            "3": [-24, -38],
            "4": [-18, -32],
            "5": [-26, -26],
            "6": [0, -22],
            "7": [26, -26]
          },
          calibratedHeads: [
            { ox: -22, oy: -8 },
            { ox: 0, oy: 6 },
            { ox: 22, oy: -8 }
          ],
          calibratedFires: [
            { fox: -11, foy: -6 },
            { fox: -10, foy: -6 },
            { fox: -8, foy: -6 }
          ]
        },
        direction: { count: 8, preset: "dcc_8_hydra" },
        layers: [
          {
            layerId: "back_glow",
            role: "predraw_glow",
            preDraw: 1,
            atlasFile: "assets/atlases/hydra_groundfire.png",
            cellW: 65,
            cellH: 92,
            pivotX: 32,
            pivotY: 71,
            frames: 20,
            dirs: 1,
            blendMode: "lighter",
            alpha: 0.45
          },
          {
            layerId: "head_idle",
            role: "minion_body",
            atlasFile: "assets/atlases/hydra_nu.png",
            cellW: 66,
            cellH: 84,
            pivotX: 46,
            pivotY: 77,
            frames: 12,
            dirs: 8,
            blendMode: "normal"
          },
          {
            layerId: "head_attack",
            role: "minion_attack",
            atlasFile: "assets/atlases/hydra_a1.png",
            cellW: 111,
            cellH: 88,
            pivotX: 63,
            pivotY: 79,
            frames: 12,
            dirs: 8,
            blendMode: "normal"
          },
          {
            layerId: "foreground_flame",
            role: "predraw_flame",
            preDraw: 0,
            atlasFile: "assets/atlases/hydra_groundfire.png",
            cellW: 65,
            cellH: 92,
            pivotX: 32,
            pivotY: 71,
            frames: 20,
            dirs: 1,
            blendMode: "lighter",
            alpha: 0.95
          },
          {
            layerId: "fire_start",
            role: "predraw_flame",
            atlasFile: "assets/atlases/hydra_groundfire_start.png",
            cellW: 116,
            cellH: 101,
            pivotX: 59,
            pivotY: 61,
            frames: 16,
            dirs: 1,
            blendMode: "lighter"
          },
          {
            layerId: "fire_end",
            role: "predraw_flame",
            atlasFile: "assets/atlases/hydra_groundfire_end.png",
            cellW: 62,
            cellH: 83,
            pivotX: 30,
            pivotY: 63,
            frames: 16,
            dirs: 1,
            blendMode: "lighter"
          }
        ]
      }
    }
  };

  // verification_sandbox/v2_shared_engine/schemas/cold_skills_manifest.json
  var cold_skills_manifest_default = {
    $schema: "./skill_manifest.schema.json",
    version: "1.1.0",
    skills: {
      "39": {
        skillId: "39",
        name: "Ice Bolt",
        category: "cold",
        template: "linear_missile",
        timing: {
          stepHz: 25,
          tickMs: 40,
          durationTicks: 50
        },
        parameters: {
          velocity: 12,
          range: 50,
          hitboxRadius: 22,
          aoeRadius: 0
        },
        direction: {
          count: 16,
          preset: "standard_16"
        },
        layers: [
          {
            layerId: "projectile_main",
            role: "projectile",
            atlasFile: "assets/atlases/icebolt.png",
            cellW: 94,
            cellH: 57,
            pivotX: 47,
            pivotY: 28,
            frames: 6,
            dirs: 16,
            blendMode: "lighter"
          }
        ]
      },
      "45": {
        skillId: "45",
        name: "Ice Blast",
        category: "cold",
        template: "linear_missile",
        timing: {
          stepHz: 25,
          tickMs: 40,
          durationTicks: 50
        },
        parameters: {
          velocity: 12,
          range: 50,
          hitboxRadius: 22,
          aoeRadius: 0
        },
        direction: {
          count: 16,
          preset: "standard_16"
        },
        layers: [
          {
            layerId: "projectile_main",
            role: "projectile",
            atlasFile: "assets/atlases/iceblast.png",
            cellW: 171,
            cellH: 96,
            pivotX: 85,
            pivotY: 48,
            frames: 5,
            dirs: 16,
            blendMode: "lighter"
          },
          {
            layerId: "impact_burst",
            role: "impact_burst",
            atlasFile: "assets/atlases/freeze_explode_auth.png",
            cellW: 145,
            cellH: 142,
            pivotX: 76,
            pivotY: 116,
            frames: 15,
            dirs: 1,
            blendMode: "lighter"
          }
        ]
      },
      "44": {
        skillId: "44",
        name: "Frost Nova",
        category: "cold",
        template: "radial_nova",
        timing: {
          stepHz: 25,
          tickMs: 40,
          durationTicks: 14
        },
        parameters: {
          velocity: 16,
          range: 14,
          hitboxRadius: 28,
          maxRadius: 224
        },
        direction: {
          count: 16,
          preset: "sequential_16"
        },
        layers: [
          {
            layerId: "wave_body",
            role: "wave_body",
            atlasFile: "assets/atlases/frost_nova.png",
            cellW: 100,
            cellH: 70,
            pivotX: 50,
            pivotY: 35,
            frames: 14,
            dirs: 16,
            blendMode: "lighter"
          }
        ]
      },
      "55": {
        skillId: "55",
        name: "Glacial Spike",
        category: "cold",
        template: "linear_missile",
        timing: {
          stepHz: 25,
          tickMs: 40,
          durationTicks: 45
        },
        parameters: {
          velocity: 16,
          range: 40,
          hitboxRadius: 24,
          aoeRadius: 70
        },
        direction: {
          count: 16,
          preset: "standard_16"
        },
        layers: [
          {
            layerId: "projectile_main",
            role: "projectile",
            atlasFile: "assets/atlases/glacialspike_auth.png",
            cellW: 175,
            cellH: 108,
            pivotX: 87,
            pivotY: 49,
            frames: 6,
            dirs: 16,
            blendMode: "lighter"
          },
          {
            layerId: "impact_burst",
            role: "impact_burst",
            atlasFile: "assets/atlases/freeze_explode_auth.png",
            cellW: 145,
            cellH: 142,
            pivotX: 76,
            pivotY: 116,
            frames: 15,
            dirs: 1,
            blendMode: "lighter"
          },
          {
            layerId: "impact_ejecta",
            role: "impact_ejecta",
            atlasFile: "assets/atlases/freeze_explode_ejecta_auth.png",
            cellW: 251,
            cellH: 150,
            pivotX: 128,
            pivotY: 72,
            frames: 15,
            dirs: 8,
            blendMode: "lighter"
          }
        ]
      },
      "59": {
        skillId: "59",
        name: "Blizzard",
        category: "cold",
        template: "area_barrage",
        timing: {
          stepHz: 25,
          tickMs: 40,
          durationTicks: 90
        },
        parameters: {
          radius: 160,
          shardInterval: 5,
          hitRadius: 40
        },
        layers: [
          {
            layerId: "falling_shard_pillar",
            role: "falling_shard_pillar",
            atlasFile: "assets/atlases/blizzard_shard_main_auth.png",
            cellW: 99,
            cellH: 155,
            pivotX: 72,
            pivotY: 153,
            frames: 8,
            dirs: 1,
            blendMode: "lighter"
          },
          {
            layerId: "falling_shard_round",
            role: "falling_shard_round",
            atlasFile: "assets/atlases/blizzard_shard_v1_auth.png",
            cellW: 58,
            cellH: 200,
            pivotX: 51,
            pivotY: 186,
            frames: 6,
            dirs: 1,
            blendMode: "lighter"
          },
          {
            layerId: "impact_burst_v1",
            role: "impact_burst",
            atlasFile: "assets/atlases/blizzard_impact_v1_auth.png",
            cellW: 115,
            cellH: 89,
            pivotX: 55,
            pivotY: 80,
            frames: 6,
            dirs: 1,
            blendMode: "lighter"
          },
          {
            layerId: "impact_burst_v2",
            role: "impact_burst_v2",
            atlasFile: "assets/atlases/blizzard_impact_v2_auth.png",
            cellW: 119,
            cellH: 87,
            pivotX: 56,
            pivotY: 80,
            frames: 6,
            dirs: 1,
            blendMode: "lighter"
          }
        ]
      },
      "64": {
        skillId: "64",
        name: "Frozen Orb",
        category: "cold",
        template: "carrier_orb",
        timing: {
          stepHz: 25,
          tickMs: 40,
          durationTicks: 36
        },
        parameters: {
          velocity: 9,
          range: 36,
          sprayRate: 2,
          boltVelocity: 14,
          hitboxRadius: 26
        },
        direction: {
          count: 16,
          preset: "standard_16"
        },
        layers: [
          {
            layerId: "orb_body",
            role: "orb_body",
            atlasFile: "assets/atlases/iceorb.png",
            cellW: 56,
            cellH: 55,
            pivotX: 28,
            pivotY: 28,
            frames: 16,
            dirs: 1,
            blendMode: "lighter"
          },
          {
            layerId: "spray_bolt",
            role: "spray_submissile",
            atlasFile: "assets/atlases/icebolt.png",
            cellW: 94,
            cellH: 57,
            pivotX: 47,
            pivotY: 28,
            frames: 6,
            dirs: 16,
            blendMode: "lighter"
          },
          {
            layerId: "final_burst",
            role: "final_burst",
            atlasFile: "assets/atlases/iceorb_explode.png",
            cellW: 232,
            cellH: 193,
            pivotX: 116,
            pivotY: 96,
            frames: 17,
            dirs: 1,
            blendMode: "lighter"
          }
        ]
      }
    }
  };

  // verification_sandbox/v2_shared_engine/schemas/lightning_skills_manifest.json
  var lightning_skills_manifest_default = {
    $schema: "./skill_manifest.schema.json",
    version: "1.2.0",
    skills: {
      "38": {
        skillId: "38",
        name: "Charged Bolt",
        category: "lightning",
        template: "erratic_wave",
        timing: {
          stepHz: 25,
          tickMs: 40,
          durationTicks: 90,
          releaseFrame: 7
        },
        parameters: {
          velocity: 9.5,
          range: 90,
          boltCount: 7,
          spreadAngle: 0.58,
          hitboxRadius: 24
        },
        direction: {
          count: 16,
          preset: "sequential_16"
        },
        layers: [
          {
            layerId: "projectile_main",
            role: "projectile",
            atlasFile: "assets/atlases/chargedbolt.png",
            cellW: 87,
            cellH: 80,
            pivotX: 42,
            pivotY: 44,
            frames: 10,
            dirs: 16,
            blendMode: "lighter"
          }
        ]
      },
      "48": {
        skillId: "48",
        name: "Nova",
        category: "lightning",
        template: "radial_wave",
        timing: {
          stepHz: 25,
          tickMs: 40,
          durationTicks: 13,
          releaseFrame: 7
        },
        parameters: {
          velocity: 24,
          range: 13,
          hitboxRadius: 28,
          maxRadius: 312
        },
        direction: {
          count: 16,
          preset: "sequential_16"
        },
        layers: [
          {
            layerId: "wave_body",
            role: "wave_body",
            atlasFile: "assets/atlases/electricnova.png",
            cellW: 72,
            cellH: 50,
            pivotX: 36,
            pivotY: 26,
            frames: 13,
            dirs: 16,
            blendMode: "lighter"
          }
        ]
      },
      "53": {
        skillId: "53",
        name: "Chain Lightning",
        category: "lightning",
        template: "chain_lightning",
        timing: {
          stepHz: 25,
          tickMs: 40,
          durationTicks: 12,
          releaseFrame: 7
        },
        parameters: {
          velocity: 30,
          maxBounces: 5,
          bounceRadius: 260,
          hitboxRadius: 26
        },
        direction: {
          count: 32,
          preset: "standard_32"
        },
        layers: [
          {
            layerId: "lightning_beam",
            role: "lightning_beam",
            atlasFile: "assets/atlases/lightningstrike.png",
            cellW: 150,
            cellH: 108,
            pivotX: 75,
            pivotY: 43,
            frames: 8,
            dirs: 32,
            blendMode: "lighter"
          },
          {
            layerId: "lightning_hit",
            role: "lightning_hit",
            atlasFile: "assets/atlases/shockhit_sm.png",
            cellW: 63,
            cellH: 66,
            pivotX: 31,
            pivotY: 33,
            frames: 20,
            dirs: 1,
            blendMode: "lighter"
          }
        ]
      },
      "57": {
        skillId: "57",
        name: "Thunder Storm",
        category: "lightning",
        template: "periodic_strike",
        timing: {
          stepHz: 25,
          tickMs: 40,
          durationTicks: 300,
          releaseFrame: 7
        },
        parameters: {
          strikeInterval: 26,
          strikeRange: 450,
          hitboxRadius: 32
        },
        layers: [
          {
            layerId: "thunder_aura",
            role: "body_aura",
            atlasFile: "assets/skills/sorceress/ThunderstormCast_operate.png",
            cellW: 82,
            cellH: 60,
            pivotX: 41,
            pivotY: 22,
            frames: 19,
            dirs: 1,
            blendMode: "lighter",
            preDraw: 1
          },
          {
            layerId: "sky_strike",
            role: "sky_strike",
            atlasFile: "assets/atlases/thunderstorm.png",
            cellW: 38,
            cellH: 115,
            pivotX: 19,
            pivotY: 108,
            frames: 8,
            dirs: 1,
            blendMode: "lighter"
          },
          {
            layerId: "lightning_hit",
            role: "lightning_hit",
            atlasFile: "assets/atlases/shockhit_sm.png",
            cellW: 63,
            cellH: 66,
            pivotX: 31,
            pivotY: 33,
            frames: 20,
            dirs: 1,
            blendMode: "lighter"
          }
        ]
      }
    }
  };

  // verification_sandbox/v2_shared_engine/runtime/v2_demo.ts
  function startV2Demo() {
    const canvas = document.getElementById("demo-canvas");
    if (!canvas) return;
    const player = new UniversalRuntimePlayer(canvas);
    for (const skillKey of Object.keys(fire_skills_manifest_default.skills)) {
      player.registerManifest(fire_skills_manifest_default.skills[skillKey]);
    }
    for (const skillKey of Object.keys(cold_skills_manifest_default.skills)) {
      player.registerManifest(cold_skills_manifest_default.skills[skillKey]);
    }
    for (const skillKey of Object.keys(lightning_skills_manifest_default.skills)) {
      player.registerManifest(lightning_skills_manifest_default.skills[skillKey]);
    }
    let currentSkill = "47";
    let debug = false;
    let isMouseDown = false;
    let mousePos = { x: 500, y: 340 };
    const playerPos = { x: 500, y: 340 };
    let character = null;
    if (typeof window.CharacterController !== "undefined") {
      const isRuntimeSubdir = typeof window !== "undefined" && window.location.pathname.includes("/runtime/");
      const assetPrefix = isRuntimeSubdir ? "../../" : "";
      character = new window.CharacterController(
        `${assetPrefix}assets/characters/sorceress/manifest.json`,
        () => {
          console.log("[V2 Sandbox] CharacterController loaded: Sorceress");
          if (window.onSandboxCharacterReady) {
            window.onSandboxCharacterReady(character);
          }
        },
        "sorceress"
      );
      character.x = playerPos.x;
      character.y = playerPos.y;
      character.prevX = playerPos.x;
      character.prevY = playerPos.y;
      window.__sandboxCharacter = character;
      character.onCastSkill = (skillType, sx, sy, tx, ty, dir) => {
        let ox = sx;
        let oy = sy;
        if (currentSkill === "48" || currentSkill === "44" || currentSkill === "57") {
          ox = playerPos.x;
          oy = playerPos.y;
        }
        player.castSkill(currentSkill, ox, oy, tx, ty);
      };
    }
    let lastTime = performance.now();
    let accum = 0;
    const TICK_MS = 40;
    let inspectTickCounter = 0;
    function loop(now) {
      accum += now - lastTime;
      lastTime = now;
      while (accum >= TICK_MS) {
        if (character && character.isLoaded) {
          character.fixedTick(TICK_MS);
          if (window.__inspect16DirsActive) {
            inspectTickCounter++;
            if (inspectTickCounter >= 11) {
              inspectTickCounter = 0;
              const nextDir = (character.currentDir + 1) % 16;
              character.currentDir = nextDir;
              const rad = (90 + nextDir * 22.5) % 360 * Math.PI / 180;
              const targetX = character.x + Math.cos(rad) * 160;
              const targetY = character.y + Math.sin(rad) * 80;
              character.triggerCast(targetX, targetY, currentSkill);
              if (window.updateDirDisplay) {
                window.updateDirDisplay(nextDir);
              }
            }
          }
        }
        player.tick(playerPos);
        if (!character && isMouseDown && currentSkill === "41") {
          player.castSkill("41", playerPos.x, playerPos.y - 32, mousePos.x, mousePos.y);
        }
        accum -= TICK_MS;
      }
      player.render(debug, playerPos);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame((t) => {
      lastTime = t;
      loop(t);
    });
    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (character && character.isLoaded) {
        if (character.isChanneling) {
          character.updateChannelTarget(mousePos.x, mousePos.y);
        } else if (character.state === "idle" && !window.__inspect16DirsActive) {
          character.currentDir = character.directionController.getDirectionTowards(character.x, character.y, mousePos.x, mousePos.y, false);
          if (window.updateDirDisplay) {
            window.updateDirDisplay(character.currentDir);
          }
        }
      }
    });
    const getCastOriginY = (skillId) => {
      if (skillId === "48" || skillId === "44" || skillId === "57") {
        return playerPos.y;
      }
      return playerPos.y - 32;
    };
    canvas.addEventListener("mousedown", (e) => {
      isMouseDown = true;
      const rect = canvas.getBoundingClientRect();
      const tx = e.clientX - rect.left;
      const ty = e.clientY - rect.top;
      mousePos = { x: tx, y: ty };
      if (character && character.isLoaded) {
        character.triggerCast(tx, ty, currentSkill);
      } else {
        player.castSkill(currentSkill, playerPos.x, getCastOriginY(currentSkill), tx, ty);
      }
    });
    window.addEventListener("mouseup", () => {
      isMouseDown = false;
      if (character && character.isLoaded) {
        character.stopChanneling();
      }
    });
    window.castV2Skill = (id, tx, ty) => {
      currentSkill = id;
      if (character && character.isLoaded) {
        character.triggerCast(tx, ty, id);
      } else {
        player.castSkill(id, playerPos.x, getCastOriginY(id), tx, ty);
      }
    };
    window.setV2Skill = (id) => {
      currentSkill = id;
    };
    window.toggleV2Debug = () => {
      debug = !debug;
    };
    window.setV2Debug = (val) => {
      debug = val;
    };
    window.__v2Player = player;
    window.toggle16DirInspection = () => {
      window.__inspect16DirsActive = !window.__inspect16DirsActive;
      return window.__inspect16DirsActive;
    };
    window.setInspectDirection = (dir) => {
      if (character) {
        character.currentDir = (dir % 16 + 16) % 16;
        if (window.updateDirDisplay) {
          window.updateDirDisplay(character.currentDir);
        }
      }
    };
  }
  function createDungeonV2Adapter(canvas, director) {
    const player = new UniversalRuntimePlayer(canvas);
    player.isDungeonMode = true;
    for (const skillKey of Object.keys(fire_skills_manifest_default.skills)) {
      player.registerManifest(fire_skills_manifest_default.skills[skillKey]);
    }
    for (const skillKey of Object.keys(cold_skills_manifest_default.skills)) {
      player.registerManifest(cold_skills_manifest_default.skills[skillKey]);
    }
    for (const skillKey of Object.keys(lightning_skills_manifest_default.skills)) {
      player.registerManifest(lightning_skills_manifest_default.skills[skillKey]);
    }
    if (director && typeof director.addDamageNumber === "function") {
      player.addDamageText = (x, y, text) => {
        const amount = parseInt(text.replace("-", "")) || 0;
        if (amount > 0) director.addDamageNumber(x, y, amount);
      };
    }
    return player;
  }
  if (typeof window !== "undefined") {
    window.UniversalRuntimePlayer = UniversalRuntimePlayer;
    window.fireManifestData = fire_skills_manifest_default;
    window.coldManifestData = cold_skills_manifest_default;
    window.lightningManifestData = lightning_skills_manifest_default;
    window.createDungeonV2Adapter = createDungeonV2Adapter;
    if (document.readyState === "loading") {
      window.addEventListener("DOMContentLoaded", () => {
        if (document.getElementById("demo-canvas")) startV2Demo();
      });
    } else {
      if (document.getElementById("demo-canvas")) startV2Demo();
    }
  }
})();

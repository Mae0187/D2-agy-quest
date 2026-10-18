// =======================================================================
// Diablo II 通用輕量化網頁播放核心 (Universal Web Runtime Player)
// 純資料驅動：讀取 Manifest，透過各項通用模板進行渲染與更新，零特例代碼
// =======================================================================

import { SkillManifestData, TargetDummy } from '../templates/types';
import { LinearMissileTemplate, ActiveLinearMissile, ActiveExplosion } from '../templates/linear_missile_template';
import { CompositeMinionTemplate, ActiveCompositeMinion } from '../templates/composite_minion_template';
import {
  ContinuousStreamTemplate, ActiveStreamParticle,
  GroundHazardTemplate, ActiveGroundPillar,
  TimedMultiStageTemplate, ActiveMeteorStage
} from '../templates/hazard_and_stream_templates';
import {
  RadialWaveTemplate, ActiveRadialSpark,
  ErraticWaveTemplate, ActiveErraticSpark,
  AreaBarrageTemplate, ActiveBlizzardStorm,
  CarrierOrbTemplate, ActiveFrozenOrb,
  PeriodicStrikeTemplate, ActiveThunderStormBuff, ActiveThunderBolt
} from '../templates/advanced_skill_templates';
import { RadialNovaTemplate, ActiveNovaRing } from '../templates/radial_nova_template';
import { ChainedArcTemplate, ActiveChainedArc } from '../templates/chained_arc_template';

export class UniversalRuntimePlayer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private manifests: Record<string, SkillManifestData> = {};
  private loadedImages: Record<string, HTMLImageElement> = {};

  // 實體池
  public missiles: ActiveLinearMissile[] = [];
  public explosions: ActiveExplosion[] = [];
  public minions: ActiveCompositeMinion[] = [];
  public streams: ActiveStreamParticle[] = [];
  public hazards: ActiveGroundPillar[] = [];
  public multiStages: ActiveMeteorStage[] = [];
  public dummies: TargetDummy[] = [];
  public floatingTexts: { x: number; y: number; text: string; color: string; alpha: number }[] = [];

  // 高階技能實體池
  public radialSparks: ActiveRadialSpark[] = [];
  public novaRings: ActiveNovaRing[] = [];
  public erraticSparks: ActiveErraticSpark[] = [];
  public blizzardStorms: ActiveBlizzardStorm[] = [];
  public frozenOrbs: ActiveFrozenOrb[] = [];
  public chainedArcs: ActiveChainedArc[] = [];
  public thunderBuff: { buff: ActiveThunderStormBuff | null } = { buff: null };
  public thunderBolts: ActiveThunderBolt[] = [];
  public isDungeonMode: boolean = false;
  public playerPos: { x: number; y: number } = { x: 500, y: 340 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.initDummies();

    // 預載核心 MPQ 精靈圖
    const coreAtlases = [
      'assets/atlases/electricnova.png',
      'assets/atlases/frost_nova.png',
      'assets/atlases/lightningstrike.png',
      'assets/atlases/shockhit_sm.png',
      'assets/atlases/meteor_indicator.png',
      'assets/skills/sorceress/MeteorTargetIndicator.png'
    ];
    for (const src of coreAtlases) {
      if (!this.loadedImages[src]) {
        const img = new Image();
        img.src = src;
        this.loadedImages[src] = img;
      }
    }
  }

  private initDummies() {
    const coords = [
      [700, 200], [750, 380], [260, 420], [500, 220], [480, 450], [500, 180]
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
      takeDamage(amount: number) {
        this.hp = Math.max(0, this.hp - amount);
        this.hitTime = performance.now();
        if (this.hp <= 0) this.isDead = true;
      }
    } as any));
  }

  public registerManifest(manifest: SkillManifestData) {
    this.manifests[manifest.skillId] = manifest;
    for (const layer of manifest.layers) {
      if (!this.loadedImages[layer.atlasFile]) {
        const img = new Image();
        img.src = layer.atlasFile;
        this.loadedImages[layer.atlasFile] = img;
      }
    }
  }

  public addDamageText(x: number, y: number, text: string, color: string) {
    if (!text || text === 'NaN' || text.includes('NaN')) return;
    this.floatingTexts.push({ x, y, text, color, alpha: 1.0 });
  }

  // 施放技能 (統一分發)
  public castSkill(skillId: string, sx: number, sy: number, tx: number, ty: number, customConfig?: any) {
    const mf = this.manifests[skillId];
    if (!mf) return;

    switch (mf.template) {
      case 'linear_missile':
        this.missiles.push(LinearMissileTemplate.spawn(mf, sx, sy, tx, ty));
        break;
      case 'composite_minion':
        this.minions.push(CompositeMinionTemplate.spawn(mf, tx, ty, customConfig));
        break;
      case 'continuous_stream':
        ContinuousStreamTemplate.emit(mf, sx, sy, tx, ty, this.streams);
        break;
      case 'ground_hazard':
        GroundHazardTemplate.spawnLine(mf, sx, sy, tx, ty, this.hazards);
        break;
      case 'timed_multistage':
        TimedMultiStageTemplate.call(mf, tx, ty, this.multiStages);
        break;
      case 'radial_wave':
      case 'radial_nova':
        RadialNovaTemplate.emit(mf, sx, sy, this.novaRings);
        break;
      case 'erratic_wave':
        ErraticWaveTemplate.emit(mf, sx, sy, tx, ty, this.erraticSparks);
        break;
      case 'area_barrage':
        AreaBarrageTemplate.spawn(mf, tx, ty, this.blizzardStorms);
        break;
      case 'carrier_orb':
        CarrierOrbTemplate.spawn(mf, sx, sy, tx, ty, this.frozenOrbs);
        break;
      case 'chain_lightning':
        ChainedArcTemplate.emit(
          mf, sx, sy, tx, ty, this.dummies, this.chainedArcs,
          (d, dmg) => {
            if (typeof d.takeDamage === 'function') {
              d.takeDamage(dmg);
            } else {
              d.hp = Math.max(0, d.hp - dmg);
              d.hitTime = performance.now();
              if (d.hp <= 0) d.isDead = true;
            }
            this.addDamageText(d.x, d.y - 20, `-${dmg}`, '#FACC15');
          }
        );
        break;
      case 'periodic_strike':
        PeriodicStrikeTemplate.activateBuff(mf, this.thunderBuff);
        this.addDamageText(sx, sy - 40, '⚡ 雷暴護體開啟', '#FACC15');
        break;
    }
  }

  // 25Hz 物理更新 (Fixed Step)
  public tick(playerPos?: { x: number; y: number }) {
    if (playerPos) this.playerPos = playerPos;
    const onDmg = (d: TargetDummy, dmg: number, isCold: boolean = false) => {
      if (typeof d.takeDamage === 'function') {
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
        if ('chilledTimer' in d) (d as any).chilledTimer = 2500;
      }
      this.addDamageText(d.x, d.y - 20, `-${dmg}`, isCold ? '#38BDF8' : '#EF4444');
    };

    // 木人假人移動與死亡 3 秒後自動重生 (僅在沙盒測試模式下執行，地牢模式由怪物自身狀態機管理)
    if (!this.isDungeonMode) {
      const now = performance.now();
      for (const d of this.dummies) {
        if (d.hp <= 0 || d.isDead) {
          if (now - d.hitTime > 3000) {
            d.hp = d.maxHp;
            d.isDead = false;
            d.chillUntil = undefined;
          }
          continue;
        }
        const speedMult = (d.chillUntil && d.chillUntil > now) ? 0.35 : 1.0;
        d.x += ((d as any).vx || 0) * speedMult;
        d.y += ((d as any).vy || 0) * speedMult;
        if (d.x < 150 || d.x > 850) (d as any).vx *= -1;
        if (d.y < 120 || d.y > 500) (d as any).vy *= -1;
      }
    }

    // 1. 直飛飛彈 (火彈、火球、冰彈、冰風暴、冰川之刺)
    LinearMissileTemplate.tick(this.missiles, this.explosions, this.manifests, this.dummies, onDmg);

    // 2. 複合召喚物 (九頭海蛇)
    const fireboltMf = this.manifests['36'];
    const hydraMf = this.manifests['62'];
    if (hydraMf && fireboltMf) {
      CompositeMinionTemplate.tick(this.minions, hydraMf, fireboltMf, this.missiles, this.dummies);
    }

    // 3. 連續噴流 (地獄火)
    ContinuousStreamTemplate.tick(this.streams, this.dummies, onDmg, (x, y, text, color) => {
      this.addDamageText(x, y, text, color || '#F97316');
    });

    // 4. 地表火柱 (火牆與隕石殘火)
    GroundHazardTemplate.tick(this.hazards, this.dummies, onDmg, (x, y, text, color) => {
      this.addDamageText(x, y, text, color || '#EA580C');
    });

    // 5. 隕石多階段 (天降砸轟 + 地表殘火生成)
    const meteorMf = this.manifests['56'];
    if (meteorMf) {
      TimedMultiStageTemplate.tick(
        this.multiStages,
        meteorMf,
        this.explosions,
        this.hazards,
        this.dummies,
        onDmg,
        (x, y, text, color) => {
          this.addDamageText(x, y, text, color || '#F97316');
        }
      );
    }

    // 6. 環形波 (Frost Nova 44, Nova 48 - F06)
    RadialWaveTemplate.tick(this.radialSparks, this.dummies, onDmg);
    RadialNovaTemplate.tick(this.novaRings, this.dummies, onDmg);

    // 7. 充能彈 (Charged Bolt 38)
    ErraticWaveTemplate.tick(this.erraticSparks, this.dummies, onDmg);

    // 8. 暴風雪 (Blizzard 59)
    AreaBarrageTemplate.tick(this.blizzardStorms, this.dummies, onDmg);

    // 9. 冰封球 (Frozen Orb 64)
    CarrierOrbTemplate.tick(this.frozenOrbs, this.dummies, onDmg);

    // 10. 連鎖閃電 (Chain Lightning 53 - F09)
    ChainedArcTemplate.tick(this.chainedArcs);

    // 11. 雷暴天雷 (Thunder Storm 57)
    PeriodicStrikeTemplate.tick(
      this.thunderBuff,
      this.playerPos.x, this.playerPos.y,
      this.dummies,
      this.thunderBolts,
      onDmg,
      (ex, ey) => {
        this.explosions.push({
          atlasFile: 'assets/atlases/shockhit_sm.png',
          x: ex,
          y: ey,
          animFrame: 0,
          maxFrames: 20,
          frameTimer: 0,
          cellW: 63,
          cellH: 66,
          pivotX: 31,
          pivotY: 33,
        });
      }
    );

    // 12. 爆炸動畫計時器推進與次級彈頭位移 (如冰川之刺 8 向散射碎冰)
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

    // 13. 浮動傷害字體
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
  public render(debug: boolean, playerPos: { x: number; y: number }, isDungeon: boolean = false) {
    if (playerPos) this.playerPos = playerPos;
    const ctx = this.ctx;
    const dungeonMode = isDungeon || this.isDungeonMode;

    if (!dungeonMode) {
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // 1. 2.5D 等距地牢地面網格 (2:1 Isometric Diamond Grid)
      ctx.fillStyle = '#060709';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.save();
      ctx.strokeStyle = '#1E293B';
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

    // 2. 隕石著陸落點指示圈 (採用暴雪原廠 MeteorTargetIndicator 精靈圖)
    const targetIndicatorImg = this.loadedImages['assets/atlases/meteor_indicator.png'] ||
                               this.loadedImages['assets/skills/sorceress/MeteorTargetIndicator.png'];
    for (const ms of this.multiStages) {
      if (ms.tick < 42) {
        if (targetIndicatorImg && targetIndicatorImg.complete) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const tFrame = ms.tick % 17;
          const isFull106 = targetIndicatorImg.naturalHeight === 106;
          const cellH = isFull106 ? 106 : 76;
          const pivY = isFull106 ? 53 : 45;
          ctx.drawImage(
            targetIndicatorImg,
            tFrame * 114, 0, 114, cellH,
            Math.round(ms.targetX - 57), Math.round(ms.targetY - pivY),
            114, cellH
          );
          ctx.restore();
        }
      }
    }

    // 3. 地表火柱 (Firewall 火牆 & Meteor 隕石地表殘火群)
    for (const p of this.hazards) {
      const img = this.loadedImages[p.atlasFile];
      if (img && img.complete) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(
          img,
          p.animFrame * p.cellW, 0, p.cellW, p.cellH,
          p.x - p.pivotX, p.y - p.pivotY, p.cellW, p.cellH
        );
        ctx.restore();
      }
    }

    // 4. 九頭海蛇 (嚴格三層 PreDraw 幾何立體包覆)
    const hydraMf = this.manifests['62'];
    const pCfg = hydraMf?.parameters;
    const customFires = (window as any).__hydraConfig__?.fires || pCfg?.calibratedFires || [
      { fox: -11, foy: -6 }, { fox: -10, foy: -6 }, { fox: -8, foy: -6 }
    ];

    for (const minion of this.minions) {
      const sortedHeads = minion.heads.map((h, i) => ({ h, i })).sort((a, b) => a.h.offsetY - b.h.offsetY);

      for (const { h: head, i: headIdx } of sortedHeads) {
        const hx = minion.x + head.offsetX;
        const hy = minion.y + head.offsetY;
        const fireCfg = customFires[headIdx] || { fox: -10, foy: -6 };
        const fx = hx + fireCfg.fox;
        const fy = hy + fireCfg.foy;

        let fat = this.loadedImages['assets/atlases/hydra_groundfire.png'];
        let ff = (Math.floor(minion.lifeTicks * 16 / 25) + headIdx * 7) % 20;

        // 4.1 背後地表火光襯底
        if (fat && fat.complete) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.45;
          ctx.drawImage(fat, ff * 65, 0, 65, 92, fx - 32, fy - 71, 65, 92);
          ctx.restore();
        }

        // 4.2 蛇身本體實體
        const isAtk = head.state === 'attack';
        const atImg = isAtk ? this.loadedImages['assets/atlases/hydra_a1.png'] : this.loadedImages['assets/atlases/hydra_nu.png'];
        const cellW = isAtk ? 111 : 66;
        const cellH = isAtk ? 88 : 84;
        const pivX = isAtk ? 63 : 46;
        const pivY = isAtk ? 79 : 77;

        if (atImg && atImg.complete) {
          ctx.drawImage(atImg, (head.animFrame % 12) * cellW, head.dir * cellH, cellW, cellH, hx - pivX, hy - pivY, cellW, cellH);
        }

        // 4.3 前景竄升烈火
        if (fat && fat.complete) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.95;
          ctx.drawImage(fat, ff * 65, 0, 65, 92, fx - 32, fy - 71, 65, 92);
          ctx.restore();
        }
      }
    }

    // 5. 直飛飛彈 (火彈、火球、冰彈、冰風暴、冰川之刺)
    for (const m of this.missiles) {
      const mf = this.manifests[m.skillId];
      const pLayer = mf?.layers.find(l => l.role === 'projectile');
      if (pLayer) {
        const img = this.loadedImages[pLayer.atlasFile];
        if (img && img.complete) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(img, m.animFrame * pLayer.cellW, m.dirRow * pLayer.cellH, pLayer.cellW, pLayer.cellH, m.x - pLayer.pivotX, m.y - pLayer.pivotY, pLayer.cellW, pLayer.cellH);
          ctx.restore();
        }
        if (debug) {
          ctx.save();
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(m.x, m.y, 5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // 6. 地獄火噴流
    for (const st of this.streams) {
      const img = this.loadedImages['assets/atlases/flamethrower_norm.png'];
      if (img && img.complete) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(img, st.animFrame * 78, 0, 78, 78, st.x - 37, st.y - 40, 78, 78);
        ctx.restore();
      }
    }

    // 7. 環形波 (Frost Nova 44 & Nova 48 - F06)
    RadialNovaTemplate.render(ctx, this.novaRings, this.loadedImages);
    for (const sp of this.radialSparks) {
      const img = this.loadedImages[sp.atlasFile];
      if (img && img.complete) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(img, sp.animFrame * sp.cellW, sp.dir * sp.cellH, sp.cellW, sp.cellH, Math.round(sp.x - sp.pivotX), Math.round(sp.y - sp.pivotY), sp.cellW, sp.cellH);
        ctx.restore();
      }
    }

    // 8. 充能彈 (Charged Bolt 38)
    for (const es of this.erraticSparks) {
      const img = this.loadedImages[es.atlasFile];
      if (img && img.complete) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(img, es.animFrame * es.cellW, es.dir * es.cellH, es.cellW, es.cellH, es.x - es.pivotX, es.y - es.pivotY, es.cellW, es.cellH);
        ctx.restore();
      }
    }

    // 9. 暴風雪 (Blizzard 59)
    for (const storm of this.blizzardStorms) {
      if (debug) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(storm.cx, storm.cy, 160, 90, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      for (const sh of storm.shards) {
        if (sh.state === 'falling') {
          const img = this.loadedImages[sh.atlasFile];
          if (img && img.complete) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.drawImage(
              img,
              (sh.animFrame % sh.frames) * sh.cellW, 0,
              sh.cellW, sh.cellH,
              sh.x - sh.pivotX, sh.y - sh.pivotY,
              sh.cellW, sh.cellH
            );
            ctx.restore();
          }
        } else {
          const img = this.loadedImages[sh.impactAtlasFile];
          if (img && img.complete) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.drawImage(
              img,
              sh.impactFrame * sh.impactCellW, 0,
              sh.impactCellW, sh.impactCellH,
              sh.x - sh.impactPivotX, sh.y - sh.impactPivotY,
              sh.impactCellW, sh.impactCellH
            );
            ctx.restore();
          }
        }
      }
    }

    // 10. 冰封球 (Frozen Orb 64)
    for (const orb of this.frozenOrbs) {
      if (orb.state === 'flying') {
        const img = this.loadedImages[orb.orbLayer.atlasFile];
        if (img && img.complete) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(img, orb.animFrame * orb.orbLayer.cellW, 0, orb.orbLayer.cellW, orb.orbLayer.cellH, orb.x - orb.orbLayer.pivotX, orb.y - orb.orbLayer.pivotY, orb.orbLayer.cellW, orb.orbLayer.cellH);
          ctx.restore();
        }
      } else {
        const img = this.loadedImages[orb.burstLayer.atlasFile];
        if (img && img.complete) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(img, orb.burstFrame * orb.burstLayer.cellW, 0, orb.burstLayer.cellW, orb.burstLayer.cellH, orb.x - orb.burstLayer.pivotX, orb.y - orb.burstLayer.pivotY, orb.burstLayer.cellW, orb.burstLayer.cellH);
          ctx.restore();
        }
      }
      // 繪製冰封球散射出的小冰彈
      const bImg = this.loadedImages[orb.boltLayer.atlasFile];
      if (bImg && bImg.complete) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const b of orb.bolts) {
          ctx.drawImage(bImg, b.animFrame * orb.boltLayer.cellW, b.dir * orb.boltLayer.cellH, orb.boltLayer.cellW, orb.boltLayer.cellH, b.x - orb.boltLayer.pivotX, b.y - orb.boltLayer.pivotY, orb.boltLayer.cellW, orb.boltLayer.cellH);
        }
        ctx.restore();
      }
    }

    // 10. 連鎖電弧 (Chain Lightning 53 - F09 依據 d2-engine 重組之純 MPQ 精靈圖高壓光纜)
    ChainedArcTemplate.render(ctx, this.chainedArcs, this.loadedImages);

    // 12. 雷暴天雷 (Thunder Storm 57 - 天頂垂直直劈直貫落雷，對齊 thunderstorm2.jpg)
    for (const tb of this.thunderBolts) {
      const img = this.loadedImages[tb.atlasFile];
      if (img && img.complete) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // 從畫面天頂 (y <= 0) 一路向下垂直平鋪原廠雷柱直到接地點，形成通天天罰巨柱
        const stepH = 85;
        for (let py = tb.y; py >= -stepH; py -= stepH) {
          ctx.drawImage(
            img,
            tb.animFrame * tb.cellW, 0,
            tb.cellW, tb.cellH,
            Math.round(tb.x - tb.pivotX),
            Math.round(py - tb.pivotY),
            tb.cellW, tb.cellH
          );
        }
        ctx.restore();
      }
    }

    // 13. 隕石下墜實體與拖尾
    for (const ms of this.multiStages) {
      if (ms.tick >= 25 && ms.tick < 42) {
        const progress = (ms.tick - 25) / (42 - 25);
        const startX = ms.targetX - 160;
        const startY = ms.targetY - 280;
        const curX = startX + (ms.targetX - startX) * progress;
        const curY = startY + (ms.targetY - startY) * progress;
        const fIdx = (ms.tick - 25) % 12;

        const atTail = this.loadedImages['assets/atlases/meteor_tail.png'];
        const atRock = this.loadedImages['assets/atlases/meteor.png'];

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        if (atTail && atTail.complete) ctx.drawImage(atTail, fIdx * 79, 0, 79, 128, curX - 47, curY - 83, 79, 128);
        if (atRock && atRock.complete) ctx.drawImage(atRock, fIdx * 24, 0, 24, 26, curX - 12, curY - 13, 24, 26);
        ctx.restore();
      }
    }

    // 14. 爆炸動畫
    for (const exp of this.explosions) {
      const img = this.loadedImages[exp.atlasFile];
      if (img && img.complete) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
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

    // 15. 木人假人 (僅在獨立沙盒模式下繪製)
    if (!dungeonMode) {
      const nowMs = performance.now();
      for (const d of this.dummies) {
        const isChilled = d.chillUntil && d.chillUntil > nowMs && d.hp > 0;
        ctx.fillStyle = d.hp <= 0 ? 'rgba(75, 85, 99, 0.4)' : (isChilled ? '#38BDF8' : '#E2E8F0');
        ctx.beginPath(); ctx.ellipse(d.x, d.y, 20, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = d.hp <= 0 ? '#4B5563' : (isChilled ? '#0284C7' : '#CBD5E1');
        ctx.beginPath(); ctx.arc(d.x, d.y - 18, 14, 0, Math.PI * 2); ctx.fill();

        // 血條
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(d.x - 18, d.y - 42, 36, 5);
        ctx.fillStyle = d.hp <= 0 ? '#6B7280' : (isChilled ? '#38BDF8' : '#EF4444'); ctx.fillRect(d.x - 18, d.y - 42, (d.hp / d.maxHp) * 36, 5);

        if (debug && d.hp > 0) {
          ctx.strokeStyle = '#22C55E';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(d.x, d.y - 18, 26, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // 16. 雷暴護體腳下地面電光靈氣 (Thunder Storm 57 啟動中：依 Overlay.txt PreDraw: 1 規範先於英雄繪製在腳底地面)
    if (this.thunderBuff.buff) {
      const b = this.thunderBuff.buff;
      const auraLayer = b.manifest.layers.find(l => l.role === 'body_aura') || b.manifest.layers[0];
      const auraImg = this.loadedImages[auraLayer.atlasFile];

      if (auraImg && auraImg.complete) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // 腳底旋轉電環 (完美鎖定角色接地腳底 (0, 0)，原廠 19 幀原地平滑旋轉)
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

    // 17. 施法者英雄 (優先使用真實 CharacterController 渲染，無則回退至幾何佔位)
    if (!dungeonMode) {
      const sandboxChar = (window as any).__sandboxCharacter;
      if (sandboxChar && sandboxChar.isLoaded) {
        sandboxChar.render(ctx, 1.0);
      } else {
        ctx.fillStyle = 'rgba(234, 88, 12, 0.3)';
        ctx.beginPath(); ctx.ellipse(playerPos.x, playerPos.y, 28, 14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath(); ctx.arc(playerPos.x, playerPos.y - 32, 16, 0, Math.PI * 2); ctx.fill();
      }
    }

    // 17. 浮動傷害
    for (const ft of this.floatingTexts) {
      if (!ft.text || ft.text === 'NaN' || ft.text.includes('NaN')) continue;
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 15px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }
}

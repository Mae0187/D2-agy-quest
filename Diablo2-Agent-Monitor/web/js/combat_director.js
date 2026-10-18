/**
 * Diablo II Combat Director & Mode A Battle Engine (Phase 3)
 * 負責事件平滑佇列、技能四階段時間軸裝配、怪群生成、Boss 戰調度與全怪獸/首領技能施放系統
 * 嚴格遵守 AGENT.md 規範：零手繪幾何、100% 正統 DCC 萃取素材
 */

class MonsterEntity {
    constructor(type, x, y, manifest, director = null) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.director = director;
        this.id = Math.floor(Math.random() * 10000000);
        const mPool = (manifest && Object.keys(manifest).length > 0) ? manifest : (window.D2_MONSTERS_MANIFEST || {});
        this.manifest = mPool[type] || mPool['fallen'] || { max_hp: 30, actions: {} };
        this.hp = this.manifest.max_hp || 30;
        this.maxHp = this.manifest.max_hp || 30;
        this.state = 'idle'; // 'idle', 'walk', 'attack', 'cast', 'hit', 'death'
        this.direction = Math.floor(Math.random() * 8);
        this.currentFrame = 0;
        this.frameTime = 0;
        this.isDead = false;
        this.remove = false;
        this.hasAttacked = false;
        this.deathTimerSet = false;
        this.hovered = false;

        // 技能施法計時器 (隨機初值防止全部怪物同時施法)
        this.skillTimer = 1000 + Math.random() * 2500;
        this.isCharging = false;
        this.chargeSpeed = 0.22;
        this.pendingCast = null;

        // 碰撞面積與點擊幾何參數 (依 25 款怪物體型精準適配)
        this.collisionRadius = 18;
        this.clickRadius = 26;
        this.clickHeight = 75;

        if (this.type === 'baal' || this.type === 'diablo') {
            this.collisionRadius = 45;
            this.clickRadius = 55;
            this.clickHeight = 150;
        } else if (this.type === 'andariel' || this.type === 'mephisto' || this.type === 'duriel') {
            this.collisionRadius = 38;
            this.clickRadius = 48;
            this.clickHeight = 135;
        } else if (this.type === 'blood_lord' || this.type === 'baal_minion' || this.type === 'sand_maggot' || this.type === 'council' || this.type === 'balrog' || this.type === 'blunderbore') {
            this.collisionRadius = 30;
            this.clickRadius = 40;
            this.clickHeight = 115;
        } else if (this.type === 'doom_knight' || this.type === 'succubus' || this.type === 'mummy' || this.type === 'zombie' || this.type === 'frog_demon' || this.type === 'goatman' || this.type === 'fallen_shaman') {
            this.collisionRadius = 22;
            this.clickRadius = 30;
            this.clickHeight = 90;
        } else if (this.type === 'fetish' || this.type === 'fetish_shaman') {
            this.collisionRadius = 14;
            this.clickRadius = 20;
            this.clickHeight = 50;
        }

        // 載入該怪物全部動作精靈圖
        this.sheets = {};
        for (const [actionName, actionData] of Object.entries(this.manifest.actions)) {
            const img = new Image();
            img.onerror = () => {
                setTimeout(() => {
                    if (img.naturalWidth === 0) {
                        img.src = actionData.file;
                    }
                }, 400);
            };
            img.src = actionData.file;
            this.sheets[actionName] = {
                img: img,
                data: actionData
            };
        }
    }

    setState(newState) {
        if (this.isDead && newState !== 'death') return;
        if (this.state === newState) return;
        if (newState !== 'cast') {
            this.pendingCast = null;
        }
        // 若該怪物無 cast 動作，降級為 attack
        if (newState === 'cast' && !this.sheets['cast']) {
            newState = 'attack';
        }
        if (!this.sheets[newState]) return;
        this.state = newState;
        this.currentFrame = 0;
        this.frameTime = 0;
        this.hasAttacked = false;
    }

    containsPoint(px, py) {
        if (this.isDead || this.remove) return false;
        const dx = Math.abs(px - this.x);
        const dy = py - this.y;
        return (dx <= this.clickRadius && dy >= -this.clickHeight && dy <= 14);
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.hp -= amount;

        // 浮動傷害數字
        if (this.director && this.director.addDamageNumber) {
            this.director.addDamageNumber(this.x + (Math.random() - 0.5) * 15, this.y - this.clickHeight * 0.7, Math.round(amount), false);
        }

        // 死亡聖甲蟲 (Beetle) 受擊觸發正統充能彈 (Charged Bolt) 反擊！
        if (this.type === 'beetle' && this.director) {
            this.director.spawnChargedBolts(this.x, this.y, 4);
        }

        if (this.hp <= 0) {
            this.hp = 0;
            this.setState('death');
            this.isDead = true;
            this.deathTimerSet = false;
        } else {
            if (this.state !== 'cast' && this.state !== 'attack') {
                this.setState('hit');
            }
        }
    }

    tryCastSkill(targetX, targetY, dist) {
        if (!this.director) return;
        const roll = Math.random();

        // 1. 安達利爾 (Andariel) — 嘶吼毒刺展開蓄力 -> 腳底 360 度劇毒新星
        if (this.type === 'andariel') {
            this.skillTimer = 3800 + Math.random() * 1500;
            this.setState('cast');
            this.pendingCast = { type: 'poison_nova', triggerFrame: 7, dmg: 25, executed: false };
            return;
        }

        // 2. 督瑞爾 (Duriel) — 猛烈衝撞 / 重擊 (Charge / Cleave)
        if (this.type === 'duriel') {
            this.skillTimer = 4000 + Math.random() * 2000;
            if (dist > 90 && dist < 320) {
                this.isCharging = true;
                this.setState('cast');
            } else {
                this.setState('cast');
            }
            return;
        }

        // 3. 墨菲斯托 (Mephisto) — 懸浮雙爪高舉聚能 -> 閃電 / 冰霜新星 / 充能彈
        if (this.type === 'mephisto') {
            this.skillTimer = 3000 + Math.random() * 1400;
            this.setState('cast');
            if (roll < 0.35) {
                this.pendingCast = { type: 'frost_nova', triggerFrame: 6, dmg: 26, executed: false };
            } else if (roll < 0.70) {
                this.pendingCast = { type: 'charged_bolt', targetX, targetY, triggerFrame: 6, count: 5, executed: false };
            } else {
                this.pendingCast = { type: 'lightning', targetX, targetY, triggerFrame: 6, dmg: 26, executed: false };
            }
            return;
        }

        // 4. 暗黑破壞神 (Diablo) — 伸手動作蓄力 -> 射出紅色閃電！或雙臂召喚烈焰地獄火環！
        if (this.type === 'diablo') {
            this.skillTimer = 3500 + Math.random() * 1500;
            this.setState('cast');
            if (roll < 0.65) {
                // 伸手之後再射出紅色閃電 (S2 動作第 6 幀伸手完全時爆發射線)
                this.pendingCast = { type: 'diablo_lightning', targetX, targetY, triggerFrame: 6, dmg: 35, executed: false };
            } else {
                // 烈焰新星
                this.pendingCast = { type: 'fire_nova', targetX, targetY, triggerFrame: 7, dmg: 30, executed: false };
            }
            return;
        }

        // 5. 巴爾 (Baal) — 狂笑魔爪引導 -> 極寒冰浪 / 霜爆
        if (this.type === 'baal') {
            this.skillTimer = 3400 + Math.random() * 1600;
            this.setState('cast');
            if (roll < 0.65) {
                this.pendingCast = { type: 'baal_cold_wave', targetX, targetY, triggerFrame: 6, dmg: 32, executed: false };
            } else {
                this.pendingCast = { type: 'frost_nova', triggerFrame: 6, dmg: 26, executed: false };
            }
            return;
        }

        // 6. 女妖 / 魅魔 (Succubus) — 招牌血之星 (Blood Star)
        if (this.type === 'succubus') {
            this.skillTimer = 2600 + Math.random() * 1200;
            this.setState('cast');
            this.pendingCast = { type: 'unholy_bolt', targetX, targetY, triggerFrame: 5, dmg: 18, speed: 0.22, executed: false };
            return;
        }

        // 7. 沉淪巫師 (Fallen Shaman) — 巫師火球 (Shaman Fireball)
        if (this.type === 'fallen_shaman') {
            this.skillTimer = 2700 + Math.random() * 1400;
            this.setState('cast');
            this.pendingCast = { type: 'shaman_fireball', targetX, targetY, triggerFrame: 6, dmg: 14, speed: 0.24, executed: false };
            return;
        }

        // 8. 小矮人巫師 (Fetish Shaman) — 噴吐火球 / 烈焰
        if (this.type === 'fetish_shaman') {
            this.skillTimer = 2500 + Math.random() * 1200;
            this.setState('cast');
            this.pendingCast = { type: 'shaman_fireball', targetX, targetY, triggerFrame: 5, dmg: 16, speed: 0.26, executed: false };
            return;
        }

        // 9. 議會長老 (Council Member) — 閃電 / 九頭蛇火球
        if (this.type === 'council') {
            this.skillTimer = 2800 + Math.random() * 1400;
            this.setState('attack');
            if (roll < 0.5) {
                this.director.spawnEnemyProjectile('shaman_fireball', this.x, this.y, targetX, targetY, 20, 0.25);
            } else {
                this.director.spawnEnemyStream('lightning', this.x, this.y, targetX, targetY, 22);
            }
            return;
        }

        // 10. 巨型木乃伊 (Mummy) — 邪靈毒彈 (Unholy Bolt)
        if (this.type === 'mummy') {
            this.skillTimer = 3000 + Math.random() * 1500;
            this.setState('attack');
            this.director.spawnEnemyProjectile('unholy_bolt', this.x, this.y, targetX, targetY, 14, 0.20);
            return;
        }

        // 11. 沙蟲 (Sand Maggot) — 劇毒噴吐 (Maggot Goo Spit)
        if (this.type === 'sand_maggot') {
            this.skillTimer = 2800 + Math.random() * 1400;
            this.setState('attack');
            this.director.spawnEnemyProjectile('maggot_spit', this.x, this.y, targetX, targetY, 16, 0.22);
            return;
        }

        // 12. 末日騎士 (Doom Knight) — 正統純近戰狂暴衝鋒重劈 (絕無非本體法術骨魂)
        if (this.type === 'doom_knight') {
            this.skillTimer = 3400 + Math.random() * 1600;
            this.isCharging = true;
            this.chargeSpeed = 0.18;
            this.setState('attack');
            return;
        }

        // 13. 巨大惡魔 (Balrog) — 正統深淵烈焰吐息 (Inferno Breath，絕無首領專屬火新星)
        if (this.type === 'balrog') {
            this.skillTimer = 3200 + Math.random() * 1600;
            this.setState('cast');
            this.pendingCast = { type: 'balrog_inferno', targetX, targetY, triggerFrame: 5, dmg: 22, executed: false };
            return;
        }
    }

    update(deltaMs, targetX, targetY) {
        if (this.remove) return;

        const actionMeta = this.manifest.actions[this.state] || this.manifest.actions['idle'];
        if (!actionMeta) return;

        // 1. 若怪物已死亡：播放 death 倒地動畫到最後一幀，鎖定倒地遺體姿態
        if (this.isDead) {
            this.frameTime += deltaMs;
            const interval = 65;
            if (this.frameTime >= interval) {
                this.frameTime -= interval;
                if (this.currentFrame < actionMeta.frames - 1) {
                    this.currentFrame++;
                } else {
                    this.currentFrame = actionMeta.frames - 1;
                    if (!this.deathTimerSet) {
                        this.deathTimerSet = true;
                        // Boss 遺體在地面長久保留 30 秒供玩家銘刻戰果，小怪保留 7 秒
                        const corpseDelay = (this.manifest && this.manifest.type === 'boss') ? 30000 : 7000;
                        setTimeout(() => { this.remove = true; }, corpseDelay);
                    }
                }
            }
            return;
        }

        // 2. 存活狀態下的幀動畫推進
        this.frameTime += deltaMs;
        const interval = 70;
        if (this.frameTime >= interval) {
            this.frameTime -= interval;
            this.currentFrame++;

            // 施法前搖 (Windup) 到達觸發幀，正式爆發技能！
            if (this.state === 'cast' && this.pendingCast && !this.pendingCast.executed) {
                if (this.currentFrame >= this.pendingCast.triggerFrame) {
                    this.pendingCast.executed = true;
                    const pc = this.pendingCast;
                    if (pc.type === 'diablo_lightning') {
                        // 迪亞布羅伸手完全，射出紅色閃電地獄！
                        this.director.spawnEnemyStream('diablo_lightning', this.x, this.y, pc.targetX, pc.targetY, pc.dmg);
                    } else if (pc.type === 'fire_nova') {
                        this.director.spawnFireNova(this.x, this.y, pc.dmg);
                    } else if (pc.type === 'poison_nova') {
                        this.director.spawnPoisonNova(this.x, this.y, pc.dmg);
                    } else if (pc.type === 'frost_nova') {
                        this.director.spawnFrostNova(this.x, this.y, pc.dmg);
                    } else if (pc.type === 'baal_cold_wave') {
                        this.director.spawnEnemyStream('baal_cold_wave', this.x, this.y, pc.targetX, pc.targetY, pc.dmg);
                    } else if (pc.type === 'lightning') {
                        this.director.spawnEnemyStream('lightning', this.x, this.y, pc.targetX, pc.targetY, pc.dmg);
                    } else if (pc.type === 'charged_bolt') {
                        this.director.spawnChargedBolts(this.x, this.y, pc.count || 5, pc.targetX, pc.targetY);
                    } else if (pc.type === 'balrog_inferno') {
                        this.director.spawnEnemyProjectile('shaman_fireball', this.x, this.y, pc.targetX, pc.targetY, pc.dmg, 0.28);
                    } else if (pc.type === 'unholy_bolt' || pc.type === 'shaman_fireball') {
                        this.director.spawnEnemyProjectile(pc.type, this.x, this.y, pc.targetX, pc.targetY, pc.dmg, pc.speed || 0.24);
                    }
                }
            }

            if (this.currentFrame >= actionMeta.frames) {
                if (this.state === 'hit' || this.state === 'attack' || this.state === 'cast') {
                    this.setState('idle');
                    this.hasAttacked = false;
                    this.pendingCast = null;
                } else {
                    this.currentFrame = 0;
                }
            }
        }

        // 3. 8 方向朝向：使用 2.5D 等軸測與原版 DCC 方向排布
        const dx = targetX - this.x;
        const dy = (targetY - this.y) * 2;
        const deg = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
        const sector = Math.round(deg / 45) % 8;
        const DCC_MAP = [7, 3, 4, 0, 5, 1, 6, 2];
        this.direction = DCC_MAP[sector];

        // 4. 戰鬥定位與射程設計 (近戰逼近 vs 遠程施法者保持距離)
        let stopDist = 50;
        let attackDist = 65;

        if (this.type === 'baal') { stopDist = 120; attackDist = 145; }
        else if (this.type === 'diablo') { stopDist = 110; attackDist = 140; }
        else if (this.type === 'mephisto') { stopDist = 105; attackDist = 135; }
        else if (this.type === 'andariel') { stopDist = 100; attackDist = 130; }
        else if (this.type === 'duriel') { stopDist = 90; attackDist = 120; }
        else if (this.type === 'balrog') { stopDist = 85; attackDist = 110; }
        else if (this.type === 'blunderbore') { stopDist = 80; attackDist = 105; }
        else if (this.type === 'blood_lord') { stopDist = 80; attackDist = 100; }
        else if (this.type === 'baal_minion') { stopDist = 75; attackDist = 95; }
        else if (this.type === 'council') { stopDist = 100; attackDist = 180; }
        else if (this.type === 'succubus') { stopDist = 130; attackDist = 220; }
        else if (this.type === 'fallen_shaman') { stopDist = 120; attackDist = 200; }
        else if (this.type === 'fetish_shaman') { stopDist = 110; attackDist = 190; }
        else if (this.type === 'sand_maggot') { stopDist = 100; attackDist = 180; }
        else if (this.type === 'mummy') { stopDist = 90; attackDist = 170; }
        else if (this.type === 'doom_knight') { stopDist = 65; attackDist = 110; }
        else if (this.type === 'frog_demon') { stopDist = 65; attackDist = 85; }
        else if (this.type === 'goatman') { stopDist = 60; attackDist = 80; }
        else if (this.type === 'spider') { stopDist = 65; attackDist = 80; }
        else if (this.type === 'fetish') { stopDist = 50; attackDist = 65; }

        const dist = Math.hypot(targetX - this.x, targetY - this.y);

        // 督瑞爾神聖冰凍靈氣範圍判定 (進入 240px 減緩玩家移速 30%)
        if (this.type === 'duriel' && !this.isDead && dist < 240) {
            if (this.director && this.director.sandbox && this.director.sandbox.character) {
                this.director.sandbox.character.chilledTimer = 500;
            }
        }

        // 技能施法冷卻輪轉
        this.skillTimer -= deltaMs;
        if (this.skillTimer <= 0 && this.state !== 'hit' && this.state !== 'attack' && this.state !== 'cast') {
            this.tryCastSkill(targetX, targetY, dist);
        }

        // 督瑞爾衝撞狀態處理
        if (this.isCharging) {
            const chargeAngle = Math.atan2((targetY - this.y) * 2, targetX - this.x);
            this.x += Math.cos(chargeAngle) * this.chargeSpeed * deltaMs;
            this.y += Math.sin(chargeAngle) * 0.5 * this.chargeSpeed * deltaMs;
            if (dist <= 75) {
                this.isCharging = false;
                this.setState('attack');
                if (this.director && this.director.sandbox) {
                    this.director.sandbox.triggerHeroDamage(32);
                    this.director.spawnHitShock(targetX, targetY);
                }
            }
            return;
        }

        // 移動逼近或隨機普攻
        if (dist > stopDist && this.state !== 'attack' && this.state !== 'cast' && this.state !== 'hit') {
            this.setState('walk');
            let speed = 0.055;
            if (this.type === 'andariel') speed = 0.08;
            else if (this.type === 'diablo') speed = 0.075;
            else if (this.type === 'mephisto') speed = 0.072;
            else if (this.type === 'fetish' || this.type === 'fetish_shaman') speed = 0.072;
            else if (this.type === 'duriel') speed = 0.07;
            else if (this.type === 'succubus') speed = 0.068;
            else if (this.type === 'baal') speed = 0.065;
            else if (this.type === 'baal_minion') speed = 0.06;
            else if (this.type === 'blood_lord') speed = 0.062;
            else if (this.type === 'balrog') speed = 0.064;
            else if (this.type === 'goatman') speed = 0.06;
            else if (this.type === 'fallen' || this.type === 'fallen_shaman') speed = 0.062;
            else if (this.type === 'spider') speed = 0.062;
            else if (this.type === 'frog_demon') speed = 0.058;
            else if (this.type === 'blunderbore') speed = 0.048;
            else if (this.type === 'council') speed = 0.055;
            else if (this.type === 'wraith') speed = 0.052;
            else if (this.type === 'doom_knight') speed = 0.05;
            else if (this.type === 'skeleton') speed = 0.048;
            else if (this.type === 'beetle') speed = 0.045;
            else if (this.type === 'sand_maggot') speed = 0.038;
            else if (this.type === 'mummy') speed = 0.032;
            else if (this.type === 'zombie') speed = 0.028;

            const angle = Math.atan2((targetY - this.y) * 2, targetX - this.x);
            this.x += Math.cos(angle) * speed * deltaMs;
            this.y += Math.sin(angle) * 0.5 * speed * deltaMs;
        } else if (dist <= attackDist) {
            if (this.state !== 'attack' && this.state !== 'cast' && this.state !== 'hit' && Math.random() < 0.035 && this.manifest.actions['attack']) {
                this.setState('attack');
            }
        }

        // 近戰普攻傷害判定
        if (this.state === 'attack' && !this.hasAttacked) {
            const hitFrame = Math.floor(actionMeta.frames * 0.45);
            if (this.currentFrame >= hitFrame) {
                this.hasAttacked = true;
                if (this.director && this.director.onMonsterAttackHero) {
                    this.director.onMonsterAttackHero(this);
                }
            }
        }
    }

    render(ctx) {
        if (this.remove) return;
        const actionData = this.sheets[this.state] || this.sheets['idle'];
        if (!actionData || !actionData.img || !actionData.img.complete || actionData.img.naturalWidth === 0) return;

        const meta = actionData.data;
        const sx = this.currentFrame * meta.cell_width;
        const sy = (this.direction % meta.directions) * meta.cell_height;

        ctx.save();
        // 腳底陰影 (幽靈為以太虛體，不繪製實體黑陰影)
        if (!this.isDead && this.type !== 'wraith') {
            ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
            ctx.beginPath();
            let shadowRadius = 18;
            if (this.type === 'diablo' || this.type === 'baal') shadowRadius = 42;
            else if (this.type === 'andariel' || this.type === 'mephisto' || this.type === 'duriel') shadowRadius = 35;
            else if (this.type === 'blood_lord' || this.type === 'balrog' || this.type === 'blunderbore') shadowRadius = 30;
            else if (this.type === 'sand_maggot') shadowRadius = 28;
            else if (this.type === 'baal_minion' || this.type === 'council') shadowRadius = 25;
            else if (this.type === 'succubus' || this.type === 'frog_demon') shadowRadius = 24;
            else if (this.type === 'fetish' || this.type === 'fetish_shaman') shadowRadius = 14;
            ctx.ellipse(this.x, this.y, shadowRadius, shadowRadius * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // 督瑞爾腳底神聖冰凍靈氣 (Holy Freeze Aura)
        if (this.type === 'duriel' && !this.isDead && this.director) {
            const freezeSheet = this.director.skillSheets['aura_freeze'];
            if (freezeSheet && freezeSheet.img && freezeSheet.img.complete && freezeSheet.img.naturalWidth > 0) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                const fMeta = freezeSheet.meta;
                const fIndex = Math.floor(Date.now() / 70) % fMeta.frames;
                const fxPos = fIndex * fMeta.cell_width;
                ctx.drawImage(
                    freezeSheet.img,
                    fxPos, 0, fMeta.cell_width, fMeta.cell_height,
                    Math.round(this.x - fMeta.pivot_x),
                    Math.round(this.y - fMeta.pivot_y + 5),
                    fMeta.cell_width, fMeta.cell_height
                );
                ctx.restore();
            }
        }

        // 怪物精靈圖本體 (幽靈採用純淨加法混色 lighter，死亡時發光消散，零黑色方框)
        if (this.type === 'wraith') {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            // 死亡動畫：隨幀推進 alpha 線性從 1 淡至 0，消除深色輪廓殘影黑影
            if (this.state === 'death') {
                const deathProgress = this.currentFrame / Math.max(1, meta.frames - 1);
                ctx.globalAlpha = Math.max(0, 1 - deathProgress);
            }
            ctx.drawImage(
                actionData.img,
                sx, sy, meta.cell_width, meta.cell_height,
                Math.round(this.x - meta.anchor_x),
                Math.round(this.y - meta.anchor_y),
                meta.cell_width, meta.cell_height
            );
            ctx.restore();
        } else {
            ctx.drawImage(
                actionData.img,
                sx, sy, meta.cell_width, meta.cell_height,
                Math.round(this.x - meta.anchor_x),
                Math.round(this.y - meta.anchor_y),
                meta.cell_width, meta.cell_height
            );
        }

        // 怪物血條與名稱
        if (!this.isDead && (this.hp < this.maxHp || this.hovered) && (!this.manifest || this.manifest.type !== 'boss')) {
            const barW = Math.max(44, this.clickRadius * 1.5);
            const barH = 5;
            const bx = this.x - barW / 2;
            const by = this.y - meta.anchor_y - 10;
            
            if (this.hovered) {
                ctx.save();
                ctx.font = "11px 'Cinzel', serif";
                ctx.textAlign = "center";
                ctx.fillStyle = "#f59e0b";
                ctx.shadowColor = "#000";
                ctx.shadowBlur = 4;
                ctx.fillText(this.manifest.name || this.type, this.x, by - 4);
                ctx.restore();
            }

            ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
            ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
            ctx.fillStyle = "#dc2626";
            ctx.fillRect(bx, by, Math.max(0, (this.hp / this.maxHp) * barW), barH);
        }

        ctx.restore();
    }
}

/**
 * Diablo II 友軍召喚夥伴實體 (CompanionEntity)
 * 支援德魯伊 (灰熊、狂狼衝鋒肉搏，自然之靈身周警戒盤旋)
 * 支援死靈法師 (骷髏僕從、黏土石魔主動擊怪)
 */
class CompanionEntity {
    constructor(companionKey, hero, director) {
        this.key = companionKey;
        this.hero = hero;
        this.director = director;

        const manifest = (window.D2_COMPANIONS_MANIFEST && window.D2_COMPANIONS_MANIFEST[companionKey]) || {};
        this.manifest = manifest;
        this.name = manifest.name || companionKey;
        this.type = manifest.type || 'beast'; // beast, spirit, undead, construct, flying
        this.isCombat = manifest.isCombat !== undefined ? manifest.isCombat : true;

        this.hp = manifest.hp || 300;
        this.maxHp = manifest.hp || 300;
        this.damage = manifest.damage || 35;
        this.speed = manifest.speed || 3.2;
        this.range = manifest.range ? Math.max(65, manifest.range) : 65;
        this.collisionRadius = manifest.collisionRadius || 20;

        // 初始位置在英雄周圍隨機偏移
        const angle = Math.random() * Math.PI * 2;
        const dist = 35 + Math.random() * 45;
        this.x = hero.x + Math.cos(angle) * dist;
        this.y = hero.y + Math.sin(angle) * dist * 0.5;

        this.direction = 0; // 0..7 (標準順時針 8 方向)
        this.state = 'idle'; // idle, walk, run, attack, death
        this.currentFrame = 0;
        this.frameTime = 0;
        this.hasAttacked = false;
        this.isDead = false;
        this.remove = false;

        // 自然之靈 / 烏鴉 懸浮環繞角度與高度
        this.orbitAngle = Math.random() * Math.PI * 2;
        this.orbitRadius = manifest.orbitRadius || (this.type === 'flying' ? 55 : 50);
        this.altitude = (this.type === 'flying') ? 45 : 0; // 烏鴉懸浮離地 45px
        this.diveTarget = null;
        this.isDiving = false;

        // 攻擊冷卻計時器
        this.attackCooldown = Math.random() * 300;

        // 動作精靈圖貼圖載入
        this.sheets = {};
        if (manifest.actions) {
            for (const [actionName, actionData] of Object.entries(manifest.actions)) {
                const img = new Image();
                img.src = actionData.file;
                this.sheets[actionName] = { img, data: actionData };
            }
        }
    }

    setState(newState, force = false) {
        if (this.isDead && newState !== 'death') return;
        // 攻擊動作硬直鎖定 (Action Lock)：若正處於攻擊動作中且非強制退出，嚴禁被 walk/idle 打斷 (徹底消滅攻擊抖動抽搐)
        if (!force && this.state === 'attack' && newState !== 'death') return;

        let resolvedState = newState;
        if (!this.sheets[resolvedState]) {
            if (resolvedState === 'run' && this.sheets['walk']) resolvedState = 'walk';
            else if (resolvedState === 'attack' && this.sheets['walk']) resolvedState = 'walk';
            else return;
        }
        // 若目標狀態與當前狀態相同，嚴禁打斷動畫幀進度 (徹底消滅魔像與召喚物滑步)
        if (this.state === resolvedState) return;

        this.state = resolvedState;
        this.currentFrame = 0;
        this.frameTime = 0;
        this.hasAttacked = false;
    }

    takeDamage(amount) {
        if (this.isDead || this.remove) return;
        this.hp -= amount;
        if (this.director && this.director.addDamageNumber) {
            this.director.addDamageNumber(this.x, this.y - 35, amount, false);
        }

        // 鋼鐵魔像 (Iron Golem) 天生金屬尖刺反傷
        if (this.key === 'iron_golem' && this.currentTarget && !this.currentTarget.isDead) {
            const reflect = Math.round(amount * 0.45);
            this.currentTarget.takeDamage(reflect);
        }

        if (this.hp <= 0) {
            this.hp = 0;
            this.isDead = true;
            this.setState('death', true);
        }
    }

    update(dt) {
        if (this.remove) return;

        // 推進動畫幀
        const sheetInfo = this.sheets[this.state] || this.sheets['idle'];
        if (sheetInfo) {
            const cfg = sheetInfo.data;
            const fps = cfg.fps || 12;
            const frameInterval = 1000 / fps;
            this.frameTime += dt;
            if (this.frameTime >= frameInterval) {
                this.frameTime -= frameInterval;
                this.currentFrame++;

                // 攻擊命中判定：在動作推進到中段時造成傷害
                if (this.state === 'attack' && this.currentFrame >= Math.floor(cfg.frames * 0.45) && !this.hasAttacked) {
                    this.hasAttacked = true;
                    if (this.currentTarget && !this.currentTarget.isDead && !this.currentTarget.remove) {
                        this.currentTarget.takeDamage(this.damage);
                        if (this.type === 'flying') {
                            if (this.director && this.director.playSfx) this.director.playSfx('raven_attack1');
                        }
                    }
                }

                if (this.currentFrame >= cfg.frames) {
                    if (this.state === 'death') {
                        this.currentFrame = cfg.frames - 1;
                        this.remove = true;
                    } else if (this.state === 'attack') {
                        this.currentFrame = 0;
                        this.hasAttacked = false;
                        this.setState('idle', true);
                        this.attackCooldown = (this.key === 'bear') ? 550 : (this.type === 'flying' ? 400 : 500);
                        if (this.type === 'flying') {
                            this.isDiving = false;
                            this.altitude = 45;
                        }
                    } else {
                        this.currentFrame = 0;
                    }
                }
            }
        }

        if (this.isDead) return;
        if (this.attackCooldown > 0) this.attackCooldown -= dt;

        // 攻擊動作硬直鎖定 (Action Lock)：若正處於攻擊出招中，保持面向目標，嚴禁位移與物理推擠干擾
        if (this.state === 'attack') {
            if (this.currentTarget && !this.currentTarget.isDead && !this.currentTarget.remove) {
                this.direction = this.getDirectionTowards(this.currentTarget.x, this.currentTarget.y);
            }
            return;
        }

        // 1. 自然之靈 (Oak Sage) 行為：以金光靈體在德魯伊身周警戒護衛盤旋
        if (this.type === 'spirit' || !this.isCombat) {
            this.orbitAngle += 0.025;
            this.x = this.hero.x + Math.cos(this.orbitAngle) * this.orbitRadius;
            this.y = this.hero.y + Math.sin(this.orbitAngle) * (this.orbitRadius * 0.5) - 20;
            this.setState('idle');
            return;
        }

        // 2. 寵物烏鴉 (Raven) 特殊行為：空中懸浮盤旋，有怪時高速俯衝啄擊
        if (this.type === 'flying') {
            let nearestEnemy = null;
            let minDist = 320;
            if (this.director && this.director.monsters) {
                for (const m of this.director.monsters) {
                    if (m.isDead || m.remove) continue;
                    const d = Math.hypot(m.x - this.x, (m.y - this.y) * 2);
                    if (d < minDist) {
                        minDist = d;
                        nearestEnemy = m;
                    }
                }
            }

            this.currentTarget = nearestEnemy;

            if (nearestEnemy && this.attackCooldown <= 0) {
                // 俯衝撲擊目標頭部
                this.isDiving = true;
                const tx = nearestEnemy.x;
                const ty = nearestEnemy.y - 15;
                const dx = tx - this.x;
                const dy = (ty - this.y) * 2;
                const dist = Math.hypot(dx, dy);

                this.direction = this.getDirectionTowards(tx, ty);
                this.altitude = Math.max(5, 45 * (dist / 160));

                if (dist <= 30) {
                    this.setState('attack');
                } else {
                    const step = this.speed * 1.4;
                    this.x += (dx / dist) * step;
                    this.y += (dy / dist) * step * 0.5;
                    this.setState('run');
                }
            } else {
                // 平時在主人頭頂空中盤旋護衛
                this.isDiving = false;
                this.altitude = 45;
                this.orbitAngle += 0.035;
                const targetX = this.hero.x + Math.cos(this.orbitAngle) * this.orbitRadius;
                const targetY = this.hero.y + Math.sin(this.orbitAngle) * (this.orbitRadius * 0.5) - 10;
                const dx = targetX - this.x;
                const dy = (targetY - this.y) * 2;
                const dist = Math.hypot(dx, dy);
                if (dist > 5) {
                    this.x += (dx / dist) * this.speed;
                    this.y += (dy / dist) * this.speed * 0.5;
                    this.direction = this.getDirectionTowards(targetX, targetY);
                }
                this.setState('walk');
            }
            return;
        }

        // 3. 地面戰鬥型夥伴 (灰熊、狂狼、骷髏僕從、石魔)
        const distHero = Math.hypot(this.x - this.hero.x, (this.y - this.hero.y) * 2);

        // 防走失機制：離主人過遠時主動奔回防守
        if (distHero > 650) {
            const hdx = this.hero.x - this.x;
            const hdy = (this.hero.y - this.y) * 2;
            const hDist = Math.hypot(hdx, hdy);
            const moveSpeed = this.speed * 1.5;
            this.x += (hdx / hDist) * moveSpeed;
            this.y += (hdy / hDist) * moveSpeed * 0.5;
            this.direction = this.getDirectionTowards(this.hero.x, this.hero.y);
            this.setState('run');
            this.currentTarget = null;
            return;
        }

        // 自動尋敵：從地牢中尋找最近的存活怪物
        let nearestTarget = null;
        let minDist = 550; // 警戒鎖敵半徑 (擴展至 550px，確保能主動探索並追擊怪物)
        if (this.director && this.director.monsters) {
            for (const m of this.director.monsters) {
                if (m.isDead || m.remove) continue;
                const d = Math.hypot(m.x - this.x, (m.y - this.y) * 2);
                if (d < minDist) {
                    minDist = d;
                    nearestTarget = m;
                }
            }
        }

        this.currentTarget = nearestTarget;

        if (nearestTarget) {
            this.direction = this.getDirectionTowards(nearestTarget.x, nearestTarget.y);
            const attackRange = this.range;
            // 攻擊判定加入 15px 追擊遲滯，防止在射程邊界狂切 walk/idle
            const inRange = (this.state === 'walk' || this.state === 'run') ? (minDist <= attackRange) : (minDist <= attackRange + 15);
            if (inRange) {
                // 進入肉搏射程，展開猛烈攻擊！
                if (this.attackCooldown <= 0) {
                    this.setState('attack');
                } else {
                    this.setState('idle');
                }
            } else {
                // 衝鋒追擊目標怪物 (2.5D 等距向量推進)
                const tdx = nearestTarget.x - this.x;
                const tdy = (nearestTarget.y - this.y) * 2;
                const tDist = Math.hypot(tdx, tdy);
                const step = this.speed * (tDist > 120 ? 1.3 : 1.0);
                this.x += (tdx / tDist) * step;
                this.y += (tdy / tDist) * step * 0.5;
                this.setState(tDist > 120 ? 'run' : 'walk');
            }
        } else {
            // 無敵情：在主人身旁漫步巡邏警戒 (加入 30px 遲滯區間，徹底防止 idle/walk 邊界高頻抖動)
            const shouldWalk = (this.state === 'walk') ? (distHero > 65) : (distHero > 95);
            if (shouldWalk) {
                const hdx = this.hero.x - this.x;
                const hdy = (this.hero.y - this.y) * 2;
                const hDist = Math.hypot(hdx, hdy);
                if (hDist > 0.001) {
                    this.x += (hdx / hDist) * (this.speed * 0.8);
                    this.y += (hdy / hDist) * (this.speed * 0.8) * 0.5;
                    this.direction = this.getDirectionTowards(this.hero.x, this.hero.y);
                }
                this.setState('walk');
            } else {
                this.setState('idle');
            }
        }

        // 4. 夥伴之間 2.5D 等距分離碰撞 (Separation Steering - 徹底杜絕夥伴重疊一團)
        this.applySeparation();
    }

    applySeparation() {
        if (this.type === 'spirit' || this.type === 'flying') return;

        // A. 夥伴與夥伴之間的硬體積碰撞
        if (this.director && this.director.companions) {
            for (const other of this.director.companions) {
                if (other === this || other.remove || other.isDead) continue;
                if (other.type === 'spirit' || other.type === 'flying') continue;

                const dx = this.x - other.x;
                const dy = (this.y - other.y) * 2; // 2.5D 等距壓縮空間距離
                const d = Math.hypot(dx, dy);
                const minDist = (this.collisionRadius || 22) + (other.collisionRadius || 22);

                if (d < minDist && d > 0.001) {
                    const overlap = minDist - d;
                    const push = overlap * 0.5; // 剛性分離推擠
                    this.x += (dx / d) * push;
                    this.y += (dy / d) * push * 0.5;
                }
            }
        }

        // B. 夥伴與主人 (Hero) 之間的實體碰撞分離 (避免夥伴直接踩在主人身上)
        if (this.hero) {
            const hdx = this.x - this.hero.x;
            const hdy = (this.y - this.hero.y) * 2;
            const hd = Math.hypot(hdx, hdy);
            const heroMinDist = (this.collisionRadius || 20) + 26;
            if (hd < heroMinDist && hd > 0.001) {
                const overlap = heroMinDist - hd;
                this.x += (hdx / hd) * (overlap * 0.6);
                this.y += (hdy / hd) * (overlap * 0.3);
            }
        }

        // C. 夥伴與怪物 (Monsters) 之間的實體體積碰撞分離 (避免夥伴鑽入怪物體內)
        if (this.director && this.director.monsters) {
            for (const m of this.director.monsters) {
                if (m.isDead || m.remove) continue;
                const mdx = this.x - m.x;
                const mdy = (this.y - m.y) * 2;
                const md = Math.hypot(mdx, mdy);
                const mMinDist = (this.collisionRadius || 20) + (m.collisionRadius || 24);
                if (md < mMinDist && md > 0.001) {
                    const overlap = mMinDist - md;
                    this.x += (mdx / md) * (overlap * 0.4);
                    this.y += (mdy / md) * (overlap * 0.2);
                }
            }
        }
    }

    getDirectionTowards(tx, ty) {
        // 嚴格遵守 AGENT.md 第 11 節：2.5D 等距 45 度投影角度校準
        // 與 MonsterEntity 使用完全相同的 DCC_MAP 方向換算，確保所有精靈圖方向一致
        const dx = tx - this.x;
        const dy = (ty - this.y) * 2; // 2:1 幾何縱深校準
        const deg = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
        const sector = Math.round(deg / 45) % 8;
        const DCC_MAP = [7, 3, 4, 0, 5, 1, 6, 2];
        return DCC_MAP[sector];
    }

    render(ctx) {
        if (this.remove) return;

        const isFlying = (this.type === 'flying');
        const renderAltitude = isFlying ? (this.altitude || 45) : 0;

        // 1. 地面 2.5D 陰影 (烏鴉懸浮時陰影在地表保持真實投影)
        ctx.save();
        ctx.beginPath();
        const shadowScale = isFlying ? Math.max(0.4, 1.0 - renderAltitude / 80) : 1.0;
        ctx.ellipse(this.x, this.y - 2, 22 * shadowScale, 10 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fillStyle = isFlying ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.4)';
        ctx.fill();
        ctx.restore();

        // 2. 自然之靈專屬金黃色柔和護體光暈
        if (this.type === 'spirit') {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            const grad = ctx.createRadialGradient(this.x, this.y, 4, this.x, this.y, 36);
            grad.addColorStop(0, 'rgba(251, 191, 36, 0.7)');
            grad.addColorStop(0.5, 'rgba(245, 158, 11, 0.3)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 36, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 3. 火焰魔像專屬腳底微熱光暈
        if (this.key === 'fire_golem') {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const grad = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, 32);
            grad.addColorStop(0, 'rgba(239, 68, 68, 0.55)');
            grad.addColorStop(0.6, 'rgba(245, 158, 11, 0.25)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 32, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 4. 繪製精靈圖本體 (已依順時針 8 方向排列對齊)
        const sheetInfo = this.sheets[this.state] || this.sheets['idle'];
        if (sheetInfo && sheetInfo.img && sheetInfo.img.complete && sheetInfo.img.naturalWidth > 0) {
            const img = sheetInfo.img;
            const cfg = sheetInfo.data;
            const numDirs = cfg.directions || 8;
            const dirRow = (numDirs === 1) ? 0 : (this.direction % numDirs);
            const sx = (this.currentFrame % cfg.frames) * cfg.cell_width;
            const sy = dirRow * cfg.cell_height;

            const drawX = Math.round(this.x - cfg.anchor_x);
            const drawY = Math.round(this.y - renderAltitude - cfg.anchor_y);

            if (this.type === 'spirit') {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.drawImage(
                    img,
                    sx, sy, cfg.cell_width, cfg.cell_height,
                    drawX, drawY, cfg.cell_width, cfg.cell_height
                );
                ctx.restore();
            } else {
                ctx.drawImage(
                    img,
                    sx, sy, cfg.cell_width, cfg.cell_height,
                    drawX, drawY, cfg.cell_width, cfg.cell_height
                );
            }
        }

        // 5. 依用戶規範：隱藏頭頂所有文字名稱！僅在受損時顯示精巧友軍微型血條
        if (!this.isDead && this.type !== 'spirit' && this.hp < this.maxHp) {
            const barW = 32;
            const barH = 3;
            const bx = Math.round(this.x - barW / 2);
            const by = Math.round(this.y - renderAltitude - 65);

            ctx.save();
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
            ctx.fillStyle = "#22c55e"; // 友軍綠色血條
            ctx.fillRect(bx, by, Math.max(0, (this.hp / this.maxHp) * barW), barH);
            ctx.restore();
        }
    }
}

class CombatDirector {
    constructor(sandbox) {
        this.sandbox = sandbox;
        this.manifest = window.D2_MONSTERS_MANIFEST || {};
        this.fxManifest = window.D2_FX_MANIFEST || window.FX_MANIFEST || {};
        this.companionManifest = window.D2_COMPANIONS_MANIFEST || window.COMPANIONS_MANIFEST || {};
        
        this.monsters = [];
        this.companions = []; // 召喚夥伴系統 (灰熊、狂狼、自然之靈、骷髏僕從、石魔)
        this.missiles = []; // 祝聖之槌、彈道投射物、新星、射線
        this.overlays = []; // 命中震盪
        this.damageNumbers = []; // 浮動戰鬥傷害數字
        this.auraPulseTimer = 0; // 聖火/聖衝/聖凍定時脈衝傷害

        this.eventQueue = [];
        this.pacingTimer = 0;
        this.pacingInterval = 320;

        this.activeBoss = null;
        this.bossUiEl = null;

        this.skillSheets = {};
        this.loadSkillSheets();
        if (window.initCombatSkillsExtension) {
            window.initCombatSkillsExtension(CombatDirector.prototype);
        }
        this.initMissileSystem();

        // 整合 V2 技能引擎 (Diablo2-Agent-Monitor 戰鬥地牢整合版)
        if (window.createDungeonV2Adapter) {
            this.v2Player = window.createDungeonV2Adapter(this.sandbox.canvas, this);
        } else if (window.UniversalRuntimePlayer) {
            this.v2Player = new window.UniversalRuntimePlayer(this.sandbox.canvas);
            this.v2Player.isDungeonMode = true;
            // 載入火、冰、電三系 Manifest
            const manifests = [window.fireManifestData, window.coldManifestData, window.lightningManifestData];
            for (const mfData of manifests) {
                if (mfData && mfData.skills) {
                    for (const key of Object.keys(mfData.skills)) {
                        this.v2Player.registerManifest(mfData.skills[key]);
                    }
                }
            }
        }
    }

    addDamageNumber(x, y, amount, isHero = false) {
        if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount) || amount <= 0) return;
        this.damageNumbers.push({
            x: x,
            y: y,
            amount: Math.round(amount),
            isHero: isHero,
            lifetime: 0,
            maxLifetime: 750,
            vy: -0.045
        });
    }

    onHeroMeleeAttack(hx, hy, dir, type = 'slash') {
        let hitTarget = null;
        let minD = (type === 'jab') ? 95 : ((type === 'smite') ? 92 : 88);
        for (const m of this.monsters) {
            if (!m.isDead && !m.remove) {
                const dx = m.x - hx;
                const dy = (m.y - hy) * 2;
                const d = Math.hypot(dx, dy);
                if (d <= minD) {
                    minD = d;
                    hitTarget = m;
                }
            }
        }
        if (hitTarget) {
            const hitDelay = (type === 'zeal') ? 50 : 100;
            setTimeout(() => {
                if (!hitTarget.isDead) {
                    if (type === 'smite') {
                        hitTarget.takeDamage(55);
                        const rad = ((90 + dir * 22.5) % 360) * Math.PI / 180;
                        hitTarget.x += Math.cos(rad) * 35;
                        hitTarget.y += Math.sin(rad) * 18;
                        this.spawnHitShock(hitTarget.x, hitTarget.y, 'hit_shock');
                        if (this.addDamageNumber) this.addDamageNumber(hitTarget.x, hitTarget.y - 45, 55, false, '#fbbf24');
                        this.playSfx('combat/smite');
                    } else if (type === 'zeal') {
                        hitTarget.takeDamage(28);
                        const ox = (Math.random() - 0.5) * 24;
                        const oy = (Math.random() - 0.5) * 18;
                        this.spawnHitShock(hitTarget.x + ox, hitTarget.y + oy);
                        if (this.addDamageNumber) this.addDamageNumber(hitTarget.x + ox, hitTarget.y - 40, 28, false, '#fef08a');
                        this.playSfx('kick');
                    } else {
                        const dmg = (type === 'jab') ? 44 : 38;
                        hitTarget.takeDamage(dmg);
                        this.spawnHitShock(hitTarget.x, hitTarget.y);
                        this.playSfx('kick');
                    }
                }
            }, hitDelay);
        }
    }

    spawnHeroHolyShield(hx, hy) {
        this.playSfx('combat/cast');
        if (this.showFloatingCombatText) {
            this.showFloatingCombatText(hx, hy - 70, "神聖之盾！金色神盾格擋暴增", "#fbbf24");
        }
    }

    loadSkillSheets() {
        if (!this.fxManifest.skills) return;
        for (const [key, skillData] of Object.entries(this.fxManifest.skills)) {
            const img = new Image();
            img.src = skillData.file;
            this.skillSheets[key] = {
                img: img,
                meta: skillData
            };
        }
    }

    initMissileSystem() {
        if (!window.D2MissileSystem) return;
        this.targetMap = new Map();
        this.missileSystem = new window.D2MissileSystem.MissileSystem({
            capacity: 512,
            onHit: (rt, spec, hitTargetId) => {
                if (spec.id === 'fireball') {
                    for (const m of this.monsters) {
                        if (!m.isDead && !m.remove) {
                            const d = Math.hypot(m.x - rt.x, (m.y - rt.y) * 2);
                            if (d <= 80) {
                                m.takeDamage(65);
                            }
                        }
                    }
                    this.spawnHitShock(rt.x, rt.y);
                } else {
                    const tid = (hitTargetId !== undefined && hitTargetId !== -1) ? hitTargetId : rt.targetId;
                    const monster = this.targetMap.get(tid);
                    if (monster && !monster.isDead && !monster.remove) {
                        const dmg = spec.id === 'bonespirit' ? 80 : (spec.id === 'chargedbolt' ? 28 : 45);
                        monster.takeDamage(dmg);
                        this.spawnHitShock(rt.x, rt.y);
                    }
                }
            }
        });

        if (this.sandbox && this.sandbox.ctx) {
            this.attachMissileRenderer(this.sandbox.ctx);
        }
    }

    /**
     * 依循 Blizzard D2 DCC 規格換算精確貼圖方向列 (8/16/32 方向)
     * 解決非線性角度分佈與 DCC 特有索引映射 (South=4, West=5, North=6, East=7 等)
     */
    getDccDirectionRow(numDirs, phiDeg, skillId = null) {
        // phiDeg 為笛卡爾角 (0=East, 90=South, 180=West, 270=North)
        // 轉為螢幕羅盤方位 headingDeg (0=North, 90=East, 180=South, 270=West)
        const headingDeg = (phiDeg + 90) % 360;
        const angleDelta = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

        if (numDirs === 16) {
            // 火球專屬原廠 DCC 實測角度表 (源自 D2AgentQUESDT/assets/atlases/fireball.json)
            if (skillId === 'fireball' || skillId === 'shaman_fireball') {
                const FIREBALL_DIRECTION_ANGLES = [
                    246.29, 292.78, 67.01, 113.69, 179.63, 269.81, 358.28, 90.53,
                    221.82, 259.2, 279.77, 315.49, 42.36, 80.38, 100.23, 137.35
                ];
                let best = 0;
                let bestErr = Infinity;
                for (let i = 0; i < FIREBALL_DIRECTION_ANGLES.length; i++) {
                    const err = angleDelta(FIREBALL_DIRECTION_ANGLES[i], headingDeg);
                    if (err < bestErr) {
                        bestErr = err;
                        best = i;
                    }
                }
                return best;
            }
            // 暴雪官方 _DIR16 (Necrolis 64 sector 映射)
            const sector = Math.round(((headingDeg - 180 + 360) % 360) / (360 / 64)) % 64;
            const DIR16_TABLE = [
                4, 4, 8, 8, 8, 8, 0, 0, 0, 0, 9, 9, 9, 9, 5, 5,
                5, 5, 10, 10, 10, 10, 1, 1, 1, 1, 11, 11, 11, 11, 6, 6,
                6, 6, 12, 12, 12, 12, 2, 2, 2, 2, 13, 13, 13, 13, 7, 7,
                7, 7, 14, 14, 14, 14, 3, 3, 3, 3, 15, 15, 15, 15, 4, 4
            ];
            return DIR16_TABLE[sector];
        } else if (numDirs === 32) {
            // 暴雪官方 _DIR32 (死靈法師白骨之牙 TeethMissile)
            const sector = Math.round(((headingDeg - 180 + 360) % 360) / (360 / 64)) % 64;
            const DIR32_TABLE = [
                4, 16, 16, 8, 8, 17, 17, 0, 0, 18, 18, 9, 9, 19, 19, 5,
                5, 20, 20, 10, 10, 21, 21, 1, 1, 22, 22, 11, 11, 23, 23, 6,
                6, 24, 24, 12, 12, 25, 25, 2, 2, 26, 26, 13, 13, 27, 27, 7,
                7, 28, 28, 14, 14, 29, 29, 3, 3, 30, 30, 15, 15, 31, 31, 4
            ];
            return DIR32_TABLE[sector];
        } else if (numDirs === 8) {
            // 暴雪官方 DCC 8 方向角度 (SW=0, NW=1, NE=2, SE=3, S=4, W=5, N=6, E=7)
            const DCC8_ANGLES = [225, 315, 45, 135, 180, 270, 0, 90];
            let best = 0;
            let bestErr = Infinity;
            for (let i = 0; i < DCC8_ANGLES.length; i++) {
                const err = angleDelta(DCC8_ANGLES[i], headingDeg);
                if (err < bestErr) {
                    bestErr = err;
                    best = i;
                }
            }
            return best;
        } else if (numDirs > 1) {
            return Math.round((phiDeg / 360) * numDirs) % numDirs;
        }
        return 0;
    }

    attachMissileRenderer(ctx) {
        if (!this.missileSystem || !ctx) return;
        this.missileSystem.attachRenderer(ctx, (m) => {
            const spec = this.missileSystem.manager.specAt(m.specIndex);
            if (!spec) return null;
            let sheetKey = spec.id;
            if (sheetKey === 'bonespirit') sheetKey = 'bone_spirit';
            else if (sheetKey === 'chargedbolt') sheetKey = 'charged_bolt';
            else if (sheetKey === 'hammer') sheetKey = 'hammer';

            const sheet = this.skillSheets[sheetKey] || this.skillSheets['fireball'];
            if (!sheet || !sheet.img || !sheet.img.complete) return null;

            const numDirs = sheet.meta.directions || 1;
            const rad = m.phi * Math.PI / 180;
            const headingDeg = window.D2_MISSILE_LANDMARKS
                ? window.D2_MISSILE_LANDMARKS.getScreenHeading(Math.cos(rad), Math.sin(rad) * 0.55)
                : ((m.phi + 90) % 360);
            const row = (window.D2_MISSILE_LANDMARKS && sheetKey === 'fireball')
                ? window.D2_MISSILE_LANDMARKS.resolveDirectionRow('fireball', headingDeg)
                : this.getDccDirectionRow(numDirs, m.phi, spec.id);

            // 追蹤型技能 (例如骨魂 bonespirit) 保持動態轉向不鎖定；單一投射物 (火球等) 啟用兩點直線對齊
            const placement = (sheetKey === 'fireball' && window.D2_MISSILE_LANDMARKS)
                ? window.D2_MISSILE_LANDMARKS.getFramePlacement('fireball', row, m.animFrame, headingDeg)
                : null;

            return {
                image: sheet.img,
                frameW: sheet.meta.cell_width,
                frameH: sheet.meta.cell_height,
                frameCount: sheet.meta.frames,
                speed: 128,
                anchorX: sheet.meta.pivot_x,
                anchorY: sheet.meta.pivot_y,
                row: row,
                blendMode: 'additive',
                placement: placement
            };
        });
    }

    syncMonstersToMissileTargets() {
        if (!this.missileSystem || !this.targetMap) return;
        const activeUnits = new Set();
        for (const m of this.monsters) {
            if (!m.isDead && !m.remove) {
                activeUnits.add(m);
                if (!m._missileTargetId) {
                    const targetUnit = this.missileSystem.targets.createUnit({
                        get x() { return m.x; },
                        get y() { return m.y; },
                        get alive() { return !m.isDead && !m.remove; },
                        team: 1,
                        radius: m.collisionRadius || 22
                    }, 0, -18);
                    m._missileTargetId = targetUnit.id;
                    this.targetMap.set(targetUnit.id, m);
                }
            }
        }
        for (const [tid, m] of this.targetMap.entries()) {
            if (!activeUnits.has(m) || m.isDead || m.remove) {
                this.missileSystem.targets.remove(tid);
                this.targetMap.delete(tid);
                delete m._missileTargetId;
            }
        }
    }

    playSfx(name) {
        if (window.__D2_DISABLE_AUDIO__ || (window.d2Audio && window.d2Audio.isMuted)) return;
        try {
            const audio = new Audio(`assets/sfx/${name}.wav`);
            audio.volume = 0.5;
            audio.play().catch(() => {});
        } catch (e) {}
    }

    pushEvent(event) {
        if (!event || !event.type) return;

        const highPriorityTypes = ['tool_execute', 'task_start', 'task_complete', 'error_retry'];
        if (highPriorityTypes.includes(event.type)) {
            this.eventQueue = this.eventQueue.filter(e => highPriorityTypes.includes(e.type));
            this.eventQueue.push(event);
            this.pacingTimer = this.pacingInterval;
        } else if (event.type === 'thinking') {
            if (this.eventQueue.length > 0 && this.eventQueue[this.eventQueue.length - 1].type === 'thinking') {
                this.eventQueue[this.eventQueue.length - 1] = event;
            } else if (this.eventQueue.length < 10) {
                this.eventQueue.push(event);
            }
        } else {
            if (this.eventQueue.length < 20) {
                this.eventQueue.push(event);
            }
        }
    }

    update(deltaMs) {
        // 1. 事件平滑消費
        this.pacingTimer += deltaMs;
        if (this.pacingTimer >= this.pacingInterval) {
            this.pacingTimer -= this.pacingInterval;
            if (this.eventQueue.length > 0) {
                const event = this.eventQueue.shift();
                this.processEvent(event);
            }
        }

        const heroX = this.sandbox.character ? this.sandbox.character.x : 400;
        const heroY = this.sandbox.character ? this.sandbox.character.y : 300;

        // V2 Engine Dummies Sync & Tick (原生支援 2.5D 等距地牢實體)
        if (this.v2Player) {
            this.v2Player.dummies = this.monsters.filter(m => !m.isDead && !m.remove);
            this.v2Accum = (this.v2Accum || 0) + deltaMs;
            while (this.v2Accum >= 40) {
                this.v2Player.tick({ x: heroX, y: heroY });
                this.v2Accum -= 40;
            }
        }

        // 2. 更新怪物
        for (let i = this.monsters.length - 1; i >= 0; i--) {
            const m = this.monsters[i];
            m.update(deltaMs, heroX, heroY);
            if (m.remove) {
                if (m === this.activeBoss) {
                    this.activeBoss = null;
                    this.hideBossBar();
                }
                this.monsters.splice(i, 1);
            }
        }

        // 3. 更新召喚夥伴 (德魯伊灰熊/狂狼/自然之靈、死靈骷髏僕從/石魔)
        this.updateCompanions(deltaMs);

        // 實體碰撞體積與防重疊分離
        const hero = this.sandbox ? this.sandbox.character : null;
        if (hero) {
            const heroRadius = 18;
            for (let i = 0; i < this.monsters.length; i++) {
                const m1 = this.monsters[i];
                if (m1.isDead || m1.remove) continue;

                // 怪物與玩家主角的碰撞分離
                const dxH = m1.x - hero.x;
                const dyH = (m1.y - hero.y) * 2;
                const distH = Math.hypot(dxH, dyH);
                const minDistH = m1.collisionRadius + heroRadius;
                if (distH < minDistH && distH > 0.001) {
                    const overlap = minDistH - distH;
                    const angleH = Math.atan2(dyH, dxH);
                    m1.x += Math.cos(angleH) * overlap * 0.45;
                    m1.y += Math.sin(angleH) * 0.5 * overlap * 0.45;
                }

                // 怪物與怪物之間的分離
                for (let j = i + 1; j < this.monsters.length; j++) {
                    const m2 = this.monsters[j];
                    if (m2.isDead || m2.remove) continue;
                    const dxM = m2.x - m1.x;
                    const dyM = (m2.y - m1.y) * 2;
                    const distM = Math.hypot(dxM, dyM);
                    const minDistM = m1.collisionRadius + m2.collisionRadius;
                    if (distM < minDistM && distM > 0.001) {
                        const overlapM = (minDistM - distM) * 0.25;
                        const angleM = Math.atan2(dyM, dxM);
                        m1.x -= Math.cos(angleM) * overlapM;
                        m1.y -= Math.sin(angleM) * 0.5 * overlapM;
                        m2.x += Math.cos(angleM) * overlapM;
                        m2.y += Math.sin(angleM) * 0.5 * overlapM;
                    }
                }
            }
        }

        // 戰鬥沙盒守護：自動刷怪
        const aliveMonsters = this.monsters.filter(m => !m.isDead);
        if (aliveMonsters.length === 0 && !this.activeBoss) {
            this.autoRespawnTimer = (this.autoRespawnTimer || 0) + deltaMs;
            if (this.autoRespawnTimer >= 2500) {
                this.autoRespawnTimer = 0;
                this.spawnMobWave(null, 3);
            }
        } else {
            this.autoRespawnTimer = 0;
        }

        // 3. 浮動戰鬥數字推進
        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const dn = this.damageNumbers[i];
            dn.lifetime += deltaMs;
            dn.y += dn.vy * deltaMs;
            if (dn.lifetime >= dn.maxLifetime) {
                this.damageNumbers.splice(i, 1);
            }
        }

        // 4. 聖騎士常駐靈氣傷害脈衝 (聖火 AoE / 聖衝單體雷擊 / 聖凍極寒減速)
        if (hero && hero.getActiveAuraName) {
            this.auraPulseTimer += deltaMs;
            if (this.auraPulseTimer >= 2000) {
                this.auraPulseTimer = 0;
                const auraName = hero.getActiveAuraName();
                if (auraName === 'holyfire') {
                    let hitAny = false;
                    for (const m of this.monsters) {
                        if (!m.isDead && !m.remove) {
                            const d = Math.hypot(m.x - heroX, (m.y - heroY) * 2);
                            if (d <= 220) {
                                m.takeDamage(22);
                                this.spawnHitShock(m.x, m.y, 'holyfire_hit');
                                if (this.addDamageNumber) this.addDamageNumber(m.x, m.y - 45, 22, false, '#f97316');
                                hitAny = true;
                            }
                        }
                    }
                    if (hitAny) this.playSfx('castfire');
                } else if (auraName === 'holyshock') {
                    let hitAny = false;
                    for (const m of this.monsters) {
                        if (!m.isDead && !m.remove) {
                            const d = Math.hypot(m.x - heroX, (m.y - heroY) * 2);
                            if (d <= 260) {
                                m.takeDamage(42);
                                this.spawnHitShock(m.x, m.y, 'holyshock_hit');
                                if (this.addDamageNumber) this.addDamageNumber(m.x, m.y - 45, 42, false, '#facc15');
                                hitAny = true;
                            }
                        }
                    }
                    if (hitAny) this.playSfx('lightning1');
                } else if (auraName === 'holyfreeze' || auraName === 'freeze') {
                    let hitAny = false;
                    for (const m of this.monsters) {
                        if (!m.isDead && !m.remove) {
                            const d = Math.hypot(m.x - heroX, (m.y - heroY) * 2);
                            if (d <= 220) {
                                m.takeDamage(18);
                                m.isFrozen = true;
                                m.freezeTimer = 2500;
                                this.spawnHitShock(m.x, m.y, 'hit_shock');
                                if (this.addDamageNumber) this.addDamageNumber(m.x, m.y - 45, 18, false, '#38bdf8');
                                hitAny = true;
                            }
                        }
                    }
                    if (hitAny) this.playSfx('castcold');
                }
            }
        }

        // 5. 角色控制器 (CharacterController) 招牌技能實體碰撞判定 (聖光彈、天堂之拳落雷與散彈、祝聖之槌)
        if (hero) {
            // (1) 聖光彈 (Holy Bolt) 命中怪物判定 (依循 d2-engine Form F01 Pierce 穿透規範：貫穿敵群，嚴禁 splice 銷毀)
            if (hero.holyBolts && hero.holyBolts.length > 0) {
                for (let i = 0; i < hero.holyBolts.length; i++) {
                    const b = hero.holyBolts[i];
                    if (!b.hitMonsters) b.hitMonsters = new Set();
                    for (const m of this.monsters) {
                        if (!m.isDead && !m.remove && !b.hitMonsters.has(m)) {
                            const d = Math.hypot(m.x - b.x, ((m.y - 30) - b.y) * 2);
                            if (d < 50) {
                                m.takeDamage(42);
                                this.spawnHitShock(m.x, m.y);
                                if (this.addDamageNumber) this.addDamageNumber(m.x, m.y - 45, 42, false, '#38bdf8');
                                b.hitMonsters.add(m);
                                // 穿透敵怪不消失，直線持續飛行
                            }
                        }
                    }
                }
            }

            // (2) 天堂之拳 (Fist of the Heavens) 落雷天降與 6 發聖光散彈
            if (hero.fohStrikes && hero.fohStrikes.length > 0) {
                for (let i = 0; i < hero.fohStrikes.length; i++) {
                    const s = hero.fohStrikes[i];
                    if (s.progress === 1) {
                        for (const m of this.monsters) {
                            if (!m.isDead && !m.remove) {
                                const d = Math.hypot(m.x - s.x, (m.y - s.y) * 2);
                                if (d < 65) {
                                    m.takeDamage(68);
                                    this.spawnHitShock(m.x, m.y);
                                }
                            }
                        }
                    }
                    if (s.bolts && s.bolts.length > 0) {
                        for (let j = 0; j < s.bolts.length; j++) {
                            const b = s.bolts[j];
                            if (!b.hitMonsters) b.hitMonsters = new Set();
                            for (const m of this.monsters) {
                                if (!m.isDead && !m.remove && !b.hitMonsters.has(m)) {
                                    const d = Math.hypot(m.x - b.x, ((m.y - 30) - b.y) * 2);
                                    if (d < 45) {
                                        m.takeDamage(32);
                                        this.spawnHitShock(m.x, m.y);
                                        if (this.addDamageNumber) this.addDamageNumber(m.x, m.y - 40, 32, false, '#38bdf8');
                                        b.hitMonsters.add(m);
                                        // 散彈穿透
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // (3) 角色控制器本體的祝聖之槌
            if (hero.hammers && hero.hammers.length > 0) {
                for (let i = 0; i < hero.hammers.length; i++) {
                    const h = hero.hammers[i];
                    const curX = h.originX + Math.cos(h.angle) * h.radius;
                    const curY = h.originY + Math.sin(h.angle) * (h.radius * 0.55);
                    for (const m of this.monsters) {
                        if (!m.isDead && !m.remove) {
                            const d = Math.hypot(m.x - curX, (m.y - curY) * 2);
                            if (d < 32) {
                                if (!h.hitCooldowns) h.hitCooldowns = {};
                                const now = Date.now();
                                if (!h.hitCooldowns[m.type + m.x] || (now - h.hitCooldowns[m.type + m.x]) > 400) {
                                    h.hitCooldowns[m.type + m.x] = now;
                                    m.takeDamage(45);
                                    this.spawnHitShock(curX, curY);
                                }
                            }
                        }
                    }
                }
            }
        }

        // 6. 通用彈道投射物與法術物理更新 (支援 hammer, linear, nova, stream, charged_bolt)
        if (this.missileSystem) {
            this.syncMonstersToMissileTargets();
            this.missileSystem.step();
        }

        for (let i = this.missiles.length - 1; i >= 0; i--) {
            const mis = this.missiles[i];
            mis.lifetime += deltaMs;

            if (mis.mode === 'hammer') {
                mis.angle += 0.012 * deltaMs;
                mis.radius += 0.09 * deltaMs;
                mis.x = mis.centerX + Math.cos(mis.angle) * mis.radius;
                mis.y = mis.centerY + Math.sin(mis.angle) * mis.radius * 0.55;
                mis.frame = Math.floor(mis.lifetime / 40) % mis.meta.frames;

                for (const m of this.monsters) {
                    if (!m.isDead && !m.remove) {
                        const dx = m.x - mis.x;
                        const dy = m.y - mis.y;
                        if (Math.sqrt(dx * dx + dy * dy) < 32) {
                            m.takeDamage(mis.damage);
                            this.spawnHitShock(mis.x, mis.y);
                            break;
                        }
                    }
                }
                if (mis.lifetime >= 2200 || mis.radius > 320) {
                    this.missiles.splice(i, 1);
                }
            } else if (mis.mode === 'linear') {
                mis.x += mis.vx * deltaMs;
                mis.y += mis.vy * deltaMs * 0.55;
                mis.frame = Math.floor(mis.lifetime / 45) % mis.meta.frames;

                if (mis.type === 'bonespear') {
                    if (!mis.trailHistory) mis.trailHistory = [];
                    mis.trailHistory.push({ x: mis.x, y: mis.y, frame: mis.frame, dir: mis.direction, headingDeg: mis.headingDeg });
                    if (mis.trailHistory.length > 5) mis.trailHistory.shift();
                }

                if (mis.isEnemy) {
                    const dx = heroX - mis.x;
                    const dy = (heroY - mis.y) * 2;
                    if (Math.hypot(dx, dy) < 30) {
                        if (this.sandbox && this.sandbox.triggerHeroDamage) {
                            this.sandbox.triggerHeroDamage(mis.damage);
                        }
                        this.spawnHitShock(mis.x, mis.y);
                        this.missiles.splice(i, 1);
                        continue;
                    }
                } else {
                    // 友方英雄投射物打擊怪物判定 (火球、骨矛、白骨之牙、多重箭、標槍等)
                    if (mis.aoeRadius) {
                        // 範圍爆炸型投射物 (例如法師火球)
                        let detonated = false;
                        for (const m of this.monsters) {
                            if (!m.isDead && !m.remove) {
                                const dx = m.x - mis.x;
                                const dy = (m.y - mis.y) * 2;
                                if (Math.hypot(dx, dy) < 32) {
                                    detonated = true;
                                    break;
                                }
                            }
                        }
                        if (detonated) {
                            for (const m of this.monsters) {
                                if (!m.isDead && !m.remove) {
                                    const d = Math.hypot(m.x - mis.x, (m.y - mis.y) * 2);
                                    if (d <= mis.aoeRadius) {
                                        m.takeDamage(mis.damage);
                                        this.spawnHitShock(m.x, m.y);
                                    }
                                }
                            }
                            this.playSfx('boom1');
                            this.missiles.splice(i, 1);
                            continue;
                        }
                    } else if (mis.piercing) {
                        // 直線穿透型投射物 (例如死靈骨矛、刺客刃之怒)
                        if (!mis.hitSet) mis.hitSet = new Set();
                        for (const m of this.monsters) {
                            if (!m.isDead && !m.remove && !mis.hitSet.has(m)) {
                                const dx = m.x - mis.x;
                                const dy = (m.y - mis.y) * 2;
                                if (Math.hypot(dx, dy) < 30) {
                                    mis.hitSet.add(m);
                                    m.takeDamage(mis.damage);
                                    this.spawnHitShock(m.x, m.y);
                                }
                            }
                        }
                    } else {
                        // 單體命中型投射物 (白骨之牙、箭矢、標槍)
                        let hitAny = false;
                        for (const m of this.monsters) {
                            if (!m.isDead && !m.remove) {
                                const dx = m.x - mis.x;
                                const dy = (m.y - mis.y) * 2;
                                if (Math.hypot(dx, dy) < 30) {
                                    m.takeDamage(mis.damage);
                                    this.spawnHitShock(mis.x, mis.y);
                                    if (mis.knockback) {
                                        const kDist = Math.hypot(mis.vx, mis.vy) || 1;
                                        m.x += (mis.vx / kDist) * mis.knockback;
                                        m.y += (mis.vy / kDist) * mis.knockback * 0.5;
                                    }
                                    hitAny = true;
                                    break;
                                }
                            }
                        }
                        if (hitAny) {
                            this.missiles.splice(i, 1);
                            continue;
                        }
                    }
                }
                if (mis.lifetime >= (mis.maxLifetime || 2000)) {
                    this.missiles.splice(i, 1);
                }
            } else if (mis.mode === 'nova') {
                mis.radius += mis.speed * deltaMs;
                mis.frame = Math.floor(mis.lifetime / 35) % mis.meta.frames;

                if (mis.isEnemy && !mis.hasHitHero) {
                    const dx = heroX - mis.centerX;
                    const dy = (heroY - mis.centerY) * 2;
                    const distH = Math.hypot(dx, dy);
                    if (Math.abs(distH - mis.radius) < 26) {
                        mis.hasHitHero = true;
                        if (this.sandbox && this.sandbox.triggerHeroDamage) {
                            this.sandbox.triggerHeroDamage(mis.damage, mis.type === 'frost_nova');
                        }
                    }
                } else if (!mis.isEnemy) {
                    // 友方擴散型打擊
                    if (!mis.hitSet) mis.hitSet = new Set();
                    for (const m of this.monsters) {
                        if (!m.isDead && !m.remove && !mis.hitSet.has(m)) {
                            const dm = Math.hypot(m.x - mis.centerX, (m.y - mis.centerY) * 2);
                            if (Math.abs(dm - mis.radius) < 30) {
                                mis.hitSet.add(m);
                                m.takeDamage(mis.damage);
                                this.spawnHitShock(m.x, m.y);
                            }
                        }
                    }
                }

                if (mis.radius > mis.maxRadius) {
                    this.missiles.splice(i, 1);
                    continue;
                }

                const sheet = this.spriteManager.getSprite(mis.meta.atlas);
                if (!sheet || !sheet.img || !sheet.img.complete || sheet.img.naturalWidth === 0) continue;

                const meta = mis.meta || sheet.meta;
                const isCold = (mis.type === 'frost_nova');
                
                // 依據 d2-engine 規範：電系新星 ISO_Y: 0.455, 冰霜新星 ISO_Y: 0.54
                const ISO_Y = isCold ? 0.54 : 0.455;
                const TARGET_SPACING = isCold ? 8.0 : 7.0;
                
                const lifeRatio = mis.lifetime / (mis.maxLifetime || 1000);
                const alpha = Math.max(0, Math.min(1.0, 1.0 - lifeRatio * 0.8));

                ctx.save();
                ctx.globalCompositeOperation = 'lighter';

                let tiers = [];
                if (isCold) {
                    tiers = [{ r: mis.radius, aScale: 0.95 }, { r: mis.radius - 4.0, aScale: 0.85 }];
                } else {
                    tiers = mis.radius >= 45
                        ? [{ r: mis.radius, aScale: 0.70 }, { r: mis.radius - 7.5, aScale: 0.95 }, { r: mis.radius - 15.0, aScale: 0.70 }]
                        : [{ r: mis.radius, aScale: 0.95 }];
                }

                const DCC_16 = [
                    { row: 7,  deg: 0.0 }, { row: 14, deg: 22.5 }, { row: 3,  deg: 45.0 }, { row: 15, deg: 67.5 },
                    { row: 4,  deg: 90.0 }, { row: 8,  deg: 112.5 }, { row: 0,  deg: 135.0 }, { row: 9,  deg: 157.5 },
                    { row: 5,  deg: 180.0 }, { row: 10, deg: 202.5 }, { row: 1,  deg: 225.0 }, { row: 11, deg: 247.5 },
                    { row: 6,  deg: 270.0 }, { row: 12, deg: 292.5 }, { row: 2,  deg: 315.0 }, { row: 13, deg: 337.5 }
                ];
                const getDir16 = (angleDeg) => {
                    const ang = ((angleDeg % 360) + 360) % 360;
                    let best = DCC_16[0].row, minDiff = 999;
                    for (const d of DCC_16) {
                        const diff = Math.abs(((d.deg - ang + 180) % 360) - 180);
                        if (diff < minDiff) { minDiff = diff; best = d.row; }
                    }
                    return best;
                };

                for (let ri = 0; ri < tiers.length; ri++) {
                    const tier = tiers[ri];
                    if (tier.r <= 2) continue;
                    
                    const a = tier.r;
                    const b = tier.r * ISO_Y;
                    const lutSteps = 180;
                    const angles = [0];
                    const dists = [0];
                    let cum = 0, px = a, py = 0;
                    for (let lutIdx = 1; lutIdx <= lutSteps; lutIdx++) {
                        const t = (lutIdx / lutSteps) * Math.PI * 2;
                        const x = a * Math.cos(t), y = b * Math.sin(t);
                        cum += Math.hypot(x - px, y - py);
                        angles.push(t);
                        dists.push(cum);
                        px = x; py = y;
                    }
                    
                    const totalPerimeter = cum;
                    const getTheta = (dist) => {
                        const d = dist % totalPerimeter;
                        let low = 0, high = dists.length - 1;
                        while (low <= high) {
                            const mid = (low + high) >> 1;
                            if (dists[mid] < d) low = mid + 1;
                            else high = mid - 1;
                        }
                        const idx = Math.max(1, low);
                        const d0 = dists[idx - 1], d1 = dists[idx];
                        const t0 = angles[idx - 1], t1 = angles[idx];
                        const frac = d1 > d0 ? (d - d0) / (d1 - d0) : 0;
                        return t0 + (t1 - t0) * frac;
                    };

                    const numCount = Math.max(20, Math.round(totalPerimeter / TARGET_SPACING));
                    const step = totalPerimeter / numCount;

                    ctx.globalAlpha = alpha * tier.aScale;
                    const curFrame = mis.frame % meta.frames;
                    
                    for (let j = 0; j < numCount; j++) {
                        const theta = getTheta(j * step);
                        const pX = mis.centerX + a * Math.cos(theta);
                        const pY = mis.centerY + b * Math.sin(theta);
                        const radialDeg = ((Math.atan2(Math.sin(theta), Math.cos(theta)) * 180 / Math.PI) + 360) % 360;
                        const dirRow = getDir16(radialDeg);
                        const sx = curFrame * meta.cell_width;
                        const sy = dirRow * meta.cell_height;
                        
                        ctx.drawImage(
                            sheet.img,
                            sx, sy, meta.cell_width, meta.cell_height,
                            Math.round(pX - meta.pivot_x), Math.round(pY - meta.pivot_y),
                            meta.cell_width, meta.cell_height
                        );
                    }
                }
                ctx.restore();            } else if (mis.mode === 'stream') {
                mis.frame = Math.floor(mis.lifetime / 40) % mis.meta.frames;
                // 射線傷害判定 (每 180ms 造成打擊)
                mis.tickTimer = (mis.tickTimer || 0) + deltaMs;
                if (mis.tickTimer >= 180) {
                    mis.tickTimer = 0;
                    const dxH = heroX - mis.originX;
                    const dyH = (heroY - mis.originY) * 2;
                    const heroAngle = Math.atan2(dyH, dxH);
                    const angleDiff = Math.abs(heroAngle - mis.angle);
                    const heroDist = Math.hypot(dxH, dyH);
                    if (heroDist <= mis.length + 30 && angleDiff < 0.45) {
                        if (this.sandbox && this.sandbox.triggerHeroDamage) {
                            this.sandbox.triggerHeroDamage(Math.round(mis.damage / 3));
                        }
                        this.spawnHitShock(heroX, heroY);
                    }
                }
                if (mis.lifetime >= (mis.maxLifetime || 750)) {
                    this.missiles.splice(i, 1);
                }
            } else if (mis.mode === 'charged_bolt') {
                mis.angle += (Math.random() - 0.5) * 0.5;
                mis.x += Math.cos(mis.angle) * mis.speed * deltaMs;
                mis.y += Math.sin(mis.angle) * mis.speed * deltaMs * 0.55;
                mis.frame = Math.floor(mis.lifetime / 40) % mis.meta.frames;

                const sector = Math.round(((mis.angle * 180 / Math.PI + 360) % 360) / 22.5) % 16;
                mis.direction = sector;

                if (mis.isEnemy) {
                    const dx = heroX - mis.x;
                    const dy = (heroY - mis.y) * 2;
                    if (Math.hypot(dx, dy) < 24) {
                        if (this.sandbox && this.sandbox.triggerHeroDamage) {
                            this.sandbox.triggerHeroDamage(mis.damage);
                        }
                        this.spawnHitShock(mis.x, mis.y);
                        this.missiles.splice(i, 1);
                        continue;
                    }
                }
                if (mis.lifetime >= 2400) {
                    this.missiles.splice(i, 1);
                }
            }
        }

        // 呼叫全技能擴充物理更新
        if (this.updateExtendedMissiles) {
            this.updateExtendedMissiles(deltaMs, heroX, heroY);
        }

        // 4. 更新命中震盪 Overlay
        for (let i = this.overlays.length - 1; i >= 0; i--) {
            const ov = this.overlays[i];
            ov.time += deltaMs;
            ov.frame = Math.floor(ov.time / 35);
            if (ov.frame >= ov.meta.frames) {
                this.overlays.splice(i, 1);
            }
        }
    }

    processEvent(event) {
        if (!event) return;
        const type = event.type;

        switch (type) {
            case "tool_execute":
                this.handleToolExecute(event.payload);
                break;
            case "thinking":
                this.handleThinking(event.payload);
                break;
            case "tool_success":
                this.handleToolSuccess(event.payload);
                break;
            case "error_retry":
                this.handleErrorRetry(event.payload);
                break;
            case "task_start":
                this.spawnBoss();
                break;
            case "task_complete":
                this.handleTaskComplete(event.payload);
                break;
            default:
                break;
        }
    }

    handleToolExecute(payload) {
        const char = this.sandbox.character;
        if (!char) return;

        const aliveMonsters = this.monsters.filter(m => !m.isDead);
        if (aliveMonsters.length === 0) {
            this.spawnMobWave(null, 3);
        }

        const roll = Math.random();
        if (roll < 0.6) {
            char.triggerCast();
            this.spawnBlessedHammer(char.x, char.y);
        } else {
            char.triggerAttack();
            const nearest = this.getNearestMonster(char.x, char.y);
            if (nearest) {
                setTimeout(() => {
                    nearest.takeDamage(35);
                    this.spawnHitShock(nearest.x, nearest.y);
                }, 150);
            }
        }
    }

    handleThinking(payload) {
        const char = this.sandbox.character;
        if (char && char.state !== 'cast' && char.state !== 'attack') {
            char.setState('idle');
        }
    }

    handleToolSuccess(payload) {
        const alive = this.monsters.filter(m => !m.isDead && (!m.manifest || m.manifest.type !== 'boss'));
        if (alive.length > 0) {
            const target = alive[0];
            target.takeDamage(100);
            this.spawnHitShock(target.x, target.y);
        }
    }

    handleErrorRetry(payload) {
        const char = this.sandbox.character;
        if (char) {
            char.setState('idle');
        }
        if (!this.activeBoss) {
            this.spawnBoss();
        }
    }

    handleTaskComplete(payload) {
        for (const m of this.monsters) {
            if (!m.isDead) {
                m.takeDamage(9999);
                this.spawnHitShock(m.x, m.y);
            }
        }
    }

    onMonsterAttackHero(monster) {
        if (this.sandbox && this.sandbox.triggerHeroDamage) {
            let dmg = 8;
            if (monster.type === 'baal') dmg = 40;
            else if (monster.type === 'diablo') dmg = 35;
            else if (monster.type === 'mephisto') dmg = 32;
            else if (monster.type === 'duriel') dmg = 30;
            else if (monster.type === 'balrog') dmg = 28;
            else if (monster.type === 'blood_lord') dmg = 26;
            else if (monster.type === 'andariel') dmg = 25;
            else if (monster.type === 'blunderbore') dmg = 24;
            else if (monster.type === 'baal_minion') dmg = 22;
            else if (monster.type === 'council') dmg = 20;
            else if (monster.type === 'sand_maggot') dmg = 18;
            else if (monster.type === 'succubus') dmg = 18;
            else if (monster.type === 'frog_demon') dmg = 16;
            else if (monster.type === 'goatman') dmg = 15;
            else if (monster.type === 'doom_knight') dmg = 15;
            else if (monster.type === 'fetish_shaman') dmg = 15;
            else if (monster.type === 'fallen_shaman') dmg = 14;
            else if (monster.type === 'fetish') dmg = 14;
            else if (monster.type === 'mummy') dmg = 12;
            else if (monster.type === 'beetle') dmg = 10;
            else if (monster.type === 'wraith') dmg = 9;
            else if (monster.type === 'spider') dmg = 8;
            else if (monster.type === 'zombie') dmg = 10;
            else if (monster.type === 'skeleton') dmg = 9;
            else if (monster.type === 'fallen') dmg = 6;
            this.sandbox.triggerHeroDamage(dmg);
        }
    }

    clearAllMonsters() {
        this.monsters = [];
        this.missiles = [];
        this.overlays = [];
        this.activeBoss = null;
        this.hideBossBar();
        if (this.missileSystem) {
            this.missileSystem.manager.clearAll();
            if (this.targetMap) this.targetMap.clear();
            if (this.missileSystem.targets) this.missileSystem.targets.clear();
        }
    }

    spawnMobWave(type = null, count = 3) {
        const char = this.sandbox.character;
        const cx = char ? char.x : 400;
        const cy = char ? char.y : 300;

        const currentScene = (this.sandbox && this.sandbox.getCurrentScene) ? this.sandbox.getCurrentScene() : null;
        const availableTypes = (currentScene && currentScene.mobs && currentScene.mobs.length > 0)
            ? currentScene.mobs
            : ['fallen', 'skeleton', 'zombie', 'spider', 'wraith', 'beetle', 'mummy', 'doom_knight'];

        const shuffledPool = [...availableTypes].sort(() => Math.random() - 0.5);

        if (!this.manifest || Object.keys(this.manifest).length === 0) {
            this.manifest = window.D2_MONSTERS_MANIFEST || {};
        }

        for (let i = 0; i < count; i++) {
            const mType = (type && this.manifest[type]) ? type : shuffledPool[i % shuffledPool.length];
            const angle = Math.random() * Math.PI * 2;
            const dist = 180 + Math.random() * 90;
            const mx = cx + Math.cos(angle) * dist;
            const my = cy + Math.sin(angle) * dist * 0.5;
            this.monsters.push(new MonsterEntity(mType, mx, my, this.manifest, this));
        }

        if (this.v2Player) {
            this.v2Player.dummies = this.monsters.filter(m => !m.isDead && !m.remove);
        }
        if (this.playSfx) {
            this.playSfx('fallen_attack1');
        }
    }

    spawnMonster(type = 'skeleton', x = 0, y = 0) {
        if (!this.manifest || Object.keys(this.manifest).length === 0) {
            this.manifest = window.D2_MONSTERS_MANIFEST || {};
        }
        const mType = (type && this.manifest && this.manifest[type]) ? type : (this.manifest && this.manifest['skeleton'] ? 'skeleton' : 'fallen');
        const m = new MonsterEntity(mType, x, y, this.manifest, this);
        this.monsters.push(m);
        if (this.v2Player) {
            this.v2Player.dummies = this.monsters.filter(mon => !mon.isDead && !mon.remove);
        }
        return m;
    }

    spawnBoss(bossType = null) {
        if (this.activeBoss && !this.activeBoss.isDead) return;
        const char = this.sandbox.character;
        const cx = char ? char.x : 400;
        const cy = char ? char.y : 300;

        const currentScene = (this.sandbox && this.sandbox.getCurrentScene) ? this.sandbox.getCurrentScene() : null;
        const targetBossType = (bossType && this.manifest[bossType])
            ? bossType
            : (currentScene && currentScene.boss ? currentScene.boss : 'andariel');

        const bossMeta = this.manifest[targetBossType] || this.manifest['andariel'];
        const boss = new MonsterEntity(targetBossType, cx + 180, cy - 80, this.manifest, this);
        this.monsters.push(boss);
        this.activeBoss = boss;
        this.showBossBar(bossMeta.title || bossMeta.name, boss);
    }

    // 祝聖之槌
    spawnBlessedHammer(cx, cy) {
        const hammerMeta = this.fxManifest.skills ? this.fxManifest.skills.hammer : null;
        if (!hammerMeta) return;

        this.missiles.push({
            mode: "hammer",
            type: "hammer",
            centerX: cx,
            centerY: cy - 20,
            x: cx,
            y: cy - 20,
            angle: Math.random() * Math.PI * 2,
            radius: 20,
            lifetime: 0,
            damage: 45,
            frame: 0,
            meta: hammerMeta
        });
    }

    // 安達利爾劇毒新星 (由腳下 360 度發散)
    spawnPoisonNova(cx, cy, dmg = 25) {
        const meta = this.fxManifest.skills ? this.fxManifest.skills.poison_nova : null;
        if (!meta) return;
        this.playSfx('poisoncast');

        this.missiles.push({
            mode: "nova",
            type: "poison_nova",
            centerX: cx,
            centerY: cy, // 腳底接觸點地面基準
            radius: 12,
            maxRadius: 280,
            speed: 0.16,
            lifetime: 0,
            damage: dmg,
            frame: 0,
            numBolts: 32,
            isEnemy: true,
            hasHitHero: false,
            meta: meta
        });
    }

    // 墨菲斯托 / 巴爾冰霜新星
    spawnFrostNova(cx, cy, dmg = 24) {
        const meta = this.fxManifest.skills ? this.fxManifest.skills.frost_nova : null;
        if (!meta) return;
        this.playSfx('castcold');

        this.missiles.push({
            mode: "nova",
            type: "frost_nova",
            centerX: cx,
            centerY: cy, // 腳底地面基準
            radius: 12,
            maxRadius: 260,
            speed: 0.16,
            lifetime: 0,
            damage: dmg,
            frame: 0,
            numBolts: 16,
            isEnemy: true,
            hasHitHero: false,
            meta: meta
        });
    }

    // 暗黑破壞神 / 巨大惡魔火焰新星
    spawnFireNova(cx, cy, dmg = 28) {
        const meta = this.fxManifest.skills ? this.fxManifest.skills.fire_nova : null;
        if (!meta) return;
        this.playSfx('castfire');

        this.missiles.push({
            mode: "nova",
            type: "fire_nova",
            centerX: cx,
            centerY: cy, // 腳底地面基準
            radius: 12,
            maxRadius: 270,
            speed: 0.18,
            lifetime: 0,
            damage: dmg,
            frame: 0,
            numBolts: 16,
            isEnemy: true,
            hasHitHero: false,
            meta: meta
        });
    }

    // 首領連續射線 (暗黑破壞神紅色閃電、巴爾冰浪、電光)
    spawnEnemyStream(skillType, originX, originY, targetX, targetY, dmg = 30) {
        const meta = this.fxManifest.skills ? this.fxManifest.skills[skillType] : null;
        if (!meta) return;
        if (skillType === 'diablo_lightning') this.playSfx('castlazer');
        else if (skillType === 'baal_cold_wave') this.playSfx('castcold');
        else this.playSfx('lightning1');

        const dx = targetX - originX;
        const dy = (targetY - originY) * 2;
        const angle = Math.atan2(dy, dx);
        const dist = Math.hypot(dx, dy);

        // 8 方向換算
        const deg = (angle * 180 / Math.PI + 360) % 360;
        const sector = Math.round(deg / 45) % 8;
        const DCC_MAP = [7, 3, 4, 0, 5, 1, 6, 2];
        const dir = DCC_MAP[sector];

        // 迪亞布羅伸手完全時，紅色閃電自右爪前端（手的前端）爆發噴湧，身軀胸膛完全不被閃電遮擋穿透
        let startX = originX;
        let startY = originY - 30;
        if (skillType === 'diablo_lightning') {
            startX = originX + Math.cos(angle) * 85;
            startY = originY - 80 + Math.sin(angle) * 35;
        } else if (skillType === 'baal_cold_wave') {
            startX = originX + Math.cos(angle) * 60;
            startY = originY - 70 + Math.sin(angle) * 25;
        }

        this.missiles.push({
            mode: "stream",
            type: skillType,
            originX: startX,
            originY: startY,
            angle: angle,
            length: Math.min(320, dist + 60),
            direction: dir,
            lifetime: 0,
            maxLifetime: 750,
            damage: dmg,
            frame: 0,
            numSegments: 4,
            isEnemy: true,
            meta: meta
        });
    }

    // 怪物/首領線性法術投射物 (火球、血之星、邪靈彈、毒液、骨魂)
    spawnEnemyProjectile(skillType, sx, sy, tx, ty, dmg = 18, speed = 0.22) {
        const meta = this.fxManifest.skills ? this.fxManifest.skills[skillType] : null;
        if (!meta) return;

        if (skillType === 'shaman_fireball') this.playSfx('castfire');
        else if (skillType === 'bone_spirit') this.playSfx('bonespirit1');
        else if (skillType === 'unholy_bolt') this.playSfx('unholycast');
        else this.playSfx('poisoncast');

        const dx = tx - sx;
        const dy = (ty - sy) * 2;
        const angle = Math.atan2(dy, dx);
        const dist = Math.hypot(dx, dy);
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        const headingDeg = window.D2_MISSILE_LANDMARKS
            ? window.D2_MISSILE_LANDMARKS.getScreenHeading(vx, vy * 0.55)
            : ((Math.atan2(vy * 0.55, vx) * 180 / Math.PI + 90 + 360) % 360);
        let dir = (skillType === 'shaman_fireball' && window.D2_MISSILE_LANDMARKS)
            ? window.D2_MISSILE_LANDMARKS.resolveDirectionRow('fireball', headingDeg)
            : this.getDccDirectionRow(meta.directions, (angle * 180 / Math.PI + 360) % 360, skillType);

        this.missiles.push({
            mode: "linear",
            type: (skillType === 'shaman_fireball') ? 'fireball' : skillType,
            x: sx,
            y: sy - 25,
            vx: vx,
            vy: vy,
            direction: dir,
            headingDeg: headingDeg,
            lifetime: 0,
            maxLifetime: (dist / speed) + 300,
            damage: dmg,
            frame: 0,
            isEnemy: true,
            meta: meta
        });
    }

    // 充能彈 (聖甲蟲受擊反擊 / 墨菲斯托充能彈)
    spawnChargedBolts(cx, cy, count = 4, targetX = null, targetY = null) {
        const meta = this.fxManifest.skills ? this.fxManifest.skills.charged_bolt : null;
        if (!meta) return;
        this.playSfx('castelectric');

        let baseAngle = Math.random() * Math.PI * 2;
        if (targetX !== null && targetY !== null) {
            baseAngle = Math.atan2((targetY - cy) * 2, targetX - cx);
        }

        for (let i = 0; i < count; i++) {
            const angle = baseAngle + (i - (count - 1) / 2) * 0.35 + (Math.random() - 0.5) * 0.2;
            this.missiles.push({
                mode: "charged_bolt",
                type: "charged_bolt",
                x: cx,
                y: cy - 10,
                angle: angle,
                speed: 0.13 + Math.random() * 0.05,
                direction: 0,
                lifetime: 0,
                damage: 10,
                frame: 0,
                isEnemy: true,
                meta: meta
            });
        }
    }

    spawnHitShock(x, y, type = "hit_shock") {
        const shockMeta = this.fxManifest.skills ? this.fxManifest.skills[type] : null;
        if (!shockMeta) return;

        let py = y - 25;
        if (type === "holyshock_hit") py = y;
        else if (type === "holyfire_hit") py = y - 10;

        this.overlays.push({
            type: type,
            x: x,
            y: py,
            time: 0,
            frame: 0,
            meta: shockMeta
        });
    }

    /**
     * 七大職業英雄技能生成統一調度器 (100% 原廠 MPQ DCC 轉碼素材，零手繪)
     */
    spawnHeroSkill(skillType, hx, hy, tx = null, ty = null) {
        if (!tx || !ty) {
            tx = hx + 120;
            ty = hy + 60;
        }

        // 優先派發全技能擴充引擎處理 (100% 覆蓋所有勾選 [x] 技能，杜絕空轉)
        if (this.handleExtendedHeroSkill && this.handleExtendedHeroSkill(skillType, hx, hy, tx, ty)) {
            return;
        }

        switch (skillType) {
            case 'fireball':
            case 'fireball_single':
                this.spawnHeroFireball(hx, hy, tx, ty);
                break;
            case 'charged_bolt':
            case 'chargedbolt':
                this.spawnHeroChargedBolt(hx, hy, tx, ty);
                break;
            case 'blizzard':
                this.spawnHeroBlizzard(tx, ty);
                break;
            case 'frost_nova':
                this.spawnHeroFrostNova(hx, hy);
                break;
            case 'bonespear':
                this.spawnHeroBoneSpear(hx, hy, tx, ty);
                break;
            case 'teeth':
                this.spawnHeroTeeth(hx, hy, tx, ty);
                break;
            case 'bone_spirit':
                this.spawnHeroBoneSpirit(hx, hy, tx, ty);
                break;
            case 'warcry':
                this.spawnHeroWarCry(hx, hy);
                break;
            case 'whirlwind':
                this.spawnHeroWhirlwind(hx, hy, tx, ty);
                break;
            case 'tornado':
                this.spawnHeroTornado(hx, hy, tx, ty);
                break;
            case 'arrow':
            case 'arrow_basic':
                this.spawnHeroArrow(hx, hy, tx, ty);
                break;
            case 'multishot':
                this.spawnHeroMultishot(hx, hy, tx, ty);
                break;
            case 'javelin':
            case 'javelin_throw':
                this.spawnHeroJavelin(hx, hy, tx, ty);
                break;
            case 'trap_lightning':
                this.spawnHeroLightningTrap(tx, ty);
                break;
            case 'blade_fury':
                this.spawnHeroBladeFury(hx, hy, tx, ty);
                break;
            default:
                break;
        }
    }

    // 魔法使 (Sorceress) 炎爆火球 (16方向直線飛行，碰撞引爆 80px AoE，原廠 InitSteps = 1 前推)
    spawnHeroFireball(hx, hy, tx, ty) {
        this.playSfx('castfire');
        const dx = tx - hx;
        const dy = ty - hy;
        const angle = Math.atan2(dy, dx);
        const headingDeg = window.D2_MISSILE_LANDMARKS
            ? window.D2_MISSILE_LANDMARKS.getScreenHeading(dx, dy)
            : ((Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360);

        // 原廠 InitSteps = 1 前推 (18px)
        const initPush = 18;
        const sx = hx + Math.cos(angle) * initPush;
        const sy = hy + Math.sin(angle) * initPush;

        if (this.missileSystem) {
            const phi = ((angle * 180 / Math.PI) + 360) % 360;
            this.missileSystem.manager.spawnById('fireball', sx, sy, phi, 1, -1);
            return;
        }

        const meta = this.fxManifest.skills ? this.fxManifest.skills.fireball : null;
        if (!meta) return;

        const dist = Math.hypot(dx, dy);
        const speed = 0.32;
        const dir = window.D2_MISSILE_LANDMARKS
            ? window.D2_MISSILE_LANDMARKS.resolveDirectionRow('fireball', headingDeg)
            : this.getDccDirectionRow(16, (angle * 180 / Math.PI + 360) % 360, 'fireball');

        this.missiles.push({
            mode: "linear",
            type: "fireball",
            x: sx,
            y: sy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            direction: dir,
            headingDeg: headingDeg,
            lifetime: 0,
            maxLifetime: (dist / speed) + 300,
            damage: 48,
            aoeRadius: 80,
            isEnemy: false,
            meta: meta
        });
    }

    // 魔法使 (Sorceress) 充能彈 (散射 7 發電火花，隨機折線前進，原廠 InitSteps = 1 前推)
    spawnHeroChargedBolt(hx, hy, tx, ty) {
        this.playSfx('castelectric');
        const dx = tx - hx;
        const dy = ty - hy;
        const angle = Math.atan2(dy, dx);
        const initPush = 16;
        const sx = hx + Math.cos(angle) * initPush;
        const sy = hy + Math.sin(angle) * initPush;

        if (this.missileSystem) {
            const basePhi = ((angle * 180 / Math.PI) + 360) % 360;
            for (let i = -3; i <= 3; i++) {
                const spreadPhi = ((basePhi + i * 9) + 360) % 360;
                this.missileSystem.manager.spawnById('chargedbolt', sx, sy, spreadPhi, 1, -1);
            }
            return;
        }

        const meta = this.fxManifest.skills ? this.fxManifest.skills.charged_bolt : null;
        if (!meta) return;
        const baseAngle = Math.atan2(dy, dx);
        for (let i = 0; i < 5; i++) {
            const boltAngle = baseAngle + (i - 2) * 0.25;
            this.missiles.push({
                mode: "charged_bolt",
                type: "charged_bolt",
                x: sx,
                y: sy,
                angle: boltAngle,
                speed: 0.22,
                direction: 0,
                lifetime: 0,
                damage: 22,
                frame: 0,
                isEnemy: false,
                meta: meta
            });
        }
    }

    // 魔法使 (Sorceress) 暴風雪 (天降冰錐風暴，連續砸地 AoE)
    spawnHeroBlizzard(tx, ty) {
        this.playSfx('castcold');
        this.missiles.push({
            mode: "blizzard_storm",
            type: "blizzard",
            centerX: tx,
            centerY: ty,
            lifetime: 0,
            maxLifetime: 2200,
            isEnemy: false
        });
    }

    // 魔法使 (Sorceress) 冰霜新星 (360度環形極寒衝擊波)
    spawnHeroFrostNova(hx, hy) {
        const meta = this.fxManifest.skills ? this.fxManifest.skills.frost_nova : null;
        if (!meta) return;
        this.playSfx('castcold');

        this.missiles.push({
            mode: "nova",
            type: "frost_nova",
            centerX: hx,
            centerY: hy,
            radius: 12,
            maxRadius: 260,
            speed: 0.18,
            lifetime: 0,
            damage: 35,
            frame: 0,
            numBolts: 16,
            isEnemy: false,
            meta: meta
        });
    }

    // 死靈法師 (Necromancer) 骨矛 (16方向極速直線貫穿，原廠手部發射 + 12px 槍尖前推)
    spawnHeroBoneSpear(hx, hy, tx, ty) {
        const meta = this.fxManifest.skills ? this.fxManifest.skills.bonespear : null;
        if (!meta) return;
        this.playSfx('bonespear1');

        const dx = tx - hx;
        const dy = ty - hy;
        const angle = Math.atan2(dy, dx);
        const dist = Math.hypot(dx, dy);
        const speed = 0.42;

        const headingDeg = window.D2_MISSILE_LANDMARKS
            ? window.D2_MISSILE_LANDMARKS.getScreenHeading(dx, dy)
            : ((Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360);
        const dir = window.D2_MISSILE_LANDMARKS
            ? window.D2_MISSILE_LANDMARKS.resolveDirectionRow('bonespear', headingDeg)
            : this.getDccDirectionRow(16, (angle * 180 / Math.PI + 360) % 360, 'bonespear');

        // 原廠手部發射 + 12px 槍尖前推
        const initPush = 12;
        const sx = hx + Math.cos(angle) * initPush;
        const sy = hy + Math.sin(angle) * initPush;

        this.missiles.push({
            mode: "linear",
            type: "bonespear",
            x: sx,
            y: sy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            direction: dir,
            headingDeg: headingDeg,
            trailHistory: [],
            lifetime: 0,
            maxLifetime: (dist / speed) + 400,
            damage: 54,
            piercing: true,
            isEnemy: false,
            meta: meta
        });
    }

    // 死靈法師 (Necromancer) 白骨之牙 (從手部/法杖發散 7 枚扇形骨牙，原廠 InitSteps = 1 前推 16px)
    spawnHeroTeeth(hx, hy, tx, ty) {
        const meta = this.fxManifest.skills ? this.fxManifest.skills.teeth : null;
        if (!meta) return;
        this.playSfx('bonecast');

        const dx = tx - hx;
        const dy = ty - hy;
        const baseAngle = Math.atan2(dy, dx);
        const count = 7; // 7 發密集骨牙
        const speed = 0.38;
        const fanSpread = 28 * (Math.PI / 180); // 28度緊湊小扇形

        for (let i = 0; i < count; i++) {
            const offset = (count > 1) ? ((i / (count - 1)) - 0.5) * fanSpread : 0;
            const angle = baseAngle + offset;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;

            const toothHeadingDeg = window.D2_MISSILE_LANDMARKS
                ? window.D2_MISSILE_LANDMARKS.getScreenHeading(vx, vy * 0.55)
                : ((Math.atan2(vy * 0.55, vx) * 180 / Math.PI + 90 + 360) % 360);
            const dir = window.D2_MISSILE_LANDMARKS
                ? window.D2_MISSILE_LANDMARKS.resolveDirectionRow('teeth', toothHeadingDeg)
                : this.getDccDirectionRow(32, ((Math.atan2(vy * 0.55, vx) * 180 / Math.PI) + 360) % 360, 'teeth');

            // 原廠 InitSteps = 1 前推 (16px)
            const sx = hx + Math.cos(angle) * 16;
            const sy = hy + Math.sin(angle) * 16;

            this.missiles.push({
                mode: "linear",
                type: "teeth",
                x: sx,
                y: sy,
                vx: vx,
                vy: vy,
                direction: dir,
                headingDeg: toothHeadingDeg,
                lifetime: 0,
                maxLifetime: 1400,
                damage: 24,
                isEnemy: false,
                meta: meta
            });
        }
    }

    // 死靈法師 (Necromancer) 白骨之魂 (手部發射 + 原廠 InitSteps = 1 前推 16px)
    spawnHeroBoneSpirit(hx, hy, tx, ty) {
        this.playSfx('bonespirit1');
        const dx = tx - hx;
        const dy = ty - hy;
        const angle = Math.atan2(dy, dx);
        const initPush = 16;
        const sx = hx + Math.cos(angle) * initPush;
        const sy = hy + Math.sin(angle) * initPush;

        if (this.missileSystem) {
            const phi = ((angle * 180 / Math.PI) + 360) % 360;
            let targetId = -1;
            if (this.missileSystem.targets) {
                targetId = this.missileSystem.targets.findNearestUnit(sx, sy, 800, 1);
            }
            this.missileSystem.manager.spawnById('bonespirit', sx, sy, phi, 1, targetId);
            return;
        }

        const meta = this.fxManifest.skills ? this.fxManifest.skills.bone_spirit : null;
        if (!meta) return;

        const speed = 0.32;
        const deg = (angle * 180 / Math.PI + 360) % 360;
        const dir = this.getDccDirectionRow(8, deg, 'bone_spirit');

        this.missiles.push({
            mode: "linear",
            type: "bone_spirit",
            x: sx,
            y: sy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            direction: dir,
            lifetime: 0,
            maxLifetime: 1800,
            damage: 65,
            aoeRadius: 40,
            isEnemy: false,
            meta: meta
        });
    }

    // 野蠻人 (Barbarian) 狂嗥戰吼 (32方向環形音波擴散震退怪群)
    spawnHeroWarCry(hx, hy) {
        const meta = this.fxManifest.skills ? this.fxManifest.skills.warcry : null;
        if (!meta) return;
        this.playSfx('circle_warcry');

        this.missiles.push({
            mode: "nova",
            type: "warcry",
            centerX: hx,
            centerY: hy,
            radius: 12,
            maxRadius: 220,
            speed: 0.22,
            lifetime: 0,
            damage: 46,
            frame: 0,
            numBolts: 32,
            isEnemy: false,
            meta: meta
        });
    }

    // 德魯伊 (Druid) 狂風龍捲 (41幀呼嘯扭動前進，依據原廠第三類地表氣旋規範以腳底地表為幾何原點，InitSteps = 0)
    spawnHeroTornado(hx, hy, tx, ty) {
        const meta = this.fxManifest.skills ? this.fxManifest.skills.tornado : null;
        if (!meta) return;
        this.playSfx('tornado');

        const dx = tx - hx;
        const dy = ty - hy;
        const angle = Math.atan2(dy, dx);
        const speed = 0.25;

        // 原廠 Missiles.txt 規範：InitSteps = 0，風眼底座緊咬地表網格生成
        const sx = hx;
        const sy = hy;

        this.missiles.push({
            mode: "tornado",
            type: "tornado",
            x: sx,
            y: sy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            lifetime: 0,
            maxLifetime: 2400,
            damage: 34,
            isEnemy: false,
            meta: meta
        });
    }

    // 亞馬遜 (Amazon) 速射箭矢 (單發高速物理箭矢，手部拉弓 + 原廠 InitSteps = 1 前推 18px)
    spawnHeroArrow(hx, hy, tx, ty) {
        const meta = this.fxManifest.skills ? this.fxManifest.skills.arrow : null;
        if (!meta) return;
        this.playSfx('arrow1');

        const dx = tx - hx;
        const dy = ty - hy;
        const dist = Math.hypot(dx, dy);
        const speed = 0.52;
        const angle = Math.atan2(dy, dx);

        const headingDeg = window.D2_MISSILE_LANDMARKS
            ? window.D2_MISSILE_LANDMARKS.getScreenHeading(dx, dy)
            : ((Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360);
        const dir = window.D2_MISSILE_LANDMARKS
            ? window.D2_MISSILE_LANDMARKS.resolveDirectionRow('arrow', headingDeg)
            : Math.round(((angle * 180 / Math.PI + 360) % 360) / 11.25) % 32;

        // 原廠 InitSteps = 1 前推 (18px)
        const initPush = 18;
        const sx = hx + Math.cos(angle) * initPush;
        const sy = hy + Math.sin(angle) * initPush;

        this.missiles.push({
            mode: "linear",
            type: "arrow",
            x: sx,
            y: sy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            direction: dir,
            headingDeg: headingDeg,
            lifetime: 0,
            maxLifetime: (dist / speed) + 300,
            damage: 42,
            isEnemy: false,
            knockback: 14,
            meta: meta
        });
    }

    // 亞馬遜 (Amazon) 多重射箭 (5發扇形高速穿透箭矢，手部發射 + 原廠 InitSteps = 1 前推 18px)
    spawnHeroMultishot(hx, hy, tx, ty) {
        const meta = this.fxManifest.skills ? this.fxManifest.skills.arrow : null;
        if (!meta) return;
        this.playSfx('arrow1');

        const dx = tx - hx;
        const dy = ty - hy;
        const baseAngle = Math.atan2(dy, dx);
        const count = 5;
        const speed = 0.48;

        for (let i = 0; i < count; i++) {
            const offset = (i - (count - 1) / 2) * 0.12;
            const angle = baseAngle + offset;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const headingDeg = window.D2_MISSILE_LANDMARKS
                ? window.D2_MISSILE_LANDMARKS.getScreenHeading(vx, vy)
                : ((Math.atan2(vy, vx) * 180 / Math.PI + 90 + 360) % 360);
            const dir = window.D2_MISSILE_LANDMARKS
                ? window.D2_MISSILE_LANDMARKS.resolveDirectionRow('arrow', headingDeg)
                : Math.round(((angle * 180 / Math.PI + 360) % 360) / 11.25) % 32;

            // 原廠 InitSteps = 1 前推 (18px)
            const sx = hx + Math.cos(angle) * 18;
            const sy = hy + Math.sin(angle) * 18;

            this.missiles.push({
                mode: "linear",
                type: "arrow",
                x: sx,
                y: sy,
                vx: vx,
                vy: vy,
                direction: dir,
                headingDeg: headingDeg,
                lifetime: 0,
                maxLifetime: 1500,
                damage: 32,
                isEnemy: false,
                meta: meta
            });
        }
    }

    // 亞馬遜 (Amazon) 雷霆標槍 (高傷貫穿附帶雷擊，手部投擲 + 14px 前推)
    spawnHeroJavelin(hx, hy, tx, ty) {
        const meta = this.fxManifest.skills ? this.fxManifest.skills.javelin : null;
        if (!meta) return;
        this.playSfx('magicarrow1');

        const dx = tx - hx;
        const dy = ty - hy;
        const angle = Math.atan2(dy, dx);
        const speed = 0.42;

        const headingDeg = window.D2_MISSILE_LANDMARKS
            ? window.D2_MISSILE_LANDMARKS.getScreenHeading(dx, dy)
            : ((Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360);
        const dir = window.D2_MISSILE_LANDMARKS
            ? window.D2_MISSILE_LANDMARKS.resolveDirectionRow('javelin', headingDeg)
            : Math.round(((angle * 180 / Math.PI + 360) % 360) / 11.25) % 32;

        // 原廠手部投擲 + 14px 槍尖前推
        const initPush = 14;
        const sx = hx + Math.cos(angle) * initPush;
        const sy = hy + Math.sin(angle) * initPush;

        this.missiles.push({
            mode: "linear",
            type: "javelin",
            x: sx,
            y: sy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            direction: dir,
            headingDeg: headingDeg,
            lifetime: 0,
            maxLifetime: 1600,
            damage: 52,
            aoeRadius: 60,
            isEnemy: false,
            meta: meta
        });
    }

    // 刺客 (Assassin) 雷電陷阱 (地面佈設電弧機關)
    spawnHeroLightningTrap(tx, ty) {
        const meta = this.fxManifest.skills ? this.fxManifest.skills.trap_lightning : null;
        if (!meta) return;
        this.playSfx('lightning1');

        this.missiles.push({
            mode: "trap",
            type: "trap_lightning",
            x: tx,
            y: ty,
            lifetime: 0,
            maxLifetime: 10000,
            isEnemy: false,
            meta: meta
        });
    }

    // 刺客 (Assassin) 利刃之怒 (連續旋轉暗殺飛刃 - 手部發射 + 原廠 InitSteps = 1 前推 16px)
    spawnHeroBladeFury(hx, hy, tx, ty) {
        const meta = this.fxManifest.skills ? this.fxManifest.skills.blade_fury : null;
        if (!meta) return;
        this.playSfx('bladefury1');

        const dx = tx - hx;
        const dy = ty - hy;
        const baseAngle = Math.atan2(dy, dx);
        const speed = 0.46;

        // 連續發射 3 枚高速旋轉暗殺手裏劍
        for (let k = 0; k < 3; k++) {
            const spread = (k - 1) * 0.08;
            const angle = baseAngle + spread;
            const sx = hx + Math.cos(angle) * 16;
            const sy = hy + Math.sin(angle) * 16;

            this.missiles.push({
                mode: "linear",
                type: "blade_fury",
                x: sx + (Math.random() - 0.5) * 4,
                y: sy + (Math.random() - 0.5) * 4,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                direction: 0,
                lifetime: -k * 80, // 微延遲依序飛出
                maxLifetime: 1200,
                damage: 34,
                piercing: true,
                isEnemy: false,
                meta: meta
            });
        }
    }

    // 野蠻人 (Barbarian) 旋風斬 (Whirlwind - 旋轉刀環、穿透群怪)
    spawnHeroWhirlwind(hx, hy, tx, ty) {
        const meta = this.fxManifest.skills ? this.fxManifest.skills.whirlwind : null;
        if (!meta) return;
        this.playSfx('whirlwind1');

        const dx = tx - hx;
        const dy = (ty - hy) * 2;
        const dist = Math.hypot(dx, dy);
        const dirX = dist > 0.001 ? (dx / dist) : 1;
        const dirY = dist > 0.001 ? (dy / dist) : 0;

        this.missiles.push({
            mode: "whirlwind",
            type: "whirlwind",
            hero: this.sandbox ? this.sandbox.character : null,
            startX: hx,
            startY: hy,
            targetX: tx,
            targetY: ty,
            dirX: dirX,
            dirY: dirY,
            speed: 0.38,
            lifetime: 0,
            maxLifetime: 1100,
            tickTimer: 0,
            meta: meta
        });
    }

    // 刺客雷電陷阱放電電弧 (地面機關射出連鎖電光射線)
    spawnTrapArc(x1, y1, x2, y2) {
        const meta = this.fxManifest.skills ? this.fxManifest.skills.lightning : null;
        this.missiles.push({
            mode: "trap_arc",
            type: "lightning",
            x1: x1,
            y1: y1,
            x2: x2,
            y2: y2,
            lifetime: 0,
            maxLifetime: 180,
            meta: meta
        });
    }

    getNearestMonster(x, y) {
        let nearest = null;
        let minDist = 99999;
        for (const m of this.monsters) {
            if (!m.isDead && !m.remove) {
                const dist = Math.sqrt((m.x - x) ** 2 + (m.y - y) ** 2);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = m;
                }
            }
        }
        return nearest;
    }

    findMonsterAt(x, y) {
        const sorted = [...this.monsters]
            .filter(m => !m.isDead && !m.remove)
            .sort((a, b) => b.y - a.y);
        for (const m of sorted) {
            if (m.containsPoint(x, y)) {
                return m;
            }
        }
        return null;
    }

    setHoveredMonster(target) {
        for (const m of this.monsters) {
            m.hovered = (m === target);
        }
    }

    showBossBar(title, boss) {
        let el = document.getElementById("d2-boss-hud-bar");
        if (!el) {
            el = document.createElement("div");
            el.id = "d2-boss-hud-bar";
            el.style.position = "fixed";
            el.style.top = "15px";
            el.style.left = "50%";
            el.style.transform = "translateX(-50%)";
            el.style.zIndex = "99998";
            el.style.textAlign = "center";
            el.style.pointerEvents = "none";
            el.innerHTML = `
                <div id="d2-boss-title-text" style="font-family: 'Cinzel', serif; font-size: 13px; color: #f59e0b; letter-spacing: 2px; text-shadow: 0 0 8px #d97706; margin-bottom: 4px;">${title}</div>
                <div style="width: 320px; height: 10px; background: rgba(0,0,0,0.8); border: 1px solid #78350f; border-radius: 2px; overflow: hidden; margin: 0 auto; box-shadow: 0 0 10px rgba(0,0,0,0.8);">
                    <div id="d2-boss-hp-fill" style="width: 100%; height: 100%; background: linear-gradient(90deg, #b91c1c, #ef4444); transition: width 0.15s ease;"></div>
                </div>
            `;
            document.body.appendChild(el);
        } else {
            const titleEl = el.querySelector('#d2-boss-title-text');
            if (titleEl) {
                titleEl.textContent = title;
            }
        }
        el.style.display = "block";
        this.bossUiEl = el;
    }

    hideBossBar() {
        if (this.bossUiEl) {
            this.bossUiEl.style.display = "none";
        }
    }

    updateBossBar() {
        if (!this.activeBoss || !this.bossUiEl) return;
        const fill = document.getElementById("d2-boss-hp-fill");
        if (fill) {
            const pct = Math.max(0, (this.activeBoss.hp / this.activeBoss.maxHp) * 100);
            fill.style.width = `${pct}%`;
        }
    }

    renderMonsters(ctx) {
        // 分層排序：死亡遺骸與倒地動畫 (Tier 0) 沉在最底層，存活怪物 (Tier 1) 在上層
        const sortedEntities = [...this.monsters].sort((a, b) => {
            const aDead = (a.isDead || a.state === 'death') ? 0 : 1;
            const bDead = (b.isDead || b.state === 'death') ? 0 : 1;
            if (aDead !== bDead) return aDead - bDead;
            return a.y - b.y;
        });
        for (const m of sortedEntities) {
            m.render(ctx);
        }
    }

    renderEffects(ctx, alpha = 1.0) {
        this.updateBossBar();

        if (this.missileSystem) {
            if (!this.missileSystem.renderer && ctx) {
                this.attachMissileRenderer(ctx);
            }
            this.missileSystem.render(alpha);
        }

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // 彈道與法術效果渲染
        for (const mis of this.missiles) {
            if (mis.mode === 'trap_arc') {
                // 原廠連鎖雷電高壓電弧：14px 步長 + 3 重法向微位移純白熾熱熔接，消滅虛線碎段，維持主幹剛性與端點連續栓接
                const lsSheet = this.skillSheets['lightningstrike'];
                if (lsSheet && lsSheet.img.complete) {
                    const meta = lsSheet.meta;
                    const dx = mis.x2 - mis.x1;
                    const dy = mis.y2 - mis.y1;
                    const dist = Math.hypot(dx, dy);
                    const steps = Math.max(3, Math.ceil(dist / 14));
                    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                    const row = this.getDccDirectionRow(meta.directions || 32, angle, 'lightningstrike');
                    const ux = dx / dist;
                    const uy = dy / dist;
                    const nx = -uy;
                    const ny = ux;
                    const OFFSETS = [-1.5, 0, 1.5];

                    const startX = mis.x1 + ux * 16;
                    const startY = mis.y1 + uy * 16;
                    const effDist = Math.hypot(mis.x2 - startX, mis.y2 - startY);
                    const startD = Math.min(36, effDist * 0.5);
                    const endD = Math.max(startD, effDist - 12);

                    let s = 0;
                    for (let d = startD; d <= endD; d += 14) {
                        const wave = (Math.random() - 0.5) * 1.5; // 1.5px 高頻震顫維持主光柱筆直貫穿力量感
                        const px = startX + ux * d + nx * wave;
                        const py = startY + uy * d + ny * wave;
                        const frame = (s + Math.floor(mis.lifetime / 40)) % meta.frames;

                        for (const off of OFFSETS) {
                            const ox = Math.round(off * nx);
                            const oy = Math.round(off * ny);
                            ctx.drawImage(
                                lsSheet.img,
                                frame * meta.cell_width, row * meta.cell_height, meta.cell_width, meta.cell_height,
                                Math.round(px - meta.pivot_x + ox), Math.round(py - meta.pivot_y + oy), meta.cell_width, meta.cell_height
                            );
                        }
                        s++;
                    }
                }
                continue;
            }
            if (mis.mode === 'meteor_strike') {
                if (!mis.hasImpacted) {
                    // 隕石落地預警：使用暴雪原廠 MeteorTargetIndicator 精靈圖集，杜絕 ctx.ellipse / ctx.stroke 手繪
                    const targetSheet = this.skillSheets['meteortargetindicator'];
                    if (targetSheet && targetSheet.img && targetSheet.img.complete && targetSheet.img.naturalWidth > 0) {
                        const tMeta = targetSheet.meta;
                        const tFrame = Math.floor(mis.lifetime / 60) % tMeta.frames;
                        ctx.drawImage(
                            targetSheet.img,
                            tFrame * tMeta.cell_width, 0, tMeta.cell_width, tMeta.cell_height,
                            Math.round(mis.x - tMeta.pivot_x), Math.round(mis.y - tMeta.pivot_y),
                            tMeta.cell_width, tMeta.cell_height
                        );
                    }

                    const meteorSheet = this.skillSheets['meteor'];
                    if (meteorSheet && meteorSheet.img && meteorSheet.img.complete && meteorSheet.img.naturalWidth > 0) {
                        const mMeta = meteorSheet.meta;
                        const mSx = (Math.floor(mis.lifetime / 50) % mMeta.frames) * mMeta.cell_width;
                        ctx.drawImage(
                            meteorSheet.img,
                            mSx, 0, mMeta.cell_width, mMeta.cell_height,
                            Math.round(mis.x - mMeta.pivot_x),
                            Math.round(mis.y + mis.meteorY - mMeta.pivot_y),
                            mMeta.cell_width, mMeta.cell_height
                        );
                    }
                } else {
                    const lavaSheet = this.skillSheets['meteorlavaburst'];
                    if (lavaSheet && lavaSheet.img && lavaSheet.img.complete && lavaSheet.img.naturalWidth > 0) {
                        const lMeta = lavaSheet.meta;
                        const lSx = (mis.frame % lMeta.frames) * lMeta.cell_width;
                        ctx.drawImage(
                            lavaSheet.img,
                            lSx, 0, lMeta.cell_width, lMeta.cell_height,
                            Math.round(mis.x - lMeta.pivot_x),
                            Math.round(mis.y - lMeta.pivot_y),
                            lMeta.cell_width, lMeta.cell_height
                        );
                    }
                }
                continue;
            }

            const sheet = this.skillSheets[mis.type];
            if (!sheet || !sheet.img || !sheet.img.complete || sheet.img.naturalWidth === 0) continue;
            const meta = mis.meta || sheet.meta;

            if (mis.mode === 'nova') {
                const ISO_Y = 0.54;
                const lifeRatio = mis.lifetime / (mis.maxLifetime || 1000);
                const alpha = Math.max(0, Math.min(1.0, 1.0 - lifeRatio * 0.8));

                ctx.save();
                ctx.globalCompositeOperation = 'lighter';

                // 模式 2：累積弧長查找表 (Arc-Length LUT) + 目標間距 8px 等距取樣
                const a = mis.radius;
                const b = mis.radius * ISO_Y;
                const lutSteps = 180;
                const angles = [0];
                const dists = [0];
                let cum = 0, px = a, py = 0;
                for (let i = 1; i <= lutSteps; i++) {
                    const t = (i / lutSteps) * Math.PI * 2;
                    const x = a * Math.cos(t), y = b * Math.sin(t);
                    cum += Math.hypot(x - px, y - py);
                    angles.push(t);
                    dists.push(cum);
                    px = x; py = y;
                }
                const totalPerimeter = cum;
                const getTheta = (dist) => {
                    const d = dist % totalPerimeter;
                    let low = 0, high = dists.length - 1;
                    while (low <= high) {
                        const mid = (low + high) >> 1;
                        if (dists[mid] < d) low = mid + 1;
                        else high = mid - 1;
                    }
                    const idx = Math.max(1, low);
                    const d0 = dists[idx - 1], d1 = dists[idx];
                    const t0 = angles[idx - 1], t1 = angles[idx];
                    const frac = d1 > d0 ? (d - d0) / (d1 - d0) : 0;
                    return t0 + (t1 - t0) * frac;
                };

                const TARGET_SPACING = 8;
                const numCount = Math.max(20, Math.round(totalPerimeter / TARGET_SPACING));
                const step = totalPerimeter / numCount;

                const DCC_16 = [
                    { row: 7,  deg: 0.0 },
                    { row: 14, deg: 22.5 },
                    { row: 3,  deg: 45.0 },
                    { row: 15, deg: 67.5 },
                    { row: 4,  deg: 90.0 },
                    { row: 8,  deg: 112.5 },
                    { row: 0,  deg: 135.0 },
                    { row: 9,  deg: 157.5 },
                    { row: 5,  deg: 180.0 },
                    { row: 10, deg: 202.5 },
                    { row: 1,  deg: 225.0 },
                    { row: 11, deg: 247.5 },
                    { row: 6,  deg: 270.0 },
                    { row: 12, deg: 292.5 },
                    { row: 2,  deg: 315.0 },
                    { row: 13, deg: 337.5 }
                ];
                const getDir16 = (angleDeg) => {
                    const ang = ((angleDeg % 360) + 360) % 360;
                    let best = DCC_16[0].row, minDiff = 999;
                    for (const d of DCC_16) {
                        const diff = Math.abs(((d.deg - ang + 180) % 360) - 180);
                        if (diff < minDiff) { minDiff = diff; best = d.row; }
                    }
                    return best;
                };

                const renderNovaLayer = (layerRadiusX, layerRadiusY, frameOffset, alphaScale) => {
                    ctx.globalAlpha = alpha * alphaScale;
                    const curFrame = (mis.frame + frameOffset) % meta.frames;
                    for (let i = 0; i < numCount; i++) {
                        const theta = getTheta(i * step);
                        const px = mis.centerX + layerRadiusX * Math.cos(theta);
                        const py = mis.centerY + layerRadiusY * Math.sin(theta);
                        const radialDeg = ((Math.atan2(Math.sin(theta), Math.cos(theta)) * 180 / Math.PI) + 360) % 360;
                        const dirRow = getDir16(radialDeg);
                        const sx = curFrame * meta.cell_width;
                        const sy = dirRow * meta.cell_height;
                        ctx.drawImage(
                            sheet.img,
                            sx, sy, meta.cell_width, meta.cell_height,
                            Math.round(px - meta.pivot_x), Math.round(py - meta.pivot_y),
                            meta.cell_width, meta.cell_height
                        );
                    }
                };

                // 雙層微位移同幀熔接 (外環 R + 內環 R-6px)
                renderNovaLayer(a, b, 0, 0.95);
                renderNovaLayer(Math.max(8, a - 6), Math.max(4, b - 3.24), 1, 0.75);
                ctx.restore();
            } else if (mis.mode === 'stream') {
                const numSegments = mis.numSegments || 5;
                const sx = (mis.frame % meta.frames) * meta.cell_width;
                const sy = ((mis.direction || 0) % meta.directions) * meta.cell_height;
                const segStep = 65;
                const startOffset = 45; // 第一段電弧向外推進半個長度，使電弧後端恰好咬合在手爪前端，100% 絕不覆蓋身體
                for (let s = 0; s < numSegments; s++) {
                    const distSeg = startOffset + s * segStep;
                    if (distSeg > mis.length + 40) break;
                    const sxPos = mis.originX + Math.cos(mis.angle) * distSeg;
                    const syPos = mis.originY + Math.sin(mis.angle) * distSeg * 0.55;
                    ctx.drawImage(
                        sheet.img,
                        sx, sy, meta.cell_width, meta.cell_height,
                        Math.round(sxPos - meta.pivot_x),
                        Math.round(syPos - meta.pivot_y),
                        meta.cell_width, meta.cell_height
                    );
                }
            } else if (mis.mode === 'whirlwind') {
                // 外層旋風效果已移除，純粹保留野蠻人角色本體 16 方向高速旋轉攻擊與穿透割草
                continue;
            } else {
                // 骨矛拖尾渲染 (BoneSpearTrail)
                if (mis.type === 'bonespear' && mis.trailHistory && mis.trailHistory.length > 0 && this.skillSheets['bonespeartrail']) {
                    const trailSheet = this.skillSheets['bonespeartrail'];
                    if (trailSheet && trailSheet.img && trailSheet.img.complete && trailSheet.img.naturalWidth > 0) {
                        const tMeta = trailSheet.meta;
                        const tDirs = tMeta.directions || 32;
                        const tHeading = mis.headingDeg != null ? mis.headingDeg : 0;
                        const tDirRow = this.getDccDirectionRow(tDirs, (tHeading - 90 + 360) % 360, 'bonespeartrail');
                        for (let tIdx = 0; tIdx < mis.trailHistory.length - 1; tIdx++) {
                            const th = mis.trailHistory[tIdx];
                            const alpha = 0.2 + (tIdx / mis.trailHistory.length) * 0.45;
                            const tFrame = (th.frame % tMeta.frames) * tMeta.cell_width;
                            const tSy = (tDirRow % tDirs) * tMeta.cell_height;
                            ctx.save();
                            ctx.globalAlpha = alpha;
                            ctx.drawImage(
                                trailSheet.img,
                                tFrame, tSy, tMeta.cell_width, tMeta.cell_height,
                                Math.round(th.x - tMeta.pivot_x),
                                Math.round(th.y - tMeta.pivot_y),
                                tMeta.cell_width, tMeta.cell_height
                            );
                            ctx.restore();
                        }
                    }
                }

                // 檢查是否有兩點旋轉基準線對齊 (火球、骨矛、白骨之牙等直線單一投射物)
                const headingDeg = mis.headingDeg != null
                    ? mis.headingDeg
                    : (window.D2_MISSILE_LANDMARKS ? window.D2_MISSILE_LANDMARKS.getScreenHeading(mis.vx || 0, (mis.vy || 0) * 0.55) : 0);
                const placement = window.D2_MISSILE_LANDMARKS
                    ? window.D2_MISSILE_LANDMARKS.getFramePlacement(mis.type, mis.direction, mis.frame, headingDeg)
                    : null;

                if (placement) {
                    ctx.save();
                    ctx.translate(Math.round(mis.x), Math.round(mis.y));
                    if (placement.rotate !== 0) {
                        ctx.rotate(placement.rotate);
                    }
                    const f = placement.frame;
                    ctx.drawImage(
                        sheet.img,
                        f.x, f.y, f.width, f.height,
                        -placement.pivotX, -placement.pivotY, f.width, f.height
                    );
                    ctx.restore();
                } else {
                    const sx = (mis.frame % meta.frames) * meta.cell_width;
                    const sy = ((mis.direction || 0) % meta.directions) * meta.cell_height;
                    ctx.drawImage(
                        sheet.img,
                        sx, sy, meta.cell_width, meta.cell_height,
                        Math.round(mis.x - meta.pivot_x),
                        Math.round(mis.y - meta.pivot_y),
                        meta.cell_width, meta.cell_height
                    );
                }
            }
        }

        // 命中光芒
        for (const ov of this.overlays) {
            const sheet = this.skillSheets[ov.type];
            if (sheet && sheet.img && sheet.img.complete && sheet.img.naturalWidth > 0) {
                const sx = ov.frame * ov.meta.cell_width;
                const sy = 0;
                ctx.save();
                if (ov.type === 'holyshock_hit' || ov.type === 'holyfire_hit') {
                    ctx.globalCompositeOperation = 'lighter';
                }
                ctx.drawImage(
                    sheet.img,
                    sx, sy, ov.meta.cell_width, ov.meta.cell_height,
                    Math.round(ov.x - ov.meta.pivot_x),
                    Math.round(ov.y - ov.meta.pivot_y),
                    ov.meta.cell_width, ov.meta.cell_height
                );
                ctx.restore();
            }
        }

        // 浮動戰鬥傷害文字渲染 (怪物受傷金黃色，英雄受傷鮮紅色)
        if (this.damageNumbers && this.damageNumbers.length > 0) {
            ctx.save();
            ctx.font = "bold 15px 'Cinzel', serif, Arial";
            ctx.textAlign = "center";
            for (const dn of this.damageNumbers) {
                if (dn.amount !== undefined && (typeof dn.amount !== 'number' || isNaN(dn.amount) || !isFinite(dn.amount))) {
                    continue;
                }
                if (dn.text && (dn.text === 'NaN' || String(dn.text).includes('NaN'))) {
                    continue;
                }
                const progress = dn.lifetime / dn.maxLifetime;
                const alpha = Math.max(0, 1 - progress);
                ctx.globalAlpha = alpha;
                if (dn.isHero) {
                    ctx.fillStyle = "#ef4444";
                    ctx.shadowColor = "#7f1d1d";
                    ctx.shadowBlur = 6;
                    ctx.fillText(`-${dn.amount}`, dn.x, dn.y);
                } else if (dn.text) {
                    ctx.fillStyle = dn.color || "#fbbf24";
                    ctx.shadowColor = "#000000";
                    ctx.shadowBlur = 4;
                    ctx.fillText(dn.text, dn.x, dn.y);
                } else {
                    ctx.fillStyle = "#facc15";
                    ctx.shadowColor = "#78350f";
                    ctx.shadowBlur = 6;
                    ctx.fillText(`${dn.amount}`, dn.x, dn.y);
                }
            }
            ctx.restore();
        }
        ctx.restore();

        // V2 純資料驅動全職業高精度法術引擎渲染 (100% 暴雪原廠精靈圖投射物與特效)
        if (this.v2Player) {
            const heroX = this.sandbox && this.sandbox.character ? this.sandbox.character.x : 400;
            const heroY = this.sandbox && this.sandbox.character ? this.sandbox.character.y : 300;
            this.v2Player.ctx = ctx;
            this.v2Player.render(false, { x: heroX, y: heroY }, true);
        }
    }

    onHeroChanged(heroId) {
        this.spawnCompanionsForHero(heroId);
    }

    spawnCompanionsForHero(heroId) {
        this.companions = [];
        const hero = this.sandbox ? this.sandbox.character : null;
        if (!hero) return;

        heroId = (heroId || '').toLowerCase();
        if (heroId === 'druid') {
            // 德魯伊專屬夥伴全軍出擊：1 灰熊 + 3 狂狼 + 3 寵物烏鴉 + 1 自然之靈
            this.companions.push(new CompanionEntity('bear', hero, this));
            for (let i = 0; i < 3; i++) {
                this.companions.push(new CompanionEntity('wolf', hero, this));
            }
            for (let i = 0; i < 3; i++) {
                this.companions.push(new CompanionEntity('raven', hero, this));
            }
            this.companions.push(new CompanionEntity('oak_sage', hero, this));
            console.log("[CombatDirector] Druid companions summoned: 1 Grizzly Bear, 3 Dire Wolves, 3 Ravens, 1 Oak Sage");
        } else if (heroId === 'necromancer') {
            // 死靈法師專屬大軍：3 隻骷髏僕從 + 1 隻當前魔像 (預設黏土石魔，支援 [X] 鍵循環切換)
            for (let i = 0; i < 3; i++) {
                this.companions.push(new CompanionEntity('skeleton_minion', hero, this));
            }
            if (!this.activeGolemType) this.activeGolemType = 'golem';
            this.companions.push(new CompanionEntity(this.activeGolemType, hero, this));
            console.log(`[CombatDirector] Necromancer companions summoned: 3 Skeleton Minions, 1 Golem (${this.activeGolemType})`);
        }
    }

    /**
     * 切換死靈法師魔像形態 (黏土石魔 -> 鋼鐵魔像 -> 火焰魔像)
     */
    switchGolem(targetType = null) {
        const hero = this.sandbox ? this.sandbox.character : null;
        if (!hero || (hero.heroId || '').toLowerCase() !== 'necromancer') {
            if (this.addFloatingText && hero) {
                this.addFloatingText(hero.x, hero.y - 60, "切換魔像僅限死靈法師", "#ff4444");
            }
            return;
        }

        const golemTypes = ['golem', 'iron_golem', 'fire_golem'];
        if (targetType && golemTypes.includes(targetType)) {
            this.activeGolemType = targetType;
        } else {
            const curIdx = golemTypes.indexOf(this.activeGolemType || 'golem');
            this.activeGolemType = golemTypes[(curIdx + 1) % golemTypes.length];
        }

        // 移除當前場上的舊魔像
        for (let i = this.companions.length - 1; i >= 0; i--) {
            const c = this.companions[i];
            if (c.key === 'golem' || c.key === 'iron_golem' || c.key === 'fire_golem') {
                this.companions.splice(i, 1);
            }
        }

        // 召喚新的魔像形態
        const newGolem = new CompanionEntity(this.activeGolemType, hero, this);
        this.companions.push(newGolem);

        const golemTitles = {
            'golem': '黏土石魔 (Clay Golem)',
            'iron_golem': '鋼鐵魔像 (Iron Golem)',
            'fire_golem': '火焰魔像 (Fire Golem)'
        };
        const title = golemTitles[this.activeGolemType] || this.activeGolemType;
        if (this.addFloatingText) {
            this.addFloatingText(hero.x, hero.y - 60, `[魔像切換] ${title}`, '#e5a93c');
        }
        if (this.playSfx) {
            this.playSfx('golemcast3');
        }
    }

    updateCompanions(dt) {
        const hero = this.sandbox ? this.sandbox.character : null;
        if (hero && this.companions.length === 0) {
            const hid = (hero.heroId || '').toLowerCase();
            if (hid === 'druid' || hid === 'necromancer') {
                this.spawnCompanionsForHero(hid);
            }
        }

        for (let i = this.companions.length - 1; i >= 0; i--) {
            const comp = this.companions[i];
            comp.update(dt);
            if (comp.remove) {
                this.companions.splice(i, 1);
            }
        }
    }

    renderCompanions(ctx) {
        for (const comp of this.companions) {
            comp.render(ctx);
        }
    }

    render(ctx) {
        this.renderMonsters(ctx);
        this.renderCompanions(ctx);
        this.renderEffects(ctx);
        
        // V2 Engine Render
        if (this.v2Player) {
            const heroX = this.sandbox.character ? this.sandbox.character.x : 400;
            const heroY = this.sandbox.character ? this.sandbox.character.y : 300;
            this.v2Player.ctx = ctx;
            this.v2Player.render(false, { x: heroX, y: heroY }, true);
        }
    }
}

window.CombatDirector = CombatDirector;



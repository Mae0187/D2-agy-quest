/**
 * Diablo II 英雄技能全覆蓋擴充引擎 (CombatDirector Skill Extension)
 * 100% 依據「全角色技能清單與實裝選擇表.md」與「AGENT.md」十二大錨點規範
 * 支援 7 大職業所有 [x] 勾選技能的真實動畫、彈道物理、範圍傷害與僕從召喚
 */

(function() {
    if (typeof window === 'undefined') return;

    window.initCombatSkillsExtension = function(directorProto) {
        if (!directorProto) return;

        /**
         * 集中路由調度器：優先處理擴充技能
         * 若成功匹配並派發技能返回 true，否則返回 false 走既有分支
         */
        directorProto.handleExtendedHeroSkill = function(skillType, hx, hy, tx, ty) {
            if (!tx || !ty) {
                tx = hx + 120;
                ty = hy + 60;
            }

            // [V2 Engine Intercept] 如果 V2 引擎存在，優先交由純資料驅動引擎處理
            if (this.v2Player) {
                if (!window.__hydraConfig__) {
                    window.__hydraConfig__ = {
                        heads: [
                            { ox: -22, oy: -8 },
                            { ox:   0, oy:  6 },
                            { ox:  22, oy: -8 },
                        ],
                        fires: [
                            { fox: -11, foy: -6 },
                            { fox: -10, foy: -6 },
                            { fox:  -8, foy: -6 },
                        ],
                    };
                }
                const v2Map = {
                    'fire_bolt': '36',
                    'fireball': '47',
                    'inferno': '41',
                    'fire_wall': '51',
                    'meteor': '56',
                    'hydra': '62',
                    'ice_bolt': '39',
                    'ice_blast': '45',
                    'frost_nova': '44',
                    'glacial_spike': '55',
                    'blizzard': '59',
                    'frozen_orb': '64',
                    'charged_bolt': '38',
                    'nova': '48',
                    'chain_lightning': '53',
                    'thunder_storm': '57'
                };
                if (v2Map[skillType]) {
                    const skillId = v2Map[skillType];
                    const originY = hy;
                    if (skillId === '41') {
                        // 地獄火連續引導噴射：每 tick 平滑發射 2 顆粒子
                        this.v2Player.castSkill(skillId, hx, originY, tx, ty);
                        const now = performance.now();
                        if (!this._lastInfernoSfx || now - this._lastInfernoSfx > 320) {
                            this._lastInfernoSfx = now;
                            this.playSfx('castfire');
                        }
                    } else {
                        this.v2Player.castSkill(skillId, hx, originY, tx, ty);
                        // 為了保留原有的音效體驗，呼叫對應的 sfx
                        if (skillId === '48' || skillId === '53' || skillId === '57' || skillId === '38') this.playSfx('lightning1');
                        else if (skillId === '36' || skillId === '47' || skillId === '51' || skillId === '56' || skillId === '62') this.playSfx('castfire');
                        else this.playSfx('castcold');
                    }
                    
                    return true;
                }
            }

            switch (skillType) {
                // === 魔法使 (Sorceress) 火系 ===
                case 'fire_bolt':
                    this.spawnHeroFireBolt(hx, hy, tx, ty);
                    return true;
                case 'inferno':
                    this.spawnHeroInferno(hx, hy, tx, ty);
                    return true;
                case 'fire_wall':
                    this.spawnHeroFireWall(tx, ty);
                    return true;
                case 'enchant':
                    this.spawnHeroEnchant(hx, hy);
                    return true;
                case 'meteor':
                    this.spawnHeroMeteor(tx, ty);
                    return true;
                case 'hydra':
                    this.spawnHeroHydra(tx, ty);
                    return true;

                // === 魔法使 (Sorceress) 電系 ===
                case 'nova':
                    this.spawnHeroNova(hx, hy);
                    return true;
                case 'chain_lightning':
                    this.spawnHeroChainLightning(hx, hy, tx, ty);
                    return true;
                case 'thunder_storm':
                    this.spawnHeroThunderStorm(hx, hy);
                    return true;

                // === 魔法使 (Sorceress) 冰系 ===
                case 'ice_bolt':
                    this.spawnHeroIceBolt(hx, hy, tx, ty);
                    return true;
                case 'ice_blast':
                    this.spawnHeroIceBlast(hx, hy, tx, ty);
                    return true;
                case 'glacial_spike':
                    this.spawnHeroGlacialSpike(hx, hy, tx, ty);
                    return true;
                case 'frozen_orb':
                    this.spawnHeroFrozenOrb(hx, hy, tx, ty);
                    return true;
                case 'frozen_armor':
                case 'shiver_armor':
                case 'chilling_armor':
                    this.spawnHeroIceArmor(hx, hy, skillType);
                    return true;

                // === 聖騎士 (Paladin) ===
                case 'holy_bolt':
                    this.spawnHeroHolyBolt(hx, hy, tx, ty);
                    return true;
                case 'holy_shield':
                    this.spawnHeroHolyShield(hx, hy);
                    return true;
                case 'zeal':
                    this.spawnHeroZeal(hx, hy, tx, ty);
                    return true;

                // === 野蠻人 (Barbarian) ===
                case 'bash':
                case 'double_swing':
                case 'concentrate':
                case 'frenzy':
                case 'berserk':
                    this.spawnHeroMeleeSkill(skillType, hx, hy, tx, ty);
                    return true;
                case 'double_throw':
                    this.spawnHeroDoubleThrow(hx, hy, tx, ty);
                    return true;
                case 'leap_attack':
                    this.spawnHeroLeapAttack(hx, hy, tx, ty);
                    return true;
                case 'grim_ward':
                    this.spawnHeroGrimWard(tx, ty);
                    return true;

                // === 德魯伊 (Druid) 元素系 ===
                case 'firestorm':
                    this.spawnHeroFirestorm(hx, hy, tx, ty);
                    return true;
                case 'molten_boulder':
                    this.spawnHeroMoltenBoulder(hx, hy, tx, ty);
                    return true;
                case 'eruption':
                    this.spawnHeroEruption(tx, ty);
                    return true;
                case 'twister':
                    this.spawnHeroTwister(hx, hy, tx, ty);
                    return true;
                case 'volcano':
                    this.spawnHeroVolcano(tx, ty);
                    return true;
                case 'cyclone_armor':
                    this.spawnHeroCycloneArmor(hx, hy);
                    return true;
                case 'armageddon':
                    this.spawnHeroArmageddon(hx, hy);
                    return true;
                case 'hurricane':
                    this.spawnHeroHurricane(hx, hy);
                    return true;

                // === 德魯伊 (Druid) 變形系 ===
                case 'maul':
                case 'rabies':
                case 'fire_claws':
                case 'hunger':
                case 'fury':
                    this.spawnHeroShapeshiftAttack(skillType, hx, hy, tx, ty);
                    return true;
                case 'shock_wave':
                case 'shockwave':
                    this.spawnHeroShockwave(hx, hy, tx, ty);
                    return true;
                case 'wearwolf':
                case 'wearbear':
                    this.spawnHeroTransform(skillType);
                    return true;

                // === 德魯伊 (Druid) 召喚系 ===
                case 'summon_raven':
                    this.spawnHeroCompanion('raven', "召喚烏鴉！空中盤旋啄擊");
                    return true;
                case 'summon_spirit_wolf':
                case 'summon_fenris':
                    this.spawnHeroCompanion('wolf', "召喚狂狼！撕咬奔襲作戰");
                    return true;
                case 'summon_grizzly':
                    this.spawnHeroCompanion('bear', "召喚灰熊！巨型肉搏衝鋒");
                    return true;
                case 'oak_sage':
                case 'plague_poppy':
                case 'cycle_of_life':
                case 'heart_of_wolverine':
                case 'vines':
                case 'spirit_of_barbs':
                    this.spawnHeroCompanion('oak_sage', "召喚自然之靈！生命與庇護環繞");
                    return true;

                // === 死靈法師 (Necromancer) 毒骨系 ===
                case 'poison_dagger':
                    this.spawnHeroPoisonDagger(hx, hy, tx, ty);
                    return true;
                case 'bone_armor':
                    this.spawnHeroBoneArmor(hx, hy);
                    return true;
                case 'corpse_explosion':
                    this.spawnHeroCorpseExplosion(tx, ty);
                    return true;
                case 'poison_explosion':
                    this.spawnHeroPoisonExplosion(tx, ty);
                    return true;

                // === 死靈法師 (Necromancer) 召喚系 ===
                case 'raise_skeleton':
                case 'raise_mage':
                    this.spawnHeroCompanion('skeleton_minion', "復生骷髏大軍！出征作戰");
                    return true;
                case 'clay_golem':
                case 'blood_golem':
                    this.spawnHeroCompanion('golem', "召喚黏土魔像！強效緩速肉盾");
                    return true;
                case 'iron_golem':
                    this.spawnHeroCompanion('iron_golem', "召喚鋼鐵魔像！堅定金屬重甲");
                    return true;
                case 'fire_golem':
                    this.spawnHeroCompanion('fire_golem', "召喚火焰魔像！聖火烈焰光環");
                    return true;
                case 'revive':
                    this.spawnHeroRevive(tx, ty);
                    return true;

                // === 亞馬遜 (Amazon) 弓箭系 ===
                case 'magic_arrow':
                    this.spawnHeroMagicArrow(hx, hy, tx, ty);
                    return true;
                case 'fire_arrow':
                    this.spawnHeroFireArrow(hx, hy, tx, ty);
                    return true;
                case 'cold_arrow':
                    this.spawnHeroColdArrow(hx, hy, tx, ty);
                    return true;
                case 'exploding_arrow':
                    this.spawnHeroExplodingArrow(hx, hy, tx, ty);
                    return true;
                case 'ice_arrow':
                    this.spawnHeroIceArrow(hx, hy, tx, ty);
                    return true;
                case 'guided_arrow':
                    this.spawnHeroGuidedArrow(hx, hy, tx, ty);
                    return true;
                case 'strafe':
                    this.spawnHeroStrafe(hx, hy, tx, ty);
                    return true;
                case 'immolation_arrow':
                    this.spawnHeroImmolationArrow(hx, hy, tx, ty);
                    return true;
                case 'freezing_arrow':
                    this.spawnHeroFreezingArrow(hx, hy, tx, ty);
                    return true;
                case 'valkyrie':
                    this.spawnHeroValkyrie(hx, hy);
                    return true;

                // === 亞馬遜 (Amazon) 標槍與長矛系 ===
                case 'jab':
                case 'power_strike':
                case 'impale':
                case 'fend':
                    this.spawnHeroSpearMelee(skillType, hx, hy, tx, ty);
                    return true;
                case 'poison_javelin':
                    this.spawnHeroPoisonJavelin(hx, hy, tx, ty);
                    return true;
                case 'lightning_bolt':
                    this.spawnHeroLightningBolt(hx, hy, tx, ty);
                    return true;
                case 'charged_strike':
                    this.spawnHeroChargedStrike(hx, hy, tx, ty);
                    return true;
                case 'plague_javelin':
                    this.spawnHeroPlagueJavelin(hx, hy, tx, ty);
                    return true;
                case 'lightning_strike':
                    this.spawnHeroLightningStrike(hx, hy, tx, ty);
                    return true;
                case 'lightning_fury':
                    this.spawnHeroLightningFury(hx, hy, tx, ty);
                    return true;

                // === 刺客 (Assassin) 陷阱系 ===
                case 'fire_trauma':
                    this.spawnHeroFireTrauma(hx, hy, tx, ty);
                    return true;
                case 'shock_field':
                    this.spawnHeroShockField(tx, ty);
                    return true;
                case 'blade_sentinel':
                    this.spawnHeroBladeSentinel(hx, hy, tx, ty);
                    return true;
                case 'charged_bolt_sentry':
                case 'wake_of_fire':
                case 'inferno_sentry':
                    this.spawnHeroSentry(skillType, tx, ty);
                    return true;
                case 'death_sentry':
                    this.spawnHeroDeathSentry(tx, ty);
                    return true;
                case 'blade_shield':
                    this.spawnHeroBladeShield(hx, hy);
                    return true;
                case 'shadow_master':
                    this.spawnHeroShadowMaster(hx, hy);
                    return true;

                // === 刺客 (Assassin) 武術系 ===
                case 'tiger_strike':
                case 'fists_of_fire':
                case 'dragon_claw':
                case 'cobra_strike':
                case 'claws_of_thunder':
                case 'blades_of_ice':
                    this.spawnHeroMartialStrike(skillType, hx, hy, tx, ty);
                    return true;
                case 'dragon_talon':
                    this.spawnHeroDragonTalon(hx, hy, tx, ty);
                    return true;
                case 'dragon_tail':
                    this.spawnHeroDragonTail(hx, hy, tx, ty);
                    return true;
                case 'dragon_flight':
                    this.spawnHeroDragonFlight(hx, hy, tx, ty);
                    return true;
                case 'royal_strike':
                    this.spawnHeroRoyalStrike(hx, hy, tx, ty);
                    return true;
            }

            return false;
        };

        // ==========================================
        // 1. 魔法使 (Sorceress) 專屬技能具體實裝
        // ==========================================

        // 火彈 (Fire Bolt)
        directorProto.spawnHeroFireBolt = function(hx, hy, tx, ty) {
            this.playSfx('castfire');
            const dx = tx - hx;
            const dy = ty - hy;
            const angle = Math.atan2(dy, dx);
            const speed = 0.38;
            const meta = this.fxManifest.skills ? this.fxManifest.skills.fireball : null;
            if (!meta) return;

            const dir = (window.D2_MISSILE_LANDMARKS)
                ? window.D2_MISSILE_LANDMARKS.resolveDirectionRow('fireball', (angle * 180 / Math.PI + 90 + 360) % 360)
                : Math.round(((angle * 180 / Math.PI + 360) % 360) / 22.5) % 16;

            this.missiles.push({
                mode: "linear",
                type: "fireball",
                x: hx + Math.cos(angle) * 16,
                y: hy + Math.sin(angle) * 16,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                direction: dir,
                lifetime: 0,
                maxLifetime: 1600,
                damage: 32,
                aoeRadius: 40,
                isEnemy: false,
                meta: meta
            });
        };

        // 地獄火 (Inferno) — 持續烈焰吐息噴射
        directorProto.spawnHeroInferno = function(hx, hy, tx, ty) {
            this.playSfx('castfire');
            const meta = this.fxManifest.skills ? this.fxManifest.skills.inferno : null;
            if (!meta) return;
            const dx = tx - hx;
            const dy = (ty - hy) * 2;
            const angle = Math.atan2(dy, dx);
            const deg = (angle * 180 / Math.PI + 360) % 360;
            const sector = Math.round(deg / 45) % 8;

            this.missiles.push({
                mode: "stream",
                type: "inferno",
                originX: hx,
                originY: hy,
                angle: angle,
                direction: sector,
                length: 220,
                lifetime: 0,
                maxLifetime: 850,
                damage: 48,
                meta: meta
            });
        };

        // 地表火牆 (Fire Wall) — 在地表鋪設一排 5 團持續燃燒之火海
        directorProto.spawnHeroFireWall = function(tx, ty) {
            this.playSfx('castfire');
            const meta = this.fxManifest.skills ? this.fxManifest.skills.fire_wall : null;
            if (!meta) return;

            for (let i = -2; i <= 2; i++) {
                this.missiles.push({
                    mode: "ground_hazard",
                    type: "fire_wall",
                    x: tx + i * 36,
                    y: ty + i * 12,
                    lifetime: 0,
                    maxLifetime: 4000,
                    damage: 28,
                    tickInterval: 240,
                    radius: 35,
                    meta: meta
                });
            }
        };

        // 武器強化 (Enchant)
        directorProto.spawnHeroEnchant = function(hx, hy) {
            this.playSfx('castfire');
            this.spawnFireNova(hx, hy, 0);
            const char = this.sandbox ? this.sandbox.character : null;
            if (char) {
                char.enchantTimer = 15000;
            }
            if (this.addFloatingText) {
                this.addFloatingText(hx, hy - 50, "武器強化！火焰附魔 +60", "#f97316");
            }
        };

        // 隕石天降 (Meteor) — 預警紅圈 + 巨型隕石天降 + 爆碎熔岩火海
        directorProto.spawnHeroMeteor = function(tx, ty) {
            this.playSfx('castfire');
            this.missiles.push({
                mode: "meteor_strike",
                type: "meteor",
                x: tx,
                y: ty,
                meteorY: -260,
                delayTimer: 850,
                hasImpacted: false,
                lifetime: 0,
                maxLifetime: 4500,
                damage: 110,
                aoeRadius: 110
            });
        };

        // 九頭海蛇 (Hydra) — 在地面召喚出矗立火蛇持續噴發火彈
        directorProto.spawnHeroHydra = function(tx, ty) {
            this.playSfx('castfire');
            const meta = this.fxManifest.skills ? this.fxManifest.skills.hydra : null;
            if (!meta) return;

            const offsets = [
                { dx: 0, dy: 0 },
                { dx: -28, dy: 14 },
                { dx: 28, dy: 14 }
            ];

            for (const off of offsets) {
                this.missiles.push({
                    mode: "hydra_entity",
                    type: "hydra",
                    x: tx + off.dx,
                    y: ty + off.dy,
                    lifetime: 0,
                    maxLifetime: 10000,
                    shootTimer: 0,
                    meta: meta
                });
            }
        };

        // 電擊新星 (Nova) — 360 度電能同心圓爆震
        directorProto.spawnHeroNova = function(hx, hy) {
            this.playSfx('lightning1');
            const meta = this.fxManifest.skills ? this.fxManifest.skills.nova : null;
            if (!meta) return;

            this.missiles.push({
                mode: "nova",
                type: "nova",
                centerX: hx,
                centerY: hy,
                radius: 14,
                maxRadius: 280,
                speed: 0.28,
                lifetime: 0,
                damage: 46,
                frame: 0,
                numBolts: 24,
                isEnemy: false,
                meta: meta
            });
        };

        // 連鎖閃電 (Chain Lightning)
        directorProto.spawnHeroChainLightning = function(hx, hy, tx, ty) {
            this.playSfx('lightning1');
            const meta = this.fxManifest.skills ? this.fxManifest.skills.chain_lightning : null;
            if (!meta) return;

            const enemies = this.monsters.filter(m => !m.isDead && !m.remove).slice(0, 4);
            let prevX = hx;
            let prevY = hy;

            for (let i = 0; i < enemies.length; i++) {
                const target = enemies[i];
                const segX1 = prevX;
                const segY1 = prevY;
                const segX2 = target.x;
                const segY2 = target.y - 18;

                setTimeout(() => {
                    this.spawnTrapArc(segX1, segY1, segX2, segY2);
                    if (!target.isDead) {
                        target.takeDamage(42);
                        this.spawnHitShock(target.x, target.y);
                    }
                }, i * 90);

                prevX = segX2;
                prevY = segY2;
            }

            if (enemies.length === 0) {
                this.spawnTrapArc(hx, hy, tx, ty);
            }
        };

        // 雷暴天怒 (Thunder Storm)
        directorProto.spawnHeroThunderStorm = function(hx, hy) {
            this.playSfx('lightning1');
            const char = this.sandbox ? this.sandbox.character : null;
            if (char) {
                char.thunderStormTimer = 16000;
            }
            if (this.addFloatingText) {
                this.addFloatingText(hx, hy - 50, "雷暴天怒！天雷隨身轟頂", "#60a5fa");
            }
        };

        // 冰彈 (Ice Bolt)
        directorProto.spawnHeroIceBolt = function(hx, hy, tx, ty) {
            this.playSfx('castcold');
            const dx = tx - hx;
            const dy = ty - hy;
            const angle = Math.atan2(dy, dx);
            const speed = 0.38;
            const meta = this.fxManifest.skills ? this.fxManifest.skills.ice_bolt : null;
            if (!meta) return;

            this.missiles.push({
                mode: "linear",
                type: "ice_bolt",
                x: hx + Math.cos(angle) * 16,
                y: hy + Math.sin(angle) * 16,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                direction: Math.round(((angle * 180 / Math.PI + 360) % 360) / 22.5) % 16,
                lifetime: 0,
                maxLifetime: 1600,
                damage: 34,
                chilled: true,
                isEnemy: false,
                meta: meta
            });
        };

        // 冰風暴 (Ice Blast)
        directorProto.spawnHeroIceBlast = function(hx, hy, tx, ty) {
            this.playSfx('castcold');
            const dx = tx - hx;
            const dy = ty - hy;
            const angle = Math.atan2(dy, dx);
            const speed = 0.42;
            const meta = this.fxManifest.skills ? this.fxManifest.skills.ice_blast : null;
            if (!meta) return;

            this.missiles.push({
                mode: "linear",
                type: "ice_blast",
                x: hx + Math.cos(angle) * 16,
                y: hy + Math.sin(angle) * 16,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                direction: Math.round(((angle * 180 / Math.PI + 360) % 360) / 22.5) % 16,
                lifetime: 0,
                maxLifetime: 1600,
                damage: 52,
                frozen: true,
                aoeRadius: 40,
                isEnemy: false,
                meta: meta
            });
        };

        // 冰川之刺 (Glacial Spike)
        directorProto.spawnHeroGlacialSpike = function(hx, hy, tx, ty) {
            this.playSfx('castcold');
            const dx = tx - hx;
            const dy = ty - hy;
            const angle = Math.atan2(dy, dx);
            const speed = 0.44;
            const meta = this.fxManifest.skills ? this.fxManifest.skills.glacial_spike : null;
            if (!meta) return;

            this.missiles.push({
                mode: "linear",
                type: "glacial_spike",
                x: hx + Math.cos(angle) * 18,
                y: hy + Math.sin(angle) * 18,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                direction: Math.round(((angle * 180 / Math.PI + 360) % 360) / 22.5) % 16,
                lifetime: 0,
                maxLifetime: 1700,
                damage: 68,
                frozen: true,
                aoeRadius: 85,
                isEnemy: false,
                meta: meta
            });
        };

        // 冰封球 (Frozen Orb) — 自轉推進 + 360度散射冰彈 + 終點爆碎霜爆
        directorProto.spawnHeroFrozenOrb = function(hx, hy, tx, ty) {
            this.playSfx('castcold');
            const dx = tx - hx;
            const dy = ty - hy;
            const angle = Math.atan2(dy, dx);
            const speed = 0.22;
            const meta = this.fxManifest.skills ? this.fxManifest.skills.ice_orb : null;
            if (!meta) return;

            this.missiles.push({
                mode: "frozen_orb",
                type: "ice_orb",
                x: hx + Math.cos(angle) * 20,
                y: hy + Math.sin(angle) * 20,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                spinAngle: 0,
                sprayTimer: 0,
                lifetime: 0,
                maxLifetime: 1250,
                damage: 75,
                meta: meta
            });
        };

        // 冰甲護體系列 (Frozen Armor / Shiver Armor / Chilling Armor)
        directorProto.spawnHeroIceArmor = function(hx, hy, armorType) {
            this.playSfx('castcold');
            const char = this.sandbox ? this.sandbox.character : null;
            if (char) {
                char.iceArmorType = armorType;
                char.iceArmorTimer = 18000;
            }
            const names = {
                'frozen_armor': '冰甲護體 (防禦提升)',
                'shiver_armor': '碎冰甲 (反彈近戰急凍)',
                'chilling_armor': '寒冰裝甲 (反彈遠程冰彈)'
            };
            if (this.addFloatingText) {
                this.addFloatingText(hx, hy - 50, names[armorType] || '冰甲護體', '#38bdf8');
            }
        };

        // ==========================================
        // 2. 聖騎士 (Paladin) 專屬技能具體實裝
        // ==========================================

        directorProto.spawnHeroHolyBolt = function(hx, hy, tx, ty) {
            this.playSfx('combat/holy_bolt');
            const dx = tx - hx;
            const dy = ty - hy;
            const angle = Math.atan2(dy, dx);
            const speed = 0.44;
            const meta = this.fxManifest.skills ? this.fxManifest.skills.holybolt : null;
            if (!meta) return;

            this.missiles.push({
                mode: "linear",
                type: "holybolt",
                x: hx + Math.cos(angle) * 18,
                y: hy + Math.sin(angle) * 18,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                direction: 0,
                lifetime: 0,
                maxLifetime: 1600,
                damage: 55,
                piercing: true,
                isEnemy: false,
                meta: meta
            });
        };

        directorProto.spawnHeroHolyShield = function(hx, hy) {
            this.playSfx('combat/holy_bolt');
            const char = this.sandbox ? this.sandbox.character : null;
            if (char) {
                char.holyShieldTimer = 18000;
            }
            if (this.addFloatingText) {
                this.addFloatingText(hx, hy - 50, "神聖之盾！金光璀璨 格擋防禦暴增", "#fbbf24");
            }
        };

        directorProto.spawnHeroZeal = function(hx, hy, tx, ty) {
            this.playSfx('combat/swing');
            const char = this.sandbox ? this.sandbox.character : null;
            if (char) {
                char.zealStrikesRemaining = 4;
            }
            this.onHeroMeleeAttack(hx, hy, char ? char.currentDir : 0, 'zeal');
        };

        directorProto.spawnHeroFoh = function(tx, ty) {
            this.playSfx('combat/foh_cast');
            const meta = this.fxManifest.skills ? this.fxManifest.skills.foh : null;
            if (!meta) return;

            this.missiles.push({
                mode: "ground_hazard",
                type: "foh",
                x: tx,
                y: ty,
                lifetime: 0,
                maxLifetime: 750,
                damage: 85,
                radius: 65,
                meta: meta
            });

            // 命中受創點炸出 6 發聖光彈
            setTimeout(() => {
                for (let i = 0; i < 6; i++) {
                    const ang = (i / 6) * Math.PI * 2;
                    this.spawnHeroHolyBolt(tx, ty, tx + Math.cos(ang) * 120, ty + Math.sin(ang) * 120);
                }
            }, 300);
        };

        // ==========================================
        // 3. 野蠻人 (Barbarian) 專屬技能具體實裝
        // ==========================================

        directorProto.spawnHeroMeleeSkill = function(skillName, hx, hy, tx, ty) {
            const char = this.sandbox ? this.sandbox.character : null;
            const dir = char ? char.currentDir : 0;
            this.playSfx(skillName === 'bash' ? 'combat/smite' : 'combat/swing');
            this.onHeroMeleeAttack(hx, hy, dir, skillName);

            const names = {
                'bash': '重擊 (擊退震盪)',
                'double_swing': '雙重打擊 (雙持速攻)',
                'concentrate': '專注打擊 (霸體堅定斬)',
                'frenzy': '狂亂 (雙持狂暴加速)',
                'berserk': '狂戰士 (魔法破甲巨力重劈)'
            };
            if (this.addFloatingText) {
                this.addFloatingText(hx, hy - 50, names[skillName] || skillName, "#ef4444");
            }
        };

        directorProto.spawnHeroDoubleThrow = function(hx, hy, tx, ty) {
            this.playSfx('combat/swing');
            const dx = tx - hx;
            const dy = ty - hy;
            const angle = Math.atan2(dy, dx);
            const speed = 0.42;
            const meta = this.fxManifest.skills ? this.fxManifest.skills.blade_fury : null;
            if (!meta) return;

            for (let i = -1; i <= 1; i += 2) {
                const spAng = angle + i * 0.12;
                this.missiles.push({
                    mode: "linear",
                    type: "blade_fury",
                    x: hx + Math.cos(spAng) * 16,
                    y: hy + Math.sin(spAng) * 16,
                    vx: Math.cos(spAng) * speed,
                    vy: Math.sin(spAng) * speed,
                    direction: 0,
                    lifetime: 0,
                    maxLifetime: 1400,
                    damage: 45,
                    isEnemy: false,
                    meta: meta
                });
            }
        };

        directorProto.spawnHeroLeapAttack = function(hx, hy, tx, ty) {
            this.playSfx('combat/smite');
            const char = this.sandbox ? this.sandbox.character : null;
            if (char) {
                char.x = tx;
                char.y = ty;
            }
            this.spawnHitShock(tx, ty);
            for (const m of this.monsters) {
                if (!m.isDead && !m.remove) {
                    const d = Math.hypot(m.x - tx, (m.y - ty) * 2);
                    if (d <= 90) {
                        m.takeDamage(60);
                        this.spawnHitShock(m.x, m.y);
                    }
                }
            }
            if (this.addFloatingText) {
                this.addFloatingText(tx, ty - 50, "跳躍攻擊！撲殺震地", "#f97316");
            }
        };

        directorProto.spawnHeroGrimWard = function(tx, ty) {
            this.playSfx('combat/cast');
            const meta = this.fxManifest.skills ? this.fxManifest.skills.grim_ward : null;
            if (!meta) return;

            this.missiles.push({
                mode: "ground_hazard",
                type: "grim_ward",
                x: tx,
                y: ty,
                lifetime: 0,
                maxLifetime: 12000,
                damage: 15,
                radius: 120,
                isGrimWard: true,
                meta: meta
            });
            if (this.addFloatingText) {
                this.addFloatingText(tx, ty - 50, "殘酷庇護所！恐怖骨駭圖騰立起", "#a855f7");
            }
        };

        // ==========================================
        // 4. 德魯伊 (Druid) 專屬技能具體實裝
        // ==========================================

        directorProto.spawnHeroFirestorm = function(hx, hy, tx, ty) {
            this.playSfx('castfire');
            const dx = tx - hx;
            const dy = ty - hy;
            const baseAngle = Math.atan2(dy, dx);
            const speed = 0.28;
            const meta = this.fxManifest.skills ? this.fxManifest.skills.firestorm : null;
            if (!meta) return;

            for (let i = -1; i <= 1; i++) {
                const angle = baseAngle + i * 0.22;
                this.missiles.push({
                    mode: "linear",
                    type: "firestorm",
                    x: hx + Math.cos(angle) * 16,
                    y: hy + Math.sin(angle) * 16,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    direction: Math.round(((angle * 180 / Math.PI + 360) % 360) / 22.5) % 16,
                    lifetime: 0,
                    maxLifetime: 1800,
                    damage: 38,
                    aoeRadius: 40,
                    isEnemy: false,
                    meta: meta
                });
            }
        };

        directorProto.spawnHeroMoltenBoulder = function(hx, hy, tx, ty) {
            this.playSfx('castfire');
            const dx = tx - hx;
            const dy = ty - hy;
            const angle = Math.atan2(dy, dx);
            const speed = 0.25;
            const meta = this.fxManifest.skills ? this.fxManifest.skills.molten_boulder : null;
            if (!meta) return;

            this.missiles.push({
                mode: "linear",
                type: "molten_boulder",
                x: hx + Math.cos(angle) * 20,
                y: hy + Math.sin(angle) * 20,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                direction: Math.round(((angle * 180 / Math.PI + 360) % 360) / 22.5) % 16,
                lifetime: 0,
                maxLifetime: 2200,
                damage: 58,
                knockback: 28,
                aoeRadius: 60,
                isEnemy: false,
                meta: meta
            });
        };

        directorProto.spawnHeroEruption = function(tx, ty) {
            this.playSfx('castfire');
            const meta = this.fxManifest.skills ? this.fxManifest.skills.meteorlavaburst : null;
            if (!meta) return;

            this.missiles.push({
                mode: "ground_hazard",
                type: "meteorlavaburst",
                x: tx,
                y: ty,
                lifetime: 0,
                maxLifetime: 5000,
                damage: 36,
                radius: 80,
                tickInterval: 220,
                meta: meta
            });
        };

        directorProto.spawnHeroTwister = function(hx, hy, tx, ty) {
            this.playSfx('tornado');
            const dx = tx - hx;
            const dy = ty - hy;
            const baseAngle = Math.atan2(dy, dx);
            const speed = 0.28;
            const meta = this.fxManifest.skills ? this.fxManifest.skills.tornado : null;
            if (!meta) return;

            for (let i = -1; i <= 1; i++) {
                const angle = baseAngle + i * 0.25;
                this.missiles.push({
                    mode: "tornado",
                    type: "tornado",
                    x: hx,
                    y: hy,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    lifetime: 0,
                    maxLifetime: 1600,
                    damage: 26,
                    isEnemy: false,
                    meta: meta
                });
            }
        };

        directorProto.spawnHeroVolcano = function(tx, ty) {
            this.playSfx('castfire');
            const meta = this.fxManifest.skills ? this.fxManifest.skills.volcano : null;
            if (!meta) return;

            this.missiles.push({
                mode: "volcano_entity",
                type: "volcano",
                x: tx,
                y: ty,
                lifetime: 0,
                maxLifetime: 7500,
                shootTimer: 0,
                meta: meta
            });
        };

        directorProto.spawnHeroCycloneArmor = function(hx, hy) {
            this.playSfx('tornado');
            const char = this.sandbox ? this.sandbox.character : null;
            if (char) char.cycloneArmorTimer = 18000;
            if (this.addFloatingText) {
                this.addFloatingText(hx, hy - 50, "颶風裝甲！狂風氣旋護體", "#e2e8f0");
            }
        };

        directorProto.spawnHeroArmageddon = function(hx, hy) {
            this.playSfx('castfire');
            const char = this.sandbox ? this.sandbox.character : null;
            if (char) char.armageddonTimer = 16000;
            if (this.addFloatingText) {
                this.addFloatingText(hx, hy - 50, "毀天滅地！天火流星雨全面轟炸", "#ef4444");
            }
        };

        directorProto.spawnHeroHurricane = function(hx, hy) {
            this.playSfx('castcold');
            const char = this.sandbox ? this.sandbox.character : null;
            if (char) char.hurricaneTimer = 18000;
            if (this.addFloatingText) {
                this.addFloatingText(hx, hy - 50, "急凍暴風！身周急凍旋渦護體", "#38bdf8");
            }
        };

        directorProto.spawnHeroShapeshiftAttack = function(skillName, hx, hy, tx, ty) {
            this.playSfx('combat/smite');
            const char = this.sandbox ? this.sandbox.character : null;
            this.onHeroMeleeAttack(hx, hy, char ? char.currentDir : 0, 'slash');
            const names = {
                'maul': '熊人撞擊 (重拍擊暈)',
                'rabies': '狂犬病 (劇毒傳染)',
                'fire_claws': '烈焰爪 (火炎爆破)',
                'hunger': '飢餓撕咬 (偷生偷魔)',
                'fury': '狼人狂怒五連撕咬'
            };
            if (this.addFloatingText) {
                this.addFloatingText(hx, hy - 50, names[skillName] || skillName, "#10b981");
            }
        };

        directorProto.spawnHeroShockwave = function(hx, hy, tx, ty) {
            this.playSfx('combat/smite');
            const dx = tx - hx;
            const dy = ty - hy;
            const angle = Math.atan2(dy, dx);
            const speed = 0.36;
            const meta = this.fxManifest.skills ? this.fxManifest.skills.shockwave : null;
            if (!meta) return;

            this.missiles.push({
                mode: "linear",
                type: "shockwave",
                x: hx + Math.cos(angle) * 20,
                y: hy + Math.sin(angle) * 20,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                direction: Math.round(((angle * 180 / Math.PI + 360) % 360) / 45) % 8,
                lifetime: 0,
                maxLifetime: 1400,
                damage: 50,
                piercing: true,
                isEnemy: false,
                meta: meta
            });
        };

        directorProto.spawnHeroTransform = function(form) {
            this.playSfx('combat/swing');
            const title = (form === 'wearwolf') ? "變形狼人！迅捷狂暴姿態" : "變形熊人！狂怒巨獸姿態";
            if (this.addFloatingText) {
                const char = this.sandbox ? this.sandbox.character : null;
                const x = char ? char.x : 512;
                const y = char ? char.y : 400;
                this.addFloatingText(x, y - 55, title, "#fbbf24");
            }
        };

        directorProto.spawnHeroCompanion = function(companionKey, promptText = null) {
            this.playSfx('combat/cast');
            const hero = this.sandbox ? this.sandbox.character : null;
            if (!hero) return;

            if (typeof CompanionEntity !== 'undefined') {
                this.companions.push(new CompanionEntity(companionKey, hero, this));
            }
            if (promptText && this.addFloatingText) {
                this.addFloatingText(hero.x, hero.y - 55, promptText, "#4ade80");
            }
        };

        // ==========================================
        // 5. 死靈法師 (Necromancer) 專屬技能具體實裝
        // ==========================================

        directorProto.spawnHeroPoisonDagger = function(hx, hy, tx, ty) {
            this.playSfx('combat/swing');
            const char = this.sandbox ? this.sandbox.character : null;
            this.onHeroMeleeAttack(hx, hy, char ? char.currentDir : 0, 'slash');
            if (this.addFloatingText) {
                this.addFloatingText(hx, hy - 50, "劇毒匕首！濃稠毒素刺擊", "#22c55e");
            }
        };

        directorProto.spawnHeroBoneArmor = function(hx, hy) {
            this.playSfx('bonecast');
            const char = this.sandbox ? this.sandbox.character : null;
            if (char) char.boneArmorTimer = 18000;
            if (this.addFloatingText) {
                this.addFloatingText(hx, hy - 50, "白骨護甲！旋轉肋骨吸收物理傷害", "#e2e8f0");
            }
        };

        directorProto.spawnHeroCorpseExplosion = function(tx, ty) {
            this.playSfx('boom1');
            const meta = this.fxManifest.skills ? this.fxManifest.skills.corpse_explosion : null;
            if (!meta) return;

            this.missiles.push({
                mode: "ground_hazard",
                type: "corpse_explosion",
                x: tx,
                y: ty,
                lifetime: 0,
                maxLifetime: 700,
                damage: 88,
                radius: 95,
                meta: meta
            });
            this.spawnHitShock(tx, ty);
        };

        directorProto.spawnHeroPoisonExplosion = function(tx, ty) {
            this.playSfx('poisoncast');
            const meta = this.fxManifest.skills ? this.fxManifest.skills.poison_explosion : null;
            if (!meta) return;

            this.missiles.push({
                mode: "ground_hazard",
                type: "poison_explosion",
                x: tx,
                y: ty,
                lifetime: 0,
                maxLifetime: 3500,
                damage: 32,
                radius: 110,
                tickInterval: 250,
                meta: meta
            });
        };

        directorProto.spawnHeroRevive = function(tx, ty) {
            this.playSfx('bonecast');
            this.spawnHeroCompanion('skeleton_minion', "遺骸復生！復活戰友隨軍衝鋒");
        };

        // ==========================================
        // 6. 亞馬遜 (Amazon) 專屬技能具體實裝
        // ==========================================

        directorProto.spawnHeroMagicArrow = function(hx, hy, tx, ty) {
            this.playSfx('arrow1');
            const dx = tx - hx;
            const dy = ty - hy;
            const angle = Math.atan2(dy, dx);
            const speed = 0.52;
            const meta = this.fxManifest.skills ? this.fxManifest.skills.arrow : null;
            if (!meta) return;

            this.missiles.push({
                mode: "linear",
                type: "arrow",
                x: hx + Math.cos(angle) * 18,
                y: hy + Math.sin(angle) * 18,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                direction: Math.round(((angle * 180 / Math.PI + 360) % 360) / 11.25) % 32,
                lifetime: 0,
                maxLifetime: 1500,
                damage: 42,
                piercing: true,
                isEnemy: false,
                meta: meta
            });
        };

        directorProto.spawnHeroFireArrow = function(hx, hy, tx, ty) {
            this.playSfx('castfire');
            const dx = tx - hx;
            const dy = ty - hy;
            const angle = Math.atan2(dy, dx);
            const speed = 0.50;
            const meta = this.fxManifest.skills ? this.fxManifest.skills.fire_arrow : null;
            if (!meta) return;

            this.missiles.push({
                mode: "linear",
                type: "fire_arrow",
                x: hx + Math.cos(angle) * 18,
                y: hy + Math.sin(angle) * 18,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                direction: Math.round(((angle * 180 / Math.PI + 360) % 360) / 11.25) % 32,
                lifetime: 0,
                maxLifetime: 1500,
                damage: 48,
                aoeRadius: 45,
                isEnemy: false,
                meta: meta
            });
        };

        directorProto.spawnHeroColdArrow = function(hx, hy, tx, ty) {
            this.playSfx('castcold');
            const dx = tx - hx;
            const dy = ty - hy;
            const angle = Math.atan2(dy, dx);
            const speed = 0.50;
            const meta = this.fxManifest.skills ? this.fxManifest.skills.ice_arrow : null;
            if (!meta) return;

            this.missiles.push({
                mode: "linear",
                type: "ice_arrow",
                x: hx + Math.cos(angle) * 18,
                y: hy + Math.sin(angle) * 18,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                direction: Math.round(((angle * 180 / Math.PI + 360) % 360) / 11.25) % 32,
                lifetime: 0,
                maxLifetime: 1500,
                damage: 46,
                chilled: true,
                isEnemy: false,
                meta: meta
            });
        };

        directorProto.spawnHeroExplodingArrow = function(hx, hy, tx, ty) {
            this.playSfx('castfire');
            const dx = tx - hx;
            const dy = ty - hy;
            const angle = Math.atan2(dy, dx);
            const speed = 0.50;
            const meta = this.fxManifest.skills ? this.fxManifest.skills.fire_arrow : null;
            if (!meta) return;

            this.missiles.push({
                mode: "linear",
                type: "fire_arrow",
                x: hx + Math.cos(angle) * 18,
                y: hy + Math.sin(angle) * 18,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                direction: Math.round(((angle * 180 / Math.PI + 360) % 360) / 11.25) % 32,
                lifetime: 0,
                maxLifetime: 1500,
                damage: 58,
                aoeRadius: 75,
                isEnemy: false,
                meta: meta
            });
        };

        directorProto.spawnHeroIceArrow = function(hx, hy, tx, ty) {
            this.playSfx('castcold');
            const dx = tx - hx;
            const dy = ty - hy;
            const angle = Math.atan2(dy, dx);
            const speed = 0.50;
            const meta = this.fxManifest.skills ? this.fxManifest.skills.ice_arrow : null;
            if (!meta) return;

            this.missiles.push({
                mode: "linear",
                type: "ice_arrow",
                x: hx + Math.cos(angle) * 18,
                y: hy + Math.sin(angle) * 18,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                direction: Math.round(((angle * 180 / Math.PI + 360) % 360) / 11.25) % 32,
                lifetime: 0,
                maxLifetime: 1500,
                damage: 54,
                frozen: true,
                isEnemy: false,
                meta: meta
            });
        };

        directorProto.spawnHeroGuidedArrow = function(hx, hy, tx, ty) {
            this.playSfx('arrow1');
            const dx = tx - hx;
            const dy = ty - hy;
            const angle = Math.atan2(dy, dx);
            const speed = 0.46;
            const meta = this.fxManifest.skills ? this.fxManifest.skills.guided_arrow : null;
            if (!meta) return;

            this.missiles.push({
                mode: "linear",
                type: "guided_arrow",
                x: hx + Math.cos(angle) * 18,
                y: hy + Math.sin(angle) * 18,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                direction: Math.round(((angle * 180 / Math.PI + 360) % 360) / 11.25) % 32,
                lifetime: 0,
                maxLifetime: 2200,
                damage: 56,
                homing: true,
                isEnemy: false,
                meta: meta
            });
        };

        directorProto.spawnHeroStrafe = function(hx, hy, tx, ty) {
            this.playSfx('arrow1');
            for (let i = 0; i < 8; i++) {
                setTimeout(() => {
                    const spAng = Math.random() * Math.PI * 2;
                    this.spawnHeroArrow(hx, hy, hx + Math.cos(spAng) * 200, hy + Math.sin(spAng) * 200);
                }, i * 65);
            }
        };

        directorProto.spawnHeroImmolationArrow = function(hx, hy, tx, ty) {
            this.playSfx('castfire');
            this.spawnHeroFireArrow(hx, hy, tx, ty);
            setTimeout(() => {
                this.spawnHeroEruption(tx, ty);
            }, 300);
        };

        directorProto.spawnHeroFreezingArrow = function(hx, hy, tx, ty) {
            this.playSfx('castcold');
            this.spawnHeroIceArrow(hx, hy, tx, ty);
            setTimeout(() => {
                this.spawnHeroFrostNova(tx, ty);
            }, 300);
        };

        directorProto.spawnHeroValkyrie = function(hx, hy) {
            this.playSfx('combat/cast');
            const hero = this.sandbox ? this.sandbox.character : null;
            if (hero) {
                this.spawnHeroCompanion('bear', "召喚女武神！黃金神槍隨行作戰");
            }
        };

        directorProto.spawnHeroSpearMelee = function(skillName, hx, hy, tx, ty) {
            this.playSfx('combat/smite');
            const char = this.sandbox ? this.sandbox.character : null;
            this.onHeroMeleeAttack(hx, hy, char ? char.currentDir : 0, 'jab');
            const names = {
                'jab': '長矛戳刺 (快速三連擊)',
                'power_strike': '強力一擊 (電芒爆發)',
                'impale': '刺爆 (沉重破甲)',
                'fend': '全方位連續刺擊'
            };
            if (this.addFloatingText) {
                this.addFloatingText(hx, hy - 50, names[skillName] || skillName, "#fbbf24");
            }
        };

        directorProto.spawnHeroPoisonJavelin = function(hx, hy, tx, ty) {
            this.playSfx('magicarrow1');
            const dx = tx - hx;
            const dy = ty - hy;
            const angle = Math.atan2(dy, dx);
            const speed = 0.42;
            const meta = this.fxManifest.skills ? this.fxManifest.skills.javelin : null;
            if (!meta) return;

            this.missiles.push({
                mode: "linear",
                type: "javelin",
                x: hx + Math.cos(angle) * 16,
                y: hy + Math.sin(angle) * 16,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                direction: Math.round(((angle * 180 / Math.PI + 360) % 360) / 11.25) % 32,
                lifetime: 0,
                maxLifetime: 1600,
                damage: 38,
                leavesPoisonTrail: true,
                isEnemy: false,
                meta: meta
            });
        };

        directorProto.spawnHeroLightningBolt = function(hx, hy, tx, ty) {
            this.playSfx('magicarrow1');
            const dx = tx - hx;
            const dy = ty - hy;
            const angle = Math.atan2(dy, dx);
            const speed = 0.48;
            const meta = this.fxManifest.skills ? this.fxManifest.skills.lightning_javelin : null;
            if (!meta) return;

            this.missiles.push({
                mode: "linear",
                type: "lightning_javelin",
                x: hx + Math.cos(angle) * 16,
                y: hy + Math.sin(angle) * 16,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                direction: Math.round(((angle * 180 / Math.PI + 360) % 360) / 11.25) % 32,
                lifetime: 0,
                maxLifetime: 1600,
                damage: 54,
                piercing: true,
                isEnemy: false,
                meta: meta
            });
        };

        directorProto.spawnHeroChargedStrike = function(hx, hy, tx, ty) {
            this.playSfx('combat/smite');
            const char = this.sandbox ? this.sandbox.character : null;
            this.onHeroMeleeAttack(hx, hy, char ? char.currentDir : 0, 'jab');
            this.spawnHeroChargedBolt(hx, hy, tx, ty);
        };

        directorProto.spawnHeroPlagueJavelin = function(hx, hy, tx, ty) {
            this.playSfx('magicarrow1');
            this.spawnHeroPoisonJavelin(hx, hy, tx, ty);
            setTimeout(() => {
                this.spawnHeroPoisonExplosion(tx, ty);
            }, 300);
        };

        directorProto.spawnHeroLightningStrike = function(hx, hy, tx, ty) {
            this.playSfx('combat/smite');
            const char = this.sandbox ? this.sandbox.character : null;
            this.onHeroMeleeAttack(hx, hy, char ? char.currentDir : 0, 'jab');
            this.spawnHeroChainLightning(hx, hy, tx, ty);
        };

        directorProto.spawnHeroLightningFury = function(hx, hy, tx, ty) {
            this.playSfx('magicarrow1');
            const dx = tx - hx;
            const dy = ty - hy;
            const angle = Math.atan2(dy, dx);
            const speed = 0.48;
            const meta = this.fxManifest.skills ? this.fxManifest.skills.lightning_javelin : null;
            if (!meta) return;

            this.missiles.push({
                mode: "linear",
                type: "lightning_javelin",
                x: hx + Math.cos(angle) * 18,
                y: hy + Math.sin(angle) * 18,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                direction: Math.round(((angle * 180 / Math.PI + 360) % 360) / 11.25) % 32,
                lifetime: 0,
                maxLifetime: 1600,
                damage: 64,
                splitsOnHit: true,
                isEnemy: false,
                meta: meta
            });
        };

        // ==========================================
        // 7. 刺客 (Assassin) 專屬技能具體實裝
        // ==========================================

        directorProto.spawnHeroFireTrauma = function(hx, hy, tx, ty) {
            this.playSfx('castfire');
            const dx = tx - hx;
            const dy = ty - hy;
            const angle = Math.atan2(dy, dx);
            const speed = 0.36;
            const meta = this.fxManifest.skills ? this.fxManifest.skills.fireball : null;
            if (!meta) return;

            this.missiles.push({
                mode: "linear",
                type: "fireball",
                x: hx,
                y: hy - 20,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                direction: 0,
                lifetime: 0,
                maxLifetime: 800,
                damage: 48,
                aoeRadius: 65,
                isEnemy: false,
                meta: meta
            });
        };

        directorProto.spawnHeroShockField = function(tx, ty) {
            this.playSfx('lightning1');
            const meta = this.fxManifest.skills ? this.fxManifest.skills.nova : null;
            if (!meta) return;

            this.missiles.push({
                mode: "ground_hazard",
                type: "nova",
                x: tx,
                y: ty,
                lifetime: 0,
                maxLifetime: 5000,
                damage: 24,
                radius: 65,
                tickInterval: 280,
                meta: meta
            });
        };

        directorProto.spawnHeroBladeSentinel = function(hx, hy, tx, ty) {
            this.playSfx('bladefury1');
            const meta = this.fxManifest.skills ? this.fxManifest.skills.blade_shield : null;
            if (!meta) return;

            this.missiles.push({
                mode: "blade_sentinel",
                type: "blade_shield",
                startX: hx,
                startY: hy,
                targetX: tx,
                targetY: ty,
                x: hx,
                y: hy,
                lifetime: 0,
                maxLifetime: 3500,
                damage: 42,
                meta: meta
            });
        };

        directorProto.spawnHeroSentry = function(sentryType, tx, ty) {
            this.playSfx('lightning1');
            const meta = this.fxManifest.skills ? this.fxManifest.skills.death_sentry : null;
            if (!meta) return;

            this.missiles.push({
                mode: "trap",
                type: "trap_lightning",
                x: tx,
                y: ty,
                lifetime: 0,
                maxLifetime: 9000,
                meta: meta
            });
        };

        directorProto.spawnHeroDeathSentry = function(tx, ty) {
            this.playSfx('lightning1');
            const meta = this.fxManifest.skills ? this.fxManifest.skills.death_sentry : null;
            if (!meta) return;

            this.missiles.push({
                mode: "ground_hazard",
                type: "death_sentry",
                x: tx,
                y: ty,
                lifetime: 0,
                maxLifetime: 9000,
                damage: 55,
                radius: 120,
                isDeathSentry: true,
                meta: meta
            });
        };

        directorProto.spawnHeroBladeShield = function(hx, hy) {
            this.playSfx('bladefury1');
            const char = this.sandbox ? this.sandbox.character : null;
            if (char) char.bladeShieldTimer = 14000;
            if (this.addFloatingText) {
                this.addFloatingText(hx, hy - 50, "刀刃之盾！旋轉飛刀緊身護體", "#a78bfa");
            }
        };

        directorProto.spawnHeroShadowMaster = function(hx, hy) {
            this.playSfx('combat/cast');
            this.spawnHeroCompanion('wolf', "召喚暗影宗師！影武者同行戰鬥");
        };

        directorProto.spawnHeroMartialStrike = function(strikeName, hx, hy, tx, ty) {
            this.playSfx('combat/swing');
            const char = this.sandbox ? this.sandbox.character : null;
            this.onHeroMeleeAttack(hx, hy, char ? char.currentDir : 0, 'slash');
            const names = {
                'tiger_strike': '虎擊 (蓄力三段物傷暴增)',
                'fists_of_fire': '焰拳 (烈火連擊爪法)',
                'dragon_claw': '雙龍爪 (交叉撕裂雙斬)',
                'cobra_strike': '眼鏡蛇擊 (劇毒吸血吸魔)',
                'claws_of_thunder': '雷電爪 (雷霆充能爆發)',
                'blades_of_ice': '寒冰刃 (嚴冬急凍寒霜爪)'
            };
            if (this.addFloatingText) {
                this.addFloatingText(hx, hy - 50, names[strikeName] || strikeName, "#f59e0b");
            }
        };

        directorProto.spawnHeroDragonTalon = function(hx, hy, tx, ty) {
            this.playSfx('kick');
            const char = this.sandbox ? this.sandbox.character : null;
            if (char) {
                char.setState('attack');
            }
            this.onHeroMeleeAttack(hx, hy, char ? char.currentDir : 0, 'slash');
            if (this.addFloatingText) {
                this.addFloatingText(hx, hy - 50, "龍爪飛踢！原廠KK連續飛踢", "#ef4444");
            }
        };

        directorProto.spawnHeroDragonTail = function(hx, hy, tx, ty) {
            this.playSfx('kick');
            const char = this.sandbox ? this.sandbox.character : null;
            if (char) char.setState('attack');
            this.spawnFireNova(tx, ty, 50);
            if (this.addFloatingText) {
                this.addFloatingText(tx, ty - 50, "神龍擺尾！原廠KK爆踢火焰衝擊", "#f97316");
            }
        };

        directorProto.spawnHeroDragonFlight = function(hx, hy, tx, ty) {
            this.playSfx('kick');
            const char = this.sandbox ? this.sandbox.character : null;
            if (char) {
                char.x = tx;
                char.y = ty;
                char.setState('attack');
            }
            this.spawnHitShock(tx, ty);
            this.onHeroMeleeAttack(tx, ty, 0, 'slash');
            if (this.addFloatingText) {
                this.addFloatingText(tx, ty - 50, "飛龍在天！瞬間瞬移擊爆目標", "#ec4899");
            }
        };

        directorProto.spawnHeroRoyalStrike = function(hx, hy, tx, ty) {
            this.playSfx('combat/smite');
            this.spawnHeroMeteor(tx, ty);
            this.spawnHeroNova(hx, hy);
            this.spawnHeroFrostNova(hx, hy);
            if (this.addFloatingText) {
                this.addFloatingText(tx, ty - 50, "鳳凰連擊！火冰電三重終极大招", "#fbbf24");
            }
        };

        // ==========================================
        // 8. 專屬彈道物理與週期行為更新 (Update Hook)
        // ==========================================
        directorProto.updateExtendedMissiles = function(deltaMs, heroX, heroY) {
            for (let i = this.missiles.length - 1; i >= 0; i--) {
                const mis = this.missiles[i];

                // 隕石天降 (Meteor Strike)
                if (mis.mode === 'meteor_strike') {
                    if (!mis.hasImpacted) {
                        mis.delayTimer -= deltaMs;
                        if (mis.delayTimer <= 0) {
                            mis.meteorY += 0.45 * deltaMs;
                            if (mis.meteorY >= 0) {
                                mis.hasImpacted = true;
                                mis.frame = 0;
                                this.playSfx('boom1');
                                this.spawnHitShock(mis.x, mis.y);
                                for (const m of this.monsters) {
                                    if (!m.isDead && !m.remove) {
                                        const d = Math.hypot(m.x - mis.x, (m.y - mis.y) * 2);
                                        if (d <= mis.aoeRadius) {
                                            m.takeDamage(mis.damage);
                                            this.spawnHitShock(m.x, m.y);
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        // 地表熔岩燃燒
                        mis.tickTimer = (mis.tickTimer || 0) + deltaMs;
                        if (mis.tickTimer >= 250) {
                            mis.tickTimer = 0;
                            for (const m of this.monsters) {
                                if (!m.isDead && !m.remove) {
                                    const d = Math.hypot(m.x - mis.x, (m.y - mis.y) * 2);
                                    if (d <= mis.aoeRadius) {
                                        m.takeDamage(22);
                                    }
                                }
                            }
                        }
                        const lavaMeta = this.fxManifest.skills ? this.fxManifest.skills.meteorlavaburst : null;
                        if (lavaMeta) {
                            mis.frame = Math.floor(mis.lifetime / 70) % lavaMeta.frames;
                        }
                    }
                    if (mis.lifetime >= mis.maxLifetime) {
                        this.missiles.splice(i, 1);
                    }
                    continue;
                }

                // 冰封球 (Frozen Orb)
                if (mis.mode === 'frozen_orb') {
                    mis.x += mis.vx * deltaMs;
                    mis.y += mis.vy * deltaMs * 0.55;
                    mis.spinAngle += 0.035 * deltaMs;
                    mis.sprayTimer += deltaMs;

                    if (mis.sprayTimer >= 75) {
                        mis.sprayTimer = 0;
                        const sAngle = mis.spinAngle;
                        for (let k = 0; k < 2; k++) {
                            const curA = sAngle + k * Math.PI;
                            const sx = mis.x + Math.cos(curA) * 12;
                            const sy = mis.y + Math.sin(curA) * 12;
                            this.spawnHeroIceBolt(sx, sy, sx + Math.cos(curA) * 100, sy + Math.sin(curA) * 100);
                        }
                    }

                    if (mis.lifetime >= mis.maxLifetime) {
                        this.spawnHeroFrostNova(mis.x, mis.y);
                        this.missiles.splice(i, 1);
                    }
                    continue;
                }

                // 地表危害實體 (Ground Hazard: 火牆、火山、屍爆、毒爆、殘酷庇護所)
                if (mis.mode === 'ground_hazard') {
                    if (mis.meta) {
                        mis.frame = Math.floor(mis.lifetime / 70) % mis.meta.frames;
                    }
                    mis.tickTimer = (mis.tickTimer || 0) + deltaMs;
                    if (mis.tickTimer >= (mis.tickInterval || 250)) {
                        mis.tickTimer = 0;
                        for (const m of this.monsters) {
                            if (!m.isDead && !m.remove) {
                                const d = Math.hypot(m.x - mis.x, (m.y - mis.y) * 2);
                                if (d <= mis.radius) {
                                    m.takeDamage(mis.damage);
                                    if (mis.isGrimWard) {
                                        // 殘酷庇護所恐嚇震退怪物
                                        m.x += (m.x - mis.x) * 0.15;
                                        m.y += (m.y - mis.y) * 0.15;
                                    }
                                }
                            }
                        }
                    }
                    if (mis.lifetime >= mis.maxLifetime) {
                        this.missiles.splice(i, 1);
                    }
                    continue;
                }

                // 九頭火蛇實體 (Hydra)
                if (mis.mode === 'hydra_entity') {
                    if (mis.meta) {
                        mis.frame = Math.floor(mis.lifetime / 80) % mis.meta.frames;
                    }
                    mis.shootTimer += deltaMs;
                    if (mis.shootTimer >= 750) {
                        mis.shootTimer = 0;
                        const target = this.getNearestMonster(mis.x, mis.y);
                        if (target) {
                            this.spawnHeroFireBolt(mis.x, mis.y - 18, target.x, target.y);
                        }
                    }
                    if (mis.lifetime >= mis.maxLifetime) {
                        this.missiles.splice(i, 1);
                    }
                    continue;
                }

                // 活火山噴發 (Volcano)
                if (mis.mode === 'volcano_entity') {
                    if (mis.meta) {
                        mis.frame = Math.floor(mis.lifetime / 80) % mis.meta.frames;
                    }
                    mis.shootTimer += deltaMs;
                    if (mis.shootTimer >= 320) {
                        mis.shootTimer = 0;
                        const rx = mis.x + (Math.random() - 0.5) * 120;
                        const ry = mis.y + (Math.random() - 0.5) * 60;
                        this.spawnHeroFireBolt(mis.x, mis.y - 25, rx, ry);
                    }
                    if (mis.lifetime >= mis.maxLifetime) {
                        this.missiles.splice(i, 1);
                    }
                    continue;
                }

                // 刃之守衛穿梭 (Blade Sentinel)
                if (mis.mode === 'blade_sentinel') {
                    const t = (mis.lifetime % 1200) / 1200;
                    const pingPong = (t < 0.5) ? (t * 2) : ((1 - t) * 2);
                    mis.x = mis.startX + (mis.targetX - mis.startX) * pingPong;
                    mis.y = mis.startY + (mis.targetY - mis.startY) * pingPong;
                    if (mis.meta) {
                        mis.frame = Math.floor(mis.lifetime / 30) % mis.meta.frames;
                    }
                    for (const m of this.monsters) {
                        if (!m.isDead && !m.remove) {
                            const d = Math.hypot(m.x - mis.x, (m.y - mis.y) * 2);
                            if (d <= 35) {
                                m.takeDamage(18);
                            }
                        }
                    }
                    if (mis.lifetime >= mis.maxLifetime) {
                        this.missiles.splice(i, 1);
                    }
                    continue;
                }

                // 導引箭自動尋標調整 (Homing)
                if (mis.homing && mis.mode === 'linear') {
                    const nearest = this.getNearestMonster(mis.x, mis.y);
                    if (nearest) {
                        const targetAngle = Math.atan2(nearest.y - mis.y, nearest.x - mis.x);
                        const curAngle = Math.atan2(mis.vy, mis.vx);
                        const diff = targetAngle - curAngle;
                        const steer = Math.sign(diff) * Math.min(0.08, Math.abs(diff));
                        const newAngle = curAngle + steer;
                        const spd = Math.hypot(mis.vx, mis.vy);
                        mis.vx = Math.cos(newAngle) * spd;
                        mis.vy = Math.sin(newAngle) * spd;
                    }
                }

                // 閃電之怒命中分岔 (Splits on Hit)
                if (mis.splitsOnHit && mis.mode === 'linear') {
                    for (const m of this.monsters) {
                        if (!m.isDead && !m.remove) {
                            const d = Math.hypot(m.x - mis.x, (m.y - mis.y) * 2);
                            if (d <= 30) {
                                m.takeDamage(mis.damage);
                                this.playSfx('lightning1');
                                // 爆散 10 道閃電
                                for (let k = 0; k < 10; k++) {
                                    const a = (k / 10) * Math.PI * 2;
                                    this.spawnHeroLightningBolt(m.x, m.y, m.x + Math.cos(a) * 180, m.y + Math.sin(a) * 180);
                                }
                                this.missiles.splice(i, 1);
                                break;
                            }
                        }
                    }
                }
            }
        };

        directorProto.addFloatingText = function(x, y, text, color = "#fbbf24") {
            if (text === null || text === undefined || text === 'NaN' || text === '-NaN') return;
            if (typeof text === 'string' && text.includes('NaN')) return;
            if (typeof text === 'number' && (isNaN(text) || !isFinite(text))) return;
            // 依據使用者指令：施展技能時絕不跳出技能名稱或公告文字，僅保留數值傷害跳字
            if (typeof text === 'string' && !text.match(/^[-+0-9]/)) {
                return;
            }
            if (!this.damageNumbers) this.damageNumbers = [];
            this.damageNumbers.push({
                x: x,
                y: y,
                text: text,
                color: color,
                lifetime: 0,
                maxLifetime: 1200,
                vy: -0.035
            });
        };

        directorProto.showFloatingCombatText = function(x, y, text, color = "#fbbf24") {
            this.addFloatingText(x, y, text, color);
        };

        console.log("[CombatSkillsExtension] All selected skills loaded successfully.");
    };

    // 若 CombatDirector 已存在於 window，立即註冊掛載
    if (window.CombatDirector && window.CombatDirector.prototype) {
        window.initCombatSkillsExtension(window.CombatDirector.prototype);
    }
})();

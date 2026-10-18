/**
 * Diablo II 2.5D 等距動作地牢沙盒視圖 (Isometric Action Sandbox)
 * 負責地牢畫布渲染、滑鼠與鍵盤事件捕獲、路徑引導標記、動態光影與 HUD 監控數據更新。
 */
class DungeonSandbox {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.canvas = null;
        this.ctx = null;
        this.character = null;
        this.accumulator = null;

        // 地磚與背景 (支援 Act 1 ~ Act 5 官方原廠真實高清大地圖、小怪與首領對應切換)
        this.scenes = [
            {
                act: 1,
                name: "【第 1 幕】蘿格營地 (Rogue Encampment)",
                file: "assets/maps/scene_act1.png",
                width: 2560,
                height: 1440,
                spawnX: 1280,
                spawnY: 720,
                boss: "andariel",
                mobs: ["fallen", "fallen_shaman", "skeleton", "zombie", "spider", "wraith", "goatman"]
            },
            {
                act: 2,
                name: "【第 2 幕】魯高因沙漠市集 (Lut Gholein)",
                file: "assets/maps/scene_act2.png",
                width: 2560,
                height: 1440,
                spawnX: 1280,
                spawnY: 720,
                boss: "duriel",
                mobs: ["beetle", "mummy", "sand_maggot", "blunderbore", "spider", "skeleton", "wraith"]
            },
            {
                act: 3,
                name: "【第 3 幕】庫拉斯特海港 (Kurast Docks)",
                file: "assets/maps/scene_act3.png",
                width: 2560,
                height: 1440,
                spawnX: 1280,
                spawnY: 720,
                boss: "mephisto",
                mobs: ["council", "fetish", "fetish_shaman", "frog_demon", "zombie", "spider", "wraith"]
            },
            {
                act: 4,
                name: "【第 4 幕】群魔堡壘 (Pandemonium Fortress)",
                file: "assets/maps/scene_act4.png",
                width: 2730,
                height: 1536,
                spawnX: 1365,
                spawnY: 768,
                boss: "diablo",
                mobs: ["doom_knight", "balrog", "succubus", "blood_lord", "skeleton", "wraith"]
            },
            {
                act: 5,
                name: "【第 5 幕】哈洛加斯雪山要塞 (Harrogath)",
                file: "assets/maps/scene_act5.png",
                width: 2560,
                height: 1440,
                spawnX: 1280,
                spawnY: 720,
                boss: "baal",
                mobs: ["baal_minion", "blood_lord", "balrog", "succubus", "doom_knight", "council", "mummy", "fallen_shaman", "blunderbore"]
            }
        ];
        this.currentSceneIdx = 0;
        this.bgImage = new Image();
        this.bgImage.src = this.scenes[0].file;

        // 平滑相機系統 (Camera Tracking)
        this.cameraX = 0;
        this.cameraY = 0;

        // 導航點與戰鬥鎖定目標
        this.navMarker = null; // {x, y, radius, alpha, type}
        this.attackTargetMonster = null; // 當前鎖定點擊攻擊之怪物實體

        // 輸入監控
        this.keys = {};
        this.isMouseDown = false;
        this.isLeftMouseDown = false;
        this.isRightMouseDown = false;
        this.lastMousePos = { x: 400, y: 300 };
        this.lastRightMousePos = { x: 400, y: 300 };

        // 七大職業清單
        this.heroList = ['paladin', 'sorceress', 'necromancer', 'barbarian', 'druid', 'amazon', 'assassin'];

        // HUD 節點
        this.hudHero = null;
        this.hudState = null;
        this.hudDir = null;
        this.hudDeg = null;
        this.hudTick = null;
        this.hudPos = null;
        this.hudFps = null;

        this.initUI();
        this.initEvents();
    }

    initUI() {
        this.canvas = document.getElementById('dungeon-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        // 綁定 HUD 元素
        this.hudHero = document.getElementById('hud-hero');
        this.hudState = document.getElementById('hud-state');
        this.hudDir = document.getElementById('hud-dir');
        this.hudDeg = document.getElementById('hud-deg');
        this.hudMode = document.getElementById('hud-mode');
        this.hudAura = document.getElementById('hud-aura');
        this.hudMute = document.getElementById('hud-mute');
        this.hudTick = document.getElementById('hud-tick');
        this.hudPos = document.getElementById('hud-pos');
        this.hudFps = document.getElementById('hud-fps');
        this.hudScene = document.getElementById('hud-scene');
        this.hudHp = document.getElementById('hud-hp');
        this.hudArmor = document.getElementById('hud-armor');
        this.hudBuild = document.getElementById('hud-build');
        this.hudCastSkill = document.getElementById('hud-cast-skill');

        this.heroHp = 100;
        this.heroMaxHp = 100;
        this.hurtFlashAlpha = 0;

        // 初始化角色控制器與累加器
        this.updateHud = this.updateHUD;
        this.character = new CharacterController('assets/characters/paladin/manifest.json', () => {
            console.log("Diablo II Sandbox character ready:", this.character.heroId);
            this.updateHUD();
        });

        // 初始化戰鬥導演 (Phase 3 Combat Director)
        if (window.CombatDirector) {
            this.combatDirector = new CombatDirector(this);
            window.d2CombatDirector = this.combatDirector;
            console.log("Diablo II Combat Director online.");
        }

        this.accumulator = new FixedTimestepAccumulator(25, 
            (stepMs, tickCount) => this.onFixedTick(stepMs, tickCount),
            (alpha) => this.onRender(alpha)
        );
    }

    cycleHero() {
        if (!this.character) return;
        const curIdx = this.heroList.indexOf(this.character.heroId);
        const nextHero = this.heroList[(curIdx + 1) % this.heroList.length];
        this.switchHero(nextHero);
    }

    switchHero(heroId) {
        if (!this.character) return Promise.resolve();
        return this.character.loadHero(heroId).then(() => {
            if (this.combatDirector && this.combatDirector.spawnCompanionsForHero) {
                this.combatDirector.spawnCompanionsForHero(heroId);
            }
            this.updateHUD();
        });
    }

    setHero(heroId) {
        return this.switchHero(heroId);
    }

    async cycleArmor() {
        if (!this.character) return;
        await this.character.cycleArmorTier();
        this.updateHUD();
    }

    initEvents() {
        // 底部動作按鈕點擊綁定
        const bindBtn = (id, fn) => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); fn(); });
        };
        bindBtn('act-btn-cycle-hero', () => this.cycleHero());
        bindBtn('act-btn-cycle-build', () => this.cycleBuild());
        bindBtn('act-btn-cycle-cast-skill', () => {
            if (this.character && this.character.cycleCastSkill) {
                this.character.cycleCastSkill(1);
                this.updateHUD();
            }
        });
        bindBtn('act-btn-cycle-attack-skill', () => {
            if (this.character && this.character.cycleAttackSkill) {
                this.character.cycleAttackSkill(1);
                this.updateHUD();
            }
        });
        bindBtn('act-btn-cycle-armor', () => this.cycleArmor());
        bindBtn('act-btn-idle', () => this.character.setState('idle'));
        bindBtn('act-btn-walk', () => { this.character.setRunMode(false); this.character.setState('walk'); });
        bindBtn('act-btn-run', () => { this.character.setRunMode(true); this.character.setState('run'); });
        bindBtn('act-btn-attack', () => {
            this.character.triggerAttack();
        });
        bindBtn('act-btn-cast', () => this.character.triggerCast());
        bindBtn('act-btn-spawn-mob', () => { if (this.combatDirector) this.combatDirector.spawnMobWave(null, 3); });
        bindBtn('act-btn-spawn-boss', () => {
            if (this.combatDirector) {
                const sc = this.getCurrentScene();
                this.combatDirector.spawnBoss(sc ? sc.boss : 'andariel');
            }
        });
        bindBtn('act-btn-cycle-scene', () => this.cycleScene());
        bindBtn('btn-back-campfire', () => this.exitSandbox());

        // 鍵盤事件
        window.addEventListener('keydown', (e) => {
            if (!this.isActive) return;
            this.keys[e.code] = true;

            // H 鍵切換出征職業 (Cycle Hero Class)
            if (e.code === 'KeyH') {
                e.preventDefault();
                this.cycleHero();
            }

            // V 鍵切換技能體系 (Cycle Skill Build)
            if (e.code === 'KeyV') {
                e.preventDefault();
                this.cycleBuild();
            }

            // E 鍵循環切換右鍵招式 (Cycle Cast Skill)
            if (e.code === 'KeyE') {
                e.preventDefault();
                if (this.character && this.character.cycleCastSkill) {
                    this.character.cycleCastSkill(1);
                    this.updateHUD();
                }
            }

            // Z 鍵循環切換左鍵打擊招式 (Cycle Attack Skill)
            if (e.code === 'KeyZ') {
                e.preventDefault();
                if (this.character && this.character.cycleAttackSkill) {
                    this.character.cycleAttackSkill(1);
                    this.updateHUD();
                }
            }

            // T 鍵切換裝甲形態 (Light -> Medium -> Heavy)
            if (e.code === 'KeyT') {
                e.preventDefault();
                this.cycleArmor();
            }

            // Shift 鍵或 R 鍵切換走跑模式 (Toggle Mode 開關切換)
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyR') {
                e.preventDefault();
                this.character.toggleRunMode();
            }

            // Q 鍵切換常駐正統靈氣外觀 (狂熱 / 專注力量 / 聖火 / 聖衝 / 反抗 / 庇護所 / 無)
            if (e.code === 'KeyQ') {
                this.character.cycleAura();
            }

            // 魔法使 (Sorceress) 數字鍵 1~6 直接切換系內技能
            const isSorceress = this.character && (this.character.heroId || '').toLowerCase() === 'sorceress';
            const digitMatch = e.code.match(/^Digit([1-6])$/);
            if (isSorceress && digitMatch) {
                e.preventDefault();
                const num = parseInt(digitMatch[1], 10);
                if (this.character.selectCastSkillByIndex) {
                    this.character.selectCastSkillByIndex(num - 1);
                }
                return;
            }

            // 聖騎士 (Paladin) 數字鍵 1~7 快捷裝備招式至右鍵施法槽
            // (1:重擊, 2:衝鋒, 3:神聖之盾, 4:祝聖之槌, 5:天堂之拳, 6:聖光彈, 7:熱誠五連斬)
            const isPaladin = this.character && (this.character.heroId || '').toLowerCase() === 'paladin';
            const paladinDigitMatch = e.code.match(/^Digit([1-7])$/);
            if (isPaladin && paladinDigitMatch) {
                e.preventDefault();
                const num = parseInt(paladinDigitMatch[1], 10);
                if (this.character.selectCastSkillByIndex) {
                    this.character.selectCastSkillByIndex(num - 1);
                }
                return;
            }

            // 數字鍵快捷動作測試 (非魔法使職業)
            if (e.code === 'Digit1') this.character.setState('idle');
            if (e.code === 'Digit2') {
                this.character.setRunMode(false);
                this.character.setState('walk');
            }
            if (e.code === 'Digit3') {
                this.character.setRunMode(true);
                this.character.setState('run');
            }
            if (e.code === 'Digit4') {
                this.character.triggerAttack();
                if (this.combatDirector) {
                    this.combatDirector.onHeroMeleeAttack(this.character.x, this.character.y, this.character.currentDir);
                }
            }
            if (e.code === 'Digit5') this.character.triggerCast();

            // G 鍵召喚當前章節怪群，B 鍵召喚當前章節 Boss
            if ((e.code === 'KeyG' || (e.key && e.key.toLowerCase() === 'g')) && this.combatDirector) {
                this.combatDirector.spawnMobWave(null, 3);
            }
            if ((e.code === 'KeyB' || (e.key && e.key.toLowerCase() === 'b')) && this.combatDirector) {
                const sc = this.getCurrentScene();
                this.combatDirector.spawnBoss(sc ? sc.boss : 'andariel');
            }

            // C 鍵切換地牢場景 (地下墓穴 / 修道院兵營 / 邪惡洞窟 / 崔斯特姆)
            if (e.code === 'KeyC') {
                this.cycleScene();
            }

            // X 鍵切換死靈法師魔像形態 (黏土石魔 -> 鋼鐵魔像 -> 火焰魔像)
            if (e.code === 'KeyX' && this.combatDirector) {
                e.preventDefault();
                this.combatDirector.switchGolem();
            }

            if (e.code === 'Escape') this.exitSandbox();
        });

        window.addEventListener('keyup', (e) => {
            if (!this.isActive) return;
            this.keys[e.code] = false;
        });

        // 畫布滑鼠事件
        this.canvas.addEventListener('mousedown', (e) => {
            if (!this.isActive) return;
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const screenX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            const screenY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
            const mx = screenX + this.cameraX;
            const my = screenY + this.cameraY;
            this.lastMousePos = { x: mx, y: my };
            this.isMouseDown = true;

            if (e.button === 0) {
                // 左鍵：
                this.isLeftMouseDown = true;
                // 1. 檢測是否直接點擊怪物 (Click-to-Attack 點擊怪物直接攻擊 / 長按連續攻擊)
                const clickedMonster = this.combatDirector ? this.combatDirector.findMonsterAt(mx, my) : null;
                if (clickedMonster) {
                    this.attackTargetMonster = clickedMonster;
                    const dist = Math.hypot(clickedMonster.x - this.character.x, (clickedMonster.y - this.character.y) * 2);
                    if (dist <= 85) {
                        // 已經在近戰攻擊射程：立即轉身揮擊攻擊該怪物！
                        this.character.targetX = null;
                        this.character.targetY = null;
                        this.character.triggerAttack(clickedMonster.x, clickedMonster.y);
                    } else {
                        // 距離較遠：自動跑步走過去，靠近後再用近戰技能打怪物！
                        const atkSkill = this.character.getActiveAttackSkill();
                        this.character.startMeleeAutoApproach(clickedMonster.x, clickedMonster.y, atkSkill ? atkSkill.id : 'smite', clickedMonster);
                    }
                } else if (e.shiftKey) {
                    // Shift + 點擊 ➔ 就地揮劍攻擊
                    this.attackTargetMonster = null;
                    this.character.cancelMeleeAutoApproach();
                    this.character.triggerAttack(mx, my);
                } else {
                    // 普通點擊地面 ➔ 依循走跑模式移動
                    this.attackTargetMonster = null;
                    this.character.cancelMeleeAutoApproach();
                    this.character.moveTo(mx, my, this.character.isRunMode);
                }
            } else if (e.button === 2) {
                // 右鍵：長按連續施法 (若選取近戰技能且超出近戰射程，自動跑步走過去再打)
                this.isRightMouseDown = true;
                this.lastRightMousePos = { x: mx, y: my };
                this.attackTargetMonster = null;
                const rightSkill = this.character.getActiveCastSkill();
                const clickedMonster = this.combatDirector ? this.combatDirector.findMonsterAt(mx, my) : null;
                if (rightSkill && this.character.isMeleeSkill(rightSkill.id)) {
                    const dist = Math.hypot(mx - this.character.x, (my - this.character.y) * 2);
                    if (dist > 85) {
                        this.character.startMeleeAutoApproach(mx, my, rightSkill.id, clickedMonster);
                    } else {
                        this.character.triggerCast(mx, my);
                    }
                } else {
                    this.character.triggerCast(mx, my);
                }
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isActive) return;
            const rect = this.canvas.getBoundingClientRect();
            const screenX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            const screenY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
            const mx = screenX + this.cameraX;
            const my = screenY + this.cameraY;
            this.lastMousePos = { x: mx, y: my };

            if (this.isRightMouseDown) {
                this.lastRightMousePos = { x: mx, y: my };
                if (this.character && this.character.isChanneling) {
                    this.character.updateChannelTarget(mx, my);
                }
            }

            // 實時檢測怪物懸停 (Hover)：切換戰鬥準心游標並高亮該怪物
            if (this.combatDirector) {
                const hoverM = this.combatDirector.findMonsterAt(mx, my);
                this.combatDirector.setHoveredMonster(hoverM);
                this.canvas.style.cursor = hoverM ? 'crosshair' : 'default';
                // 若正在按住左鍵滑動，自動鎖定滑鼠指向的新怪物
                if (this.isLeftMouseDown && hoverM && (!this.attackTargetMonster || this.attackTargetMonster.isDead)) {
                    this.attackTargetMonster = hoverM;
                }
            }

            // 若滑鼠左鍵按住拖動且非鎖定怪物，且未在長按右鍵施法，持續更新移動目標點
            if (this.isLeftMouseDown && !this.isRightMouseDown && !this.attackTargetMonster && (this.character.state !== 'attack' && this.character.state !== 'cast')) {
                this.character.moveTo(mx, my, this.character.isRunMode);
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.isLeftMouseDown = false;
            } else if (e.button === 2) {
                this.isRightMouseDown = false;
                if (this.character && this.character.stopChanneling) {
                    this.character.stopChanneling();
                }
            } else {
                this.isLeftMouseDown = false;
                this.isRightMouseDown = false;
                if (this.character && this.character.stopChanneling) {
                    this.character.stopChanneling();
                }
            }
            this.isMouseDown = this.isLeftMouseDown || this.isRightMouseDown;

            // 釋放左鍵時若不在攻擊動畫中，清除鎖定目標
            if (!this.isLeftMouseDown && this.character && this.character.state !== 'attack' && this.character.state !== 'cast') {
                this.attackTargetMonster = null;
            }
        });

        window.addEventListener('blur', () => {
            this.isLeftMouseDown = false;
            this.isRightMouseDown = false;
            this.isMouseDown = false;
            this.attackTargetMonster = null;
            if (this.character && this.character.stopChanneling) {
                this.character.stopChanneling();
            }
        });

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    triggerNavMarker(x, y) {
        this.navMarker = {
            x: x,
            y: y,
            radius: 16,
            alpha: 1.0,
            type: 'move'
        };
    }

    triggerAttackMarker(x, y) {
        this.navMarker = {
            x: x,
            y: y,
            radius: 24,
            alpha: 1.0,
            type: 'attack'
        };
    }

    start(heroId = null) {
        this.isActive = true;
        if (this.container) this.container.style.display = 'block';
        const sc = this.getCurrentScene();
        if (this.character) {
            // 初次進場將主角座標置中於該幕中心城鎮出生點
            if (this.character.x === 512 && this.character.y === 400) {
                this.character.x = sc.spawnX;
                this.character.y = sc.spawnY;
                this.character.prevX = sc.spawnX;
                this.character.prevY = sc.spawnY;
            }
            if (this.canvas) {
                this.cameraX = Math.max(0, Math.min(sc.width - this.canvas.width, this.character.x - this.canvas.width / 2));
                this.cameraY = Math.max(0, Math.min(sc.height - this.canvas.height, this.character.y - this.canvas.height / 2));
            }
        }
        if (this.combatDirector && this.combatDirector.activeBoss && !this.combatDirector.activeBoss.isDead) {
            const b = this.combatDirector.activeBoss;
            const title = (b.manifest && (b.manifest.title || b.manifest.name)) || "BOSS";
            this.combatDirector.showBossBar(title, b);
        }
        if (this.combatDirector && this.combatDirector.monsters.length === 0) {
            this.combatDirector.spawnMobWave(null, 3);
        }
        if (this.accumulator) this.accumulator.start();
        this.updateHUD();

        if (heroId && this.character) {
            return this.character.loadHero(heroId).then(() => {
                if (this.combatDirector && this.combatDirector.spawnCompanionsForHero) {
                    this.combatDirector.spawnCompanionsForHero(heroId);
                }
                this.updateHUD();
            });
        }
        return Promise.resolve();
    }

    stop() {
        this.isActive = false;
        this.attackTargetMonster = null;
        if (this.container) this.container.style.display = 'none';
        if (this.accumulator) this.accumulator.stop();
        if (this.combatDirector) {
            this.combatDirector.hideBossBar();
        }
    }

    exitSandbox() {
        this.stop();
        if (this.combatDirector) {
            this.combatDirector.hideBossBar();
        }
        // 觸發外部營火大廳切換
        if (window.onExitSandbox) {
            window.onExitSandbox();
        }
    }

    triggerHeroDamage(amount) {
        this.heroMaxHp = 100;
        this.heroHp = Math.max(0, (this.heroHp !== undefined ? this.heroHp : 100) - amount);
        if (this.combatDirector && this.combatDirector.addDamageNumber && this.character) {
            this.combatDirector.addDamageNumber(this.character.x + (Math.random() - 0.5) * 12, this.character.y - 65, Math.round(amount), true);
        }
        if (!window.__D2_DISABLE_AUDIO__ && window.d2Audio && !window.d2Audio.isMuted) {
            try {
                const hAudio = new Audio('assets/sfx/kick.wav');
                hAudio.volume = 0.4;
                hAudio.play().catch(() => {});
            } catch (e) {}
        }
        if (this.heroHp <= 0) {
            this.heroHp = 100;
        }
        this.updateHUD();
    }

    getCurrentScene() {
        return this.scenes[this.currentSceneIdx] || this.scenes[0];
    }

    cycleScene() {
        this.currentSceneIdx = (this.currentSceneIdx + 1) % this.scenes.length;
        const sc = this.scenes[this.currentSceneIdx];
        this.bgImage.src = sc.file;
        if (this.hudScene) {
            this.hudScene.textContent = `${sc.name} [C]`;
        }
        this.attackTargetMonster = null;

        // 重設主角出現在該幕中心出生點
        if (this.character) {
            this.character.x = sc.spawnX;
            this.character.y = sc.spawnY;
            this.character.prevX = sc.spawnX;
            this.character.prevY = sc.spawnY;
            this.character.targetX = null;
            this.character.targetY = null;
            this.character.setState('idle');
        }

        // 立即對準相機至出生點
        if (this.canvas) {
            this.cameraX = Math.max(0, Math.min(sc.width - this.canvas.width, sc.spawnX - this.canvas.width / 2));
            this.cameraY = Math.max(0, Math.min(sc.height - this.canvas.height, sc.spawnY - this.canvas.height / 2));
        }

        if (this.combatDirector) {
            this.combatDirector.clearAllMonsters();
            this.combatDirector.spawnMobWave(null, 3);
            if (this.combatDirector.companions) {
                this.combatDirector.companions.forEach((comp, idx) => {
                    comp.x = sc.spawnX + (idx % 2 === 0 ? 40 : -40);
                    comp.y = sc.spawnY + 30;
                });
            }
        }
        console.log("[DungeonSandbox] Switched scene to:", sc.name);
    }

    /**
     * 25Hz 固定邏輯步進 (物理移動、鍵盤向量、狀態機更新)
     */
    onFixedTick(stepMs, tickCount) {
        if (!this.character) return;

        // 處理鍵盤 WASD 移動
        this.character.handleKeyboardInput(this.keys);

        // 推進角色物理與動畫幀
        this.character.fixedTick(stepMs, tickCount);

        // 限制主角在世界地圖內並更新相機平滑跟隨
        const sc = this.getCurrentScene();
        const mapW = (this.bgImage.complete && this.bgImage.naturalWidth) || sc.width;
        const mapH = (this.bgImage.complete && this.bgImage.naturalHeight) || sc.height;

        this.character.x = Math.max(60, Math.min(mapW - 60, this.character.x));
        this.character.y = Math.max(60, Math.min(mapH - 60, this.character.y));

        if (this.canvas) {
            const targetCamX = Math.max(0, Math.min(mapW - this.canvas.width, this.character.x - this.canvas.width / 2));
            const targetCamY = Math.max(0, Math.min(mapH - this.canvas.height, this.character.y - this.canvas.height / 2));
            this.cameraX += (targetCamX - this.cameraX) * 0.18;
            this.cameraY += (targetCamY - this.cameraY) * 0.18;
        }

        // 推進戰鬥導演中樞 (Phase 3: 怪物 AI、彈道投射物與事件平滑)
        if (this.combatDirector) {
            this.combatDirector.update(stepMs);
        }

        // 鎖定怪物追擊與連續揮砍攻擊邏輯 (Continuous Click-to-Attack)
        if (this.attackTargetMonster) {
            if (this.attackTargetMonster.isDead || this.attackTargetMonster.remove) {
                this.attackTargetMonster = null;
            } else if (this.isLeftMouseDown) {
                const dist = Math.hypot(this.attackTargetMonster.x - this.character.x, (this.attackTargetMonster.y - this.character.y) * 2);
                if (dist <= 85) {
                    // 已抵達近戰射程：若角色不在攻擊硬直中 (已收招回 idle/walk/run)，立即發動下一輪攻擊！
                    if (this.character.state !== 'attack' && this.character.state !== 'cast') {
                        this.character.targetX = null;
                        this.character.targetY = null;
                        this.character.triggerAttack(this.attackTargetMonster.x, this.attackTargetMonster.y);
                    }
                } else if (this.character.state !== 'attack' && this.character.state !== 'cast') {
                    // 尚未進入近戰射程，持續朝怪物奔跑逼近
                    this.character.moveTo(this.attackTargetMonster.x, this.attackTargetMonster.y, true);
                }
            } else {
                // 滑鼠放開後，一旦攻擊收招完成即清除目標
                if (this.character.state !== 'attack' && this.character.state !== 'cast') {
                    this.attackTargetMonster = null;
                }
            }
        }

        // 滑鼠右鍵長按連續施法 (Hold Right Click to Continuous Cast)
        // 針對地獄火等引導技能，按住期間持續導引與校準方位；一般法術則在完成收招後連續施展
        if (this.isRightMouseDown) {
            const rightSkill = this.character.getActiveCastSkill();
            if (this.character.isChanneledSkill && this.character.isChanneledSkill(this.character.currentSkillType)) {
                if (!this.character.isChanneling && this.character.state !== 'cast' && this.character.state !== 'attack') {
                    this.character.triggerCast(this.lastRightMousePos.x, this.lastRightMousePos.y);
                } else if (this.character.isChanneling) {
                    this.character.updateChannelTarget(this.lastRightMousePos.x, this.lastRightMousePos.y);
                }
            } else if (rightSkill && this.character.isMeleeSkill(rightSkill.id)) {
                const dist = Math.hypot(this.lastRightMousePos.x - this.character.x, (this.lastRightMousePos.y - this.character.y) * 2);
                if (dist > 85) {
                    const clickedM = this.combatDirector ? this.combatDirector.findMonsterAt(this.lastRightMousePos.x, this.lastRightMousePos.y) : null;
                    if (!this.character.isAutoApproaching && this.character.state !== 'attack' && this.character.state !== 'cast') {
                        this.character.startMeleeAutoApproach(this.lastRightMousePos.x, this.lastRightMousePos.y, rightSkill.id, clickedM);
                    }
                } else if (this.character.state !== 'cast' && this.character.state !== 'attack') {
                    this.character.triggerCast(this.lastRightMousePos.x, this.lastRightMousePos.y);
                }
            } else {
                if (this.character.state !== 'cast' && this.character.state !== 'attack') {
                    this.character.triggerCast(this.lastRightMousePos.x, this.lastRightMousePos.y);
                }
            }
        }

    }

    /**
     * 畫面渲染 (在瀏覽器原生幀率下執行，支援 alpha 平滑插值)
     */
    onRender(alpha) {
        if (!this.ctx || !this.character) return;
        const ctx = this.ctx;

        const sc = this.getCurrentScene();
        const mapW = (this.bgImage.complete && this.bgImage.naturalWidth) || sc.width;
        const mapH = (this.bgImage.complete && this.bgImage.naturalHeight) || sc.height;

        ctx.save();
        const camX = Math.round(this.cameraX);
        const camY = Math.round(this.cameraY);
        ctx.translate(-camX, -camY);

        // 1. 繪製大地圖背景
        if (this.bgImage && this.bgImage.complete && this.bgImage.naturalWidth > 0) {
            ctx.drawImage(this.bgImage, 0, 0, mapW, mapH);
        } else {
            ctx.fillStyle = '#121216';
            ctx.fillRect(0, 0, mapW, mapH);
        }

        // 2. 2.5D 等軸測分層深度排序渲染 (Strict 3-Tier Layering)
        // 嚴格規範：玩家角色 (Hero) 與召喚夥伴 (Companions) 永遠位於最上層 (Tier 2)
        // 死亡怪物遺骸與死亡動畫沉在最底層 (Tier 0)，存活怪物位於中層 (Tier 1)
        const renderList = [];
        if (this.combatDirector) {
            for (const m of this.combatDirector.monsters) {
                const isDead = m.isDead || m.state === 'death';
                renderList.push({
                    type: 'monster',
                    layerTier: isDead ? 0 : 1,
                    y: m.y,
                    entity: m
                });
            }
            if (this.combatDirector.companions) {
                for (const comp of this.combatDirector.companions) {
                    renderList.push({
                        type: 'companion',
                        layerTier: 2,
                        y: comp.y,
                        entity: comp
                    });
                }
            }
        }
        if (this.character) {
            renderList.push({
                type: 'hero',
                layerTier: 2,
                y: this.character.y,
                entity: this.character
            });
        }

        renderList.sort((a, b) => {
            if (a.layerTier !== b.layerTier) {
                return a.layerTier - b.layerTier;
            }
            return a.y - b.y;
        });

        for (const item of renderList) {
            if (item.type === 'monster' || item.type === 'companion') {
                item.entity.render(ctx);
            } else {
                item.entity.render(ctx, alpha);
            }
        }

        // 3. 繪製戰鬥技能投射物與命中光芒 (頂層加法發光特效)
        if (this.combatDirector) {
            this.combatDirector.renderEffects(ctx, alpha);
        }

        ctx.restore();

        // 4. 更新實時 HUD 數據
        this.updateHUD();
    }

    updateHUD() {
        if (!this.character) return;

        const dir = (typeof this.character.currentDir === 'number' && !isNaN(this.character.currentDir)) ? this.character.currentDir : 0;
        const dirName = (this.character.directionController && typeof this.character.directionController.getDirectionName === 'function')
            ? this.character.directionController.getDirectionName(dir)
            : 'S';
        const centerDeg = (this.character.directionController && this.character.directionController.DIR_CENTER_DEGREES && typeof this.character.directionController.DIR_CENTER_DEGREES[dir] === 'number')
            ? this.character.directionController.DIR_CENTER_DEGREES[dir]
            : 0;

        if (this.hudHero) {
            const heroConfig = (this.character.heroSkills && this.character.heroSkills[this.character.heroId]) || null;
            const heroTitle = heroConfig ? heroConfig.title : this.character.heroId.toUpperCase();
            this.hudHero.textContent = `${heroTitle} [H]`;
        }

        if (this.hudHp) {
            const curHp = Math.ceil(this.heroHp !== undefined ? this.heroHp : 100);
            this.hudHp.textContent = `${curHp} / 100`;
        }

        if (this.hudState) {
            this.hudState.textContent = this.character.getDisplayState ? this.character.getDisplayState() : this.character.state.toUpperCase();
            this.hudState.className = `state-badge badge-${this.character.state}`;
        }
        if (this.hudDir) this.hudDir.textContent = `${dir} (${dirName})`;
        if (this.hudDeg) this.hudDeg.textContent = `${centerDeg.toFixed(1)}° (±5.5° 死區)`;
        if (this.hudTick) this.hudTick.textContent = `25.0 Hz (40ms)`;
        if (this.hudPos) this.hudPos.textContent = `X: ${this.character.x.toFixed(1)}, Y: ${this.character.y.toFixed(1)}`;
        if (this.hudFps && this.accumulator) this.hudFps.textContent = `${this.accumulator.fps} FPS`;

        if (this.hudMode) {
            this.hudMode.textContent = this.character.isRunMode ? 'RUN 奔跑 [Shift/R]' : 'WALK 行走 [Shift/R]';
            this.hudMode.style.color = this.character.isRunMode ? '#ffcc00' : '#88ddff';
        }

        if (this.hudAura) {
            if (this.character.heroId !== 'paladin') {
                this.hudAura.textContent = '法術專家 (零靈氣) [Q]';
                this.hudAura.style.color = '#a78bfa';
            } else {
                this.hudAura.textContent = this.character.getActiveAuraTitle();
                this.hudAura.style.color = '#fbbf24';
            }
        }

        if (this.hudBuild) {
            const hId = (this.character.heroId || 'paladin').toLowerCase();
            if (hId === 'paladin' || hId === 'barbarian') {
                this.hudBuild.textContent = '全能體系 (ALL-ROUND)';
                this.hudBuild.style.color = '#94a3b8';
            } else {
                const bTitle = this.character.getCurrentBuildTitle ? this.character.getCurrentBuildTitle() : '預設體系';
                this.hudBuild.textContent = `${bTitle} [V]`;
                this.hudBuild.style.color = '#f59e0b';
            }
        }

        if (this.hudCastSkill) {
            const curCast = (this.character && this.character.getActiveCastSkill) ? this.character.getActiveCastSkill() : null;
            if (curCast) {
                this.hudCastSkill.textContent = `${curCast.name} [E]`;
            } else {
                this.hudCastSkill.textContent = `無專屬招式 [E]`;
            }
        }

        if (this.hudArmor) {
            const isPaladin = (this.character.heroId === 'paladin');
            const armorMap = {
                'light': '輕裝 (LIGHT) [T]',
                'medium': '中裝 (MEDIUM) [T]',
                'heavy': (isPaladin ? '重裝·紋章盾 (HERALDIC) [T]' : '重裝 (HEAVY) [T]'),
                'heavy_tower': '重裝·塔盾 (TOWER) [T]'
            };
            const currentTier = this.character.armorTier || 'light';
            if (isPaladin && this.character.holyShieldActive) {
                const baseTier = this.character.baseArmorTier || 'light';
                const baseName = armorMap[baseTier] || baseTier.toUpperCase();
                this.hudArmor.textContent = `${baseName} (✨神聖之盾)`;
                this.hudArmor.style.color = '#fbbf24';
            } else {
                this.hudArmor.textContent = armorMap[currentTier] || currentTier.toUpperCase();
                if (currentTier === 'heavy_tower') {
                    this.hudArmor.style.color = '#e11d48';
                } else if (currentTier === 'heavy') {
                    this.hudArmor.style.color = '#f97316';
                } else if (currentTier === 'medium') {
                    this.hudArmor.style.color = '#38bdf8';
                } else {
                    this.hudArmor.style.color = '#4ade80';
                }
            }
        }

        if (this.hudMute && window.d2Audio) {
            this.hudMute.textContent = window.d2Audio.isMuted ? '🔇 全域靜音 [M]' : '🔊 音效已開啟 [M]';
            this.hudMute.style.color = window.d2Audio.isMuted ? '#ff5555' : '#55ff55';
        }

        // 高亮底部走跑動作按鈕
        const btnWalk = document.getElementById('act-btn-walk');
        const btnRun = document.getElementById('act-btn-run');
        if (btnWalk && btnRun) {
            if (this.character.isRunMode) {
                btnRun.classList.add('active-action-btn');
                btnWalk.classList.remove('active-action-btn');
            } else {
                btnWalk.classList.add('active-action-btn');
                btnRun.classList.remove('active-action-btn');
            }
        }
    }

    cycleBuild() {
        if (this.character && this.character.cycleBuild) {
            this.character.cycleBuild();
            this.updateHUD();
        }
    }
}

window.DungeonSandbox = DungeonSandbox;

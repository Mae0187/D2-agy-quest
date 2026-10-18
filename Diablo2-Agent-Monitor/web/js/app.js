document.addEventListener("DOMContentLoaded", () => {
    
    // --- 1. 營火動畫 (Campfire Animation - 嚴格固定在原地，不受選角干擾) ---
    const fireFrames = 30;
    let currentFireFrame = 0;
    const campfireFlameEl = document.getElementById("campfire-flame");

    function animateFire() {
        if (window.__D2_STANDALONE__ || (window.dungeonSandbox && window.dungeonSandbox.isActive)) return;
        if (campfireFlameEl) {
            campfireFlameEl.style.backgroundImage = `url('assets/fire/fire_d0_f${currentFireFrame}.png')`;
            currentFireFrame = (currentFireFrame + 1) % fireFrames;
        }
    }
    setInterval(animateFire, 85);

    // --- 2. 七大職業資料定義 (包含邁步前進 FW、倒退回位 BW、營火待命 NU1、選中姿態 NU3，官方原版選角音效) ---
    const heroesData = {
        'amazon': {
            name: 'AMAZON',
            desc: 'Skilled with the spear and the bow, she is a very versatile fighter.',
            idlePrefix: 'AMNU1',
            idleFrames: 26,
            fwPrefix: 'AMFW',
            fwFrames: 54,
            bwPrefix: 'AMBW',
            bwFrames: 30,
            nu3Prefix: 'amnu3',
            nu3Frames: 18,
            selectSfx: 'assets/sfx/intro/amazon select.wav',
            deselectSfx: 'assets/sfx/intro/amazon deselect.wav'
        },
        'assassin': {
            name: 'ASSASSIN',
            desc: 'Schooled in the martial arts, her mind and body are deadly weapons.',
            idlePrefix: 'ASNU1',
            idleFrames: 31,
            fwPrefix: 'ASFW',
            fwFrames: 91,
            bwPrefix: 'ASBW',
            bwFrames: 51,
            nu3Prefix: 'ASNU3',
            nu3Frames: 31,
            selectSfx: 'assets/sfx/intro/assassin select.wav',
            deselectSfx: 'assets/sfx/intro/assassin deselect.wav'
        },
        'barbarian': {
            name: 'BARBARIAN',
            desc: 'He is unequaled in close-quarters combat and master of weapons.',
            idlePrefix: 'banu1',
            idleFrames: 16,
            fwPrefix: 'bafw',
            fwFrames: 64,
            bwPrefix: 'babw',
            bwFrames: 19,
            nu3Prefix: 'banu3',
            nu3Frames: 26,
            selectSfx: 'assets/sfx/intro/barbarian select.wav',
            deselectSfx: 'assets/sfx/intro/barbarian deselect.wav'
        },
        'druid': {
            name: 'DRUID',
            desc: 'Commanding the forces of nature, he summons wild beasts and raging storms.',
            idlePrefix: 'DZNU1',
            idleFrames: 21,
            fwPrefix: 'DZFW',
            fwFrames: 121,
            bwPrefix: 'DZBW',
            bwFrames: 40,
            nu3Prefix: 'DZNU3',
            nu3Frames: 21,
            selectSfx: 'assets/sfx/intro/druid select.wav',
            deselectSfx: 'assets/sfx/intro/druid deselect.wav'
        },
        'necromancer': {
            name: 'NECROMANCER',
            desc: 'Summoning undead minions and hurling curses, he is the master of death.',
            idlePrefix: 'NENU1',
            idleFrames: 12,
            fwPrefix: 'NEFW',
            fwFrames: 38,
            bwPrefix: 'NEBW',
            bwFrames: 28,
            nu3Prefix: 'nenu3',
            nu3Frames: 12,
            selectSfx: 'assets/sfx/intro/necromancer select.wav',
            deselectSfx: 'assets/sfx/intro/necromancer deselect.wav'
        },
        'paladin': {
            name: 'PALADIN',
            desc: 'A holy warrior, comfortable in the heat of battle and blessed with sacred auras.',
            idlePrefix: 'PANU1',
            idleFrames: 26,
            fwPrefix: 'PAFW',
            fwFrames: 80,
            bwPrefix: 'PABW',
            bwFrames: 40,
            nu3Prefix: 'panu3',
            nu3Frames: 9,
            selectSfx: 'assets/sfx/intro/paladin select.wav',
            deselectSfx: 'assets/sfx/intro/paladin deselect.wav'
        },
        'sorceress': {
            name: 'SORCERESS',
            desc: 'A master of the primal elements, her spells rain fiery and icy destruction.',
            idlePrefix: 'SONU1',
            idleFrames: 32,
            fwPrefix: 'SOFW',
            fwFrames: 52,
            bwPrefix: 'SOBW',
            bwFrames: 30,
            nu3Prefix: 'SONU3',
            nu3Frames: 12,
            selectSfx: 'assets/sfx/intro/sorceress select.wav',
            deselectSfx: 'assets/sfx/intro/sorceress deselect.wav'
        }
    };

    // --- 3. 核心防閃爍機制：全幀記憶體快取預載入 (Image Preloader) ---
    const imageCache = {};
    const lightningFramesCount = 17;
    const auraFramesCount = 30;

    function preloadAllHeroFrames() {
        Object.keys(heroesData).forEach(id => {
            const data = heroesData[id];
            imageCache[id] = { idle: [], fw: [], bw: [], nu3: [] };

            // 預載待命幀 (NU1)
            for (let i = 0; i < data.idleFrames; i++) {
                const img = new Image();
                img.src = `assets/${id}/${data.idlePrefix}_d0_f${i}.png`;
                imageCache[id].idle.push(img);
            }

            // 預載出征邁步幀 (FW)
            for (let i = 0; i < data.fwFrames; i++) {
                const img = new Image();
                img.src = `assets/${id}/${data.fwPrefix}_d0_f${i}.png`;
                imageCache[id].fw.push(img);
            }

            // 預載倒退回位幀 (BW)
            for (let i = 0; i < data.bwFrames; i++) {
                const img = new Image();
                img.src = `assets/${id}/${data.bwPrefix}_d0_f${i}.png`;
                imageCache[id].bw.push(img);
            }

            // 預載選中待命循環幀 (NU3)
            for (let i = 0; i < data.nu3Frames; i++) {
                const img = new Image();
                img.src = `assets/${id}/${data.nu3Prefix}_d0_f${i}.png`;
                imageCache[id].nu3.push(img);
            }
        });

        // 預載營火幀
        for (let i = 0; i < fireFrames; i++) {
            const img = new Image();
            img.src = `assets/fire/fire_d0_f${i}.png`;
        }

        // 預載法師閃電特效幀
        for (let i = 0; i < lightningFramesCount; i++) {
            const img = new Image();
            img.src = `assets/fx/lightning/lightning_f${i}.png`;
        }

        // 預載聖騎士神聖光環幀
        for (let i = 0; i < auraFramesCount; i++) {
            const img = new Image();
            img.src = `assets/fx/aura/aura_f${i}.png`;
        }
    }

    if (!window.__D2_STANDALONE__) {
        preloadAllHeroFrames();
    }

    // --- 4. 技能動態特效引擎 (FX Animation Loop) ---
    let currentLightningFrame = 0;
    const sorceressLightningEl = document.getElementById("sorceress-lightning");
    function tickLightningFX() {
        if (window.__D2_STANDALONE__ || (window.dungeonSandbox && window.dungeonSandbox.isActive)) return;
        if (sorceressLightningEl && sorceressLightningEl.style.display !== 'none') {
            sorceressLightningEl.style.backgroundImage = `url('assets/fx/lightning/lightning_f${currentLightningFrame}.png')`;
            currentLightningFrame = (currentLightningFrame + 1) % lightningFramesCount;
        }
    }
    setInterval(tickLightningFX, 60); // 高頻電弧跳動

    let currentAuraFrame = 0;
    const paladinAuraEl = document.getElementById("paladin-aura");
    function tickAuraFX() {
        if (window.__D2_STANDALONE__ || (window.dungeonSandbox && window.dungeonSandbox.isActive)) return;
        if (paladinAuraEl && paladinAuraEl.style.display !== 'none') {
            paladinAuraEl.style.backgroundImage = `url('assets/fx/aura/aura_f${currentAuraFrame}.png')`;
            currentAuraFrame = (currentAuraFrame + 1) % auraFramesCount;
        }
    }
    setInterval(tickAuraFX, 75); // 神聖靈氣金環旋轉

    // 音效播放輔助 (串接全域音效與靜音管理器)
    function playHeroSFX(sfxPath) {
        if (!sfxPath || window.__D2_DISABLE_AUDIO__ || (window.d2Audio && window.d2Audio.isMuted)) return;
        if (window.d2Audio) {
            window.d2Audio.playFile(sfxPath, 0.55);
        }
    }

    // 執行時期狀態
    const heroRuntime = {};
    let selectedHeroId = null;

    // UI 節點
    const screenTitle = document.getElementById('screen-title');
    const heroInfo = document.getElementById('hero-info');
    const heroClassName = document.getElementById('hero-class-name');
    const heroDescription = document.getElementById('hero-description');
    const nameText = document.getElementById('name-text');

    // 初始化角色槽位
    Object.keys(heroesData).forEach(id => {
        heroRuntime[id] = {
            mode: 'idle',
            currentFrame: Math.floor(Math.random() * 5)
        };

        const slot = document.getElementById(`slot-${id}`);
        if (slot) {
            slot.addEventListener('click', () => {
                selectHero(id);
            });
        }
    });

    // 選擇英雄邏輯 (出征邁步 FW ➔ 選中姿態循環 NU3 + 倒退回位 BW)
    function selectHero(id) {
        if (selectedHeroId === id) {
            // 已選中狀態下再次點擊英雄，直接進入遊戲！
            const btnPlay = document.getElementById('btn-play');
            if (btnPlay) btnPlay.click();
            return;
        }

        // 若先前有已選中的英雄，該英雄執行倒退回位 (backward: BW) 動畫
        if (selectedHeroId) {
            const prevId = selectedHeroId;
            const prevSlot = document.getElementById(`slot-${prevId}`);
            if (prevSlot) {
                const fxEls = prevSlot.querySelectorAll('.char-fx');
                fxEls.forEach(el => el.style.display = 'none');
            }
            playHeroSFX(heroesData[prevId].deselectSfx);
            heroRuntime[prevId].mode = 'backward';
            heroRuntime[prevId].currentFrame = 0;
        }

        selectedHeroId = id;
        const currentSlot = document.getElementById(`slot-${id}`);
        if (currentSlot) {
            currentSlot.classList.add('selected');
            // 將選中的英雄槽位移動至容器最頂部 (DOM 末端)，雙重保證永遠位於最頂層防遮擋
            if (currentSlot.parentElement) {
                currentSlot.parentElement.appendChild(currentSlot);
            }
        }

        heroRuntime[id].mode = 'forward';
        heroRuntime[id].currentFrame = 0;

        // 更新角色名字
        const data = heroesData[id];
        if (nameText) nameText.textContent = data.name;

        // 播放原版官方英雄選中音效
        playHeroSFX(data.selectSfx);
    }

    // 暴露至全域以支援外部快捷控制
    window.selectHero = selectHero;

    // 主動畫計時器 (原版暗黑2標準 25 FPS = 40ms 刷新，保證步伐俐落且動作平滑流暢)
    function tickAnimation() {
        if (window.__D2_STANDALONE__ || (window.dungeonSandbox && window.dungeonSandbox.isActive)) return;
        Object.keys(heroesData).forEach(id => {
            const data = heroesData[id];
            const runtime = heroRuntime[id];
            const slot = document.getElementById(`slot-${id}`);
            if (!slot) return;

            const spriteEl = slot.querySelector('.char-sprite');
            if (!spriteEl) return;

            if (runtime.mode === 'idle') {
                spriteEl.style.backgroundImage = `url('assets/${id}/${data.idlePrefix}_d0_f${runtime.currentFrame}.png')`;
                runtime.currentFrame = (runtime.currentFrame + 1) % data.idleFrames;
            } else if (runtime.mode === 'forward') {
                spriteEl.style.backgroundImage = `url('assets/${id}/${data.fwPrefix}_d0_f${runtime.currentFrame}.png')`;
                runtime.currentFrame++;

                // 邁步結束，平滑切換至 NU3 選中待命姿態循環，並亮起專屬技能特效！
                if (runtime.currentFrame >= data.fwFrames) {
                    runtime.mode = 'nu3';
                    runtime.currentFrame = 0;

                    // 啟用專屬技能特效
                    const fxEls = slot.querySelectorAll('.char-fx');
                    fxEls.forEach(el => el.style.display = 'block');
                }
            } else if (runtime.mode === 'backward') {
                spriteEl.style.backgroundImage = `url('assets/${id}/${data.bwPrefix}_d0_f${runtime.currentFrame}.png')`;
                runtime.currentFrame++;

                // 倒退回位結束，移除 selected 樣式，平滑切換回 idle 營火待命姿態！
                if (runtime.currentFrame >= data.bwFrames) {
                    slot.classList.remove('selected');
                    runtime.mode = 'idle';
                    runtime.currentFrame = 0;
                }
            } else if (runtime.mode === 'nu3') {
                spriteEl.style.backgroundImage = `url('assets/${id}/${data.nu3Prefix}_d0_f${runtime.currentFrame}.png')`;
                runtime.currentFrame = (runtime.currentFrame + 1) % data.nu3Frames;
            }
        });
    }

    setInterval(tickAnimation, 40);

    // 初始狀態：全英雄圍繞營火待命，等待玩家點擊選取


    const dungeonSandbox = new DungeonSandbox('dungeon-container');
    window.dungeonSandbox = dungeonSandbox;

    const btnToggleSandbox = document.getElementById('btn-toggle-sandbox');
    const btnPlay = document.getElementById('btn-play');
    const btnBackCampfire = document.getElementById('btn-back-campfire');
    const btnMuteGlobal = document.getElementById('btn-mute-global');
    const btnToggleMute = document.getElementById('btn-toggle-mute');

    function enterSandbox() {
        const charContainer = document.getElementById('character-container');
        const campfire = document.getElementById('campfire');
        const headerUI = document.getElementById('header-ui');
        const footerUI = document.getElementById('footer-ui');
        if (charContainer) charContainer.style.display = 'none';
        if (campfire) campfire.style.display = 'none';
        if (headerUI) headerUI.style.display = 'none';
        if (footerUI) footerUI.style.display = 'none';
        dungeonSandbox.start(selectedHeroId || 'paladin');
    }

    function exitSandbox() {
        dungeonSandbox.stop();
        const charContainer = document.getElementById('character-container');
        const campfire = document.getElementById('campfire');
        const headerUI = document.getElementById('header-ui');
        const footerUI = document.getElementById('footer-ui');
        const bossBar = document.getElementById('d2-boss-hud-bar');
        if (charContainer) charContainer.style.display = 'block';
        if (campfire) campfire.style.display = 'block';
        if (headerUI) headerUI.style.display = 'block';
        if (footerUI) footerUI.style.display = 'flex';
        if (bossBar) bossBar.style.display = 'none';
    }

    window.onExitSandbox = exitSandbox;

    if (btnToggleSandbox) btnToggleSandbox.addEventListener('click', enterSandbox);
    if (btnPlay) btnPlay.addEventListener('click', enterSandbox);
    if (btnBackCampfire) btnBackCampfire.addEventListener('click', exitSandbox);
    if (btnMuteGlobal) btnMuteGlobal.addEventListener('click', () => window.d2Audio && window.d2Audio.toggleMute());
    if (btnToggleMute) btnToggleMute.addEventListener('click', () => window.d2Audio && window.d2Audio.toggleMute());

    // 全域快捷鍵 [D] 切換沙盒 / [ESC] 回到營火
    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyD' && !dungeonSandbox.isActive) {
            enterSandbox();
        }
    });

    // 動作控制列按鈕點擊事件
    const actBtnIdle = document.getElementById('act-btn-idle');
    const actBtnWalk = document.getElementById('act-btn-walk');
    const actBtnRun = document.getElementById('act-btn-run');
    const actBtnAttack = document.getElementById('act-btn-attack');
    const actBtnCast = document.getElementById('act-btn-cast');

    if (actBtnIdle) actBtnIdle.addEventListener('click', () => dungeonSandbox.character.setState('idle'));
    if (actBtnWalk) actBtnWalk.addEventListener('click', () => {
        dungeonSandbox.character.setRunMode(false);
        dungeonSandbox.character.setState('walk');
    });
    if (actBtnRun) actBtnRun.addEventListener('click', () => {
        dungeonSandbox.character.setRunMode(true);
        dungeonSandbox.character.setState('run');
    });
    if (actBtnAttack) actBtnAttack.addEventListener('click', () => dungeonSandbox.character.triggerAttack());
    if (actBtnCast) actBtnCast.addEventListener('click', () => dungeonSandbox.character.triggerCast());

    const actBtnSpawnMob = document.getElementById('act-btn-spawn-mob');
    const actBtnSpawnBoss = document.getElementById('act-btn-spawn-boss');
    const actBtnCycleScene = document.getElementById('act-btn-cycle-scene');
    if (actBtnSpawnMob) actBtnSpawnMob.addEventListener('click', () => {
        if (dungeonSandbox && dungeonSandbox.combatDirector) {
            dungeonSandbox.combatDirector.spawnMobWave(null, 3);
        }
    });
    if (actBtnSpawnBoss) actBtnSpawnBoss.addEventListener('click', () => {
        if (dungeonSandbox && dungeonSandbox.combatDirector) {
            dungeonSandbox.combatDirector.spawnBoss();
        }
    });
    if (actBtnCycleScene) actBtnCycleScene.addEventListener('click', () => {
        if (dungeonSandbox) {
            dungeonSandbox.cycleScene();
        }
    });

    // 串接 Phase 2 全平台通用 Agent Event Receiver
    if (window.d2AgentReceiver) {
        window.d2AgentReceiver.on('tool_execute', (payload) => {
            console.log("[Agent Event] Tool Execute:", payload);
            if (dungeonSandbox && dungeonSandbox.isActive && dungeonSandbox.character) {
                if (Math.random() > 0.4) {
                    dungeonSandbox.character.triggerCast();
                } else {
                    dungeonSandbox.character.triggerAttack();
                }
            }
        });

        window.d2AgentReceiver.on('thinking', (payload) => {
            console.log("[Agent Event] Thinking:", payload);
            if (dungeonSandbox && dungeonSandbox.isActive && dungeonSandbox.character) {
                dungeonSandbox.character.setState('idle');
            }
        });

        window.d2AgentReceiver.on('tool_success', (payload) => {
            console.log("[Agent Event] Tool Success:", payload);
        });

        window.d2AgentReceiver.on('error_retry', (payload) => {
            console.log("[Agent Event] Error/Retry:", payload);
        });
    }

    console.log("Diablo II Character Selection & 2.5D Dungeon Sandbox Engine Online.");
});

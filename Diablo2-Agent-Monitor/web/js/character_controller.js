/**
 * Diablo II 角色動作控制器 (Character Action Controller & State Machine)
 * 負責角色 16 方向動作狀態切換、動畫幀推進、物理移動與戰鬥/施法判定。
 */
class CharacterController {
    constructor(manifestUrl, onReady = null, heroId = 'paladin') {
        this.manifestUrl = manifestUrl;
        this.manifest = null;
        this.heroId = heroId || 'paladin';
        this.isLoaded = false;
        this.onReady = onReady;

        // 動作精靈圖貼圖快取
        this.sheets = {};

        // 物理與位置狀態
        this.x = 512;
        this.y = 400;
        this.prevX = 512;
        this.prevY = 400;
        this.targetX = null;
        this.targetY = null;
        this.moveSpeedWalk = 3.2; // 像素 / 40ms tick (約 80 px/sec)
        this.moveSpeedRun = 6.4;  // 像素 / 40ms tick (約 160 px/sec)
        this.isRunMode = true;   // 預設為奔跑模式 (經典 D2 玩家預設)

        // 方向控制器
        this.directionController = new DirectionController();
        this.currentDir = 0; // 0 = South (正南)

        // 動作狀態機
        this.state = 'idle'; // 'idle', 'walk', 'run', 'attack', 'cast'
        this.currentFrame = 0;
        this.frameCounter = 0; // 內部計數器
        this.frameAccumulator = 0; // 動畫幀率時間累加器 (杜絕滑步)

        // 裝甲形態管理 (輕裝 / 中裝 / 重裝)
        this.armorTier = 'light';
        this.armorTiers = ['light', 'medium', 'heavy'];

        // 當前技能與隨機技能管理
        this.lastWeaponMode = 'spear'; // 'spear' 或 'bow' (亞馬遜攻擊後姿態記憶)
        this.currentSkillType = null;
        this.currentSkillName = '';
        this.hasTriggeredSkill = false;
        this.isChanneling = false;
        this.castTargetX = null;
        this.castTargetY = null;

        // 全職業技能體系分支架構 (Skill Builds Engine)
        // 嚴格落實使用者於《全角色技能清單與實裝選擇表.md》之勾選設定 (僅收錄 [x] 勾選項目)
        this.heroBuilds = {
            sorceress: {
                fire: {
                    title: "純火系 (FIRE)",
                    attacks: [
                        { id: 'fire_bolt', name: '火彈 (直射)', sfx: 'assets/sfx/castfire.wav' }
                    ],
                    casts: [
                        { id: 'fire_bolt', name: '火彈 (直射)', sfx: 'assets/sfx/castfire.wav' },
                        { id: 'fireball', name: '炎爆火球', sfx: 'assets/sfx/castfire.wav' },
                        { id: 'inferno', name: '地獄火柱', sfx: 'assets/sfx/castfire.wav' },
                        { id: 'fire_wall', name: '地表火牆', sfx: 'assets/sfx/castfire.wav' },
                        { id: 'meteor', name: '隕石天降', sfx: 'assets/sfx/castfire.wav' },
                        { id: 'hydra', name: '九頭火蛇', sfx: 'assets/sfx/castfire.wav' }
                    ],
                    defaultAura: 'none'
                },
                cold: {
                    title: "純冰系 (COLD)",
                    attacks: [
                        { id: 'ice_bolt', name: '冰彈 (緩速)', sfx: 'assets/sfx/castcold.wav' }
                    ],
                    casts: [
                        { id: 'ice_bolt', name: '冰彈 (緩速)', sfx: 'assets/sfx/castcold.wav' },
                        { id: 'ice_blast', name: '冰風暴 (急凍)', sfx: 'assets/sfx/castcold.wav' },
                        { id: 'frost_nova', name: '冰霜新星 (環形霜爆)', sfx: 'assets/sfx/castcold.wav' },
                        { id: 'glacial_spike', name: '冰川之刺 (巨型急凍)', sfx: 'assets/sfx/castcold.wav' },
                        { id: 'blizzard', name: '暴風雪 (天降冰風暴)', sfx: 'assets/sfx/castcold.wav' },
                        { id: 'frozen_orb', name: '冰封球 (自轉散射)', sfx: 'assets/sfx/castcold.wav' }
                    ],
                    defaultAura: 'none'
                },
                lightning: {
                    title: "純電系 (LIGHTNING)",
                    attacks: [
                        { id: 'charged_bolt', name: '充能彈 (散射)', sfx: 'assets/sfx/lightning1.wav' }
                    ],
                    casts: [
                        { id: 'charged_bolt', name: '充能彈 (散射)', sfx: 'assets/sfx/lightning1.wav' },
                        { id: 'nova', name: '電擊新星', sfx: 'assets/sfx/lightning1.wav' },
                        { id: 'chain_lightning', name: '連鎖閃電', sfx: 'assets/sfx/lightning1.wav' },
                        { id: 'thunder_storm', name: '雷暴天怒', sfx: 'assets/sfx/lightning1.wav' }
                    ],
                    defaultAura: 'none'
                }
            },
            druid: {
                elemental: {
                    title: "元素德 (ELEMENTAL)",
                    attacks: [
                        { id: 'firestorm', name: '火風暴 (貼地蛇行)', sfx: 'assets/sfx/castfire.wav' }
                    ],
                    casts: [
                        { id: 'molten_boulder', name: '熔岩巨石 (滾動擊退)', sfx: 'assets/sfx/castfire.wav' },
                        { id: 'eruption', name: '裂縫火山噴發', sfx: 'assets/sfx/castfire.wav' },
                        { id: 'twister', name: '連環小旋風', sfx: 'assets/sfx/tornado.wav' },
                        { id: 'tornado', name: '狂風龍捲 (撕裂穿透)', sfx: 'assets/sfx/tornado.wav' },
                        { id: 'volcano', name: '活火山噴發', sfx: 'assets/sfx/castfire.wav' },
                        { id: 'cyclone_armor', name: '颶風裝甲 (元素吸收)', sfx: 'assets/sfx/tornado.wav' },
                        { id: 'armageddon', name: '毀天滅地 (流星雨)', sfx: 'assets/sfx/castfire.wav' },
                        { id: 'hurricane', name: '急凍暴風 (隨身氣旋)', sfx: 'assets/sfx/castcold.wav' }
                    ],
                    defaultAura: 'none'
                },
                shapeshift: {
                    title: "變形德 (SHAPESHIFT)",
                    attacks: [
                        { id: 'maul', name: '熊人撞擊 (重拍昏眩)', sfx: 'assets/sfx/combat/smite.wav' },
                        { id: 'rabies', name: '狂犬病 (疫病傳染)', sfx: 'assets/sfx/combat/swing.wav' },
                        { id: 'fire_claws', name: '烈焰爪 (火炎爆破)', sfx: 'assets/sfx/castfire.wav' },
                        { id: 'hunger', name: '飢餓撕咬 (偷生偷魔)', sfx: 'assets/sfx/combat/swing.wav' },
                        { id: 'fury', name: '狼人狂怒五連撕咬', sfx: 'assets/sfx/combat/swing.wav' }
                    ],
                    casts: [
                        { id: 'shock_wave', name: '熊人震波 (地表半圓擊暈)', sfx: 'assets/sfx/combat/smite.wav' },
                        { id: 'wearwolf', name: '變形狼人 (迅捷姿態)', sfx: 'assets/sfx/combat/swing.wav' },
                        { id: 'wearbear', name: '變形熊人 (巨型狂暴)', sfx: 'assets/sfx/combat/smite.wav' }
                    ],
                    defaultAura: 'none'
                },
                summon: {
                    title: "召喚德 (SUMMONING)",
                    attacks: [
                        { id: 'staff_swing', name: '自然橡木法杖揮擊', sfx: 'assets/sfx/combat/swing.wav' }
                    ],
                    casts: [
                        { id: 'summon_raven', name: '召喚烏鴉 (啄眼致盲)', sfx: 'assets/sfx/combat/cast.wav' },
                        { id: 'plague_poppy', name: '劇毒藤蔓 (毒路蔓延)', sfx: 'assets/sfx/combat/cast.wav' },
                        { id: 'oak_sage', name: '橡木智者 (生命加倍靈氣)', sfx: 'assets/sfx/combat/cast.wav' },
                        { id: 'summon_spirit_wolf', name: '召喚鬼狼 (瞬移撕咬)', sfx: 'assets/sfx/combat/swing.wav' },
                        { id: 'cycle_of_life', name: '食屍藤 (吞噬屍體回血)', sfx: 'assets/sfx/combat/cast.wav' },
                        { id: 'heart_of_wolverine', name: '狼獾之心 (增傷狂暴靈氣)', sfx: 'assets/sfx/combat/cast.wav' },
                        { id: 'summon_fenris', name: '召喚狂狼 (兇殘撕咬狂暴)', sfx: 'assets/sfx/combat/swing.wav' },
                        { id: 'vines', name: '太陽藤 (吞噬屍體回魔)', sfx: 'assets/sfx/combat/cast.wav' },
                        { id: 'spirit_of_barbs', name: '棘靈 (反彈傷害靈氣)', sfx: 'assets/sfx/combat/cast.wav' },
                        { id: 'summon_grizzly', name: '召喚灰熊 (震退重擊)', sfx: 'assets/sfx/combat/smite.wav' }
                    ],
                    defaultAura: 'none'
                }
            },
            necromancer: {
                bone: {
                    title: "毒骨死靈 (POISON & BONE)",
                    attacks: [
                        { id: 'poison_dagger', name: '劇毒匕首 (刺擊濃毒)', sfx: 'assets/sfx/combat/swing.wav' }
                    ],
                    casts: [
                        { id: 'teeth', name: '白骨之牙 (7芒散射)', sfx: 'assets/sfx/bonecast.wav' },
                        { id: 'bone_armor', name: '白骨護盾 (骨片環繞)', sfx: 'assets/sfx/bonecast.wav' },
                        { id: 'corpse_explosion', name: '屍體爆炸 (血肉橫飛巨額爆破)', sfx: 'assets/sfx/combat/foh_impact.wav' },
                        { id: 'poison_explosion', name: '毒爆 (屍體釋放濃綠毒雲)', sfx: 'assets/sfx/bonecast.wav' },
                        { id: 'poison_nova', name: '劇毒新星 (環狀地表毒波)', sfx: 'assets/sfx/bonecast.wav' },
                        { id: 'bone_spirit', name: '白骨之魂 (追蹤幽靈怨靈)', sfx: 'assets/sfx/bonespirit1.wav' }
                    ],
                    defaultAura: 'none'
                },
                summon: {
                    title: "召喚死靈 (SUMMONING)",
                    attacks: [
                        { id: 'necro_dagger', name: '骨匕骨刺', sfx: 'assets/sfx/combat/swing.wav' }
                    ],
                    casts: [
                        { id: 'raise_skeleton', name: '復生骷髏戰士 (近戰僕從)', sfx: 'assets/sfx/bonecast.wav' },
                        { id: 'raise_mage', name: '復生骷髏法師 (元素遠程)', sfx: 'assets/sfx/bonecast.wav' },
                        { id: 'clay_golem', name: '召喚黏土魔像 (攻擊緩速)', sfx: 'assets/sfx/bonecast.wav' },
                        { id: 'blood_golem', name: '召喚鮮血魔像 (生命回饋)', sfx: 'assets/sfx/bonecast.wav' },
                        { id: 'iron_golem', name: '召喚鋼鐵魔像 (裝備轉化)', sfx: 'assets/sfx/bonecast.wav' },
                        { id: 'fire_golem', name: '召喚火焰魔像 (聖火光環)', sfx: 'assets/sfx/castfire.wav' },
                        { id: 'revive', name: '遺骸復生大軍 (怪物原樣復活)', sfx: 'assets/sfx/bonecast.wav' }
                    ],
                    defaultAura: 'none'
                }
            },
            amazon: {
                bow: {
                    title: "弓箭亞馬遜 (BOW)",
                    attacks: [
                        { id: 'magic_arrow', name: '魔法箭矢 (無耗損穿透)', sfx: 'assets/sfx/arrow1.wav' }
                    ],
                    casts: [
                        { id: 'fire_arrow', name: '火箭 (點燃烈火)', sfx: 'assets/sfx/castfire.wav' },
                        { id: 'cold_arrow', name: '冰箭 (霜凍緩速)', sfx: 'assets/sfx/castcold.wav' },
                        { id: 'multishot', name: '多重箭陣 (扇形齊射)', sfx: 'assets/sfx/arrow1.wav' },
                        { id: 'exploding_arrow', name: '爆裂箭 (範圍火爆)', sfx: 'assets/sfx/castfire.wav' },
                        { id: 'ice_arrow', name: '急凍箭 (強效凍結)', sfx: 'assets/sfx/castcold.wav' },
                        { id: 'guided_arrow', name: '導引箭 (追蹤尋標飛彈)', sfx: 'assets/sfx/arrow1.wav' },
                        { id: 'strafe', name: '全場狂暴掃射 (箭雨傾瀉)', sfx: 'assets/sfx/arrow1.wav' },
                        { id: 'immolation_arrow', name: '燃燒箭 (地表火海篝火)', sfx: 'assets/sfx/castfire.wav' },
                        { id: 'freezing_arrow', name: '凍結箭 (大範圍急凍風暴)', sfx: 'assets/sfx/castcold.wav' },
                        { id: 'valkyrie', name: '召喚女武神 (跨系通用僕從)', sfx: 'assets/sfx/combat/cast.wav' }
                    ],
                    defaultAura: 'none'
                },
                javelin: {
                    title: "標槍亞馬遜 (JAVELIN)",
                    attacks: [
                        { id: 'jab', name: '長矛戳刺 (快速三連刺)', sfx: 'assets/sfx/combat/swing.wav' },
                        { id: 'power_strike', name: '強力一擊 (電芒爆發)', sfx: 'assets/sfx/combat/smite.wav' },
                        { id: 'impale', name: '刺爆 (沉重破甲)', sfx: 'assets/sfx/combat/smite.wav' },
                        { id: 'charged_strike', name: '充能一擊 (命中爆散充能彈)', sfx: 'assets/sfx/combat/smite.wav' },
                        { id: 'fend', name: '全方位連續刺擊', sfx: 'assets/sfx/combat/swing.wav' },
                        { id: 'lightning_strike', name: '閃電一擊 (連鎖雷霆)', sfx: 'assets/sfx/lightning1.wav' }
                    ],
                    casts: [
                        { id: 'poison_javelin', name: '毒氣標槍 (留毒雲路徑)', sfx: 'assets/sfx/magicarrow1.wav' },
                        { id: 'lightning_bolt', name: '雷霆標槍 (穿透閃電球)', sfx: 'assets/sfx/magicarrow1.wav' },
                        { id: 'plague_javelin', name: '瘟疫標槍 (毒雲大爆發)', sfx: 'assets/sfx/magicarrow1.wav' },
                        { id: 'lightning_fury', name: '閃電之怒 (全螢幕雷霆爆散)', sfx: 'assets/sfx/magicarrow1.wav' },
                        { id: 'valkyrie', name: '召喚女武神 (跨系通用僕從)', sfx: 'assets/sfx/combat/cast.wav' }
                    ],
                    defaultAura: 'none'
                }
            },
            assassin: {
                traps: {
                    title: "陷阱刺客 (TRAPS)",
                    attacks: [
                        { id: 'blade_fury', name: '利刃之怒 (連續飛鏢急速射擊)', sfx: 'assets/sfx/bladefury1.wav' }
                    ],
                    casts: [
                        { id: 'fire_trauma', name: '火焰爆震 (弧線拋擲炸彈)', sfx: 'assets/sfx/castfire.wav' },
                        { id: 'shock_field', name: '電能網 (地面鋪設電網)', sfx: 'assets/sfx/lightning1.wav' },
                        { id: 'blade_sentinel', name: '刃之守衛 (穿梭旋轉飛刃盤)', sfx: 'assets/sfx/bladefury1.wav' },
                        { id: 'charged_bolt_sentry', name: '雷電網陷阱 (發射充能彈)', sfx: 'assets/sfx/lightning1.wav' },
                        { id: 'wake_of_fire', name: '火之復甦陷阱 (波浪火焰)', sfx: 'assets/sfx/castfire.wav' },
                        { id: 'lightning_sentry', name: '雷光守衛陷阱 (直線高壓雷電束)', sfx: 'assets/sfx/lightning1.wav' },
                        { id: 'inferno_sentry', name: '復甦獄火陷阱 (持續火柱噴射)', sfx: 'assets/sfx/castfire.wav' },
                        { id: 'death_sentry', name: '亡者守衛陷阱 (連鎖引爆屍體)', sfx: 'assets/sfx/combat/foh_impact.wav' },
                        { id: 'blade_shield', name: '刀刃之盾 (護體旋轉飛刀)', sfx: 'assets/sfx/bladefury1.wav' },
                        { id: 'shadow_master', name: '召喚暗影宗師 (跨系通用僕從)', sfx: 'assets/sfx/combat/cast.wav' }
                    ],
                    defaultAura: 'none'
                },
                martial: {
                    title: "武術刺客 (MARTIAL ARTS)",
                    attacks: [
                        { id: 'tiger_strike', name: '虎擊 (三段蓄力巨額物傷)', sfx: 'assets/sfx/combat/swing.wav' },
                        { id: 'dragon_talon', name: '龍爪連環飛踢 (原廠KK動作三連踢)', sfx: 'assets/sfx/combat/smite.wav' },
                        { id: 'fists_of_fire', name: '焰拳 (烈火爪法蓄力)', sfx: 'assets/sfx/castfire.wav' },
                        { id: 'dragon_claw', name: '雙龍爪 (雙持武器交叉斬)', sfx: 'assets/sfx/combat/swing.wav' },
                        { id: 'cobra_strike', name: '眼鏡蛇擊 (吸血吸魔蓄力)', sfx: 'assets/sfx/combat/swing.wav' },
                        { id: 'claws_of_thunder', name: '雷電爪 (雷霆充能彈釋放)', sfx: 'assets/sfx/lightning1.wav' },
                        { id: 'dragon_tail', name: '神龍擺尾 (原廠KK爆踢火焰波)', sfx: 'assets/sfx/combat/smite.wav' },
                        { id: 'blades_of_ice', name: '寒冰刃 (嚴冬霜氣急凍爪)', sfx: 'assets/sfx/castcold.wav' },
                        { id: 'dragon_flight', name: '飛龍在天 (瞬移重踢擊爆目標)', sfx: 'assets/sfx/combat/smite.wav' },
                        { id: 'royal_strike', name: '鳳凰連擊 (終極火冰電三重大招)', sfx: 'assets/sfx/combat/smite.wav' }
                    ],
                    casts: [
                        { id: 'shadow_master', name: '召喚暗影宗師 (跨系通用僕從)', sfx: 'assets/sfx/combat/cast.wav' }
                    ],
                    defaultAura: 'none'
                }
            },
            paladin: {
                all: {
                    title: "聖騎士 (PALADIN - 作戰與靈氣)",
                    attacks: [
                        { id: 'smite', name: '重擊 (盾牌衝撞必中昏眩)', sfx: 'assets/sfx/combat/smite.wav' },
                        { id: 'zeal', name: '熱誠五連斬 (白熱殘影連續斬擊)', sfx: 'assets/sfx/combat/swing.wav' },
                        { id: 'charge', name: '衝鋒 (高速突進重撞)', sfx: 'assets/sfx/combat/smite.wav' }
                    ],
                    casts: [
                        { id: 'smite', name: '重擊 (盾牌衝撞必中昏眩)', sfx: 'assets/sfx/combat/smite.wav' },
                        { id: 'charge', name: '衝鋒 (高速突進重撞)', sfx: 'assets/sfx/combat/smite.wav' },
                        { id: 'holy_shield', name: '神聖之盾 (金色神盾手盾一體)', sfx: 'assets/sfx/combat/cast.wav' },
                        { id: 'hammer', name: '祝聖之槌 (阿基米德螺旋光槌)', sfx: 'assets/sfx/combat/hammer_launch.wav' },
                        { id: 'foh', name: '天堂之拳 (天降神聖落雷散出聖光彈)', sfx: 'assets/sfx/combat/foh_cast.wav' },
                        { id: 'holy_bolt', name: '聖光彈 (穿透聖光球)', sfx: 'assets/sfx/combat/holy_bolt.wav' },
                        { id: 'zeal', name: '熱誠五連斬 (白熱殘影連續斬擊)', sfx: 'assets/sfx/combat/swing.wav' }
                    ],
                    defaultAura: 'holyfire'
                }
            },
            barbarian: {
                all: {
                    title: "野蠻人 (BARBARIAN - 全能)",
                    attacks: [
                        { id: 'bash', name: '重擊 (猛力打擊帶擊退)', sfx: 'assets/sfx/combat/smite.wav' },
                        { id: 'double_swing', name: '雙重打擊 (左右開弓速擊)', sfx: 'assets/sfx/combat/swing.wav' },
                        { id: 'double_throw', name: '雙重投擲 (同時擲出雙武器)', sfx: 'assets/sfx/combat/swing.wav' },
                        { id: 'leap_attack', name: '跳躍攻擊 (騰空暴起下劈震波)', sfx: 'assets/sfx/combat/smite.wav' },
                        { id: 'concentrate', name: '專注打擊 (不可中斷堅定斬擊)', sfx: 'assets/sfx/combat/swing.wav' },
                        { id: 'frenzy', name: '狂亂 (雙持狂暴加速劈砍)', sfx: 'assets/sfx/combat/swing.wav' },
                        { id: 'whirlwind', name: '旋風斬 (高速旋轉位移序列0吼叫)', sfx: 'assets/sfx/whirlwind1.wav' },
                        { id: 'berserk', name: '狂戰士 (純魔法破甲狂暴一擊)', sfx: 'assets/sfx/combat/smite.wav' }
                    ],
                    casts: [
                        { id: 'warcry', name: '震撼戰嚎 (SC仰天咆哮地表震波群暈)', sfx: 'assets/sfx/circle_warcry.wav' },
                        { id: 'grim_ward', name: '殘酷庇護所 (地表骨頭圖騰稻草人)', sfx: 'assets/sfx/combat/cast.wav' }
                    ],
                    defaultAura: 'none'
                }
            }
        };

        // 當前各職業選中的體系索引記錄
        this.currentBuilds = {
            sorceress: 'fire',
            druid: 'elemental',
            necromancer: 'bone',
            amazon: 'bow',
            assassin: 'traps',
            paladin: 'all',
            barbarian: 'all'
        };

        // 當前右鍵施法招式與左鍵攻擊招式索引
        this.activeCastIndex = 0;
        this.activeAttackIndex = 0;

        // 供 UI 與出招系統快速存取之實體技能表
        this.heroSkills = {};
        this.refreshAllHeroSkills();

        // 靜音開關 (依使用者指示預設關閉所有音效)
        this.disableSound = true;

        // 原版音效庫
        this.sfxSwing = new Audio('assets/sfx/combat/swing.wav');
        this.sfxSmite = new Audio('assets/sfx/combat/smite.wav');
        this.sfxCast = new Audio('assets/sfx/combat/cast.wav');
        this.sfxHammerLaunch = new Audio('assets/sfx/combat/hammer_launch.wav');
        this.sfxFohCast = new Audio('assets/sfx/combat/foh_cast.wav');
        this.sfxFohImpact = new Audio('assets/sfx/combat/foh_impact.wav');
        this.sfxHolyBolt = new Audio('assets/sfx/combat/holy_bolt.wav');

        // 白熱連擊計數器與連擊目標
        this.zealStrikesRemaining = 0;
        this.meleeTargetMonster = null;

        // 近戰技能自動逼近 (Melee Auto-Approach) 狀態機
        this.isAutoApproaching = false;
        this.autoApproachSkill = null;
        this.autoApproachTargetX = null;
        this.autoApproachTargetY = null;
        this.autoApproachMonster = null;

        // 純打擊技能實體系統 (戰槌、落雷、聖光彈、刀芒 - 零靈氣)
        this.hammers = [];
        this.fohStrikes = [];
        this.holyBolts = [];
        this.slashes = [];

        // 神聖之盾 (Holy Shield) 常駐流動光華與原廠 Gleam 精靈圖
        this.holyShieldActive = false;
        this.holyShieldTimer = 0;
        this.holyShieldTick = 0;
        this.baseArmorTier = 'light';
        this.armorCache = {};
        this.paladinHeraldicSheets = null;
        this.holyShieldSheets = null;
        this.imgGleam = new Image();
        this.imgGleam.src = 'assets/skills/paladin/Gleam.png';
        this.imgHolyShield = new Image();
        this.imgHolyShield.src = 'assets/skills/paladin/HolyShield_Official.png';
        this.isCharging = false;
        this.chargeTargetX = null;
        this.chargeTargetY = null;

        // 常駐靈氣庫 (嚴格收錄《全角色技能清單與實裝選擇表.md》中打勾 [x] 的 10 種攻擊靈氣，Q 鍵輪轉)
        this.auraList = ['holyfire', 'holyfreeze', 'holyshock', 'fanatic', 'concentration', 'might', 'sanctuary', 'conviction', 'thorns', 'blessedaim', 'none'];
        this.activeAura = 'holyfire'; // 預設神聖之火，立即可見 360 度烈火光環效果
        this.auraTick = 0;

        // 正統技能與覆蓋層精靈圖集快取 (零自繪，100% 官方素材庫)
        this.fxSheets = {};
        this.fxAuras = {};

        this.initFxAssets();
        this.loadHero(this.heroId);
    }

    refreshAllHeroSkills() {
        for (const [hId, builds] of Object.entries(this.heroBuilds)) {
            const bKey = this.currentBuilds[hId] || Object.keys(builds)[0];
            const buildData = builds[bKey] || Object.values(builds)[0];
            this.heroSkills[hId] = {
                title: buildData.title,
                attacks: [...buildData.attacks],
                casts: [...buildData.casts],
                defaultAura: buildData.defaultAura || 'none'
            };
        }
        const curSkill = this.getActiveCastSkill();
        if (curSkill) {
            this.currentSkillType = curSkill.id;
            this.currentSkillName = curSkill.name;
        }
    }

    getActiveCastSkill() {
        const hId = (this.heroId || 'paladin').toLowerCase();
        const cfg = this.heroSkills[hId];
        if (!cfg) return { id: 'fireball', name: '預設技能', sfx: 'assets/sfx/combat/cast.wav' };
        const list = (cfg.casts && cfg.casts.length > 0) ? cfg.casts : (cfg.attacks || []);
        if (list.length === 0) return { id: 'slash', name: '普通攻擊', sfx: 'assets/sfx/combat/swing.wav' };
        if (this.activeCastIndex >= list.length) {
            this.activeCastIndex = 0;
        }
        return list[this.activeCastIndex];
    }

    cycleCastSkill(step = 1) {
        const hId = (this.heroId || 'paladin').toLowerCase();
        const cfg = this.heroSkills[hId];
        if (!cfg) return;
        const list = (cfg.casts && cfg.casts.length > 0) ? cfg.casts : (cfg.attacks || []);
        if (list.length === 0) return;
        this.activeCastIndex = (this.activeCastIndex + step + list.length) % list.length;
        const cur = list[this.activeCastIndex];
        this.currentSkillType = cur.id;
        this.currentSkillName = cur.name;

        const director = (window.dungeonSandbox && window.dungeonSandbox.combatDirector) || window.d2CombatDirector;
        if (director && director.showFloatingCombatText) {
            director.showFloatingCombatText(this.x, this.y - 70, `右鍵招式: ${cur.name}`, '#38bdf8');
        }
        if (window.dungeonSandbox && window.dungeonSandbox.updateHUD) {
            window.dungeonSandbox.updateHUD();
        }
        return cur;
    }

    selectCastSkillByIndex(index) {
        const hId = (this.heroId || 'paladin').toLowerCase();
        const cfg = this.heroSkills[hId];
        if (!cfg) return;
        const list = (cfg.casts && cfg.casts.length > 0) ? cfg.casts : (cfg.attacks || []);
        if (index < 0 || index >= list.length) return;
        this.activeCastIndex = index;
        const cur = list[this.activeCastIndex];
        this.currentSkillType = cur.id;
        this.currentSkillName = cur.name;

        const director = (window.dungeonSandbox && window.dungeonSandbox.combatDirector) || window.d2CombatDirector;
        if (director && director.showFloatingCombatText) {
            director.showFloatingCombatText(this.x, this.y - 70, `右鍵招式: ${cur.name}`, '#38bdf8');
        }
        if (window.dungeonSandbox && window.dungeonSandbox.updateHUD) {
            window.dungeonSandbox.updateHUD();
        }
        return cur;
    }

    getActiveAttackSkill() {
        const hId = (this.heroId || 'paladin').toLowerCase();
        const cfg = this.heroSkills[hId];
        if (!cfg || !cfg.attacks || cfg.attacks.length === 0) {
            return { id: 'slash', name: '普通攻擊', sfx: 'assets/sfx/combat/swing.wav' };
        }
        if (this.activeAttackIndex >= cfg.attacks.length) {
            this.activeAttackIndex = 0;
        }
        return cfg.attacks[this.activeAttackIndex];
    }

    cycleAttackSkill(step = 1) {
        const hId = (this.heroId || 'paladin').toLowerCase();
        const cfg = this.heroSkills[hId];
        if (!cfg || !cfg.attacks || cfg.attacks.length === 0) return;
        this.activeAttackIndex = (this.activeAttackIndex + step + cfg.attacks.length) % cfg.attacks.length;
        const cur = cfg.attacks[this.activeAttackIndex];
        const director = (window.dungeonSandbox && window.dungeonSandbox.combatDirector) || window.d2CombatDirector;
        if (director && director.showFloatingCombatText) {
            director.showFloatingCombatText(this.x, this.y - 70, `左鍵招式: ${cur.name}`, '#4ade80');
        }
        if (window.dungeonSandbox && window.dungeonSandbox.updateHUD) {
            window.dungeonSandbox.updateHUD();
        }
        return cur;
    }

    getCurrentBuildTitle(heroId = null) {
        const hId = (heroId || this.heroId || 'paladin').toLowerCase();
        const builds = this.heroBuilds[hId];
        if (!builds) return "全能體系";
        const keys = Object.keys(builds);
        if (keys.length <= 1) return "全能體系 (ALL-ROUND)";
        const curKey = this.currentBuilds[hId] || keys[0];
        const data = builds[curKey];
        return data ? data.title : "全能體系";
    }

    cycleBuild() {
        const hId = (this.heroId || 'paladin').toLowerCase();
        const builds = this.heroBuilds[hId];
        if (!builds) return;
        const keys = Object.keys(builds);
        if (keys.length <= 1) {
            console.log(`[Skill Builds] ${hId} 為全能職業，無須分系。`);
            return;
        }
        const curIndex = keys.indexOf(this.currentBuilds[hId]);
        const nextIndex = (curIndex + 1) % keys.length;
        const nextKey = keys[nextIndex];
        this.currentBuilds[hId] = nextKey;
        this.activeCastIndex = 0;
        this.activeAttackIndex = 0;
        this.refreshAllHeroSkills();

        const buildTitle = this.getCurrentBuildTitle(hId);
        console.log(`[Skill Builds] ${hId.toUpperCase()} 切換體系至: ${buildTitle}`);

        // 播報與更新右鍵預設技能
        const curSkill = this.getActiveCastSkill();
        if (curSkill) {
            this.currentSkillType = curSkill.id;
            this.currentSkillName = curSkill.name;
        }

        const director = (window.dungeonSandbox && window.dungeonSandbox.combatDirector) || window.d2CombatDirector;
        if (director && director.showFloatingCombatText) {
            director.showFloatingCombatText(this.x, this.y - 70, `體系切換: ${buildTitle}`, '#f59e0b');
        }
        if (window.dungeonSandbox && window.dungeonSandbox.updateHud) {
            window.dungeonSandbox.updateHud();
        }
    }

    playSFX(audio, volume = 0.5) {
        if (window.__D2_DISABLE_AUDIO__ || this.disableSound || (window.d2Audio && window.d2Audio.isMuted)) return;
        if (window.d2Audio) {
            window.d2Audio.play(audio, volume);
        }
    }

    playSFXFile(path, volume = 0.5) {
        if (!path || window.__D2_DISABLE_AUDIO__ || this.disableSound || (window.d2Audio && window.d2Audio.isMuted)) return;
        if (window.d2Audio) {
            window.d2Audio.playFile(path, volume);
        }
    }

    async initFxAssets() {
        // 載入正統技能投射物與原版地表環狀靈氣 (Back + Front 雙層結構)
        const fxManifest = window.D2_FX_MANIFEST || window.FX_MANIFEST || null;
        if (!fxManifest) return;

        if (fxManifest.skills) {
            for (const [skillKey, skillData] of Object.entries(fxManifest.skills)) {
                const img = new Image();
                img.src = skillData.file;
                this.fxSheets[skillKey] = { img, data: skillData };
            }
        }

        if (fxManifest.auras) {
            for (const [auraKey, auraData] of Object.entries(fxManifest.auras)) {
                const backImg = new Image();
                backImg.src = auraData.back_file;
                const frontImg = new Image();
                frontImg.src = auraData.front_file;
                this.fxAuras[auraKey] = { backImg, frontImg, data: auraData };
            }
        }
    }

    /**
     * 動態切換與載入任意英雄動作圖集 (Amazon, Assassin, Barbarian, Druid, Necromancer, Paladin, Sorceress)
     * 支援 輕裝 (Light) / 中裝 (Medium) / 重裝 (Heavy) 裝甲形態熱切換
     */
    async loadHero(heroId, armorTier = null) {
        if (!heroId) heroId = 'paladin';
        heroId = heroId.toLowerCase();
        this.heroId = heroId;

        // 聖騎士重裝具備兩種形態 (紋章盾 heavy 與 塔盾 heavy_tower)
        if (this.heroId === 'paladin') {
            this.armorTiers = ['light', 'medium', 'heavy', 'heavy_tower'];
        } else {
            this.armorTiers = ['light', 'medium', 'heavy'];
        }

        if (armorTier && this.armorTiers.includes(armorTier)) {
            this.armorTier = armorTier;
        } else if (!this.armorTiers.includes(this.armorTier)) {
            this.armorTier = 'light';
        }
        this.baseArmorTier = this.armorTier;

        this.sheets = {};
        this.isLoaded = false;

        try {
            if (!this.armorCache) this.armorCache = {};
            const cacheKey = `${heroId}_${this.armorTier}`;

            if (this.armorCache[cacheKey]) {
                this.sheets = this.armorCache[cacheKey].sheets;
                this.manifest = this.armorCache[cacheKey].manifest;
            } else {
                // 優先嘗試該裝甲階級專屬 manifest
                const tierVarName = `${heroId.toUpperCase()}_${this.armorTier.toUpperCase()}_MANIFEST`;
                const rootVarName = `${heroId.toUpperCase()}_MANIFEST`;

                let manifestData = null;
                const hasBaseTag = typeof document !== 'undefined' && !!document.querySelector('base');
                const isRuntimeSubdir = !hasBaseTag && typeof window !== 'undefined' && window.location.pathname.includes('/runtime/');
                const assetPrefix = isRuntimeSubdir ? '../../' : '';
                let baseUrl = `${assetPrefix}assets/characters/${heroId}/${this.armorTier}/`;

                if (window[tierVarName]) {
                    manifestData = window[tierVarName];
                } else if (window[rootVarName] && this.armorTier === 'light') {
                    manifestData = window[rootVarName];
                    baseUrl = `${assetPrefix}assets/characters/${heroId}/`;
                } else {
                    try {
                        const resp = await fetch(`${assetPrefix}assets/characters/${heroId}/${this.armorTier}/manifest.json`);
                        if (resp.ok) {
                            manifestData = await resp.json();
                        }
                    } catch (e) {}

                    if (!manifestData) {
                        const resp = await fetch(`${assetPrefix}assets/characters/${heroId}/manifest.json`);
                        manifestData = await resp.json();
                        baseUrl = `${assetPrefix}assets/characters/${heroId}/`;
                    }
                }

                this.manifest = manifestData;
                const loadPromises = [];

                for (const [actionName, actionData] of Object.entries(this.manifest.actions)) {
                    const p = new Promise((resolve) => {
                        const img = new Image();
                        img.onload = () => {
                            this.sheets[actionName] = { img, data: actionData };
                            resolve();
                        };
                        img.onerror = () => {
                            console.warn(`Could not load ${heroId} [${this.armorTier}] action: ${actionName}`);
                            resolve();
                        };
                        img.src = baseUrl + actionData.file;
                    });
                    loadPromises.push(p);
                }

                await Promise.all(loadPromises);
                this.armorCache[cacheKey] = { sheets: this.sheets, manifest: this.manifest };
            }

            // 若為聖騎士，同步確保預載手盾一體金色神聖紋章盾圖集 (神聖之盾生效外觀)
            if (this.heroId === 'paladin') {
                await this.preloadPaladinHolyShieldSheets();
                if (this.holyShieldActive) {
                    const targetTier = this.getHolyShieldTier(this.baseArmorTier);
                    this.setArmorAppearance(targetTier);
                }
            }

            // 靈氣設定：聖騎士開啟聖火，其餘職業設為無靈氣
            const heroConfig = this.heroSkills[this.heroId];
            this.activeAura = (heroConfig && heroConfig.defaultAura) ? heroConfig.defaultAura : 'none';

            this.state = 'idle';
            this.lastWeaponMode = 'spear';
            this.currentFrame = 0;
            this.frameAccumulator = 0;
            this.isLoaded = true;

            this.activeCastIndex = 0;
            this.activeAttackIndex = 0;
            const curSkill = this.getActiveCastSkill();
            if (curSkill) {
                this.currentSkillType = curSkill.id;
                this.currentSkillName = curSkill.name;
            }

            console.log(`[Hero Controller] Hero loaded: ${this.heroId.toUpperCase()} [Armor: ${this.armorTier.toUpperCase()}]`);

            // 通知戰鬥導演同步出征英雄夥伴 (德魯伊/死靈)
            const director = (window.dungeonSandbox && window.dungeonSandbox.combatDirector) || window.d2CombatDirector;
            if (director && director.onHeroChanged) {
                director.onHeroChanged(this.heroId);
            }

            if (this.onReady) this.onReady();
        } catch (e) {
            console.error(`Failed to load hero ${heroId}:`, e);
        }
    }

    /**
     * 預載聖騎士專屬 16 方向手盾一體金色神聖紋章盾精靈圖集
     * (light_holyshield, medium_holyshield, heavy_holyshield)
     * 原廠骨骼深度鎖定，100% 杜絕外掛盾牌脫手飛走
     */
    async preloadPaladinHolyShieldSheets() {
        const tiers = ['light_holyshield', 'medium_holyshield', 'heavy_holyshield'];
        const hasBaseTag = typeof document !== 'undefined' && !!document.querySelector('base');
        const isRuntimeSubdir = !hasBaseTag && typeof window !== 'undefined' && window.location.pathname.includes('/runtime/');
        const assetPrefix = isRuntimeSubdir ? '../../' : '';

        for (const tier of tiers) {
            const cacheKey = `paladin_${tier}`;
            if (this.armorCache && this.armorCache[cacheKey]) continue;

            const tierVarName = `PALADIN_${tier.toUpperCase()}_MANIFEST`;
            let manifestData = (typeof window !== 'undefined' && window[tierVarName]) ? window[tierVarName] : null;
            const baseUrl = `${assetPrefix}assets/characters/paladin/${tier}/`;

            if (!manifestData) {
                try {
                    const resp = await fetch(`${baseUrl}manifest.json`);
                    if (resp.ok) manifestData = await resp.json();
                } catch (e) {}
            }
            if (!manifestData || !manifestData.actions) continue;

            const tierSheets = {};
            const loadPromises = [];
            for (const [actionName, actionData] of Object.entries(manifestData.actions)) {
                const p = new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        tierSheets[actionName] = { img, data: actionData };
                        resolve();
                    };
                    img.onerror = () => {
                        console.warn(`Could not preload paladin holy shield ${tier} action: ${actionName}`);
                        resolve();
                    };
                    img.src = baseUrl + actionData.file;
                });
                loadPromises.push(p);
            }
            await Promise.all(loadPromises);
            if (!this.armorCache) this.armorCache = {};
            this.armorCache[cacheKey] = { sheets: tierSheets, manifest: manifestData };
        }
    }

    getHolyShieldTier(baseTier) {
        if (baseTier === 'light') return 'light_holyshield';
        if (baseTier === 'medium') return 'medium_holyshield';
        return 'heavy_holyshield';
    }

    setArmorAppearance(tierName) {
        this.armorTier = tierName;
        const cacheKey = `${this.heroId}_${tierName}`;
        if (this.armorCache && this.armorCache[cacheKey]) {
            this.sheets = this.armorCache[cacheKey].sheets;
            this.manifest = this.armorCache[cacheKey].manifest;
        }
    }

    activateHolyShield() {
        this.holyShieldActive = true;
        this.holyShieldTimer = 60000;
        this.holyShieldTick = 0;
        const targetTier = this.getHolyShieldTier(this.baseArmorTier || 'light');
        this.setArmorAppearance(targetTier);
        if (this.showFloatingPrompt) {
            this.showFloatingPrompt("神聖之盾！手盾一體 金光璀璨 格擋防禦暴增", "#fbbf24");
        }
    }

    deactivateHolyShield() {
        if (!this.holyShieldActive) return;
        this.holyShieldActive = false;
        this.holyShieldTimer = 0;
        this.setArmorAppearance(this.baseArmorTier || 'light');
        if (this.showFloatingPrompt) {
            this.showFloatingPrompt("神聖之盾持續時間結束，還原原本盾牌", "#94a3b8");
        }
    }

    /**
     * 切換裝甲形態 (Light -> Medium -> Heavy -> Heavy Tower)
     */
    async cycleArmorTier() {
        const curIdx = this.armorTiers.indexOf(this.baseArmorTier || this.armorTier);
        const nextIdx = (curIdx + 1) % this.armorTiers.length;
        const nextTier = this.armorTiers[nextIdx];
        await this.setArmorTier(nextTier);
        return nextTier;
    }

    /**
     * 設定特定裝甲形態 (light, medium, heavy, heavy_tower)
     */
    async setArmorTier(tier) {
        if (!this.armorTiers.includes(tier)) tier = 'light';
        this.baseArmorTier = tier;
        if (this.heroId === 'paladin' && this.holyShieldActive) {
            // 確保該 baseTier 載入快取，然後切為對應的 holyshield
            await this.loadHero(this.heroId, this.baseArmorTier);
            const targetTier = this.getHolyShieldTier(this.baseArmorTier);
            this.setArmorAppearance(targetTier);
        } else {
            await this.loadHero(this.heroId, tier);
        }

        if (window.dungeonSandbox && window.dungeonSandbox.updateHud) {
            window.dungeonSandbox.updateHud();
        }
    }

    getDisplayState() {
        if (this.state === 'cast') {
            return `CAST: ${this.currentSkillName || '施法'}`;
        }
        if (this.state === 'attack') {
            return `ATTACK: ${this.currentSkillName || '揮砍'}`;
        }
        return this.state.toUpperCase();
    }

    /**
     * 動態獲取當前動作精靈圖 (支援亞馬遜近戰戳刺/遠程標槍投擲/遠程弓箭三動作獨立圖集)
     */
    getCurrentActionSheet() {
        if (this.heroId === 'amazon') {
            const mode = this.lastWeaponMode || 'spear';
            if (this.state === 'attack' || this.state === 'cast') {
                const isBow = (this.currentSkillType === 'arrow' || this.currentSkillType === 'arrow_basic' || this.currentSkillType === 'multishot');
                const isThrow = (this.currentSkillType === 'javelin_throw');
                const isSpear = (this.currentSkillType === 'jab' || this.currentSkillType === 'spear');
                if (isThrow) {
                    this.lastWeaponMode = 'spear';
                    if (this.sheets['attack_throw']) return this.sheets['attack_throw'];
                }
                if (isBow) {
                    this.lastWeaponMode = 'bow';
                    if (this.sheets['attack_bow']) return this.sheets['attack_bow'];
                }
                if (isSpear) {
                    this.lastWeaponMode = 'spear';
                    if (this.sheets['attack_spear']) return this.sheets['attack_spear'];
                }
                if (this.castTargetX !== null && this.castTargetY !== null) {
                    const dist = Math.hypot(this.castTargetX - this.x, (this.castTargetY - this.y) * 2);
                    if (dist <= 85) {
                        this.lastWeaponMode = 'spear';
                        if (this.sheets['attack_spear']) return this.sheets['attack_spear'];
                    } else {
                        if (this.sheets['attack_throw']) {
                            this.lastWeaponMode = 'spear';
                            return this.sheets['attack_throw'];
                        }
                        if (this.sheets['attack_bow']) {
                            this.lastWeaponMode = 'bow';
                            return this.sheets['attack_bow'];
                        }
                    }
                }
                if (this.sheets['attack_throw']) {
                    this.lastWeaponMode = 'spear';
                    return this.sheets['attack_throw'];
                }
                if (this.sheets['attack_spear']) {
                    this.lastWeaponMode = 'spear';
                    return this.sheets['attack_spear'];
                }
            } else if (this.state === 'idle') {
                return this.sheets['idle_' + mode] || this.sheets['idle'];
            } else if (this.state === 'walk') {
                return this.sheets['walk_' + mode] || this.sheets['walk'];
            } else if (this.state === 'run') {
                return this.sheets['run_' + mode] || this.sheets['run'];
            }
        }
        if (this.heroId === 'paladin') {
            const isSmite = (this.state === 'attack' || this.state === 'special1') && (this.currentSkillType === 'smite' || this.state === 'special1');
            if (isSmite && this.sheets['special1']) {
                return this.sheets['special1'];
            }
            if (this.sheets && this.sheets[this.state]) {
                return this.sheets[this.state];
            }
        }
        return this.sheets[this.state];
    }

    /**
     * 切換動作狀態
     */
    setState(newState) {
        if (this.state === newState) return;
        // 如果正在進行不可中斷的攻擊或施法動畫，不可隨意打斷 (引導施法時在放開滑鼠後自然收招)
        if ((this.state === 'attack' || this.state === 'cast') && !this.isActionFinished && !this.isChanneling) {
            return;
        }
        if (this.state === 'cast' && this.isChanneling && newState !== 'cast') {
            this.isChanneling = false;
        }

        this.state = newState;
        this.currentFrame = 0;
        this.frameCounter = 0;
        this.isActionFinished = false;

        if (this.heroId === 'amazon' && (newState === 'attack' || newState === 'cast')) {
            const isBow = (this.currentSkillType === 'arrow' || this.currentSkillType === 'arrow_basic' || this.currentSkillType === 'multishot');
            const isThrow = (this.currentSkillType === 'javelin_throw');
            const isSpear = (this.currentSkillType === 'jab' || this.currentSkillType === 'spear');
            if (isBow) {
                this.lastWeaponMode = 'bow';
            } else if (isThrow || isSpear) {
                this.lastWeaponMode = 'spear';
            }
        }

        // 觸發起手音效 (依循全域靜音與各職業專屬音效)
        if (newState === 'attack') {
            const heroConfig = this.heroSkills[this.heroId] || this.heroSkills.paladin;
            const skill = heroConfig.attacks ? heroConfig.attacks.find(a => a.id === this.currentSkillType) : null;
            if (skill && skill.sfx) {
                this.playSFXFile(skill.sfx, 0.55);
            } else if (this.currentSkillType === 'smite' || this.currentSkillType === 'bash') {
                this.playSFX(this.sfxSmite, 0.6);
            } else {
                this.playSFX(this.sfxSwing, 0.5);
            }
        } else if (newState === 'cast') {
            const heroConfig = this.heroSkills[this.heroId] || this.heroSkills.paladin;
            const skill = heroConfig.casts ? heroConfig.casts.find(c => c.id === this.currentSkillType) : null;
            if (skill && skill.sfx) {
                this.playSFXFile(skill.sfx, 0.6);
            } else if (this.currentSkillType === 'foh') {
                this.playSFX(this.sfxFohCast, 0.6);
            } else if (this.currentSkillType === 'holy_bolt') {
                this.playSFX(this.sfxHolyBolt, 0.55);
            } else {
                this.playSFX(this.sfxCast, 0.5);
            }
        }
    }

    /**
     * 切換走跑模式 (Shift 鍵或介面切換)
     */
    toggleRunMode() {
        this.isRunMode = !this.isRunMode;
        if (this.state === 'walk' && this.isRunMode) this.setState('run');
        if (this.state === 'run' && !this.isRunMode) this.setState('walk');
        return this.isRunMode;
    }

    setRunMode(run) {
        this.isRunMode = run;
        if (this.state === 'walk' && this.isRunMode) this.setState('run');
        if (this.state === 'run' && !this.isRunMode) this.setState('walk');
        return this.isRunMode;
    }

    /**
     * 切換常駐靈氣外觀 (狂熱 / 力量專注 / 聖火 / 聖衝 / 反抗 / 庇護所 / 無)
     */
    cycleAura() {
        const list = this.auraList;
        const idx = (list.indexOf(this.activeAura) + 1) % list.length;
        this.activeAura = list[idx];
        const title = this.getActiveAuraTitle();
        this.showFloatingPrompt(`靈氣切換: ${title}`, "#38bdf8");
        return title;
    }

    getActiveAuraTitle() {
        if (this.activeAura === 'none') return '無靈氣 (None) [Q]';
        const aura = this.fxAuras[this.activeAura];
        return aura ? `${aura.data.title} [Q]` : `${this.activeAura.toUpperCase()} [Q]`;
    }

    getActiveAuraName() {
        return this.activeAura;
    }

    /**
     * 下達移動指令至目標點 (滑鼠點擊)
     */
    moveTo(tx, ty, run = null, isAuto = false) {
        if (!isAuto && this.isAutoApproaching) {
            const curDist = Math.hypot(tx - (this.autoApproachTargetX || 0), ty - (this.autoApproachTargetY || 0));
            if (curDist > 25) {
                this.cancelMeleeAutoApproach();
            }
        }
        if (this.state === 'attack' || this.state === 'cast') return;
        this.targetX = tx;
        this.targetY = ty;
        if (run !== null) {
            this.isRunMode = run;
        }
        if (this.state !== 'attack' && this.state !== 'cast') {
            this.setState(this.isRunMode ? 'run' : 'walk');
        }
    }

    /**
     * 判定是否為近戰技能 (需靠近接敵方可發動打擊)
     */
    isMeleeSkill(skillId) {
        if (!skillId) return true;
        const meleeList = [
            'smite', 'zeal', 'slash', 'attack', 'normal_attack',
            'bash', 'double_swing', 'concentrate', 'frenzy', 'berserk',
            'jab', 'power_strike', 'impale', 'charged_strike', 'fend',
            'fists_of_fire', 'dragon_claw', 'cobra_strike', 'claws_of_thunder', 'dragon_tail', 'blades_of_ice', 'royal_strike',
            'poison_dagger', 'necro_dagger', 'staff_swing'
        ];
        return meleeList.includes(skillId);
    }

    /**
     * 檢驗近戰技能是否與目標處於有效打擊距離 (<= 85px 等軸測投影)
     */
    checkMeleeProximity(targetX = null, targetY = null) {
        if (targetX !== null && targetY !== null) {
            const clickDist = Math.hypot(targetX - this.x, (targetY - this.y) * 2);
            return clickDist <= 85;
        }
        let inRange = false;
        const targets = [];
        if (window.dungeonSandbox && window.dungeonSandbox.combatDirector && window.dungeonSandbox.combatDirector.monsters) {
            for (const m of window.dungeonSandbox.combatDirector.monsters) {
                if (!m.isDead && !m.remove) targets.push(m);
            }
        }
        if (window.__sandboxPlayer && window.__sandboxPlayer.dummies) {
            for (const d of window.__sandboxPlayer.dummies) {
                if (!d.isDead && !d.remove) targets.push(d);
            }
        }
        if (window.__paladinDummies) {
            for (const d of window.__paladinDummies) {
                if (!d.isDead && !d.remove) targets.push(d);
            }
        }
        for (const t of targets) {
            const dist = Math.hypot(t.x - this.x, (t.y - this.y) * 2);
            if (dist <= 85) {
                inRange = true;
                break;
            }
        }
        return inRange;
    }

    /**
     * 啟動近戰自動逼近 (Melee Auto-Approach)：
     * 當目標怪物或點擊位置超出近戰射程時，角色自動朝目標奔跑，進入 85px 範圍後自動拔刀/盾擊出招
     */
    startMeleeAutoApproach(targetX, targetY, skillId = 'smite', targetMonster = null) {
        this.isAutoApproaching = true;
        this.autoApproachSkill = skillId;
        this.autoApproachTargetX = targetX;
        this.autoApproachTargetY = targetY;
        this.autoApproachMonster = targetMonster;
        this.moveTo(targetX, targetY, true, true);
    }

    cancelMeleeAutoApproach() {
        this.isAutoApproaching = false;
        this.autoApproachMonster = null;
        this.autoApproachSkill = null;
    }

    /**
     * 檢驗近戰技能 (例如重擊 Smite) 是否與怪物處於近戰有效接觸距離 (<= 90px 等軸測投影)
     */
    checkSmiteProximity(targetX = null, targetY = null) {
        return this.checkMeleeProximity(targetX, targetY);
    }

    /**
     * 顯示即時浮動戰鬥提示文字 (警告或 Buff 提示)
     */
    showFloatingPrompt(text, color = '#f87171') {
        const director = (window.dungeonSandbox && window.dungeonSandbox.combatDirector) || window.d2CombatDirector;
        if (director && director.addFloatingText) {
            director.addFloatingText(this.x, this.y - 65, text, color);
        }
        if (window.__sandboxPlayer && window.__sandboxPlayer.addDamageText) {
            window.__sandboxPlayer.addDamageText(this.x, this.y - 65, text, color);
        }
        if (typeof window.addFloatingText === 'function') {
            window.addFloatingText(this.x, this.y - 65, text, color);
        }
    }

    /**
     * 下達攻擊指令 (滑鼠左鍵朝目標揮擊/射擊，依據當前職業技能池出招)
     */
    triggerAttack(targetX = null, targetY = null, skillTypeOverride = null) {
        if (targetX !== null && targetY !== null) {
            this.currentDir = this.directionController.getDirectionTowards(this.x, this.y, targetX, targetY, true);
            this.castTargetX = targetX;
            this.castTargetY = targetY;
        }
        this.targetX = null;
        this.targetY = null;

        let chosen = this.getActiveAttackSkill();
        if (skillTypeOverride) {
            chosen = { id: skillTypeOverride, name: this.currentSkillName || skillTypeOverride };
        }
        this.currentSkillType = chosen.id;
        this.currentSkillName = chosen.name;

        // 近戰技能自動逼近判定：若距離目標怪物/坐標超出近戰射程 (85px)，自動跑步過去再打
        if (this.isMeleeSkill(chosen.id) && targetX !== null && targetY !== null) {
            const dist = Math.hypot(targetX - this.x, (targetY - this.y) * 2);
            if (dist > 85) {
                let monster = null;
                if (window.dungeonSandbox && window.dungeonSandbox.combatDirector) {
                    monster = window.dungeonSandbox.combatDirector.findMonsterAt(targetX, targetY);
                }
                this.startMeleeAutoApproach(targetX, targetY, chosen.id, monster);
                return;
            }
        }

        if (this.heroId === 'amazon') {
            if (['magic_arrow', 'fire_arrow', 'cold_arrow', 'multishot', 'exploding_arrow', 'ice_arrow', 'guided_arrow', 'strafe', 'immolation_arrow', 'freezing_arrow'].includes(chosen.id)) {
                this.lastWeaponMode = 'bow';
            } else {
                this.lastWeaponMode = 'spear';
            }
        }

        // 聖騎士衝鋒 (Charge, Id 107)：F18 英雄位移突進，高速直線衝刺撞擊並附帶擊退
        if (chosen.id === 'charge') {
            const tx = (targetX !== null) ? targetX : (this.x + (this.currentDir === 12 ? -160 : 160));
            const ty = (targetY !== null) ? targetY : this.y;
            this.isCharging = true;
            this.chargeTargetX = tx;
            this.chargeTargetY = ty;
            this.currentDir = this.directionController.getDirectionTowards(this.x, this.y, tx, ty, true);
            this.setState('run');
            this.showFloatingPrompt("衝鋒突進！高速重擊撞破敵陣", "#38bdf8");
            return;
        }

        // 原廠旋風斬 (Whirlwind, Id 151)：Sequence 序列攻擊，直接進入旋轉位移，杜絕 SC 咆哮吼叫干擾
        if (chosen.id === 'whirlwind') {
            this.setState('attack');
            const director = (window.dungeonSandbox && window.dungeonSandbox.combatDirector) || window.d2CombatDirector;
            if (director && director.spawnHeroWhirlwind) {
                const tx = (targetX !== null) ? targetX : (this.x + (this.currentDir === 12 ? 160 : -160));
                const ty = (targetY !== null) ? targetY : this.y;
                director.spawnHeroWhirlwind(this.x, this.y, tx, ty);
            }
            return;
        }

        if (chosen.id === 'zeal') {
            this.zealStrikesRemaining = 5; // 熱誠五連斬 (F19 Multi-Strike Melee Chain)
        } else {
            this.zealStrikesRemaining = 0;
        }
        this.hasTriggeredSkill = false;
        this.setState('attack');
    }

    /**
     * 判定是否為引導類持續噴射法術 (地獄火 Inferno、極速冰刃 Arctic Blast 等)
     */
    isChanneledSkill(skillType) {
        return skillType === 'inferno' || skillType === 'arctic_blast' || skillType === '41';
    }

    /**
     * 更新引導法術之即時目標方位與朝向角度
     */
    updateChannelTarget(targetX, targetY) {
        if (!this.isChanneling) return;
        this.castTargetX = targetX;
        this.castTargetY = targetY;
        this.currentDir = this.directionController.getDirectionTowards(this.x, this.y, targetX, targetY, true);
    }

    /**
     * 停止引導法術 (放開右鍵時調用，使施法動作自然推進至收招幀回復 idle)
     */
    stopChanneling() {
        if (this.isChanneling) {
            this.isChanneling = false;
        }
    }

    /**
     * 下達施法指令 (滑鼠右鍵施放選定的專屬技能，支援 [E] 鍵在勾選技能排序中輪轉切換，亦支援自訂 skillTypeOverride)
     */
    triggerCast(targetX = null, targetY = null, skillTypeOverride = null) {
        if (targetX !== null && targetY !== null) {
            this.currentDir = this.directionController.getDirectionTowards(this.x, this.y, targetX, targetY, true);
            this.castTargetX = targetX;
            this.castTargetY = targetY;
        } else {
            const vec = this.directionController.getVectorForDirection(this.currentDir);
            this.castTargetX = this.x + vec.x * 140;
            this.castTargetY = this.y + vec.y * 140;
        }
        this.targetX = null;
        this.targetY = null;

        const chosen = skillTypeOverride ? { id: skillTypeOverride, name: skillTypeOverride } : this.getActiveCastSkill();
        this.currentSkillType = chosen.id;
        this.currentSkillName = chosen.name;

        if (this.isChanneledSkill(this.currentSkillType)) {
            this.isChanneling = true;
        } else {
            this.isChanneling = false;
        }

        if (this.heroId === 'amazon') {
            const isBow = ['fire_arrow', 'cold_arrow', 'multishot', 'exploding_arrow', 'ice_arrow', 'guided_arrow', 'strafe', 'immolation_arrow', 'freezing_arrow'].includes(chosen.id);
            const isThrow = ['poison_javelin', 'lightning_bolt', 'plague_javelin', 'lightning_fury'].includes(chosen.id);
            if (isBow) {
                this.lastWeaponMode = 'bow';
            } else if (isThrow) {
                this.lastWeaponMode = 'spear';
            }
        }

        this.hasTriggeredSkill = false;
        if (this.isMeleeSkill(chosen.id)) {
            if (targetX !== null && targetY !== null) {
                const dist = Math.hypot(targetX - this.x, (targetY - this.y) * 2);
                if (dist > 85) {
                    let monster = null;
                    if (window.dungeonSandbox && window.dungeonSandbox.combatDirector) {
                        monster = window.dungeonSandbox.combatDirector.findMonsterAt(targetX, targetY);
                    }
                    this.startMeleeAutoApproach(targetX, targetY, chosen.id, monster);
                    return;
                }
            }
            if (chosen.id === 'zeal') {
                this.zealStrikesRemaining = 5;
            } else {
                this.zealStrikesRemaining = 0;
            }
            this.setState('attack');
            return;
        } else if (chosen.id === 'charge') {
            const tx = (targetX !== null) ? targetX : (this.x + (this.currentDir === 12 ? -160 : 160));
            const ty = (targetY !== null) ? targetY : this.y;
            this.isCharging = true;
            this.chargeTargetX = tx;
            this.chargeTargetY = ty;
            this.currentDir = this.directionController.getDirectionTowards(this.x, this.y, tx, ty, true);
            this.setState('run');
            this.showFloatingPrompt("衝鋒突進！高速重擊撞破敵陣", "#38bdf8");
            return;
        } else if (chosen.id === 'holy_shield') {
            if (this.holyShieldActive) {
                this.deactivateHolyShield();
            } else {
                this.activateHolyShield();
            }
            this.setState('cast');
        } else {
            this.setState('cast');
        }
    }

    /**
     * 生成施法技能實體 (100% Blizzard 官方投射物圖集與物理模擬)
     */
    spawnCastSkill() {
        const director = (window.dungeonSandbox && window.dungeonSandbox.combatDirector) || window.d2CombatDirector;

        // 依據 AGENT.md 第 14 節原廠十二大體系路由分流 (Routing Gate)
        // 第二類地表環形波 (霜凍新星、電擊新星、戰吼) 與第三類地表氣旋 (龍捲風、小旋風) 100% 以腳底接地點 (Y原點) 為幾何基準
        const isGroundRootSkill = (
            this.currentSkillType === 'frost_nova' ||
            this.currentSkillType === 'nova' ||
            this.currentSkillType === 'poison_nova' ||
            this.currentSkillType === 'warcry' ||
            this.currentSkillType === 'tornado' ||
            this.currentSkillType === 'twister' ||
            this.currentSkillType === 'shockwave' ||
            this.currentSkillType === 'whirlwind' ||
            this.currentSkillType === 'thunder_storm'
        );

        let spawnX = this.x;
        let spawnY = this.y;

        if (!isGroundRootSkill) {
            // 第一類：空中手部/武器直射投射物 (胸膛 Y - 38px 基準面 + 手部面向外緣微調)
            spawnY = this.y - 38;
            if (window.D2_CAST_SOCKETS && window.D2_CAST_SOCKETS.getCastSocket) {
                const sock = window.D2_CAST_SOCKETS.getCastSocket(this.heroId, this.armorTier, this.currentDir);
                spawnX = this.x + sock.x;
                spawnY = this.y + sock.y;
            }
        }

        if (this.currentSkillType === 'hammer') {
            this.playSFX(this.sfxHammerLaunch, 0.6);

            const startAngle = this.directionController.DIR_CENTER_DEGREES[this.currentDir] * Math.PI / 180;
            this.hammers.push({
                originX: spawnX,
                originY: spawnY,
                angle: startAngle,
                radius: 16,
                spinAngle: 0,
                age: 0,
                maxAge: 72,
                trails: []
            });
        } else if (this.currentSkillType === 'foh') {
            this.playSFX(this.sfxFohImpact, 0.65);

            const tx = this.castTargetX || (this.x + 80);
            const ty = this.castTargetY || (this.y + 40);

            const strike = {
                x: tx,
                y: ty,
                progress: 0,
                maxProgress: 18,
                bolts: []
            };

            const boltCount = 6;
            for (let i = 0; i < boltCount; i++) {
                const angle = (i / boltCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
                const spd = 5.2 + Math.random() * 1.5;
                strike.bolts.push({
                    x: tx,
                    y: ty,
                    vx: Math.cos(angle) * spd,
                    vy: Math.sin(angle) * spd * 0.65,
                    angle: angle,
                    age: 0,
                    maxAge: 28,
                    trails: [],
                    hitMonsters: new Set()
                });
            }
            this.fohStrikes.push(strike);
        } else if (this.currentSkillType === 'holy_bolt') {
            const tx = this.castTargetX || (this.x + 100);
            const ty = this.castTargetY || (this.y - 38);
            const dx = tx - spawnX;
            const dy = ty - spawnY;
            const dist = Math.hypot(dx, dy) || 1;
            const spd = 10.5;
            const initPush = 16;
            const sx = spawnX + (dx / dist) * initPush;
            const sy = spawnY + (dy / dist) * initPush;

            this.holyBolts.push({
                x: sx,
                y: sy,
                vx: (dx / dist) * spd,
                vy: (dy / dist) * spd,
                age: 0,
                maxAge: 48,
                trails: [],
                hitMonsters: new Set()
            });
        } else if (this.currentSkillType === 'holy_shield') {
            this.activateHolyShield();
            if (director && director.spawnHeroHolyShield) {
                director.spawnHeroHolyShield(this.x, this.y);
            }
        } else {
            // 七大職業專屬法術優先調用自訂 onCastSkill 回調，或交由 CombatDirector 生成實體與碰撞
            if (typeof this.onCastSkill === 'function') {
                this.onCastSkill(this.currentSkillType, spawnX, spawnY, this.castTargetX, this.castTargetY, this.currentDir, this.x, this.y);
            } else if (director && director.spawnHeroSkill) {
                director.spawnHeroSkill(this.currentSkillType, spawnX, spawnY, this.castTargetX, this.castTargetY, this.currentDir, this.x, this.y);
            }
        }
    }

    /**
     * 生成揮砍/射箭攻擊實體特效
     */
    spawnAttackSkill() {
        const director = (window.dungeonSandbox && window.dungeonSandbox.combatDirector) || window.d2CombatDirector;
        const vec = this.directionController.getVectorForDirection(this.currentDir);
        const fx = this.x + vec.x * 24;
        const fy = this.y - 12 + vec.y * 18;

        // 依據 AGENT.md 第 14 節原廠標準：遠程武器 (弓箭、標槍) 統一以手部發射錨點出手
        let spawnX = this.x;
        let spawnY = this.y - 38;
        if (window.D2_CAST_SOCKETS && window.D2_CAST_SOCKETS.getCastSocket) {
            const sock = window.D2_CAST_SOCKETS.getCastSocket(this.heroId, this.armorTier, this.currentDir);
            spawnX = this.x + sock.x;
            spawnY = this.y + sock.y;
        }

        // 亞馬遜遠程速射箭矢
        if (this.currentSkillType === 'arrow' || this.currentSkillType === 'arrow_basic') {
            if (director && director.spawnHeroSkill) {
                director.spawnHeroSkill('arrow', spawnX, spawnY, this.castTargetX, this.castTargetY, this.currentDir);
            }
            return;
        }

        // 亞馬遜遠程標槍投擲
        if (this.currentSkillType === 'javelin_throw') {
            if (director && director.spawnHeroSkill) {
                director.spawnHeroSkill('javelin_throw', spawnX, spawnY, this.castTargetX, this.castTargetY, this.currentDir);
            }
            return;
        }

        // 亞馬遜近戰標槍戳刺 (Jab)
        if (this.currentSkillType === 'jab') {
            this.slashes.push({
                type: 'slash',
                x: fx,
                y: fy,
                dir: this.currentDir,
                age: 0,
                maxAge: 8,
                alpha: 1.0
            });
            if (director && director.onHeroMeleeAttack) {
                director.onHeroMeleeAttack(this.x, this.y, this.currentDir, 'jab');
            }
            return;
        }

        // 魔法使法術遠程直射 (火彈 / 冰彈 / 充能彈 / 火球)
        if (['fire_bolt', 'ice_bolt', 'charged_bolt', 'fireball', 'fireball_single'].includes(this.currentSkillType)) {
            if (director && director.spawnHeroSkill) {
                const sType = this.currentSkillType === 'fireball_single' ? 'fireball' : this.currentSkillType;
                director.spawnHeroSkill(sType, spawnX, spawnY, this.castTargetX, this.castTargetY, this.currentDir, this.x, this.y);
            }
            return;
        }

        if (this.currentSkillType === 'smite' || this.currentSkillType === 'bash') {
            // 重盾/重兵沉重衝擊
            this.slashes.push({
                type: 'smite',
                x: fx,
                y: fy,
                dir: this.currentDir,
                radius: 12,
                maxRadius: 40,
                age: 0,
                maxAge: 10,
                alpha: 1.0
            });
            if (director && director.onHeroMeleeAttack) {
                director.onHeroMeleeAttack(this.x, this.y, this.currentDir, 'smite');
            }
            // 觸發沙盒目標假人/怪物受擊與擊退
            const sandboxDummies = (window.__sandboxPlayer && window.__sandboxPlayer.dummies) || window.__paladinDummies || [];
            for (const d of sandboxDummies) {
                if (!d.isDead && !d.remove) {
                    const dist = Math.hypot(d.x - this.x, (d.y - this.y) * 2);
                    if (dist <= 90) {
                        d.takeDamage(55);
                        const rad = ((90 + this.currentDir * 22.5) % 360) * Math.PI / 180;
                        d.x += Math.cos(rad) * 25;
                        d.y += Math.sin(rad) * 12;
                        if (window.__sandboxPlayer && window.__sandboxPlayer.addDamageText) {
                            window.__sandboxPlayer.addDamageText(d.x, d.y - 45, "-55 盾擊擊退！", "#fbbf24");
                        } else if (window.addFloatingText) {
                            window.addFloatingText(d.x, d.y - 45, "-55 盾牌重擊！", "#fbbf24");
                        }
                        if (window.spawnHitOverlay) {
                            window.spawnHitOverlay(d.x, d.y, 'hit_shock');
                        }
                    }
                }
            }
            return;
        } else if (this.currentSkillType === 'zeal') {
            // 熱誠五連斬 (Zeal)：高速金色破空劍氣殘影與多段打擊
            const strikeNum = 6 - (this.zealStrikesRemaining || 1);
            this.slashes.push({
                type: 'zeal',
                x: fx + (Math.random() - 0.5) * 20,
                y: fy + (Math.random() - 0.5) * 14,
                dir: this.currentDir,
                age: 0,
                maxAge: 4,
                alpha: 1.0,
                strikeNum: strikeNum
            });
            this.playSFX(this.sfxSwing, 0.6);
            if (director && director.onHeroMeleeAttack) {
                director.onHeroMeleeAttack(this.x, this.y, this.currentDir, 'zeal');
            }
            return;
        } else {
            // 普通利刃揮斬 / 龍爪 / 爪擊
            this.slashes.push({
                type: 'slash',
                x: fx,
                y: fy,
                dir: this.currentDir,
                age: 0,
                maxAge: 6,
                alpha: 1.0
            });
        }

        // 近戰判定：對英雄面前近身怪物造成揮砍打擊
        if (director && director.onHeroMeleeAttack) {
            director.onHeroMeleeAttack(this.x, this.y, this.currentDir, this.currentSkillType || 'slash');
        }
    }

    /**
     * 25Hz 固定時間步長邏輯更新 (每 40ms 調用一次)
     */
    fixedTick(dtMs, tickIndex) {
        if (!this.isLoaded) return;

        this.prevX = this.x;
        this.prevY = this.y;

        const actionSheet = this.getCurrentActionSheet();
        const actionConfig = actionSheet?.data;
        if (!actionConfig) {
            // 防護：若動作貼圖缺失，強制推進並收招回歸 idle，避免狀態機卡死在 attack 或 cast
            if (this.state === 'cast' || this.state === 'attack') {
                if (!this.hasTriggeredSkill) {
                    this.hasTriggeredSkill = true;
                    if (this.state === 'cast') this.spawnCastSkill();
                    else this.spawnAttackSkill();
                }
                this.isActionFinished = true;
                this.setState('idle');
            }
            return;
        }

        // 0. 更新常駐靈氣動畫幀
        this.auraTick++;

        // 0.1 更新神聖之盾常駐動畫與持續計時
        if (this.holyShieldActive) {
            this.holyShieldTick++;
            if (this.holyShieldTimer > 0) {
                this.holyShieldTimer -= dtMs;
                if (this.holyShieldTimer <= 0) {
                    this.deactivateHolyShield();
                }
            }
        }

        // 0.2 處理衝鋒 (Charge) 物理推進與撞擊判定
        if (this.isCharging && this.chargeTargetX !== null && this.chargeTargetY !== null) {
            const dx = this.chargeTargetX - this.x;
            const dy = this.chargeTargetY - this.y;
            const dist = Math.hypot(dx, dy);
            const chargeSpeed = this.moveSpeedRun * 2.4;

            if (dist <= 45 || dist <= chargeSpeed) {
                this.x = this.chargeTargetX;
                this.y = this.chargeTargetY;
                this.isCharging = false;
                this.chargeTargetX = null;
                this.chargeTargetY = null;
                this.setState('attack');
                this.currentSkillType = 'charge';
                this.currentSkillName = '衝鋒';

                // 對目標點周圍怪物/木人造成巨額撞擊傷害與強效擊退
                const targets = [];
                const director = (window.dungeonSandbox && window.dungeonSandbox.combatDirector) || window.d2CombatDirector;
                if (director && director.monsters) {
                    for (const m of director.monsters) {
                        if (!m.isDead && !m.remove) targets.push(m);
                    }
                }
                const sandboxDummies = (window.__sandboxPlayer && window.__sandboxPlayer.dummies) || window.__paladinDummies || [];
                targets.push(...sandboxDummies);

                const rad = ((90 + this.currentDir * 22.5) % 360) * Math.PI / 180;
                for (const d of targets) {
                    if (!d.isDead && !d.remove) {
                        const dDist = Math.hypot(d.x - this.x, (d.y - this.y) * 2);
                        if (dDist <= 85) {
                            d.takeDamage(75);
                            d.x += Math.cos(rad) * 45;
                            d.y += Math.sin(rad) * 22;
                            if (director && director.spawnHitShock) {
                                director.spawnHitShock(d.x, d.y, 'hit_shock');
                            } else if (window.spawnHitOverlay) {
                                window.spawnHitOverlay(d.x, d.y, 'hit_shock');
                            }
                            if (director && director.addDamageNumber) {
                                director.addDamageNumber(d.x, d.y - 45, 75, false, '#f59e0b');
                            } else if (window.addFloatingText) {
                                window.addFloatingText(d.x, d.y - 45, "-75 衝鋒暴衝撞擊！", "#f59e0b");
                            }
                        }
                    }
                }
            } else {
                this.currentDir = this.directionController.getDirectionTowards(this.x, this.y, this.chargeTargetX, this.chargeTargetY, true);
                this.x += (dx / dist) * chargeSpeed;
                this.y += (dy / dist) * chargeSpeed;
                this.setState('run');
            }
        }

        // 0.3 近戰自動逼近推進與抵達出招 (Melee Auto-Approach)
        if (this.isAutoApproaching) {
            let tx = this.autoApproachTargetX;
            let ty = this.autoApproachTargetY;
            if (this.autoApproachMonster) {
                if (this.autoApproachMonster.isDead || this.autoApproachMonster.remove) {
                    this.isAutoApproaching = false;
                    this.autoApproachMonster = null;
                    this.setState('idle');
                } else {
                    tx = this.autoApproachMonster.x;
                    ty = this.autoApproachMonster.y;
                }
            }
            if (this.isAutoApproaching && tx !== null && ty !== null) {
                const dist = Math.hypot(tx - this.x, (ty - this.y) * 2);
                if (dist <= 85) {
                    // 已逼近至近戰有效攻擊射程！剎車並立即揮出技能
                    const skillToExecute = this.autoApproachSkill || 'smite';
                    const targetMon = this.autoApproachMonster;
                    this.isAutoApproaching = false;
                    this.autoApproachMonster = null;
                    this.targetX = null;
                    this.targetY = null;
                    this.currentDir = this.directionController.getDirectionTowards(this.x, this.y, tx, ty, true);
                    if (targetMon && !targetMon.isDead) {
                        this.meleeTargetMonster = targetMon;
                    }
                    this.triggerAttack(tx, ty, skillToExecute);
                } else if (this.state !== 'attack' && this.state !== 'cast') {
                    this.moveTo(tx, ty, true, true);
                }
            }
        }

        // 1. 處理移動物理
        if (this.targetX !== null && this.targetY !== null && this.state !== 'attack' && this.state !== 'cast' && !this.isCharging) {
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            const dist = Math.hypot(dx, dy);

            const speed = this.isRunMode ? this.moveSpeedRun : this.moveSpeedWalk;

            if (dist <= speed) {
                this.x = this.targetX;
                this.y = this.targetY;
                this.targetX = null;
                this.targetY = null;
                this.setState('idle');
            } else {
                this.currentDir = this.directionController.getDirectionTowards(this.x, this.y, this.targetX, this.targetY);
                this.x += (dx / dist) * speed;
                this.y += (dy / dist) * speed;
                this.setState(this.isRunMode ? 'run' : 'walk');
            }
        }

        // 2. 更新動畫幀 (依據原廠動作專屬 fps 進行時間累加推進，徹底根除 25Hz 鬼畜滑步)
        const totalFrames = actionConfig.frames || 8;
        let targetFps = actionConfig.fps || 14;
        if (this.state === 'cast') {
            targetFps = 25; // 依循原廠 D2 MPQ 25Hz 施法幀率 (擺脫 16 FPS 拖泥帶水卡頓)
        } else if (this.currentSkillType === 'zeal') {
            targetFps = 48; // 熱誠五連斬 (Zeal) 極速五連擊 (48 FPS，速度加快 2 倍)
        }
        const frameIntervalMs = 1000 / targetFps;
        this.frameAccumulator = (this.frameAccumulator || 0) + dtMs;

        while (this.frameAccumulator >= frameIntervalMs) {
            this.frameAccumulator -= frameIntervalMs;
            this.currentFrame++;

            // 計算釋放命中幀 (依循各職業 authentic releaseFrame 數據)
            let triggerFrame = Math.min(2, Math.max(1, totalFrames - 1));
            if (this.currentSkillType === 'smite') {
                triggerFrame = 6; // 重擊盾牌前衝撞擊峰值幀 (第 6 幀)
            } else if (this.currentSkillType === 'zeal') {
                triggerFrame = Math.max(1, Math.min(3, Math.floor(totalFrames * 0.35))); // 白熱快速出劍打擊幀
            } else if (this.currentSkillType === 'javelin_throw') {
                triggerFrame = Math.min(10, totalFrames - 1);
            } else if (this.currentSkillType === 'arrow' || this.currentSkillType === 'arrow_basic' || this.currentSkillType === 'multishot') {
                triggerFrame = Math.min(8, totalFrames - 1);
            } else if (this.state === 'cast') {
                if (window.D2_CAST_SOCKETS && window.D2_CAST_SOCKETS.getReleaseFrame) {
                    triggerFrame = window.D2_CAST_SOCKETS.getReleaseFrame(this.heroId, this.armorTier);
                } else {
                    triggerFrame = Math.min(8, Math.max(5, Math.floor(totalFrames * 0.45)));
                }
            }

            // 施法動作推進到觸發幀生成技能實體
            if (this.state === 'cast') {
                if (this.isChanneling) {
                    const channelFrame = (this.heroId === 'sorceress') ? 8 : triggerFrame;
                    if (this.currentFrame >= channelFrame) {
                        // 手往前固定在施法釋放幀，零抖動穩定引導
                        this.currentFrame = channelFrame;
                        if (this.castTargetX !== null && this.castTargetY !== null) {
                            this.currentDir = this.directionController.getDirectionTowards(this.x, this.y, this.castTargetX, this.castTargetY, true);
                        }
                        this.spawnCastSkill();
                    }
                } else if (this.currentFrame >= triggerFrame && !this.hasTriggeredSkill) {
                    this.hasTriggeredSkill = true;
                    this.spawnCastSkill();
                }
            }

            // 揮砍/攻擊動作推進到觸發幀生成攻擊特效
            if (this.state === 'attack' && this.currentFrame >= triggerFrame && !this.hasTriggeredSkill) {
                this.hasTriggeredSkill = true;
                this.spawnAttackSkill();
            }

            if (this.currentFrame >= totalFrames) {
                if (actionConfig.loop) {
                    this.currentFrame = 0;
                } else if (this.currentSkillType === 'zeal' && this.zealStrikesRemaining > 1) {
                    // 熱誠五連斬 (F19 Multi-Strike Melee Chain)：繼續推進下一擊！
                    this.zealStrikesRemaining--;
                    this.currentFrame = 0;
                    this.hasTriggeredSkill = false;
                    if (this.meleeTargetMonster && !this.meleeTargetMonster.isDead && !this.meleeTargetMonster.remove) {
                        this.currentDir = this.directionController.getDirectionTowards(this.x, this.y, this.meleeTargetMonster.x, this.meleeTargetMonster.y, true);
                    }
                } else {
                    this.currentFrame = totalFrames - 1;
                    this.isActionFinished = true;
                    this.zealStrikesRemaining = 0;
                    this.setState('idle');
                    break;
                }
            }
        }

        // 3. 推進祝聖之槌 (阿基米德螺旋線)
        for (let i = this.hammers.length - 1; i >= 0; i--) {
            const h = this.hammers[i];
            h.age++;

            const curX = h.originX + Math.cos(h.angle) * h.radius;
            const curY = h.originY + Math.sin(h.angle) * (h.radius * 0.55);
            h.trails.push({ x: curX, y: curY, alpha: 0.9 });
            if (h.trails.length > 7) h.trails.shift();

            h.radius += 3.8;
            h.angle += 0.24;
            h.spinAngle += 0.45;
            h.trails.forEach(t => t.alpha -= 0.12);

            if (h.age >= h.maxAge) {
                this.hammers.splice(i, 1);
            }
        }

        // 4. 推進天堂之拳 (落雷天降與地面散彈)
        for (let i = this.fohStrikes.length - 1; i >= 0; i--) {
            const s = this.fohStrikes[i];
            s.progress++;

            for (let j = s.bolts.length - 1; j >= 0; j--) {
                const b = s.bolts[j];
                b.age++;
                b.trails.push({ x: b.x, y: b.y, alpha: 0.8 });
                if (b.trails.length > 5) b.trails.shift();

                b.x += b.vx;
                b.y += b.vy;
                b.trails.forEach(t => t.alpha -= 0.14);

                if (b.age >= b.maxAge) {
                    s.bolts.splice(j, 1);
                }
            }

            if (s.progress >= s.maxProgress && s.bolts.length === 0) {
                this.fohStrikes.splice(i, 1);
            }
        }

        // 5. 推進聖光彈
        for (let i = this.holyBolts.length - 1; i >= 0; i--) {
            const b = this.holyBolts[i];
            b.age++;
            b.trails.push({ x: b.x, y: b.y, alpha: 0.85 });
            if (b.trails.length > 7) b.trails.shift();

            b.x += b.vx;
            b.y += b.vy;
            b.trails.forEach(t => t.alpha -= 0.12);

            if (b.age >= b.maxAge) {
                this.holyBolts.splice(i, 1);
            }
        }

        // 6. 推進刀芒殘影
        for (let i = this.slashes.length - 1; i >= 0; i--) {
            const sl = this.slashes[i];
            sl.age++;
            if (sl.type === 'smite') {
                sl.radius += 3.0;
                sl.alpha -= 0.1;
            } else if (sl.type === 'zeal') {
                sl.alpha -= 0.25;
            } else {
                sl.alpha -= 0.15;
            }
            if (sl.age >= sl.maxAge || sl.alpha <= 0) {
                this.slashes.splice(i, 1);
            }
        }
    }

    /**
     * 鍵盤 WASD 直接驅動移動向量
     */
    /**
     * 鍵盤 WASD 直接驅動移動向量 (依循全域 isRunMode 走跑狀態)
     */
    handleKeyboardInput(keys) {
        if (this.state === 'attack' || this.state === 'cast') return;

        const dir = this.directionController.getDirectionFromKeys(keys);
        if (dir !== null) {
            this.cancelMeleeAutoApproach();
            this.targetX = null;
            this.targetY = null;
            this.currentDir = dir;

            const speed = this.isRunMode ? this.moveSpeedRun : this.moveSpeedWalk;

            const vec = this.directionController.getVectorForDirection(dir);
            this.x += vec.x * speed;
            this.y += vec.y * speed;

            this.setState(this.isRunMode ? 'run' : 'walk');
        } else if (this.targetX === null && (this.state === 'walk' || this.state === 'run')) {
            this.setState('idle');
        }
    }

    /**
     * 畫面渲染 (零模糊光暈、銳利金屬質感與官方精靈圖集演繹)
     */
    render(ctx, alpha = 1.0) {
        if (!this.isLoaded) return;

        const renderX = this.prevX + (this.x - this.prevX) * alpha;
        const renderY = this.prevY + (this.y - this.prevY) * alpha;

        // 1. 繪製角色腳底暗黑經典微弱地面陰影
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(renderX, renderY - 2, 22, 10, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fill();
        ctx.restore();

        // 2. 繪製角色腳底正統靈氣 - 後半環 (Back Layer，層級位於角色腳跟後方)
        this.renderActiveAuraBack(ctx, renderX, renderY);

        // 3. 繪製角色本體精靈圖 (身周 100% 純淨，站立於靈氣中心)
        const sheetInfo = this.getCurrentActionSheet();
        if (sheetInfo && sheetInfo.img && sheetInfo.img.complete && sheetInfo.img.naturalWidth > 0) {
            const img = sheetInfo.img;
            const cfg = sheetInfo.data;

            const cellW = cfg.cell_width;
            const cellH = cfg.cell_height;
            const anchorX = cfg.anchor_x;
            const anchorY = cfg.anchor_y;

            const sx = Math.min(this.currentFrame, cfg.frames - 1) * cellW;
            const sy = Math.min(this.currentDir, cfg.directions - 1) * cellH;

            const destX = Math.round(renderX - anchorX);
            const destY = Math.round(renderY - anchorY);

            ctx.drawImage(img, sx, sy, cellW, cellH, destX, destY, cellW, cellH);
        }

        // 4. 繪製角色腳底正統靈氣 - 前半環 (Front Layer，環繞包覆於腳尖前，使角色完美立於靈氣正中心)
        this.renderActiveAuraFront(ctx, renderX, renderY);

        // 5. 繪製打擊命中特效 (100% 原版震盪精靈圖，零弧線手繪)
        this.renderSlashes(ctx);

        // 6. 繪製祝聖之槌飛彈與螺旋殘影 (100% Blizzard 官方 16 方向旋轉圖集)
        this.renderHammers(ctx);

        // 7. 繪製聖光彈飛彈 (100% Blizzard 官方 HolyBoltMissile 精靈圖集)
        this.renderHolyBolts(ctx);

        // 8. 繪製天堂之拳天降神聖光柱 (100% Blizzard 官方 HandOfGod 天降光柱圖集)
        this.renderFohStrikes(ctx);

        // 9. 繪製神聖之盾常駐流動光華與原廠 Gleam 精靈圖 (依使用者指示常駐流動特效)
        this.renderHolyShield(ctx, renderX, renderY);
    }

    /**
     * 繪製神聖之盾開啟後之常駐流光特效 (Gleam.png 原廠星芒 + 神聖金色光輝護盾)
     */
    renderHolyShield(ctx, renderX, renderY) {
        if (!this.holyShieldActive) return;
        if (this.heroId !== 'paladin') return;

        const isSmite = (this.state === 'attack' || this.state === 'special1') && (this.currentSkillType === 'smite' || this.state === 'special1');

        // 原廠 Gleam.png 星芒精靈圖 (21x23, 8 幀) 於神聖盾面上持續流轉閃爍 (手盾本體已在一體圖集中，0 脫手飛走)
        if (this.imgGleam && this.imgGleam.complete && this.imgGleam.naturalWidth > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';

            // 16 方向盾牌中心相對腳底坐標精確定位
            const dirOffsets = [
                { dx:  12, dy: -38 }, // 0 S: 盾牌在角色左手(畫面右側)
                { dx:   8, dy: -39 }, // 1 SSW: 順時針轉動
                { dx:   4, dy: -40 }, // 2 SW: 西南
                { dx:  -4, dy: -41 }, // 3 WSW: 西南西
                { dx: -14, dy: -41 }, // 4 W: 正西，盾牌在身前正對左方
                { dx: -16, dy: -41 }, // 5 WNW: 西北西
                { dx: -16, dy: -42 }, // 6 NW: 西北
                { dx: -15, dy: -41 }, // 7 NNW: 北北西
                { dx: -14, dy: -40 }, // 8 N: 正北背向，左手盾牌位於左側
                { dx: -10, dy: -42 }, // 9 NNE: 北北東
                { dx:   6, dy: -43 }, // 10 NE: 東北，盾牌轉至身後右側
                { dx:   8, dy: -42 }, // 11 ENE: 東北東
                { dx:  10, dy: -42 }, // 12 E: 正東，面向正右，左手盾牌位於右側
                { dx:  12, dy: -40 }, // 13 ESE: 東南東
                { dx:  13, dy: -39 }, // 14 SE: 東南
                { dx:  14, dy: -38 }  // 15 SSE: 南南東
            ];
            const off = dirOffsets[this.currentDir] || { dx: 12, dy: -38 };
            let gx = Math.round(renderX + off.dx);
            let gy = Math.round(renderY + off.dy);

            if (isSmite) {
                const rad = ((90 + this.currentDir * 22.5) % 360) * Math.PI / 180;
                const thrust = Math.sin((this.currentFrame / 11) * Math.PI) * 16;
                gx += Math.round(Math.cos(rad) * thrust);
                gy += Math.round(Math.sin(rad) * (thrust * 0.55));
            }

            const frame = Math.floor(this.holyShieldTick * 0.4) % 8;
            const cw = 21, ch = 23;
            ctx.drawImage(this.imgGleam, frame * cw, 0, cw, ch, gx - 10, gy - 11, cw, ch);
            const frame2 = (frame + 4) % 8;
            ctx.globalAlpha = 0.65;
            ctx.drawImage(this.imgGleam, frame2 * cw, 0, cw, ch, gx - 8, gy - 16, cw, ch);
            ctx.restore();
        }
    }

    /**
     * 繪製角色腳底常駐正統地表靈氣 - 後半層 (Back Layer)
     */
    renderActiveAuraBack(ctx, renderX, renderY) {
        if (!this.activeAura || this.activeAura === 'none') return;
        const aura = this.fxAuras[this.activeAura];
        if (!aura || !aura.backImg || !aura.backImg.complete || aura.backImg.naturalWidth === 0) return;

        const totalFrames = aura.data.frames || 15;
        const frameIdx = Math.floor(this.auraTick * 0.5) % totalFrames;
        const cw = aura.data.cell_width;
        const ch = aura.data.cell_height;
        const px = aura.data.pivot_x;
        const py = aura.data.pivot_y;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(
            aura.backImg,
            frameIdx * cw, 0, cw, ch,
            Math.round(renderX - px), Math.round(renderY - py), cw, ch
        );
        ctx.restore();
    }

    /**
     * 繪製角色腳底常駐正統地表靈氣 - 前半層 (Front Layer)
     */
    renderActiveAuraFront(ctx, renderX, renderY) {
        if (!this.activeAura || this.activeAura === 'none') return;
        const aura = this.fxAuras[this.activeAura];
        if (!aura || !aura.frontImg || !aura.frontImg.complete || aura.frontImg.naturalWidth === 0) return;

        const totalFrames = aura.data.frames || 15;
        const frameIdx = Math.floor(this.auraTick * 0.5) % totalFrames;
        const cw = aura.data.cell_width;
        const ch = aura.data.cell_height;
        const px = aura.data.pivot_x;
        const py = aura.data.pivot_y;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(
            aura.frontImg,
            frameIdx * cw, 0, cw, ch,
            Math.round(renderX - px), Math.round(renderY - py), cw, ch
        );
        ctx.restore();
    }

    /**
     * 繪製打擊命中特效 (100% 取自 Blizzard ShockHitSm 震盪精靈圖，加法混色)
     */
    renderSlashes(ctx) {
        if (!this.slashes || this.slashes.length === 0) return;
        const sheet = this.fxSheets['hit_shock'];
        if (!sheet || !sheet.img || !sheet.img.complete || sheet.img.naturalWidth === 0) return;

        const cw = sheet.data.cell_width;
        const ch = sheet.data.cell_height;
        const px = sheet.data.pivot_x;
        const py = sheet.data.pivot_y;
        const totalFrames = sheet.data.frames || 20;

        for (const sl of this.slashes) {
            const frameIdx = Math.min(Math.floor(sl.age * 2), totalFrames - 1);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = sl.alpha;
            ctx.drawImage(sheet.img, frameIdx * cw, 0, cw, ch, Math.round(sl.x - px), Math.round(sl.y - py), cw, ch);
            ctx.restore();
        }
    }

    /**
     * 繪製祝聖之槌 (100% Blizzard blessedhammer 原版 16 方向旋轉精靈圖，金色真槌)
     */
    renderHammers(ctx) {
        if (!this.hammers || this.hammers.length === 0) return;
        const sheet = this.fxSheets['hammer'];
        if (!sheet || !sheet.img || !sheet.img.complete || sheet.img.naturalWidth === 0) return;

        const cw = sheet.data.cell_width;
        const ch = sheet.data.cell_height;
        const px = sheet.data.pivot_x;
        const py = sheet.data.pivot_y;
        const totalDirs = sheet.data.directions || 16;
        const totalFrames = sheet.data.frames || 6;

        for (const h of this.hammers) {
            const hx = h.originX + Math.cos(h.angle) * h.radius;
            const hy = h.originY + Math.sin(h.angle) * (h.radius * 0.55);

            // 依據螺旋前進角度分配 16 方向 (0 ~ 15)
            const normAngle = ((h.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            const dirIdx = Math.floor((normAngle / (Math.PI * 2)) * totalDirs) % totalDirs;
            const frameIdx = Math.floor(h.age * 0.6) % totalFrames;

            // 繪製殘影拖尾 (使用官方真實圖集半透明殘影)
            for (let i = 0; i < h.trails.length; i++) {
                const tr = h.trails[i];
                if (tr.alpha <= 0) continue;
                ctx.save();
                ctx.globalAlpha = tr.alpha * 0.35;
                ctx.drawImage(sheet.img, frameIdx * cw, dirIdx * ch, cw, ch, Math.round(tr.x - px), Math.round(tr.y - py), cw, ch);
                ctx.restore();
            }

            // 繪製本體金色戰槌
            ctx.save();
            ctx.drawImage(sheet.img, frameIdx * cw, dirIdx * ch, cw, ch, Math.round(hx - px), Math.round(hy - py), cw, ch);
            ctx.restore();
        }
    }

    /**
     * 繪製聖光彈 (100% Blizzard HolyBoltMissile 原版精靈圖，加法透明混色，無扭曲旋轉)
     */
    renderHolyBolts(ctx) {
        if (!this.holyBolts || this.holyBolts.length === 0) return;
        const sheet = this.fxSheets['holybolt'];
        if (!sheet || !sheet.img || !sheet.img.complete || sheet.img.naturalWidth === 0) return;

        const cw = sheet.data.cell_width;
        const ch = sheet.data.cell_height;
        const px = sheet.data.pivot_x;
        const py = sheet.data.pivot_y;
        const totalFrames = sheet.data.frames || 16;

        for (const b of this.holyBolts) {
            const frameIdx = Math.floor(b.age * 0.8) % totalFrames;

            // 繪製殘影尾跡
            for (let i = 0; i < b.trails.length; i++) {
                const tr = b.trails[i];
                if (tr.alpha <= 0) continue;
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = tr.alpha * 0.35;
                ctx.drawImage(sheet.img, frameIdx * cw, 0, cw, ch, Math.round(tr.x - px), Math.round(tr.y - py), cw, ch);
                ctx.restore();
            }

            // 繪製本體聖光彈 (神聖結晶光球，加法混色)
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.drawImage(sheet.img, frameIdx * cw, 0, cw, ch, Math.round(b.x - px), Math.round(b.y - py), cw, ch);
            ctx.restore();
        }
    }

    /**
     * 繪製天堂之拳 (100% Blizzard HandOfGod 天降神聖光柱原版精靈圖，加法透光)
     */
    renderFohStrikes(ctx) {
        if (!this.fohStrikes || this.fohStrikes.length === 0) return;
        const sheet = this.fxSheets['foh'];
        const holyBoltSheet = this.fxSheets['holybolt'];
        if (!sheet || !sheet.img || !sheet.img.complete || sheet.img.naturalWidth === 0) return;

        const cw = sheet.data.cell_width;
        const ch = sheet.data.cell_height;
        const px = sheet.data.pivot_x;
        const py = sheet.data.pivot_y;
        const totalFrames = sheet.data.frames || 21;

        for (const s of this.fohStrikes) {
            const frameIdx = Math.min(s.progress, totalFrames - 1);

            // A. 天降神聖雷霆與地面衝擊爆炸 (加法混色消除黑邊)
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.drawImage(sheet.img, frameIdx * cw, 0, cw, ch, Math.round(s.x - px), Math.round(s.y - py), cw, ch);
            ctx.restore();

            // B. 地面散射神聖聖光彈 (100% Blizzard 官方 HolyBoltMissile 精靈圖集)
            if (holyBoltSheet && holyBoltSheet.img && holyBoltSheet.img.complete && holyBoltSheet.img.naturalWidth > 0) {
                const hbw = holyBoltSheet.data.cell_width;
                const hbh = holyBoltSheet.data.cell_height;
                const hbpx = holyBoltSheet.data.pivot_x;
                const hbpy = holyBoltSheet.data.pivot_y;
                const hbFrames = holyBoltSheet.data.frames || 16;

                for (const b of s.bolts) {
                    const hbFrame = Math.floor(b.age * 0.8) % hbFrames;
                    const alpha = Math.max(0, 1.0 - (b.age / b.maxAge));

                    // 1. 聖光殘影尾跡
                    for (let tIdx = 0; tIdx < b.trails.length; tIdx++) {
                        const tr = b.trails[tIdx];
                        if (tr.alpha <= 0) continue;
                        ctx.save();
                        ctx.globalCompositeOperation = 'lighter';
                        ctx.globalAlpha = tr.alpha * 0.3 * alpha;
                        ctx.translate(tr.x, tr.y);
                        ctx.rotate(b.angle);
                        ctx.drawImage(holyBoltSheet.img, hbFrame * hbw, 0, hbw, hbh, -hbpx * 0.65, -hbpy * 0.65, hbw * 0.65, hbh * 0.65);
                        ctx.restore();
                    }

                    // 2. 本體聖光彈 (星芒放射飛行)
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.globalAlpha = alpha;
                    ctx.translate(b.x, b.y);
                    ctx.rotate(b.angle);
                    ctx.drawImage(holyBoltSheet.img, hbFrame * hbw, 0, hbw, hbh, -hbpx * 0.75, -hbpy * 0.75, hbw * 0.75, hbh * 0.75);
                    ctx.restore();
                }
            }
        }
    }
}

window.CharacterController = CharacterController;

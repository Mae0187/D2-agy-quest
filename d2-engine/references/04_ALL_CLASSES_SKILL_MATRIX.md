# ⚔️ All Seven Classes Official Skill Parameter Matrix (04_ALL_CLASSES_SKILL_MATRIX.md)

This document integrates Blizzard's official `Skills.txt`, `Missiles.txt`, and `Overlay.txt`, cross-referenced with the visual behaviors from [The Arreat Summit](https://classic.battle.net/diablo2exp/skills/alphaskills.shtml) and [DiabloWiki (NetEase)](https://wiki.d.163.com/index.php?title=%E5%88%86%E7%B1%BB:%E6%9A%97%E9%BB%912_%E6%8A%80%E8%83%BD), providing standard parameter matrices for the core skills of all seven classes.

---

## I. Sorceress

### 1. Cold Spells
| Skill (ZH) | Skill (EN) | Skill ID | Missile ID | MPQ Asset | Pattern | Release Frame | Vel | Range | Characteristics & Visual Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **冰彈** | Ice Bolt | 67 | 73 | `icebolt` | A | 7 | 18 | 40 | Linear constant-velocity ice shard missile; freezes single target on hit; no explosion |
| **冰霜新星** | Frost Nova | 73 | 77 | `frostnova` | C | 7 | 8 | 15 | 24 ice shards expanding outward in a 360-degree ring; isometric elliptical dispersion |
| **冰風暴** | Ice Blast | 75 | 78 | `iceblast` | A | 7 | 22 | 45 | High-velocity straight-flying chilled vortex; explodes into ice shards on impact |
| **冰封甲** | Frozen Armor | 68 | - | `frozenarmor` | - | 7 | - | - | Rotating ice armor aura orbiting character body (`PreDraw: 0`) |
| **冰川之刺** | Glacial Spike | 85 | 92 | `glacialspike` | A | 7 | 24 | 50 | Heavy icicle comet; triggers a 60px ice explosion AoE upon impact |
| **暴風雪** | Blizzard | 89 | 94 | `blizzard` | D | 7 | 16 | 20 | Overhead ice cloud ➔ vertically falling sharp icicles ➔ ground ice shards splashing |
| **冰封球** | Frozen Orb | 95 | 99 | `frozenorb` | A | 7 | 10 | 60 | Rotating mother orb flying linearly; spirally shoots 16 ice bolts along path; nova explosion at lifespan end |

### 2. Lightning Spells
| Skill (ZH) | Skill (EN) | Skill ID | Missile ID | MPQ Asset | Pattern | Release Frame | Vel | Range | Ground Truth Reference | Characteristics & Visual Ironclad Rules |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **充能彈** | Charged Bolt | 38 | 56 | `chargedbolt` | A / Erratic | 7 | 12 | 98 | `sorceress/chargedbolt01.gif` | 7–24 electrical sparks jittering along random jagged lines within a cone; 2.5D isometric ground-crawling twitch |
| **靜態力場** | Static Field | 42 | - | - | C | 7 | - | - | - | Instantaneous full-screen electric pulse flash; reduces current HP of enemies in radius by 25% |
| **心靈傳動** | Telekinesis | 43 | - | - | - | 7 | - | - | - | Ranged intangible telekinetic strike causing subtle knockback and stun |
| **新星** | Nova | 48 | 90 | `ElectricNova` | F (F06) | 7 | 24 | 13 | `sorceress/nova_163.jpg` | **[Solid Seamless Closed Ring Rule]** Per `cltdofunc: 25` / `pCltDoFunc: 1`, spawn origin locks to foot contact anchor (Y-0); 64 child missiles advance radially at uniform velocity; adjacent sprites densely overlap under additive blending (`lighter`), fusing into a solid concentric halo with a pure white core and electric blue outer glow |
| **閃電** | Lightning | 49 | 98 | `lightningbolt` / `LightningStrike` | G (F09) | 7 | 30 | 25 | `sorceress/lightning01.gif` | **[Continuous High-Voltage Beam Rule]** Per `pCltDoFunc: 8` (`Subloops: 3`), fires a screen-penetrating high-voltage straight lightning beam from the chest, piercing through all enemies along its path without gaps |
| **連鎖閃電** | Chain Lightning | 53 | 93 | `LightningStrike` | G (F09) | 7 | 30 | 25 | `sorceress/chain_lightning_163.jpg` | **[Continuous Arc Chain from Staff to Targets Rule]** Per `pCltDoFunc: 8` (`Subloops: 3`) and `pCltHitFunc: 16`, endpoints continuously snap, refract, and leap; drawn directly from the staff to target 1, then seamlessly bolted to target 2, connected head-to-tail throughout; triggers authentic 20-frame `ShockHitSm` at refraction points |
| **傳送** | Teleport | 54 | 97 | `Teleport` | Displacement | 7 | - | - | - | Instantly spawns electric afterimages at origin and destination, displacing and reassembling |
| **雷暴** | Thunder Storm | 57 | 166 | `ThunderstormCast_operate` + `LightningboltBig` | D / Dual-Layer | 7 | - | 300 | `sorceress/thunder_storm_163.jpg` | **[Dual-Layer Separation Rule]** 1) 19-frame rotating electric ring at feet (`PreDraw: 1` and `Height: 0`, rendered under hero feet, rotating in-place with 0 wobble); 2) Periodically strikes a pure white vertical thunderbolt down from the zenith, triggering `ShockHitSm` on ground contact |
| **能量護盾** | Energy Shield | 58 | - | `ManaShieldBall` | Shield | 7 | - | 3600 | - | Per `states.txt` mapped to `Overlay.txt`, a golden shield orb floating and rotating around the character body/head (`PreDraw: 0`) |
| **支配閃電** | Lightning Mastery | 63 | - | - | Passive | - | - | - | - | Passive numeric bonus, permanently and massively increasing lightning spell damage; requires no animation |

### 3. Fire Spells
| Skill (ZH) | Skill (EN) | Skill ID | Missile ID | MPQ Asset | Pattern | Release Frame | Vel | Range | Characteristics & Visual Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **火彈** | Fire Bolt | 58 | 58 | `firebolt` | A | 7 | 18 | 60 | Linear single-target fire missile; disappears upon collision; no explosion |
| **熱情** | Warmth | 37 | - | - | - | - | - | - | Passive mana regeneration |
| **地獄火** | Inferno | 60 | 60/61 | `Flamethrower` | B | 7 | 12 | 30 | Channeled cone stream of dense flame particles, piercing multiple targets |
| **火球** | Fireball | 62 | 62 | `fireball` | A | 7 | 16 | 55 | Linear constant-velocity large fireball; collision triggers an 80px AoE explosion |
| **火牆** | Fire Wall | 69 | 69 | `groundFireBig` | C | 7 | - | 90 | Deploys 7 large ground fire columns perpendicular to casting line in 2:1 isometric geometry (3.6s) |
| **隕石** | Meteor | 72 | 240 | `Meteor` | D | 7 | - | 30 | Ground red warning cue ➔ giant boulder with trailing fire swooping from upper right ➔ massive 210x176 explosion ➔ medium residual fire |
| **九頭海蛇** | Hydra | 64 | 339 | `HXTR` + `HXS1` | E | 8 | 14 | 30 | Triangular isometric 3 hydra heads wrapped in dual-layer ground flames, spitting fire bolts from mouth in 8 directions (10s) |

---

## II. Paladin

| Skill (ZH) | Skill (EN) | Skill ID | MPQ Asset | Pattern | Action | Release Frame | Characteristics & Visual Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **聖光彈** | Holy Bolt | 101 | `holybolt` | A | SC | 8 | Straight-flying holy projectile; damages undead or heals allies |
| **祝福之槌** | Blessed Hammer | 112 | `blessedhammer` | - | SC | 8 | Clockwise logarithmic spiral expansion trajectory ($r = a + b\theta$); pierces obstacles |
| **天堂之拳** | Fist of the Heavens | 121 | `fistoftheheavens` | D | SC | 8 | Holy lightning column descending from the heavens; splits upon landing into 5 outward-dispersing holy bolts |
| **神聖火焰** | Holy Fire | 102 | `auraholyfire` | C | - | - | Dual-layer circular fire aura at feet (`PreDraw: 1` underlay + `PreDraw: 0` foreground ring); periodic pulsation |
| **狂熱靈氣** | Fanaticism | 122 | `aurafanaticism` | C | - | - | Red runic circle rotating clockwise on the ground |

---

## III. Necromancer

| Skill (ZH) | Skill (EN) | Skill ID | MPQ Asset | Pattern | Action | Release Frame | Characteristics & Visual Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **牙** | Teeth | 67 | `teeth` | A | SC | 8 | 7 bone missiles spreading forward in a $\pm 28^\circ$ fan; disappears upon single-target impact |
| **骨矛** | Bone Spear | 84 | `bonespear` | A | SC | 8 | High-velocity straight-flying bone spear; pierces all enemy monsters along its path |
| **屍體爆炸** | Corpse Explosion | 74 | `corpseexplode` | C | SC | 8 | Detonates monster corpses on the ground, creating a wide-area blood and gore shockwave |
| **劇毒新星** | Poison Nova | 92 | `poisonnova` | C | SC | 8 | Green poisonous ring expanding outward 360 degrees from caster's feet |
| **鋼鐵魔像** | Iron Golem | 85 | `irongolem` | E | SC | 8 | Metallic golem rising from the ground after consuming metal equipment on the floor |

---

## IV. Amazon

| Skill (ZH) | Skill (EN) | Skill ID | MPQ Asset | Pattern | Action | Release Frame | Characteristics & Visual Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **魔法箭** | Magic Arrow | 6 | `magicarrow` | A | A1 | 6 | Arrow glowing with faint ethereal blue magic light; straight-flying strike |
| **多重箭** | Multiple Shot | 12 | `arrow` | A | A1 | 6 | Fan barrage of 10–24 arrows distributed evenly |
| **導引箭** | Guided Arrow | 22 | `guidedarrow` | A | A1 | 6 | Soul-seeking red arrow with server-side homing turn rate ($8^\circ/\text{tick}$) |
| **閃電之怒** | Lightning Fury | 35 | `lightningfury` | A | TH | 7 | When the thrown javelin hits the first monster, it splits into dozens of chain lightning bolts in all directions |

---

## V. Barbarian

| Skill (ZH) | Skill (EN) | Skill ID | MPQ Asset | Pattern | Action | Characteristics & Visual Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **狂亂** | Frenzy | 147 | - | - | A1/A2 | Dual-wielding weapon frenzy combo; heavily stacks cadence and attack speed |
| **旋風斬** | Whirlwind | 151 | `whirlwind` | - | SQ | Body spins at high speed slicing along a straight line; weapon trails circular blade ring; strictly prohibited from triggering casting roar |
| **戰鬥指令** | Battle Orders | 149 | `battleorders` | C | SC | Roars toward the heavens; erupts golden acoustic soundwave array at feet |

---

## VI. Druid

| Skill (ZH) | Skill (EN) | Skill ID | MPQ Asset | Pattern | Action | Characteristics & Visual Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **極地風暴** | Arctic Blast | 221 | `arcticblast` | B | SC | Channeled continuous ice mist vortex sprayed from palms; multi-hit piercing freeze |
| **龍捲風** | Tornado | 245 | `tornado` | A | SC | Gray storm vortex roaming forward across the ground; path exhibits subtle random sway |
| **暴風** | Hurricane | 250 | `hurricane` | C | SC | Blizzard cyclone permanently orbiting within a 150px radius around the caster |

---

## VII. Assassin

| Skill (ZH) | Skill (EN) | Skill ID | MPQ Asset | Pattern | Action | Characteristics & Visual Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **雷電網** | Shock Web | 256 | `shockweb` | C | TH | Thrown and expands into a 2:1 diamond ground electric web, continuously shocking enemies who step in |
| **雷光守衛** | Lightning Sentry | 261 | `lightningsentry` | E | SC | Deploys a ground mechanical turret firing piercing lightning beams at nearby enemies |
| **亡者守衛** | Death Sentry | 276 | `deathsentry` | E | SC | Ground mechanical trap that chains explosions across all dead corpses within radius |

# 《暗黑破壞神2》全套視覺精靈圖庫索引指南 (Diablo II Sprites Repository Index)

本手冊為本專案專用之正統素材總目錄，全面梳理收錄於 `diablo2_sprites/` 目錄下的 15 大分類、共計 459 款原廠等級高解析度與透明圖集。供開發七大職業動作、召喚夥伴、怪物生態、地牢場景地磚與互動機關時精準調用。

---

## 目錄導覽 (Table of Contents)

1. [資料夾架構總覽 (Directory Overview)](#1-資料夾架構總覽)
2. [七大職業動作圖集 (Classes - 20 款)](#2-七大職業動作圖集-classes)
3. [怪物、精英與召喚夥伴圖集 (Enemies & Bosses - 108 款)](#3-怪物精英與召喚夥伴圖集-enemies--bosses)
4. [五大章節經典地磚 (Act 1 ~ Act 5 Tiles - 85 款)](#4-五大章節經典地磚-act-tiles)
5. [環境生態動物 (Animals - 17 款)](#5-環境生態動物-animals)
6. [場景可互動裝飾與物件 (Objects - 118 款)](#6-場景可互動裝飾與物件-objects)
7. [城鎮與任務 NPC (Non-Playable Characters - 40 款)](#7-城鎮與任務-npc-non-playable-characters)
8. [模組化拼裝部件 (Modular Monster Parts - 66 款)](#8-模組化拼裝部件-modular-monster-parts)
9. [Battle.net 復古頭像 (Chat Avatars - 5 款)](#9-battlenet-復古頭像-chat-avatars)
10. [核心功能快速檢索對照表 (Task-to-Asset Mapping)](#10-核心功能快速檢索對照表)

---

## 1. 資料夾架構總覽

```text
diablo2_sprites/
├── Act 1 Tiles/              # 第 1 幕場景地磚、石牆與地牢結構 (22 個檔案)
├── Act 2 Tiles/              # 第 2 幕魯高因、神秘避難所與塔拉夏古墓 (18 個檔案)
├── Act 3 Tiles/              # 第 3 幕庫拉斯特海港、雨林與憎恨之牢 (15 個檔案)
├── Act 4 Tiles/              # 第 4 幕混沌避難所、群魔堡壘與熔岩地獄 (13 個檔案)
├── Act 5 Tiles/              # 第 5 幕哈洛加斯、雪山與毀滅王座 (17 個檔案)
├── Animals/                  # 荒野環境生物與小動物 (17 個檔案)
├── Battle.net Chat Avatars/  # 暴雪戰網經典頭像圖集 (5 個檔案)
├── Classes/                  # 七大英雄職業輕/中/重裝 16 方向動作大圖 (20 個檔案)
├── Enemies & Bosses/         # 各章節普通怪、精英、關底首領與召喚夥伴 (108 個檔案)
├── Fallen Parts/             # 沉淪魔多部件模組化圖集 (11 個檔案)
├── Non-Playable Characters/  # 五大幕全城鎮 NPC 與任務委託人 (40 個檔案)
├── Objects/                  # 神殿、寶箱、火堆、血池、傳送門等物件 (118 個檔案)
├── Rogue Parts/              # 蘿格弓箭手多部件拼裝圖集 (14 個檔案)
├── Zealot Parts/             # 薩卡蘭姆狂熱信徒多部件圖集 (16 個檔案)
└── Zombie Parts/             # 飢餓殭屍多部件肢體圖集 (25 個檔案)
```

---

## 2. 七大職業動作圖集 (Classes)

收錄全部 7 大職業在不同防具重量階級（Light 輕裝、Medium 中裝、Heavy 重裝）下的完整 16 方向動作圖集。
圖集內部均帶有標準標籤條：`Town Neutral`（城鎮待命）、`Walk`（行走）、`Run`（奔跑）、`Attack 1 / Attack 2`（單手/雙手/遠程攻擊）、`Cast`（施法）、`Get Hit`（受創）、`Death`（死亡）及各職業特有動作。

| 職業 (Class) | 檔案名稱 | 說明與裝備階段 |
| :--- | :--- | :--- |
| **亞馬遜 (Amazon)** | `Amazon (Light).gif` | 輕裝皮甲，手持獵弓與長矛標槍 |
| | `Amazon (Heavy).gif` | 重型板甲鎧甲形態 |
| **刺客 (Assassin)** | `Assassin (Light).gif` | 輕裝夜行服，雙腕裝備利爪 |
| | `Assassin (Medium).gif` | 中裝皮鎖甲 |
| | `Assassin (Heavy).gif` | 重裝鎧甲，腿部裝備護脛金屬靴 |
| **野蠻人 (Barbarian)** | `Barbarian (Light).gif` | 輕裝獸皮與戰紋 |
| | `Barbarian (Medium).gif` | 中裝環甲，雙手持握戰斧 |
| | `Barbarian (Heavy).gif` | 重型全身板甲，持雙手巨劍 |
| **德魯伊 (Druid)** | `Druid (Light).gif` | 輕裝荒野長袍 |
| | `Druid (Medium).gif` | 中裝獸皮鹿角戰甲 |
| | `Druid (Heavy).gif` | 重型熊皮鎖子甲 |
| **死靈法師 (Necromancer)** | `Necromancer (Light).gif` | 輕裝骨法長袍，手持白骨魔杖 |
| | `Necromancer (Medium).gif` | 中裝皮骨甲 |
| | `Necromancer (Heavy).gif` | 重裝白骨戰甲 |
| **聖騎士 (Paladin)** | `Paladin (Light).gif` | 輕型皮質鎖甲 |
| | `Paladin (Medium).gif` | 中型鋼鐵胸甲 |
| | `Paladin (Heavy, Heraldic Shield).gif` | 重型全身鎧甲 + 聖騎士專用徽章盾 |
| | `Paladin (Heavy, Tower Shield).gif` | 重型全身鎧甲 + 巨型方盾/塔盾 |
| **魔法使 (Sorceress)** | `Sorceress (Light).gif` | 輕型絲綢法袍，手持單手杖 |
| | `Sorceress (Heavy).gif` | 附魔長法袍，雙手持握法杖 |

---

## 3. 怪物、精英與召喚夥伴圖集 (Enemies & Bosses)

本資料夾內含 108 個檔案，涵蓋從 Act 1 到 Act 5 的完整魔物生態，並包含德魯伊與死靈法師專用的忠誠召喚夥伴！

### 3.1 召喚夥伴專區 (Companions & Summons)
* **德魯伊夥伴**：
  * `Wolf.png` / `Wolf (72428).png` / `Wolf (109998).png`：【狂狼 / 幽靈狼 (Wolf / Dire Wolf)】，完整待命、飛奔追擊、撲咬撕扯與負傷倒地動作。
  * `d2data.mpq` 之 `BG` 模組：【灰熊巨獸 (Grizzly Bear)】，厚重衝鋒與拍擊。
  * `Oak Sage aura.gif` (位於技能庫)：【自然之靈 / 橡木智者 (Oak Sage)】，身周懸浮環繞護衛。
* **死靈法師夥伴**：
  * `Golem (Earth).png`：【黏土石魔 (Clay Golem)】，泥土重軀、厚重步伐與碎石重拳。
  * `Golem (Blood).gif`：【鮮血石魔 (Blood Golem)】，鮮血湧動形態。
  * `Golem (Fire).gif`：【火焰石魔 (Fire Golem)】，烈焰外觀。
  * `Golem (Metal).gif`：【鋼鐵石魔 (Iron Golem)】，金屬反光。
  * `Skeleton with Bow.png` 及 `web/assets/monsters/skeleton/`：【骷髏戰士 / 弓手僕從】。

### 3.2 關底首領 (Act Bosses)
* `Andariel.png`：第一幕關底首領【安達利爾 (Andariel)】。
* `Duriel.png`：第二幕關底首領【督瑞爾 (Duriel)】。
* `Mephisto.zip`：第三幕關底首領【墨菲斯托 (Mephisto)】。
* `Diablo.png`：第四幕關底首領【暗黑破壞神 (Diablo)】。
* `Baal's Minion (Light Weaponless).png` / `Minion of Destruction.png`：第五幕關底首領【巴爾之僕 / 毀滅之僕】。

### 3.3 著名精英暗金怪與章節小怪
* **不死生物 (Undead)**：`Mummy.png`, `Greater Mummy.zip`, `Radament.zip`, `Griswold.gif`, `Reanimated Horde.png`, `Vampire.gif`, `Wraith.png`, `Willowisp.png`。
* **惡魔系 (Demons)**：
  * `Balrog (Saber / Sickle Sword / Sword / Wide Sword / Weaponless).png` (炎魔軍團 5 種武器形態)
  * `Blood Lord.png`, `Blunderbore.gif`, `Succubus.png`, `Hell Witch.png`
  * `Goatman (Axe / Battle Axe / Halberd / Long Mace / Scythe / War Hammer / Weaponless).png` (羊人 7 種武器形態)
  * `Fetish (Blow Dart / Knife / Spear / Weaponless).png` 及 `Fetish Shaman.gif` (小矮人 4 種形態 + 巫師)
  * `Fallen Shaman.png`, `Council Member.gif`, `The Smith.png`, `The Summoner.gif`, `Izual.png`
* **野獸與蟲族 (Beasts & Vermin)**：
  * `Sand Maggot (Adult / Queen / Young / Egg).png/.gif` (沙蟲家族)
  * `Scarab Demon (6種輕/中甲與輕/重兵器組合).png` (聖甲蟲家族)
  * `Hell Bovine (Battle Axe / Halberd / Pole Axe).gif` (秘密母牛關乳牛戰士 3 種兵刃)
  * `Giant Mosquito.png`, `Spider Demon.gif`, `Spike Fiend.gif`, `Blood Hawk.gif`, `Wendigo.png`, `Minotaur.png`

---

## 4. 五大章節經典地磚 (Act Tiles)

提供原版無縫密鋪之經典場景地面、石牆與建築結構，支援 2.5D 等軸測菱形密鋪：

* **Act 1 Tiles (22 款)**：
  * 核心地牢：`Barracks Floor.png`, `Barracks.png`, `Catacombs Floor.png`, `Catacomb.png`
  * 宗教遺址：`Cathedral Floor.png`, `Cathedral.png`, `Monastery.png`
  * 荒野地洞：`Cave Floor.png`, `Caves.png`, `Den of Evil.png`, `Graveyard.png`, `Tristram.png`, `Wilderness.png`
* **Act 2 Tiles (18 款)**：
  * 綠洲與沙漠：`Outdoor Ground.png`, `Outdoor.png`, `Big Cliff Ground.png`, `Big Cliff Wall.png`
  * 魯高因與皇宮：`Town Floor.png`, `Town Wall.png`, `Palace Floor.png`, `Palace Wall.png`, `Harem.png`
  * 神秘空間與古墓：`Arcane Floor.png`, `Arcane Wall.png`, `Tomb Floor.png`, `Tomb Wall.png`, `Sewer.png`
* **Act 3 Tiles (15 款)**：
  * 海港市集：`Docktown Buildings.png`, `Docktown Ground.png`, `Docktown Wall.png`
  * 熱帶雨林：`Jungle Ground.png`, `Jungle Objects.png`, `River Ground.png`, `River Wall.png`
  * 崔凡克神殿與古都：`Kurast Ground.png`, `Kurast Roof.png`, `Kurast Wall.png`, `Travincal Floor.png`, `Travincal Wall.png`
* **Act 4 Tiles (13 款)**：
  * 混沌避難所：`Diablo's Lair Floor.png`, `Diablo's Lair Wall.png`
  * 群魔堡壘：`Fortress Ground.png`, `Fortress Roofs.png`, `Fortress Wall.png`, `Fortress Wall Bottom.png`
  * 地獄岩漿：`Hell Floor.png`, `Hell Object.png`, `Hell Wall.png`, `Lava Floor.png`, `Lava Wall.png`
* **Act 5 Tiles (17 款)**：
  * 毀滅王座：`Baal Throne Ground.png`, `Baal Throne Wall.png`, `Baal's Temple Floor.png`, `Baal's Temple Wall.png`
  * 冰河洞窟：`Ice Cave Floor.png`, `Ice Cave Wall.png`
  * 野蠻人雪山：`Mountain Floor.png`, `Mountain Walls.png`, `Town Ground.png`, `Town Walls.png`, `Temple Floor.png`

---

## 5. 環境生態動物 (Animals)

用於營造荒野、沙漠、沼澤與地牢中的真實生態生機：
* `Bat.png` (蝙蝠), `Bird.png` (鳥類), `Camel.png` (駱駝), `Chicken.png` (母雞), `Cobra.png` (眼鏡蛇), `Cow.png` (母牛), `Crab.png` (螃蟹), `Fly.png` (蒼蠅), `Larvae.png` (幼蟲), `Maggot.png` (蛆蟲), `Parrot.png` (鸚鵡), `Rabbit.png` (野兔), `Rat.png` (老鼠), `Scarabs.png` (小甲蟲), `Scorpion.png` (毒蠍), `Spider.png` (蜘蛛)。

---

## 6. 場景可互動裝飾與物件 (Objects)

收錄 118 款地牢機關與點綴物，重點物件包含：
* **光源與火焰**：`Fire (Large).png`, `Fire (Small).png`, `Fireplace 01.png` ～ `Fireplace 10.png` (十種壁爐/營火), `Fireplace in Hell.png`, `Candles.png`, `Torch.png`。
* **神殿與傳送**：`Altar.png`, `Altar (Secret Passage).png`, `Arcane Sanctuary Teleporter 1/2.png`, `Waypoint.png`, `Town Portal.png`。
* **容器與陷阱**：`Barrel.png`, `Bone Container.png`, `Chest.png`, `Fire Trap.png`, `Spike Trap.png`。
* **劇情物件**：`Cain Caged.png` (被囚禁在籠中的凱恩), `Blood Pool.png`, `Blood Vassel.png`, `Bottomless Well.png`。

---

## 7. 城鎮與任務 NPC (Non-Playable Characters)

收錄各章節全體 NPC 原版待命與交談序列幀：
* **Act 1**：阿卡拉 (`Akara.png`), 恰西 (`Charsi.png`), 迪卡·凱恩 (`Deckard Cain.png`), 基德 (`Gheed.png`), 卡夏 (`Kashya.png`), 瓦瑞夫 (`Warriv.png`)。
* **Act 2**：亞特瑪 (`Atma.png`), 卓格南 (`Drognan.png`), 法拉 (`Fara.png`), 傑海因 (`Jerhyn.png`), 蕾珊德 (`Lysander.png`), 馬席夫 (`Meshif.png`), 格雷茲 (`Greiz.png`)。
* **Act 3**：艾席拉 (`Asheara.png`), 奧瑪斯 (`Ormus.png`), 赫拉鐵力 (`Hratli.png`), 艾柯 (`Alkor.png`), 娜塔亞 (`Natalya.png`)。
* **Act 4**：泰瑞爾 (`Tyrael.png`), 哈爾布 (`Halbu.png`), 賈梅拉 (`Jamella.png`)。
* **Act 5**：安亞 (`Anya.png`), 拉蘇克 (`Larzuk.png`), 馬拉 (`Malah.png`), 夸爾凱克 (`Qual-Kehk.png`), 尼拉塞克 (`Nihlathak.png`)。

---

## 8. 模組化拼裝部件 (Modular Monster Parts)

供動態組合外觀與不同武器配備使用：
* **Fallen Parts (11 款)**：沉淪魔軀幹、斧頭、盾牌、木棒、軍刀、火炬與復活特效層。
* **Rogue Parts (14 款)**：蘿格身軀、輕/中型肩甲、大/小弓箭、雙手與頭部部件。
* **Zealot Parts (16 款)**：狂熱信徒戰斧、長柄斧、鐮刀、面具 1~4 與身軀 1~7。
* **Zombie Parts (25 款)**：飢餓殭屍輕/中/重型雙臂、頭顱、腿部與軀幹。

---

## 9. Battle.net 復古頭像 (Chat Avatars)

* `Balrog.png`, `Starcraft Medic.png`, `The Butcher.gif`, `Thrall.png`, `Town Crier.png`。

---

## 10. 核心功能快速檢索對照表

當需要執行特定功能開發時，直接依照此對照表提取素材：

| 目標功能 | 推薦使用素材路徑 | 備註說明 |
| :--- | :--- | :--- |
| **德魯伊狂狼召喚** | `diablo2_sprites/Enemies & Bosses/Wolf.png` | 具備完整 8 向奔馳、咬殺與死亡幀 |
| **德魯伊灰熊召喚** | `Diablo II 1.13c/d2data.mpq` (BG 模組) | 原廠 8 向撲擊衝撞與揮爪重擊 |
| **德魯伊自然之靈** | `assets/skills/fandom_animations/Oak Sage aura.gif` | 128x128 脈衝光環，環繞英雄懸浮 |
| **死靈黏土石魔** | `diablo2_sprites/Enemies & Bosses/Golem (Earth).png` | 高防禦慢速坦克，重拳拍擊 |
| **死靈鮮血/火石魔** | `diablo2_sprites/Enemies & Bosses/Golem (Blood/Fire).gif` | 進階石魔形態 |
| **死靈骷髏僕從** | `web/assets/monsters/skeleton/` + `Skeleton with Bow.png` | 友軍近戰骷髏戰士與遠程骷髏弓手 |
| **六大職業動作重校** | `diablo2_sprites/Classes/<Hero> (Light).gif` | 依據 Town Neutral / Walk / Attack 標籤重新切分 |
| **經典營火與火堆** | `diablo2_sprites/Objects/Fireplace 01.png` ~ `10.png` | 多款式動態火焰與灰燼燃燒 |
| **地牢地磚密鋪** | `diablo2_sprites/Act 1~5 Tiles/` | 各章節無縫地面與石壁素材 |

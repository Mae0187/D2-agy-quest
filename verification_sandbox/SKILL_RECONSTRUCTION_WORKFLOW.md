# 《暗黑破壞神2》全職業技能形態與沙盒通訊埠規範
### (Diablo II Skill Archetypes & Verification Port Index)

> **定位**：本文件專注於歸納暗黑破壞神 2 全職業技能之**核心動畫形態範本**，以及各職業沙盒獨立研發之**通訊埠分配表**。

---

## 1. 全職業核心技能形態範本 (Skill Archetypes)

### 形態 A：直線/投射物彈道型 (Straight Projectile / Missile)
* **特徵說明**：由施法者掌心/武器發射，依 16 方向貼圖沿 Euclidean 直線等速飛行，區分單體貫通或受擊爆炸。
* **查表欄位**：`Missiles.txt`（`Vel`, `Range`, `CelFile`, `CollideType`）。
* **代表技能**：
  - **魔法使**：火彈 (Fire Bolt)、火球 (Fireball)、冰彈 (Ice Bolt)、冰風暴 (Ice Blast)、冰川之刺 (Glacial Spike)。
  - **死靈法師**：白骨之牙 (Teeth)、骨矛 (Bone Spear)。
  - **亞馬遜**：魔法箭 (Magic Arrow)、多重箭 (Multiple Shot)、標槍投擲 (Javelin)。

---

### 形態 B：全向同心能量環型 (Radial Nova Expansion)
* **特徵說明**：以施法者接地腳底為原點，360 度向外均勻擴散之同心能量光環，具備階梯式波峰與加法光暈。
* **查表欄位**：`Skills.txt` (`srvdofunc: 22`, `cltdofunc: 25`) ➔ `Missiles.txt` (`zoffset: 0`)。
* **代表技能**：
  - **魔法使**：電擊新星 (Nova)、冰霜新星 (Frost Nova)。
  - **死靈法師**：劇毒新星 (Poison Nova)。
  - **野蠻人**：戰嚎衝擊波 (War Cry)。

---

### 形態 C：頂點吸附連鎖電弧型 (Chained Arc Jump)
* **特徵說明**：連續高壓光纜自施法者頂點射出，以子迴圈（Subloops: 3）緊密咬合各目標頂點，命中引爆 20 幀衝擊動畫。
* **查表欄位**：`Missiles.txt` (`pCltDoFunc: 8`, `pCltHitFunc: 16`, `CelFile: LightningStrike`, `ShockHitSm`)。
* **代表技能**：
  - **魔法使**：連鎖閃電 (Chain Lightning)、閃電 (Lightning)。
  - **亞馬遜**：閃電一擊 (Lightning Strike)。

---

### 形態 D：持續引導噴流型 (Channeled Spray Stream)
* **特徵說明**：持續引導施法，自掌心連續噴發高頻錐形粒子流，具備多段貫通灼燒/急凍特性。
* **查表欄位**：`Missiles.txt`（`Vel: 12`, `Range: 30`, `flamethrower`）。
* **代表技能**：
  - **魔法使**：地獄火 (Inferno)。
  - **德魯伊**：極地風暴 (Arctic Blast)、火屑 (Firestorm)。

---

### 形態 E：地表幾何鋪設型 (Ground Area Array)
* **特徵說明**：依 2:1 等軸測菱形幾何傾角，連續在地表鋪設持續燃燒或冰霜之傷害實體。
* **查表欄位**：`Missiles.txt`（`groundFireBig`, 37 幀）。
* **代表技能**：
  - **魔法使**：火牆 (Fire Wall)。
  - **刺客**：雷電網 (Shock Web)、火焰復甦地表火陣 (Wake of Fire)。

---

### 形態 F：多階段時間軸連動型 (Multi-Stage Timed / Falling Delayed)
* **特徵說明**：具備「地面脈動預警 ➔ 天空下墜 ➔ 觸地巨轟 ➔ 地表殘火」之複合狀態機。
* **查表欄位**：`Skills.txt` (`Param1`) ➔ `Missiles.txt` (`meteor`, `meteor_tail`, `meteor_explode`)。
* **代表技能**：
  - **魔法使**：隕石天降 (Meteor)、暴風雪 (Blizzard)。
  - **聖騎士**：天堂之拳 (Fist of the Heavens，天空引導 ➔ 聖光彈群射)。
  - **德魯伊**：毀天滅地 (Armageddon)。

---

### 形態 G：自轉母體擴散型 (Carrier Orb Cluster)
* **特徵說明**：母體自轉緩慢推進，沿途週期性向外散射次級高速小冰彈，並於射程終點炸裂。
* **代表技能**：
  - **魔法使**：冰封球 (Frozen Orb)。
  - **亞馬遜**：閃電之怒 (Lightning Fury)。

---

### 形態 H：複合多實體召喚型 (Composite Multi-Entity Minion)
* **特徵說明**：場上生成多部件獨立實體，具備自主索敵、雙層 PreDraw 前後景立體包覆與獨立動作脫手幀。
* **代表技能**：
  - **魔法使**：九頭海蛇 (Hydra)。
  - **死靈法師**：黏土石魔 (Clay Golem)、火焰魔像 (Fire Golem)、骷髏僕從。
  - **德魯伊**：灰熊 (Grizzly)、狂狼 (Dire Wolf)、自然之靈 (Oak Sage)、烏鴉 (Raven)。
  - **刺客**：影子大師 (Shadow Master)。

---

## 2. 七大職業獨立驗證通訊埠規劃 (Multi-Port Allocation)

為保證各職業驗證環境互不干擾、隨時可獨立啟動與回退，全職業沙盒通訊埠分配如下：

| 職業名稱 (Class) | 專屬通訊埠 (Port) | 當前狀態 (Status) | 核心測試目標 |
| :--- | :---: | :---: | :--- |
| **魔法使 (Sorceress)** | `8765` | **運作中 (Active)** | 火系、冰系、電系三系高精度 MPQ 動畫與能量波階數匹配 |
| **聖騎士 (Paladin)** | `8766` | 待啟用 (Standby) | 白熱連擊、祝聖之槌螺旋軌跡、神聖之盾與靈氣分層 |
| **亞馬遜 (Amazon)** | `8767` | 待啟用 (Standby) | 多重箭扇形散射、導引箭動態尋標、閃電之怒爆裂彈道 |
| **死靈法師 (Necromancer)** | `8768` | 待啟用 (Standby) | 白骨之牙多重軌跡、劇毒新星地表波、石魔三層立體包覆 |
| **野蠻人 (Barbarian)** | `8769` | 待啟用 (Standby) | 狂亂雙持打擊幀、旋風斬殘影、戰嚎多階同心震波 |
| **德魯伊 (Druid)** | `8770` | 待啟用 (Standby) | 變形攻擊硬直判定、極地風暴錐形噴流、自然之靈警戒盤旋 |
| **刺客 (Assassin)** | `8771` | 待啟用 (Standby) | 武術蓄力段數顯示、陷阱哨兵自律射擊、飛鏢連續射出 |

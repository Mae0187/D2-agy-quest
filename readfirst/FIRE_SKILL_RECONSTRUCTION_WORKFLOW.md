# 《暗黑破壞神2》全職業技能動畫實機重現通用工作流手冊
### (Diablo II Universal Skill Animation & VFX Reconstruction Workflow Manual)

> **核心定位**：本手冊為全職業（魔法使、聖騎士、死靈法師、亞馬遜、野蠻人、德魯伊、刺客）技能與投射物原廠動畫實機重現之**標準工程作業程序 (Standard Operating Procedure, SOP)**。以暴雪官方 MPQ 二進位檔案、The Phrozen Keep 權威文獻、以及魔法使純火系五大代表形態為驗證基準範本。

---

## 0. 真理源依據與權威文獻 (Source of Truth)

本工作流手冊嚴格依據下列權威文獻與本地原始庫存建立：
- **暴雪官方 Mod 研究權威**：[The Phrozen Keep - Intro to the D2 Files and File Guide/Tutorial Masterlist (by Nefarius & Volf)](https://d2mods.info/forum/viewtopic.php?p=248164#248164)
- **本地真理源數據庫**：`readfirst/d2_reference_tables/`
- **本地標準工具集庫**：`readfirst/tools/`
- **本地標準圖資範例**：`readfirst/assets/atlases/`

---

## 1. 暴雪原廠 MPQ 權重階層與資產提取準則 (Asset Extraction Pipeline)

依據 The Phrozen Keep 官方文獻，暗黑 2 檔案提取必須嚴格遵從 **檔案優先級覆蓋階層**，杜絕版本錯亂：

1. **`Patch_D2.mpq`（最高優先級覆蓋層）**：
   - 包含自 1.00/1.07 以來所有最新補丁修訂檔。**任何表格或動畫圖資只要存在於此封包中，永遠以此封包為最高真理源**。
2. **`D2Exp.mpq`（資料片《毀滅之王》核心層）**：
   - 資料片專屬檔案，包含刺客 (Assassin)、德魯伊 (Druid) 職業 DCC/COF 模型、專屬裝備、新場景與資料片技能。
3. **`D2Data.mpq`（核心遊戲數據與動畫圖庫）**：
   - 包含遊戲全套 TXT 數據表、TBL 語系字典、怪物 (Monsters)、投射物 (Missiles)、覆蓋層 (Overlay)、物件 (Objects) DCC 動畫與 DC6 介面。
4. **`D2Char.mpq`（經典五大職業核心模型層）**：
   - 包含經典職業（亞馬遜、野蠻人、聖騎士、死靈、法師）之 16 方向裝備與動作 DCC/COF 骨架。
5. **`D2SFX.mpq` / `D2XMusic.mpq`（音效與音樂串流層）**：
   - 包含原廠無損 WAV 技能施法音、擊中音、爆炸音與環境音樂。

### 提取防抖鐵律：DCC 聯集盒 (Union-Box) 與錨點對齊
原廠 DCC 檔案各方向、各幀之裁剪尺寸不同，直接拼合必然造成畫面抖動。標準解碼規範如下：
* **聯集盒計算 (Bounding Box Union)**：遍歷全方向與全幀數，計算最大包圍矩陣，產出等寬等高單元網格 (Cell Width x Cell Height)。
* **錨點鎖定模式**：
  - **飛彈/投射物**：採幾何中心錨點 (`y_mode: center`)。
  - **地表實體/火柱/召喚物**：採**底部接地錨點 (`y_mode: bottom`)**，將物理接地基準線鎖死在角色腳底，徹底消除動作切換時的浮空與上下抖動。

---

## 2. 核心數據表標準查表四步法 (The 4-Step Table Lookup SOP)

任何職業新技能的重現，一律遵循以下 4 步標準查表流程：

```
[步驟 1] Skills.txt      ➔ 定位技能本體參數 (動作代碼 anim, 投射物ID, 週期 Param)
       ↓
[步驟 2] Missiles.txt    ➔ 定位飛行特效 (圖資 CelFile, 初速 Vel, 射程 Range, 碰撞 CollideType)
       ↓
[步驟 3] Overlay.txt     ➔ 定位前後景圖層 (PreDraw: 0 身前前景覆蓋 / 1 身後背景襯底)
       ↓
[步驟 4] AnimData.D2     ➔ 定位物理脫手出招幀 (Release Frame，原廠標準大多為第 8 幀)
```

### 關鍵欄位精確對照：
* **`Skills.txt`**：
  - `anim`：施法動作模式（如 `SC` = 法師施法、`A1` = 物理攻擊）。
  - `srvmissile` / `cltmissile`：關聯至 `Missiles.txt` 的伺服器與客戶端飛彈 ID。
  - `Param1 ~ Param8`：技能特殊參數（如召喚物持續時間 tick、砸地延遲時間等）。
* **`Missiles.txt`**：
  - `CelFile`：原廠 MPQ 內對應的 DCC 檔案名稱。
  - `Vel` / `MaxVel`：飛行初速（單位為像素/物理步進，25Hz）。
  - `Range`：存活時間（單位為物理步進 tick，25 tick = 1 秒）。
  - `CollideType`：碰撞判定模式（單體打擊、範圍爆炸、或貫通穿透）。
* **`Overlay.txt`**：
  - `PreDraw`：**0 = 繪製於實體身前（前景遮罩）；1 = 繪製於實體身後（背景底襯）**。
  - `AnimRate`：播放速率（原廠多以 16FPS 為基準）。
* **`AnimData.D2`**：
  - 二進位記錄之各動作脫手點（Release Frame）。若未在脫手幀發射飛彈，動作與彈道將產生嚴重脫節。

---

## 3. 加法圖層去黑特徵處理鐵律 (Additive Layer De-blacking Rule)

在暗黑 2 的光效、烈焰、靈氣等加法渲染組件中，現代網頁 Canvas 重現時極易出現「黑色色塊遮罩」瑕疵：
* **病灶根因**：
  原廠引擎中，複合組件之加法圖層（如 DrawMode 3 的 S1 烈焰、電光）邊緣暗部包含近黑索引（RGB 5,5,5）。若轉出為普通 RGBA 圖集並給予不透明 Alpha=255，在 Canvas 的 `source-over` 繪製下會將底層正常畫面遮蓋，形成突兀黑邊。
* **通用去黑演算法標準**：
  提取加法圖層資產時，凡判定為加法圖層或低亮度過渡像素，強制將其 Alpha 設為 `0`（完全透明），使高光核心能在畫布上藉由 `lighter` 混色模式或乾淨邊緣平滑透出，100% 根除黑塊。

---

## 4. 全職業五大核心技能形態重現範本 (The 5 Universal Archetypes)

暗黑破壞神 2 全職業的技能形態，皆可精確歸納為以下 5 種典型範本。開發新技能時，直接對照對應範本套用即可：

---

### 形態 A：直線/投射物彈道型 (Straight Projectile / Missile)
* **特徵說明**：由施法者掌心/武器插槽發射，換算 16 方向貼圖，沿直線等速飛行，區分單體或範圍爆炸。
* **查表依據**：`Missiles.txt` 查詢 `Vel`、`Range` 與 `CelFile`。
* **典型範例**：
  - **火彈 (Firebolt)**：16 向貼圖直飛，`Vel: 18`，`Range: 60`。單體判定 (-35 HP)，無爆炸。
  - **火球 (Fireball)**：16 向貼圖直飛，`Vel: 16`，`Range: 55`。抵達目標或碰撞時觸發 **80px AoE 爆炸** (`ExpArrowExplode`, 12 幀動畫)，產生群體打擊 (-65 HP)。
* **跨職業/跨系通用映射**：
  - 冰系：冰彈 (Ice Bolt)、冰風暴 (Ice Blast)、冰川之刺 (Glacial Spike)。
  - 電系：充能彈 (Charged Bolt，加隨機折線抖動)、連鎖閃電 (Chain Lightning)。
  - 死靈法師：牙 (Teeth)、骨矛 (Bone Spear)。
  - 亞馬遜：魔法箭、多重箭、標槍投擲 (Javelin)。

---

### 形態 B：持續引導噴流型 (Channeled Spray Stream)
* **特徵說明**：持續按壓滑鼠引導施法，自掌心連續發射高頻錐形粒子流，具備多段穿透（貫通）灼燒/冰凍特性。
* **查表依據**：`Missiles.txt` 查詢粒子存活 tick 與擴散角度。
* **典型範例**：
  - **地獄火 (Inferno)**：按住滑鼠時每步進發射 2 枚微小擴散火焰粒子 (`flamethrower`, 15 幀)，`Vel: 12`，`Range: 30`。粒子穿透所有木人，跳出多段傷害。
* **跨職業/跨系通用映射**：
  - 德魯伊：極地風暴 (Arctic Blast)、火屑 (Firestorm)。

---

### 形態 C：地表幾何鋪設型 (Ground Area Array)
* **特徵說明**：以點擊點為基準，依 2:1 等軸測菱形幾何傾角連續鋪設地表特效矩陣。
* **查表依據**：`Missiles.txt` 查詢地表動態幀數與持續時間。
* **幾何投影算式**：座標採 2:1 等角菱形壓縮 (`px = tx + cos * d; py = ty + sin * d * 0.5`)。
* **典型範例**：
  - **火牆 (Firewall)**：垂直於施法線以 45 度傾角、38px 間距鋪設 **7 道地表大火** (`groundFireBig`, 37 幀)，存活 `Range: 90` (3.6秒)。
* **跨職業/跨系通用映射**：
  - 冰系：暴風雪地表碎冰殘留。
  - 死靈法師：劇毒新星地表擴散波。
  - 刺客：雷電網、火焰復甦地表火陣。

---

### 形態 D：多階段時間軸連動型 (Multi-Stage Timed / Falling Delayed)
* **特徵說明**：非即時生效技能。具備「地面預警 ➔ 天空下墜 ➔ 觸地砸轟 ➔ 地表殘留」嚴密的多狀態機時間軸。
* **查表依據**：`Skills.txt` 查詢 `Param1` (砸地延遲 tick)。
* **典型範例**：
  - **隕石天降 (Meteor)**：
    1. **預警階段**（0~30 tick）：地表脈動紅光預警圈 (`meteor_indicator`, 17 幀)。
    2. **天降階段**（15~30 tick）：巨石 (`meteor`) 攜高光拖尾 (`meteor_tail`) 自天空右上俯衝。
    3. **巨轟階段**（第 30 tick）：觸地全屏震顫，觸發巨型爆炸 (`meteor_explode`, 16 幀, 210x176 尺寸, 120px 範圍傷害)。
    4. **殘火階段**（30~80 tick）：地表殘留燃燒火海 (`groundfire_med`, 37 幀)。
* **跨職業/跨系通用映射**：
  - 冰系：暴風雪 (Blizzard，落冰雲預警 ➔ 尖冰下墜 ➔ 碎冰濺射)。
  - 聖騎士：天堂之拳 (Fist of the Heavens，天空聖光引導 ➔ 聖光彈炸裂)。
  - 德魯伊：毀天滅地 (Armageddon)。

---

### 形態 E：複合多實體召喚型 (Composite Multi-Entity Minion)
* **特徵說明**：場上生成多部件獨立實體，具備自主任務、獨立索敵半徑、多層次 PreDraw 前後景包裹與專屬嘴吻/武器發射插槽。
* **查表依據**：`MonStats.txt` 實體 ID、`Overlay.txt` 前後景 PreDraw 分層、`AnimData.D2` 動作釋放幀。
* **典型範例**：
  - **九頭海蛇 (Hydra)**：
    - **三蛇頭實體**：左後 (朝向 5)、中央 (朝向 4)、右後 (朝向 3)，獨立 280px 索敵。
    - **雙層立體包覆**：身後 0.45 柔和底襯火光 + 身前 `PreDraw: 0` 竄升烈焰 (`hydra_groundfire`) 舔舐蛇腹，徹底根除平面切邊。
    - **脫手判定**：甩頭攻擊播放至第 8 幀脫手，自 8 向嘴吻精確插槽 (`HYDRA_MOUTH_OFFSETS`) 發射火彈。
    - **校準固化座標**：蛇頭偏移 `heads: [[-22,-8],[0,6],[22,-8]]`、火焰偏移 `fires: [[-11,-6],[-10,-6],[-8,-6]]`。
* **跨職業/跨系通用映射**：
  - 死靈法師：黏土石魔、鋼鐵魔像、火焰魔像（雙層烈焰包覆）。
  - 德魯伊：烏鴉、劇毒藤蔓、狂狼、灰熊。
  - 刺客：影子大師 (Shadow Master)。

---

## 5. 沙盒驗證與多職業獨立連接埠規劃 (Sandbox & Multi-Port Testing Gate)

為了保證各職業驗證互不干擾、隨時可回退，實施嚴格的架構隔離原則：

### 5.1 獨立通訊埠劃分規範
* **`8765`（當前通訊埠）**：**魔法使 (Sorceress) 專屬驗證埠**。
  - 在此埠完成純火系、冰系、電系三系沙盒驗證後，才整合部署至主遊戲環境。
* **後續各職業專屬驗證埠分配**：
  - 聖騎士 (Paladin)：`8766`
  - 亞馬遜 (Amazon)：`8767`
  - 死靈法師 (Necromancer)：`8768`
  - 野蠻人 (Barbarian)：`8769`
  - 德魯伊 (Druid)：`8770`
  - 刺客 (Assassin)：`8771`

### 5.2 核心運行與驗收門檻
1. **25Hz 固定物理鎖頻 (Fixed Step)**：主迴圈分離 60FPS 渲染與 25Hz 邏輯累積步長 (40ms TICK_MS)，確保彈道速度 100% 符合作業規範。
2. **零 GC 物件池 (Zero-GC Pooling)**：高頻飛彈、火柱、粒子流嚴禁即時 `new` 物件，重複利用既有實體結構。
3. **軀幹中心 -18px 判定**：木人與怪物受擊判定以接地點 Y 軸 -18px 為中心，禁止使用底座標記避免高空飛彈誤判。
4. **Playwright 自動化測試門禁**：所有新技能上線前，必須執行無頭瀏覽器實機測試，驗證點擊出招、鍵盤切換與主控台 0 JavaScript 報錯，並於 `testimages/` 存檔實機截圖後方可交付。

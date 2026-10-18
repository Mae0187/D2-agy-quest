# 《暗黑破壞神2》原廠 MPQ 權威數據表與動畫物理標準手冊 (Official Reference Tables)

本目錄存放自 Blizzard 原廠 MPQ (`Patch_D2.mpq`, `d2exp.mpq`, `d2data.mpq`) 解包之核心數據表與二進位檔案，作為專案所有動畫、技能投射物、碰撞、攻速與發射物理的**唯一權威真理源**。

---

## 一、 核心資料檔案清單

| 檔案名稱 | 來源 MPQ | 核心欄位 / 內容 | 用途說明 |
| :--- | :--- | :--- | :--- |
| `Missiles.txt` | `Patch_D2` (171 欄) | `CelFile`, `xoffset`, `yoffset`, `zoffset`, `InitSteps`, `pSrvDoFunc`, `pCltDoFunc`, `Vel`, `MaxVel`, `Range` | 全遊戲 684 筆飛彈物理、外觀圖集、發射偏移與初速步進參數 |
| `Skills.txt` | `Patch_D2` (256 欄) | `anim`, `seqnum`, `srvdofunc`, `cltdofunc`, `srvmissile`, `cltmissile`, `castoverlay`, `aurastate` | 技能發動中樞、動作代碼 (SC, BOW, 1HT)、飛彈與狀態映射 |
| `Overlay.txt` | `Patch_D2` | `Filename`, `PreDraw`, `Trans`, `Xoffset`, `Yoffset`, `Height1` ~ `Height4` | 光環、狀態特效 (冰凍/雷暴/附魔) 之圖層前後景、混色模式與垂直掛載點 |
| `states.txt` | `Patch_D2` | `state`, `overlayone` ~ `overlayfour`, `aurastate`, `group` | 技能狀態/靈氣至 `Overlay.txt` 之關鍵對照表（解決狀態技能斷鏈病灶） |
| `monstats.txt` | `Patch_D2` | `Id`, `BaseId`, `Code`, `Height`, `PixHeight`, `OverlayHeight`, `HitTestHeight` | 怪物身高、軀幹中心受擊點與基礎屬性數值 |
| `monstats2.txt` | `Patch_D2` | `Id`, `Base`, `Height`, `mTR`, `mHD`, `mLA`, `mRA`, `mS1` ~ `mS8` | 怪物外觀組裝代碼 (Token: 如 ZM, FA, SK) 與部位動畫圖集對照表 |
| `monseq.txt` | `Patch_D2` | `sequence`, `mode`, `frame` | 怪物與特定多段動作之序列影格時序表 |
| `charstats.txt` | `d2exp` | `class`, `WalkVelocity`, `RunVelocity`, `StartSkill`, `baseWClass` | 七大英雄基礎屬性與走跑原廠物理速度 |
| `PlrMode.txt` | `d2exp` | 玩家動作模式列舉 (DT, NU, WL, RN, GH, TN, TW, A1, A2, SC, TH, KK, S1 ~ S4, DD) | 玩家 COF 動作三字元代碼對照表 |
| `MonMode.txt` | `d2exp` | 怪物動作模式列舉 (DT, NU, WL, RN, GH, A1, A2, SC, DD) | 怪物動作代碼對照表 |
| `WeaponClass.txt` | `d2exp` | 武器分類代碼 (HTH, 1HS, 2HS, 1HT, 2HT, BOW, XBW, STF, JAV 等) | 英雄持械形態與動畫部件連動代碼 |
| `AnimData.D2` | `d2exp` (二進位) | 256 Hash 桶、160 位元組記錄 (`frames`, `speed`, `events[144]`) | 官方權威動作長度、播放幀率與脫手事件碼 (1: 施法, 2: 射箭) |
| `AnimData_parsed.json` | 本機工具轉換 | 結構化 JSON 格式記錄全動作之幀數、脫手幀 (`release_frame_cast`, `release_frame_missile`) | 供開發者與 Agent 快速查詢各動作脫手影格 |
| `pal.dat` | `d2data` (二進位) | ACT1 256 色 RGB 調色盤 (768 位元組) | DCC / DC6 資產解碼顏色映射唯一真理源 |

---

## 二、 原廠投射物發射與特效空間層級標準 (Authentic Launch & Spatial Layer Protocol)

依據 `Missiles.txt`、`Overlay.txt`、`states.txt` 與 `AnimData.D2` 的底層規範，專案所有技能動畫嚴格落實以下空間與物理標準：

### 1. 空間發射基準原點分流（嚴禁一刀切）
暴雪原廠 2D 等軸測視角下，技能依形態有嚴格的垂直高度分流，**絕對禁止**將所有技能強制套用單一高度：

* **【空中直線/投射物彈道（形態 A）】**（火球、冰彈、冰風暴、骨矛、充能彈、箭矢）：
  - **發射基準面**：鎖定於**角色腳底接地點向上 32 ~ 38 像素（即 `Y - 32px ~ Y - 38px`）**。
  - **手部/法杖微調**：依據當前發射朝向（16/32 方向），手掌與法杖尖端在基準點向外微幅偏轉 **8 ~ 12 像素**。
  - **身前半步前推 (`InitSteps = 1`)**：飛彈生成瞬間（Tick 0 轉 Tick 1），**必須沿發射方向向量向前推進 16 ~ 20 像素**，確保飛彈「出生即在法杖/手掌前端」，徹底杜絕身體內部穿出的生硬感。

* **【地面擴散波與腳底靈氣（形態 C / 靈氣 / 地表危害）】**（新星 Nova、冰霜新星 Frost Nova、劇毒新星、雷暴旋轉電環、聖火/狂熱靈氣、火牆地表烈焰）：
  - 依據 `Missiles.txt` 之 `zoffset: 0` 與 `Overlay.txt` 之 `Height: 0`，**發射原點嚴格鎖定於角色腳底接地點（即 `Y - 0px`）**！
  - 以 2:1 等軸測橢圓貼地同心向外擴散，完美貼合角色腳底陰影。
  - **【新星實心無縫閉合圓環鐵律】**（對照 `official_visual_standards/sorceress/nova_163.jpg`）：電弧圖元隨半徑動態保持高密度重疊密鋪，全擴散生命週期中 100% 保持完全閉合之實心同心光環，純白核心與電藍外暈緊密熔接，**絕對禁止**隨半徑擴大而裂開成有黑色縫隙的虛線碎弧。
  - **絕對禁止**將新星或靈氣掛載於胸膛造成半空懸浮。

* **【連續栓接光束與電弧鏈（形態 A / 折射光束，pCltDoFunc: 8）】**（連鎖閃電 Chain Lightning 53、閃電 Lightning 49、閃電之怒 Lightning Fury 35）：
  - 依據 163 Wiki 權威截圖 `official_visual_standards/sorceress/chain_lightning_163.jpg`：
  - **【自法杖貫穿至目標連續電弧鏈鐵律】**：從施法者法杖端點至第一目標、第一目標至第二目標，全程頭尾無縫相連栓接，形成一條不中斷的連續高壓雷電纜繩。
  - 每一折射跳躍段落嚴格進行端點鎖定，分段圖元順向重疊密鋪，**絕對禁止**段落散落斷裂或在空中形成孤立無源之虛線。折射點必須引爆原廠 20 幀電爆光團 (`ShockHitSm`)。

* **【天頂急墜型（形態 D）】**（暴風雪 Blizzard 天降冰柱、隕石天降 Meteor、天雷轟頂 Thunderstorm）：
  - 投射物自天頂高空（`Y - 300px` 或畫面頂端）斜向急墜，於目標受擊點（接地點 `Y - 0px`）接觸引爆。

---

### 2. 圖層深度 (PreDraw) 與加法混色 (Trans) 鐵律
特效與角色、怪物的重疊層級必須嚴格遵循 `Overlay.txt`：

* **`PreDraw = 1`（身後/腳底地面底襯）**：
  - **必須在角色實體本體之前先繪製於地面底層**（如雷暴旋轉電環 `ThunderstormCast_operate`、聖騎士後靈氣 `AuraBack`、背後柔和光暈）。角色踩在特效上方，消除凌空懸浮。
* **`PreDraw = 0`（身前前景覆蓋）**：
  - 繪製於角色身前（如九頭海蛇地表烈焰 `HydraGroundFire`、前靈氣 `AuraFront`、出招火光）。
* **`Trans = 3`（加法混色模式）**：
  - 火焰、電光、靈氣素材解碼時必須過濾邊緣近黑像素（$R + G + B < 50$ 設為完全透明 Alpha 0），繪製時啟用 `lighter` 模式，徹底消除黑底色塊。

---

### 3. 直線投射物「螢幕等速直線鐵律」
* 直線投射物在 2D 畫布上**永遠沿著施法點至目標點的直線歐幾里得向量等速前進**：
  - 方向角 $\phi = \text{atan2}(dy, dx)$。
  - 速度分量為 $v_x = \frac{dx}{\text{dist}} \times \text{Vel},\ v_y = \frac{dy}{\text{dist}} \times \text{Vel}$。
* **絕對禁止**在螢幕速度上套用等軸測半速壓縮（即 `atan2(dy*2, dx)` 或 `vy * 0.5`），否則會導致朝上下飛行時軌跡扁化、速度驟降並產生劇烈顛簸。

---

### 4. 目標軀幹中心受擊判定球心
* 怪物與木人假人的受擊碰撞判定，必須以**實體接地點向上 18 像素（`Y - 18px`）**為幾何球心進行半徑距離檢測。
* **絕對禁止**直接與地表情表點 $(x, y)$ 做 2D 距離檢測，否則飛過胸口的投射物會發生穿透未命中瑕疵。

---

### 5. AnimData 脫手事件幀精確同步 (ReleaseFrame Timing)
飛彈生成時機必須 100% 與 `AnimData.D2` 的事件標記（Event Code 1: 施法, 2: 射箭）幀率同步：
* **死靈法師單手施法 (`NESCHTH`)**：第 8 幀脫手。
* **魔法使長杖施法 (`SOSCSTF`)**：第 7 幀脫手。
* **亞馬遜拉弓射箭 (`AMA1BOW`)**：第 6 幀脫手。
* **亞馬遜投擲標槍 (`AMA11HT`)**：第 7 幀脫手。
非脫手影格嚴禁提前或延遲發射飛彈。

---

### 6. 腳底同心圓盤錨定法與六段垂直切片法則 (Foot Disk & 1/6 Slicing Rules)
* **腳底同心圓盤法 (Foot Disk Rule)**：
  - 在實體接地原點注入 2:1 等軸測同心橢圓靈氣光環。實體在切換待機、施法、跑步、受擊或全向旋轉時，雙足中心相對圓盤位移 $\le 1\text{px}$（達成零晃動 Zero-Wobble）。
* **六段垂直切片法則 (1/6 Slicing Rule)**：
  - 人形實體高度等分 6 份：接地原點落於底部 1/6 頂端，胸膛與施法脫手點鎖定於 3/6 至 4/6 區間（$Y - 32\text{px} \sim Y - 38\text{px}$）。嚴禁自腳底貼地發射空中投射物，亦禁止地面技能半空懸浮。

---

### 7. 原廠 COF 骨架與 AnimData.D2 鎖頻防斷言機制 (Assertion Defense)
* **`eComponent` 幀數鎖頻**：多部件實體各部件 DCC 幀長必須與 COF 骨架及 `AnimData.D2` 嚴格 1:1 鎖頻一致，防止引擎報 `GfxUtil.cpp #1352` 斷言崩潰。
* **`(UINT)nAnimFrame` 索引防呆**：序列動作（`monseq.txt`）索引必須小於動畫最大影格數，防止 `CUnit.cpp #1436` 越界崩潰。

---

### 8. 空圖元安全佔位與 Units 通用調色盤標準
* **空圖元安全佔位 (Void Sprite Slot)**：未激活或隱藏的肢體槽位（TR/HD/LA/RA/LH/RH/SH/LG/S1-S8）必須掛載 1x1 透明佔位圖元，幀長等長鎖頻，防止圖層殘缺或引發空引用例外。
* **Units 通用調色盤鎖定**：全角色、怪物與技能投射物萃取與渲染必須強制綁定 `units.pal`，杜絕跨幕場景粉紅底噪 (Hot Pink Glitch)。


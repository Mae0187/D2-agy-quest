# 🤖 Gemini Flash Specialized: Diablo II Dungeon Mission Execution & Anti-Drifting Behavior Protocol (AGENT.md)

## 1. 核心定位、防漂移機制與預算防禦 (Core Positioning, Anti-Drifting & Budget Protocol)

### 1.1 核心定位
你不是泛泛的文字助手，而是「暗黑破壞神 II 即時狀態與 Token 戰鬥監控看板」專案的「專家級主代理（Primary Agent）」。你的每一步推理與決策都直接關乎本地 Canvas 畫面與背景監控系統的穩定生存。嚴禁任何偷工減料、虛假 Mock 佔位或未經授權的程式碼破壞。

### 1.2 戰鬥狀態映射與防漂移規範 (Anti-Drifting Protocol)
你必須將所有推理狀態嚴格映射至暗黑破壞神 2 遊戲化循環，視為「專家模式（Hardcore Mode）」執行：
* **【待機 ➔ 羅格營地休整 (Idle)】**：無任務時進入低耗能休眠，維持營火環境音，最小化 RAM/CPU 佔用。嚴禁無指令時反覆觸發無效的全域資源預掃描。
* **【思考 ➔ 荒野與地牢巡邏 (Thinking)】**：面對複雜多步任務，嚴格落實逐步自省（Step-by-step reflection），確保戰術完全對齊最終目標，絕不在長對話中產生語意漂移或中途遺漏既定功能。
* **【工具執行 ➔ 迎戰地牢怪物 (Tool Running)】**：監控日誌或解壓 MPQ 時遇 Windows 檔案鎖死（PermissionError），必須以非阻塞、共享讀取游標優雅處理。嚴禁縮減專案範疇或用假資料繞過環境約束。
* **【重大任務 / 報錯 ➔ 遭遇幕首領 (Major Task / Error)】**：將重大 Bug 與架構重構視為與安達利爾或迪亞布羅的 Boss 戰役。若評估自身推理負擔過重，主動開闢「藍色傳送門」召喚高推理子代理並行攻堅，主代理保持協調與 README 同步。
* **【使用者中斷 ➔ 藍色傳送門脫離 (User Abort / Ctrl+C)】**：偵測到中斷訊號立刻停止高頻磁碟 I/O，優雅引導角色回城，完整保留 `debug.log` 堆疊資料。
* **【任務完成 ➔ 暗金寶箱掉落 (Task Completed)】**：僅當交付物 100% 經實機測試驗收且隨時可直接運行時，方可宣告完成。

### 1.3 雙層預算防禦與資源約束 (Life / Mana Orbs)
* **【內層生命球：短期速率限制 (Life Fluid)】**：保持極度精煉、直球對決。嚴禁無效寒暄、廢話或重複摘要。
* **【外層能量聖盾：每週長期預算 (Energy Shield)】**：避免錯誤循環引發 Token 異常飆升，在預算屏障碎裂前主動標註架構瓶頸。
* **【右側法力球：上下文飽和度警示 (Mana Orb)】**：當長對話或日誌造成 Context Window 飽和時，主動提示使用者開新對話。開新對話前必須將完整進度壓縮至 `README.md` 變更日誌，並刷新 `debug.log`。

### 1.4 d2-engine 技能引擎最高真理源原則 (Skill Engine Supremacy Rule)
凡涉及《暗黑破壞神2》全職業技能動畫、投射物彈道物理、視覺特效（VFX）、地表危害、召喚實體或 DCC 圖集資產之規格、算法、圖層前後景（PreDraw）、脫手幀與驗收標準，**100% 嚴格以 `d2-engine` 技能包（及其專屬手冊 `references/01` ~ `06` 與 `templates/`）為唯一真理源與防呆作業標準**。
* **單向覆蓋原則**：若 `AGENT.md` 本文或其它歷史文獻與 `d2-engine` 有任何描述差異、命名分歧或矛盾，**100% 以 `d2-engine` 規範為唯一準則**，嚴禁在 `AGENT.md` 中自行維護第二套特化或舊版假設邏輯。
* **中英文雙向對齊**：`d2-engine` 內部已全面英文化（對齊原廠 MPQ 數據表與 The Phrozen Keep 權威術語）。無論使用者以繁體中文或英文提及技能名，Agent 必須強制映射至 `d2-engine` 的 20 大行為原語家族（F01~F20）與對應通用高保真模板（如 `radial_nova_template.ts`、`chained_arc_template.ts`），杜絕任何認知漂移與歷史偏差。

---

## 2. 交付與實機驗收門檻 (Delivery & Verification Thresholds)
* **本機資源優先原則 (Local Resource First)**：所有自動化腳本或渲染模組必須優先審查與綁定既有的全域快取、Python site-packages 與本地執行環境，嚴禁重複下載。
* **沙盒獨立驗收原則**：任何新 UI 或技能模組，交付前必須於獨立沙盒（`verification_sandbox/`）中完成單元測試與 Playwright 實機動態播放驗收，確認無記憶體洩漏與功能異常後，方可規劃整合。
* **無代碼繁體中文回報鐵律 (No Code Snippets Protocol)**：回報進度嚴格遵守使用者偏好——**絕不在對話中輸出程式碼片段（Code Snippets）**，一律以純自然流暢的繁體中文，著重於運作邏輯、操作步驟與 UI 介面視覺描述。

---

## 3. D2 遊戲引擎還原五階段實施路線圖 (5-Stage Implementation Roadmap)

為確保專案以最快節奏達成「全平台通用 AI 戰鬥監控看板」核心價值，嚴格遵守由淺入深之五階段路線：
* **【第 1 階段：調色盤、資產解碼與營火大廳選角】** [已達成 - 100% 驗收]
  - 攻克 8-bit Indexed Color、PL2 光照、原生色盤查表，修復 DCC 零遮罩同步，落實營火七英雄著地錨定（BASE_ANCHOR 160, 265、bottom: -55px）與 25 FPS 選角動作。
* **【第 2 階段：全平台通用 CLI 日誌適配層與標準事件】** [進行中]
  - 打通非同步 File Tail、外掛解析矩陣與 Canonical Event Schema，將任意 Agent 文字轉譯為標準戰鬥指令。
* **【第 3 階段：D2 戰鬥導演與地牢戰鬥沙盒】** [當前焦點 - 即刻推動]
  - 採納 Mode A（經典地牢背景 + 真正 DCC 實體），實作 300ms 戰鬥平滑佇列、四階段時間軸裝配（Cast ➔ Missile ➔ Overlay ➔ Hit），並無損整合已驗收之 25Hz 投射物引擎。
* **【第 4 階段：經典暗黑 HUD 儀表全面數值連動】**
  - 左紅球（API 速率與健康度）、右藍球（Context 飽和度）、底部 XP 條（Token 累積）與頂部聖盾 Buff 連動。
* **【第 5 階段：桌面置頂視窗/IDE 整合與 Mode B 真地圖引擎】**
  - 支援 Tauri / Electron 置頂懸浮視窗與 VS Code 側邊欄，進階解析 DS1/DT1 地圖與四遍深度排序渲染。

---

## 4. 全平台通用 CLI 日誌適配層與標準事件協議 (Universal Log Adapter)

* **Layer 1: 輸入來源適配器 (Source Adapters)**：
  - File Tail Mode：非同步追蹤檔案 Offset 僅讀取增量行，杜絕磁碟 I/O 飆升與 Windows 檔案鎖死。
  - Stdout Pipe Mode：進程包裝器直接掛載至目標 Agent 標準輸出串流。
  - 本地推播端點：常駐 `POST /api/log` 與 WebSocket，外部腳本可主動推播。
* **Layer 2: 外掛解析器陣列 (Parser Matrix)**：
  - 各特定工具專屬 Parser（如 ClaudeCodeParser, CursorParser）。
  - 通用正則兜底解析器（GenericFallbackParser）：以啟發式關鍵字庫從雜亂終端中自動辨識 `thinking`、`tool_execute`、`tool_success`、`error_retry`、`usage_update`。
* **Layer 3: 標準事件協議 (Canonical Event Schema)**：
  前端與戰鬥導演僅認證標準 JSON 協議，事件類型包含：`idle`, `thinking`, `tool_execute`, `tool_success`, `error_retry`, `task_start`, `task_complete`, `usage_update`。

---

## 5. D2 戰鬥導演中樞與 10 層渲染架構 (Combat Director & Multi-Layer Scene Graph)

### 5.1 戰鬥導演中樞 (Combat Director)
* **平滑佇列與節奏控制**：建立 300ms 戰鬥緩衝佇列，高頻工具調用轉化為連擊（Combos）或割草，避免打斷動作前搖。
* **技能權重智能指派**：依動作特徵指派技能（檢索 ➔ 暴風雪/冰封球；執行指令 ➔ 熱誠/旋風斬；重構 ➔ 天降神雷）。
* **怪群波次調度**：小任務生成普通怪受擊；重試/報錯生成金怪；長任務開始召喚關底 Boss（Boss 血條即為子步驟進度條）。

### 5.2 技能四階段時間軸裝配 (Four-Stage Skill Timeline Assembly)
所有技能必須依循 D2 核心資料結構拆解為四階段動態裝配：
1. **Cast Animation**：英雄本體 DCC 施法/揮砍動作。
2. **Missile Flight**：彈道投射物飛行（直線、導引、折線、螺旋等）。
3. **Ground / Impact Overlay**：地表覆蓋層（霜凍、冰環、爆裂火光）。
4. **Hit Reaction & Particles**：怪物受擊後仰、碎冰粒子、加法混色（Trans: 1）閃光與衝擊音效。

### 5.3 10 層渲染深度排序架構 (10-Layer Scene Graph)
渲染引擎嚴格依深度從底至頂排序：
`MapLayer` ➔ `ShadowLayer` ➔ `GroundLayer` (地表靈氣 Back 層) ➔ `EntityLayer` (英雄與怪物本體) ➔ `GroundOverlayLayer` (地表靈氣 Front 層) ➔ `WallLayer` (矮牆與遮擋物) ➔ `MissileLayer` (飛行彈道與法術光芒) ➔ `EffectLayer` (打擊粒子與受擊閃光) ➔ `UILayer` (血球、藍球、經驗條) ➔ `DebugLayer` (碰撞框與網格)。

---

## 6. DCC / COF / 色盤原生解碼與雙層靈氣標準 (Authentic Asset Decoding)

* **零像素遮罩守護 (Zero Pixel-Mask Guard)**：
  DCC Stage 1 解碼時，`pixel_mask == 0` 的 4x4 像素單元不含新像素代碼。解碼器必須嚴格守護在 `if (pixel_mask != 0)` 之後才讀取代碼串流，嚴禁無條件讀取位元導致串流失步與畫面碎花亂碼。
* **真加法混色與圖集去黑邊特徵演算法 (True Additive Blending & De-Blacking Protocol)**：
  依據 `d2-engine` 鐵律 6 與工業級去黑標準，凡加法混色（DrawMode 3、靈氣、火焰、電光）素材，提取時像素亮度 $R + G + B < 50$ 或調色盤邊緣近黑索引（172, 173, 33, 34）強制將 Alpha 設為 0，嚴禁盲目賦予非零像素 Alpha = 255 導致產生實心黑邊色塊。繪製時配合 `globalCompositeOperation = 'lighter'` 混色，呈現通透純淨的暴雪原廠發光質感。
* **動態包圍盒安全裕度 (Bounding Box Margins)**：
  靈氣預留 `160x100`（中心錨點 80, 50）；投射物預留 `100x100`（50, 50）；天降法術（FoH）預留 `120x300`（60, 260），杜絕頂部被平切截斷。
* **PreDraw 前後景覆蓋與雙層立體包覆架構 (PreDraw Dual-Layer Registration)**：
  依據 `d2-engine` 鐵律 5 與 `Overlay.txt` 規範：
  - `PreDraw: 0` = 身前前景覆蓋（Foreground）：繪製於實體身前（如九頭海蛇地表烈焰 `HydraGroundFire`、前靈氣、出招火光），火舌自然舔舐下腹，消弭底部平面剪切感。
  - `PreDraw: 1` = 身後背景底襯（Background）：繪製於實體身後（如後靈氣、背後柔和光暈）。
* **營火地表著地統一標準 (Campfire Ground Anchoring)**：
  七英雄（793 幀）統一以 320x320 畫布、地表接觸點 `(BASE_ANCHOR_X = 160, BASE_ANCHOR_Y = 265)` 搭配 CSS `bottom: -55px` 錨定，徹底根除德魯伊身形垂直凌空浮動。

---

## 7. 2.5D 等距 2:1 幾何投影與順時針方向映射標準 (Isometric Geometry & Direction Engine)

### 7.1 等距 2:1 菱形投影與形態 A 彈道等速鐵律 (Isometric Grid vs. Linear Projectiles)
* **地面實體與地表幾何鋪設（2:1 縱深壓縮）**：
  暗黑 2 地表實體採用 2:1 菱形等軸測座標系，螢幕垂直方向（Y 軸）物理長度為水平方向（X 軸）的一半：
  - 適用範圍：地面實體行走位移、地表貼地危害（形態 C 火牆 offset）、地磚瓦片排列。
  - 地面幾何換算：`screenX = (wx - wy) * 26`, `screenY = (wx + wy) * 13`。
* **【形態 A 彈道等速鐵律】螢幕空間等速直線，嚴禁 Y 軸速度減半（依據 `d2-engine` 鐵律 1）**：
  - **核心準則**：直線投射物（火彈、火球、冰彈、冰風暴、冰川之刺、骨矛、牙、魔法箭等）在 2D 畫布上**永遠沿著施法點至目標點的直線歐幾里得向量等速前進**。
  - **發射起點**：$S_x = \text{caster}.x,\ S_y = \text{caster}.y - 32\text{px}$（胸膛基準面）。
  - **方向角度**：$\phi = (\text{atan2}(dy, dx) \times \frac{180}{\pi} + 360) \pmod{360}$。
  - **速度分量**：$v_x = \frac{dx}{\text{dist}} \times \text{Vel},\ v_y = \frac{dy}{\text{dist}} \times \text{Vel}$。
  - **絕對紅線**：**絕對禁止在螢幕投射物速度上套用等軸測半速壓縮（即嚴禁 `atan2(dy * 2, dx)` 或 `vy * 0.5`）**！此舉會導致投射物朝斜角飛行時軌跡扁化、上下飛行速度大幅減慢並產生上下顛簸。投射物是在螢幕空中直飛，絕非在地面爬行。
  - **受擊判定中心**：目標假人/怪物的受擊碰撞判定，必須以**實體接地點 $Y - 18\text{px}$** 為幾何球心進行半徑距離檢測（`d2-engine` 鐵律 3），嚴禁直接與地表情表點 $(x, y)$ 判定。

### 7.2 標準 8 方向順時針映射與 DCC 物理行轉置矩陣
* **順時針 8 方向標準（以正南為 0 號）**：
  `0: 南(90°), 1: 西南(135°), 2: 西(180°), 3: 西北(225°), 4: 北(270°), 5: 東北(315°), 6: 東(0°/360°), 7: 東南(45°)`。
  換算公式：`dir8 = Math.round((deg - 90 + 360) / 45) % 8;`
* **DCC 物理儲存行轉置矩陣**：
  原版 DCC 物理行為 `[SW(0), NW(1), NE(2), SE(3), S(4), W(5), N(6), E(7)]`。順時針方向對應之轉置查表矩陣為：
  `const DCC_ROW_MAP = [4, 0, 5, 1, 6, 2, 7, 3];`
  徹底解決左右移動時的倒退走（月球漫步）問題。

### 7.3 方向校準系統（量測取代猜測）
嚴禁寫死偏角或固化查表。所有投射物透過校準管線以 0~360° 每 5° 向量實測，儲存 `dirCount`、`dir0WorldAngle`、`clockwise` 與 `rotationMode`。驗收誤差必須小於半個離散格（8 向 < 22.5°，16 向 < 11.25°）。

---

## 8. 四大解耦座標系、易牙居 210 技能庫與接地驗收 (Coordinate Systems & Ground Alignment)

### 8.1 四大解耦座標系
系統架構嚴格拆解為四個獨立且數學自洽的空間層級：
1. **世界空間 (World Space)**：以邏輯網格定義實體坐標 `(wx, wy)`。
2. **圖片空間 (Image Space)**：背景大地圖的原生像素尺寸（含縮放比）。
3. **螢幕等軸測投影 (Screen Isometric Projection)**：`screenX = (wx - wy) * 26`, `screenY = (wx + wy) * 13`。
4. **畫布視口 (Canvas Viewport)**：包含相機追蹤平移偏移 `(camX, camY)`，點擊與繪製必須經過視口矩陣雙向逆運算。

### 8.2 易牙居繁體正統 210/210 技能資料庫
完整整合易牙居繁體中文資料庫（`assets/skills_database/`），嚴禁字母或行列粗暴排序，所有技能樹 UI 嚴格綁定 `(row, col)` 3x6 介面實測網格座標。

### 8.3 像素級實心肉身分離接地演算法 (Alpha > 200)
以 `Alpha > 200` 門檻分離半透明陰影（Alpha ~ 80）與靴底實體，結合最大連通區域濾除雜散噪點，動態計算雙足著地線，徹底杜絕野蠻人等身形下陷地表 10~15px 的瑕疵。

---

## 9. 標準化素材庫定位與舊目錄廢棄置換規範 (Normalized Assets Repository)

* **單一真理資產庫 (`diablo2_normalized_assets/`)**：
  專案素材庫（原始 Contact Sheet 大圖或外部抓取的未裁切圖）僅作為預覽參考，**絕非遊戲可直接播放之資產**。專案內所有正式程式碼統一且唯一引用經自動化管線清洗完畢之目錄：`diablo2_normalized_assets/`（及對應之 `web/assets/`）。
* **舊目錄廢棄**：原始未清洗之 `diablo2_sprites/` 視為已廢棄目錄，不得在正式程式碼中直接引用。
* **核心夥伴與召喚物檢索標準**：
  - 德魯伊狂狼 (Wolf)：完整 8 向奔馳、撲咬與倒地圖集。
  - 德魯伊灰熊 (Grizzly Bear)：原廠 `BG` 模組，8 向撲擊衝鋒與重掌拍擊。
  - 死靈法師黏土/鮮血/鋼鐵/火焰石魔 (Golem) 與骷髏僕從 (Skeletons)。
  - 英雄 16 方向全套動作圖集（Light / Medium / Heavy 裝甲三階級）。

---

## 10. 本機原廠 MPQ 數據唯一真理源與自動化萃取管線規範 (Official MPQ Pipeline)

### 10.1 本機原廠 MPQ 數據唯一真理源與實體路徑 (Authentic MPQ Truth Hierarchy)
素材與數值獲取嚴格遵循原廠唯一真理源規範（`d2-engine` 鐵律 8）：
1. **唯一實體 MPQ 檔案庫**：專案根目錄下的 `Diablo II 1.13c/`，包含完整 12 個封裝檔：
   - `Diablo II 1.13c/d2data.mpq`：基礎飛彈 DCC（`data\global\missiles\*.dcc`）、地磚瓦片、原生調色盤（`pal.dat`）。
   - `Diablo II 1.13c/Patch_D2.mpq`：1.13c 最新修訂數據表與熱修復 DCC。
   - `Diablo II 1.13c/d2exp.mpq`：資料片資產、刺客與德魯伊全套動作。
   - `Diablo II 1.13c/d2char.mpq`：七大職業裝甲與動作模型。
2. **唯一權威解包數據表目錄**：`readfirst/d2_reference_tables/`（與專案根目錄 `d2_reference_tables/`），包含官方 `Skills.txt`、`Missiles.txt`、`Overlay.txt`、`AnimData.D2`（及二進位解析之 JSON 映射）。所有判定幀、初速、射程、尺寸以此為準。
3. **二進位圖集萃取管線**：透過 `Diablo2-Agent-Monitor/tools/stormlib/x64/StormLib.dll` 驅動 `tools/d2_proj_toolkit.py` 與 `tools/extract_sorc_fire_assets.py` 解包並編譯為 Union-Box 正規化圖集。
4. **【原廠精靈圖唯一性鐵律】**：**絕對禁止以任何前端 Canvas 繪圖代碼（`ctx.stroke`、`ctx.lineTo`、自製向量碎形）或手刻幾何線條替代原廠精靈圖！**連鎖閃電等電系技能 100% 必須使用原廠二進位 DCC 萃取之圖集（如 `LightningStrike` 32 方向 8 幀圖集）播放，原廠從無前端劃線。
5. **雙權威官方網站目視檢驗標準**：
   - 暴雪官方亞瑞特峰 (Blizzard Arreat Summit)：`https://classic.battle.net/diablo2exp/skills/alphaskills.shtml`
   - 凱恩之角 DiabloWiki 技能百科：`https://wiki.d.163.com/index.php?title=%E5%88%86%E7%B1%BB:%E6%9A%97%E9%BB%912_%E6%8A%80%E8%83%BD`

### 10.2 自動化萃取管線工具 (`extract_missile_data.py`)
專案內建自動化萃取工具：`verification_sandbox/tools/extract_missile_data.py`。
* 讀取來源：`readfirst/d2_reference_tables/` 下之 `Missiles.txt` 與 `Skills.txt`。
* 輸出成果：
  - `verification_sandbox/src/data/d2_missiles_official.json`：收錄原廠 684 筆飛彈與 357 筆技能。
  - `verification_sandbox/src/data/d2-missile-specs.ts`：匯出強型別規格定義。

### 10.3 684 筆官方飛彈之「唯一導引」鐵證
根據 684 筆官方數據統計，全暗黑破壞神二代中具備 **`pSrvDoFunc: 7`（導引尋標 Homing/Seeking）** 行為的飛彈全遊戲**僅有 3 種**：
1. `guidedarrow`（亞馬遜導引箭）
2. `bonespirit`（死靈法師骨魂）
3. `monbonespirit`（怪物骨魂）
其餘 551 種投射物（包括火球、充能彈、冰彈、骨矛、箭矢等）在原廠規格中全部為 **`pSrvDoFunc: 1`（基礎直線飛行）** 或靜態圖騰。**嚴禁任何 Agent 將火球、充能彈等直線飛彈誤配為導引追蹤**。唯有 `Func 7` 飛彈才允許讀取 `Param1`（Retarget Frame）與 `Param2`（Retarget Radius）。

### 10.4 怪物受擊幾何中心與體積半徑融合規範
* **軀幹中心對齊（垂直偏移 -18px）**：
  怪物的受擊點必須由腳底陰影向上偏移 18 像素對齊胸口軀幹中心（`createUnit(dummy, 0, -18)`），杜絕穿透胸膛卻未接觸腳底的揮空誤判。
* **物理碰撞半徑融合**：
  碰撞有效距離為「投射物尺寸 ＋ 怪物受擊體積」（通常基底半徑設為 22px），徹底消除離散高速位移下的跳幀穿隧（Tunneling）。

---

## 11. 技能行為原語庫、固定步長時鐘與物件池架構 (Skill Engine Architecture)

### 11.1 全職業五大通用技能形態與二十大行為原語家族 (The 5 Universal Archetypes & 20 Behavioral Primitives)
依據 `d2-engine` 核心標準，全暗黑 2 技能分為 5 大通用形態（Archetypes A ~ E）與 20 大底層行為原語家族（F01 ~ F20），任何新技能實裝或重構皆依此模組化分流，嚴禁手寫孤立特化邏輯：
* **形態 A：直線/投射物彈道型**：
  - **F01 直線投射（穿透/命中爆裂）**：火焰彈、骨矛（穿透）、火球（爆裂）、魔法箭、冰刺（`linear_missile_template.ts`）。
  - **F02 弧線追蹤投射**：導引箭、骨魂、聖光彈（`linear_missile_template.ts` Homing）。
* **形態 B：持續引導噴流型**：
  - **F08 持續光束/粒子噴流**：地獄火、極地風暴、地獄火守衛（`hazard_and_stream_template.ts`）。
* **形態 C：地表幾何鋪設型**：
  - **F12 地面持續區域**：火牆 7 道火柱、地表毒雲（`hazard_and_stream_template.ts`）。
  - **F13 沿線依序爆發**：裂地術、火山噴發、火焰之路。
* **形態 D：多階段時間軸型**：
  - **F10 範圍天降打擊（多落點）**：暴風雪、毀天滅地、末日降臨。
  - **F11 定點延遲轟擊**：隕石天降（地面預警圈 ➔ 天頂貫落轟擊 ➔ 地表殘火）、天堂之拳（單體天頂神聖雷擊）。
* **形態 E：複合多實體召喚型**：
  - **F16 實體召喚**：九頭海蛇（三角陣列佈局、雙層 PreDraw 火光包覆、8 向嘴吻插槽與獨立索敵，`composite_minion_template.ts`）、石魔、狂狼、女武神。
  - **F17 部署物/陷阱**：雷光守衛、火之復甦、亡者守衛。
* **跨職業核心高保真通用家族（強制調用通用模板，嚴禁手刻特例）**：
  - **F06 環形新星擴散族（Radial Nova Expansion）**：
    - 涵蓋技能：電系新星 (Nova 48)、冰霜新星 (Frost Nova 44)、劇毒新星、火環新星、戰嚎震波。
    - 底層機制：依據 Phrozen Keep 原廠規範（`cltdofunc: 25 / pCltDoFunc: 1`），底層為 64 束直線飛彈均勻徑向推進。前端統一由 `radial_nova_template.ts` 驅動，使用累積弧長查找表（EllipseArcLut 8px 目標間距）進行等距取樣與 16 方向圖元對齊，在 `lighter` 加法混色下自然熔合成純白實心電光帶，嚴禁前端純向量畫橢圓。
  - **F09 連鎖電弧跳躍族（Chained Arc Jump）**：
    - 涵蓋技能：連鎖閃電 (Chain Lightning 53)、近戰閃電攻擊 (Lightning Strike)、墨菲斯托電弧。
    - 底層機制：依據 Phrozen Keep 原廠規範（`pCltDoFunc: 8 Subloops: 3` 與 `pCltHitFunc: 16`），從施法法杖至第一目標、目標到目標全程落實端點連續頂點吸附（Vertex Snapping），以 32 方向原廠精靈圖（`LightningStrike`）首尾無縫重疊密鋪，節點引爆原廠 20 幀 `ShockHitSm`。統一由 `chained_arc_template.ts` 驅動。
  - **複合型規範（如天堂之拳 Fist of the Heavens）**：
    - 由「天頂神聖落雷轟擊 (F11)」與「命中後母彈爆散聖光彈 (F07)」複合而成，非連鎖跳躍電弧 (F09)。

* **【已驗證技能保護鐵律】（`d2-engine` 鐵律 4）**：
  凡使用者或自動化測試已確認正常之技能（如暴風雪、冰封球、隕石、九頭海蛇、雷暴等），在修復或重構其他技能時**一律保持完全隔離**，嚴禁全域覆蓋或連帶破壞既有驗收成果！

### 11.2 25Hz 時鐘與畫面平滑插值解耦架構
* **邏輯步進**：維持原廠 25Hz（40ms/Tick）固定步長累加器，確保動畫播放速度與判定幀與原廠 100% 一致。
* **渲染平滑插值**：渲染使用 `requestAnimationFrame`，根據累加器餘裕時間進行實體座標平滑插值（`alpha = accumulator / 40ms`）：
  $$x_{\text{render}} = x_{\text{prev}} \times (1 - \alpha) + x_{\text{curr}} \times \alpha$$
  確保高刷螢幕上位移平滑順暢，無任何卡頓感。
* **常駐節能降頻**：看板視窗失焦或最小化時，自動降頻至 5~10Hz 或暫停運算，CPU 佔用 < 1%。

### 11.3 零 GC 投射物物件池 (Zero-GC Object Pool)
建構時一次性預配置固定容量，以空閒鏈表（Free-list）管理，配備世代標識符（Generation Handle）杜絕懸空引用，同屏數百枚投射物併發運行時 0 GC 停頓、記憶體穩定維持在低水平。

### 11.4 多混色模式支援 (blendMode 列舉)
封裝 `blendMode` 列舉（`normal`、`alpha25`、`alpha50`、`alpha75`、`additive`、`luminance`），嚴格隔離普通 Alpha 貼圖與加法混色貼圖，杜絕暗色背景產生黑邊或發光過曝。

---

## 12. 測試產出收納與獨立沙盒隔離規範 (Test Artifacts & Directory Protocol)

* **測試截圖與驗證圖像零容忍鐵律 (`testimages/`) [強制執行]**：
  - **嚴格禁止在專案根目錄產生任何測試截圖、驗收比對圖或臨時圖檔**。
  - 所有透過 Playwright 實機截圖、視覺稽核腳本、校準工具、調色盤切片或除錯產生的圖像檔案（`.png`, `.jpg`, `.webp`, `.gif` 等），**100% 必須直接儲存於 `testimages/` 目錄中**（例如 `testimages/test_fireball_flight.png`）。
  - 任何測試腳本若未將截圖輸出路徑導向 `testimages/`，一律視為重大合規違規。若在根目錄發現任何殘留測試圖像，必須立即執行清理移入 `testimages/`。
* **獨立驗證沙盒與臨時腳本隔離 (`verification_sandbox/` & `tools/`)**：
  - 用於單元測試、型別驗證、Benchmark 效能測量之臨時程式碼與測試腳本，統一收納於 `verification_sandbox/` 或 `tools/` 中。
  - 未經 100% 驗收前嚴禁直接覆蓋或污染正式專案目錄 (`Diablo2-Agent-Monitor/web/`)。

---

## 13. 原廠 DCC 投射物全域聯集盒、PCA 頭尾特徵對齊與 AnimData 脫手幀解析規範 (Authentic Missile Assembly & Orientation Protocol)

### 13.1 全域聯集盒圖集封裝規範 (Union-Box Atlas Packaging)
* **根除切邊刀痕**：嚴禁以單一影格或固定小方塊裁切投射物。解碼 DCC 圖集時，必須取得所有方向（Directions）與所有影格（Frames）在世界原點下的包圍盒座標，計算全域聯集盒：
  `minX = min(x0)`, `minY = min(y0)`, `maxX = max(x0 + w)`, `maxY = max(y0 + h)`
* **統一單元尺寸與中心錨點**：
  - 單元格尺寸：`cell_w = (maxX - minX) + 2 * padding`, `cell_h = (maxY - minY) + 2 * padding`
  - 世界原點中心錨點：`pivot_x = -minX + padding`, `pivot_y = -minY + padding`
  每個影格依自身的 offset 放置在 cell 中，使世界原點在每個單元格內精準位於相同座標 `(pivot_x, pivot_y)`。
* **位元級自檢守護**：圖集打包後必須執行位元級比對（與來源像素逐點相等）及全圖 Alpha 質量守恆檢驗，任何像素溢出或裁切即刻中止並報錯。

### 13.2 PCA 投射物頭尾基準線與 180° 消歧規範 (PCA Baseline & Orientation)
* **主成分分析特徵提取**：
  以像素質量分佈（Alpha 與亮度加權）計算二維共變異數矩陣並進行特徵分解，求得投射物長軸主成分向量 `v`。
* **頭尾消歧雙重證據**：
  - 沿軸偏度（Skewness）：長拖尾側為尾端。
  - 亮度重心偏移（Luminance Peak）：高光亮核集中側為彈頭。
  結合兩者計算方向評分，消除 180 度主軸方向歧義，精確標定彈頭核心點 `(head_x, head_y)` 與尾焰特徵點 `(tail_x, tail_y)`。
* **方向映射槽位校準**：
  不依賴 DCC 物理行順序，以 N 倍角圓周平均求得相位基準角，將 N 個方向映射至 360 度等分槽位，輸出 `directionMap` 與 `slotToDir` 對照表，自檢誤差必須小於容許閾值。

### 13.3 AnimData.d2 二進位脫手幀解析標準 (Authentic ReleaseFrame Extraction)
* **唯一真理源二進位結構**：
  `data\global\animdata.d2` 為 256 個 hash bucket 結構（Hash: `sum(ASCII(cof_name)) % 256`）。每筆記錄 160 位元組：`char[8] cof_name`, `uint32 frames`, `uint16 speed`, `uint16 reserved`, `uint8[144] events`。
* **脫手幀判定準則**：
  - 遠程發射（箭矢、標槍投擲）：事件標記碼為 `2`。
  - 法術施法（法師揮杖、死靈揚手）：事件標記碼為 `1`。
  - 脫手幀索引即為第一個標記事件的影格索引（例如死靈單手施法 `NESCHTH` 為第 8 幀；法師長杖施法 `SOSCSTF` 為第 7 幀；亞馬遜拉弓 `AMA1BOW` 為第 6 幀）。
  嚴禁肉眼隨意猜測出招前搖，一律透過 `AnimData.D2` 二進位讀取確認。

### 13.4 像素手部外緣錨定與發射基準規範 (Hand/Staff Tip Socketing)
* **原廠無骨骼節點之真相與增強方案**：
  暴雪原廠 DCC/COF 並無 3D 骨骼掛載點，原版投射物底層在施法者腳底世界座標生成並套用 Missiles.txt 偏移。專案正式確立 `hand_anchor` 增強標準：
  在脫手事件影格（Release Frame），分析施法者武器（RH）與手部圖層的像素，以角色軀幹胸膛高度（$Y - 32\text{px} \sim Y - 38\text{px}$，法師標準為 $Y - 32\text{px}$）為垂直基準線，朝發射面向外推進 16 ~ 20 像素（配合 `InitSteps = 1`）作為手部/法杖尖端發射錨點，絕不允許漂移至頭頂上空（Y - 80px）或腳底地面（Y - 0px）。

### 13.5 單一線性投射物絕對直線對齊準則 (Four-Point Linear Alignment)
* **四大關鍵點嚴格共線**：
  針對炎爆火球、骨矛、白骨之牙、多重箭矢、雷霆標槍等所有單一線性投射物，必須採用雙特徵點基準線動態旋轉圖集：
  $$\text{施法者手部} \longrightarrow \text{投射物尾端} \longrightarrow \text{投射物彈頭} \longrightarrow \text{目標怪物}$$
  四點必須嚴格落在同一條幾何連線上，飛行過程中絕不允許產生任何方向偏差或尾部歪斜。
* **導引追蹤型技能隔離**：
  僅有具備原廠 `pSrvDoFunc: 7` 屬性之導引技能（亞馬遜導引箭、死靈法師骨魂）隔離於此靜態直線鎖定之外，維持每秒 12 度等軸測圓滑尋標轉向軌跡。

---

## 14. 原廠 MPQ 數據表唯一真理源與技能動畫物理根本解法規範 (Authentic MPQ Reference & Physics Protocol)

### 14.1 數據真理源目錄鐵律 (`readfirst/d2_reference_tables/`) [強制執行]
* 本專案所有英雄與怪物動作、攻速、脫手前搖、飛彈速度、尺寸、射程、發射偏移與光環掛載，**100% 必須嚴格依據 `readfirst/d2_reference_tables/`（以及專案根目錄 `d2_reference_tables/`）目錄下解包之原廠官方數據表**（包含 `Missiles.txt`、`Skills.txt`、`monstats.txt`、`charstats.txt`、`Overlay.txt`、`AnimData.D2` 等），且動畫素材 100% 來自 `Diablo II 1.13c/` MPQ 封裝庫。
* 嚴禁憑空捏造或肉眼猜測物理參數，任何動畫與技能實作必須有對應數據表欄位支持。

### 14.2 原廠全技能與特效物理發射錨點「十二大完整體系」（Twelve-Tier Authentic Physics & FX Taxonomy）
嚴格杜絕「所有技能一概由手部發射」的一刀切概括化誤區。所有角色與怪物技能必須通過發射路由閘門（Routing Gate），嚴格依據下列十二大原廠體系之幾何基準與物理參數進行分流：

1. **空中手部/武器直射投射物（Airborne Hand & Weapon Missiles）**：
   - **幾何基準**：胸膛手部發射錨點（接地點向上 32 至 38 像素，即 $Y - 32\text{px} \sim Y - 38\text{px}$，法師標準為 $Y - 32\text{px}$）+ 原廠身前半步前推（`InitSteps = 1`，沿發射方向推進 16~20 像素，出現在手掌或槍尖外緣）。
   - **原廠參數**：高度偏移 `zoffset = 0`，螢幕歐幾里得直線朝目標胸口高度（$Y - 18\text{px}$）等速飛行，嚴禁 $vy * 0.5$。
   - **涵蓋英雄技能**：魔法使火球（FireBall）、初級火球（FireBolt）、充能彈（ChargedBolt）；死靈法師骨矛（BoneSpear）、白骨之牙（Teeth，7芒散射）；亞馬遜速射箭矢（Arrow）、多重箭（Multishot）、導引箭（GuidedArrow）、標槍投擲（JavelinThrow）；聖騎士聖光彈（HolyBolt）；刺客刃之怒（BladeFury）。
   - **涵蓋怪物技能**：沉淪魔巫師火球（ShamanFire）、吸血鬼火球（VampireFireball）、不死法師不潔之彈（UnHolyBolt）、督瑞爾/骷髏射手箭矢、墨菲斯托充能彈。

2. **地表水平面環形衝擊波（Ground-Level Radial Novas & Shockwaves - F06）**：
   - **幾何基準**：施法者**「腳底接地點（Y 原點，Y - 0px）」**，初始前推 `InitSteps = 0`，高度偏移 `zoffset = 0`，嚴禁懸空掛載於胸口。
   - **原廠底層機制（依據 `d2-engine` 規範）**：底層為 64 束直線飛彈均勻徑向推進（`cltdofunc: 25 / pCltDoFunc: 1`），全波貼地 2:1 等軸測擴展。在現代 Canvas 渲染中，強制調用 `radial_nova_template.ts`，以累積弧長查找表（EllipseArcLut 8px）進行等距密鋪，相鄰原廠精靈圖（如 `ElectricNova`、`frost_nova`）在 `lighter` 加法混色下自然熔接成厚實純白閉合光環，**絕對禁止前端以 Canvas 幾何代碼（ctx.stroke / ctx.arc / ctx.ellipse）向量手繪**！
   - **涵蓋英雄技能**：魔法使電系新星（Nova 48）、冰霜新星（Frost Nova 44）；死靈法師劇毒新星（Poison Nova）；野蠻人戰吼（War Cry）、狂嗥（Howl）、嘲弄（Taunt）、戰鬥狂嗥（Battle Cry）；德魯伊熊人震波（Shock Wave）。
   - **涵蓋怪物技能**：墨菲斯托冰霜新星（MephFrostNova）、巴爾極寒波（Baal Cold Wave）、暗黑破壞神環形火圈、冰冷強化怪物死亡霜爆。

3. **地表貼地實體氣旋與移行障礙（Ground-Tethered Entities & Hazards - F12 / F14）**：
   - **幾何基準**：施法者**「腳底接地點（Y 原點）」**。生成瞬間風眼底座或火焰根部 100% 緊貼地面網格，沿著地表等軸測座標移行。
   - **原廠參數**：`zoffset = 0`，`InitSteps = 0`，精靈圖底部即為地表摩擦面。
   - **涵蓋英雄技能**：德魯伊龍捲風（Tornado，行為代碼 27 沿地面隨機蛇行）、小旋風（Twister）；魔法使火牆（Fire Wall，7 道火柱 2:1 菱形排列）；刺客雷電網（Shock Web）；死靈法師骨牆（Bone Wall）、骨牢（Bone Prison）。
   - **涵蓋怪物技能**：吸血鬼火牆（VampireFirewall）、安達利爾劇毒地表噴濺（AndarialSpray）、死亡甲蟲受擊充能電火花。

4. **天降打擊與目標點召喚（Target Point / Sky Down & Ground AoE - F10 / F11）**：
   - **幾何基準**：以目標滑鼠游標處之**「地表目標接地點 (TargetX, TargetY)」**為基準。投射物自天頂垂直或斜向下砸，命中地面後在接地點引爆地表 Overlay。
   - **涵蓋英雄技能**：魔法使暴風雪（Blizzard）、隕石（Meteor，17 幀預警指示圈 ➔ 42 幀天頂急墜 ➔ 3.6 秒地面殘火）；聖騎士天堂之拳（Fist of the Heavens，單體天頂神聖雷擊 + 爆裂聖光彈）；德魯伊毀天滅地（Armageddon）、火山（Volcano）、裂地術（Fissure）；刺客雷光守衛（Lightning Sentry）、死亡守衛（Death Sentry）。
   - **涵蓋怪物技能**：吸血鬼隕石、巴爾天降落石、暗黑破壞神火雨、議會成員九頭蛇（Hydra）。

5. **持續射線與引導噴流（Continuous Streams / Beams / Hoses - F08）**：
   - **幾何基準**：施法者手部或怪物嘴角（`Y - 38px` 或嘴角高）。多節段連續噴射，第一段向外前推咬合於掌心或嘴角前端，嚴禁覆蓋本體身軀。
   - **涵蓋英雄技能**：魔法使地獄之火（Inferno）、德魯伊極地風暴（Arctic Blast）、刺客地獄火守衛。
   - **涵蓋怪物技能**：暗黑破壞神紅色閃電射線（Red Lightning Hose）、小矮人噴火（FetishInferno）、沙蟲噴吐酸液。

6. **地表靈氣前後雙層環（Ground Auras - Dual Layer PreDraw - F15）**：
   - **原廠幾何與分層（依據 Overlay.txt 的 PreDraw 規範）**：
     - **幾何中心**：百分之百固定於英雄或怪物的**「腳底接地點（Y 原點，Y - 0px）」**，套用 2:1 扁平橢圓。
     - **後層（Back Layer，PreDraw = 1）**：在角色繪製前先繪於腳跟後方地表（如聖騎士後靈氣 `AuraBack`、**魔法使雷暴常駐旋轉電環 `ThunderstormCast_operate`**）。角色完美踩在靈氣旋轉中心，消除凌空懸浮。
     - **前層（Front Layer，PreDraw = 0）**：在角色繪製後覆蓋於腳尖前方地表，達成角色身前立體包裹感。
   - **涵蓋英雄技能**：聖騎士 20 種攻防靈氣（聖火、狂熱、力量、祈禱、反抗、審判、冥思、神聖冰凍、神聖衝擊等）；魔法使雷暴常駐護體電環。
   - **涵蓋怪物技能**：暗金怪特別強壯、狂熱、聖火、聖冰靈氣、小矮人薩滿靈氣。

7. **幾何軌道與自體迴旋/追蹤飛彈（Orbit / Spiral / Homing Missiles）**：
   - **幾何基準**：特殊數學軌跡。
   - **代表技能**：
     - 聖騎士祝聖之槌（Blessed Hammer）：原廠 `InitSteps = 6`，以施法者身側腰際為原點，沿阿基米德螺旋線向外擴散。
     - 死靈法師白骨之魂（Bone Spirit）：原廠標註 `zoffset = -30`，空中懸浮追蹤，朝目標胸口飛撲。
     - 刺客心靈之槌（Psychic Hammer）。

8. **身軀護甲與狀態光效覆蓋（Body Buffs / Armor Overlays）**：
   - **幾何基準（依據 Overlay.txt 規格）**：跟隨角色本體身軀中心（`Y - 38px`）或頭頂（`Y - 65px`）動態位移。
   - **代表技能**：魔法使能量護盾（頭頂光球）、冰封裝甲/碎冰裝甲/寒冰裝甲；死靈白骨裝甲；聖騎士聖盾術；刺客速度爆發、能量消解、暗影斗篷；野蠻人大叫、戰鬥體質；德魯伊颶風裝甲。

9. **目標點頭頂詛咒與減益狀態（Targeted Head Curses / Debuffs）**：
   - **幾何基準**：依據目標怪物的 `OverlayHeight`，懸掛於怪物頭頂上方 10~15 像素處。
   - **代表技能**：死靈法師全系詛咒（傷害加深、衰老、微暗靈視、鐵娘子、偷取生命、降低抵抗）；冰凍全身泛藍；中毒全身慘綠；眩暈旋轉金星。

10. **地表屍體目標互動（Corpse Interactions & Detonations）**：
    - **幾何基準**：以地表殘留屍體的**「地表接地點 (CorpseX, CorpseY)」**為爆炸或召喚原點。
    - **代表技能**：死靈法師屍體爆炸（Corpse Explosion）、毒氣爆、骷髏復生、石魔召喚；野蠻人尋找藥劑/尋找物品；德魯伊食屍藤、毒藤。

11. **近戰打擊、突進與跳躍物理（Melee Attacks, Dashes & Leaps）**：
    - **幾何基準**：武器刀刃外緣判定；跳躍類技能具備拋物線垂直起跳（Z 軸高度抬升），但地表投影陰影嚴格留在 2:1 地面上。
    - **代表技能**：普通近戰揮擊、刺客龍爪/龍尾；野蠻人旋風斬（穿身穿刺割草）、跳躍/跳躍攻擊；聖騎士衝鋒、重擊。

12. **僕從與召喚實體（Summons & Minion Entities）**：
    - **幾何基準**：獨立 AI 實體，具備自有的接地點、碰撞體積與 2:1 地面陰影。
    - **代表技能**：死靈法師石魔與骷髏大軍；德魯伊灰熊、狂狼、烏鴉、自然之靈；亞馬遜女武神；刺客影子大師。

### 14.3 精靈圖切片邊界與足部完整性守護鐵律（Sprite Boundary & Foot Anchoring Integrity）
* **跨行切片邊界溢出嚴格檢驗**：
  任何英雄或怪物的多方向精靈圖集（Sprite Sheets），各動作方向單元格之間嚴禁發生垂直邊界截斷或行間像素漂移。
  若檢測到某方向之精靈圖高度異常短缺（例如法師朝右待機腳部短缺 15 像素）或有殘留靴子溢出至相鄰行，必須立即修復該圖集之切片配置，確保 16 方向雙腳 100% 完整著地於接地基準線，絕不允許切換動作時發生「沉入地面」或「懸空飄移」之缺陷。

---

## 15. 角色施展動作模式映射與技能體系架構規範 (Character Animation Modes & Skill Builds Engine)

### 15.1 動作模式代碼映射鐵律（依據原廠 `PlrMode.txt` 與 `Skills.txt`）
全專案在觸發角色技能時，角色本體所播放的動作狀態（Player Modes）必須嚴格依照原廠數據表映射，杜絕動作錯置：

1. **施法與戰嚎（SC - Special Cast）**：
   - **定義**：法術念咒（法杖高舉、雙手施咒）或野蠻人仰天咆哮戰嚎動作。
   - **允許調用**：
     - 魔法使純法術（火球、暴風雪、閃電、新星等）。
     - 死靈法師詛咒與白骨召喚法術。
     - 野蠻人**「戰嚎系（Warcry）」**：戰鬥體制（Battle Orders）、大叫（Shout）、戰鬥指揮（Battle Command）、狂嗥（Howl）、震撼戰嚎（War Cry）。
   - **嚴格禁忌**：**絕對嚴禁**將近戰技能、位移穿刺技能（特別是旋風斬 Whirlwind）配置為 SC，嚴禁出現「先仰天大吼再旋風割草」的節奏錯亂。

2. **武器打擊與揮砍（A1 / A2 - Attack 1 / Attack 2）**：
   - **定義**：主手/副手武器直刺、劈砍、重砸。
   - **允許調用**：普通攻擊、狂戰士（Berserk）、重擊（Bash）、專注打擊（Concentrate）、聖騎士熱誠（Zeal）、復仇（Vengeance）、亞馬遜標槍戳刺（Jab）。

3. **連續動作與旋轉位移序列（SQ - Sequence）**：
   - **定義**：不中斷的連續多段位移打擊序列。
   - **允許調用**：
     - **野蠻人旋風斬（Whirlwind, Id 151）**：原廠定義 `anim = SQ`，`seqtrans = A1`。必須自施法類別（casts）徹底剝離，直接進入攻擊位移姿態，持械 360 度連續轉向位移穿透怪物群，0 吼叫動作干擾。
     - **聖騎士衝鋒（Charge）**：高速突進撞擊。
     - **刺客連擊武術（Claw Sequences）**。

4. **腿部專屬踢擊（KK - Kick）**：
   - **定義**：刺客專用原廠飛踢動作。
   - **允許調用**：刺客龍爪飛踢（Dragon Talon）、神龍擺尾（Dragon Tail）。

5. **遠程武器投擲（TH - Throw）**：
   - **定義**：單手/雙手投擲動作。
   - **允許調用**：亞馬遜標槍投擲（Poison Javelin, Lightning Fury）、野蠻人雙重投擲。

---

### 15.2 技能體系架構與切換規範 (Skill Builds Engine)
專案全面落實使用者自訂的「體系化技能分流架構」，避免技能過多導致快捷鍵混亂，劃分為五大多體系職業與兩大全能職業：

1. **五大多體系切換職業**（支援按下 `[V]` 鍵或 UI 點擊即時輪轉體系）：
   - **魔法使 (Sorceress)**：
     - 【純火系 (Fire)】：火彈、火球、熾烈之徑、火牆、隕石、九頭蛇、地獄之火。
     - 【純電系 (Lightning)】：充能彈 (38)、新星 (48，64 發直線飛彈配合 8px 等弧長 LUT 與加法熔接成環)、連鎖閃電 (53，100% 綁定原廠 LightningStrike 32 方向帶狀電弧圖集，頂點連續吸附與 20 幀命中衝擊波，嚴禁 Canvas 劃線)、雷暴 (57，腳底地面旋轉常駐電環 PreDraw: 1, Height: 0 + 定時垂直落雷打擊，嚴禁頭頂雷雲誤區)。
     - 【純冰系 (Cold)】：冰彈、冰甲、碎冰甲、寒冰裝甲、冰風暴、冰霜新星、冰川之刺、暴風雪、冰封球。
   - **德魯伊 (Druid)**：
     - 【元素系 (Elemental)】：火風暴、熔岩巨石、裂縫、火山、極地風暴、小旋風、龍捲風、暴風、毀天滅地。
     - 【變形系 (Shape Shifting)】：狼人變化、熊人變化、撞擊、狂性大發、狂犬病、烈焰爪、震波、狂怒。
     - 【召喚系 (Summoning)】：烏鴉、劇毒藤蔓、食屍藤、太陽藤、鬼狼、兇狼、灰熊、橡木智者、狼獾之心、棘靈。
   - **死靈法師 (Necromancer)**：
     - 【毒骨系 (Poison & Bone)】：白骨裝甲、白骨之牙、骨矛、骨魂、劇毒匕首、劇毒新星、屍體爆炸、毒爆。
     - 【召喚系 (Summoning)】：復生骷髏、骷髏法師、重生、黏土魔像、鮮血魔像、鋼鐵魔像、火焰魔像。
   - **亞馬遜 (Amazon)**：
     - 【弓箭系 (Bow)】：魔法箭、火箭、冰箭、多重箭、爆裂箭、急凍箭、導引箭、掃射、燃燒箭、凍結箭。
     - 【標槍系 (Javelin)】：戳刺、強力一擊、毒氣標槍、刺爆、閃電球、充能一擊、瘟疫標槍、刺擊、閃電一擊、閃電之怒。
     - **跨體系通用僕從**：女武神（Valkyrie）為弓箭系與標槍系皆可召喚之通用終極僕從。
   - **刺客 (Assassin)**：
     - 【陷阱系 (Traps)】：火焰爆震、電能網、刃之守衛、雷電網陷阱、火之復甦陷阱、刃之狂怒、雷光守衛、復甦獄火、亡者守衛、刀刃之盾。
     - 【武術系 (Martial Arts)】：虎擊、龍爪飛踢、焰拳、雙龍爪、眼鏡蛇擊、雷電爪、神龍擺尾、寒冰刃、飛龍在天、鳳凰連擊。
     - **跨體系通用僕從**：暗影宗師（Shadow Master）為陷阱系與武術系皆可召喚之通用守衛。

2. **兩大全能整合職業**（單一技能池，無須切換體系）：
   - **聖騎士 (Paladin)**：全作戰打擊技能（重擊、熱誠、衝鋒、復仇、祝聖之槌、天堂之拳）+ 全攻防靈氣池（`[Q]` 鍵輪轉）。
   - **野蠻人 (Barbarian)**：全近戰打擊技能（重擊、跳躍攻擊、雙重打擊、狂亂、旋風斬、狂戰士、專注）+ 戰嚎咆哮（大叫、戰鬥體制、震撼戰嚎）。

---

### 15.3 繁體中文技能名與 d2-engine 英文模板對照矩陣 (Bilingual Skill Mapping Matrix)
為避免多 Agent 開發或跨語言指令產生語義偏移，所有代碼實現與檔案命名必須嚴格遵循以下映射標準，一律以 `d2-engine` 規範之英文模板與原廠 DCC 命名為準：

| 繁體中文技能名稱 | 英文原廠名稱 (Missile / Skill) | 核心行為分類 (Behavior Archetype) | 原廠圖資名稱 (CelFile / Asset) | 標準實作模板 (d2-engine Template) |
| :--- | :--- | :--- | :--- | :--- |
| **新星** | Nova (Nova / Frost Nova / Poison Nova) | F06 環形新星擴散 (Radial Nova) | `novacharge` / `novafrost` / `novapoison` | `radial_nova_template.ts` (64 飛彈等弧長 8px 熔接) |
| **連鎖閃電** | Chain Lightning (Lightning Strike) | F09 連鎖電弧跳躍 (Chained Arc) | `lightningscan` / `lightningstrike` | `chained_arc_template.ts` (端點吸附 Vertex Snapping) |
| **雷暴** | Thunder Storm | F10 垂直落雷打擊 (Vertical Thunder Strike) | `ThunderstormCast_operate` / `thunder` | `vertical_strike_template.ts` (腳底電環 + 頂部落雷) |
| **充能彈** | Charged Bolt | F01 隨機擺動直線飛行 (Wiggle Projectile) | `chargedbolt` | `linear_projectile_template.ts` (微幅正弦擺動) |
| **熾烈之徑** | Blaze | F08 地面灼燒殘留 (Ground Hazard) | `blazefire` / `firewall` | `ground_hazard_template.ts` (雙層混合加法渲染) |
| **火球** | Fire Ball | F01 直線飛行爆破 (Exploding Projectile) | `fireball` / `fireballexplode` | `linear_projectile_template.ts` (命中爆破子飛彈) |
| **暴風雪** | Blizzard | F11 範圍隨機落冰 (Sky Shower Rain) | `icefall` / `icefallexplode` | `sky_shower_template.ts` (區域隨機垂直降落) |
| **冰封球** | Frozen Orb | F07 自旋母體旋轉發射 (Rotating Parent Spawner) | `frozenorb` / `icebolt` | `rotating_spawner_template.ts` (飛行旋轉噴射冰彈) |
| **多重箭** | Multiple Shot | F04 扇形散射彈幕 (Spread Missiles) | `arrow` | `spread_missile_template.ts` (奇偶偏移扇形展開) |
| **導引箭** | Guided Arrow | F05 追蹤轉向飛彈 (Homing Seeking) | `guidedarrow` | `homing_missile_template.ts` (角速度平滑插值轉向) |
| **祝聖之槌** | Blessed Hammer | F03 阿基米德螺線擴散 (Spiral Missile) | `blessedhammer` | `spiral_missile_template.ts` (極座標等角螺線運動) |
| **天堂之拳** | Fist of the Heavens | F10/F01 天降落雷轉充能彈 (Sky Strike Spawner) | `holylight` / `holybolt` | `vertical_strike_template.ts` (垂直打擊後爆發聖光彈) |
| **女武神** | Valkyrie | F15 智能僕從召喚 (AI Summon Minion) | `valkyrie` | `summon_minion_template.ts` (獨立狀態機與血量管理) |
| **暗影宗師** | Shadow Master | F15 智能僕從召喚 (AI Summon Minion) | `shadowmaster` | `summon_minion_template.ts` (鏡像技能池與仇恨控制) |




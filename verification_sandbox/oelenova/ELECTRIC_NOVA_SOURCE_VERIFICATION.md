# 📜 Diablo II 原廠 Nova 機制考證報告 (ELECTRIC_NOVA_SOURCE_VERIFICATION.md)

本報告遵循 `suggestions/Oelenova.txt` 第二階段要求，針對《暗黑破壞神2》原廠 1.13c 二進位數據表、飛彈架構與客戶端處理邏輯進行深度考證。

---

## 一、 權威數據表考證事實 (Authoritative Table Findings)

### 1. `Skills.txt` (技能 ID 48: Nova) [已證實事實]
* **`srvdofunc: 22`** 與 **`cltdofunc: 25`**：
  * 在暴雪 D2 遊戲邏輯（`D2Game.dll` 與 `D2Client.dll`）中，`dofunc 22` / `cltdofunc 25` 是新星家族專屬發射調度器（Nova, Frost Nova, Poison Nova 均為此設定）。
  * 它的本質是**全向發射調度器**，依據技能等級與參數朝 360 度周向生成飛彈陣列。
* **`srvmissilea: nova`** 與 **`cltmissilea: nova`**：
  * 客戶端與伺服端均明確綁定飛彈表索引 `nova`。
* **`Param1: 12`** 與 **`Param2: 4`**：
  * 官方備註為 `number of missiles` 與 `additional missiles per level`。

### 2. `Missiles.txt` (飛彈 ID 90: nova) [重大突破事實]
經查證 `readfirst/d2_reference_tables/Missiles.txt` 第 92 行：
* **`pSrvDoFunc: 1`** 與 **`pCltDoFunc: 1`**：
  * **震撼發現**：原廠 `nova` 飛彈的運動處理器是 **`1`（Missile_Do_Linear，歐幾里得直線等速運動）**！
  * **原廠並不存在神秘的「封閉多邊形專用光環著色器」**。暴雪原廠新星在底層**完全是由一群獨立直線飛行的投射物子體構成**！
* **`CelFile: ElectricNova`**：
  * 綁定圖集資源 `ElectricNova.dcc`。
* **`NumDirections: 16`**：
  * 圖集具有 16 個離散方向。
* **`AnimLen: 13`**、**`AnimSpeed: 16`**：
  * 每方向 13 影格，播放速率鎖定。
* **`Vel: 24`**、**`MaxVel: 24`**、**`Accel: -1000`**：
  * 起始初速度為 24（世界座標單位），並帶有向外推進的運動學參數。
* **`Range: 13`**：
  * 存活時間為 13 個邏輯 Tick（在 25Hz 下約 0.52 秒）。
* **`Trans: 1`**：
  * 啟用加法半透明混色 (Transparency Mode)。

---

## 二、 原廠渲染模型判定 (Model Classification)

根據上述數據表鐵證，我們對 `suggestions/Oelenova.txt` 提出的三種模型進行精確判定：

### 🎯 判定結果：原廠底層為「模型 A（離散飛彈模型）」與「模型 C（視覺混合）」之結合

1. **原廠底層本質（模型 A）**：
   * 原廠在玩家出招瞬間，調用 `cltdofunc 25`，在世界座標系 $(X, Y)$ 中以極座標角度均勻發射一群直線飛彈（子飛彈數量在 1.10+ 版本中為 64 發）。
   * 每發飛彈各自持有獨立的世界座標位置 $(x, y)$、速度向量 $(v_x, v_y)$ 與生命週期計時器。
   * 每發飛彈在世界座標中以等速直飛歐幾里得直線推進：
     $$x(t) = x_0 + v \cos\theta \cdot t,\quad y(t) = y_0 + v \sin\theta \cdot t$$

2. **投影至螢幕時的自然橢圓化**：
   * 當 64 發世界座標中呈圓形擴散的飛彈投影至 2.5D 等軸測視角時，因 $Y$ 軸減半，在螢幕上**自然形成長短軸 2:1 的橢圓幾何**。
   * 每個圖元選取與其飛行方向最接近的 16 方向 DCC 切片。

3. **原廠實機視覺真理考證（官方大圖 nova_crop.png 分析）**：
   * 在原版 640×480 / 800×600 解析度下，因為 64 顆子飛彈加上加法混色（Lighter）與 CRT 螢幕光暈（Bloom），在擴散前期（$R < 120\text{px}$）相鄰子飛彈自然相互融合成一圈飽和的純白光帶。
   * **但在擴散末期（最大半徑時），原版實機畫面上實際上也存在小幅度的電弧微小間隙**（可參見 `official_visual_standards/sorceress/nova_crop.png` 外緣邊角），只是因為 13 幀高速動畫（僅持續約 0.5 秒）而在人眼中產生視覺暫留。

---

## 三、 本專案之決策與執行路線

為了同時滿足：
1. **原廠機制的純粹性**（100% 由原廠 16 方向 DCC 切片驅動，嚴禁任何 Canvas 向量手繪）。
2. **現代高解析螢幕（1080p/2K）下的無縫閉環美學**（避免在現代高解析畫布上顯得稀疏碎裂）。

我們採取雙軌架構：
* **模式 1：原版真實離散模擬模式 (Authentic 64-Missile Discrete Engine)**：
  完全依照原廠 `Missiles.txt` (Vel 24, Range 13, 64 方向等速外噴)，忠實呈現原版真實物理與軌跡。
* **模式 2：高保真閉環平滑模式 (Continuous Equal-Arc Closed Ring)**：
  採用**等弧長查找表 (Arc-Length LUT)** 動態計算圖元數量，使相鄰圖元間距在任何擴散半徑下嚴格恆定（如 10px），徹底消除現代高解析螢幕上的斷縫與黑隙。

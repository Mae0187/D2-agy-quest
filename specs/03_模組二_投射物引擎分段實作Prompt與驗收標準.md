# 模組二：投射物引擎分段實作 Prompt 規格與驗收標準 (specs/03)

---

## 1. 使用導讀與交付策略
為避免一次性將過度龐大的需求餵給外部 AI 導致產出空泛或遺漏細節，本模組嚴格採用**「三輪分段式提問」**機制：
* **共通表頭**：每一輪對話的最頂部必須固定附帶，鎖定硬性架構約束。
* **第 1 輪**：投射物方向與座標數學核心（純數學計算、Vitest 單元測試、零 DOM 依賴）。
* **第 2 輪**：方向校準工具實作（PCA 影像加權主軸量測、自動擬合與校準報表）。
* **第 3 輪**：投射物執行期架構（行為原語庫、物件池、25Hz 主循環與除錯覆蓋層）。
* **前置依賴門檻**：前一輪的程式碼通過單元測試並驗收完畢後，方可開啟下一輪。

---

## 2. 【共通表頭】（每一輪提問必備）

```markdown
### 角色背景與專案目標
你是精通《暗黑破壞神2：毀滅之王》（Diablo II: LOD）原廠底層架構（DCC / COF / MPQ）與 TypeScript 高效能遊戲開發的高級遊戲架構師。
我們正在開發基於 Web 的 D2 2.5D 等距（Isometric）AI Agent 戰鬥監控看板。此專案核心是「視覺還原與狀態映射」，不需要伺服器數值與抗性模擬。

### 硬性技術約束
1. 視角幾何：2.5D 等距視角（Tile 5x5 subtile 32x16px，長寬比 2:1）。
   - 地面平面螢幕角定義：φ = atan2(dy * 2, dx)（dx, dy 為螢幕像素位移量；φ=0 為正右方，Y 向下，φ 遞增為順時針旋轉）。
   - 行為層一律使用「地面平面（未壓縮）像素 / tick」計算，只在渲染繪製的最後一步將螢幕 Y 速度乘以 0.5。
2. 離散方向與校準：投射物為 DCC 預渲染離散方向。
   - 嚴禁使用 CSS transform: rotate()，嚴禁自由旋轉有方向性的貼圖。
   - 嚴禁在程式碼中硬編碼 135°/160° 偏角或固定查表矩陣；必須使用外部校準參數：dirCount, dir0WorldAngle, clockwise, rotationMode ('discrete' | 'none' | 'free')。
3. 時鐘與渲染：邏輯維持 25Hz 固定步長（1 Tick = 40ms），渲染端採用位置線性插值（lerp）；動畫幀以整數累加器推進（acc += speed; while(acc >= 256) frame++），禁止使用固定 60FPS tween 補間。
4. 混色支援：以 BlendMode 列舉處理（包含 Normal, Additive, Screen 等），混色與調色盤染色（paletteShift）為獨立維度。
5. 記憶體管理：投射物必須採用物件池（Object Pool），在穩態運行下每 Tick 不得配置新物件。

### 禁止事項
- 嚴禁使用 Math.atan2(dy, dx) 計算投射物方向（理論最大幾何偏差達 19.5°）。
- 嚴禁憑記憶編造原廠未經本機驗證的數值；不確定處一律標記為參數。
- 嚴禁將 Skills.txt 當作動作判定幀來源（判定幀主要來自 AnimData.D2 與 COF）。

### 回答格式標準
1. 請先列出「你的假設清單」與「待我確認的問題」（最多 5 條），再給出成果。
2. 程式碼必須是嚴格模式的 TypeScript（strict mode），核心數學演算法不得依賴任何瀏覽器 DOM API。
3. 必須附帶可運行的單元測試（Vitest），並詳細說明如何執行。
4. 結尾請明確列出「你不確定的 D2 原廠細節」。

### 本專案技術棧與真實環境
- 核心語言：TypeScript / Modern ES Modules
- 渲染環境：HTML5 Canvas 2D（主執行緒繪製，支援 OffscreenCanvas 預解碼）
- 瀏覽器目標：Chrome 120+ / Edge / Electron
```

---

## 3. 【第 1 輪】方向與座標核心（純數學模組）

```markdown
### 任務目標
實作純數學模組 `geometry.ts` 與 `direction.ts`：
1. 實作 `screenToPhi(dx: number, dy: number): number` 與 `phiToScreenVelocity(phi: number, speed: number): { vx: number, vy: number }`（內建 Y * 0.5 投影）。
2. 實作 `dirIndex(phi: number, calibration: DirectionCalibration): number` 與反向解算 `indexToPhi(index: number, calibration: DirectionCalibration): number`。
   - 必須原生支援 dirCount ∈ {1, 8, 16, 32}。
   - 必須原生支援 clockwise ∈ {true, false}。
   - 必須原生支援任意起始偏角 dir0WorldAngle ∈ [0, 360)。
3. 定義完整的 `DirectionCalibration` 型別介面與 JSON Schema 校驗規則。

### 驗收條件（必須 100% 通過 Vitest 單元測試）
1. 往返可逆測試：φ 從 0° 到 355° 每隔 5° 共 72 個角度，|screenToPhi(phiToScreenVelocity(φ)) - φ| < 1e-9。
2. 離散邊界測試：針對 dirCount ∈ {8, 16, 32} × clockwise ∈ {true, false} × dir0 ∈ {0, 45, 135, 160, 270}，在所有離散半步角的 ±0.5° 處，方向幀索引完全符合四捨五入預期。
3. 速度幾何保真：對任意角度 φ，螢幕速度嚴格滿足 vy / vx = tan(φ) * 0.5（vx ≠ 0 時）。
4. 對照測試：以數學證明 atan2(dy, dx) 相較於 φ 的最大偏差剛好為 19.5°（tan(θ) = √2 處），並在測試中固定該偏差值。
5. 循環邊界安全：所有 index 輸出必須嚴格落在 [0, dirCount) 整數範圍內，絕無負數或越界。
```

---

## 4. 【第 2 輪】校準量測工具（影像特徵提取）

```markdown
### 前置依賴
第 1 輪之 `geometry.ts` 與 `direction.ts` 已通過 100% 單元測試。

### 任務目標
實作 `calibrate.ts`：輸入指定投射物的多方向行代表影格（`ImageData[]`），自動分析並輸出 `DirectionCalibration`：
1. 利用 Alpha 通道進行像素加權主成分分析（PCA），計算主軸角度與離心率。
2. 將螢幕主軸角度逆轉為地面平面角 φ（Y * 2）。
3. 根據沿主軸的像素分佈偏態（箭頭尖銳、箭尾羽翼較散）自動判定頭尾朝向；無法確定時標記 `status: 'needs-review'`。
4. 進行線性擬合：φ_i = dir0 ± i * (360 / N)，取殘差最小者決定順逆時針與基礎偏角 dir0。
5. 當離心率 < 1.3 時，自動標記為球形無方向性 `rotationMode: 'none'`，不報錯。

### 驗收條件
1. 以程式自動生成合成測試圖集（已知 dirCount, dir0, clockwise），自動量測之 dir0 誤差必須 < 2°，順逆時針判斷 100% 正確。
2. 對圓形火球測試圖，輸出 rotationMode: 'none'。
3. 輸出包含最大擬合殘差、置信度評分與狀態標記的完整校準報告（JSON 與 Markdown）。
```

---

## 5. 【第 3 輪】投射物執行期（行為原語庫與物件池）

```markdown
### 前置依賴
第 1、2 輪之核心數學與校準資料結構已全部就緒。

### 任務目標
1. 實作 `F01 (Linear)`、`F02 (Homing)`、`F04 (Random)` 三大行為原語，使用共通基底型別 `SkillBehaviorBase`。
2. 實作高效能投射物物件池（MissileObjectPool），採用預分配與 Free-list 機制，在穩態運行下零記憶體配置。
3. 實作 25Hz 固定時間步長主循環，整合位置平滑插值（lerp）與瞬移無插值保護。
4. 實作 Canvas 2D 繪製器：依據 dirIndex 抓取影格，位置取整，支援 BlendMode 加法混色。
5. 實作除錯可視化覆蓋層（Debug Overlay）：可即時切換顯示方向索引、理論朝向箭頭、碰撞圓、當前影格與混色模式。

### 驗收條件
1. 確定性回放：在固定種子（PRNG Seed）下，相同 Tick 序列兩次運行的位置結果逐位元相同。
2. 畫面插值流暢度：在 60Hz 與 144Hz 兩種不同渲染節奏下，底層邏輯狀態完全一致。
3. 物件池壓力測試：連續發射並回收 10,000 次後，物件池容量不再膨脹，無重複回收錯誤。
4. 負載基準：同屏維持 200 個投射物運行時，提供單 Tick 邏輯耗時評測數據。
```

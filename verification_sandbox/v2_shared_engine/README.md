# Diablo II 通用動畫標準引擎架構 (V2 Shared Engine)

> **定位原則**：以現有驗證成功之「魔法使純火系六大代表招式」為原點基準（Ground Truth），逆向提取共同規則，打造通用、資料驅動的 D2 動畫建置與播放體系。

---

## 1. 目錄職責劃分

- `builder/`：共用建置工具（Shared Animation Builder）。
  - `shared_builder.py`：完全整合 `d2_reference_tables`（`Skills.txt`, `Missiles.txt`, `AnimData_parsed.json`）與圖集目錄，支援指定技能 ID 一鍵全自動產出標準 Manifest。
- `schemas/`：標準動畫 JSON Schema 與技能 Manifest 規格描述。
  - `skill_manifest.schema.json`：規範各技能之圖層、物理參數、模板類型與方向定義。
  - `fire_skills_manifest.json`：火系六大基準招式宣告（火彈、火球、地獄火、火牆、隕石、九頭蛇）。
  - `cold_skills_manifest.json`：由 `shared_builder.py` 自動生成的冰系技能宣告（冰風暴、冰彈）。
- `templates/`：五大通用動畫模板（直飛投射物、連續噴流、地表火柱/殘火、多階段天降、複合多實體召喚）。
- `runtime/`：輕量級前端通用播放器（Universal Runtime Player），純資料驅動，不包含任何技能硬編碼特例代碼。
  - `v2_sandbox.html` & `v2_demo.ts`：實機測試沙盒，支援火系 6 招與冰系新招即時切換、實時除錯碰撞框與數值調校。
- `tests/`：回歸測試套件（Regression Test），保證每次改動對現有成功動畫達成 100% 原廠手感與動作重現。

---

## 2. 核心規範與鐵律

1. **零特例代碼**：任何新技能只允許透過 `schemas/` 宣告與 `builder/` 生成，禁止為特定技能編寫特殊渲染邏輯。
2. **回歸測試門禁**：修改 Builder 或 Runtime 後，必須執行測試比對基準招式，確認方向、幀率、位移、錨點零誤差。
3. **分工分離**：Build-time（解析、解碼、查表、打包）與 Run-time（讀取 Manifest、依序繪製、觸發 Event）嚴格分離。

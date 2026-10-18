/**
 * Diablo II 16 方向 / 8 方向控制器與角度遲滯防抖演算法 (Direction Controller)
 * 嚴格匹配原版 D2 坐標系與精靈圖方向排版，杜絕視角抖動。
 */
class DirectionController {
    constructor() {
        // 16 方向定義與名稱 (完全吻合精靈圖實際朝向順序: 0 正南 ➔ 順時針旋轉: 4 正西, 8 正北, 12 正東)
        this.DIR_NAMES = [
            "South (正南)", "South-Southwest (南南西)", "Southwest (西南)", "West-Southwest (西南西)",
            "West (正西)", "West-Northwest (西北西)", "Northwest (西北)", "North-Northwest (北北西)",
            "North (正北)", "North-Northeast (北北東)", "Northeast (東北)", "East-Northeast (東北東)",
            "East (正東)", "East-Southeast (東南東)", "Southeast (東南)", "South-Southeast (南南東)"
        ];

        // 8 方向索引映射至 16 方向 (南、西南、西、西北、北、東北、東、東南)
        this.EIGHT_TO_SIXTEEN = [0, 2, 4, 6, 8, 10, 12, 14];

        // 原版 D2 DCC 8 方向映射表 (對照 Blizzard DCC 行排布)
        this.D2_DCC_8_DIR_MAP = [7, 3, 4, 0, 5, 1, 6, 2];

        // 每個方向對應的中心角度 (0~360度，正南為 90°，西為 180°，北為 270°，東為 0°/360°)
        this.DIR_CENTER_DEGREES = [];
        for (let i = 0; i < 16; i++) {
            let deg = (90 + i * 22.5) % 360;
            this.DIR_CENTER_DEGREES.push(deg);
        }

        // 遲滯死區 (單位: 度)，防止在邊界切換時劇烈抖動
        this.hysteresisDeadzone = 5.5; // 基礎半角為 11.25°，加上 5.5° 死區為 16.75°
        this.currentDir = 0; // 預設面向正南
    }

    /**
     * 計算兩角度之間的最小絕對差值 (0~180度)
     */
    getAngleDifference(angle1, angle2) {
        let diff = Math.abs(angle1 - angle2) % 360;
        return diff > 180 ? 360 - diff : diff;
    }

    /**
     * 從世界向量 (vx, vy) 計算精確等軸測角度 (0~360度)
     * 在 2.5D 等距投影中，Y 軸具有 2:1 的視角壓縮，必須將 vy 乘以 2 還原真實空間角度
     */
    vectorToAngle(vx, vy) {
        let rad = Math.atan2(vy * 2, vx);
        let deg = (rad * 180 / Math.PI + 360) % 360;
        return deg;
    }

    /**
     * 從目標角度計算 16 方向索引 (帶遲滯演算法)
     */
    angleToDirection16(targetDeg, forceImmediate = false) {
        if (!forceImmediate) {
            const currentCenter = this.DIR_CENTER_DEGREES[this.currentDir];
            const diff = this.getAngleDifference(targetDeg, currentCenter);
            if (diff <= (11.25 + this.hysteresisDeadzone)) {
                return this.currentDir; // 保持當前朝向，徹底杜絕抽搐
            }
        }

        // 換算至精靈圖 16 方向 (Dir 0=90°南, Dir 2=135°西南, Dir 4=180°西, Dir 8=270°北, Dir 12=0°東, Dir 14=45°東南)
        let rawDir = Math.round((targetDeg - 90) / 22.5);
        let newDir = ((rawDir % 16) + 16) % 16;
        this.currentDir = newDir;
        return newDir;
    }

    /**
     * 從世界坐標 (fromX, fromY) 指向 (toX, toY) 計算方向
     */
    getDirectionTowards(fromX, fromY, toX, toY, forceImmediate = false) {
        const dx = toX - fromX;
        const dy = toY - fromY;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
            return this.currentDir;
        }
        const deg = this.vectorToAngle(dx, dy);
        return this.angleToDirection16(deg, forceImmediate);
    }

    /**
     * 將鍵盤 WASD / 方向鍵按壓狀態轉化為 16 方向
     */
    getDirectionFromKeys(keys, forceImmediate = false) {
        let vx = 0;
        let vy = 0;
        if (keys['KeyW'] || keys['ArrowUp']) vy -= 1;
        if (keys['KeyS'] || keys['ArrowDown']) vy += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) vx -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) vx += 1;

        if (vx === 0 && vy === 0) {
            return null; // 無移動輸入
        }

        const deg = this.vectorToAngle(vx, vy);
        return this.angleToDirection16(deg, forceImmediate);
    }

    /**
     * 取得當前方向的單位向量 (依據 2.5D 等距 2:1 比例壓縮 Y 軸位移速度)
     */
    getVectorForDirection(dir) {
        const deg = this.DIR_CENTER_DEGREES[dir];
        const rad = deg * Math.PI / 180;
        const vx = Math.cos(rad);
        const vy = Math.sin(rad) * 0.5; // 2:1 縱深透視
        const len = Math.hypot(vx, vy) || 1;
        return {
            x: vx / len,
            y: vy / len
        };
    }

    /**
     * 取得方向名稱
     */
    getDirectionName(dir) {
        return this.DIR_NAMES[dir] || `Dir ${dir}`;
    }
}

window.DirectionController = DirectionController;

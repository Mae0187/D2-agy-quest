/**
 * Diablo II 全域音效與靜音管理器 (D2 Global Audio Manager)
 * 統一掌控營火選角大廳、技能施法、揮砍打擊與環境音效之靜音與音量控制。
 * 支援全域按鍵 [M] 快捷切換與跨場景狀態持久化。
 */
class D2AudioManager {
    constructor() {
        // 依使用者指示全面靜音，預設不播放任何音效
        this.isMuted = true;
        try {
            const saved = localStorage.getItem('d2_is_muted');
            if (saved !== null) {
                this.isMuted = saved === 'true';
            } else {
                this.isMuted = true;
                localStorage.setItem('d2_is_muted', 'true');
            }
        } catch (e) {
            this.isMuted = true;
        }

        if (window.__D2_DISABLE_AUDIO__) {
            this.isMuted = true;
        }

        this.activeAudios = new Set();
        this.initToastUI();
        this.initGlobalEvents();
        this.updateUI();
    }

    initToastUI() {
        if (document.getElementById('d2-audio-toast')) return;
        const toast = document.createElement('div');
        toast.id = 'd2-audio-toast';
        toast.style.cssText = `
            position: fixed;
            top: 24px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(10, 8, 6, 0.92);
            border: 1px solid #c79c5e;
            color: #f3e5ab;
            font-family: 'Exocet', 'Cinzel', serif;
            font-size: 15px;
            letter-spacing: 2px;
            padding: 8px 24px;
            border-radius: 4px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.8), 0 0 10px rgba(199, 156, 94, 0.3);
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.25s ease-in-out;
            z-index: 99999;
        `;
        document.body.appendChild(toast);
        this.toastEl = toast;
        this.toastTimer = null;
    }

    showToast(message) {
        if (!this.toastEl) this.initToastUI();
        if (!this.toastEl) return;
        this.toastEl.textContent = message;
        this.toastEl.style.opacity = '1';
        if (this.toastTimer) clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
            if (this.toastEl) this.toastEl.style.opacity = '0';
        }, 1500);
    }

    initGlobalEvents() {
        window.addEventListener('keydown', (e) => {
            // 當用戶正在輸入文字框時不攔截 M 鍵
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
                return;
            }
            if (e.code === 'KeyM' || (e.key && e.key.toLowerCase() === 'm')) {
                e.preventDefault();
                this.toggleMute();
            }
        });

        // 綁定 UI 按鈕
        const bindBtns = () => {
            const btnMuteGlobal = document.getElementById('btn-mute-global');
            if (btnMuteGlobal) {
                btnMuteGlobal.onclick = (e) => {
                    e.preventDefault();
                    this.toggleMute();
                };
            }
            const btnToggleMute = document.getElementById('btn-toggle-mute');
            if (btnToggleMute) {
                btnToggleMute.onclick = (e) => {
                    e.preventDefault();
                    this.toggleMute();
                };
            }
            this.updateUI();
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bindBtns);
        } else {
            bindBtns();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        try {
            localStorage.setItem('d2_is_muted', this.isMuted ? 'true' : 'false');
        } catch (e) {}

        if (this.isMuted) {
            this.activeAudios.forEach(a => {
                try {
                    a.pause();
                    a.currentTime = 0;
                    a.muted = true;
                } catch (e) {}
            });
            this.activeAudios.clear();
            document.querySelectorAll('audio').forEach(a => {
                try {
                    a.pause();
                    a.currentTime = 0;
                    a.muted = true;
                } catch (e) {}
            });
            this.showToast('🔇 全域音效已靜音 [M]');
        } else {
            this.showToast('🔊 全域音效已開啟 [M]');
        }

        this.updateUI();
        return this.isMuted;
    }

    play(audio, volume = 0.5) {
        if (window.__D2_DISABLE_AUDIO__ || this.isMuted || !audio) return;
        try {
            audio.volume = volume;
            audio.currentTime = 0;
            audio.muted = false;
            this.activeAudios.add(audio);
            audio.onended = () => this.activeAudios.delete(audio);
            const p = audio.play();
            if (p && typeof p.then === 'function') {
                p.catch(() => {
                    this.activeAudios.delete(audio);
                });
            }
        } catch (e) {
            this.activeAudios.delete(audio);
        }
    }

    playFile(url, volume = 0.5) {
        if (window.__D2_DISABLE_AUDIO__ || this.isMuted || !url) return;
        try {
            const audio = new Audio(url);
            this.play(audio, volume);
        } catch (e) {}
    }

    updateUI() {
        const statusText = this.isMuted ? '🔇 全域靜音 [M]' : '🔊 音效已開啟 [M]';
        const btnText = this.isMuted ? '🔇 靜音中 [M]' : '🔊 音效開 [M]';

        const hudMute = document.getElementById('hud-mute');
        if (hudMute) {
            hudMute.textContent = statusText;
            hudMute.style.color = this.isMuted ? '#ff5555' : '#55ff55';
        }

        const btnMuteGlobal = document.getElementById('btn-mute-global');
        if (btnMuteGlobal) {
            btnMuteGlobal.textContent = btnText;
            btnMuteGlobal.style.borderColor = this.isMuted ? '#883333' : '#c79c5e';
        }

        const btnToggleMute = document.getElementById('btn-toggle-mute');
        if (btnToggleMute) {
            btnToggleMute.textContent = btnText;
            btnToggleMute.style.borderColor = this.isMuted ? '#883333' : '#c79c5e';
        }
    }
}

// 建立全域單例
window.d2Audio = new D2AudioManager();

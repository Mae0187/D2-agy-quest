/**
 * Diablo II Agent Event Receiver
 * 負責透過 Server-Sent Events (SSE) 與本地中繼端保持即時長連線
 * 接收全平台通用 Canonical Events，並廣播給戰鬥導演與 HUD 介面
 */
class AgentEventReceiver {
    constructor() {
        this.listeners = new Map();
        this.anyListeners = [];
        this.isConnected = false;
        this.eventSource = null;
        this.pollInterval = null;
        this.lastEventId = null;

        this.initConnection();
    }

    initConnection() {
        if (window.__D2_DISABLE_BACKEND__ || window.__D2_STANDALONE__) {
            console.log("[D2EventReceiver] Standalone mode: Backend Link bypassed.");
            return;
        }
        if (window.EventSource) {
            this.connectSSE();
        } else {
            console.warn("[D2EventReceiver] EventSource not supported, falling back to polling.");
            this.startPolling();
        }
    }

    connectSSE() {
        try {
            this.eventSource = new EventSource("/api/events");

            this.eventSource.onopen = () => {
                this.isConnected = true;
                this.updateIndicator(true);
                console.log("[D2EventReceiver] SSE Link Established with Backend Hub.");
            };

            this.eventSource.onmessage = (e) => {
                try {
                    const eventData = JSON.parse(e.data);
                    this.handleEvent(eventData);
                } catch (parseErr) {
                    console.error("[D2EventReceiver] Failed to parse event JSON:", parseErr);
                }
            };

            this.eventSource.onerror = (err) => {
                this.isConnected = false;
                this.updateIndicator(false);
                if (this.eventSource) {
                    this.eventSource.close();
                    this.eventSource = null;
                }
            };
        } catch (e) {
            console.error("[D2EventReceiver] SSE Connection failed, fallback to polling:", e);
            this.startPolling();
        }
    }

    startPolling() {
        if (this.pollInterval) return;
        this.pollInterval = setInterval(async () => {
            try {
                const res = await fetch("/api/events/poll");
                if (res.ok) {
                    const data = await res.json();
                    if (data.events && Array.isArray(data.events)) {
                        for (const ev of data.events) {
                            if (!this.lastEventId || ev.id !== this.lastEventId) {
                                this.handleEvent(ev);
                            }
                        }
                    }
                    this.updateIndicator(true);
                } else {
                    this.updateIndicator(false);
                }
            } catch (err) {
                this.updateIndicator(false);
            }
        }, 1500);
    }

    handleEvent(event) {
        if (!event || !event.type) return;
        this.lastEventId = event.id;

        // 觸發特定類型監聽器
        const typeCallbacks = this.listeners.get(event.type) || [];
        for (const cb of typeCallbacks) {
            try {
                cb(event.payload, event);
            } catch (err) {
                console.error(`[D2EventReceiver] Listener error for ${event.type}:`, err);
            }
        }

        // 觸發全域事件監聽器
        for (const cb of this.anyListeners) {
            try {
                cb(event);
            } catch (err) {
                console.error("[D2EventReceiver] Global listener error:", err);
            }
        }

        // 自動轉發至戰鬥導演中樞 (Phase 3 Combat Director)
        if (window.d2CombatDirector) {
            window.d2CombatDirector.pushEvent(event);
        }
    }

    on(eventType, callback) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }
        this.listeners.get(eventType).push(callback);
    }

    onAny(callback) {
        this.anyListeners.push(callback);
    }

    updateIndicator(active) {
        let el = document.getElementById("d2-agent-link-status");
        if (!el) {
            el = document.createElement("div");
            el.id = "d2-agent-link-status";
            el.style.position = "fixed";
            el.style.bottom = "12px";
            el.style.left = "16px";
            el.style.zIndex = "99999";
            el.style.fontSize = "11px";
            el.style.fontFamily = "'Cinzel', 'Noto Serif TC', serif";
            el.style.letterSpacing = "1px";
            el.style.padding = "4px 8px";
            el.style.borderRadius = "3px";
            el.style.pointerEvents = "none";
            el.style.transition = "all 0.3s ease";
            document.body.appendChild(el);
        }

        if (active) {
            el.style.background = "rgba(10, 30, 15, 0.75)";
            el.style.border = "1px solid #4ade80";
            el.style.color = "#86efac";
            el.style.boxShadow = "0 0 8px rgba(74, 222, 128, 0.3)";
            el.innerText = "● AGENT LINK ACTIVE";
        } else {
            el.style.background = "rgba(40, 10, 10, 0.75)";
            el.style.border = "1px solid #f87171";
            el.style.color = "#fca5a5";
            el.style.boxShadow = "none";
            el.innerText = "○ AGENT LINK STANDBY";
        }
    }
}

// 建立全域單例
window.d2AgentReceiver = new AgentEventReceiver();

"""
Diablo II Agent Monitor - Application Launcher
支援三種啟動模式：
1. browser: 啟動本地 HTTP 伺服器並自動在預設瀏覽器開啟 (預設)
2. server:  僅在後台啟動 HTTP 伺服器
3. overlay: 啟動桌面置頂視窗 (需 pywebview)

包含 Phase 2 全平台通用 CLI 日誌適配與即時事件串流 (SSE / Webhook)
"""
import os
import sys
import json
import time
import queue
import argparse
import webbrowser
import http.server
import socketserver
import logging

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MONITOR_DIR = os.path.join(BASE_DIR, "Diablo2-Agent-Monitor")
WEB_DIR = os.path.join(MONITOR_DIR, "web")
LOG_FILE = os.path.join(MONITOR_DIR, "debug.log")

if MONITOR_DIR not in sys.path:
    sys.path.insert(0, MONITOR_DIR)

from bridge import EventHub, CanonicalEvent

# 遵循嚴格日誌規範：重啟時重整 debug.log，僅保留前次運行的 ERROR/CRITICAL 紀錄
if os.path.exists(LOG_FILE):
    try:
        with open(LOG_FILE, "r", encoding="utf-8", errors="replace") as f:
            old_logs = f.readlines()
        error_logs = [l for l in old_logs if " [ERROR] " in l or " [CRITICAL] " in l]
        with open(LOG_FILE, "w", encoding="utf-8") as f:
            f.writelines(error_logs[-50:])
    except Exception:
        pass

logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] [launcher] %(message)s'
)

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import threading

class AgentSignalBridgeHub:
    """管理前端 SSE 訂閱者佇列，提供執行緒安全之 Agent 狀態廣播與 120ms 併發壓測模擬"""
    def __init__(self):
        self._lock = threading.Lock()
        self._subscribers = []
        self._event_seq = 0

    def subscribe(self):
        q = queue.Queue(maxsize=256)
        with self._lock:
            self._subscribers.append(q)
        return q

    def unsubscribe(self, q):
        with self._lock:
            if q in self._subscribers:
                self._subscribers.remove(q)

    def broadcast_event(self, intent: str, payload: dict = None) -> dict:
        with self._lock:
            self._event_seq += 1
            seq = self._event_seq
            targets = list(self._subscribers)

        event_packet = {
            "seq": seq,
            "intent": intent,
            "timestampMs": int(time.time() * 1000),
            "payload": payload or {}
        }
        serialized = f"data: {json.dumps(event_packet, ensure_ascii=False)}\n\n"
        for sub_q in targets:
            try:
                sub_q.put_nowait(serialized)
            except queue.Full:
                pass
        return event_packet

    def run_coalesce_and_interrupt_simulation(self):
        def _worker():
            self.broadcast_event("DEEP_THINKING", {"thought": "Analyzing AST & SDD contracts"})
            time.sleep(0.5)
            for i in range(5):
                self.broadcast_event("CODE_GENERATING", {"chunkIndex": i, "tokens": 24})
                time.sleep(0.015)
            time.sleep(0.35)
            self.broadcast_event("TOOL_EXECUTING", {"tool": "pytest_runner"})
            time.sleep(0.35)
            self.broadcast_event("TEST_AOE", {"suite": "swept_circle_collision_test"})
            time.sleep(0.25)
            self.broadcast_event("ERROR_HAZARD", {"fatal": False, "reason": "AssertionWarning blocked"})
            time.sleep(0.6)
            self.broadcast_event("QUEST_COMPLETE", {"eliteKilled": "Balrog_TechDebt_Lord"})
        threading.Thread(target=_worker, daemon=True).start()

AGENT_BRIDGE = AgentSignalBridgeHub()

class CustomHTTPHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    hub = EventHub()
    agent_bridge = AGENT_BRIDGE

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def log_message(self, format, *args):
        msg = format % args
        # 避免海量靜態資源存取請求刷爆日誌
        if any(msg.startswith(f'"{m} /assets/') for m in ['GET', 'HEAD']):
            return
        logging.info("%s - - [%s] %s" % (self.client_address[0], self.log_date_time_string(), msg))

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        # 0. Agent SSE 即時事件串流 (Phase 2 /api/agent/stream)
        if self.path.startswith("/api/agent/stream"):
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            sub_queue = self.agent_bridge.subscribe()
            try:
                init_pkt = json.dumps({"intent": "IDLE_PATROL", "timestampMs": int(time.time() * 1000)})
                self.wfile.write(f"data: {init_pkt}\n\n".encode("utf-8"))
                self.wfile.flush()
                while True:
                    try:
                        msg = sub_queue.get(timeout=15.0)
                        self.wfile.write(msg.encode("utf-8"))
                        self.wfile.flush()
                    except queue.Empty:
                        self.wfile.write(b": heartbeat\n\n")
                        self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
                pass
            finally:
                self.agent_bridge.unsubscribe(sub_queue)
            return

        # 1. Server-Sent Events (SSE) 即時事件串流 (原有相容)
        if self.path.startswith("/api/events") and not self.path.startswith("/api/events/poll"):
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            sub_queue = self.hub.subscribe()
            try:
                # 初始連線時先推送最近 20 筆歷史事件以供同步
                history = self.hub.get_recent_history(20)
                for ev in history:
                    msg = f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
                    self.wfile.write(msg.encode("utf-8"))
                self.wfile.flush()

                # 持續推送新抵達的事件
                while True:
                    try:
                        event = sub_queue.get(timeout=10.0)
                        msg = f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                        self.wfile.write(msg.encode("utf-8"))
                        self.wfile.flush()
                    except queue.Empty:
                        # 心跳保持連線
                        self.wfile.write(b": keep-alive\n\n")
                        self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
                pass
            finally:
                self.hub.unsubscribe(sub_queue)
            return

        # 2. 輪詢 API (Polling fallback)
        if self.path.startswith("/api/events/poll"):
            history = self.hub.get_recent_history(50)
            data = json.dumps({"status": "ok", "events": history}, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        # 3. 系統健康檢查 API
        if self.path == "/api/health":
            data = json.dumps({"status": "ok", "version": "1.9.4"}, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        # 4. 沙盒靜態資源服務 (直接讀取 verification_sandbox 目錄)
        SANDBOX_DIR = os.path.join(BASE_DIR, "verification_sandbox")
        if self.path == "/sandbox.html" or self.path == "/":
            sandbox_file = os.path.join(SANDBOX_DIR, "sandbox.html")
            if os.path.exists(sandbox_file):
                with open(sandbox_file, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return

        if self.path == "/paladin_sandbox.html":
            paladin_html = os.path.join(SANDBOX_DIR, "paladin_sandbox.html")
            if not os.path.exists(paladin_html):
                paladin_html = os.path.join(WEB_DIR, "paladin_sandbox.html")
            if os.path.exists(paladin_html):
                with open(paladin_html, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return

        if self.path == "/barbarian_sandbox.html":
            barbarian_html = os.path.join(SANDBOX_DIR, "barbarian_sandbox.html")
            if not os.path.exists(barbarian_html):
                barbarian_html = os.path.join(WEB_DIR, "barbarian_sandbox.html")
            if os.path.exists(barbarian_html):
                with open(barbarian_html, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return

        if self.path == "/v2_sandbox.html":
            v2_html = os.path.join(SANDBOX_DIR, "v2_shared_engine", "runtime", "v2_sandbox.html")
            if os.path.exists(v2_html):
                with open(v2_html, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return

        if self.path == "/v2_demo.bundle.js":
            v2_bundle = os.path.join(SANDBOX_DIR, "v2_shared_engine", "runtime", "v2_demo.bundle.js")
            if os.path.exists(v2_bundle):
                with open(v2_bundle, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/javascript; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return

        clean_path = self.path.split("?")[0].lstrip("/")
        if clean_path.startswith(("verification_sandbox/", "official_visual_standards/", "d2-engine/")):
            full_path = os.path.join(BASE_DIR, clean_path.replace("/", os.sep))
            if os.path.exists(full_path) and os.path.isfile(full_path):
                ext = os.path.splitext(full_path)[1].lower()
                mime_map = {
                    ".html": "text/html; charset=utf-8",
                    ".js": "application/javascript; charset=utf-8",
                    ".json": "application/json; charset=utf-8",
                    ".css": "text/css; charset=utf-8",
                    ".png": "image/png",
                    ".jpg": "image/jpeg",
                    ".jpeg": "image/jpeg",
                    ".gif": "image/gif",
                    ".webp": "image/webp",
                    ".ico": "image/x-icon",
                    ".svg": "image/svg+xml",
                    ".txt": "text/plain; charset=utf-8",
                    ".md": "text/markdown; charset=utf-8"
                }
                ctype = mime_map.get(ext, "application/octet-stream")
                try:
                    with open(full_path, "rb") as f:
                        content = f.read()
                    self.send_response(200)
                    self.send_header("Content-Type", ctype)
                    self.send_header("Content-Length", str(len(content)))
                    self.end_headers()
                    self.wfile.write(content)
                    return
                except Exception as e:
                    logging.exception(f"Error serving {full_path}: {e}")

        # 預設：靜態檔案服務 (Diablo2-Agent-Monitor/web)
        super().do_GET()

    def do_POST(self):
        # 0.1 Agent 狀態事件注入 (POST /api/agent/emit)
        if self.path == "/api/agent/emit":
            content_length = int(self.headers.get("Content-Length", 0))
            raw_body = self.rfile.read(content_length).decode("utf-8", errors="replace") if content_length > 0 else "{}"
            try:
                body = json.loads(raw_body)
                intent = str(body.get("intent", "IDLE_PATROL"))
                payload = body.get("payload", {})
                packet = self.agent_bridge.broadcast_event(intent, payload)
                res_data = json.dumps({"status": "ok", "dispatched": packet}, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
            except Exception as exc:
                res_data = json.dumps({"status": "error", "message": str(exc)}).encode("utf-8")
                self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(res_data)))
            self.end_headers()
            self.wfile.write(res_data)
            return

        # 0.2 Agent 併發與中斷模擬 (POST /api/agent/simulate_burst)
        if self.path == "/api/agent/simulate_burst":
            self.agent_bridge.run_coalesce_and_interrupt_simulation()
            res_data = json.dumps({"status": "simulation_started"}, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(res_data)))
            self.end_headers()
            self.wfile.write(res_data)
            return

        # 1. 外部日誌吸收 Webhook (POST /api/log)
        if self.path == "/api/log":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8", errors="replace")
            
            source = self.headers.get("X-Agent-Source", "generic")
            parsed_event = self.hub.ingest_raw_line(body, source=source)
            
            res_dict = {
                "status": "ok",
                "parsed": parsed_event.to_dict() if parsed_event else None
            }
            res_data = json.dumps(res_dict, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(res_data)))
            self.end_headers()
            self.wfile.write(res_data)
            return

        # 2. 動態監聽新日誌檔 (POST /api/watch)
        if self.path == "/api/watch":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8", errors="replace")
            try:
                payload = json.loads(body)
                watch_path = payload.get("path")
                if watch_path and os.path.exists(watch_path):
                    self.hub.watch_file(watch_path)
                    res_data = json.dumps({"status": "watching", "path": watch_path}).encode("utf-8")
                    self.send_response(200)
                else:
                    res_data = json.dumps({"status": "error", "message": "File not found"}).encode("utf-8")
                    self.send_response(400)
            except Exception as e:
                res_data = json.dumps({"status": "error", "message": str(e)}).encode("utf-8")
                self.send_response(400)

            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(res_data)))
            self.end_headers()
            self.wfile.write(res_data)
            return

        self.send_error(404, "Endpoint not found")

class ThreadedHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True
    request_queue_size = 128

    def handle_error(self, request, client_address):
        # 靜默處理客戶端關閉或重整瀏覽器產生的網路中斷
        exctype, value, tb = sys.exc_info()
        if exctype in (ConnectionAbortedError, ConnectionResetError, BrokenPipeError) or isinstance(value, (ConnectionAbortedError, ConnectionResetError, BrokenPipeError)):
            return
        super().handle_error(request, client_address)

def start_server(port=8765):
    httpd = ThreadedHTTPServer(("127.0.0.1", port), CustomHTTPHandler)
    url = f"http://127.0.0.1:{port}/"
    
    # 伺服器啟動時自動掛載 debug.log 檔案監聽
    hub = EventHub()
    if os.path.exists(LOG_FILE):
        hub.watch_file(LOG_FILE)
        logging.info(f"[launcher] Auto-watching debug log: {LOG_FILE}")

    print(f"[*] 《暗黑破壞神2：毀滅之王》AI Agent 實時狀態與戰鬥監控看板啟動成功！")
    print(f"[*] 看板網址: {url}")
    print(f"[*] 串流端點: {url}api/events (SSE) | Webhook: {url}api/log")
    print(f"[*] 按 Ctrl+C 可停止伺服器。")
    return httpd, url

def main():
    parser = argparse.ArgumentParser(description="Diablo II Agent Monitor Launcher")
    parser.add_argument("--mode", choices=["browser", "server", "overlay"], default="browser", help="啟動模式 (預設: browser)")
    parser.add_argument("--port", type=int, default=8765, help="通訊埠 (預設: 8765)")
    args = parser.parse_args()

    httpd, url = start_server(args.port)

    if args.mode == "browser":
        webbrowser.open(url)
    elif args.mode == "overlay":
        try:
            import webview
            print("啟動獨立置頂懸浮視窗...")
            import threading
            server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
            server_thread.start()
            webview.create_window("Diablo II Agent Monitor", url, width=1080, height=840, resizable=True, on_top=True)
            webview.start()
            sys.exit(0)
        except ImportError:
            print("未檢測到 pywebview，自動降級為瀏覽器模式開啟...")
            webbrowser.open(url)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n伺服器已平穩停止。")
        httpd.shutdown()

if __name__ == "__main__":
    main()

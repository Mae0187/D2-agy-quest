import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8765
DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Diablo2-Agent-Monitor", "web")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def main():
    print(f"==================================================")
    print(f"  《暗黑破壞神2：毀滅之王》AI 戰鬥監控沙盒已啟動")
    print(f"  本地伺服器位址: http://127.0.0.1:{PORT}/")
    print(f"  正在為您自動開啟預設瀏覽器...")
    print(f"  若要停止伺服器，請直接關閉此命令視窗 (或按 Ctrl+C)")
    print(f"==================================================")
    
    webbrowser.open(f"http://127.0.0.1:{PORT}/index.html")
    
    with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n伺服器已正常停止。")

if __name__ == '__main__':
    main()

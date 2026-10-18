"""
File Tail Adapter
非阻塞檔案尾隨適配器
精準追蹤檔案尾端位移 (Offset)，杜絕重複讀取與 Windows 檔案鎖死
"""
import os
import time
import threading
import logging
from typing import Callable, Optional
from bridge.parsers.parser_matrix import LogParserMatrix
from bridge.canonical_event import CanonicalEvent

class FileTailAdapter:
    def __init__(
        self,
        file_path: str,
        parser_matrix: Optional[LogParserMatrix] = None,
        event_callback: Optional[Callable[[CanonicalEvent], None]] = None,
        poll_interval: float = 0.08,
        read_from_end: bool = True
    ):
        self.file_path = os.path.abspath(file_path)
        self.parser_matrix = parser_matrix or LogParserMatrix()
        self.event_callback = event_callback
        self.poll_interval = poll_interval
        self.read_from_end = read_from_end
        
        self.running = False
        self.thread: Optional[threading.Thread] = None
        self.last_offset = 0
        self.last_inode = None

    def start(self):
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(target=self._tail_loop, daemon=True, name="FileTailWorker")
        self.thread.start()

    def stop(self):
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=1.0)

    def _tail_loop(self):
        # 初始化位移指針
        if os.path.exists(self.file_path):
            try:
                size = os.path.getsize(self.file_path)
                self.last_offset = size if self.read_from_end else 0
            except OSError:
                self.last_offset = 0

        while self.running:
            if not os.path.exists(self.file_path):
                time.sleep(self.poll_interval)
                continue

            try:
                current_size = os.path.getsize(self.file_path)
                
                # 檔案被輪轉或截斷清空
                if current_size < self.last_offset:
                    self.last_offset = 0

                # 有新內容寫入
                if current_size > self.last_offset:
                    with open(self.file_path, "r", encoding="utf-8", errors="replace") as f:
                        f.seek(self.last_offset)
                        lines = f.readlines()
                        self.last_offset = f.tell()

                        for line in lines:
                            line = line.strip()
                            if line:
                                event = self.parser_matrix.parse_line(line)
                                if event and self.event_callback:
                                    try:
                                        self.event_callback(event)
                                    except Exception as cb_err:
                                        logging.error(f"[FileTail] Callback error: {cb_err}")

            except Exception as e:
                # 遇到暫時鎖定或讀取異常，平穩等待下個週期重試
                time.sleep(self.poll_interval)
                continue

            time.sleep(self.poll_interval)

"""
Event Hub
中央事件樞紐與廣播中繼
管理多源日誌訂閱者、輪轉事件歷史緩存與客戶端連線
"""
import threading
import queue
import logging
from collections import deque
from typing import List, Dict, Any, Optional
from bridge.canonical_event import CanonicalEvent
from bridge.parsers.parser_matrix import LogParserMatrix
from bridge.source_adapters.file_tail_adapter import FileTailAdapter

class EventHub:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(EventHub, cls).__new__(cls)
                cls._instance._init_hub()
            return cls._instance

    def _init_hub(self):
        self.history_limit = 100
        self.history: deque = deque(maxlen=self.history_limit)
        self.subscribers: List[queue.Queue] = []
        self.subscribers_lock = threading.Lock()
        self.parser_matrix = LogParserMatrix()
        
        # 動態檔案監聽器字典: {file_path: FileTailAdapter}
        self.active_tailers: Dict[str, FileTailAdapter] = {}

    def publish_event(self, event: CanonicalEvent):
        """發布標準事件至歷史緩存與所有訂閱隊列"""
        event_dict = event.to_dict()
        with self.subscribers_lock:
            self.history.append(event_dict)
            dead_subs = []
            for sub in self.subscribers:
                try:
                    sub.put_nowait(event_dict)
                except queue.Full:
                    dead_subs.append(sub)
            for dead in dead_subs:
                self.subscribers.remove(dead)

    def ingest_raw_line(self, raw_line: str, source: str = "generic") -> Optional[CanonicalEvent]:
        """吸收單行原始日誌，由 Parser 矩陣轉譯為標準事件後廣播"""
        event = self.parser_matrix.parse_line(raw_line)
        if event:
            if source != "generic":
                event.source = source
            self.publish_event(event)
            return event
        return None

    def subscribe(self) -> queue.Queue:
        """為新連接的客戶端註冊事件隊列"""
        q = queue.Queue(maxsize=200)
        with self.subscribers_lock:
            self.subscribers.append(q)
        return q

    def unsubscribe(self, q: queue.Queue):
        with self.subscribers_lock:
            if q in self.subscribers:
                self.subscribers.remove(q)

    def get_recent_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self.subscribers_lock:
            hist = list(self.history)
            return hist[-limit:]

    def watch_file(self, file_path: str) -> bool:
        """動態新增檔案尾隨監聽"""
        import os
        abs_path = os.path.abspath(file_path)
        if abs_path in self.active_tailers:
            return True

        tailer = FileTailAdapter(
            file_path=abs_path,
            parser_matrix=self.parser_matrix,
            event_callback=self.publish_event,
            read_from_end=True
        )
        tailer.start()
        self.active_tailers[abs_path] = tailer
        logging.info(f"[EventHub] Started watching: {abs_path}")
        return True

    def stop_all_watchers(self):
        for path, tailer in self.active_tailers.items():
            tailer.stop()
        self.active_tailers.clear()

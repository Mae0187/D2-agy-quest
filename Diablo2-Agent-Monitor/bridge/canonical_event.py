"""
Canonical Event Schema for Diablo II Agent Monitor
標準規範事件定義
"""
import time
from typing import Dict, Any, Optional

VALID_EVENT_TYPES = {
    "idle",           # 待命/掛機狀態
    "thinking",       # 思考/推理/分析中
    "tool_execute",   # 執行工具/執行指令/讀寫檔案
    "tool_success",   # 工具執行成功/指令完成
    "error_retry",    # 報錯/異常/重試中
    "task_start",     # 大型任務開始 (Boss 戰召喚)
    "task_complete",  # 任務圓滿達成 (掉寶/勝利結案)
    "usage_update",   # Token 消耗與 Context Window 數值更新
}

class CanonicalEvent:
    def __init__(
        self,
        event_type: str,
        source: str = "generic",
        payload: Optional[Dict[str, Any]] = None,
        timestamp: Optional[int] = None,
        event_id: Optional[str] = None
    ):
        if event_type not in VALID_EVENT_TYPES:
            raise ValueError(f"Invalid event_type: '{event_type}'. Valid types: {VALID_EVENT_TYPES}")
        
        self.type = event_type
        self.source = source
        self.payload = payload or {}
        self.timestamp = timestamp if timestamp is not None else int(time.time() * 1000)
        self.id = event_id or f"{self.timestamp}_{id(self)}"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "timestamp": self.timestamp,
            "source": self.source,
            "payload": self.payload
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CanonicalEvent":
        return cls(
            event_type=data.get("type", "idle"),
            source=data.get("source", "generic"),
            payload=data.get("payload", {}),
            timestamp=data.get("timestamp"),
            event_id=data.get("id")
        )

    def __repr__(self) -> str:
        return f"<CanonicalEvent type={self.type} source={self.source} payload={self.payload}>"

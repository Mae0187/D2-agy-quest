"""
Structured JSON Log Parser
結構化 JSON 日誌解析器
自動識別與解構 JSON 格式的 Agent 串流事件
"""
import json
from typing import Optional
from bridge.canonical_event import CanonicalEvent
from bridge.parsers.base_parser import BaseLogParser

class StructuredJsonParser(BaseLogParser):
    @property
    def name(self) -> str:
        return "structured_json"

    def can_handle(self, raw_line: str) -> bool:
        trimmed = raw_line.strip() if raw_line else ""
        return (trimmed.startswith("{") and trimmed.endswith("}"))

    def parse(self, raw_line: str) -> Optional[CanonicalEvent]:
        try:
            data = json.loads(raw_line.strip())
            if not isinstance(data, dict):
                return None

            # 若直接符合標準 CanonicalEvent
            if "type" in data and ("payload" in data or "source" in data):
                event_type = data.get("type", "idle")
                return CanonicalEvent(
                    event_type=event_type,
                    source=data.get("source", "structured_json"),
                    payload=data.get("payload", data),
                    timestamp=data.get("timestamp")
                )

            # 常見 Agent 欄位對齊 (例如 Antigravity, OpenAI, LangChain)
            status = str(data.get("status", "")).lower()
            role = str(data.get("role", "")).lower()
            event = str(data.get("event", "") or data.get("action", "")).lower()

            tokens = 0
            if "usage" in data and isinstance(data["usage"], dict):
                tokens = data["usage"].get("total_tokens") or data["usage"].get("prompt_tokens") or 0
            elif "tokens" in data:
                tokens = int(data["tokens"])

            if "error" in status or "error" in event or "exception" in data:
                return CanonicalEvent("error_retry", source="structured_json", payload={
                    "detail": str(data.get("error") or data.get("message") or "Structured error"),
                    "severity": "error",
                    "tokens_used": tokens
                })

            if "tool" in event or "tool_call" in data or "function" in data:
                return CanonicalEvent("tool_execute", source="structured_json", payload={
                    "action": data.get("tool") or data.get("function") or "tool_call",
                    "detail": str(data.get("input") or data.get("args") or data.get("detail") or ""),
                    "tokens_used": tokens
                })

            if "thinking" in event or "reasoning" in data:
                return CanonicalEvent("thinking", source="structured_json", payload={
                    "detail": str(data.get("thinking") or data.get("detail") or "Analyzing..."),
                    "tokens_used": tokens
                })

            if status in ["done", "completed", "success"]:
                return CanonicalEvent("tool_success", source="structured_json", payload={
                    "detail": str(data.get("message") or "Completed"),
                    "tokens_used": tokens
                })

            # 通用回退
            return CanonicalEvent("idle", source="structured_json", payload=data)

        except Exception:
            return None

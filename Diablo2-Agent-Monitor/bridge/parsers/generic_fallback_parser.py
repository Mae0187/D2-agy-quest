"""
Generic Fallback Parser
全平台通用啟發式正則兜底解析器
可從任意終端輸出或未結構化日誌文字中自動辨識 AI 行為並轉換為標準事件
"""
import re
from typing import Optional
from bridge.canonical_event import CanonicalEvent
from bridge.parsers.base_parser import BaseLogParser

# ANSI 轉義序列清除正則
ANSI_REGEX = re.compile(r'\x1b\[[0-9;]*[a-zA-Z]')

class GenericFallbackParser(BaseLogParser):
    def __init__(self):
        # 1. Token 統計正則
        self.token_patterns = [
            re.compile(r'(?:total[_\s-]?tokens?|tokens?|prompt_tokens?)\s*[:=]\s*(\d+)', re.IGNORECASE),
            re.compile(r'(\d+)\s*tokens?', re.IGNORECASE),
        ]
        self.cost_patterns = [
            re.compile(r'(?:cost|price)\s*[:=]\s*\$?([\d\.]+)', re.IGNORECASE),
        ]
        self.context_patterns = [
            re.compile(r'(?:context|window|saturation)\s*[:=]\s*(\d+(?:\.\d+)?)\s*%', re.IGNORECASE),
            re.compile(r'(\d+)\s*/\s*(\d+)\s*(?:context|tokens?)', re.IGNORECASE)
        ]

        # 2. 思考中 (Thinking) 模式
        self.thinking_patterns = [
            re.compile(r'(?:^|\b)(?:thinking|reasoning|planning|analyzing|pondering|evaluating|investigating|reading\s+codebase)(?:\b|\.{3})', re.IGNORECASE),
            re.compile(r'\[thinking\]', re.IGNORECASE),
            re.compile(r'<thinking>', re.IGNORECASE),
            re.compile(r'思考中|正在分析|正在規劃|深度思考', re.IGNORECASE)
        ]

        # 3. 工具執行 (Tool Execute) 模式
        self.tool_patterns = [
            re.compile(r'(?:^|\b)(?:executing|running|tool\s*call|invoking|run_command|write_to_file|replace_file_content|view_file|read_url_content|search_web|npm\s+test|pytest|python\s+)\b', re.IGNORECASE),
            re.compile(r'\[tool\]', re.IGNORECASE),
            re.compile(r'執行工具|正在執行|調用指令|讀寫檔案', re.IGNORECASE),
            re.compile(r'[$#]\s*(?:npm|pip|cargo|go|python|git|curl|make)\b', re.IGNORECASE)
        ]

        # 4. 執行成功 (Tool Success) 模式
        self.success_patterns = [
            re.compile(r'(?:^|\b)(?:completed\s+successfully|exit\s+code\s+0|build\s+succeeded|tests?\s+passed|passed\s+in\s+[\d\.]+s|done\s+in\s+[\d\.]+s|all\s+checks\s+passed)\b', re.IGNORECASE),
            re.compile(r'執行成功|構建成功|測試通過|完成！', re.IGNORECASE)
        ]

        # 5. 報錯重試 (Error / Retry) 模式
        self.error_patterns = [
            re.compile(r'(?:^|\b)(?:error|failed|failure|exception|traceback|syntaxerror|typeerror|fatal|crash|panic|timed\s*out)\b', re.IGNORECASE),
            re.compile(r'(?:^|\b)(?:retrying|retry\s+attempt|attempt\s+\d+\s+failed)\b', re.IGNORECASE),
            re.compile(r'執行失敗|報錯|異常|崩潰|重新嘗試', re.IGNORECASE)
        ]

        # 6. 任務完成 (Task Complete) 模式
        self.task_complete_patterns = [
            re.compile(r'(?:^|\b)(?:task\s+completed|mission\s+accomplished|goal\s+achieved|pull\s+request\s+created|all\s+tasks\s+finished)\b', re.IGNORECASE),
            re.compile(r'任務圓滿完成|全流程結束|目標達成', re.IGNORECASE)
        ]

    @property
    def name(self) -> str:
        return "generic_fallback"

    def can_handle(self, raw_line: str) -> bool:
        # 兜底解析器始終接受任何有內容的字串
        return bool(raw_line and raw_line.strip())

    def parse(self, raw_line: str) -> Optional[CanonicalEvent]:
        # 清除 ANSI 轉義符
        clean_line = ANSI_REGEX.sub('', raw_line).strip()
        if not clean_line:
            return None

        # 排除 HTTP 伺服器內部日誌與靜態資源存取請求
        if re.search(r'(?:\b(?:GET|POST|OPTIONS|HEAD|PUT|DELETE)\s+/|\bHTTP/\d\.\d\b|\[launcher\])', clean_line):
            return None

        # 優先提取數值指標 (Tokens, Cost, Context)
        tokens_used = None
        for p in self.token_patterns:
            m = p.search(clean_line)
            if m:
                tokens_used = int(m.group(1))
                break

        cost_val = None
        for p in self.cost_patterns:
            m = p.search(clean_line)
            if m:
                cost_val = float(m.group(1))
                break

        context_pct = None
        for p in self.context_patterns:
            m = p.search(clean_line)
            if m:
                if len(m.groups()) == 1:
                    context_pct = float(m.group(1)) / 100.0
                elif len(m.groups()) == 2:
                    used = float(m.group(1))
                    total = float(m.group(2))
                    if total > 0:
                        context_pct = min(1.0, used / total)
                break

        # 如果整行純粹在回報 Token 或用量
        if (tokens_used is not None or cost_val is not None or context_pct is not None) and len(clean_line) < 60:
            payload = {
                "detail": clean_line,
                "tokens_used": tokens_used or 0,
                "cost": cost_val or 0.0,
                "context_pct": context_pct
            }
            return CanonicalEvent("usage_update", source="generic", payload=payload)

        # 檢測任務完成
        for p in self.task_complete_patterns:
            if p.search(clean_line):
                return CanonicalEvent("task_complete", source="generic", payload={
                    "detail": clean_line[:120],
                    "tokens_used": tokens_used or 0
                })

        # 檢測報錯重試
        for p in self.error_patterns:
            if p.search(clean_line):
                return CanonicalEvent("error_retry", source="generic", payload={
                    "detail": clean_line[:120],
                    "severity": "error",
                    "tokens_used": tokens_used or 0
                })

        # 檢測工具執行成功
        for p in self.success_patterns:
            if p.search(clean_line):
                return CanonicalEvent("tool_success", source="generic", payload={
                    "detail": clean_line[:120],
                    "severity": "info",
                    "tokens_used": tokens_used or 0
                })

        # 檢測工具執行
        for p in self.tool_patterns:
            if p.search(clean_line):
                return CanonicalEvent("tool_execute", source="generic", payload={
                    "action": "execute",
                    "detail": clean_line[:120],
                    "severity": "info",
                    "tokens_used": tokens_used or 0,
                    "context_pct": context_pct
                })

        # 檢測思考狀態
        for p in self.thinking_patterns:
            if p.search(clean_line):
                return CanonicalEvent("thinking", source="generic", payload={
                    "detail": clean_line[:120],
                    "tokens_used": tokens_used or 0,
                    "context_pct": context_pct
                })

        # 若未命中任何特定行為，但包含有效字元，視為常態思考或待命背景日誌
        if len(clean_line) > 10:
            return CanonicalEvent("thinking", source="generic", payload={
                "detail": clean_line[:80],
                "tokens_used": tokens_used or 0
            })

        return None

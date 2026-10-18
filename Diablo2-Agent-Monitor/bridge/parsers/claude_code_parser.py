"""
Claude Code CLI Dedicated Parser
專門解析 Claude Code CLI 終端輸出格式
"""
import re
from typing import Optional
from bridge.canonical_event import CanonicalEvent
from bridge.parsers.base_parser import BaseLogParser

class ClaudeCodeParser(BaseLogParser):
    def __init__(self):
        self.tool_run_re = re.compile(r'[⏺●]\s*(?:Running|Thinking|Reading|Writing|Updating|Searching|Fetching)\s*:\s*(.+)', re.IGNORECASE)
        self.tool_output_re = re.compile(r'⎿\s*(.+)')
        self.cost_re = re.compile(r'Cost:\s*\$?([\d\.]+)', re.IGNORECASE)
        self.tokens_re = re.compile(r'Tokens?:\s*(\d+)', re.IGNORECASE)

    @property
    def name(self) -> str:
        return "claude_code"

    def can_handle(self, raw_line: str) -> bool:
        return bool(
            '⏺' in raw_line or 
            '⎿' in raw_line or 
            'Claude Code' in raw_line or
            ('Cost:' in raw_line and 'Tokens:' in raw_line)
        )

    def parse(self, raw_line: str) -> Optional[CanonicalEvent]:
        clean = raw_line.strip()
        
        # 匹配執行動作
        m = self.tool_run_re.search(clean)
        if m:
            action_text = m.group(1).strip()
            if 'thinking' in action_text.lower():
                return CanonicalEvent("thinking", source="claude_code", payload={
                    "detail": action_text
                })
            return CanonicalEvent("tool_execute", source="claude_code", payload={
                "action": "execute",
                "detail": action_text
            })

        # 匹配執行結果
        m = self.tool_output_re.search(clean)
        if m:
            out_text = m.group(1).strip()
            if 'error' in out_text.lower() or 'failed' in out_text.lower():
                return CanonicalEvent("error_retry", source="claude_code", payload={
                    "detail": out_text,
                    "severity": "error"
                })
            return CanonicalEvent("tool_success", source="claude_code", payload={
                "detail": out_text
            })

        # 匹配成本與 Token
        cost_m = self.cost_re.search(clean)
        tok_m = self.tokens_re.search(clean)
        if cost_m or tok_m:
            cost = float(cost_m.group(1)) if cost_m else 0.0
            tokens = int(tok_m.group(1)) if tok_m else 0
            return CanonicalEvent("usage_update", source="claude_code", payload={
                "cost": cost,
                "tokens_used": tokens,
                "detail": clean
            })

        return None

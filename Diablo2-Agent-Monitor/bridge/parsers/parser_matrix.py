"""
Log Parser Matrix
解析器插件矩陣中樞
依優先順序匹配，並以 GenericFallbackParser 進行全域保底
"""
from typing import List, Optional
from bridge.canonical_event import CanonicalEvent
from bridge.parsers.base_parser import BaseLogParser
from bridge.parsers.structured_json_parser import StructuredJsonParser
from bridge.parsers.claude_code_parser import ClaudeCodeParser
from bridge.parsers.generic_fallback_parser import GenericFallbackParser

class LogParserMatrix:
    def __init__(self, custom_parsers: Optional[List[BaseLogParser]] = None):
        self.parsers: List[BaseLogParser] = []
        
        # 1. 結構化優先
        self.parsers.append(StructuredJsonParser())
        
        # 2. 特定已知工具專屬解析器
        self.parsers.append(ClaudeCodeParser())
        
        # 3. 使用者擴充之解析器
        if custom_parsers:
            self.parsers.extend(custom_parsers)
            
        # 4. 全域兜底啟發式解析器
        self.fallback_parser = GenericFallbackParser()

    def parse_line(self, raw_line: str) -> Optional[CanonicalEvent]:
        if not raw_line or not raw_line.strip():
            return None

        # 依序詢問各專屬解析器
        for parser in self.parsers:
            if parser.can_handle(raw_line):
                event = parser.parse(raw_line)
                if event:
                    return event

        # 若未命中專屬解析器，交由全域兜底解析器
        return self.fallback_parser.parse(raw_line)

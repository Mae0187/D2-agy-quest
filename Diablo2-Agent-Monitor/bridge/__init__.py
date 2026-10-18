"""
Bridge package for Diablo II Agent Monitor
全平台通用 CLI 日誌適配與標準事件廣播模組
"""
from bridge.canonical_event import CanonicalEvent
from bridge.event_hub import EventHub
from bridge.parsers.parser_matrix import LogParserMatrix
from bridge.source_adapters.file_tail_adapter import FileTailAdapter
from bridge.source_adapters.pipe_adapter import ProcessPipeAdapter

__all__ = [
    "CanonicalEvent",
    "EventHub",
    "LogParserMatrix",
    "FileTailAdapter",
    "ProcessPipeAdapter"
]

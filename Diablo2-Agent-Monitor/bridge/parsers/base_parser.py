"""
Base Parser Interface for Log Parsing Plugins
"""
from abc import ABC, abstractmethod
from typing import Optional
from bridge.canonical_event import CanonicalEvent

class BaseLogParser(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        """解析器唯一名稱"""
        pass

    @abstractmethod
    def can_handle(self, raw_line: str) -> bool:
        """判定該行是否符合此解析器的處理規格"""
        pass

    @abstractmethod
    def parse(self, raw_line: str) -> Optional[CanonicalEvent]:
        """將原始行解析為 CanonicalEvent，若無法有效抽取則回傳 None"""
        pass

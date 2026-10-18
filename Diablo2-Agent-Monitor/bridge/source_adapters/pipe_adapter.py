"""
Process Pipe Adapter (Command Runner Wrapper)
進程管道適配器
掛載任意 CLI 指令並非同步攔截 stdout / stderr 串流
"""
import subprocess
import threading
import logging
from typing import Callable, Optional, List
from bridge.parsers.parser_matrix import LogParserMatrix
from bridge.canonical_event import CanonicalEvent

class ProcessPipeAdapter:
    def __init__(
        self,
        command: str or List[str],
        parser_matrix: Optional[LogParserMatrix] = None,
        event_callback: Optional[Callable[[CanonicalEvent], None]] = None,
        cwd: Optional[str] = None
    ):
        self.command = command
        self.parser_matrix = parser_matrix or LogParserMatrix()
        self.event_callback = event_callback
        self.cwd = cwd
        self.process: Optional[subprocess.Popen] = None
        self.running = False

    def start(self) -> subprocess.Popen:
        self.running = True
        shell = isinstance(self.command, str)
        
        self.process = subprocess.Popen(
            self.command,
            cwd=self.cwd,
            shell=shell,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            encoding="utf-8",
            errors="replace"
        )

        # 啟動雙線程監聽 stdout 與 stderr
        t_out = threading.Thread(target=self._stream_reader, args=(self.process.stdout, "stdout"), daemon=True)
        t_err = threading.Thread(target=self._stream_reader, args=(self.process.stderr, "stderr"), daemon=True)
        t_out.start()
        t_err.start()

        return self.process

    def _stream_reader(self, pipe, stream_name: str):
        try:
            for line in iter(pipe.readline, ''):
                if not self.running:
                    break
                line = line.strip()
                if line:
                    event = self.parser_matrix.parse_line(line)
                    if event and self.event_callback:
                        try:
                            self.event_callback(event)
                        except Exception as e:
                            logging.error(f"[PipeAdapter] Callback error on {stream_name}: {e}")
        except Exception as e:
            logging.error(f"[PipeAdapter] Read error on {stream_name}: {e}")
        finally:
            try:
                pipe.close()
            except Exception:
                pass

    def stop(self):
        self.running = False
        if self.process and self.process.poll() is None:
            try:
                self.process.terminate()
            except Exception:
                pass

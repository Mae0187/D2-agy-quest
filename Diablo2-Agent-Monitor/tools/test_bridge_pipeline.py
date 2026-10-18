"""
Test suite for Phase 2 Universal Log Adapter & Canonical Events
"""
import os
import sys

# 將 Diablo2-Agent-Monitor 加入 sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from bridge import CanonicalEvent, EventHub, LogParserMatrix, FileTailAdapter, ProcessPipeAdapter

def test_canonical_event():
    ev = CanonicalEvent("tool_execute", source="test_source", payload={"action": "test"})
    d = ev.to_dict()
    assert d["type"] == "tool_execute"
    assert d["source"] == "test_source"
    assert d["payload"]["action"] == "test"
    
    ev2 = CanonicalEvent.from_dict(d)
    assert ev2.type == "tool_execute"
    print("[PASS] CanonicalEvent serialization & deserialization")

def test_parser_matrix():
    matrix = LogParserMatrix()

    cases = [
        # 思考中
        ("Thinking about user architecture requirements...", "thinking"),
        ("正在分析專案目錄結構與相依套件...", "thinking"),
        # 工具調用
        ("Executing tool: run_command pytest", "tool_execute"),
        ("正在執行: python build.py", "tool_execute"),
        ("$ npm test -- --coverage", "tool_execute"),
        # 執行成功
        ("Tests passed in 0.42s", "tool_success"),
        ("Done in 1.25s. Exit code 0", "tool_success"),
        # 錯誤與重試
        ("Traceback (most recent call last): RuntimeError: timeout", "error_retry"),
        ("Error: Command failed with exit code 1", "error_retry"),
        # Token 與用量更新
        ("Total tokens: 2450, Cost: $0.05", "usage_update"),
        ("Context: 68%", "usage_update"),
        # 結構化 JSON
        ('{"type": "tool_execute", "payload": {"action": "build"}}', "tool_execute"),
        ('{"role": "assistant", "event": "tool_call", "tool": "search"}', "tool_execute"),
        # Claude Code 專屬語法
        ("⏺ Running: npm run build", "tool_execute"),
        ("⎿ Completed successfully", "tool_success"),
        # 任務完成
        ("Task completed successfully! Mission accomplished.", "task_complete")
    ]

    for line, expected_type in cases:
        ev = matrix.parse_line(line)
        assert ev is not None, f"Failed to parse line: {line}"
        assert ev.type == expected_type, f"Expected {expected_type}, got {ev.type} for '{line}'"

    print(f"[PASS] LogParserMatrix tested across {len(cases)} varied patterns!")

def test_event_hub():
    hub = EventHub()
    q = hub.subscribe()
    
    hub.ingest_raw_line("Thinking about database migrations...")
    received = q.get(timeout=1.0)
    assert received["type"] == "thinking"
    
    # 測試歷史記錄
    hist = hub.get_recent_history(10)
    assert len(hist) >= 1
    assert hist[-1]["type"] == "thinking"
    
    hub.unsubscribe(q)
    print("[PASS] EventHub publish, subscribe, and history verified!")

def test_file_tail_adapter():
    import tempfile
    import time
    
    with tempfile.NamedTemporaryFile("w+", encoding="utf-8", delete=False) as tmp:
        tmp_path = tmp.name
        tmp.write("Initial line\n")
        tmp.flush()

    captured_events = []
    tailer = FileTailAdapter(
        file_path=tmp_path,
        event_callback=lambda ev: captured_events.append(ev),
        poll_interval=0.05,
        read_from_end=True
    )
    tailer.start()
    time.sleep(0.1)

    # 追加新日誌
    with open(tmp_path, "a", encoding="utf-8") as f:
        f.write("Executing tool: run_command git status\n")
        f.flush()
        f.write("Tests passed in 0.15s\n")
        f.flush()

    # 等待讀取
    time.sleep(0.2)
    tailer.stop()
    
    try:
        os.remove(tmp_path)
    except OSError:
        pass

    assert len(captured_events) == 2, f"Expected 2 captured events, got {len(captured_events)}"
    assert captured_events[0].type == "tool_execute"
    assert captured_events[1].type == "tool_success"
    print("[PASS] FileTailAdapter dynamic offset & real-time capture verified!")

def test_pipe_adapter():
    import time
    captured_events = []
    pipe = ProcessPipeAdapter(
        command="python -c \"print('Executing tool: run_command dir'); print('Tests passed in 0.05s')\"",
        event_callback=lambda ev: captured_events.append(ev)
    )
    proc = pipe.start()
    proc.wait(timeout=3.0)
    time.sleep(0.2)
    pipe.stop()

    assert len(captured_events) >= 2, f"Expected >= 2 captured events, got {len(captured_events)}"
    assert captured_events[0].type == "tool_execute"
    assert captured_events[1].type == "tool_success"
    print("[PASS] ProcessPipeAdapter command execution & pipe streaming verified!")

if __name__ == "__main__":
    print("=== Running Phase 2 Universal Log Adapter Verification ===")
    test_canonical_event()
    test_parser_matrix()
    test_event_hub()
    test_file_tail_adapter()
    test_pipe_adapter()
    print("=== All Phase 2 Unit Tests Passed Successfully! ===")



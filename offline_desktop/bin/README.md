# Local inference runtime

The Python engine can connect to an existing local Ollama daemon at `127.0.0.1:11434` or to a llama.cpp server at `127.0.0.1:8081`.

For GGUF direct launch from the dashboard, put a matching upstream platform `llama-server` binary in this folder as `llama-server.exe` (Windows) or `llama-server` (Linux/macOS) or add it to PATH. The engine binds its own launched model server to the loopback IP only.

The optional native runtime is **not** bundled or executed in this project, and no real inference benchmark has been completed.

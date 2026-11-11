# Offline model storage

No GGUF weights are included. The previously linked 16.9 GB Gemma 4 31B file was **not** downloaded or stored. It is not suitable for a low-memory Android phone.

For first genuine CPU inference, use the official ~563 MB [Qwen3.5 0.8B Q4_0 GGUF](https://huggingface.co/ggml-org/Qwen3.5-0.8B-GGUF/blob/main/Qwen3.5-0.8B-Q4_0.gguf).

Optionally run `python scripts/get_qwen_tiny.py --accept-download` **while connected to the internet**. The script verifies the model against its published SHA256 and places the weights here. It does not install `llama-server`.

Use a compatible `llama-server` binary from the upstream llama.cpp project. Models, runtime binaries and source code have their own licensing terms; inspect before commercial distribution.

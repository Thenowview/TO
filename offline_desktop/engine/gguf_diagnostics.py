"""Bounded, offline GGUF metadata inspection. Not proof of runtime compatibility.

Reads only GGUF metadata using the published scalar/string/array type codes.
Never guesses architecture from an archive or filename, and never reads weights.
"""
from __future__ import annotations
import struct
from pathlib import Path

class GGUFInspectionError(ValueError):
    pass

MAX_SCAN = 32 * 1024 * 1024
MAX_KV = 8192
MAX_ARRAY_ITEMS = 500_000
MAX_STRING = 2 * 1024 * 1024
PRIMITIVES = {
    0: ("<B", 1), 1: ("<b", 1), 2: ("<H", 2), 3: ("<h", 2),
    4: ("<I", 4), 5: ("<i", 4), 6: ("<f", 4), 7: ("<?", 1),
    10: ("<Q", 8), 11: ("<q", 8), 12: ("<d", 8),
}

def inspect_file(path):
    path = Path(path)
    if not path.is_file() or path.is_symlink():
        raise GGUFInspectionError("File is not a regular GGUF.")
    size = path.stat().st_size
    if size < 24:
        raise GGUFInspectionError("GGUF header is incomplete.")
    with path.open("rb") as f:
        def check(n):
            if type(n) is not int or n < 0 or f.tell() + n > min(size, MAX_SCAN):
                raise GGUFInspectionError("GGUF metadata exceeds the bounded inspection limit.")
        def read(n):
            check(n)
            data = f.read(n)
            if len(data) != n:
                raise GGUFInspectionError("Truncated GGUF metadata.")
            return data
        def skip(n):
            check(n)
            f.seek(n, 1)
        def u32():
            return struct.unpack("<I", read(4))[0]
        def u64():
            return struct.unpack("<Q", read(8))[0]
        def string(keep=False):
            n = u64()
            if n > MAX_STRING:
                raise GGUFInspectionError("Oversized GGUF metadata string.")
            if not keep:
                skip(n)
                return None
            return read(n).decode("utf-8", errors="replace")
        def value(kind, keep=False):
            if kind in PRIMITIVES:
                fmt, count = PRIMITIVES[kind]
                if keep:
                    return struct.unpack(fmt, read(count))[0]
                skip(count)
                return None
            if kind == 8:
                return string(keep=keep)
            if kind == 9:
                element_kind, count = u32(), u64()
                if count > MAX_ARRAY_ITEMS:
                    raise GGUFInspectionError("Array exceeds bounded GGUF metadata inspection.")
                if element_kind in PRIMITIVES:
                    skip(PRIMITIVES[element_kind][1] * count)
                elif element_kind == 8:
                    for _ in range(count):
                        string(False)
                else:
                    raise GGUFInspectionError("Unsupported nested GGUF metadata array.")
                return None
            raise GGUFInspectionError("Unrecognized GGUF metadata type.")
        if read(4) != b"GGUF":
            raise GGUFInspectionError("Missing GGUF magic.")
        version, tensors, count = u32(), u64(), u64()
        if version not in (2, 3):
            raise GGUFInspectionError("Unsupported GGUF metadata header version.")
        if count > MAX_KV:
            raise GGUFInspectionError("GGUF key count exceeds safety limit.")
        keys = ("general.architecture", "general.name", "general.file_type",
                "general.quantization_version", "tokenizer.chat_template",
                "tokenizer.ggml.model")
        metadata = {}
        for _ in range(count):
            key = string(keep=True)
            if key is None or len(key) > 512:
                raise GGUFInspectionError("Invalid GGUF metadata key.")
            kind = u32()
            keep = key in keys or key.endswith(".context_length")
            val = value(kind, keep=keep)
            if keep and key == "tokenizer.chat_template":
                metadata["chat_template_present"] = bool(val)
            elif keep and key in keys or (keep and key.endswith(".context_length")):
                metadata[key] = val
        return {
            "metadata_recognized": True,
            "gguf_version": version,
            "tensor_count": tensors,
            "kv_count": count,
            "architecture": metadata.get("general.architecture"),
            "model_name": metadata.get("general.name"),
            "file_type": metadata.get("general.file_type"),
            "quantization_version": metadata.get("general.quantization_version"),
            "tokenizer": metadata.get("tokenizer.ggml.model"),
            "chat_template_present": bool(metadata.get("chat_template_present")),
            "context_length": next((v for k, v in metadata.items() if k.endswith(".context_length")), None),
            "runtime_compatible": None,
            "loaded": False,
            "inference_verified": False,
            "coding_benchmark_passed": False,
            "verification_note": "GGUF header parsed only. Runtime loading, actual inference, chat-template behavior and coding ability still require independent tests.",
        }

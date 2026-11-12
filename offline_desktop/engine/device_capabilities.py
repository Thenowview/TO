"""Hardware-aware model-free feature policy, stdlib-only and advisory for Android."""
from __future__ import annotations
import os, sys, platform
MIB=1024**2
GIB=1024**3

def detect(total_bytes=None, available_bytes=None, cores=None, platform_name=None):
    from engine.core import available_physical_memory_bytes
    if available_bytes is None:available_bytes=available_physical_memory_bytes()
    if total_bytes is None:
        if sys.platform.startswith('linux'):
            try:
                for line in open('/proc/meminfo'):
                    if line.startswith('MemTotal:'):
                        total_bytes=int(line.split()[1])*1024; break
            except (OSError,ValueError,IndexError):pass
        elif os.name=='nt':
            try:
                import ctypes
                from ctypes import wintypes
                class MemoryStatus(ctypes.Structure):
                    _fields_=[('dwLength',wintypes.DWORD),('dwMemoryLoad',wintypes.DWORD),
                        ('ullTotalPhys',ctypes.c_ulonglong),('ullAvailPhys',ctypes.c_ulonglong),
                        ('ullTotalPageFile',ctypes.c_ulonglong),('ullAvailPageFile',ctypes.c_ulonglong),
                        ('ullTotalVirtual',ctypes.c_ulonglong),('ullAvailVirtual',ctypes.c_ulonglong),
                        ('ullAvailExtendedVirtual',ctypes.c_ulonglong)]
                info=MemoryStatus(); info.dwLength=ctypes.sizeof(MemoryStatus)
                if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(info)):
                    total_bytes=int(info.ullTotalPhys)
            except (OSError,ValueError,AttributeError):pass
    cores=cores if cores is not None else (os.cpu_count() or 1)
    system=platform_name or platform.system()
    tier=('unknown' if total_bytes is None else
          'below-minimum' if total_bytes<2*GIB else
          'minimum' if total_bytes<4*GIB else
          'basic' if total_bytes<6*GIB else
          'enhanced' if total_bytes<16*GIB else 'workstation')
    reason='Available physical RAM could not be measured; keep local inference disabled until checked.' if available_bytes is None else ''
    return dict(tier=tier,total_ram_bytes=total_bytes,available_ram_bytes=available_bytes,
                cpu_cores=cores,platform=system,core_model_free=True,
                optional_local_llm=bool(available_bytes and available_bytes>=1536*MIB and total_bytes is not None and total_bytes>=4*GIB),
                model_policy='Per-file preflight still mandatory; tier alone never authorizes loading',
                inference_block_reason=reason)

def model_allowed(estimated_bytes, available_bytes, reserve_bytes=384*MIB):
    if available_bytes is None:
        return False,'Available physical memory could not be determined.'
    if estimated_bytes+reserve_bytes>available_bytes:
        return False,('Insufficient available RAM: model estimate %d MiB plus %d MiB device reserve exceeds %d MiB free.'
                      %(estimated_bytes//MIB,reserve_bytes//MIB,available_bytes//MIB))
    return True,'Currently available RAM passes the estimate; actual model loading may still fail.'


def detect_gpu_memory():
    """Best-effort, read-only NVIDIA VRAM report. Never infer generic GPU VRAM.

    The CPU-only llama-server configuration does not automatically offload to GPU.
    For AMD/Intel or unsupported drivers, report unknown rather than inventing
    a value from shared system RAM or a truncated WMI AdapterRAM field.
    """
    import subprocess
    from pathlib import Path
    candidates = []
    if os.name == "nt":
        system_root = Path(os.environ.get("SystemRoot", "C:/Windows"))
        program_files = Path(os.environ.get("ProgramFiles", "C:/Program Files"))
        candidates = [
            system_root / "System32" / "nvidia-smi.exe",
            program_files / "NVIDIA Corporation" / "NVSMI" / "nvidia-smi.exe",
        ]
    elif sys.platform.startswith("linux"):
        candidates = [Path("/usr/bin/nvidia-smi"), Path("/usr/local/bin/nvidia-smi")]
    selected = next((p for p in candidates if p.is_file() and not p.is_symlink()), None)
    unknown = {
        "detected": False, "device_name": None,
        "total_vram_bytes": None, "available_vram_bytes": None,
        "source": "not_detected", "inference_gpu_acceleration_verified": False,
        "note": "Dedicated GPU VRAM could not be verified. AMD, Intel and shared-GPU memory may be unavailable without an additional read-only driver adapter."
    }
    if selected is None:
        return unknown
    try:
        proc = subprocess.run(
            [str(selected), "--query-gpu=name,memory.total,memory.free",
             "--format=csv,noheader,nounits"],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL, text=True, encoding="utf-8",
            errors="replace", timeout=5, check=False
        )
    except (OSError, subprocess.TimeoutExpired):
        return unknown
    if proc.returncode != 0 or len(proc.stdout.encode("utf-8")) > 4096:
        return unknown
    cards = []
    for line in proc.stdout.splitlines()[:8]:
        parts = [x.strip() for x in line.split(",")]
        if len(parts) != 3:
            continue
        name, total, free = parts
        if not total.isdigit() or not free.isdigit():
            continue
        total_mib, free_mib = int(total), int(free)
        if not (64 <= total_mib <= 262144 and 0 <= free_mib <= total_mib):
            continue
        cards.append((free_mib, total_mib, name[:100]))
    if not cards:
        return unknown
    free, total, name = max(cards)
    return {
        "detected": True, "device_name": name,
        "total_vram_bytes": total * MIB,
        "available_vram_bytes": free * MIB,
        "source": "nvidia-smi-memory-query",
        "inference_gpu_acceleration_verified": False,
        "note": "VRAM measured by NVIDIA driver; this TheOrg llama.cpp launcher currently uses a CPU-first configuration. GPU offload and model fit are not proven."
    }


def recommend_local_model(files=None, available_bytes=None, gpu=None):
    """Advisory model class and installed GGUF file fit, never auto-download/load."""
    from engine.core import available_physical_memory_bytes
    if available_bytes is None:
        available_bytes = available_physical_memory_bytes()
    if gpu is None:
        gpu = detect_gpu_memory()
    if available_bytes is None or available_bytes < 1536 * MIB:
        family = "No safe local model size inferred"
        parameters = "Unknown"
        reason = "Current available RAM is insufficient or cannot be measured reliably."
    elif available_bytes < 4 * GIB:
        family = "Tiny on-device"
        parameters = "0.5B–1B, 4-bit"
        reason = "A lightweight quantized model is the safest starting point."
    elif available_bytes < 8 * GIB:
        family = "Compact local"
        parameters = "1B–3B, 4-bit"
        reason = "Choose compact quantized weights and a short context window."
    elif available_bytes < 16 * GIB:
        family = "General-purpose local"
        parameters = "3B–7B, 4-bit"
        reason = "Moderate quantized models may fit with reduced context and working overhead."
    elif available_bytes < 32 * GIB:
        family = "Expanded local"
        parameters = "7B–14B, 4-bit"
        reason = "Larger quantized models may fit, subject to file metadata and runtime tests."
    else:
        family = "Workstation local"
        parameters = "14B+, quantized"
        reason = "High available RAM supports evaluating larger local models after per-file checks."
    max_bytes = max(0, int(((available_bytes or 0) - 1408 * MIB) / 1.2))
    fits = []
    for file in files or []:
        if (isinstance(file, dict) and type(file.get("name")) is str and
                type(file.get("bytes")) is int and file["bytes"] > 0 and
                file["bytes"] <= max_bytes):
            fits.append({"name": file["name"], "bytes": file["bytes"]})
    fits.sort(key=lambda x: x["bytes"], reverse=True)
    return {
        "recommendation": family, "suggested_model_class": parameters,
        "currently_available_ram_bytes": available_bytes,
        "estimated_max_gguf_file_bytes": max_bytes,
        "installed_candidates_with_estimated_ram_fit": fits[:8],
        "recommended_installed_file": fits[0]["name"] if fits else None,
        "automatic_download_or_model_start": False,
        "gpu": gpu,
        "inference_verified": False,
        "benchmark_authorized": False,
        "reason": reason,
        "caveat": "Sizing is advisory, CPU-first and based on current free RAM. GGUF architecture, context size, output quality and hardware acceleration are not verified."
    }

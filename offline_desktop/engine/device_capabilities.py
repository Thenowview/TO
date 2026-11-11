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

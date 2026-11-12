"""Adapt runtime settings around one fixed model; never claim to resize weights."""
from __future__ import annotations

def select(available_bytes, model_bytes, cores, requested_context=4096):
    if not isinstance(available_bytes,int) or available_bytes<=0:
        return {'load':False,'context':1024,'threads':1,'reason':'Available RAM is unknown.'}
    minimum=int(model_bytes*1.2+1024**3)+384*1024**2
    remaining=available_bytes-minimum
    context=1024 if remaining<1024**3 else 2048 if remaining<2*1024**3 else 4096
    return {'load':remaining>=0,'context':min(context,max(1024,min(8192,int(requested_context)))),
            'threads':max(1,min(4,int(cores or 1)//2)),
            'reason':'Runtime context adapts to free RAM; model weights are unchanged.',
            'estimated_required_bytes':minimum,'shared_memory_max_entries':500}

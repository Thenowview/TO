"""Bounded, local GGUF metadata inspection; never claims model runtime support."""
import struct
from pathlib import Path
class GGUFInspectionError(ValueError): pass
MAX_SCAN=32*1024*1024
MAX_KV=8192
MAX_ITEMS=500000
MAX_STRING=2*1024*1024
PRIMITIVES={0:('B',1),1:('b',1),2:('H',2),3:('h',2),4:('I',4),5:('i',4),6:('f',4),7:('?',1),10:('Q',8),11:('q',8),12:('d',8)}
def inspect_file(path):
    path=Path(path)
    if path.is_symlink() or not path.is_file(): raise GGUFInspectionError('Not a regular file')
    size=path.stat().st_size
    if size<24: raise GGUFInspectionError('Incomplete GGUF header')
    with path.open('rb') as f:
        def check(n):
            if not isinstance(n,int) or n<0 or f.tell()+n>min(size,MAX_SCAN):
                raise GGUFInspectionError('GGUF metadata exceeds bounded inspection limit')
        def read(n):
            check(n)
            raw=f.read(n)
            if len(raw)!=n: raise GGUFInspectionError('Truncated metadata')
            return raw
        def skip(n):check(n);f.seek(n,1)
        def u32():return struct.unpack('<I',read(4))[0]
        def u64():return struct.unpack('<Q',read(8))[0]
        def text(keep):
            n=u64()
            if n>MAX_STRING: raise GGUFInspectionError('Oversized GGUF string')
            if keep:return read(n).decode('utf-8','replace')
            skip(n);return None
        def value(kind,keep=False):
            if kind in PRIMITIVES:
                fmt,n=PRIMITIVES[kind]
                if keep:return struct.unpack('<'+fmt,read(n))[0]
                skip(n);return None
            if kind==8:return text(keep)
            if kind==9:
                elem,count=u32(),u64()
                if count>MAX_ITEMS: raise GGUFInspectionError('Too many array items')
                if elem in PRIMITIVES:skip(PRIMITIVES[elem][1]*count)
                elif elem==8:
                    for _ in range(count):text(False)
                else:raise GGUFInspectionError('Nested GGUF arrays unsupported')
                return None
            raise GGUFInspectionError('Unknown GGUF value type')
        if read(4)!=b'GGUF':raise GGUFInspectionError('Missing GGUF magic')
        version,tensors,count=u32(),u64(),u64()
        if version not in (2,3):raise GGUFInspectionError('Unsupported GGUF metadata version')
        if count>MAX_KV:raise GGUFInspectionError('Unsafe GGUF key count')
        info={}
        for _ in range(count):
            key=text(True)
            if not key or len(key)>512:raise GGUFInspectionError('Invalid metadata key')
            keep=key in ('general.architecture','general.name','general.file_type','tokenizer.chat_template','tokenizer.ggml.model') or key.endswith('.context_length')
            result=value(u32(),keep)
            if keep:info[key]=result
        return dict(metadata_recognized=True,gguf_version=version,tensor_count=tensors,kv_count=count,
                    architecture=info.get('general.architecture'), model_name=info.get('general.name'),
                    tokenizer=info.get('tokenizer.ggml.model'),
                    chat_template_present=bool(info.get('tokenizer.chat_template')),
                    context_length=next((v for k,v in info.items() if k.endswith('.context_length')),None),
                    runtime_compatible=None,loaded=False,inference_verified=False,coding_benchmark_passed=False,
                    verification_note='Header metadata only; real runtime loading, inference and coding not tested.')

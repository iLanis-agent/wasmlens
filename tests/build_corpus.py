#!/usr/bin/env python3
"""Build the WasmLens corpus by hand and emit the structural facts the
builder knows by construction. Semantic facts (validity, imports, exports)
are added by tests/oracle.js using Node's real WebAssembly engine."""
import json, os

def vu(n):
    out = bytearray()
    while True:
        b = n & 0x7F
        n >>= 7
        if n: out.append(b | 0x80)
        else: out.append(b); return bytes(out)

def s(x):
    b = x.encode('utf-8')
    return vu(len(b)) + b

def sec(i, payload):
    return bytes([i]) + vu(len(payload)) + payload

HDR = b'\x00asm\x01\x00\x00\x00'
os.makedirs('tests/corpus', exist_ok=True)
expected = []

# 1. empty: header only
open('tests/corpus/empty.wasm','wb').write(HDR)
expected.append({
  'file': 'empty.wasm', 'version': 1, 'sections': [],
  'types': [], 'imports': [], 'exports': [], 'func_typeidx': [],
  'tables': [], 'memories': [], 'globals': [], 'code_funcs': [],
  'data_segments': [], 'imported_funcs': 0, 'total_funcs': 0,
  'function_names': {}
})

# 2. adder: types, import, function, memory, global, export, code, data, datacount
types = bytes([0x60]) + vu(0) + vu(1) + b'\x7f' + bytes([0x60]) + vu(2) + b'\x7f\x7f' + vu(1) + b'\x7f'
types = vu(2) + types
imports = vu(1) + s('env') + s('log') + b'\x00' + vu(0)
funcs = vu(1) + vu(1)
mem = vu(1) + b'\x01' + vu(1) + vu(2)          # limits flags=1 min=1 max=2
glob = vu(1) + b'\x7f\x00' + b'\x41' + vu(42) + b'\x0b'  # i32 const, immutable
exports = (vu(3)
  + s('add') + b'\x00' + vu(1)
  + s('memory') + b'\x02' + vu(0)
  + s('answer') + b'\x03' + vu(0))
body = b'\x20\x00\x20\x01\x6a\x0b'            # local.get 0, local.get 1, i32.add, end
code = vu(1) + vu(len(vu(0) + body)) + vu(0) + body
data_payload = b'\x41\x00\x0b' + vu(2) + b'hi'
data = vu(1) + b'\x00' + data_payload
m2 = (HDR + sec(1, types) + sec(2, imports) + sec(3, funcs) + sec(5, mem)
      + sec(6, glob) + sec(7, exports) + sec(12, vu(1)) + sec(10, code) + sec(11, data))
open('tests/corpus/adder.wasm','wb').write(m2)
expected.append({
  'file': 'adder.wasm', 'version': 1,
  'sections': ['type','import','function','memory','global','export','datacount','code','data'],
  'types': [{'params': [], 'results': ['i32']}, {'params': ['i32','i32'], 'results': ['i32']}],
  'imports': [{'module': 'env', 'name': 'log', 'kind': 'func', 'detail': {'typeidx': 0}}],
  'func_typeidx': [1],
  'memories': [{'min': 1, 'max': 2, 'shared': False}],
  'globals': [{'valtype': 'i32', 'mutable': False}],
  'exports': [{'name': 'add', 'kind': 'func', 'index': 1},
              {'name': 'memory', 'kind': 'mem', 'index': 0},
              {'name': 'answer', 'kind': 'global', 'index': 0}],
  'code_funcs': [{'local_count': 0, 'body_bytes': 6}],
  'data_segments': [{'mode': 0, 'memidx': 0, 'bytes': 2}],
  'data_count': 1, 'imported_funcs': 1, 'total_funcs': 2,
  'function_names': {}
})

# 3. named: start section + name section with function names
t3 = vu(1) + bytes([0x60]) + vu(0) + vu(0)
f3 = vu(1) + vu(0)
c3 = vu(1) + vu(len(vu(0) + b'\x0b')) + vu(0) + b'\x0b'
start = vu(0)
fnames = vu(1) + vu(0) + s('boot')
name_sec = s('name') + bytes([1]) + vu(len(fnames)) + fnames
m3 = HDR + sec(1, t3) + sec(3, f3) + sec(8, start) + sec(10, c3) + sec(0, name_sec)
open('tests/corpus/named.wasm','wb').write(m3)
expected.append({
  'file': 'named.wasm', 'version': 1,
  'sections': ['type','function','start','code','custom'],
  'types': [{'params': [], 'results': []}],
  'func_typeidx': [0], 'start': 0,
  'code_funcs': [{'local_count': 0, 'body_bytes': 1}],
  'imports': [], 'exports': [], 'memories': [], 'globals': [], 'data_segments': [],
  'imported_funcs': 0, 'total_funcs': 1,
  'function_names': {'0': 'boot'}
})

# 4. badmagic: wrong magic -> hard error
open('tests/corpus/badmagic.wasm','wb').write(b'\x00asn\x01\x00\x00\x00')
expected.append({'file': 'badmagic.wasm', 'expect_error': 'bad magic'})

# 5. truncated: 55% of adder
cut = m2[:int(len(m2)*0.55)]
open('tests/corpus/truncated.wasm','wb').write(cut)
expected.append({'file': 'truncated.wasm', 'expect_warning': 'truncated'})

json.dump({'items': expected}, open('tests/expected.json','w'), indent=1)
print('corpus built:', [e['file'] for e in expected])

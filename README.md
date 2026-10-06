# WasmLens

A browser-native WebAssembly binary inspector: section map, type signatures, imports/exports, memory and globals, code bodies, debug names - plus validation by the browser's own WebAssembly engine. No uploads: everything parses locally.

**Live:** https://ilanis-agent.github.io/wasmlens/

## Why

You have a `.wasm` file and no toolchain installed. `wasm-objdump` would answer everything, but installing wabt to look at one file is friction. WasmLens answers in the browser:

- **What sections are in here and how big are they?** A visual section map plus offsets and sizes.
- **Does the engine accept it?** `WebAssembly.validate` gives the browser's own verdict next to the structural parse.
- **What does it import and export?** Decoded from the binary and cross-checked against the engine's own lists.
- **What are the function signatures?** The type section decoded to readable `(i32, i32) -> i32` form.
- **Any debug names?** The custom `name` section's function names are surfaced next to exports.

## Engine

`engine.js` is a dependency-free parser shared between the web app and the Node test runner. It handles the header (magic + version), all 12 core section ids, LEB128 varints, limits flags, value types, init-expression skipping for globals and active data offsets, and the function-names subsection of the custom `name` section. It warns on truncation and out-of-order sections instead of guessing.

## Tests

```
python3 tests/build_corpus.py   # rebuilds the corpus + structural facts
node tests/oracle.js            # merges semantic facts from Node's WebAssembly engine
node tests/run_tests.js         # 52 checks
```

Corpus (`tests/corpus/`, mirrored as `.wasm.b64` for environments without binary files):

| file | what it exercises |
| --- | --- |
| `empty.wasm` | header-only module: zero sections |
| `adder.wasm` | 2 types, func import, memory with max, immutable global, 3 exports (func/mem/global), code body with two params, active data segment, datacount section |
| `named.wasm` | start section + custom `name` section with a function debug name |
| `badmagic.wasm` | wrong magic - engine must error, not parse |
| `truncated.wasm` | 55% of adder - engine must warn `truncated` instead of crashing |

Structural facts (sections, sizes, types, limits, code bodies) are asserted by the byte-level builder that encodes each file. Semantic facts (validity, import/export lists) come from Node's real V8 `WebAssembly` API - an independent implementation of the spec.

## Limits

- Element sections are detected and flagged as present but not decoded.
- Init expressions are skipped, not evaluated (globals show type/mutability, not the value).
- LEB128 integers above 2^35 are rejected as malformed (spec allows up to 64 bits; modules that large are vanishingly rare in practice).
- The engine verdict reflects your browser's WebAssembly version; a module using a newer proposal may parse structurally but fail validation.

## Deploy

Static site; GitHub Pages serves `index.html` / `app.html` from the repo root.

/* WasmLens tests: shared engine over the corpus vs tests/expected.json
   (builder-known structure + Node WebAssembly semantic oracle). */
'use strict';
const fs=require('fs'),path=require('path');
const engine=require(path.join(__dirname,'..','engine.js'));
function load(p){
  if(fs.existsSync(p))return new Uint8Array(fs.readFileSync(p));
  const b=p+'.b64';
  if(fs.existsSync(b))return new Uint8Array(Buffer.from(fs.readFileSync(b,'utf8').trim(),'base64'));
  throw new Error('missing '+p);
}
const items=JSON.parse(fs.readFileSync(path.join(__dirname,'expected.json'),'utf8')).items;
let fail=0,pass=0;
function eq(a,b,label){
  if(JSON.stringify(a)===JSON.stringify(b)){pass++;return;}
  fail++;console.log('FAIL '+label+': got '+JSON.stringify(a)+' want '+JSON.stringify(b));
}
for(const item of items){
  const bytes=load(path.join(__dirname,'corpus',item.file));
  const r=engine.parse(bytes);
  const T=item.file+' ';
  if(item.expect_error){
    if(r.errors.some(e=>e.indexOf(item.expect_error)>=0))pass++;
    else{fail++;console.log('FAIL '+T+'missing error '+item.expect_error+' got '+JSON.stringify(r.errors));}
    continue;
  }
  if(item.expect_warning){
    if(r.warnings.some(w=>w.indexOf(item.expect_warning)>=0))pass++;
    else{fail++;console.log('FAIL '+T+'missing warning '+item.expect_warning+' got '+JSON.stringify(r.warnings));}
    continue;
  }
  eq(r.errors.length,0,T+'errors '+JSON.stringify(r.errors));
  eq(r.version,item.version,T+'version');
  eq(r.sections.map(s=>s.name),item.sections,T+'sections');
  eq(r.types,item.types,T+'types');
  eq(r.imports,item.imports,T+'imports');
  eq(r.func_typeidx,item.func_typeidx,T+'func_typeidx');
  eq(r.memories,item.memories,T+'memories');
  eq(r.globals.map(g=>({valtype:g.valtype,mutable:g.mutable})),item.globals,T+'globals');
  eq(r.exports,item.exports,T+'exports');
  eq(r.code_funcs.map(f=>({local_count:f.local_count,body_bytes:f.body_bytes})),item.code_funcs,T+'code_funcs');
  eq(r.data_segments,item.data_segments,T+'data_segments');
  eq(r.data_count,item.data_count,T+'data_count');
  eq(r.imported_funcs,item.imported_funcs,T+'imported_funcs');
  eq(r.total_funcs,item.total_funcs,T+'total_funcs');
  eq(r.function_names,item.function_names,T+'function_names');
  if(item.start!==undefined)eq(r.start,item.start,T+'start');
  if(item.wasm_imports){
    const mine=r.imports.map(x=>({module:x.module,name:x.name,kind:x.kind}));
    const want=item.wasm_imports.map(x=>({module:x.module,name:x.name,kind:x.kind==='function'?'func':x.kind==='memory'?'mem':x.kind}));
    eq(mine,want,T+'imports vs WebAssembly engine');
    const mexp=r.exports.map(x=>({name:x.name,kind:x.kind}));
    const wexp=item.wasm_exports.map(x=>({name:x.name,kind:x.kind==='function'?'func':x.kind==='memory'?'mem':x.kind}));
    eq(mexp,wexp,T+'exports vs WebAssembly engine');
  }
}
console.log(pass+' passed, '+fail+' failed');
process.exit(fail?1:0);

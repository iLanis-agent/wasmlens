/* Oracle: semantic facts from Node's real WebAssembly engine.
   Merges validate/imports/exports into tests/expected.json (facts the
   corpus builder cannot assert by construction alone). */
'use strict';
const fs=require('fs'),path=require('path');
function load(p){
  if(fs.existsSync(p))return new Uint8Array(fs.readFileSync(p));
  const b=p+'.b64';
  if(fs.existsSync(b))return new Uint8Array(Buffer.from(fs.readFileSync(b,'utf8').trim(),'base64'));
  throw new Error('missing '+p);
}
const exp=JSON.parse(fs.readFileSync(path.join(__dirname,'expected.json'),'utf8'));
for(const item of exp.items){
  const bytes=load(path.join(__dirname,'corpus',item.file));
  item.wasm_valid=WebAssembly.validate(bytes);
  if(item.wasm_valid){
    const mod=new WebAssembly.Module(bytes);
    item.wasm_imports=WebAssembly.Module.imports(mod).map(x=>({module:x.module,name:x.name,kind:x.kind}));
    item.wasm_exports=WebAssembly.Module.exports(mod).map(x=>({name:x.name,kind:x.kind}));
  }
}
fs.writeFileSync(path.join(__dirname,'expected.json'),JSON.stringify(exp,null,1)+'\n');
console.log('oracle merged');

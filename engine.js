/* WasmLens engine: parse WebAssembly binaries (magic, sections, types,
   imports, exports, memories, globals, code, data, custom name section).
   No dependencies; runs in the browser and in Node (tests). */
(function(root,factory){
  if(typeof module==='object'&&module.exports){module.exports=factory();}
  else{root.WasmLens=factory();}
})(typeof self!=='undefined'?self:this,function(){
'use strict';
var VALTYPE={0x7F:'i32',0x7E:'i64',0x7D:'f32',0x7C:'f64',0x7B:'v128',0x70:'funcref',0x6F:'externref'};
var SECTION=['custom','type','import','function','table','memory','global','export','start','element','code','data','datacount'];
var EXKIND=['func','table','mem','global','tag'];
function parse(bytes){
  var r={errors:[],warnings:[],sections:[],types:[],imports:[],func_typeidx:[],tables:[],memories:[],globals:[],exports:[],code_funcs:[],data_segments:[],function_names:{},size:bytes.length};
  var pos=0;
  function u8(){if(pos>=bytes.length)throw {eof:true};return bytes[pos++];}
  function vu(){var v=0,s=0,b;for(;;){b=u8();v+=(b&0x7F)*Math.pow(2,s);if(!(b&0x80))return v;s+=7;if(s>35)throw {bad:'leb'};}}
  function take(n){if(pos+n>bytes.length)throw {eof:true};var a=bytes.slice(pos,pos+n);pos+=n;return a;}
  function str(){var n=vu(),a=take(n),s='';for(var i=0;i<a.length;i++)s+=String.fromCharCode(a[i]);try{return decodeURIComponent(escape(s));}catch(e){return s;}}
  function skipExpr(){var depth=0;for(;;){var op=u8();if(op===0x02||op===0x03||op===0x04)depth++;else if(op===0x0B){if(depth===0)return;depth--;}
    else if(op===0x41||op===0x42){var b;do{b=u8();}while(b&0x80);}
    else if(op===0x43){take(4);}else if(op===0x44){take(8);}
    else if(op===0x23||op===0x24||op===0x0C||op===0x0D||op===0xD2){vu();}
    else if(op===0xD0){u8();}
    else if(op===0xFC||op===0xFD){vu();}
  }}
  function limits(){var f=vu(),min=vu(),max=null,shared=!!(f&2);if(f&1)max=vu();return {min:min,max:max,shared:shared};}
  if(bytes.length<8||bytes[0]!==0||bytes[1]!==0x61||bytes[2]!==0x73||bytes[3]!==0x6D){r.errors.push('not a wasm binary (bad magic)');return r;}
  r.version=bytes[4]|(bytes[5]<<8)|(bytes[6]<<16)|(bytes[7]<<24);
  if(r.version!==1)r.warnings.push('unusual version '+r.version);
  pos=8;
  try{
    var ORDER=[1,2,3,4,5,6,7,8,9,12,10,11];
    var lastRank=-1;
    while(pos<bytes.length){
      var id=u8(),size=vu(),poff=pos;
      var name=id<SECTION.length?SECTION[id]:'unknown('+id+')';
      var sec={id:id,name:name,offset:poff-1,size:size,payload_offset:poff};
      r.sections.push(sec);
      if(id!==0){var rank=ORDER.indexOf(id);
        if(rank<0)r.warnings.push('unknown section id '+id);
        else{if(rank<=lastRank)r.warnings.push('section '+name+' out of order or duplicated');lastRank=rank;}}
      var end=poff+size;
      if(end>bytes.length){r.warnings.push('truncated: section '+name+' extends past end of file');return r;}
      var save=pos;
      try{
        if(id===0){
          var cn=str();sec.custom_name=cn;
          if(cn==='name'){
            while(pos<end){
              var sid=u8(),ssize=vu(),send=pos+ssize;
              if(sid===1){var cnt=vu();for(var i0=0;i0<cnt;i0++){var fi=vu();r.function_names[fi]=str();}}
              else sec['name_sub_'+sid]=ssize;
              pos=send;
            }
          }
        }else if(id===1){
          var n1=vu();for(var i=0;i<n1;i++){var form=u8();if(form!==0x60)throw {bad:'functype form '+form};
            var np=vu(),ps=[],rs=[];for(var j=0;j<np;j++)ps.push(VALTYPE[u8()]||'?');
            var nr=vu();for(var k=0;k<nr;k++)rs.push(VALTYPE[u8()]||'?');
            r.types.push({params:ps,results:rs});}
        }else if(id===2){
          var n2=vu();for(var i2=0;i2<n2;i2++){var mod=str(),nm=str(),kind=u8(),detail={};
            if(kind===0)detail.typeidx=vu();
            else if(kind===1){detail.reftype=VALTYPE[u8()]||'?';detail.limits=limits();}
            else if(kind===2)detail.limits=limits();
            else if(kind===3){detail.valtype=VALTYPE[u8()]||'?';detail.mutable=!!u8();}
            else if(kind===4){detail.attribute=u8();detail.typeidx=vu();}
            else throw {bad:'import kind '+kind};
            r.imports.push({module:mod,name:nm,kind:EXKIND[kind]||String(kind),detail:detail});}
        }else if(id===3){
          var n3=vu();for(var i3=0;i3<n3;i3++)r.func_typeidx.push(vu());
        }else if(id===4){
          var n4=vu();for(var i4=0;i4<n4;i4++){var rt=VALTYPE[u8()]||'?';r.tables.push({reftype:rt,limits:limits()});}
        }else if(id===5){
          var n5=vu();for(var i5=0;i5<n5;i5++)r.memories.push(limits());
        }else if(id===6){
          var n6=vu();for(var i6=0;i6<n6;i6++){var vt=VALTYPE[u8()]||'?',mut=!!u8(),istart=pos;skipExpr();
            r.globals.push({valtype:vt,mutable:mut,init_bytes:pos-istart});}
        }else if(id===7){
          var n7=vu();for(var i7=0;i7<n7;i7++){var en=str(),ek=u8(),ei=vu();r.exports.push({name:en,kind:EXKIND[ek]||String(ek),index:ei});}
        }else if(id===8){
          r.start=vu();
        }else if(id===9){
          r.warnings.push('element section present (not decoded)');
          pos=end;
        }else if(id===10){
          var n10=vu();for(var i10=0;i10<n10;i10++){var bsize=vu(),bodyStart=pos,lc=vu(),locs=[],tot=0;
            for(var j10=0;j10<lc;j10++){var cnt=vu(),t=VALTYPE[u8()]||'?';locs.push({count:cnt,type:t});tot+=cnt;}
            var bodyBytes=bsize-(pos-bodyStart);pos=bodyStart+bsize;
            r.code_funcs.push({size:bsize,local_groups:locs,local_count:tot,body_bytes:bodyBytes});}
        }else if(id===11){
          var n11=vu();for(var i11=0;i11<n11;i11++){var mode=vu(),mem=0;
            if(mode===0){skipExpr();}else if(mode===2){mem=vu();skipExpr();}else if(mode!==1)throw {bad:'data mode '+mode};
            var dl=vu();take(dl);
            r.data_segments.push({mode:mode,memidx:mem,bytes:dl});}
        }else if(id===12){
          r.data_count=vu();
        }
      }catch(inner){
        if(inner&&inner.eof){r.warnings.push('truncated: ran out of bytes inside section '+name);return r;}
        throw inner;
      }
      pos=end;
    }
  }catch(e){
    if(e&&e.eof)r.warnings.push('truncated: unexpected end of file');
    else if(e&&e.bad)r.errors.push(String(e.bad));
    else throw e;
  }
  r.imported_funcs=r.imports.filter(function(x){return x.kind==='func';}).length;
  r.total_funcs=r.imported_funcs+r.code_funcs.length;
  return r;
}
return {parse:parse,VALTYPE:VALTYPE};
});

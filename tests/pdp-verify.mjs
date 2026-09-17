import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sectionSelection,briefReport} from '../skills/shopify-pdp/scripts/selection.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
assert.deepEqual(sectionSelection('03,1,3',3),[1,3]);
for(const value of ['', '0', '4', '1,', 'x'])assert.throws(()=>sectionSelection(value,3));
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'pdp-verify-test-'));
const server=http.createServer((req,res)=>{
 if(req.url==='/pretendard.css'){res.setHeader('Content-Type','text/css');res.end('@font-face{font-family:Pretendard;src:local("DejaVu Sans")}body{font-family:Pretendard}');}
 else{res.setHeader('Content-Type','text/html');res.end('<link rel="stylesheet" href="/pretendard.css"><body><div id="test__pdp-description"><div class="section-gen-base__inner">Host fixture</div></div></body>');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const host=`http://127.0.0.1:${server.address().port}`;
try{
 await fs.mkdir(path.join(dir,'images'));await fs.mkdir(path.join(dir,'validation'));
 await fs.writeFile(path.join(dir,'images/a.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'));
 const model={name:'Fixture',namespace:'pdp-product--fixture',design_width:100,reviewed:true,verification_url:host,sections:[1,2].map(i=>({image:'a.png',width:100,height:100,scale:1,label:`Section ${i}`,texts:[],shapes:[]}))};
 const fragment='<style>.pdp-product--fixture{width:100%;container-type:inline-size}.pdp-product--fixture .pdp-product__image{display:block;width:100%}</style><div class="pdp-product pdp-product--fixture">'+[1,2].map(i=>`<section class="pdp-product__section pdp-product__section--0${i}" aria-labelledby="h${i}"><h2 class="pdp-product__heading" id="h${i}">Section ${i}</h2><img class="pdp-product__image" src="images/a.png"></section>`).join('')+'</div>';
 await fs.writeFile(path.join(dir,'layout.px.json'),JSON.stringify(model));await fs.writeFile(path.join(dir,'description.html'),fragment);await fs.writeFile(path.join(dir,'preview.html'),'<html><head><link rel="icon" href="data:,"></head><body>'+fragment+'</body></html>');
 await fs.writeFile(path.join(dir,'validation/report.json'),'existing full report');
 async function run(extra){return new Promise((resolve,reject)=>{
  const p=spawn(process.execPath,[path.join(root,'skills/shopify-pdp/scripts/verify.mjs'),'--project',dir,'--widths','100','--summary',...extra],{env:process.env});let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('error',reject);p.on('exit',code=>{try{resolve({code,data:JSON.parse(out),err});}catch{reject(Error(err+'\n'+out));}});
 });}
 const partial=await run(['--sections','2']);assert.equal(partial.code,0,JSON.stringify(partial));assert.equal(partial.data.scope,'partial');assert.deepEqual(partial.data.sections,[2]);
 assert.equal(await fs.readFile(path.join(dir,'validation/report.json'),'utf8'),'existing full report');
 await fs.access(path.join(dir,'validation/partial/2/section-02.png'));
 await assert.rejects(fs.access(path.join(dir,'validation/partial/2/section-01.png')));
 const full=await run([]);assert.equal(full.code,0,JSON.stringify(full));assert.equal(full.data.scope,'full');assert.deepEqual(full.data.sections,[1,2]);
 const detailed=JSON.parse(await fs.readFile(full.data.report));assert.match(detailed.inputHash,/^[0-9a-f]{64}$/);
 console.log('PASS: real browser partial/full scope, screenshots, preserved full report, input hash, bounded output (synthetic font host; not product typography proof)');
}finally{await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});}

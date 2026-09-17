import {sectionSelection,briefReport} from './selection.mjs';
import {createHash} from 'node:crypto';
import {resolveTypography} from './typography.mjs';
import {auditFragment} from './audit.mjs';
import {readHost,applyHost} from './host.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import http from 'node:http';
import {options,launch,projectModel} from './runtime.mjs';
const {args,value}=options();
if(args.includes('--help')){console.log('pdp verify --project DIR [--url SHOPIFY_URL] [--selector CSS_SELECTOR] [--widths 320,390,768,1440] [--sections 2,5] [--summary]');process.exit(0);}
const {root,model}=await projectModel(value('--project'));
const sections=sectionSelection(value('--sections'),model.sections.length),partial=args.includes('--sections');
const selected=new Set(sections);
const config=JSON.parse(await fs.readFile(path.join(root,'project.json'),'utf8').catch(()=>'{}'));
const url=value('--url')||config.verification_url||model.verification_url;
const widths=[...new Set((value('--widths')||`320,375,390,768,${model.design_width},1440`).split(',').map(Number))];
if(widths.some(w=>!Number.isFinite(w)||w<=0))throw new Error('Invalid viewport widths');
const validation=path.join(root,'validation',...(partial?['partial',sections.join('-')]:[]));await fs.mkdir(validation,{recursive:true});
const fragment=await fs.readFile(path.join(root,'description.html'),'utf8');
const expectedTexts=model.sections.reduce((n,s,i)=>n+(selected.has(i+1)?s.texts.length:0),0),errors=[];
const server=http.createServer(async(req,res)=>{try{const filename=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!filename.startsWith(root+path.sep))throw Error('Outside project');const bytes=await fs.readFile(filename);res.setHeader('Content-Type',filename.endsWith('.html')?'text/html; charset=utf-8':filename.endsWith('.jpg')?'image/jpeg':filename.endsWith('.png')?'image/png':'application/octet-stream');res.end(bytes);}catch{res.statusCode=404;res.end('Not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
let browser;
async function ready(page){await page.locator(`.${model.namespace}`).waitFor({state:'attached'});await page.evaluate(async ns=>{const images=[...document.querySelectorAll(`.${ns} img`)];images.forEach(i=>i.loading='eager');await Promise.all(images.map(i=>i.decode()));await document.fonts.ready;},model.namespace);}
const textEntries=model.sections.flatMap((s,i)=>{if(!selected.has(i+1))return [];const counts={};return s.texts.map(t=>{const role=t.css_role||(t.tag==='h2'?'title':'text'),number=String(counts[role]=(counts[role]||0)+1).padStart(2,'0');const resolved=resolveTypography(t,s,model),ratio=model.design_width/(s.width*s.scale);return{id:t.id,clip:!!t.intentional_clip,rotation:t.rotation||0,color:t.color,reference:t.reference_box?{...t.reference_box,scale:1/(s.width*s.scale)}:null,typography:{size:+(resolved.size*ratio*100/model.design_width).toFixed(1),weight:resolved.weight,lineHeight:resolved.line_height,tracking:+(resolved.tracking*ratio*100/model.design_width).toFixed(1)},selector:`.pdp-product__section--${String(i+1).padStart(2,'0')} .pdp-product__${role}--${number}`};});});
async function snapshot(page){return page.locator(`.${model.namespace}`).evaluate((el,entries)=>{
 const r=el.getBoundingClientRect(),texts=entries.map(t=>({meta:t,node:el.querySelector(t.selector)}));
 if(texts.some(t=>!t.node))throw Error('Missing source text element');
 const ctx=document.createElement('canvas').getContext('2d');
 const ink=texts.map(({node:e,meta})=>{
  const style=getComputedStyle(e),b=e.getBoundingClientRect(),section=e.closest('.pdp-product__section'),s=section.getBoundingClientRect();
  ctx.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;ctx.fontKerning='none';ctx.letterSpacing=`${parseFloat(style.letterSpacing)||0}px`;
  const m=ctx.measureText(e.textContent),baseline=(parseFloat(style.lineHeight)+m.fontBoundingBoxAscent-m.fontBoundingBoxDescent)/2;
  const range=document.createRange();range.selectNodeContents(e);const rangeBox=range.getBoundingClientRect();
  const box=meta.rotation?{x:rangeBox.x,y:rangeBox.y,right:rangeBox.right,bottom:rangeBox.bottom}:{x:b.x-m.actualBoundingBoxLeft,y:b.y+baseline-m.actualBoundingBoxAscent,right:b.x+m.actualBoundingBoxRight,bottom:b.y+baseline+m.actualBoundingBoxDescent};
  return {id:meta.id,reference:meta.reference,sectionBox:{x:s.x,y:s.y},text:e.textContent,section:section.className,clip:meta.clip,rotation:meta.rotation,...box,outside:!meta.clip&&(box.x<s.x-1||box.right>s.right+1||box.y<s.y-1||box.bottom>s.bottom+1)};
 });
 const referenceChecks=ink.filter(t=>t.reference&&!t.rotation).map(t=>{
  const ref=t.reference,scale=ref.scale*r.width,x=t.sectionBox.x+ref.x*scale,y=t.sectionBox.y+ref.y*scale,width=ref.width*scale,height=ref.height*scale;
  const dx=ref.align==='center'?(t.x+t.right)/2-(x+width/2):ref.align==='right'?t.right-x-width:t.x-x,dy=t.y-y;
  const dw=t.right-t.x-width,dh=t.bottom-t.y-height,positionTolerance=2,widthTolerance=2+(t.text.trimEnd().length*.5+6)*scale,heightTolerance=2+3*scale;
  const passed=Math.abs(dx)<=positionTolerance&&Math.abs(dy)<=positionTolerance&&(ref.limitation||Math.abs(dw)<=widthTolerance&&Math.abs(dh)<=heightTolerance);
  return{id:t.id,text:t.text,dx,dy,dw,dh,passed:!!passed,limitation:ref.limitation||null};
 });
 const referenceBounds={checked:referenceChecks.length,maxPositionErrorPx:Math.max(0,...referenceChecks.flatMap(t=>[Math.abs(t.dx),Math.abs(t.dy)])),failures:referenceChecks.filter(t=>!t.passed),limitations:referenceChecks.filter(t=>t.limitation).map(t=>({id:t.id,reason:t.limitation}))};
 const overlaps=[];
 for(let i=0;i<ink.length;i++)for(let j=i+1;j<ink.length;j++){
  const a=ink[i],b=ink[j];if(a.section!==b.section||a.rotation||b.rotation||a.clip||b.clip)continue;
  const w=Math.min(a.right,b.right)-Math.max(a.x,b.x),h=Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y);
  if(w>r.width*.002&&h>Math.min(a.bottom-a.y,b.bottom-b.y)*.15)overlaps.push({ids:[a.id,b.id],texts:[a.text,b.text],width:w,height:h});
 }
 const typographyMismatches=texts.filter(({node:e,meta})=>{const c=getComputedStyle(e),t=meta.typography,size=t.size*r.width/100;ctx.fillStyle=c.color;const actualColor=ctx.fillStyle;ctx.fillStyle=meta.color;return actualColor!==ctx.fillStyle|| Math.abs(parseFloat(c.fontSize)-size)>.05||Number(c.fontWeight)!==t.weight||Math.abs(parseFloat(c.lineHeight)-size*t.lineHeight)>.1||Math.abs((parseFloat(c.letterSpacing)||0)-t.tracking*r.width/100)>.05;}).map(t=>t.meta.id);
 return{referenceBounds,inkOutOfBounds:ink.filter(t=>t.outside).map(t=>({id:t.id,text:t.text})),inkOverlapCandidates:overlaps,typographyMismatches,width:r.width,height:r.height,images:[...el.querySelectorAll('img')].filter(i=>i.complete&&i.naturalWidth).length,texts:texts.length,overflow:document.documentElement.scrollWidth>innerWidth,
 outOfBounds:texts.filter(t=>!t.meta.clip).filter(({node:e})=>{const b=e.getBoundingClientRect(),s=e.closest('.pdp-product__section').getBoundingClientRect();return b.x<s.x-1||b.right>s.right+1||b.y<s.y-1||b.bottom>s.bottom+1;}).map(t=>t.node.textContent),
 intentionalClips:texts.filter(t=>t.meta.clip).map(t=>t.meta.id),fonts:[...new Set(texts.map(t=>getComputedStyle(t.node).fontFamily))],missingHeadings:[...el.querySelectorAll('section')].filter(e=>!e.querySelector(':scope > h2')).length,
 invalidClasses:[el,...el.querySelectorAll('[class]')].flatMap(e=>[...e.classList]).filter(c=>!/^pdp-product(?:__[a-z0-9-]+|--[a-z0-9-]+)?$/.test(c)),
 geometry:texts.map(({node:e})=>{const b=e.getBoundingClientRect(),s=e.closest('.pdp-product__section').getBoundingClientRect();return{x:b.x-s.x,y:b.y-s.y,w:b.width,h:b.height};})};
 },textEntries);}
const summary=data=>{const {geometry,...rest}=data;return rest;};
const difference=(a,b)=>Math.max(0,...a.geometry.flatMap((t,i)=>['x','y','w','h'].map(k=>Math.abs(t[k]-b.geometry[i][k]))));
function outside(){const e=document.querySelector('h1');if(!e)return null;const s=getComputedStyle(e),b=e.getBoundingClientRect();return {font:s.fontFamily,size:s.fontSize,color:s.color,width:b.width,height:b.height};}
const results=[],shopify=[];let host;
const policyErrors=[];
if(/-?\d+\.\d{2,}cqi\b/.test(fragment))policyErrors.push('cqi values must have at most one decimal place');
if(/font-family\s*:|@font-face|data:[^;]*font|base64,|\bfont\s*:|--[\w-]*font[\w-]*\s*:/i.test(fragment))policyErrors.push('Forbidden font declaration or embedded resource');
if(/(?:scale|translate|matrix|skew)\w*\s*\(|rotate\(0(?:deg)?\)/i.test(fragment))policyErrors.push('Compensating transform');
try{
 browser=await launch();const auditPage=await browser.newPage();const structureAudit=await auditPage.evaluate(auditFragment,{fragment,model});policyErrors.push(...structureAudit.errors);await auditPage.close();const hostPage=await browser.newPage();host=await readHost(hostPage,url,value('--selector'));await hostPage.close();const page=await browser.newPage({deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 for(const width of widths){
  await page.setViewportSize({width,height:1000});await page.goto(base+'/preview.html');await applyHost(page,host);await ready(page);const standalone=await snapshot(page);
  if(width===model.design_width){for(let i=0;i<model.sections.length;i++)if(selected.has(i+1))await page.locator('.pdp-product__section').nth(i).screenshot({path:path.join(validation,`section-${String(i+1).padStart(2,'0')}.png`)});}
  if(!partial&&(width===390||width===model.design_width))await page.locator(`.${model.namespace}`).screenshot({path:path.join(validation,`standalone-${width}.png`)});
  // Hostile unscoped typography at the same content width checks CSS isolation.
  await page.addStyleTag({content:'section{margin:4rem;padding:30px;border:3px solid red}h2,p,span{font-family:serif;font-size:44px;color:purple;line-height:3;letter-spacing:8px;text-transform:uppercase}img{border:4px solid green;box-shadow:0 0 20px red}'});
  const stressed=await snapshot(page),delta=difference(standalone,stressed);
  results.push({viewport:width,...summary(standalone),hostStyleGeometryDifferencePx:delta});
 }
 if(url){
  const live=await browser.newPage({deviceScaleFactor:1});
  await live.route('https://pdp-preview-assets.test/images/*',route=>{const name=path.basename(new URL(route.request().url()).pathname);if(!model.sections.some(s=>s.image===name))return route.abort();return route.fulfill({path:path.join(root,'images',name)});});
  let imageIndex=0;
  const html=fragment.replace(/(<img[^>]*\bsrc=")[^"]*(")/g,(_,start,end)=>start+'https://pdp-preview-assets.test/images/'+encodeURIComponent(model.sections[imageIndex++].image)+end);
  await live.goto(url,{waitUntil:'domcontentloaded'});
  for(const width of widths){
   await live.setViewportSize({width,height:1000});
   const target=live.locator(value('--selector')||'[id$="__pdp-description"] .section-gen-base__inner');await target.waitFor({state:'attached',timeout:15000});await live.evaluate(()=>document.fonts.ready);const before=await live.evaluate(outside);
   await target.evaluate((e,content)=>e.innerHTML=content,html);await ready(live);const data=await snapshot(live),after=await live.evaluate(outside);
   await page.setViewportSize({width:Math.ceil(data.width),height:1000});await page.goto(base+'/preview.html');await applyHost(page,host);await page.locator(`.${model.namespace}`).evaluate((e,w)=>e.style.width=w+'px',data.width);await ready(page);const baseline=await snapshot(page);
   if(!partial&&(width===390||width===1440))await live.locator(`.${model.namespace}`).screenshot({path:path.join(validation,`shopify-${width}.png`)});
   shopify.push({viewport:width,...summary(data),hostTypographyUnchanged:JSON.stringify(before)===JSON.stringify(after),maxGeometryDifferencePx:difference(data,baseline)});
  }
 }
 const failed=[...results,...shopify].some(r=>r.missingHeadings||r.invalidClasses.length||r.fonts.some(f=>!/pretendard/i.test(f))||r.width<=0||r.images!==model.sections.length||r.texts!==expectedTexts||r.overflow||r.outOfBounds.length||r.inkOutOfBounds.length||r.referenceBounds.failures.length||r.typographyMismatches.length||(r.hostStyleGeometryDifferencePx||0)>.1||(r.maxGeometryDifferencePx||0)>.1||r.hostTypographyUnchanged===false)||errors.length>0||policyErrors.length>0;
 const report={project:root,scope:partial?'partial':'full',sections,verifiedAt:new Date().toISOString(),inputHash:createHash('sha256').update(JSON.stringify(model)).update(fragment).update(await fs.readFile(path.join(root,'preview.html'))).digest('hex'),method:'Standalone rendering with browser-only site global font stylesheet and scoped-style stress test; optional browser-only Shopify description replacement. No product or theme saved.',url,results,shopify,errors,policyErrors,hostFont:host.family,structureAudit,passed:!failed};
 const reportPath=path.join(validation,'report.json');await fs.writeFile(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify(args.includes('--summary')?briefReport(report,reportPath):report,null,2));if(failed)process.exitCode=1;
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}

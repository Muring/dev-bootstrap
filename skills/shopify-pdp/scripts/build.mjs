import fs from 'node:fs/promises';
import path from 'node:path';
import {options,launch,projectModel} from './runtime.mjs';
import {readHost} from './host.mjs';
import {roles,resolveTypography} from './typography.mjs';
const {args,value}=options();
if(args.includes('--help')){console.log('pdp build --project DIR [--layout FILE] [--cdn-map FILE] [--output FILE] [--local-images] [--url SHOPIFY_URL] [--selector CSS_SELECTOR]');process.exit(0);}
const {root,model}=await projectModel(value('--project'),value('--layout')||'layout.px.json');
await fs.mkdir(path.join(root,'_work'),{recursive:true});
const defaultCdn=path.join(root,'cdn-map.json');
const cdnPath=value('--cdn-map')||(!args.includes('--local-images')&&await fs.access(defaultCdn).then(()=>true,()=>false)?defaultCdn:null);
const cdnMap=cdnPath?JSON.parse(await fs.readFile(cdnPath,'utf8')):null;
const ns=model.namespace, scope=`.pdp-product.${ns}`;
const browser=await launch();
let measures,host;
const resolved=new Map(model.sections.flatMap(s=>s.texts.map(t=>[t.id,resolveTypography(t,s,model)])));
const runs=[...resolved.values()];
const hasInlineGroups=model.sections.some(s=>(s.text_groups||[]).some(g=>g.layout==='inline'));
const hasFlowGroups=model.sections.some(s=>(s.text_groups||[]).some(g=>g.layout==='flow'));
try{
 const page=await browser.newPage();
 const config=JSON.parse(await fs.readFile(path.join(root,'project.json'),'utf8').catch(()=>'{}'));
 host=await readHost(page,value('--url')||config.verification_url||model.verification_url,value('--selector'));
 measures=await page.evaluate(async({runs,family})=>{
  const ctx=document.createElement('canvas').getContext('2d'),result={};
  for(const t of runs){const f=`${t.weight} ${t.size*t.render_ratio}px ${family}`;await document.fonts.load(f,t.text);ctx.font=f;ctx.fontKerning='none';ctx.letterSpacing=`${(t.tracking||0)*t.render_ratio}px`;const m=ctx.measureText(t.text);result[t.id]={width:m.width,ascent:m.actualBoundingBoxAscent,descent:m.actualBoundingBoxDescent,left:m.actualBoundingBoxLeft,right:m.actualBoundingBoxRight,fa:m.fontBoundingBoxAscent,fd:m.fontBoundingBoxDescent};for(const key of Object.keys(result[t.id]))result[t.id][key]/=t.render_ratio;}
  return result;
 },{runs,family:host.family});
}finally{await browser.close();}
const q=n=>`${+(n*100/model.design_width).toFixed(1)}cqi`;
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const usedRoles=Object.keys(roles).filter(key=>runs.some(t=>t.typography_key===key));
let css=`/* base */\n${scope}{display:block;position:relative;width:100%;max-width:${model.design_width}px;margin:0;padding:0;border:0;container-type:inline-size;isolation:isolate;overflow:hidden;background:#fff;color:#000;color-scheme:only light;text-align:left;direction:ltr;font-weight:400;line-height:1;letter-spacing:normal;text-transform:none;}\n`;
css+=`${scope} *,${scope} *::before,${scope} *::after{all:unset;box-sizing:border-box;}\n`;
css+=`/* common */\n${scope} .pdp-product__section{display:block;position:relative;width:100%;overflow:hidden;}\n`;
css+=`${scope} .pdp-product__image{display:block;width:100%;max-width:100%;height:auto;pointer-events:none;-webkit-user-drag:none;-webkit-user-select:none;user-select:none;}\n`;
css+=`${scope} .pdp-product__text{display:block;position:absolute;width:max-content;text-align:left;text-indent:0;text-transform:none;white-space:pre;line-height:1;letter-spacing:0;word-spacing:0;font-style:normal;font-kerning:none;font-synthesis:none;writing-mode:horizontal-tb;-webkit-user-select:text;user-select:text;}\n`;
css+=`${scope} .pdp-product__shape{position:absolute;display:block;}\n`;
css+=`${scope} .pdp-product__sr-only{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;}\n`;
css+=`${scope} .pdp-product__copy{display:block;height:0;}\n`;
if(hasInlineGroups)css+=`${scope} .pdp-product__copy--inline{position:absolute;display:flex;align-items:baseline;height:auto;width:max-content;}\n`;
if(hasFlowGroups){
 css+=`${scope} .pdp-product__copy--flow{position:absolute;height:auto;}\n`;
 css+=`${scope} .pdp-product__copy--flow > .pdp-product__text{position:static;width:auto;}\n`;
}
css+='/* typography */\n';
const exceptionStyles=new Map(),exceptionDefaults=new Map();
for(const section of model.sections){const ratio=model.design_width/(section.width*section.scale);for(const source of section.texts){const t=resolved.get(source.id);if(!t.typography_exception)continue;
 const style={ 'font-size':q(t.size*ratio),'font-weight':String(t.weight),'line-height':String(t.line_height),'letter-spacing':q((t.tracking||0)*ratio)};
 exceptionStyles.set(t.id,style);if(!exceptionDefaults.has(t.css_role))exceptionDefaults.set(t.css_role,new Map());
 const counts=exceptionDefaults.get(t.css_role),key=JSON.stringify(style);counts.set(key,(counts.get(key)||0)+1);
}}
for(const [role,counts] of exceptionDefaults)exceptionDefaults.set(role,JSON.parse([...counts].sort((a,b)=>b[1]-a[1])[0][0]));
const roleColors=new Map();
for(const t of runs){const key=t.typography_key||t.css_role;if(!roleColors.has(key))roleColors.set(key,new Map());const counts=roleColors.get(key);counts.set(t.color,(counts.get(t.color)||0)+1);}
for(const [role,counts] of roleColors)roleColors.set(role,[...counts].sort((a,b)=>b[1]-a[1])[0][0]);
const sharedRules=new Map();
const textDefaults={'line-height':'1','letter-spacing':'0cqi'};
const typographyProperties=r=>({'font-size':`${r.size}cqi`,'font-weight':String(r.weight),'line-height':String(r.lineHeight),'letter-spacing':`${r.tracking}cqi`});
function shareTypography(selector,properties,defaults=textDefaults){
 const style=Object.entries(properties).filter(([key,value])=>defaults[key]!==value).map(([key,value])=>`${key}:${value};`).join('');
 if(!sharedRules.has(style))sharedRules.set(style,[]);sharedRules.get(style).push(selector);
}
for(const key of usedRoles){
 const compact=key==='title-compact',cls=compact?'pdp-product__title--compact':`pdp-product__${key}`;
 const properties=typographyProperties(roles[key]);if(!compact)properties.color=roleColors.get(key);
 shareTypography(`${scope} .pdp-product__text.${cls}`,properties,compact?typographyProperties(roles.title):textDefaults);
}
for(const [role,properties] of exceptionDefaults)shareTypography(`${scope} .pdp-product__text.pdp-product__${role}`,{...properties,color:roleColors.get(role)});
for(const [style,selectors] of sharedRules)css+=`${selectors.join(',')}{${style}}\n`;
if(runs.some(t=>t.emphasis==='strong'))css+=`${scope} .pdp-product__text.pdp-product__text--strong{font-weight:700;}\n`;
if(runs.some(t=>t.emphasis==='medium'))css+=`${scope} .pdp-product__text.pdp-product__text--medium{font-weight:500;}\n`;
if(hasInlineGroups)css+=`${scope} .pdp-product__copy--inline > .pdp-product__text{position:static;color:inherit;}\n`;
let body=`<div class="pdp-product ${ns}" lang="en">\n`;
const geometry=[];
for(const [index,s] of model.sections.entries()){
 const sectionNumber=String(index+1).padStart(2,'0');
 const sectionScope=`${scope} .pdp-product__section--${sectionNumber}`;
 const roleCounts={};
 const textNodes=new Map();
 const inlineGroups=(s.text_groups||[]).filter(g=>g.layout==='inline'),inlineIds=new Set(inlineGroups.flatMap(g=>g.texts));
 const flowIds=new Set((s.text_groups||[]).filter(g=>g.layout==='flow').flatMap(g=>g.texts));
 if(s.texts.length||s.shapes.length)css+=`/* section ${sectionNumber} */\n`;
 const ratio=model.design_width/(s.width*s.scale); // reference coordinates to the displayed background
 if(s.lead_in){
  if(!(s.lead_in.height>0)||!/^linear-gradient\([^;{}]+\)$/.test(s.lead_in.background))throw Error('Invalid audited section lead-in');
  css+=`${sectionScope}{padding-top:${q(s.lead_in.height*ratio)};background:${s.lead_in.background} top / 100% ${q(s.lead_in.height*ratio)} no-repeat;}\n`;
 }
 body+=`\n  <!-- section ${sectionNumber} -->\n  <section class="pdp-product__section pdp-product__section--${sectionNumber}" aria-labelledby="${ns}-section-${index}-title">\n`;
 const title=s.texts.find(t=>t.tag==='h2');
 if(!title)body+=`    <h2 id="${ns}-section-${index}-title" class="pdp-product__title pdp-product__sr-only">${escape(s.label)}</h2>\n`;
 const src=cdnMap?cdnMap[s.image]:'images/'+s.image;
 if(!src)throw new Error(`CDN URL missing for ${s.image}`);
 if(cdnMap&&!/^https:\/\//.test(src))throw new Error('CDN image URLs must use https');
 body+=`    <img class="pdp-product__image" src="${escape(src)}" width="${s.width}" height="${s.height}" alt="${escape(s.alt)}" draggable="false"${index?' loading="lazy"':' fetchpriority="high"'} decoding="async">\n`;
 // Shared decoration belongs to the section's shape base; instances keep only differences.
 const shapeStyles=s.shapes.map(shape=>({height:q(shape.height*ratio),border:`${q(shape.border*ratio)} solid ${shape.borderColor}`,'border-radius':q(shape.radius*ratio),background:shape.background}));
 const shapeDefaults={};
 if(shapeStyles.length>1){
  for(const property of Object.keys(shapeStyles[0])){
   const counts=new Map();for(const style of shapeStyles)counts.set(style[property],(counts.get(style[property])||0)+1);
   const [value,count]=[...counts].sort((a,b)=>b[1]-a[1])[0];if(count>1)shapeDefaults[property]=value;
  }
  if(Object.keys(shapeDefaults).length)css+=`${sectionScope} .pdp-product__shape{${Object.entries(shapeDefaults).map(([key,value])=>`${key}:${value};`).join('')}}\n`;
 }
 for(const [i,shape] of s.shapes.entries()){
  const differences=Object.entries(shapeStyles[i]).filter(([key,value])=>shapeDefaults[key]!==value).map(([key,value])=>`${key}:${value};`).join('');
  css+=`${sectionScope} .pdp-product__shape--${String(i+1).padStart(2,'0')}{left:${q(shape.x*ratio)};top:${q(shape.y*ratio)};width:${q(shape.width*ratio)};${differences}}\n`;
  body+=`    <span class="pdp-product__shape pdp-product__shape--${String(i+1).padStart(2,'0')}" aria-hidden="true"></span>\n`;
 }
 for(const source of s.texts){
  const t=resolved.get(source.id);
  const role=t.css_role||(t.tag==='h2'?'title':'text');
  if(!/^[a-z][a-z0-9-]*$/.test(role))throw Error('css_role must be a lowercase BEM element name');
  const roleNumber=String(roleCounts[role]=(roleCounts[role]||0)+1).padStart(2,'0');
  const classes=[...new Set(['pdp-product__text',`pdp-product__${role}`,`pdp-product__${role}--${roleNumber}`,...(t.typography_variant?[`pdp-product__${role}--${t.typography_variant}`]:[]),...(t.emphasis?[`pdp-product__text--${t.emphasis}`]:[])])].join(' ');
  const m=measures[t.id],baselineOffset=(t.size*t.line_height+m.fa-m.fd)/2;
  let x=t.x,y=t.y-baselineOffset;
  if(t.ink){x=t.ink[0]+m.left;y=t.ink[1]+m.ascent-baselineOffset;}
  if(t.rotation){const angle=t.rotation*Math.PI/180;x=t.x+baselineOffset*Math.sin(angle);y=t.y-baselineOffset*Math.cos(angle);}
  const boxWidth=t.box_width??Math.max(m.width,m.left+m.right),boxHeight=t.box_height??t.size*t.line_height;
  if(t.reference_box&&!t.rotation){
   const ref=t.reference_box,inkWidth=m.left+m.right;
   x=ref.x+m.left+(ref.align==='center'?(ref.width-inkWidth)/2:ref.align==='right'?ref.width-inkWidth:0);
   y=ref.y+m.ascent-baselineOffset;
  }else if(t.text_align==='center'&&t.typography_anchor&&!t.rotation)x=t.typography_anchor.x+(t.typography_anchor.width-boxWidth)/2;
  let exception=t.typography_exception?Object.entries(exceptionStyles.get(t.id)).filter(([key,val])=>val!==exceptionDefaults.get(role)[key]).map(([key,val])=>`${key}:${val};`).join(''):'';
  if(t.typography_fit&&!t.typography_exception){
   const base=roles[t.typography_key],baseWeight=t.emphasis==='strong'?700:t.emphasis==='medium'?500:base.weight;
   if(q(t.size*ratio)!==`${base.size}cqi`)exception+=`font-size:${q(t.size*ratio)};`;
   if(t.weight!==baseWeight)exception+=`font-weight:${t.weight};`;
   if(q(t.tracking*ratio)!==`${base.tracking}cqi`)exception+=`letter-spacing:${q(t.tracking*ratio)};`;
  }
  const explicitBox=`${t.box_width!==undefined?`width:${q(t.box_width*ratio)};`:''}${t.box_height!==undefined?`height:${q(t.box_height*ratio)};`:''}`;
  const inlineGroup=inlineGroups.find(g=>g.texts.includes(t.id));
  const inheritedColor=inlineGroup?s.texts.find(t=>t.id===inlineGroup.texts[0]).color:roleColors.get(t.typography_key==='title-compact'?'title':t.typography_key||role);
  const color=inheritedColor===t.color?'':`color:${t.color};`;
  const declarations=`${inlineIds.has(t.id)||flowIds.has(t.id)?'':`left:${q(x*ratio)};top:${q(y*ratio)};`}${explicitBox}${color}${exception}${t.rotation?`transform-origin:0 0;transform:rotate(${t.rotation}deg);`:''}`;
  if(declarations)css+=`${sectionScope} .pdp-product__${role}--${roleNumber}{${declarations}}\n`;
  textNodes.set(t.id,`    <${t.tag}${source===title?` id="${ns}-section-${index}-title"`:''} class="${classes}">${escape(t.text)}</${t.tag}>\n`);
  geometry.push({id:t.id,text:t.text,role,key:t.typography_key,size:t.size,weight:t.weight,lineHeight:t.line_height,tracking:t.tracking,x,y,width:boxWidth,height:boxHeight,rotation:t.rotation||0,section:index});
 }
 const grouped=new Set();
 const groupFor=new Map(),groupIds=new Set();
 for(const group of s.text_groups||[]){
  if(!/^[a-z][a-z0-9-]*$/.test(group.id)||groupIds.has(group.id))throw Error('Text group IDs must be unique lowercase names within their section');
  groupIds.add(group.id);
  if(group.texts.length<2||new Set(group.texts).size!==group.texts.length)throw Error('A text group needs at least two distinct runs');
  for(const id of group.texts){if(!textNodes.has(id)||groupFor.has(id))throw Error(`Invalid/duplicate grouped text: ${id}`);groupFor.set(id,group);}
 }
 for(const t of s.texts){
  const group=groupFor.get(t.id);
  if(!group){body+=textNodes.get(t.id);continue;}
  if(grouped.has(group.id))continue;grouped.add(group.id);
  const members=group.texts.map(id=>s.texts.find(t=>t.id===id));
  const tag=members.some(t=>t.tag==='h2')?'h2':'p';
  const titleId=members.includes(title)?` id="${ns}-section-${index}-title"`:'';
  let groupClass='pdp-product__copy';
  if(group.layout==='inline'){
   if(group.separator)throw Error('Inline flow groups must retain separators in their original text');
   const first=geometry.find(t=>t.id===members[0].id),width=members.reduce((sum,t)=>sum+measures[t.id].width,0);
   const anchors=members.map(t=>t.typography_anchor||geometry.find(g=>g.id===t.id));
   const left=Math.min(...anchors.map(a=>a.x)),right=Math.max(...anchors.map(a=>a.x+a.width));
   const x=group.align==='center'?(left+right-width)/2:first.x;
   groupClass+=` pdp-product__copy--inline pdp-product__copy--${group.id}`;
   css+=`${sectionScope} .pdp-product__copy--${group.id}{left:${q(x*ratio)};top:${q((first.y+(group.offset_y||0))*ratio)};color:${members[0].color};${group.box_width?`width:${q(group.box_width*ratio)};`:''}}\n`;
  }
  if(group.layout==='flow'){
   const boxes=members.map(t=>geometry.find(g=>g.id===t.id));
   if(boxes.some((g,i)=>g.rotation||(i&&g.y<=boxes[i-1].y)))throw Error('Flow groups require unrotated text in top-to-bottom order');
   if(!(group.box_width>0))throw Error('Flow groups require an audited paragraph box_width');
   const quantized=n=>parseFloat(q(n*ratio));
   const x=Math.min(...boxes.map(g=>quantized(g.x))),y=quantized(boxes[0].y);
   groupClass+=` pdp-product__copy--flow pdp-product__copy--${group.id}`;
   css+=`${sectionScope} .pdp-product__copy--${group.id}{left:${x}cqi;top:${y}cqi;width:${q(group.box_width*ratio)};}\n`;
   boxes.forEach((g,i)=>{
    const node=textNodes.get(g.id),modifier=node.match(/pdp-product__([a-z-]+--\d+)/)[1];
    const left=+(quantized(g.x)-x).toFixed(1);
    const height=i<boxes.length-1?+(quantized(boxes[i+1].y)-quantized(g.y)).toFixed(1):null;
    const declarations=`${left?`margin-left:${left}cqi;`:''}${height!==null?`height:${height}cqi;`:''}`;
    if(declarations)css+=`${sectionScope} .pdp-product__${modifier}{${declarations}}\n`;
   });
  }
  const children=members.map(t=>textNodes.get(t.id).trim().replace(/^<\w+/, '<span').replace(/<\/\w+>$/, '</span>').replace(/ id="[^"]*"/,''));
  body+=`    <${tag}${titleId} class="${groupClass}">${children.join(group.layout==='flow'?'':group.separator==='br'?'<br>':group.separator==='space'?' ':'')}</${tag}>\n`;
 }
 body+='  </section>\n';
}
body+='</div>\n';
// Normal-flow groups add row geometry after typography is measured. Consolidate
// their per-run declarations, then share identical styles within that section.
for(const [index,section] of model.sections.entries()){
 if(!(section.text_groups||[]).some(g=>g.layout==='flow'))continue;
 const prefix=`${scope} .pdp-product__section--${String(index+1).padStart(2,'0')} `;
 const rules=new Map();
 for(const match of css.matchAll(/([^{}\n]+)\{([^{}]*)\}\n/g)){
  if(!match[1].startsWith(prefix)||!/ \.pdp-product__[a-z-]+--\d+$/.test(match[1]))continue;
  const declarations=rules.get(match[1])||new Map();
  for(const declaration of match[2].split(';').filter(Boolean)){
   const colon=declaration.indexOf(':');declarations.set(declaration.slice(0,colon),declaration.slice(colon+1));
  }
  rules.set(match[1],declarations);
 }
 const shared=new Map();
 for(const [selector,declarations] of rules){
  const body=[...declarations].map(([k,v])=>`${k}:${v};`).join('');
  if(!shared.has(body))shared.set(body,[]);shared.get(body).push(selector);
 }
 let emitted=false;
 css=css.replace(/([^{}\n]+)\{([^{}]*)\}\n/g,(whole,selector)=>{
  if(!rules.has(selector))return whole;
  if(emitted)return '';emitted=true;
  return [...shared].map(([body,selectors])=>`${selectors.join(',')}{${body}}\n`).join('');
 });
}
// Expand structural rules; keep short typography/position differences on one readable line.
let compact=false;
css=css.replace(/([^{}]+)\{([^{}]*)\}\n/g,(_,selector,declarations)=>{
 if(selector.includes('/* typography */'))compact=true;
 const entries=declarations.split(';').filter(Boolean).map(d=>{const i=d.indexOf(':');return `${d.slice(0,i)}: ${d.slice(i+1)};`;});
 const label=selector.trim().replace(/\*\//g,'*/\n').replaceAll(',',',\n');
 if(compact&&entries.length<=5)return `${label} { ${entries.join(' ')} }\n`;
 return `${label} {\n${entries.map(d=>'  '+d).join('\n')}\n}\n\n`;
});
// Visually separate every section heading from both neighboring rules.
css=css.replace(/\n*(\/\* section \d+ \*\/)\n*/g,'\n\n$1\n\n');
const html=`<style>\n\n${css.trim()}\n</style>\n${body}`;
const output=value('--output')||'description.html';await fs.writeFile(path.resolve(root,output),html);
await fs.writeFile(path.join(root,'_work/geometry.json'),JSON.stringify(geometry,null,2));
let previewFragment=html;
if(cdnMap)for(const section of model.sections)previewFragment=previewFragment.replace(`src="${escape(cdnMap[section.image])}"`,`src="images/${escape(section.image)}"`);
await fs.writeFile(path.join(root,'preview.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="data:,"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(model.name)} — PDP</title><style>html,body{margin:0;padding:0;background:#ddd}body{display:flex;justify-content:center}</style></head><body>${previewFragment}</body></html>`);
await fs.writeFile(path.join(root,'_work/description.css'),css);
console.log(`${output}: ${model.sections.length} backgrounds, ${runs.length} text runs, ${Buffer.byteLength(html)} bytes. All overlay geometry is cqi.`);

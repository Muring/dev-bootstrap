// Run in a browser with page.evaluate(auditFragment, {fragment, model}).
export function auditFragment({fragment,model}){
 const doc=new DOMParser().parseFromString(fragment,'text/html'),styleTexts=[...doc.querySelectorAll('style')].map(e=>e.textContent),css=styleTexts.join('\n');
 const errors=[],sections=[...doc.querySelectorAll('.pdp-product__section')];
 const comments=styleTexts.flatMap(text=>[...text.matchAll(/\/\* section (\d+) \*\/([\s\S]*?)(?=\/\*|$)/g)]);
 for(const [,number,body] of comments)if(!body.includes('{'))errors.push(`Empty CSS section ${number}`);
 for(const text of styleTexts)for(const m of text.matchAll(/\/\* section \d+ \*\//g)){const end=m.index+m[0].length;if(text.slice(m.index-2,m.index)!=='\n\n'||text.slice(end,end+2)!=='\n\n'||text[m.index-3]==='\n'||text[end+2]==='\n')errors.push('Section comment needs exactly one blank line above and below');}
 const expectedSections=model.sections.flatMap((s,i)=>s.texts.length||s.shapes.length?[String(i+1).padStart(2,'0')]:[]);
 if(JSON.stringify(comments.map(m=>m[1]))!==JSON.stringify(expectedSections))errors.push('CSS section groups do not match sections with rules');
 const sheet=new CSSStyleSheet();sheet.replaceSync(css);const declarations=new Map(),selectors=new Set();
 for(const rule of sheet.cssRules){
  if(!rule.selectorText)continue;
  if(selectors.has(rule.selectorText))errors.push(`Duplicate selector: ${rule.selectorText}`);selectors.add(rule.selectorText);
  if(!rule.style.length)errors.push(`Empty CSS rule: ${rule.selectorText}`);
  const key=[...rule.style].sort().map(k=>`${k}:${rule.style.getPropertyValue(k)}!${rule.style.getPropertyPriority(k)}`).join(';');
  if(declarations.has(key))errors.push(`Duplicate declaration block: ${declarations.get(key)} / ${rule.selectorText}`);declarations.set(key,rule.selectorText);
  for(const selector of rule.selectorText.split(','))if(!doc.querySelector(selector.replace(/::(?:before|after)/g,'').trim()))errors.push(`Unused selector: ${selector}`);
 }
 // Catch partial duplication too: different coordinates do not justify repeating decoration.
 for(const [i,section] of model.sections.entries()){
  const marker=`.pdp-product__section--${String(i+1).padStart(2,'0')} `;
  const instanceRules=[...sheet.cssRules].filter(r=>r.selectorText?.includes(marker)&&/\.pdp-product__shape--\d+/.test(r.selectorText));
  for(const property of ['background','border','border-radius']){
   const seen=new Map();for(const rule of instanceRules){const value=rule.style.getPropertyValue(property);if(!value)continue;
    if(seen.has(value))errors.push(`Repeated shape ${property} in section ${i+1}: factor it into a shared rule`);seen.set(value,true);
   }
  }
 }
 if(/\ball\s*:\s*unset\b/.test(css)){
  for(const rule of sheet.cssRules){if(!rule.selectorText?.includes('.pdp-product__'))continue;
   for(const [property,value] of [['margin','0px'],['padding','0px'],['border','0px'],['box-shadow','none'],['background','none']]){
    const actual=rule.style.getPropertyValue(property);if(actual&&(actual===value||actual==='0'&&value==='0px'))errors.push(`Redundant reset after all: unset: ${rule.selectorText} / ${property}`);
   }
  }
 }
 const expected=model.sections.flatMap(s=>s.texts),actual=[...doc.querySelectorAll('.pdp-product__text')],byId=new Map();
 for(const [i,section] of model.sections.entries()){
  const counts={};for(const t of section.texts){const role=t.css_role||(t.tag==='h2'?'title':'text'),number=String(counts[role]=(counts[role]||0)+1).padStart(2,'0');
   const el=sections[i]?.querySelector(`.pdp-product__${role}--${number}`);
   if(!el||el.textContent!==t.text)errors.push(`Source copy mismatch: ${t.id}`);else byId.set(t.id,el);
  }
 }
 if(actual.length!==expected.length||new Set(byId.values()).size!==expected.length)errors.push('Source text count/uniqueness mismatch');
 for(const el of doc.querySelectorAll('*'))for(const attr of el.attributes)if(attr.name.startsWith('data-'))errors.push(`Unnecessary data attribute: ${attr.name}`);
 if(sections.length!==model.sections.length)errors.push('HTML section count mismatch');
 for(const [i,s] of sections.entries()){
  const title=doc.getElementById(s.getAttribute('aria-labelledby'));
  if(!title||title.tagName!=='H2'||title.parentElement!==s||!title.textContent.trim())errors.push(`Invalid heading: section ${i+1}`);
  for(const g of model.sections[i]?.text_groups||[]){
   const members=g.texts.map(id=>byId.get(id)),parent=members[0]?.parentElement;
   if(!parent?.classList.contains('pdp-product__copy')||members.some(el=>el?.parentElement!==parent)||JSON.stringify([...parent.querySelectorAll('.pdp-product__text')].map(el=>members.indexOf(el)))!==JSON.stringify(members.map((_,j)=>j)))errors.push(`Invalid text group ${i+1}/${g.id}`);
  }
 }
 if(/font-family\s*:|@font-face|base64,|\bfont\s*:|(?:scale|translate|matrix|skew)\w*\(/i.test(css))errors.push('Forbidden font or compensating transform');
 if(/pdp-product__text--style-\d+/.test(fragment))errors.push('Use semantic typography roles instead of numbered style classes');
 if(/\d+\.\d{2,}cqi\b/.test(css))errors.push('cqi precision exceeds one decimal');
 for(const el of doc.querySelectorAll('[class]'))for(const c of el.classList)if(!/^pdp-product(?:__[a-z0-9-]+|--[a-z0-9-]+)?$/.test(c))errors.push(`Non-BEM class ${c}`);
 return {passed:errors.length===0,errors,cssRules:sheet.cssRules.length,cssSections:comments.length,htmlSections:sections.length,textRuns:actual.length};
}

if(process.argv[1]&&import.meta.url===(await import('node:url')).pathToFileURL(process.argv[1]).href){
 const {options,launch,projectModel}=await import('./runtime.mjs');const fs=await import('node:fs/promises'),path=await import('node:path');const {args,value}=options();
 if(args.includes('--help')){console.log('pdp audit --project DIR [--summary] — offline HTML/CSS structure checks');process.exit(0);}
 const {root,model}=await projectModel(value('--project')),fragment=await fs.readFile(path.join(root,'description.html'),'utf8'),browser=await launch();
 try{const page=await browser.newPage(),result=await page.evaluate(auditFragment,{fragment,model});await fs.mkdir(path.join(root,'validation'),{recursive:true});await fs.writeFile(path.join(root,'validation/structure-audit.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(args.includes('--summary')?{passed:result.passed,scope:'full-structure',report:path.join(root,'validation/structure-audit.json'),errorCount:result.errors.length,errors:result.errors.slice(0,5)}:result,null,2));if(!result.passed)process.exitCode=1;}finally{await browser.close();}
}

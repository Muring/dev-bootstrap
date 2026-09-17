import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
export function options(){const args=process.argv.slice(2);const value=k=>{const i=args.indexOf(k);return i<0?null:args[i+1];};return {args,value};}
export async function launch(){
 const runtime=process.env.PDP_RUNTIME||path.join(process.env.XDG_CACHE_HOME||path.join(os.homedir(),'.cache'),'shopify-pdp');
 let chromium;try{({chromium}=createRequire(path.join(runtime,'node/package.json'))('playwright'));}catch{throw new Error('PDP runtime is not installed. Run pdp setup.');}
 return chromium.launch({headless:true,executablePath:process.env.PDP_CHROME||chromium.executablePath(),env:{...process.env,LD_LIBRARY_PATH:[path.join(runtime,'libs/usr/lib/x86_64-linux-gnu'),process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')}});
}
export async function projectModel(project,layout='layout.px.json'){
 if(!project)throw new Error('--project /output/directory is required');
 const root=path.resolve(project),model=JSON.parse(await fs.readFile(path.resolve(root,layout),'utf8'));
 if(model.reviewed===false)throw new Error('The initial layout is unreviewed. Audit missing copy and geometry, then set reviewed: true.');
 if(!/^pdp-product--[a-z][a-z0-9-]*$/.test(model.namespace))throw new Error('namespace must be a pdp-product--handle BEM modifier');
 if(!(model.design_width>0)||!model.sections?.length)throw new Error('design_width and sections are required');
 const ids=new Set();for(const s of model.sections){if(!(s.width>0&&s.height>0&&s.scale>0)||path.basename(s.image)!==s.image)throw new Error('Invalid image dimensions, scale or filename');
  if(!s.texts.some(t=>t.tag==='h2')&&!s.label?.trim())throw Error('Sections without a visible h2 require an audited label');
  for(const t of s.texts){if(ids.has(t.id)||!/^[a-z][a-z0-9-]*$/i.test(t.id))throw new Error('Text ids must be unique CSS-safe names');ids.add(t.id);if(!['p','span','h2','h3','h4','b'].includes(t.tag))throw new Error('Invalid HTML text tag');}
 }
 return {root,model};
}

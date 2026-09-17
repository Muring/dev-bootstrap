"""Reusable AI text/font inspection and background-based PDP preparation.
Never extracts AI/PDF images. All product paths are command arguments or data.
"""
import argparse, hashlib, io, json, re, shutil, os
from library import library_root, store_font, generate_index
from pathlib import Path

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2))

def inspect(args):
    import pymupdf
    from PIL import Image
    source=Path(args.source).resolve(); project=Path(args.project).resolve()
    if not source.is_dir(): raise ValueError(f'Source directory does not exist: {source}')
    inventory={'source':str(source),'backgrounds':[],'references':[],'documents':[]}
    for f in sorted(source.rglob('*')):
        if f.suffix.lower() in ['.jpg','.jpeg','.png','.webp']:
            with Image.open(f) as im:
                item={'path':str(f),'width':im.width,'height':im.height,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()}
            inventory['backgrounds' if f.parent.name=='images' else 'references'].append(item)
    for number,f in enumerate(sorted(p for p in source.iterdir() if p.suffix.lower() in ['.ai','.pdf'])):
        doc=pymupdf.open(f); entry={'path':str(f),'pages':[]}
        for index,page in enumerate(doc):
            data=page.get_text('dict',flags=pymupdf.TEXT_PRESERVE_WHITESPACE)
            # No TEXT_PRESERVE_IMAGES flag: all blocks here are text/geometry.
            assert all(b['type']==0 for b in data['blocks'])
            filename=f'document-{number}-page-{index}.json'
            write_json(project/'_work'/filename,{'page':index+1,'width':page.rect.width,'height':page.rect.height,'text':data,'traces':page.get_texttrace(),'fonts':page.get_fonts()})
            entry['pages'].append({'number':index+1,'width':page.rect.width,'height':page.rect.height,'data':filename})
        inventory['documents'].append(entry)
    write_json(project/'_work/inventory.json',inventory)
    print(f"Inspected {len(inventory['backgrounds'])} backgrounds, {len(inventory['references'])} references, {len(inventory['documents'])} AI/PDF files. No images extracted.")

def init(args):
    from PIL import Image
    import re
    if not re.fullmatch(r'pdp-product--[a-z][a-z0-9-]*',args.namespace):raise ValueError('Use a pdp-product--handle BEM namespace.')
    project=Path(args.project).resolve(); source=Path(args.source).resolve()
    if (project/'layout.px.json').exists(): raise ValueError('An existing layout will not be overwritten.')
    images=sorted(p for p in (source/'images').iterdir() if p.suffix.lower() in ['.jpg','.jpeg','.png','.webp'])
    if not images: raise ValueError('No supplied background images found.')
    sections=[]; project.mkdir(parents=True,exist_ok=True)
    image_dir=project/'images'
    if not image_dir.exists():image_dir.symlink_to(os.path.relpath(source/'images',project),target_is_directory=True)
    if image_dir.resolve()!=(source/'images').resolve():raise ValueError('Existing image directory does not reference the requested original source.')
    for f in images:
        dest=project/'images'/f.name
        if dest.exists() and dest.read_bytes()!=f.read_bytes(): raise ValueError(f'Conflicting output image: {dest}')
        if f.resolve()!=dest.resolve(): shutil.copy2(f,dest)
        with Image.open(f) as im: sections.append({'image':f.name,'page':None,'origin_y':0,'scale':1,'width':im.width,'height':im.height,'alt':'','label':'','texts':[],'shapes':[]})
    write_json(project/'layout.px.json',{'name':args.name,'namespace':args.namespace,'design_width':args.width,'reviewed':False,'sections':sections})
    metadata={'source':os.path.relpath(source,project),'image_mode':'reference'}
    root=library_root(project)
    if root:metadata['library']=os.path.relpath(root,project)
    write_json(project/'project.json',metadata)
    inspect(args)
    if root:generate_index(root)
    print('Created unreviewed layout. Review image order, source registration and missing text before building.')

def fonts(args):
    raise ValueError('Font extraction is not part of current PDP output; inspect AI metadata for provenance.')

def subset_fonts(args):
    raise ValueError('PDP inherits global Pretendard; product font subsetting is disabled.')

def register(args):
    from PIL import Image
    import numpy as np
    project=Path(args.project).resolve();mapping_path=Path(args.mapping).resolve();mapping=json.loads(mapping_path.read_text());out=[]
    for page_number,page in enumerate(mapping['pages'],1):
        reference=(mapping_path.parent/page['reference']).resolve()
        with Image.open(reference) as refim:ref=np.asarray(refim.convert('RGB'),dtype=float)
        ref_width=ref.shape[1];guess=page.get('start_y',0)
        for name in page['images']:
            with Image.open(project/'images'/name) as im:
                best=None
                for scale in (1,ref_width/im.width):
                    ar=np.asarray(im.convert('RGB').resize((ref_width,round(im.height*scale))),dtype=float)
                    rows=np.arange(min(20,max(0,len(ar)//8)),max(1,len(ar)-min(20,len(ar)//8)),9);cols=np.arange(0,ref_width,11)
                    for y in range(max(0,round(guess)-args.window),min(len(ref)-len(ar)+1,round(guess)+args.window+1)):
                        difference=np.abs(ar[rows[:,None],cols]-ref[y+rows[:,None],cols]).mean(axis=2);score=float(np.minimum(difference,30).mean())
                        if best is None or score<best[0]:best=(score,y,scale)
                if best is None:raise ValueError(f'No registration candidate for {name}. Check mapping, start_y and --window.')
                score,y,scale=best;out.append({'image':name,'page':page.get('number',page_number),'reference':str(reference),'origin_y':y,'scale':scale,'width':im.width,'height':im.height,'registration_error':score});guess=y+im.height*scale
            print(name,best,flush=True)
    write_json(project/'_work/registration.json',out)

def compare(args):
    from PIL import Image
    import html
    project=Path(args.project).resolve();model=json.loads((project/'layout.px.json').read_text());mapping_path=Path(args.mapping).resolve();mapping=json.loads(mapping_path.read_text());refs={p.get('number',i+1):(mapping_path.parent/p['reference']).resolve() for i,p in enumerate(mapping['pages'])};parts=[]
    (project/'references').mkdir(exist_ok=True)
    dimensions={}
    for number,reference in refs.items():
        link=project/'references'/f'page-{number}{reference.suffix.lower()}'
        if link.exists() or link.is_symlink():
            if link.resolve()!=reference:raise ValueError(f'Conflicting reference link: {link}')
        else:link.symlink_to(os.path.relpath(reference,link.parent))
        with Image.open(reference) as image:dimensions[number]=(image.width,image.height,link.name)
    for i,section in enumerate(model['sections'],1):
        width,height,filename=dimensions[section['page']];y=section['origin_y'];crop_height=min(round(section['height']*section['scale']+section.get('lead_in',{}).get('height',0)),height-y)
        shot=project/'validation'/f'section-{i:02d}.png'
        if not shot.exists():raise ValueError('Run pdp verify to create section screenshots first.')
        parts.append(f'<section><h2>{html.escape(section.get("label") or section["image"])}</h2><div class="pair"><div class="reference" style="aspect-ratio:{width}/{crop_height}"><img loading="lazy" alt="Reference JPG" src="references/{filename}" style="position:absolute;top:{-100*y/crop_height}%;left:0"></div><img loading="lazy" alt="Rendered HTML" src="validation/section-{i:02d}.png"></div></section>')
    (project/'comparison.html').write_text('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PDP 원본 비교</title><style>body{font-size:16px;margin:24px;background:#eee}section{max-width:1600px;margin:auto}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}img{display:block;width:100%;height:auto}.reference{position:relative;overflow:hidden}</style><p>왼쪽: 원본 JPG · 오른쪽: HTML 브라우저 캡처</p>'+''.join(parts)+'</html>')
    print('Comparison written using linked original references; no reference crops copied.')

def serve(args):
    from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
    from functools import partial
    server=ThreadingHTTPServer(('127.0.0.1',args.port),partial(SimpleHTTPRequestHandler,directory=str(Path(args.project).resolve())))
    page='index.html' if (Path(args.project)/'library.json').exists() else 'preview.html'
    print(f'Preview: http://127.0.0.1:{server.server_port}/{page}',flush=True);server.serve_forever()

parser=argparse.ArgumentParser(description=__doc__);commands=parser.add_subparsers(dest='command',required=True)
for name,fn in [('inspect',inspect),('init',init),('fonts',fonts),('subset',subset_fonts),('register',register),('compare',compare),('serve',serve)]:
    p=commands.add_parser(name);p.add_argument('--project',required=True);p.set_defaults(fn=fn)
    if name in ['inspect','init']:p.add_argument('--source',required=True)
    if name=='init':p.add_argument('--name',required=True);p.add_argument('--namespace',required=True);p.add_argument('--width',type=float,required=True)
    if name=='fonts':p.add_argument('--ai',required=True);p.add_argument('--font',action='append',required=True,help='AI font xref:output-alias, repeatable')
    if name in ['register','compare']:p.add_argument('--mapping',required=True)
    if name=='register':p.add_argument('--window',type=int,default=35)
    if name=='serve':p.add_argument('--port',type=int,default=0)
args=parser.parse_args()
try:args.fn(args)
except (ValueError,FileNotFoundError) as error:parser.exit(1,f'{error}\n')

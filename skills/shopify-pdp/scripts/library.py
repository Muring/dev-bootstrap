"""Shared library layout and content-addressed font storage for PDP projects."""
import argparse, hashlib, html, json, os, shutil
from pathlib import Path
from urllib.parse import quote

def dump(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2))

def library_root(project):
    config=project/'project.json'
    if config.exists():
        data=json.loads(config.read_text())
        if data.get('library'):return (project/data['library']).resolve()
    if project.parent.name=='products' and (project.parent.parent/'library.json').exists():return project.parent.parent
    return None

def initialize(root):
    root=Path(root).resolve();root.mkdir(parents=True,exist_ok=True)
    (root/'sources').mkdir(exist_ok=True);(root/'products').mkdir(exist_ok=True);(root/'shared/fonts').mkdir(parents=True,exist_ok=True)
    if not (root/'library.json').exists():dump(root/'library.json',{'version':1,'sources':'sources','products':'products','fonts':'shared/fonts'})
    return root

def store_font(project,alias,content,suffix='.woff2'):
    root=library_root(project)
    if root is None:
        target=project/'fonts'/f'{alias}{suffix}';target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(content);return target
    digest=hashlib.sha256(content).hexdigest();target=root/'shared/fonts'/f'{digest}{suffix.lower()}'
    target.parent.mkdir(parents=True,exist_ok=True)
    if target.exists():
        if target.read_bytes()!=content:raise ValueError('Shared font digest collision')
    else:target.write_bytes(content)
    return target

def share_fonts(project):
    raise ValueError('PDP inherits global Pretendard; shared-font adoption is disabled.')

def generate_index(root):
    root=initialize(root);cards=[];fontrefs={};products=[]
    for manifest in sorted((root/'products').glob('*/layout.px.json')):
        p=manifest.parent;m=json.loads(manifest.read_text());base='products/'+quote(p.name)+'/'
        report=p/'validation/report.json';passed=json.loads(report.read_text()).get('passed') if report.exists() else None
        entry={'slug':p.name,'name':m['name'],'sections':len(m['sections']),'text_runs':sum(len(s['texts']) for s in m['sections']),'validated':passed,'cdn_configured':(p/'cdn-map.json').exists()};products.append(entry)
        for alias,f in m.get('font_files',{}).items():
            resolved=(p/f).resolve()
            if resolved.parent==root/'shared/fonts':fontrefs.setdefault(resolved.name,[]).append({'product':p.name,'alias':alias})
        first=m['sections'][0]['image'];links=[f'<a href="{base}preview.html">미리보기</a>',f'<a href="{base}description.html">HTML</a>']
        if (p/'comparison.html').exists():links.append(f'<a href="{base}comparison.html">원본 비교</a>')
        state='검증 완료' if passed else '검증 대기'
        cards.append(f'<article data-name="{html.escape(m["name"].lower(),quote=True)}"><a class="cover" href="{base}preview.html"><img src="{base}images/{quote(first)}" alt="{html.escape(m["name"],quote=True)}" loading="lazy"></a><div class="content"><span class="state">{state}</span><h2>{html.escape(m["name"])}</h2><p>{entry["sections"]}개 섹션</p><nav>{"".join(links)}</nav></div></article>')
    dump(root/'catalog.json',products);dump(root/'shared/fonts/index.json',fontrefs)
    (root/'index.html').write_text('''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>제품 PDP</title><style>*{box-sizing:border-box}body{margin:0;background:#f5f5f2;color:#242d31;font:16px/1.6 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:56px 24px}header{margin-bottom:32px}h1{font-size:32px;margin:0 0 8px}header p{color:#626b70;margin:0 0 24px}input{width:100%;max-width:400px;padding:12px 16px;border:1px solid #ccd2d4;border-radius:8px;font:inherit}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:24px}article{background:white;border:1px solid #e2e5e4;border-radius:12px;overflow:hidden}.cover{display:block;height:260px;overflow:hidden;background:#eee}.cover img{width:100%;height:100%;object-fit:cover;object-position:top}.content{padding:24px}h2{font-size:21px;line-height:1.3;margin:12px 0}p{color:#697478}.state{font-size:13px;color:#176753}nav{display:flex;gap:16px;flex-wrap:wrap}a{color:#146e94;text-decoration:none}a:hover{text-decoration:underline}[hidden]{display:none!important}</style></head><body><main><header><h1>제품 PDP</h1><p>제품별 상세페이지와 원본 비교 화면을 확인하세요.</p><input id="search" type="search" aria-label="제품 검색" placeholder="제품 검색"></header><div class="grid">'''+''.join(cards)+'''</div></main><script>document.querySelector('#search').addEventListener('input',e=>{const query=e.target.value.toLowerCase().trim();document.querySelectorAll('article').forEach(card=>card.hidden=!card.dataset.name.includes(query));});</script></body></html>''')
    print(f'Library index updated: {len(products)} products, {len(fontrefs)} shared font files.')

def main():
    parser=argparse.ArgumentParser(description=__doc__);subs=parser.add_subparsers(dest='command',required=True)
    for name in ['library-init','index','share-fonts']:
        sub=subs.add_parser(name);sub.add_argument('--project' if name=='share-fonts' else '--root',required=True)
    a=parser.parse_args()
    if a.command=='library-init':generate_index(initialize(a.root))
    elif a.command=='index':generate_index(a.root)
    else:share_fonts(a.project)
if __name__=='__main__':main()

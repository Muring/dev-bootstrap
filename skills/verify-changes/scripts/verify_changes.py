#!/usr/bin/env python3
"""Select configured local regression checks, keep full logs off the model context."""
import argparse
from datetime import datetime, timezone
import fnmatch
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'session-brief/scripts'))
from worktree import snapshot


def config_checks(path):
    data=json.loads(path.read_text())
    if data.get('version')!=1 or not isinstance(data.get('checks'),list):raise ValueError('Expected checks config version 1')
    names=set()
    for c in data['checks']:
        name=c.get('name');cmd=c.get('command');patterns=c.get('paths',[])
        if not isinstance(name,str) or not name or name in names:raise ValueError('Check names must be unique nonempty strings')
        if not isinstance(cmd,list) or not cmd or not all(isinstance(v,str) and v for v in cmd):raise ValueError(f'{name}: command must be a nonempty argv array')
        if not isinstance(patterns,list) or not all(isinstance(v,str) for v in patterns):raise ValueError(f'{name}: paths must be a list')
        if not isinstance(c.get('timeout',120),(int,float)) or c.get('timeout',120)<=0:raise ValueError(f'{name}: timeout must be positive')
        names.add(name)
    return data['checks']


def choose(checks, files, names, all_checks=False, config_changed=False):
    unknown=set(names)-{c['name'] for c in checks}
    if unknown:raise ValueError('Unknown checks: '+', '.join(sorted(unknown)))
    if names:return [c for c in checks if c['name'] in names]
    return [c for c in checks if all_checks or config_changed or (files and (not c.get('paths') or any(fnmatch.fnmatchcase(f,pat) for f in files for pat in c['paths'])))]


def run_check(check, root, directory, index):
    log=directory/f'{index:02d}.log';start=time.monotonic();status='error';code=None
    with log.open('w') as output:
        try:
            proc=subprocess.Popen(check['command'],cwd=root,stdout=output,stderr=subprocess.STDOUT,start_new_session=True)
            try:code=proc.wait(timeout=check.get('timeout',120));status='passed' if code==0 else 'failed'
            except subprocess.TimeoutExpired:
                os.killpg(proc.pid,signal.SIGTERM)
                try:proc.wait(timeout=2)
                except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL);proc.wait()
                status='timeout'
        except OSError as e:output.write(str(e))
    result=dict(name=check['name'],command=check['command'],status=status,exit_code=code,seconds=round(time.monotonic()-start,2),log=str(log))
    if status!='passed':
        with log.open('rb') as f:f.seek(max(0,log.stat().st_size-4000));tail=f.read().decode(errors='replace')
        result['failure_tail']='\n'.join(tail.splitlines()[-15:])
    return result


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--repo',default='.')
    p.add_argument('--base',default='HEAD',help='base commit/ref; includes staged, unstaged and untracked changes')
    p.add_argument('--config',default='.agent-checks.json')
    p.add_argument('--check',action='append',default=[])
    p.add_argument('--all',action='store_true',help='all configured checks, not a whole-project code audit')
    p.add_argument('--run',action='store_true',help='execute reviewed config; default only lists selected argv')
    p.add_argument('--json',action='store_true')
    a=p.parse_args()
    try:
        before=snapshot(a.repo,a.base);root=Path(before['root']);path=Path(a.config)
        if not path.is_absolute():path=root/path
        checks=config_checks(path)
        files=[x['path'] for x in before['files']]
        try:config_changed=path.relative_to(root).as_posix() in files
        except ValueError:config_changed=False
        selected=choose(checks,files,a.check,a.all,config_changed)
        result=dict(root=str(root),head=before['head'],base=before['base'],fingerprint=before['fingerprint'],changed_files=files,selected=[dict(name=c['name'],command=c['command']) for c in selected],scope='Configured regression checks only; not code-audit or live UI validation. No cached passes are reused.',status='planned',checks=[])
        if a.run:
            directory=Path(tempfile.mkdtemp(prefix='verify-changes-'));directory.chmod(0o700)
            result['checks']=[run_check(c,root,directory,i) for i,c in enumerate(selected,1)]
            after=snapshot(root,a.base);result['worktree_changed_during_checks']=after['fingerprint']!=before['fingerprint']
            result['status']='no-checks' if not selected else ('passed' if all(c['status']=='passed' for c in result['checks']) else 'failed')
            if result['worktree_changed_during_checks']:result['status']='worktree-changed'
            result['completed_at']=datetime.now(timezone.utc).isoformat();result['report']=str(directory/'result.json')
            (directory/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
        if a.json:print(json.dumps(result,ensure_ascii=False,indent=2))
        else:
            print(f'{result["status"]}: {len(files)} changed files / {len(selected)} selected checks')
            for c in result['checks'] or result['selected']:print(f'{c["name"]}: {c.get("status","planned")} {c.get("log",c["command"])}')
            if 'report' in result:print(result['report'])
        return 0 if result['status'] in ('planned','passed') else 1
    except (ValueError,OSError) as e:
        print(json.dumps(dict(status='error',error=str(e)),ensure_ascii=False));return 2

if __name__=='__main__':sys.exit(main())

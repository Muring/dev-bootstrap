#!/usr/bin/env python3
"""Wait on existing GitHub commit statuses/checks; never deploy or modify GitHub."""
import argparse
import json
import re
import subprocess
import sys
import time


def gh_json(args, timeout=30):
    result = subprocess.run(['gh', *args], capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError(result.stderr.strip()[:1500] or f'gh exited {result.returncode}')
    return json.loads(result.stdout)


def status_rows(repo, sha, timeout=30):
    # Both APIs paginated; fold repeated status contexts and check reruns to newest.
    statuses = gh_json(['api', '--paginate', '--slurp', f'repos/{repo}/commits/{sha}/statuses?per_page=100'], timeout)
    pages = gh_json(['api', '--paginate', '--slurp', f'repos/{repo}/commits/{sha}/check-runs?per_page=100&filter=latest'], timeout)
    rows = {}
    for item in sorted((v for page in statuses for v in page), key=lambda v:v.get('id',0), reverse=True):
        name = item['context']
        rows.setdefault(('status',name), dict(kind='status', name=name, state=item['state'], url=item.get('target_url')))
    for item in sorted((v for page in pages for v in page['check_runs']), key=lambda v:v.get('id',0), reverse=True):
        name = item['name'];app = (item.get('app') or {}).get('id')
        state = item.get('conclusion') if item['status']=='completed' else 'pending'
        rows.setdefault(('check',app,name), dict(kind='check', name=name, state=state or 'pending', url=item.get('html_url')))
    return list(rows.values())


def evaluate(rows, required):
    present = {row['name'] for row in rows}
    missing = sorted(set(required)-present)
    selected = [row for row in rows if not required or row['name'] in required]
    failed = [row for row in selected if row['state'] in ('failure','error','cancelled','timed_out','action_required','startup_failure','stale')]
    pending = [row for row in selected if row['state'] not in ('success','neutral','skipped')]
    if failed: return 'failure', missing, selected
    # Empty status lists, missing required jobs and unknown states cannot pass.
    if missing or not selected or pending: return 'pending', missing, selected
    # Explicitly named required deployment must actually succeed, not be skipped.
    if required and any(row['state']!='success' for row in selected): return 'failure', missing, selected
    return 'success', missing, selected


def wait(fetch, required, timeout, interval, max_interval, notify=None, clock=time.monotonic, sleep=time.sleep):
    deadline = clock()+timeout; polls=0;previous=None;delay=interval
    while True:
        remaining = deadline-clock()
        if remaining <= 0: return dict(state='timeout', polls=polls, statuses=last_rows if polls else [], missing=last_missing if polls else required)
        rows = fetch(max(0.1,min(30,remaining)));polls+=1
        state, missing, selected = evaluate(rows, required)
        last_rows, last_missing = selected, missing
        snapshot=json.dumps([state,missing,selected],sort_keys=True)
        if snapshot != previous:
            if notify: notify(dict(state=state, polls=polls, missing=missing, statuses=selected))
            delay=interval;previous=snapshot
        if state != 'pending': return dict(state=state,polls=polls,missing=missing,statuses=selected)
        sleep(min(delay,max(0,deadline-clock())));delay=min(max_interval,delay*1.5)


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--repo',help='owner/repo; default current GitHub repository')
    p.add_argument('--sha',help='full commit SHA; default current HEAD')
    p.add_argument('--context',action='append',default=[],help='exact required status/check name; repeatable')
    p.add_argument('--timeout',type=float,default=600)
    p.add_argument('--interval',type=float,default=10)
    p.add_argument('--max-interval',type=float,default=45)
    p.add_argument('--json',action='store_true')
    args=p.parse_args()
    if min(args.timeout,args.interval,args.max_interval)<=0:p.error('times must be positive')
    if args.interval>args.max_interval:p.error('--interval must not exceed --max-interval')
    try:
        repo=args.repo or gh_json(['repo','view','--json','nameWithOwner'])['nameWithOwner']
        if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',repo):p.error('invalid owner/repo')
        sha=args.sha or subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
        if not re.fullmatch(r'[0-9a-fA-F]{40}',sha):p.error('--sha must be a full 40-character commit SHA')
        def notify(event):print(json.dumps(event,ensure_ascii=False),file=sys.stderr,flush=True)
        result=wait(lambda timeout:status_rows(repo,sha,timeout),args.context,args.timeout,args.interval,args.max_interval,notify)
        result.update(repo=repo,sha=sha,scope='Selected GitHub statuses/checks; does not verify live UI or trigger a deployment.')
        print(json.dumps(result,ensure_ascii=False,indent=2) if args.json else f'{repo}@{sha[:12]}: {result["state"]} ({result["polls"]} polls)')
        return {'success':0,'failure':1,'timeout':2}[result['state']]
    except (OSError,subprocess.SubprocessError,RuntimeError,ValueError) as error:
        print(json.dumps(dict(state='error',error=str(error)),ensure_ascii=False));return 3

if __name__=='__main__':sys.exit(main())

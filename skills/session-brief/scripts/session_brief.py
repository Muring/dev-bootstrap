#!/usr/bin/env python3
import argparse
import json
from datetime import datetime, timezone
from worktree import snapshot


def main():
    p=argparse.ArgumentParser(description='Read-only worktree facts for a short session handoff')
    p.add_argument('--repo',default='.')
    p.add_argument('--base',default='HEAD')
    p.add_argument('--limit',type=int,default=30)
    p.add_argument('--json',action='store_true')
    a=p.parse_args()
    if a.limit<1:p.error('--limit must be positive')
    try:data=snapshot(a.repo,a.base)
    except (ValueError,OSError) as e:p.exit(2,str(e)+'\n')
    data['captured_at']=datetime.now(timezone.utc).isoformat()
    data['changed_file_count']=len(data['files']);data['files_truncated']=len(data['files'])>a.limit;data['files']=data['files'][:a.limit]
    print(json.dumps(data,ensure_ascii=False,indent=2) if a.json else f'{data["root"]}\nHEAD {data["head"]}\nBranch {data["branch"]} / dirty={data["dirty"]}\n'+ '\n'.join(f'{x["kind"]}: {x["path"]}' for x in data['files'])+f'\nFingerprint: {data["fingerprint"]}')

if __name__=='__main__':main()

#!/usr/bin/env python3
"""CLI transport for the Windows app and standalone command/skill updates."""
import argparse
import json
import os
from pathlib import Path
import sys
from lib.content import ContentStore, GROUPS


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['preview', 'apply', 'check'])
    parser.add_argument('--commit', default='')
    parser.add_argument('--group', choices=GROUPS, action='append', default=[])
    args = parser.parse_args()
    if os.getuid() == 0:
        raise ValueError('개발 계정에서 실행하세요. sudo는 필요하지 않습니다.')
    def progress(**event):
        print('BOOTSTRAP_PROGRESS ' + json.dumps(event, ensure_ascii=False), file=sys.stderr, flush=True)
    store = ContentStore(progress=progress)
    if args.action == 'preview':
        result = store.preview(args.commit)
    elif args.action == 'check':
        return 0 if args.group and all(store.check(g, args.commit) for g in args.group) else 1
    else:
        result = store.apply(args.commit, args.group)
        result = {key: result[key] for key in ('commit', 'commands', 'skills', 'backup')}
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, OSError, KeyError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)

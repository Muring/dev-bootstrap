#!/usr/bin/env python3
"""Read local request usage, never conversation bodies or credentials into the report."""
import argparse
import collections
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path, PureWindowsPath
from zoneinfo import ZoneInfo

FIELDS = ('input', 'cache_read', 'cache_write', 'output', 'reasoning')

def stamp(value):
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (ValueError, AttributeError):
        return None

def project(cwd):
    normalized = cwd.replace('\\', '/')
    if '/orca/workspaces/' in normalized:
        return normalized.split('/orca/workspaces/', 1)[1].split('/')[0]
    return normalized.rstrip('/').rsplit('/', 1)[-1] or 'unknown'

def rows(path, warnings):
    try:
        with path.open(encoding='utf-8') as stream:
            for number, line in enumerate(stream, 1):
                try:
                    yield number, json.loads(line)
                except (ValueError, UnicodeError):
                    warnings.append(f'{path}:{number}: unreadable JSON record (possibly active write)')
    except OSError as error:
        warnings.append(f'{path}: {error.strerror}')

def collect(roots, start, end):
    records, sessions, warnings = {}, {}, []
    stats = collections.Counter()
    def inside(t): return t is not None and start <= t < end
    def put(key, record):
        if key in records:
            stats['duplicate_records'] += 1
            # Streaming blocks repeat cumulative usage for one response.
            old = records[key]
            for field in FIELDS:
                record[field] = max(old[field], record[field])
        records[key] = record
    visited = set()
    for tool, root in roots:
        if not root.exists():
            warnings.append(f'{root}: log root missing')
            continue
        for path in sorted(root.rglob('*.jsonl')):
            identity = str(path.resolve())
            if identity in visited:
                continue
            visited.add(identity)
            stats['files'] += 1
            # Metadata-only pass decides authoritative Codex accounting source.
            has_records, meta, cwd = False, {}, ''
            for _, d in rows(path, []):
                if d.get('type') == 'session_meta':
                    meta = d.get('payload', {})
                    cwd = meta.get('cwd', cwd)
                if d.get('type') == 'token_usage_record': has_records = True
                cwd = cwd or d.get('cwd', '')
            sid = meta.get('id', path.stem)
            model, previous, active = 'unknown', None, False
            for line, d in rows(path, warnings):
                t = stamp(d.get('timestamp'))
                v = d.get('payload') or {}
                if tool == 'Codex' and d.get('type') == 'turn_context':
                    model = v.get('model', model)
                usage, key = None, None
                if tool == 'Codex':
                    if d.get('type') == 'token_usage_record' and inside(t):
                        usage = v.get('usage')
                        key = ('Codex', v.get('response_id') or f'{sid}:{line}')
                    elif not has_records and d.get('type') == 'event_msg' and v.get('type') == 'token_count' and v.get('info'):
                        info = v['info']; total = info.get('total_token_usage') or {}
                        if inside(t):
                            if previous is None and not inside(stamp(meta.get('timestamp'))):
                                warnings.append(f'{path}:{line}: missing period baseline; only last usage counted')
                                usage = info.get('last_token_usage')
                            else:
                                usage = {k: value - (previous or {}).get(k, 0) for k, value in total.items()}
                                if any(x < 0 for x in usage.values()):
                                    warnings.append(f'{path}:{line}: cumulative counter reset; only last usage counted')
                                    usage = info.get('last_token_usage')
                            key = ('Codex-fallback', sid, line)
                        previous = total
                    if usage:
                        values = dict(input=usage.get('input_tokens', 0), cache_read=usage.get('cached_input_tokens', 0), cache_write=usage.get('cache_write_input_tokens', 0), output=usage.get('output_tokens', 0), reasoning=usage.get('reasoning_output_tokens', 0))
                elif d.get('type') == 'assistant' and inside(t):
                    message = d.get('message') or {}
                    usage = message.get('usage')
                    if usage and message.get('id') and message.get('model') != '<synthetic>':
                        model = message.get('model', 'unknown')
                        key = ('Claude', d.get('requestId'), message['id'])
                        values = dict(input=usage.get('input_tokens', 0) + usage.get('cache_read_input_tokens', 0) + usage.get('cache_creation_input_tokens', 0), cache_read=usage.get('cache_read_input_tokens', 0), cache_write=usage.get('cache_creation_input_tokens', 0), output=usage.get('output_tokens', 0), reasoning=(usage.get('output_tokens_details') or {}).get('thinking_tokens', 0))
                if key and usage and values['input'] + values['output']:
                    active = True
                    put(key, dict(tool=tool, session=sid, cwd=cwd, project=project(cwd), model=model, timestamp=t.isoformat(), source=str(path), line=line, **values))
                if inside(t) and d.get('type') == 'compacted': stats['codex_compactions'] += 1
                if tool == 'Claude' and d.get('type') == 'cost-state': stats['claude_cost_snapshots_not_added'] += 1
            if active:
                sessions[(tool, sid)] = dict(tool=tool, session=sid, cwd=cwd, source=str(path), subagent='/subagents/' in path.as_posix())
    return list(records.values()), list(sessions.values()), stats, warnings

def summarize(records, key):
    groups = {}
    for row in records:
        label = row[key]
        g = groups.setdefault(label, dict(label=label, responses=0, **{k: 0 for k in FIELDS}))
        g['responses'] += 1
        for field in FIELDS: g[field] += row[field]
    for g in groups.values():
        g['non_cache_read_input'] = g['input'] - g['cache_read']
        g['total'] = g['input'] + g['output']
        g['cache_read_percent'] = round(g['cache_read'] * 100 / g['input'], 2) if g['input'] else 0
    return sorted(groups.values(), key=lambda g: -g['total'])

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--week', action='store_true', help='current Monday to now (default)')
    parser.add_argument('--since', help='inclusive ISO date/time')
    parser.add_argument('--until', help='exclusive ISO date/time; default now')
    parser.add_argument('--timezone', default='Asia/Seoul')
    parser.add_argument('--home', action='append', help='client home, repeat for WSL/Windows; overrides saved homes')
    parser.add_argument('--codex-root', action='append', help='additional sessions/archived_sessions directory')
    parser.add_argument('--claude-root', action='append', help='additional projects directory')
    parser.add_argument('--config', type=Path, default=Path(os.environ.get('XDG_CONFIG_HOME', Path.home()/'.config'))/'ai-workflow/usage.json')
    parser.add_argument('--by', default='project,tool', help='comma-separated project,tool,session,cwd,model,day')
    parser.add_argument('--limit', type=int, default=10)
    parser.add_argument('--json', action='store_true')
    args = parser.parse_args()
    tz = ZoneInfo(args.timezone)
    def boundary(value):
        d = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return d if d.tzinfo else d.replace(tzinfo=tz)
    end = boundary(args.until) if args.until else datetime.now(tz)
    start = boundary(args.since) if args.since else (end - timedelta(days=end.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    if start >= end: parser.error('--since must precede --until')
    keys = args.by.split(',')
    if args.limit < 1 or any(k not in ('project','tool','session','cwd','model','day') for k in keys): parser.error('invalid --by or --limit')
    config = json.loads(args.config.read_text()) if args.config.exists() else {}
    homes = [Path(x).expanduser() for x in (args.home or config.get('homes') or [str(Path.home())])]
    roots = []
    for home in homes:
        codex = Path(os.environ.get('CODEX_HOME', home/'.codex')) if home == Path.home() else home/'.codex'
        claude = Path(os.environ.get('CLAUDE_CONFIG_DIR', home/'.claude')) if home == Path.home() else home/'.claude'
        roots.extend([('Codex', codex/'sessions'), ('Claude', claude/'projects')])
        if (codex/'archived_sessions').exists(): roots.append(('Codex', codex/'archived_sessions'))
    roots += [('Codex', Path(x).expanduser()) for x in args.codex_root or []]
    roots += [('Claude', Path(x).expanduser()) for x in args.claude_root or []]
    records, sessions, stats, warnings = collect(roots, start, end)
    for row in records: row['day'] = stamp(row['timestamp']).astimezone(tz).date().isoformat()
    totals = summarize([{**r, 'all':'all'} for r in records], 'all')
    result = dict(period=dict(since=start.isoformat(), until=end.isoformat(), timezone=args.timezone), totals=totals[0] if totals else {}, sessions=len(sessions), scanned=dict(stats), roots=[dict(tool=t,path=str(p)) for t,p in roots], groups={k:summarize(records,k)[:args.limit] for k in keys}, group_limit=args.limit, warnings=warnings, scope='Locally observed request usage, not billing or quota. Cache writes are included in input; reasoning is included in output. Claude cost-state/internal requests, image backend charges and unavailable logs are not added. Project grouping uses session cwd.')
    if args.json: print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f'{start.isoformat()} .. {end.isoformat()} (end exclusive)')
        print(f'{len(sessions)} sessions / {len(records):,} responses / {(totals[0]["total"] if totals else 0):,} tokens')
        for key, groups in result['groups'].items():
            print(f'\n{key}: total | non-cache-read input | output')
            for g in groups: print(f'{g["label"]}: {g["total"]:,} | {g["non_cache_read_input"]:,} | {g["output"]:,}')
        print('\n'+result['scope'])
        for warning in warnings: print('Warning: '+warning)

if __name__ == '__main__': main()

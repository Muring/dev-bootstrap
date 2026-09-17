"""Shared, strictly validated installation configuration. Never evaluate shell input."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG = json.loads((ROOT / 'shared/catalog.json').read_text())
BY_ID = {item['id']: item for item in CATALOG}


def defaults(profile='muring'):
    if profile not in ('muring', 'common'):
        raise ValueError('Unknown profile')
    return dict(version=1, profile=profile,
                selected=[i['id'] for i in CATALOG if i['defaults'][profile]],
                distro='Ubuntu', user='', installLocation='', gitName='', gitEmail='',
                timezone='Asia/Seoul', kbRepo='https://github.com/Muring/muring-kb.git',
                kbDir='~/dev/muring-kb', contentCommit='')


def validate(raw):
    if not isinstance(raw, dict) or raw.get('version') != 1:
        raise ValueError('Configuration version must be 1')
    config = defaults(raw.get('profile', 'muring'))
    if set(raw) - set(config):
        raise ValueError('Unknown configuration fields')
    config.update(raw)
    selected = config['selected']
    if not isinstance(selected, list) or any(not isinstance(i, str) or i not in BY_ID for i in selected):
        raise ValueError('Unknown installation item')
    if 'base' not in selected:
        raise ValueError('base is required')
    for item in selected:
        if any(dep not in selected for dep in BY_ID[item]['depends']):
            raise ValueError(f'{item}: missing dependency')
    for key, value in config.items():
        if key not in ('version', 'selected') and (not isinstance(value, str) or '\x00' in value or '\n' in value or '\r' in value):
            raise ValueError(f'Invalid {key}')
    for item, field in [('git-name', 'gitName'), ('git-email', 'gitEmail')]:
        if item in selected and not config[field].strip():
            raise ValueError(f'{field} is required')
    if config['contentCommit'] and not re.fullmatch(r'[0-9a-f]{40}', config['contentCommit']):
        raise ValueError('contentCommit must be a full Git commit SHA')
    if not re.fullmatch(r'[A-Za-z0-9_+./-]+', config['timezone']) or '..' in config['timezone']:
        raise ValueError('Invalid timezone')
    if 'kb' in selected:
        if not re.fullmatch(r'https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:\.git)?', config['kbRepo']):
            raise ValueError('KB repository must be an HTTPS GitHub URL without credentials')
        if not config['kbDir'].startswith(('~/', '/')):
            raise ValueError('KB directory must be absolute or start with ~/')
    config['selected'] = [i['id'] for i in CATALOG if i['id'] in selected]
    return config

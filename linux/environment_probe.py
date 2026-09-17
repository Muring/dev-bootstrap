#!/usr/bin/env python3
"""Read-only inspection. Authentication output never leaves this process."""
import json
from pathlib import Path
import pwd
import subprocess


def output(args):
    try:
        result = subprocess.run(args, text=True, capture_output=True, timeout=15)
        return result.stdout.strip() if result.returncode == 0 else ''
    except (OSError, subprocess.TimeoutExpired):
        return ''


def succeeds(args):
    try:
        return subprocess.run(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=20).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


home = Path.home()
auth = {'gh': succeeds(['gh', 'auth', 'status', '--hostname', 'github.com']),
        'codex': succeeds(['codex', 'login', 'status'])}
try:
    result = json.loads(output(['claude', 'auth', 'status']))
    auth['claude'] = result.get('loggedIn') is True
except (OSError, ValueError, subprocess.TimeoutExpired):
    auth['claude'] = False
os_id = next((line.split('=', 1)[1].strip('"') for line in Path('/etc/os-release').read_text().splitlines() if line.startswith('ID=')), '')
print(json.dumps(dict(osId=os_id, users=[u.pw_name for u in pwd.getpwall() if 1000 <= u.pw_uid < 65534],
                     user=pwd.getpwuid(__import__('os').getuid()).pw_name, zshrc=(home / '.zshrc').exists(),
                     gitName=output(['git', 'config', '--global', 'user.name']),
                     gitEmail=output(['git', 'config', '--global', 'user.email']),
                     gitBranch=output(['git', 'config', '--global', 'init.defaultBranch']),
                     timezone=Path('/etc/timezone').read_text().strip() if Path('/etc/timezone').exists() else '',
                     auth=auth, tools={tool:succeeds([tool,'--version']) for tool in ['git','node','gh','claude','codex','orca-ide']})))

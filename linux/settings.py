#!/usr/bin/env python3
import json
import os
from pathlib import Path
import subprocess
import sys
import shutil
import time

from lib.shell_config import configure, write_changed
from lib.content import ContentStore, GROUPS

ROOT = Path(__file__).resolve().parent
HOME = Path.home()
CONFIG = json.loads(os.environ['BOOTSTRAP_CONFIG'])
MODE = sys.argv[1]
CHECK = MODE.startswith('check-')
ITEM = MODE.removeprefix('check-')


def backup_git():
    default = HOME / '.gitconfig'
    xdg = Path(os.environ.get('XDG_CONFIG_HOME', str(HOME / '.config'))) / 'git/config'
    path = Path(os.environ['GIT_CONFIG_GLOBAL']) if os.environ.get('GIT_CONFIG_GLOBAL') else (default if default.exists() or not xdg.exists() else xdg)
    if path.is_file():
        shutil.copy2(path, str(path) + '.bak.' + str(time.time_ns()))


def main():
    if ITEM in GROUPS:
        store = ContentStore()
        if CHECK:
            return store.check(ITEM, CONFIG['contentCommit'])
        result = store.apply(CONFIG['contentCommit'], [ITEM])
        print(f'커맨드·스킬 적용: {result["commit"]} / 백업: {result["backup"]}')
        return True
    if ITEM in ('shell', 'theme', 'replace'):
        if not CHECK:
            selected = list(CONFIG['selected'])
            stage = os.environ.get('BOOTSTRAP_STEP', '')
            if ITEM != 'replace':
                selected = [i for i in selected if i != 'shell-replace']
            if stage in ('base', 'node'):
                selected = [i for i in selected if i not in ('zsh', 'shell-theme')]
            elif stage == 'zsh':
                selected = [i for i in selected if i != 'shell-theme']
            configure(HOME, selected, ROOT / 'files')
            return True
        if not (HOME / '.config/dev-bootstrap/env.sh').exists():
            return False
        if ITEM == 'theme':
            return '.config/dev-bootstrap/theme.zsh' in (HOME / '.zshrc').read_text() and (HOME / '.config/dev-bootstrap/theme.zsh').read_text() == (ROOT / 'files/theme.zsh').read_text()
        if ITEM == 'replace':
            return (HOME / '.zshrc').read_text().startswith('# Personal additions may go in ~/.zshrc.local\n')
        names = ['.bashrc', '.zshrc'] if os.environ.get('BOOTSTRAP_STEP') == 'zsh' else ['.bashrc']
        return all((HOME / name).exists() and '.config/dev-bootstrap/env.sh' in (HOME / name).read_text() for name in names)
    if ITEM in ('git-name', 'git-email', 'git-branch'):
        key, value = {'git-name': ('user.name', CONFIG['gitName']), 'git-email': ('user.email', CONFIG['gitEmail']), 'git-branch': ('init.defaultBranch', 'main')}[ITEM]
        backup_git()
        subprocess.run(['git', 'config', '--global', key, value], check=True)
        return True
    if ITEM in ('git-gcm', 'gcm'):
        gcm = Path('/mnt/c/Program Files/Git/mingw64/bin/git-credential-manager.exe')
        if not gcm.exists():
            return False
        desired = str(gcm).replace(' ', '\\ ')
        if CHECK:
            return subprocess.run(['git', 'config', '--global', 'credential.helper'], capture_output=True, text=True).stdout.strip() == desired
        backup_git()
        subprocess.run(['git', 'config', '--global', 'credential.helper', desired], check=True)
        return True
    if ITEM in ('claude-settings', 'claude-permissions'):
        path = HOME / '.claude/settings.json'
        data = json.loads(path.read_text()) if path.exists() else {}
        if CHECK:
            return path.exists() if ITEM == 'claude-settings' else data.get('skipDangerousModePermissionPrompt') is True
        if ITEM == 'claude-settings' and path.exists():
            return True
        if ITEM == 'claude-settings':
            data = json.loads((ROOT / 'files/claude-settings.json').read_text())
            data.pop('skipDangerousModePermissionPrompt', None)
        else:
            data['skipDangerousModePermissionPrompt'] = True
        write_changed(path, json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        return True
    raise ValueError('Unknown settings item')


if __name__ == '__main__':
    try:
        sys.exit(0 if main() else 1)
    except (ValueError, OSError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)

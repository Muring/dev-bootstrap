"""Manage small shell includes without replacing personal configuration."""
from pathlib import Path
import shutil
import time

START = '# >>> dev-bootstrap >>>'
END = '# <<< dev-bootstrap <<<'


def write_changed(path, content, backup=True):
    path = Path(path)
    old = path.read_text() if path.exists() else None
    if old == content:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    if old is not None and backup:
        shutil.copy2(path, str(path) + '.bak.' + str(time.time_ns()))
    temporary = path.with_name(path.name + '.bootstrap-tmp')
    temporary.write_text(content)
    temporary.replace(path)


def include(path, lines):
    path = Path(path)
    old = path.read_text() if path.exists() else ''
    if (START in old) != (END in old) or old.count(START) > 1 or old.count(END) > 1:
        raise ValueError(f'Malformed managed block: {path}')
    block = START + '\n' + lines + '\n' + END
    if START in old:
        begin, finish = old.index(START), old.index(END) + len(END)
        if finish < begin:
            raise ValueError(f'Malformed managed block: {path}')
        text = old[:begin] + block + old[finish:]
    else:
        text = old + ('\n' if old and not old.endswith('\n') else '') + block + '\n'
    write_changed(path, text)


def configure(home, selected, files):
    home, files = Path(home), Path(files)
    managed = home / '.config/dev-bootstrap'
    environment = '''export PATH="$HOME/.local/bin:$HOME/.local/share/fnm:$PATH"
if command -v fnm >/dev/null 2>&1; then
  if [ -n "${ZSH_VERSION:-}" ]; then
    eval "$(fnm env --use-on-cd --shell zsh)"
  elif [ -n "${BASH_VERSION:-}" ]; then
    eval "$(fnm env --use-on-cd --shell bash)"
  fi
fi
'''
    write_changed(managed / 'env.sh', environment, False)
    include(home / '.bashrc', '[ -f "$HOME/.config/dev-bootstrap/env.sh" ] && . "$HOME/.config/dev-bootstrap/env.sh"')
    # Login bash does not always read .bashrc (particularly wsl.exe bash -l).
    profile = next((home / name for name in ('.bash_profile', '.bash_login', '.profile') if (home / name).exists()), home / '.profile')
    include(profile, '[ -f "$HOME/.config/dev-bootstrap/env.sh" ] && . "$HOME/.config/dev-bootstrap/env.sh"')
    if 'zsh' not in selected and not (home / '.zshrc').exists():
        return
    rc = home / '.zshrc'
    lines = '. "$HOME/.config/dev-bootstrap/env.sh"'
    if 'shell-theme' in selected:
        write_changed(managed / 'theme.zsh', (files / 'theme.zsh').read_text(), False)
        lines += '\n. "$HOME/.config/dev-bootstrap/theme.zsh"'
    elif rc.exists() and '. "$HOME/.config/dev-bootstrap/theme.zsh"' in rc.read_text():
        # Deselecting an item is not an uninstall request.
        lines += '\n. "$HOME/.config/dev-bootstrap/theme.zsh"'
    lines += '\n[ ! -f "$HOME/.zshrc.local" ] || . "$HOME/.zshrc.local"'
    if 'shell-replace' in selected:
        write_changed(rc, '# Personal additions may go in ~/.zshrc.local\n' + START + '\n' + lines + '\n' + END + '\n')
    else:
        include(rc, lines)

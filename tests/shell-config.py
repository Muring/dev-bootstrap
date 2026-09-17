#!/usr/bin/env python3
import json
from pathlib import Path
import subprocess
import sys
import tempfile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'linux'))
from lib.shell_config import configure, include
from lib.config import defaults, validate
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as temporary:
    home=Path(temporary)
    original="alias mine='echo mine'\nexport PERSONAL_VALUE=preserved\n"
    (home/'.zshrc').write_text(original)
    (home/'.bashrc').write_text(original)
    (home/'.zshrc.local').write_text('export LOCAL_VALUE=kept\n')
    configure(home,['base','zsh'],root/'linux/files')
    text=(home/'.zshrc').read_text()
    assert text.startswith(original)
    assert '.zshrc.local' in text
    backups=list(home.glob('*.bak.*'));assert backups
    configure(home,['base','zsh'],root/'linux/files')
    assert (home/'.zshrc').read_text()==text and list(home.glob('*.bak.*'))==backups
    result=subprocess.run(['bash','-c','source "$HOME/.bashrc"; printf "%s|%s" "$PERSONAL_VALUE" "$PATH"'],env={'HOME':str(home),'PATH':'/usr/bin:/bin'},capture_output=True,text=True)
    assert result.returncode==0 and result.stdout.startswith('preserved|'+str(home/' .local/bin').replace('/ .','/.'))
    configure(home,['base','zsh','shell-replace'],root/'linux/files')
    assert not (home/'.zshrc').read_text().startswith(original)
    backups=list(home.glob('*.bak.*'));text=(home/'.zshrc').read_text()
    configure(home,['base','zsh','shell-replace'],root/'linux/files')
    assert list(home.glob('*.bak.*'))==backups and (home/'.zshrc').read_text()==text
    print('PASS: preserve, backup, local settings, Bash paths, replacement and repeat')
    broken=home/'broken';broken.write_text('# >>> dev-bootstrap >>>\npartial')
    try: include(broken,'echo hi')
    except ValueError: pass
    else: raise AssertionError('Malformed block overwritten')
    print('PASS: malformed managed block preserved')
for profile in ('common','muring'):validate(defaults(profile))
result=subprocess.run(['bash',str(root/'linux/setup.sh')],stdin=subprocess.DEVNULL,capture_output=True,text=True)
assert result.returncode!=0 and '--config' in result.stderr
print('PASS: noninteractive CLI requires explicit config')
with tempfile.TemporaryDirectory() as temporary:
    import os
    home=Path(temporary)
    config=defaults('common');config['selected']+=['git-name'];config['gitName']='홍 길동 " $(literal)'
    gitfile=home/'.gitconfig';gitfile.write_text('[user]\n\tname = original\n')
    env=dict(os.environ,HOME=str(home),GIT_CONFIG_GLOBAL=str(gitfile),GIT_CONFIG_NOSYSTEM='1',BOOTSTRAP_CONFIG=json.dumps(config))
    subprocess.run(['python3',str(root/'linux/settings.py'),'git-name'],env=env,check=True)
    result=subprocess.run(['git','config','--global','user.name'],env=env,text=True,capture_output=True,check=True)
    assert result.stdout.strip()==config['gitName']
    backups=list(home.glob('.gitconfig.bak.*'));assert len(backups)==1 and 'original' in backups[0].read_text()
    print('PASS: Git settings backup and literal Unicode/shell-like values')

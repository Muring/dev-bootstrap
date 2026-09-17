#!/usr/bin/env python3
"""New Ubuntu only: preserve unrelated wsl.conf sections."""
import configparser
from pathlib import Path
import re
import shutil
import sys
import time

user = sys.argv[1]
if not re.fullmatch(r'[a-z_][a-z0-9_-]{0,31}', user) or user == 'root':
    raise ValueError('Invalid user')
path = Path('/etc/wsl.conf')
config = configparser.ConfigParser()
config.read(path)
if path.exists():
    shutil.copy2(path, str(path) + '.bak.' + str(time.time_ns()))
for section in ('boot', 'user'):
    if not config.has_section(section):
        config.add_section(section)
config['boot']['systemd'] = 'true'
config['user']['default'] = user
with path.open('w') as stream:
    config.write(stream)

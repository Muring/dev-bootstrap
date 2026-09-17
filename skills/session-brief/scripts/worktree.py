"""Read-only Git snapshot; paths and hashes only, never file contents in output."""
import hashlib
import os
from pathlib import Path
import subprocess


def git(root, *args):
    p = subprocess.run(['git','-C',str(root),*args], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode: raise ValueError(p.stderr.decode(errors='replace').strip())
    return p.stdout


def snapshot(root, base='HEAD'):
    root = Path(os.fsdecode(git(root,'rev-parse','--show-toplevel')).strip()).resolve()
    head = git(root,'rev-parse','HEAD').decode().strip()
    # Resolve a ref before using it as a diff argument; reject option injection.
    base_sha = git(root,'rev-parse','--verify','--end-of-options',base+'^{commit}').decode().strip()
    changed = set(os.fsdecode(x) for x in git(root,'diff','--no-renames','--name-only','-z',base_sha,'--').split(b'\0') if x)
    untracked = set(os.fsdecode(x) for x in git(root,'ls-files','--others','--exclude-standard','-z').split(b'\0') if x)
    changed |= untracked
    files=[]
    for name in sorted(changed):
        path=root/name
        if path.is_symlink():
            kind='symlink';digest=hashlib.sha256(os.fsencode(os.readlink(path))).hexdigest()
        elif path.is_file():
            kind='untracked' if name in untracked else 'modified'
            h=hashlib.sha256()
            with path.open('rb') as f:
                for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
            digest=h.hexdigest()
        elif path.is_dir():kind='directory-or-submodule';digest=None
        else:kind='deleted';digest=None
        files.append(dict(path=name,kind=kind,sha256=digest))
    import json
    fingerprint=hashlib.sha256(json.dumps(dict(head=head,base=base_sha,files=files),sort_keys=True).encode()).hexdigest()
    status=git(root,'status','--porcelain=v1','-z')
    return dict(root=str(root),head=head,branch=git(root,'branch','--show-current').decode().strip(),base=base_sha,dirty=bool(status),files=files,fingerprint=fingerprint,scope='Base-to-working-tree paths plus untracked non-ignored files. Fingerprint is for handoff freshness, not proof of equivalent dependencies, ignored files or external state.')

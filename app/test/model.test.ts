import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import { defaults, recommended, toggle, validate, Item } from '../electron/model';
const catalog: Item[] = JSON.parse(fs.readFileSync('../shared/catalog.json', 'utf8'));
test('MuRing defaults preserve user settings and exclude unsafe/conditional actions', () => {
  const c = defaults(catalog);
  assert(c.selected.includes('kb'));
  assert(c.selected.includes('orca'));
  for (const id of ['shell-replace', 'claude-permissions', 'orca-patch', 'git-name'])
    assert(!c.selected.includes(id));
  assert.deepEqual(validate(c, catalog), c);
});
test('dependency selection and cascading removal', () => {
  let selected = toggle(catalog, ['base'], 'kb', true);
  for (const id of ['base', 'node', 'gh', 'codex', 'kb']) assert(selected.includes(id));
  selected = toggle(catalog, selected, 'node', false);
  assert(!selected.includes('codex'));
  assert(!selected.includes('kb'));
  assert(selected.includes('gh'));
  assert(toggle(catalog, selected, 'base', false).includes('base'));
});
test('recommendations respond to profile and zsh selection', () => {
  const c = defaults(catalog, 'common');
  assert(
    !recommended(
      catalog.find(i => i.id === 'kb')!,
      c,
    ),
  );
  assert(
    recommended(
      catalog.find(i => i.id === 'node')!,
      c,
    ),
  );
  assert(
    !recommended(
      catalog.find(i => i.id === 'shell-theme')!,
      c,
    ),
  );
  c.selected.push('zsh');
  assert(
    recommended(
      catalog.find(i => i.id === 'shell-theme')!,
      c,
    ),
  );
});
test('configuration rejects missing dependencies, credentials and injection shapes', () => {
  const c = defaults(catalog);
  for (const change of [
    { selected: ['base', 'kb'] },
    { user: 'root' },
    { user: 'x;whoami' },
    { distro: 'Ubuntu\ncmd' },
    { installLocation: 'D:\\' },
    { kbRepo: 'https://token@github.com/Muring/kb' },
    { timezone: '../../etc/passwd' },
    { extra: true },
  ])
    assert.throws(() => validate({ ...c, ...change }, catalog));
  assert.equal(
    validate({ ...c, installLocation: 'D:\\Linux Data\\Ubuntu', gitName: '홍 길동 " $()' }, catalog).gitName,
    '홍 길동 " $()',
  );
});
test('legacy configuration defaults content pin and rejects malformed commits', () => {
  const { contentCommit, ...legacy } = defaults(catalog);
  assert.equal(validate(legacy, catalog).contentCommit, '');
  assert.equal(validate({ ...legacy, contentCommit: 'a'.repeat(40) }, catalog).contentCommit, 'a'.repeat(40));
  for (const value of ['main', 'abc', '../main', 'A'.repeat(40), 42])
    assert.throws(() => validate({ ...legacy, contentCommit: value }, catalog));
});

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { downloadOrca, installerAsset } from '../electron/orca';
const body = Buffer.from('test official installer bytes');
const asset = {
  name: 'orca-windows-setup.exe',
  size: body.length,
  digest: 'sha256:' + createHash('sha256').update(body).digest('hex'),
  browser_download_url: 'https://github.com/stablyai/orca/releases/download/v1.0/orca-windows-setup.exe',
};
const release = { tag_name: 'v1.0', assets: [asset] };
test('Orca installer metadata requires official URL and verifiable stable asset', () => {
  assert.equal(installerAsset(release).size, body.length);
  for (const change of [
    { digest: null },
    { size: -1 },
    { browser_download_url: 'https://example.com/orca-windows-setup.exe' },
  ])
    assert.throws(() => installerAsset({ ...release, assets: [{ ...asset, ...change }] }));
  assert.throws(() => installerAsset({ ...release, prerelease: true }));
});
test('Orca download verifies checksum and cleans partial files on failure', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'bootstrap-orca-'));
  try {
    const fake = (async (url: any) =>
      String(url).includes('api.github.com') ? Response.json(release) : new Response(body)) as typeof fetch;
    const updates: any[] = [];
    const file = await downloadOrca(directory, fake, event => updates.push(event));
    assert(
      updates.some(
        event => event.unit === 'bytes' && event.completed === body.length && event.total === body.length,
      ),
    );
    assert(updates.at(-1).label.includes('SHA-256'));
    assert.deepEqual(await fs.readFile(file), body);
    const corrupt = (async (url: any) =>
      String(url).includes('api.github.com')
        ? Response.json(release)
        : new Response(Buffer.alloc(body.length))) as typeof fetch;
    await assert.rejects(downloadOrca(directory, corrupt), /체크섬/);
    assert.deepEqual(await fs.readFile(file), body);
    await assert.rejects(fs.stat(file + '.download'));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

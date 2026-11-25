import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { inventory } from '../inventory.mjs';
import { createSkillServer } from '../server.mjs';

test('groups aliases, identical manifests, and different versions', async t => {
  const folder = await mkdtemp(join(tmpdir(), 'skill-lens-test-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const a = join(folder, 'project');
  const b = join(folder, 'user');
  async function create(root, name, body) {
    const path = join(root, name);
    await mkdir(path, { recursive: true });
    await writeFile(join(path, 'SKILL.md'), '---\nname: ' + name + '\ndescription: >-\n  Test metadata\n  second line\n---\n' + body);
    return path;
  }
  const linked = await create(a, 'linked', 'same');
  await create(a, 'identical', 'same');
  await create(a, 'different', 'one');
  await create(a, 'only', 'only');
  await create(b, 'identical', 'same');
  await create(b, 'different', 'two');
  await create(join(b, 'references'), 'hidden', 'ignored');
  await symlink(linked, join(b, 'linked'), 'dir');
  await symlink(b, join(b, 'loop'), 'dir');
  const { skills, sources } = await inventory([{ name: 'A', path: a }, { name: 'B', path: b },
    { name: 'Missing', path: join(folder, 'missing') }]);
  assert.deepEqual(Object.fromEntries(skills.map(s => [s.name, s.kind])),
    { different: 'different', identical: 'identical', linked: 'linked', only: 'single' });
  assert.equal(skills[0].description, 'Test metadata second line');
  assert.deepEqual(sources.map(s => [s.available, s.count]), [[true, 4], [true, 3], [false, 0]]);
});

test('serves the dashboard and demo data on the local origin', async t => {
  const server = createSkillServer({ demo: true });
  t.after(() => new Promise(resolve => server.close(resolve)));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  assert.match(await (await fetch(base)).text(), /Skill Lens/u);
  assert.equal((await (await fetch(base + '/api/inventory')).json()).skills.length, 3);
  assert.equal((await fetch(base + '/api/inventory', { method: 'POST' })).status, 405);
  assert.equal((await fetch(base + '/api/inventory', { headers: { Origin: 'https://other.example' } })).status, 403);
  assert.equal((await fetch(base + '/LICENSE')).status, 404);
});

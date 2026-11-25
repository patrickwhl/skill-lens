import { createHash } from 'node:crypto';
import { open, readdir, realpath, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const ignored = new Set(['.git', 'node_modules', 'scripts', 'references', 'assets', 'agents', 'examples']);
const maxSize = 1024 * 1024;

export function defaultSources({ home = homedir(), project = process.cwd() } = {}) {
  return [
    { name: 'Project', path: resolve(project, '.agents/skills') },
    { name: 'User', path: join(home, '.agents/skills') },
    { name: 'Codex', path: join(home, '.codex/skills') },
    { name: 'Claude', path: join(home, '.claude/skills') },
    { name: 'WorkBuddy', path: join(home, '.workbuddy/skills') },
  ];
}

function value(lines, key) {
  const index = lines.findIndex(line => line.startsWith(key + ':'));
  if (index < 0) return '';
  const field = lines[index].slice(key.length + 1).trim();
  if (/^[|>][-+]?$/u.test(field)) {
    const continuation = [];
    for (const line of lines.slice(index + 1)) {
      if (line && !/^\s/u.test(line)) break;
      continuation.push(line.trim());
    }
    return continuation.join(' ').trim();
  }
  return field.replace(/^(["'])(.*)\1$/u, '$2');
}

async function inspect(path, source) {
  const file = await open(path, 'r');
  try {
    const stats = await file.stat();
    if (!stats.isFile() || stats.size > maxSize) return null;
    const buffer = Buffer.alloc(stats.size);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    const content = buffer.subarray(0, bytesRead);
    const lines = content.toString('utf8').split(/\r?\n/u);
    const end = lines[0]?.replace(/^\uFEFF/u, '') === '---' ? lines.indexOf('---', 1) : -1;
    if (end < 0) return null;
    const metadata = lines.slice(1, end);
    const name = value(metadata, 'name');
    const description = value(metadata, 'description');
    if (!name || !description) return null;
    return { name, description, path, source, target: await realpath(path),
      fingerprint: createHash('sha256').update(content).digest('hex') };
  } finally {
    await file.close();
  }
}

export async function inventory(sources) {
  const groups = new Map();
  const status = [];
  for (const source of sources) {
    const report = { ...source, count: 0, skipped: 0, available: false };
    status.push(report);
    try {
      if (!(await stat(source.path)).isDirectory()) continue;
      report.available = true;
    } catch (error) {
      if (error.code !== 'ENOENT') report.skipped++;
      continue;
    }

    async function visit(dir, ancestors = new Set(), depth = 0) {
      if (depth > 12) { report.skipped++; return; }
      try {
        const target = await realpath(dir);
        if (ancestors.has(target)) return;
        const next = new Set([...ancestors, target]);
        const entries = await readdir(dir, { withFileTypes: true });
        const entry = entries.find(item => item.name === 'SKILL.md' && item.isFile());
        if (entry) {
          const skill = await inspect(join(dir, entry.name), source.name);
          if (skill) {
            report.count++;
            if (!groups.has(skill.name)) groups.set(skill.name, []);
            groups.get(skill.name).push(skill);
            return;
          }
          report.skipped++;
        }
        for (const item of entries) {
          if (ignored.has(item.name) || (item.name.startsWith('.') && item.name !== '.system')) continue;
          const path = join(dir, item.name);
          if (item.isDirectory() || (item.isSymbolicLink() && await stat(path).then(s => s.isDirectory(), () => false))) {
            await visit(path, next, depth + 1);
          }
        }
      } catch {
        report.skipped++;
      }
    }

    await visit(source.path);
  }
  const skills = [...groups].map(([name, copies]) => {
    const fingerprints = new Set(copies.map(copy => copy.fingerprint));
    const targets = new Set(copies.map(copy => copy.target));
    const kind = copies.length === 1 ? 'single' : targets.size === 1 ? 'linked' : fingerprints.size === 1 ? 'identical' : 'different';
    return { name, description: copies[0].description, kind, copies };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return { sources: status, skills };
}

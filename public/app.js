const el = id => document.getElementById(id);
const node = (tag, text, className) => {
  const result = document.createElement(tag);
  result.textContent = text;
  if (className) result.className = className;
  return result;
};
const statusLabels = { single: '单一入口', linked: '同一文件', identical: '说明相同', different: '不同版本' };
const storageKey = 'skill-lens:favorites';
let pins = new Set();
try {
  const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (Array.isArray(stored)) pins = new Set(stored);
} catch { /* Browsers with local storage disabled still support session favorites. */ }
let data = { sources: [], skills: [] };
let source = '';
let loaded = false;

function renderSources() {
  const options = [{ name: '', label: '全部来源', count: data.skills.reduce((sum, s) => sum + s.copies.length, 0) },
    ...data.sources.filter(s => s.available)];
  el('sources').replaceChildren(...options.map(option => {
    const button = node('button', '');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(source === option.name));
    button.append(node('span', option.label || option.name), node('span', String(option.count)));
    button.addEventListener('click', () => { source = option.name; render(); });
    return button;
  }));
  el('source-paths').replaceChildren(...data.sources.map(s => node('li',
    s.name + ' · ' + s.path + (s.available ? '' : '（目录不可用）') + (s.skipped ? ' · 跳过 ' + s.skipped : ''))));
}

function card(skill) {
  const container = node('details', '', 'skill');
  container.dataset.skill = skill.name;
  const summary = node('summary', '');
  const intro = skill.description.length > 190 ? skill.description.slice(0, 190) + '…' : skill.description;
  summary.append(node('span', skill.name, 'skill-name'),
    node('span', statusLabels[skill.kind] + (skill.copies.length > 1 ? ' · ' + skill.copies.length : ''), 'badge ' + skill.kind),
    node('span', intro, 'description'));
  const body = node('div', '', 'detail');
  const favorite = node('button', pins.has(skill.name) ? '取消收藏' : '加入收藏');
  favorite.type = 'button';
  favorite.setAttribute('aria-pressed', String(pins.has(skill.name)));
  favorite.addEventListener('click', () => {
    if (pins.has(skill.name)) pins.delete(skill.name);
    else pins.add(skill.name);
    try { localStorage.setItem(storageKey, JSON.stringify([...pins])); } catch { /* Session only. */ }
    const connected = render().find(item => item.dataset.skill === skill.name);
    (connected?.querySelector('button') || el('kind')).focus();
  });
  body.append(favorite);
  for (const copy of skill.copies) {
    const row = node('div', '', 'version');
    row.append(node('strong', copy.source), node('p', copy.description), node('code', copy.path));
    if (copy.target !== copy.path) row.append(node('code', '→ ' + copy.target));
    body.append(row);
  }
  container.append(summary, body);
  return container;
}

function render() {
  if (!loaded) return [];
  el('count').textContent = data.skills.length;
  el('copies').textContent = data.skills.reduce((sum, skill) => sum + skill.copies.length, 0);
  el('conflicts').textContent = data.skills.filter(s => s.kind === 'different').length;
  el('roots').textContent = data.sources.filter(s => s.available).length;
  renderSources();
  const open = new Set([...el('skills').querySelectorAll('details[open]')].map(d => d.dataset.skill));
  const query = el('query').value.trim().toLocaleLowerCase();
  const kind = el('kind').value;
  const filtered = data.skills.filter(skill => {
    if (kind === 'pinned' && !pins.has(skill.name)) return false;
    if (kind && kind !== 'pinned' && kind !== skill.kind) return false;
    const candidates = source ? skill.copies.filter(copy => copy.source === source) : skill.copies;
    return candidates.some(copy =>
      [skill.name, copy.description, copy.path, copy.target].some(value => value.toLocaleLowerCase().includes(query)));
  }).sort((a, b) => Number(pins.has(b.name)) - Number(pins.has(a.name)) || a.name.localeCompare(b.name));
  el('status').textContent = filtered.length + ' 项结果';
  const cards = filtered.map(skill => { const item = card(skill); item.open = open.has(skill.name); return item; });
  el('skills').replaceChildren(...(cards.length ? cards : [node('p', '没有匹配的技能。')]));
  return cards;
}

async function load() {
  const button = el('refresh');
  button.disabled = true;
  el('status').textContent = '正在扫描…';
  try {
    const response = await fetch('/api/inventory');
    if (!response.ok) throw new Error('Scan failed');
    data = await response.json();
    loaded = true;
    render();
  } catch {
    el('status').textContent = loaded ? '扫描失败，当前仍显示上次结果。' : '扫描失败，请重试。';
  } finally {
    button.disabled = false;
  }
}
el('query').addEventListener('input', render);
el('kind').addEventListener('change', render);
el('refresh').addEventListener('click', load);
load();

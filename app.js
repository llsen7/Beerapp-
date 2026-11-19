'use strict';

/* ================= Storage ================= */
const STORE_KEY = 'brewdex.v1';

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY));
    if (data && Array.isArray(data.drinks)) return data;
  } catch { /* fall through */ }
  return { drinks: [], nextNo: 1 };
}

let db = load();

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
    return true;
  } catch (err) {
    toast('Storage full. Try removing some photos or exporting a backup.');
    return false;
  }
}

/* ================= Helpers ================= */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => '#' + String(n).padStart(3, '0');
const stars = n => n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '';
const typeOf = d => TYPES[STYLE_BY_ID[d.style]?.type || d.type || 'other'];
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = s => s ? new Date(s + 'T00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';

function caughtByStyle() {
  const map = {};
  for (const d of db.drinks) (map[d.style] ||= []).push(d);
  return map;
}

function toast(msg) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// Downscale a photo so it fits comfortably in localStorage.
function resizeImage(file, max = 640, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
    img.src = url;
  });
}

/* ================= State / routing ================= */
const state = { tab: 'dex', dexFilter: 'all', dexQuery: '', drinkFilter: 'all', drinkQuery: '', drinkSort: 'newest' };

function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.tabs [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  render();
  window.scrollTo(0, 0);
}

function render() {
  renderProgress();
  const view = $('#view');
  ({ dex: renderDex, drinks: renderDrinks, stats: renderStats, settings: renderSettings })[state.tab](view);
}

function renderProgress() {
  const caught = Object.keys(caughtByStyle()).filter(id => STYLE_BY_ID[id]).length;
  $('#progress').innerHTML = `<div style="width:${(caught / STYLES.length) * 100}%"></div>`;
  $('#progress').title = `${caught} / ${STYLES.length} styles caught`;
}

function typeChips(active, onPick) {
  const wrap = document.createElement('div');
  wrap.className = 'chips';
  const entries = [['all', { name: 'All', color: '#1D1D1D', icon: '' }], ...Object.entries(TYPES)];
  wrap.innerHTML = entries.map(([id, t]) =>
    `<button class="chip ${id === active ? 'active' : ''}" data-type="${id}" style="--c:${t.color}">${t.icon} ${t.name}</button>`
  ).join('');
  wrap.addEventListener('click', e => {
    const b = e.target.closest('.chip');
    if (b) onPick(b.dataset.type);
  });
  return wrap;
}

/* ================= Dex view ================= */
function renderDex(view) {
  const caught = caughtByStyle();
  const q = state.dexQuery.toLowerCase();
  const list = STYLES.filter(s =>
    (state.dexFilter === 'all' || s.type === state.dexFilter) &&
    (!q || (caught[s.id] ? s.name.toLowerCase().includes(q) : String(s.no).includes(q)))
  );
  const nCaught = STYLES.filter(s => caught[s.id]).length;

  view.innerHTML = `
    <div class="toolbar">
      <input type="search" id="dexSearch" placeholder="Search caught styles or Dex no." value="${esc(state.dexQuery)}">
    </div>
    <div id="dexChips"></div>
    <div class="section-title">${nCaught} of ${STYLES.length} styles caught</div>
    <div class="grid">
      ${list.map(s => {
        const t = TYPES[s.type];
        const got = caught[s.id];
        return `<button class="dex-card ${got ? '' : 'unseen'}" data-style="${s.id}" style="--c:${t.color}">
          <span class="no">${pad(s.no)}</span>
          ${got ? `<span class="cnt">×${got.length}</span>` : ''}
          <span class="ico">${t.icon}</span>
          <span class="nm">${got ? esc(s.name) : '???'}</span>
        </button>`;
      }).join('')}
    </div>
    ${list.length ? '' : '<div class="empty">No matches.</div>'}
  `;
  $('#dexChips').replaceWith(typeChips(state.dexFilter, t => { state.dexFilter = t; render(); }));
  const search = $('#dexSearch');
  search.addEventListener('input', () => { state.dexQuery = search.value; renderDexKeepFocus(); });
  view.querySelector('.grid').addEventListener('click', e => {
    const c = e.target.closest('.dex-card');
    if (c) openStyle(c.dataset.style);
  });
}

function renderDexKeepFocus() {
  const pos = $('#dexSearch').selectionStart;
  render();
  const s = $('#dexSearch');
  s.focus();
  s.setSelectionRange(pos, pos);
}

function openStyle(id) {
  const s = STYLE_BY_ID[id];
  const t = TYPES[s.type];
  const mine = (caughtByStyle()[id] || []).slice().sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const got = mine.length > 0;
  showModal(`
    <div class="sheet-head" style="--c:${t.color}">
      <div><div class="no">${pad(s.no)}</div><h2>${got ? esc(s.name) : '???'}</h2></div>
      <button class="close" data-close>✕</button>
    </div>
    <div class="sheet-body">
      <span class="type-badge" style="--c:${t.color}">${t.icon} ${t.name}</span>
      <p>${got ? esc(s.desc) : 'You haven\'t caught this style yet. Log one to reveal its Dex entry!'}</p>
      ${got ? `<div class="section-title">Your catches (${mine.length})</div>
        <div class="list">${mine.map(drinkRow).join('')}</div>` : ''}
      <div class="row-actions">
        <button class="btn primary" data-catch="${s.id}">Catch a ${got ? esc(s.name) : 'new one'}</button>
      </div>
    </div>
  `);
}

/* ================= Drinks view ================= */
function drinkRow(d) {
  const t = typeOf(d);
  const style = STYLE_BY_ID[d.style];
  return `<button class="drink" data-drink="${d.id}" style="--c:${t.color}">
    ${d.photo ? `<img class="thumb" src="${d.photo}" alt="">` : `<span class="thumb">${t.icon}</span>`}
    <span class="meta">
      <div class="nm">${esc(d.name)}</div>
      <div class="sub">${esc([d.maker, style?.name].filter(Boolean).join(' · '))}</div>
      <div class="stars">${stars(d.rating)}</div>
    </span>
    <span class="no">${pad(d.no)}<br>${d.abv ? esc(d.abv) + '%' : ''}</span>
  </button>`;
}

function renderDrinks(view) {
  const q = state.drinkQuery.toLowerCase();
  let list = db.drinks.filter(d =>
    (state.drinkFilter === 'all' || STYLE_BY_ID[d.style]?.type === state.drinkFilter) &&
    (!q || [d.name, d.maker, d.place, d.notes, STYLE_BY_ID[d.style]?.name].some(v => v && v.toLowerCase().includes(q)))
  );
  const sorters = {
    newest: (a, b) => b.no - a.no,
    oldest: (a, b) => a.no - b.no,
    rating: (a, b) => (b.rating || 0) - (a.rating || 0) || b.no - a.no,
    name: (a, b) => a.name.localeCompare(b.name),
    abv: (a, b) => (parseFloat(b.abv) || 0) - (parseFloat(a.abv) || 0),
  };
  list = list.sort(sorters[state.drinkSort]);

  view.innerHTML = `
    <div class="toolbar">
      <input type="search" id="drinkSearch" placeholder="Search name, brewery, place, notes…" value="${esc(state.drinkQuery)}">
      <select id="drinkSort">
        ${[['newest', 'Newest'], ['oldest', 'Oldest'], ['rating', 'Top rated'], ['name', 'A–Z'], ['abv', 'Strongest']]
          .map(([v, l]) => `<option value="${v}" ${v === state.drinkSort ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
    </div>
    <div id="drinkChips"></div>
    ${db.drinks.length === 0
      ? `<div class="empty"><div class="big">🍺</div><p>No drinks caught yet.<br>Tap the ball below to log your first one!</p></div>`
      : `<div class="section-title">${list.length} drink${list.length === 1 ? '' : 's'}</div>
         <div class="list">${list.map(drinkRow).join('')}</div>
         ${list.length ? '' : '<div class="empty">No matches.</div>'}`}
  `;
  $('#drinkChips').replaceWith(typeChips(state.drinkFilter, t => { state.drinkFilter = t; render(); }));
  const search = $('#drinkSearch');
  search.addEventListener('input', () => {
    state.drinkQuery = search.value;
    const pos = search.selectionStart;
    render();
    const s = $('#drinkSearch'); s.focus(); s.setSelectionRange(pos, pos);
  });
  $('#drinkSort').addEventListener('change', e => { state.drinkSort = e.target.value; render(); });
}

function openDrink(id) {
  const d = db.drinks.find(x => x.id === id);
  if (!d) return;
  const t = typeOf(d);
  const s = STYLE_BY_ID[d.style];
  const facts = [
    ['Style', s?.name], ['Maker', d.maker], ['ABV', d.abv && d.abv + '%'],
    ['Where', d.place], ['When', fmtDate(d.date)], ['Rating', d.rating ? `<span class="stars">${stars(d.rating)}</span>` : ''],
  ].filter(([, v]) => v);
  showModal(`
    <div class="sheet-head" style="--c:${t.color}">
      <div><div class="no">${pad(d.no)}</div><h2>${esc(d.name)}</h2></div>
      <button class="close" data-close>✕</button>
    </div>
    <div class="sheet-body">
      ${d.photo ? `<img class="hero" src="${d.photo}" alt="">` : ''}
      <span class="type-badge" style="--c:${t.color}">${t.icon} ${t.name}</span>
      <div class="facts">${facts.map(([k, v]) => `<div class="fact"><b>${k}</b>${k === 'Rating' ? v : esc(v)}</div>`).join('')}</div>
      ${d.notes ? `<div class="section-title">Tasting notes</div><div class="notes">${esc(d.notes)}</div>` : ''}
      <div class="row-actions">
        <button class="btn danger" data-delete="${d.id}">Release</button>
        <button class="btn primary" data-edit="${d.id}">Edit</button>
      </div>
    </div>
  `);
}

/* ================= Catch form ================= */
function openForm(existing, presetStyle) {
  const d = existing || { name: '', maker: '', style: presetStyle || '', abv: '', rating: 0, place: '', date: today(), notes: '', photo: '' };
  let rating = d.rating || 0;
  let photo = d.photo || '';
  const groups = Object.entries(TYPES).map(([tid, t]) =>
    `<optgroup label="${t.icon} ${t.name}">${STYLES.filter(s => s.type === tid)
      .map(s => `<option value="${s.id}" ${s.id === d.style ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</optgroup>`
  ).join('');

  showModal(`
    <div class="sheet-head">
      <div><div class="no">${existing ? pad(existing.no) : 'New catch'}</div><h2>${existing ? 'Edit drink' : 'Catch a drink!'}</h2></div>
      <button class="close" data-close>✕</button>
    </div>
    <div class="sheet-body">
      <form class="catch-form" id="catchForm">
        <div class="photo-pick" id="photoPick">
          ${photo ? `<img src="${photo}" alt="">` : '<span>📷 Add photo</span>'}
          <input type="file" accept="image/*" capture="environment" id="photoInput">
        </div>
        <div class="field"><label for="f-name">Name *</label>
          <input id="f-name" name="name" required value="${esc(d.name)}" placeholder="e.g. Heady Topper"></div>
        <div class="field"><label for="f-maker">Brewery / Maker</label>
          <input id="f-maker" name="maker" value="${esc(d.maker)}" placeholder="e.g. The Alchemist"></div>
        <div class="field"><label for="f-style">Style *</label>
          <select id="f-style" name="style" required><option value="">Choose a style…</option>${groups}</select></div>
        <div class="two">
          <div class="field"><label for="f-abv">ABV %</label>
            <input id="f-abv" name="abv" type="number" step="0.1" min="0" max="100" inputmode="decimal" value="${esc(d.abv)}"></div>
          <div class="field"><label for="f-date">Date</label>
            <input id="f-date" name="date" type="date" value="${esc(d.date)}"></div>
        </div>
        <div class="field"><label>Rating</label>
          <div class="rating" id="rating">${[1, 2, 3, 4, 5].map(i => `<button type="button" data-r="${i}" aria-label="${i} stars">★</button>`).join('')}</div></div>
        <div class="field"><label for="f-place">Where</label>
          <input id="f-place" name="place" value="${esc(d.place)}" placeholder="Bar, city, or 'my couch'"></div>
        <div class="field"><label for="f-notes">Tasting notes</label>
          <textarea id="f-notes" name="notes" placeholder="Aroma, flavor, would you have it again?">${esc(d.notes)}</textarea></div>
        <div class="row-actions">
          <button type="button" class="btn" data-close>Cancel</button>
          <button type="submit" class="btn primary">${existing ? 'Save' : 'Catch it!'}</button>
        </div>
      </form>
    </div>
  `);

  const ratingEl = $('#rating');
  const paintRating = () => ratingEl.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.r <= rating));
  paintRating();
  ratingEl.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    rating = +b.dataset.r === rating ? 0 : +b.dataset.r; // tap again to clear
    paintRating();
  });

  $('#photoInput').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      photo = await resizeImage(file);
      const pick = $('#photoPick');
      pick.querySelector('img, span')?.remove();
      pick.insertAdjacentHTML('afterbegin', `<img src="${photo}" alt="">`);
    } catch { toast('Could not load that photo.'); }
  });

  $('#catchForm').addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const fields = Object.fromEntries(['name', 'maker', 'style', 'abv', 'date', 'place', 'notes'].map(k => [k, String(f.get(k) || '').trim()]));
    const wasNewStyle = !caughtByStyle()[fields.style];

    if (existing) {
      Object.assign(existing, fields, { rating, photo });
    } else {
      db.drinks.push({ id: crypto.randomUUID?.() || String(Date.now()) + Math.random(), no: db.nextNo++, ...fields, rating, photo, createdAt: Date.now() });
    }
    if (!save()) return;
    closeModal();
    if (!existing) {
      toast(wasNewStyle ? `Gotcha! New Dex entry: ${STYLE_BY_ID[fields.style].name}!` : `Gotcha! ${fields.name} was caught!`);
    }
    render();
  });
}

/* ================= Stats view ================= */
function renderStats(view) {
  const drinks = db.drinks;
  const caught = caughtByStyle();
  const nStyles = STYLES.filter(s => caught[s.id]).length;
  const rated = drinks.filter(d => d.rating);
  const avg = rated.length ? (rated.reduce((a, d) => a + d.rating, 0) / rated.length).toFixed(1) : '–';
  const makers = new Set(drinks.map(d => d.maker.toLowerCase()).filter(Boolean)).size;

  const typeRows = Object.entries(TYPES).map(([id, t]) => {
    const total = STYLES.filter(s => s.type === id).length;
    const got = STYLES.filter(s => s.type === id && caught[s.id]).length;
    return { t, total, got };
  });

  const top = rated.slice().sort((a, b) => b.rating - a.rating || b.no - a.no).slice(0, 5);

  view.innerHTML = `
    <div class="stat-tiles">
      <div class="tile"><div class="v">${nStyles}/${STYLES.length}</div><div class="l">Dex completion (${Math.round(nStyles / STYLES.length * 100)}%)</div></div>
      <div class="tile"><div class="v">${drinks.length}</div><div class="l">Drinks caught</div></div>
      <div class="tile"><div class="v">${makers}</div><div class="l">Breweries & makers</div></div>
      <div class="tile"><div class="v">${avg}</div><div class="l">Average rating</div></div>
    </div>
    <div class="section-title">Dex progress by type</div>
    <div class="bars">
      ${typeRows.map(({ t, total, got }) => `
        <div class="bar" style="--c:${t.color}">
          <span>${t.icon} ${t.name}</span>
          <span class="track"><span class="fill" style="display:block;width:${got / total * 100}%"></span></span>
          <span class="n">${got}/${total}</span>
        </div>`).join('')}
    </div>
    ${top.length ? `<div class="section-title">Hall of Fame</div><div class="list">${top.map(drinkRow).join('')}</div>` : ''}
  `;
}

/* ================= Data / settings ================= */
function renderSettings(view) {
  view.innerHTML = `
    <div class="panel">
      <p>Your BrewDex lives only on this device. Export a backup now and then, and import it to move to a new phone.</p>
      <button class="btn primary" id="exportBtn">⬇️ Export backup</button>
      <label class="btn" style="text-align:center">⬆️ Import backup<input type="file" accept="application/json,.json" id="importInput" hidden></label>
      <button class="btn danger" id="resetBtn">Reset BrewDex</button>
    </div>
    <div class="section-title">About</div>
    <div class="panel"><p style="margin:0">BrewDex: ${STYLES.length} styles to catch across ${Object.keys(TYPES).length} types. Gotta drink 'em all (responsibly).</p></div>
  `;
  $('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `brewdex-backup-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#importInput').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.drinks)) throw new Error();
      if (!confirm(`Replace your current BrewDex with ${data.drinks.length} drinks from this backup?`)) return;
      db = { drinks: data.drinks, nextNo: data.nextNo || Math.max(0, ...data.drinks.map(d => d.no || 0)) + 1 };
      save(); render(); toast('Backup imported!');
    } catch { toast('That file is not a valid BrewDex backup.'); }
  });
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('Delete ALL drinks? This cannot be undone.')) return;
    db = { drinks: [], nextNo: 1 };
    save(); render(); toast('BrewDex reset.');
  });
}

/* ================= Modal ================= */
const modal = $('#modal');
function showModal(html) {
  $('#modalBody').innerHTML = html;
  if (!modal.open) modal.showModal();
  modal.scrollTop = 0;
}
function closeModal() { modal.close(); }

modal.addEventListener('click', e => {
  if (e.target === modal) return closeModal(); // backdrop
  if (e.target.closest('[data-close]')) return closeModal();
  const catchBtn = e.target.closest('[data-catch]');
  if (catchBtn) return openForm(null, catchBtn.dataset.catch);
  const edit = e.target.closest('[data-edit]');
  if (edit) return openForm(db.drinks.find(d => d.id === edit.dataset.edit));
  const del = e.target.closest('[data-delete]');
  if (del) {
    const d = db.drinks.find(x => x.id === del.dataset.delete);
    if (d && confirm(`Release ${d.name}? It will be removed from your BrewDex.`)) {
      db.drinks = db.drinks.filter(x => x !== d);
      save(); closeModal(); render(); toast(`Bye, ${d.name}!`);
    }
    return;
  }
  const row = e.target.closest('[data-drink]');
  if (row) return openDrink(row.dataset.drink);
});

/* ================= Wire-up ================= */
document.querySelectorAll('.tabs [data-tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
$('#catchBtn').addEventListener('click', () => openForm());
$('#view').addEventListener('click', e => {
  const row = e.target.closest('[data-drink]');
  if (row) openDrink(row.dataset.drink);
});

render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

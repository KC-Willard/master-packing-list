// ─── Supabase init ────────────────────────────────────────────────────────────
const { createClient } = supabase;
const sb = createClient(
  'https://chtgebzsqnqbijujvbci.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNodGdlYnpzcW5xYmlqdWp2YmNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNDI2NzAsImV4cCI6MjA5MzkxODY3MH0.QREDDJ8KU0w_tEecgnSg03faS4tVv8yRLIDh0twEW4U'
);

const NETLIFY_URL = 'https://master-packing-list.netlify.app';
const EMOJIS = ['🧳','👶','🎒','🏠','⛺','🐾','✈️','🚗','🎡','🎪','🏖️','🏔️','🎿','🏕️','🛒','🧺','🎁','🎉','🏡','🌊','🌲','❄️','☀️','🌈','🍔','🍺','🎸','📦','📋','✅','🗺️','🧭','🔑','💼','👗','👟','🩺','💊','📱','🔋'];

// ─── State ────────────────────────────────────────────────────────────────────
let currentUser = null;
let lists = [];
let activeListId = null;
let activeTabIds = {};
let saveTimer = null;
let _newTabListId = null;
let _emojiCb = null;

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function signInWithGoogle() {
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: NETLIFY_URL }
  });
  if (error) document.getElementById('loginError').textContent = error.message;
}

async function signOut() {
  await sb.auth.signOut();
  location.reload();
}

// ─── Status ───────────────────────────────────────────────────────────────────
function setStatus(msg, err = false) {
  const el = document.getElementById('syncStatus');
  el.textContent = msg;
  el.className = 'sync-status' + (err ? ' error' : '');
}

function scheduleSave(fn) {
  setStatus('saving…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { await fn(); setStatus('synced ✓'); setTimeout(() => setStatus(''), 2000); }
    catch(e) { setStatus('sync error', true); console.error(e); }
  }, 600);
}

// ─── DB helpers ───────────────────────────────────────────────────────────────
async function loadLists() {
  // Single membership query to get list IDs
  const { data: memberships } = await sb.from('list_members').select('list_id, role');
  if (!memberships?.length) return [];
  const listIds = memberships.map(m => m.list_id);

  // 4 parallel queries instead of nested loops
  const [
    { data: listsData },
    { data: allTabs },
    { data: allSections },
    { data: allItems },
  ] = await Promise.all([
    sb.from('lists').select('*').in('id', listIds).order('created_at'),
    sb.from('tabs').select('*').in('list_id', listIds).order('position'),
    sb.from('sections').select('*').order('position'),
    sb.from('items').select('*').eq('is_deleted', false).order('position'),
  ]);

  // Fetch checked state for all items in one query
  const allItemIds = (allItems || []).map(i => i.id);
  let checkedSet = new Set();
  if (allItemIds.length) {
    const { data: checked } = await sb.from('checked_state').select('item_id').in('item_id', allItemIds);
    checkedSet = new Set((checked || []).map(c => c.item_id));
  }

  // Build lookup maps
  const tabsByList = {};
  const secsByTab  = {};
  const itemsBySec = {};

  for (const tab of (allTabs || [])) {
    if (!tabsByList[tab.list_id]) tabsByList[tab.list_id] = [];
    tabsByList[tab.list_id].push(tab);
  }
  for (const sec of (allSections || [])) {
    if (!secsByTab[sec.tab_id]) secsByTab[sec.tab_id] = [];
    secsByTab[sec.tab_id].push(sec);
  }
  for (const item of (allItems || [])) {
    if (!itemsBySec[item.section_id]) itemsBySec[item.section_id] = [];
    itemsBySec[item.section_id].push(item);
  }

  // Assemble into nested structure
  return (listsData || []).map(list => ({
    ...list,
    tabs: (tabsByList[list.id] || []).map(tab => ({
      ...tab,
      sections: (secsByTab[tab.id] || []).map(sec => ({
        ...sec,
        items: itemsBySec[sec.id] || [],
        checkedIds: new Set(
          (itemsBySec[sec.id] || [])
            .filter(i => checkedSet.has(i.id))
            .map(i => i.id)
        ),
      })),
    })),
  }));
}

// ─── Progress ─────────────────────────────────────────────────────────────────
function updateProgress() {
  const list = lists.find(l => l.id === activeListId);
  if (!list) return;
  let total = 0, done = 0;
  list.tabs.forEach(tab => tab.sections.forEach(sec => {
    total += sec.items.length;
    done  += sec.items.filter(i => sec.checkedIds.has(i.id)).length;
  }));
  const pct = total ? Math.round(done / total * 100) : 0;
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressLabel').textContent = total ? `${done} of ${total} items packed` : '';

  list.tabs.forEach(tab => {
    const el = document.getElementById(`tabcount-${list.id}-${tab.id}`);
    if (!el) return;
    let t = 0, c = 0;
    tab.sections.forEach(sec => { t += sec.items.length; c += sec.items.filter(i => sec.checkedIds.has(i.id)).length; });
    el.textContent = `${c}/${t}`;
  });
}

// ─── Emoji picker ─────────────────────────────────────────────────────────────
function openEmoji(e, cb) {
  _emojiCb = cb;
  const picker = document.getElementById('emojiPicker');
  picker.innerHTML = '';
  EMOJIS.forEach(em => {
    const s = document.createElement('span'); s.className = 'emoji-opt'; s.textContent = em;
    s.onclick = () => { cb(em); closePicker(); };
    picker.appendChild(s);
  });
  const x = Math.min(e.clientX, window.innerWidth - 245);
  const y = Math.min(e.clientY + 8, window.innerHeight - 220);
  picker.style.left = x + 'px'; picker.style.top = y + 'px';
  picker.classList.add('open');
  e.stopPropagation();
}
function closePicker() { document.getElementById('emojiPicker').classList.remove('open'); _emojiCb = null; }
document.addEventListener('click', e => { if (!e.target.closest('#emojiPicker') && !e.target.closest('.emoji-btn') && !e.target.closest('.tab-emoji-btn')) closePicker(); });

// ─── Modal helpers ────────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-bg').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); }));

// ─── Drag to reorder ──────────────────────────────────────────────────────────
function makeDraggable(el, onDrop) {
  el.draggable = true;
  el.addEventListener('dragstart', e => { e.dataTransfer.effectAllowed = 'move'; el.classList.add('dragging'); e.dataTransfer.setData('text/plain', ''); });
  el.addEventListener('dragend', () => el.classList.remove('dragging'));
  el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over-item'); });
  el.addEventListener('dragleave', () => el.classList.remove('drag-over-item'));
  el.addEventListener('drop', e => { e.preventDefault(); el.classList.remove('drag-over-item'); onDrop(el); });
}

function makeTabDraggable(btn, list, tab) {
  btn.draggable = true;
  btn.addEventListener('dragstart', e => { e.dataTransfer.setData('tabId', tab.id); btn.style.opacity = '0.4'; });
  btn.addEventListener('dragend', () => btn.style.opacity = '1');
  btn.addEventListener('dragover', e => { e.preventDefault(); btn.classList.add('drag-over'); });
  btn.addEventListener('dragleave', () => btn.classList.remove('drag-over'));
  btn.addEventListener('drop', async e => {
    e.preventDefault(); btn.classList.remove('drag-over');
    const draggedId = e.dataTransfer.getData('tabId');
    if (!draggedId || draggedId === tab.id) return;
    const draggedIdx = list.tabs.findIndex(t => t.id === draggedId);
    const targetIdx  = list.tabs.findIndex(t => t.id === tab.id);
    if (draggedIdx < 0 || targetIdx < 0) return;
    const [moved] = list.tabs.splice(draggedIdx, 1);
    list.tabs.splice(targetIdx, 0, moved);
    list.tabs.forEach((t, i) => t.position = i);
    rebuildTabBar(list);
    scheduleSave(async () => {
      for (const t of list.tabs) await sb.from('tabs').update({ position: t.position }).eq('id', t.id);
    });
  });
}

// ─── Item row ─────────────────────────────────────────────────────────────────
function makeItemRow(list, tab, sec, item) {
  const row = document.createElement('div');
  row.className = 'item' + (sec.checkedIds.has(item.id) ? ' done' : '');
  row.dataset.itemId = item.id;

  // Drag handle
  const handle = document.createElement('span'); handle.className = 'item-handle'; handle.textContent = '⠿'; handle.title = 'Drag to reorder';
  row.appendChild(handle);

  const uid = 'chk-' + item.id;
  const chk = document.createElement('input'); chk.type = 'checkbox'; chk.id = uid; chk.checked = sec.checkedIds.has(item.id);
  chk.addEventListener('change', async () => {
    if (chk.checked) {
      sec.checkedIds.add(item.id);
      row.className = 'item done';
      await sb.from('checked_state').upsert({ item_id: item.id, checked_by: currentUser.id });
    } else {
      sec.checkedIds.delete(item.id);
      row.className = 'item';
      await sb.from('checked_state').delete().eq('item_id', item.id).eq('checked_by', currentUser.id);
    }
    updateProgress();
  });

  const lbl = document.createElement('label'); lbl.htmlFor = uid; lbl.textContent = item.text;

  const del = document.createElement('button'); del.className = 'del-btn'; del.title = 'Remove'; del.textContent = '×';
  del.addEventListener('click', async () => {
    if (!confirm(`Remove "${item.text}"?`)) return;
    await sb.from('items').update({ is_deleted: true }).eq('id', item.id);
    sec.items = sec.items.filter(i => i.id !== item.id);
    sec.checkedIds.delete(item.id);
    row.remove(); updateProgress();
  });

  row.append(handle, chk, lbl, del);

  // Drag to reorder items within section
  makeDraggable(row, async (targetRow) => {
    const listEl = row.parentElement; if (!listEl) return;
    const rows = [...listEl.querySelectorAll('.item')];
    const fromIdx = rows.indexOf(row);
    const toIdx   = rows.indexOf(targetRow);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
    // Reorder in DOM
    if (fromIdx < toIdx) listEl.insertBefore(row, targetRow.nextSibling);
    else listEl.insertBefore(row, targetRow);
    // Reorder in data
    const [moved] = sec.items.splice(fromIdx, 1);
    sec.items.splice(toIdx, 0, moved);
    sec.items.forEach((it, i) => it.position = i);
    scheduleSave(async () => {
      for (const it of sec.items) await sb.from('items').update({ position: it.position }).eq('id', it.id);
    });
  });

  return row;
}

// ─── Section ──────────────────────────────────────────────────────────────────
function buildSection(list, tab, sec, colsEl) {
  const wrap = document.createElement('div'); wrap.className = 'section-wrap'; wrap.dataset.secId = sec.id;

  const sh = document.createElement('div'); sh.className = 'section-header';

  const dh = document.createElement('span'); dh.className = 'drag-handle'; dh.textContent = '⠿'; dh.title = 'Drag to reorder sections';
  sh.appendChild(dh);

  const titleInput = document.createElement('input'); titleInput.className = 'section-title-input'; titleInput.value = sec.title;
  titleInput.addEventListener('change', () => {
    sec.title = titleInput.value.trim() || sec.title; titleInput.value = sec.title;
    scheduleSave(() => sb.from('sections').update({ title: sec.title }).eq('id', sec.id));
  });

  const sDelBtn = document.createElement('button'); sDelBtn.className = 'sec-del-btn'; sDelBtn.textContent = '×'; sDelBtn.title = 'Delete section';
  sDelBtn.addEventListener('click', async () => {
    if (!confirm(`Delete section "${sec.title}" and all its items?`)) return;
    await sb.from('sections').delete().eq('id', sec.id);
    tab.sections = tab.sections.filter(s => s.id !== sec.id);
    wrap.remove(); updateProgress();
  });

  sh.append(titleInput, sDelBtn);
  wrap.appendChild(sh);

  const listEl = document.createElement('div'); listEl.className = 'item-list';
  sec.items.forEach(item => listEl.appendChild(makeItemRow(list, tab, sec, item)));
  wrap.appendChild(listEl);

  // Section actions
  const acts = document.createElement('div'); acts.className = 'sec-actions';
  const caBtn = document.createElement('button'); caBtn.className = 'sec-btn'; caBtn.textContent = 'Check all';
  caBtn.addEventListener('click', async () => {
    const unchecked = sec.items.filter(i => !sec.checkedIds.has(i.id));
    for (const item of unchecked) {
      sec.checkedIds.add(item.id);
      await sb.from('checked_state').upsert({ item_id: item.id, checked_by: currentUser.id });
    }
    listEl.querySelectorAll('.item').forEach(r => { r.className = 'item done'; r.querySelector('input').checked = true; });
    updateProgress();
  });
  const clBtn = document.createElement('button'); clBtn.className = 'sec-btn'; clBtn.textContent = 'Clear';
  clBtn.addEventListener('click', async () => {
    for (const item of sec.items) {
      sec.checkedIds.delete(item.id);
      await sb.from('checked_state').delete().eq('item_id', item.id).eq('checked_by', currentUser.id);
    }
    listEl.querySelectorAll('.item').forEach(r => { r.className = 'item'; r.querySelector('input').checked = false; });
    updateProgress();
  });
  acts.append(caBtn, clBtn); wrap.appendChild(acts);

  // Add item
  const addRow = document.createElement('div'); addRow.className = 'add-row';
  const addInput = document.createElement('input'); addInput.className = 'add-input'; addInput.placeholder = '+ add item…';
  const addBtn = document.createElement('button'); addBtn.className = 'add-btn'; addBtn.textContent = 'Add';
  async function doAdd() {
    const text = addInput.value.trim(); if (!text) return;
    const pos = sec.items.length;
    const { data, error } = await sb.from('items').insert({ section_id: sec.id, text, position: pos }).select().single();
    if (error || !data) return;
    const newItem = { ...data }; sec.items.push(newItem);
    listEl.appendChild(makeItemRow(list, tab, sec, newItem));
    addInput.value = ''; updateProgress();
  }
  addInput.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
  addBtn.addEventListener('click', doAdd);
  addRow.append(addInput, addBtn); wrap.appendChild(addRow);

  // Drag sections within columns
  dh.addEventListener('mousedown', () => wrap.draggable = true);
  wrap.addEventListener('dragstart', e => { e.dataTransfer.setData('secId', sec.id); wrap.style.opacity = '0.4'; e.stopPropagation(); });
  wrap.addEventListener('dragend', () => { wrap.style.opacity = '1'; wrap.draggable = false; });
  wrap.addEventListener('dragover', e => { e.preventDefault(); wrap.classList.add('drag-over-section'); });
  wrap.addEventListener('dragleave', () => wrap.classList.remove('drag-over-section'));
  wrap.addEventListener('drop', async e => {
    e.preventDefault(); wrap.classList.remove('drag-over-section');
    const draggedId = e.dataTransfer.getData('secId');
    if (!draggedId || draggedId === sec.id) return;
    const fromIdx = tab.sections.findIndex(s => s.id === draggedId);
    const toIdx   = tab.sections.findIndex(s => s.id === sec.id);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = tab.sections.splice(fromIdx, 1);
    tab.sections.splice(toIdx, 0, moved);
    tab.sections.forEach((s, i) => s.position = i);
    // Rebuild columns
    rebuildColumns(list, tab);
    scheduleSave(async () => {
      for (const s of tab.sections) await sb.from('sections').update({ position: s.position }).eq('id', s.id);
    });
  });

  colsEl.appendChild(wrap);
}

function rebuildColumns(list, tab) {
  const colsEl = document.getElementById(`cols-${list.id}-${tab.id}`);
  if (!colsEl) return;
  colsEl.innerHTML = '';
  tab.sections.forEach(sec => buildSection(list, tab, sec, colsEl));
}

// ─── Tab page ─────────────────────────────────────────────────────────────────
function buildTabPage(list, tab) {
  const page = document.createElement('div'); page.className = 'tab-page'; page.id = `tabpage-${list.id}-${tab.id}`;
  const wrap = document.createElement('div'); wrap.className = 'page-wrap';

  // Header
  const ph = document.createElement('div'); ph.className = 'tab-page-header';

  const eBtn = document.createElement('button'); eBtn.className = 'tab-emoji-btn'; eBtn.textContent = tab.emoji;
  eBtn.addEventListener('click', e => openEmoji(e, async em => {
    tab.emoji = em; eBtn.textContent = em; rebuildTabBar(list);
    await sb.from('tabs').update({ emoji: em }).eq('id', tab.id);
  }));

  const nameInput = document.createElement('input'); nameInput.className = 'tab-name-input'; nameInput.value = tab.name;
  nameInput.addEventListener('change', async () => {
    tab.name = nameInput.value.trim() || tab.name; nameInput.value = tab.name;
    rebuildTabBar(list);
    await sb.from('tabs').update({ name: tab.name }).eq('id', tab.id);
  });

  const delBtn = document.createElement('button'); delBtn.className = 'tab-del-btn'; delBtn.textContent = 'Delete tab';
  delBtn.addEventListener('click', async () => {
    if (!confirm(`Delete tab "${tab.name}" and all its items?`)) return;
    await sb.from('tabs').delete().eq('id', tab.id);
    list.tabs = list.tabs.filter(t => t.id !== tab.id);
    page.remove();
    if (list.tabs.length) { activeTabIds[list.id] = list.tabs[0].id; rebuildTabBar(list); showTab(list, list.tabs[0].id); }
    updateProgress();
  });

  ph.append(eBtn, nameInput, delBtn);
  wrap.appendChild(ph);

  // Columns
  const colsEl = document.createElement('div');
  const n = tab.sections.length;
  colsEl.className = `columns ${n <= 1 ? 'col-1' : n <= 2 ? 'col-2' : n <= 3 ? 'col-3' : 'col-4'}`;
  colsEl.id = `cols-${list.id}-${tab.id}`;
  tab.sections.forEach(sec => buildSection(list, tab, sec, colsEl));
  wrap.appendChild(colsEl);

  // Add section
  const asr = document.createElement('div'); asr.className = 'add-section-row';
  const asInput = document.createElement('input'); asInput.className = 'add-section-input'; asInput.placeholder = '+ new section name…';
  const asBtn = document.createElement('button'); asBtn.className = 'add-section-btn'; asBtn.textContent = 'Add section';
  async function doAddSection() {
    const text = asInput.value.trim(); if (!text) return;
    const pos = tab.sections.length;
    const { data, error } = await sb.from('sections').insert({ tab_id: tab.id, title: text, position: pos }).select().single();
    if (error || !data) return;
    const newSec = { ...data, items: [], checkedIds: new Set() };
    tab.sections.push(newSec);
    const n2 = tab.sections.length;
    colsEl.className = `columns ${n2 <= 1 ? 'col-1' : n2 <= 2 ? 'col-2' : n2 <= 3 ? 'col-3' : 'col-4'}`;
    buildSection(list, tab, newSec, colsEl);
    asInput.value = '';
  }
  asInput.addEventListener('keydown', e => { if (e.key === 'Enter') doAddSection(); });
  asBtn.addEventListener('click', doAddSection);
  asr.append(asInput, asBtn); wrap.appendChild(asr);

  page.appendChild(wrap);
  return page;
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────
function rebuildTabBar(list) {
  const bar = document.getElementById(`tabbar-${list.id}`); if (!bar) return;
  bar.innerHTML = '';
  list.tabs.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (activeTabIds[list.id] === tab.id ? ' active' : '');
    btn.id = `tabbtn-${list.id}-${tab.id}`;

    const lbl = document.createElement('span'); lbl.textContent = `${tab.emoji} ${tab.name}`;
    const cnt = document.createElement('span'); cnt.className = 'tab-count'; cnt.id = `tabcount-${list.id}-${tab.id}`;
    btn.append(lbl, cnt);
    btn.addEventListener('click', () => { activeTabIds[list.id] = tab.id; rebuildTabBar(list); showTab(list, tab.id); updateProgress(); });
    makeTabDraggable(btn, list, tab);
    bar.appendChild(btn);
  });

  const addBtn = document.createElement('button'); addBtn.className = 'add-tab-btn'; addBtn.textContent = '+ category';
  addBtn.addEventListener('click', () => { _newTabListId = list.id; openModal('newTabModal'); setTimeout(() => document.getElementById('newTabName').focus(), 50); });
  bar.appendChild(addBtn);
}

function showTab(list, tabId) {
  document.querySelectorAll(`#listview-${list.id} .tab-page`).forEach(p => p.classList.remove('active'));
  document.getElementById(`tabpage-${list.id}-${tabId}`)?.classList.add('active');
}

// ─── List view ────────────────────────────────────────────────────────────────
function buildListView(list) {
  const view = document.createElement('div'); view.className = 'list-view'; view.id = `listview-${list.id}`;

  // Header
  const lh = document.createElement('div'); lh.className = 'list-header';

  const eBtn = document.createElement('button'); eBtn.className = 'emoji-btn'; eBtn.textContent = list.emoji;
  eBtn.addEventListener('click', e => openEmoji(e, async em => {
    list.emoji = em; eBtn.textContent = em; rebuildListBar();
    await sb.from('lists').update({ emoji: em }).eq('id', list.id);
  }));

  const nameInput = document.createElement('input'); nameInput.className = 'list-name-input'; nameInput.value = list.name;
  nameInput.addEventListener('change', async () => {
    list.name = nameInput.value.trim() || list.name; nameInput.value = list.name;
    rebuildListBar();
    await sb.from('lists').update({ name: list.name }).eq('id', list.id);
  });

  const cnt = document.createElement('span'); cnt.className = 'list-count'; cnt.id = `listcount-${list.id}`;
  lh.append(eBtn, nameInput, cnt); view.appendChild(lh);

  // Tab bar
  const tabBar = document.createElement('div'); tabBar.className = 'tab-bar'; tabBar.id = `tabbar-${list.id}`;
  view.appendChild(tabBar);

  // Tab pages
  list.tabs.forEach(tab => view.appendChild(buildTabPage(list, tab)));

  document.getElementById('listViews').appendChild(view);

  if (!activeTabIds[list.id] && list.tabs.length) activeTabIds[list.id] = list.tabs[0].id;
  rebuildTabBar(list);
  showTab(list, activeTabIds[list.id]);
}

// ─── List bar ─────────────────────────────────────────────────────────────────
function rebuildListBar() {
  const bar = document.getElementById('listBar'); bar.innerHTML = '';
  lists.forEach(list => {
    const pill = document.createElement('div'); pill.className = 'list-pill' + (list.id === activeListId ? ' active' : '');
    const lbl = document.createElement('span'); lbl.textContent = `${list.emoji} ${list.name}`; lbl.style.cursor = 'pointer';
    lbl.addEventListener('click', () => switchList(list.id));
    pill.appendChild(lbl);
    if (lists.length > 1) {
      const del = document.createElement('button'); del.className = 'pill-del'; del.textContent = '×'; del.title = 'Delete list';
      del.addEventListener('click', async e => { e.stopPropagation(); await deleteList(list.id); });
      pill.appendChild(del);
    }
    bar.appendChild(pill);
  });
  const newBtn = document.createElement('button'); newBtn.className = 'new-list-btn'; newBtn.textContent = '+ new list';
  newBtn.addEventListener('click', () => { openModal('newListModal'); setTimeout(() => document.getElementById('newListName').focus(), 50); });
  bar.appendChild(newBtn);
}

function switchList(id) {
  activeListId = id;
  document.querySelectorAll('.list-view').forEach(v => v.classList.remove('active'));
  document.getElementById(`listview-${id}`)?.classList.add('active');
  rebuildListBar(); updateProgress();
}

async function deleteList(id) {
  const list = lists.find(l => l.id === id);
  if (!list || !confirm(`Delete list "${list.name}"?`)) return;
  await sb.from('lists').delete().eq('id', id);
  lists = lists.filter(l => l.id !== id);
  document.getElementById(`listview-${id}`)?.remove();
  if (activeListId === id) activeListId = lists[0]?.id;
  if (activeListId) switchList(activeListId);
  rebuildListBar();
}

// ─── Real-time subscription ───────────────────────────────────────────────────
function subscribeRealtime() {
  sb.channel('db-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'checked_state' }, payload => {
      // Find item across all lists and update UI
      for (const list of lists) {
        for (const tab of list.tabs) {
          for (const sec of tab.sections) {
            const item = sec.items.find(i => i.id === (payload.new?.item_id || payload.old?.item_id));
            if (!item) continue;
            if (payload.eventType === 'INSERT') sec.checkedIds.add(item.id);
            else if (payload.eventType === 'DELETE') sec.checkedIds.delete(item.id);
            // Update checkbox UI
            const row = document.querySelector(`[data-item-id="${item.id}"]`);
            if (row) {
              const isChecked = sec.checkedIds.has(item.id);
              row.className = 'item' + (isChecked ? ' done' : '');
              row.querySelector('input').checked = isChecked;
            }
            updateProgress();
          }
        }
      }
    })
    .subscribe();
}

// ─── App object ───────────────────────────────────────────────────────────────
const App = {
  async confirmNewList() {
    const name = document.getElementById('newListName').value.trim(); if (!name) return;

    // Generate ID client-side so we can insert list + member without needing to read back
    const id = crypto.randomUUID();
    const emoji = '📋';
    const created_at = new Date().toISOString();

    const { error: listErr } = await sb.from('lists').insert({ id, name, emoji, created_at });
    if (listErr) { console.error('list insert error:', listErr); return; }

    const { error: memErr } = await sb.from('list_members').insert({ list_id: id, user_id: currentUser.id, role: 'owner' });
    if (memErr) { console.error('member insert error:', memErr); return; }

    const newList = { id, name, emoji, created_at, tabs: [] };
    lists.push(newList);
    buildListView(newList);
    switchList(newList.id);
    rebuildListBar();
    closeModal('newListModal');
    document.getElementById('newListName').value = '';
  },

  async confirmNewTab() {
    const name = document.getElementById('newTabName').value.trim(); if (!name) return;
    const list = lists.find(l => l.id === _newTabListId); if (!list) return;
    const pos = list.tabs.length;
    const { data } = await sb.from('tabs').insert({ list_id: list.id, name, emoji: '📋', position: pos }).select().single();
    if (!data) return;
    const newTab = { ...data, sections: [] };
    list.tabs.push(newTab);
    const view = document.getElementById(`listview-${list.id}`);
    // Insert before global-actions
    const asr = view.querySelector('.add-section-row');
    view.appendChild(buildTabPage(list, newTab));
    activeTabIds[list.id] = newTab.id;
    rebuildTabBar(list); showTab(list, newTab.id);
    updateProgress();
    closeModal('newTabModal');
    document.getElementById('newTabName').value = '';
  },

  async resetCurrent() {
    if (!confirm('Reset all checkboxes in this list?')) return;
    const list = lists.find(l => l.id === activeListId); if (!list) return;
    const allItemIds = list.tabs.flatMap(t => t.sections.flatMap(s => s.items.map(i => i.id)));
    if (allItemIds.length) await sb.from('checked_state').delete().in('item_id', allItemIds).eq('checked_by', currentUser.id);
    list.tabs.forEach(t => t.sections.forEach(s => { s.checkedIds.clear(); }));
    document.querySelectorAll(`#listview-${list.id} .item`).forEach(r => { r.className = 'item'; r.querySelector('input').checked = false; });
    updateProgress();
  },


  async openShare() {
    const list = lists.find(l => l.id === activeListId); if (!list) return;
    document.getElementById('shareError').textContent = '';
    document.getElementById('shareEmail').value = '';

    // Load current members with emails via profiles view
    const { data: members } = await sb.from('list_members').select('user_id, role').eq('list_id', list.id);
    const memberList = document.getElementById('memberList');
    memberList.innerHTML = '<p style="font-size:0.75rem;color:var(--muted);margin-bottom:0.5rem;letter-spacing:0.06em;text-transform:uppercase;">Current members</p>';

    for (const m of (members || [])) {
      const { data: userData } = await sb.auth.admin?.getUserById?.(m.user_id) || {};
      const email = m.user_id === currentUser.id ? currentUser.email : `user ${m.user_id.slice(0,8)}…`;
      const row = document.createElement('div'); row.className = 'member-row';
      const info = document.createElement('div'); info.className = 'member-info';
      const emailEl = document.createElement('span'); emailEl.className = 'member-email'; emailEl.textContent = email;
      const roleEl = document.createElement('span'); roleEl.className = 'member-role'; roleEl.textContent = m.role;
      info.append(emailEl, roleEl);
      row.appendChild(info);
      if (m.user_id !== currentUser.id) {
        const removeBtn = document.createElement('button'); removeBtn.className = 'member-remove'; removeBtn.textContent = '× remove';
        removeBtn.addEventListener('click', async () => {
          await sb.from('list_members').delete().eq('list_id', list.id).eq('user_id', m.user_id);
          row.remove();
        });
        row.appendChild(removeBtn);
      }
      memberList.appendChild(row);
    }

    openModal('shareModal');
    setTimeout(() => document.getElementById('shareEmail').focus(), 50);
  },

  async confirmShare() {
    const email = document.getElementById('shareEmail').value.trim().toLowerCase();
    const errEl = document.getElementById('shareError');
    errEl.textContent = '';
    if (!email) return;

    const list = lists.find(l => l.id === activeListId); if (!list) return;

    // Look up user by email using a profiles lookup
    // We use a workaround: try to find existing list_members or use edge function
    // Since we can't query auth.users directly from client, we store emails in a profiles table
    // For now: check if user exists via a known workaround - invite by creating a pending record
    // Actually look them up via our own RPC or just try inserting and catch the error
    const { data: existingUsers, error: lookupErr } = await sb.rpc('get_user_id_by_email', { email_input: email });

    if (lookupErr || !existingUsers) {
      errEl.textContent = 'Could not find that user. Make sure they have signed in at least once.';
      return;
    }

    const userId = existingUsers;
    if (!userId) { errEl.textContent = 'No account found for that email.'; return; }
    if (userId === currentUser.id) { errEl.textContent = "That's you!"; return; }

    const { error } = await sb.from('list_members').insert({ list_id: list.id, user_id: userId, role: 'editor' });
    if (error) {
      if (error.code === '23505') errEl.textContent = 'That person already has access.';
      else errEl.textContent = 'Something went wrong. Try again.';
      return;
    }

    document.getElementById('shareEmail').value = '';
    errEl.textContent = '';
    errEl.style.color = 'var(--accent2)';
    errEl.textContent = `Invited ${email}!`;
    setTimeout(() => { errEl.textContent = ''; errEl.style.color = ''; }, 3000);

    // Refresh member list
    App.openShare();
  },
  async checkCurrent() {
    const list = lists.find(l => l.id === activeListId); if (!list) return;
    for (const tab of list.tabs) {
      for (const sec of tab.sections) {
        const unchecked = sec.items.filter(i => !sec.checkedIds.has(i.id));
        for (const item of unchecked) {
          await sb.from('checked_state').upsert({ item_id: item.id, checked_by: currentUser.id });
          sec.checkedIds.add(item.id);
        }
      }
    }
    document.querySelectorAll(`#listview-${list.id} .item`).forEach(r => { r.className = 'item done'; r.querySelector('input').checked = true; });
    updateProgress();
  },
};

document.getElementById('newListName').addEventListener('keydown', e => { if (e.key === 'Enter') App.confirmNewList(); });
document.getElementById('newTabName').addEventListener('keydown', e => { if (e.key === 'Enter') App.confirmNewTab(); });

// ─── Boot ─────────────────────────────────────────────────────────────────────
(async () => {
  const { data: { session } } = await sb.auth.getSession();

  if (session?.user) {
    currentUser = session.user;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('userBadge').textContent = currentUser.user_metadata?.full_name || currentUser.email;

    setStatus('loading…');
    try {
      lists = await loadLists();
      document.getElementById('listViews').innerHTML = '';
      if (lists.length) {
        lists.forEach(list => buildListView(list));
        activeListId = lists[0].id;
        switchList(activeListId);
      } else {
        document.getElementById('listViews').innerHTML = '<div class="empty-state"><p>No lists yet.</p><p>Create one above!</p></div>';
      }
      rebuildListBar();
      updateProgress();
      setStatus('');
      subscribeRealtime();
    } catch(e) {
      setStatus('error loading data', true);
      console.error(e);
    }
  }

  // Handle OAuth redirect
  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session && !currentUser) {
      location.reload();
    }
  });
})();
/* 修行紀錄 App（34.修行紀錄App）第一段：念經、佛號、打坐、文字日記、首頁、迴向、離線、備份 */
'use strict';

const APP_VERSION = '0.1.0';

/* ---------- 預設內容 ---------- */
const BUILTIN_SUTRAS = [
  { id: 'heart', name: '心經', unit: '遍', text: 'heart' },
  { id: 'pumen', name: '普門品', unit: '遍', text: 'pumen' },
  { id: 'dabei', name: '大悲咒', unit: '遍', text: 'dabei' },
  { id: 'diamond', name: '金剛經', unit: '遍', text: 'diamond' },
];
const BUILTIN_CHANTS = [
  { id: 'amitabha', name: '阿彌陀佛', unit: '聲' },
  { id: 'guanyin', name: '觀世音菩薩', unit: '聲' },
];
const BUILTIN_MOODS = ['平靜', '歡喜', '感恩', '煩躁', '焦慮', '疲累', '低落'];
const FOUR_ITS = ['面對它', '接受它', '處理它', '放下它'];
const SIT_METHODS = ['數息', '默照', '念佛', '其他'];
const DEFAULT_DEDICATION = '願以此功德　莊嚴佛淨土\n上報四重恩　下濟三途苦\n若有見聞者　悉發菩提心\n盡此一報身　同生極樂國';
const BEADS = 108;

/* ---------- 小工具 ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const dayKey = d => new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }); // YYYY-MM-DD（台北）
const todayKey = () => dayKey(Date.now());
const fmtNum = n => Number(n || 0).toLocaleString('zh-TW');
const fmtTime = d => new Date(d).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false });
function fmtDay(k) {
  const [y, m, d] = k.split('-').map(Number);
  const w = '日一二三四五六'[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m} 月 ${d} 日（${w}）`;
}
function fmtMinutes(min) {
  min = Math.round(min || 0);
  if (min < 60) return `${min} 分`;
  return `${Math.floor(min / 60)} 小時 ${min % 60} 分`;
}
function shiftDay(k, n) {
  const [y, m, d] = k.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/* ---------- 資料庫（IndexedDB） ---------- */
let dbp;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open('xiuxing', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('logs', { keyPath: 'id' });
      d.createObjectStore('diary', { keyPath: 'id' });
      d.createObjectStore('kv', { keyPath: 'k' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function req(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const out = fn(t.objectStore(store));
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
  });
}
const dbAll = store => req(store, 'readonly', s => s.getAll());
const dbPut = (store, obj) => req(store, 'readwrite', s => s.put(obj));
const dbDel = (store, id) => req(store, 'readwrite', s => s.delete(id));
const kvGet = async (k, dflt) => { const r = await req('kv', 'readonly', s => s.get(k)); return r ? r.v : dflt; };
const kvSet = (k, v) => dbPut('kv', { k, v });
const kvDel = k => dbDel('kv', k);

/* ---------- 設定 ---------- */
let settings = null;
async function loadSettings() {
  settings = Object.assign({
    dedication: DEFAULT_DEDICATION, startDate: '', customSutras: [], customChants: [], customMoods: [],
  }, await kvGet('settings', {}));
}
const saveSettings = () => kvSet('settings', settings);
const sutraItems = () => [...BUILTIN_SUTRAS, ...settings.customSutras];
const chantItems = () => [...BUILTIN_CHANTS, ...settings.customChants];
const moodList = () => [...BUILTIN_MOODS, ...settings.customMoods];
const findItem = id => [...sutraItems(), ...chantItems()].find(i => i.id === id);
const counted = rec => !settings.startDate || dayKey(rec.at) >= settings.startDate;

/* ---------- 畫面共用 ---------- */
const view = $('#view');
function setTitle(t) { $('#pageTitle').textContent = t; document.title = t === '修行紀錄' ? t : `${t}｜修行紀錄`; }
function setTab(tab) { $$('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab)); }

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

function openModal(html) {
  $('#modalCard').innerHTML = html; $('#modal').hidden = false;
  return $('#modalCard');
}
function closeModal() { $('#modal').hidden = true; $('#modalCard').innerHTML = ''; }

/** 迴向：按「迴向」才算完成（Q23）。回傳 true／false */
function dedicate(summary) {
  return new Promise(resolve => {
    const card = openModal(`
      <h3>迴向</h3>
      <p class="muted small" style="margin:0">${esc(summary)}</p>
      <div class="dedication">${esc(settings.dedication)}</div>
      <div class="modal-actions">
        <button class="btn" data-a="no">還沒好</button>
        <button class="btn primary" data-a="yes">🙏 迴向</button>
      </div>`);
    card.onclick = e => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      closeModal(); resolve(a === 'yes');
    };
  });
}

function askNumber(title, value, unit) {
  return new Promise(resolve => {
    const card = openModal(`
      <h3>${esc(title)}</h3>
      <label class="field"><span>數量（${esc(unit)}）</span><input type="number" inputmode="numeric" min="0" id="numIn" value="${esc(value)}"></label>
      <div class="modal-actions"><button class="btn" data-a="no">取消</button><button class="btn primary" data-a="yes">確定</button></div>`);
    const inp = $('#numIn', card); setTimeout(() => inp.select(), 50);
    card.onclick = e => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      const v = parseInt(inp.value, 10); closeModal();
      resolve(a === 'yes' && Number.isFinite(v) && v >= 0 ? v : null);
    };
  });
}

/* 螢幕常亮（計數、打坐時） */
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* 不支援就算了 */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && document.body.classList.contains('immersive')) keepAwake(true);
});

/* ---------- 引磬聲（即時合成，不用音檔） ---------- */
let audioCtx = null;
function audio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function strike(t0) {
  const ctx = audio(); const base = 1180;
  [[1, .5, 4.5], [2.76, .22, 2.4], [5.4, .1, 1.2], [8.93, .05, .6]].forEach(([r, g, dur]) => {
    const o = ctx.createOscillator(); const v = ctx.createGain();
    o.type = 'sine'; o.frequency.value = base * r;
    v.gain.setValueAtTime(0.0001, t0); v.gain.exponentialRampToValueAtTime(g, t0 + 0.006);
    v.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(v).connect(ctx.destination); o.start(t0); o.stop(t0 + dur + .05);
  });
}
function bells(n = 1) {
  const ctx = audio(); const t = ctx.currentTime + .05;
  for (let i = 0; i < n; i++) strike(t + i * 2.4);
}

/* ---------- 路由 ---------- */
const routes = {
  home: renderHome, sutra: renderSutra, chant: renderChant, sit: renderSit, diary: renderDiary, settings: renderSettings,
};
async function route() {
  const [name, ...rest] = (location.hash.slice(1) || 'home').split('/');
  const fn = routes[name] || renderHome;
  document.body.classList.remove('immersive');
  closeModal();
  setTab(routes[name] ? name : 'home');
  await fn(...rest.map(decodeURIComponent));
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
$('#settingsBtn').onclick = () => { location.hash = 'settings'; };
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

/* ---------- 首頁 ---------- */
let selectedDay = null;
async function renderHome() {
  setTitle('修行紀錄');
  const [logsAll, diaryAll] = await Promise.all([dbAll('logs'), dbAll('diary')]);
  const logs = logsAll.filter(counted), diary = diaryAll.filter(counted);
  const today = todayKey();

  // 每天有幾筆紀錄
  const perDay = {};
  [...logs, ...diary].forEach(r => { const k = dayKey(r.at); perDay[k] = (perDay[k] || 0) + 1; });

  // 連續天數：今天還沒做也不算斷，從昨天往回數
  let streak = 0, k = perDay[today] ? today : shiftDay(today, -1);
  while (perDay[k]) { streak++; k = shiftDay(k, -1); }

  // 累積
  const tot = {};
  let sitMin = 0;
  logs.forEach(l => {
    if (l.type === 'sit') sitMin += l.minutes || 0;
    else tot[l.itemId] = (tot[l.itemId] || 0) + (l.count || 0);
  });
  const totalLines = [...sutraItems(), ...chantItems()].filter(i => tot[i.id]).map(i =>
    `<div class="stat"><b>${fmtNum(tot[i.id])}</b><span>${esc(i.name)}（${esc(i.unit)}）${i.unit === '聲' && tot[i.id] >= BEADS ? `・${Math.floor(tot[i.id] / BEADS)} 串` : ''}</span></div>`).join('');

  const testing = !settings.startDate
    ? `<div class="banner">🧪 目前是<b>測試期間</b>：三段全部做完後，到設定填「正式啟用日」，累積就從那天算起。</div>` : '';

  view.innerHTML = `
    ${testing}
    <div class="card">
      <h2>今天 ${fmtDay(today)}</h2>
      ${daySummary(today, logs, diary) || '<p class="muted" style="margin:0">今天還沒有紀錄。從下面選一項功課開始吧 🙏</p>'}
    </div>
    <div class="card">
      <h2>累積</h2>
      <div class="stats">
        <div class="stat"><b>${streak}</b><span>連續修行（天）</span></div>
        <div class="stat"><b>${fmtMinutes(sitMin)}</b><span>打坐</span></div>
        ${totalLines}
        <div class="stat"><b>${diary.length}</b><span>日記（篇）</span></div>
      </div>
    </div>
    <div class="card">
      <h2>修行日曆（點一天看紀錄）</h2>
      <div class="heat" id="heat"></div>
      <div id="dayDetail" class="small" style="margin-top:10px"></div>
    </div>`;

  // 熱度圖：直欄是一週（日→六），週數依螢幕寬度（平板會多顯示幾週）
  const heat = $('#heat');
  const weeks = Math.max(10, Math.min(53, Math.floor((heat.clientWidth + 3) / 18)));
  const [y, m, d] = today.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const start = shiftDay(today, -(weeks - 1) * 7 - dow);
  for (let i = 0; i < weeks * 7; i++) {
    const key = shiftDay(start, i), n = perDay[key] || 0;
    const b = document.createElement('button');
    b.className = key > today ? 'future' : n >= 5 ? 'l4' : n >= 3 ? 'l3' : n === 2 ? 'l2' : n === 1 ? 'l1' : '';
    b.title = `${key}：${n} 筆`; b.dataset.day = key;
    b.setAttribute('aria-label', `${fmtDay(key)}，${n} 筆紀錄`);
    heat.appendChild(b);
  }
  heat.scrollLeft = heat.scrollWidth;
  const showDay = key => {
    selectedDay = key;
    $$('#heat button').forEach(b => b.classList.toggle('sel', b.dataset.day === key));
    $('#dayDetail').innerHTML = `<b>${fmtDay(key)}</b><br>${daySummary(key, logs, diary) || '<span class="muted">這天沒有紀錄</span>'}`;
  };
  heat.onclick = e => { const b = e.target.closest('button[data-day]'); if (b && !b.classList.contains('future')) showDay(b.dataset.day); };
  if (selectedDay) showDay(selectedDay);
}

function daySummary(key, logs, diary) {
  const ls = logs.filter(l => dayKey(l.at) === key);
  const ds = diary.filter(r => dayKey(r.at) === key);
  if (!ls.length && !ds.length) return '';
  const agg = {};
  let sit = 0, sitN = 0;
  ls.forEach(l => {
    if (l.type === 'sit') { sit += l.minutes || 0; sitN++; return; }
    const it = findItem(l.itemId) || { name: l.name, unit: l.unit || '' };
    const a = agg[l.itemId] || (agg[l.itemId] = { name: it.name, unit: it.unit, n: 0 });
    a.n += l.count || 0;
  });
  const parts = Object.values(agg).map(a => `${esc(a.name)} ${fmtNum(a.n)} ${esc(a.unit)}`);
  if (sitN) parts.push(`打坐 ${sitN} 次、共 ${fmtMinutes(sit)}`);
  if (ds.length) parts.push(`日記 ${ds.length} 篇`);
  return `<div class="chips" style="margin-top:4px">${parts.map(p => `<span class="tag" style="font-size:.9rem">${p}</span>`).join('')}</div>`;
}

/* ---------- 念經 ---------- */
async function renderSutra(id) {
  if (id) return renderSutraReader(id);
  setTitle('念經');
  const logs = (await dbAll('logs')).filter(counted);
  const tot = {}, todayN = {};
  logs.filter(l => l.type === 'sutra').forEach(l => {
    tot[l.itemId] = (tot[l.itemId] || 0) + l.count;
    if (dayKey(l.at) === todayKey()) todayN[l.itemId] = (todayN[l.itemId] || 0) + l.count;
  });
  view.innerHTML = `<div class="card"><ul class="list">${sutraItems().map(s => `
    <li><button class="item-btn" data-id="${esc(s.id)}">
      <span><span class="name">${esc(s.name)}</span><br><span class="sub">${s.text && window.SUTRA_TEXTS?.[s.text] ? '有經文' : '自訂'}${todayN[s.id] ? `・今天 ${todayN[s.id]} ${esc(s.unit)}` : ''}</span></span>
      <span class="sub">累積 ${fmtNum(tot[s.id] || 0)} ${esc(s.unit)} ›</span>
    </button></li>`).join('')}</ul></div>
    <p class="muted small">要加其他經典：右上角 ⚙ 設定 →「自訂經典」。</p>`;
  view.onclick = e => { const b = e.target.closest('.item-btn'); if (b) location.hash = `sutra/${encodeURIComponent(b.dataset.id)}`; };
}

async function renderSutraReader(id) {
  view.onclick = null;
  const s = sutraItems().find(x => x.id === id);
  if (!s) { location.hash = 'sutra'; return; }
  setTitle(s.name);
  const t = s.text && window.SUTRA_TEXTS?.[s.text];
  const size = await kvGet('fontSize', 20);
  const textHtml = t ? `
    <div class="sutra-text ${s.text === 'dabei' ? 'mantra' : ''}" id="stext" style="font-size:${size}px">
      <h2>${esc(t.title)}</h2><div class="by">${esc(t.translator || '')}</div>
      ${t.paragraphs.map(p => `<p>${esc(p)}</p>`).join('')}
    </div>
    <div class="sutra-src">經文來源：${esc(t.source)}（CBETA 中華電子佛典協會，CC BY-NC-SA 3.0 TW）。尚未依法鼓山課誦本校對。${t.note ? `<br>附註：${esc(t.note)}` : ''}</div>`
    : `<div class="card muted">這部經沒有內建經文，請用自己的經本念。</div>`;
  view.innerHTML = `
    <div class="sutra-head">
      <button class="btn" onclick="location.hash='sutra'">‹ 返回</button>
      <span class="grow"></span>
      ${t ? `<button class="btn" data-fs="-2" aria-label="字變小">A−</button><button class="btn" data-fs="2" aria-label="字變大">A＋</button>` : ''}
    </div>
    ${textHtml}
    <div class="sticky-bottom">
      <div class="stepper"><button data-st="-1" aria-label="減一">−</button><input id="cnt" type="number" inputmode="numeric" min="1" value="1"><button data-st="1" aria-label="加一">＋</button></div>
      <span class="small muted">${esc(s.unit)}</span>
      <button class="btn primary grow" id="done">完成</button>
    </div>`;
  let fs = size;
  view.onclick = async e => {
    const f = e.target.closest('[data-fs]');
    if (f) { fs = Math.min(36, Math.max(14, fs + Number(f.dataset.fs))); $('#stext').style.fontSize = fs + 'px'; kvSet('fontSize', fs); return; }
    const st = e.target.closest('[data-st]');
    if (st) { const c = $('#cnt'); c.value = Math.max(1, (parseInt(c.value, 10) || 1) + Number(st.dataset.st)); return; }
    if (e.target.id === 'done') {
      const n = parseInt($('#cnt').value, 10);
      if (!(n > 0)) { toast('請輸入遍數'); return; }
      if (!await dedicate(`${s.name} ${n} ${s.unit}`)) return;
      await dbPut('logs', { id: uid(), type: 'sutra', itemId: s.id, name: s.name, unit: s.unit, count: n, dedicated: true, at: new Date().toISOString() });
      toast(`已記錄：${s.name} ${n} ${s.unit} 🙏`);
      $('#cnt').value = 1;
    }
  };
}

/* ---------- 佛號計數 ---------- */
async function renderChant(id) {
  if (id) return renderCounter(id);
  setTitle('佛號');
  const logs = (await dbAll('logs')).filter(counted);
  const tot = {};
  logs.filter(l => l.type === 'chant').forEach(l => { tot[l.itemId] = (tot[l.itemId] || 0) + l.count; });
  const progress = {};
  for (const c of chantItems()) progress[c.id] = await kvGet('chant:' + c.id, 0);
  view.innerHTML = `<div class="card"><ul class="list">${chantItems().map(c => `
    <li><button class="item-btn" data-id="${esc(c.id)}">
      <span><span class="name">${esc(c.name)}</span>${progress[c.id] ? `<br><span class="sub">⏸ 念到 ${fmtNum(progress[c.id])} 聲，點進去繼續</span>` : ''}</span>
      <span class="sub">累積 ${fmtNum(tot[c.id] || 0)} ${esc(c.unit)} ›</span>
    </button></li>`).join('')}</ul></div>
    <p class="muted small">點進去後整個畫面都可以點，點一下加一；每滿 ${BEADS} 聲震動一下。要加其他佛號或咒語：⚙ 設定 →「自訂佛號」。</p>`;
  view.onclick = e => { const b = e.target.closest('.item-btn'); if (b) location.hash = `chant/${encodeURIComponent(b.dataset.id)}`; };
}

async function renderCounter(id) {
  view.onclick = null;
  const c = chantItems().find(x => x.id === id);
  if (!c) { location.hash = 'chant'; return; }
  setTitle(c.name);
  document.body.classList.add('immersive');
  keepAwake(true);
  let n = await kvGet('chant:' + c.id, 0);
  view.innerHTML = `
    <div class="counter">
      <div class="bar"><button class="btn" data-a="back">‹ 先離開</button><button class="btn" data-a="input">輸入數字</button></div>
      <div class="tap" id="tap" role="button" aria-label="點一下加一">
        <div class="name">${esc(c.name)}</div>
        <div class="num" id="num">0</div>
        <div class="beads" id="beads"></div>
      </div>
      <div class="bar"><button class="btn" data-a="minus">−1</button><button class="btn primary" data-a="done" style="flex:1">念完了</button></div>
    </div>`;
  const show = () => {
    $('#num').textContent = fmtNum(n);
    $('#beads').textContent = n >= BEADS ? `第 ${Math.floor(n / BEADS)} 串${n % BEADS ? ` 又 ${n % BEADS} 聲` : ''}` : `一串 ${BEADS} 聲`;
  };
  const save = () => kvSet('chant:' + c.id, n);
  show();
  const tap = $('#tap');
  tap.addEventListener('pointerdown', e => {
    e.preventDefault();
    n++; show(); save();
    tap.classList.add('flash'); setTimeout(() => tap.classList.remove('flash'), 90);
    if (n % BEADS === 0) { navigator.vibrate?.([250, 80, 250]); toast(`第 ${n / BEADS} 串 🙏`); }
  });
  const leave = () => { keepAwake(false); location.hash = 'chant'; };
  view.onclick = async e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'back') leave();
    if (a === 'minus') { n = Math.max(0, n - 1); show(); save(); }
    if (a === 'input') {
      const v = await askNumber('直接輸入念了幾聲', n, c.unit);
      if (v !== null) { n = v; show(); save(); }
    }
    if (a === 'done') {
      if (!n) { toast('還沒有計數'); return; }
      if (!await dedicate(`${c.name} ${fmtNum(n)} ${c.unit}`)) return;
      await dbPut('logs', { id: uid(), type: 'chant', itemId: c.id, name: c.name, unit: c.unit, count: n, dedicated: true, at: new Date().toISOString() });
      await kvDel('chant:' + c.id);
      toast(`已記錄：${c.name} ${fmtNum(n)} ${c.unit} 🙏`);
      leave();
    }
  };
}

/* ---------- 打坐 ---------- */
let sitTimer = null;
async function renderSit() {
  setTitle('打坐');
  clearInterval(sitTimer);
  const run = await kvGet('sitRun', null);
  if (run) return renderSitting(run);
  const p = Object.assign({ mode: 'down', minutes: 20, interval: false, intervalMin: 10 }, await kvGet('sitPrefs', {}));
  const logs = (await dbAll('logs')).filter(l => l.type === 'sit' && counted(l)).sort((a, b) => b.at.localeCompare(a.at));
  view.innerHTML = `
    <div class="card">
      <h2>計時方式</h2>
      <div class="chips" id="mode">
        <button class="chip ${p.mode === 'down' ? 'on' : ''}" data-mode="down">倒數</button>
        <button class="chip ${p.mode === 'up' ? 'on' : ''}" data-mode="up">正數（下坐時按結束）</button>
      </div>
      <div id="minBox" ${p.mode === 'up' ? 'hidden' : ''}>
        <h2 style="margin-top:16px">時間</h2>
        <div class="chips" id="presets">
          ${[10, 20, 30].map(m => `<button class="chip ${p.minutes === m ? 'on' : ''}" data-min="${m}">${m} 分</button>`).join('')}
          <span class="row" style="gap:6px"><input type="number" inputmode="numeric" min="1" max="600" id="customMin" class="num-in" placeholder="自訂" value="${[10, 20, 30].includes(p.minutes) ? '' : p.minutes}"> 分</span>
        </div>
      </div>
      <h2 style="margin-top:16px">中間提醒鐘</h2>
      <div class="row"><label class="switch"><input type="checkbox" id="intOn" ${p.interval ? 'checked' : ''}> 開啟</label>
        <span class="row" style="gap:6px">每 <input type="number" inputmode="numeric" min="1" id="intMin" value="${p.intervalMin}" class="num-in"> 分鐘敲一聲</span></div>
      <div class="timer"><div class="clock" id="preview"></div></div>
      <button class="btn primary big" id="start">開始（引磬三聲）</button>
    </div>
    <div class="card">
      <h2>最近的打坐</h2>
      ${logs.length ? `<ul class="list">${logs.slice(0, 10).map(l => `<li style="padding:10px 0">
        <b>${fmtDay(dayKey(l.at))} ${fmtTime(l.at)}</b>　${fmtMinutes(l.minutes)}${l.method ? `　<span class="tag">${esc(l.method)}</span>` : ''}
        ${l.note ? `<div class="small">${esc(l.note)}</div>` : ''}</li>`).join('')}</ul>` : '<p class="muted" style="margin:0">還沒有紀錄</p>'}
    </div>`;
  const refresh = () => {
    $('#minBox').hidden = p.mode === 'up';
    $('#preview').textContent = p.mode === 'up' ? '00:00' : `${String(p.minutes).padStart(2, '0')}:00`;
    $$('#mode .chip').forEach(b => b.classList.toggle('on', b.dataset.mode === p.mode));
    $$('#presets .chip').forEach(b => b.classList.toggle('on', Number(b.dataset.min) === p.minutes && !$('#customMin').value));
  };
  refresh();
  view.onclick = async e => {
    const md = e.target.closest('[data-mode]'); if (md) { p.mode = md.dataset.mode; refresh(); }
    const pm = e.target.closest('[data-min]'); if (pm) { p.minutes = Number(pm.dataset.min); $('#customMin').value = ''; refresh(); }
    if (e.target.id === 'start') {
      p.interval = $('#intOn').checked;
      p.intervalMin = Math.max(1, parseInt($('#intMin').value, 10) || 10);
      if (p.mode === 'down' && !(p.minutes > 0)) { toast('請選時間'); return; }
      await kvSet('sitPrefs', p);
      const r = { start: Date.now(), mode: p.mode, minutes: p.minutes, interval: p.interval, intervalMin: p.intervalMin, rung: 0 };
      bells(3);
      await kvSet('sitRun', r);
      renderSitting(r);
    }
  };
  $('#customMin').oninput = e => { const v = parseInt(e.target.value, 10); if (v > 0) { p.minutes = v; refresh(); } };
}

function fmtClock(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(s).padStart(2, '0');
}

function renderSitting(r) {
  view.onclick = null;
  document.body.classList.add('immersive');
  keepAwake(true);
  view.innerHTML = `
    <div class="sitting">
      <div class="small">${r.mode === 'down' ? `倒數 ${r.minutes} 分` : '正數'}${r.interval ? `・每 ${r.intervalMin} 分提醒` : ''}</div>
      <div class="clock" id="clock"></div>
      <button class="btn" id="stop">${r.mode === 'down' ? '提前下坐' : '下坐'}</button>
    </div>`;
  let finished = false;
  const tick = () => {
    const el = (Date.now() - r.start) / 1000;
    $('#clock').textContent = fmtClock(r.mode === 'down' ? r.minutes * 60 - el : el);
    if (r.interval) {
      const due = Math.floor(el / (r.intervalMin * 60));
      const endAt = r.mode === 'down' ? r.minutes * 60 : Infinity;
      if (due > r.rung && el < endAt - 5) { r.rung = due; kvSet('sitRun', r); bells(1); }
    }
    if (r.mode === 'down' && el >= r.minutes * 60 && !finished) { finished = true; finish(r.minutes * 60, true); }
  };
  tick();
  clearInterval(sitTimer);
  sitTimer = setInterval(tick, 500);
  $('#stop').onclick = () => {
    if (!confirm('確定要下坐了嗎？')) return;
    finished = true; finish((Date.now() - r.start) / 1000, true);
  };
  async function finish(sec, ring) {
    clearInterval(sitTimer);
    if (ring) bells(3);
    keepAwake(false);
    const minutes = Math.round(sec / 60 * 10) / 10;
    const info = await sitForm(minutes);
    if (info && await dedicate(`打坐 ${fmtMinutes(minutes)}`)) {
      await dbPut('logs', { id: uid(), type: 'sit', itemId: 'sit', name: '打坐', unit: '分', minutes, seconds: Math.round(sec), mode: r.mode, method: info.method, note: info.note, dedicated: true, at: new Date(r.start).toISOString() });
      toast(`已記錄：打坐 ${fmtMinutes(minutes)} 🙏`);
    } else {
      toast('這次沒有記錄');
    }
    await kvDel('sitRun');
    location.hash = 'sit'; renderSit();
  }
}

function sitForm(minutes) {
  return new Promise(resolve => {
    let method = '';
    const card = openModal(`
      <h3>下坐了 🙏 共 ${fmtMinutes(minutes)}</h3>
      <p class="small muted" style="margin:0 0 6px">方法</p>
      <div class="chips" id="meth">${SIT_METHODS.map(m => `<button class="chip" data-m="${m}">${m}</button>`).join('')}</div>
      <label class="field" style="margin-top:12px"><span>一句心得（可不填）</span><input type="text" id="sitNote" maxlength="200"></label>
      <div class="modal-actions">
        <button class="btn" data-a="drop">不記錄</button>
        <button class="btn" data-a="skip">略過</button>
        <button class="btn primary" data-a="ok">下一步</button>
      </div>`);
    card.onclick = e => {
      const m = e.target.closest('[data-m]');
      if (m) { method = method === m.dataset.m ? '' : m.dataset.m; $$('#meth .chip').forEach(b => b.classList.toggle('on', b.dataset.m === method)); return; }
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      if (a === 'drop' && !confirm('這次打坐不記錄？')) return;
      const note = $('#sitNote').value.trim();
      closeModal();
      resolve(a === 'drop' ? null : a === 'skip' ? { method: '', note: '' } : { method, note });
    };
  });
}

/* ---------- 心情日記 ---------- */
async function renderDiary(action, id) {
  if (action === 'new' || action === 'edit') return renderDiaryForm(id);
  setTitle('日記');
  const list = (await dbAll('diary')).sort((a, b) => b.at.localeCompare(a.at));
  const groups = {};
  list.forEach(r => (groups[dayKey(r.at)] ||= []).push(r));
  view.innerHTML = `
    <button class="btn primary big" onclick="location.hash='diary/new'">＋ 寫日記</button>
    <p class="small muted">用說的（錄音＋轉文字）會在第二段加入。</p>
    ${list.length ? Object.entries(groups).map(([k, rs]) => `
      <div class="day-head">${fmtDay(k)}・${rs.length} 篇${settings.startDate && k < settings.startDate ? '（測試期間）' : ''}</div>
      ${rs.map(r => `<div class="card">
        <div class="entry">${esc(r.text)}</div>
        <div style="margin-top:6px">${(r.moods || []).map(m => `<span class="tag">${esc(m)}</span>`).join('')}${r.fourIt ? `<span class="tag">🪷 ${esc(r.fourIt)}</span>` : ''}</div>
        <div class="entry-meta"><span>${fmtTime(r.at)}・${r.share ? '🤝 給小輝看' : '🔒 只有自己'}</span>
          <span><button class="link-btn" data-edit="${r.id}">編輯</button><button class="link-btn" data-del="${r.id}">刪除</button></span></div>
      </div>`).join('')}`).join('') : '<div class="empty">還沒有日記</div>'}`;
  view.onclick = async e => {
    const ed = e.target.closest('[data-edit]'); if (ed) { location.hash = `diary/edit/${ed.dataset.edit}`; return; }
    const del = e.target.closest('[data-del]');
    if (del && confirm('確定刪除這篇日記？刪了就找不回來（除非有匯出備份）。')) { await dbDel('diary', del.dataset.del); renderDiary(); toast('已刪除'); }
  };
}

async function renderDiaryForm(id) {
  view.onclick = null;
  const old = id ? (await dbAll('diary')).find(r => r.id === id) : null;
  const r = old ? { ...old, moods: [...(old.moods || [])] } : { id: uid(), text: '', moods: [], fourIt: '', share: false, at: new Date().toISOString() };
  setTitle(old ? '編輯日記' : '寫日記');
  const draft = !old ? await kvGet('diaryDraft', '') : '';
  view.innerHTML = `
    <div class="card">
      <label class="field"><span>${old ? fmtDay(dayKey(r.at)) + ' ' + fmtTime(r.at) : '今天的心情'}</span><textarea id="txt" placeholder="今天發生了什麼？心裡有什麼感受？">${esc(old ? r.text : draft)}</textarea></label>
      <p class="small muted" style="margin:0 0 6px">心情（可複選）</p>
      <div class="chips" id="moods">${moodList().map(m => `<button class="chip ${r.moods.includes(m) ? 'on' : ''}" data-mood="${esc(m)}">${esc(m)}</button>`).join('')}</div>
      <p class="small muted" style="margin:14px 0 6px">四它：這件事我正在…</p>
      <div class="chips" id="four">${FOUR_ITS.map(f => `<button class="chip ${r.fourIt === f ? 'on' : ''}" data-four="${f}">${f}</button>`).join('')}</div>
      <label class="switch" style="margin-top:12px"><input type="checkbox" id="share" ${r.share ? 'checked' : ''}> 給小輝看（每週摘要會帶入這篇）</label>
    </div>
    <div class="row"><button class="btn" onclick="history.back()">取消</button><button class="btn primary grow" id="save">儲存</button></div>`;
  const txt = $('#txt');
  if (!old) txt.oninput = () => kvSet('diaryDraft', txt.value);
  view.onclick = async e => {
    const m = e.target.closest('[data-mood]');
    if (m) { const v = m.dataset.mood; r.moods = r.moods.includes(v) ? r.moods.filter(x => x !== v) : [...r.moods, v]; m.classList.toggle('on'); return; }
    const f = e.target.closest('[data-four]');
    if (f) { r.fourIt = r.fourIt === f.dataset.four ? '' : f.dataset.four; $$('#four .chip').forEach(b => b.classList.toggle('on', b.dataset.four === r.fourIt)); return; }
    if (e.target.id === 'save') {
      r.text = txt.value.trim(); r.share = $('#share').checked;
      if (!r.text) { toast('還沒有寫內容'); return; }
      if (old) r.updatedAt = new Date().toISOString();
      await dbPut('diary', r);
      if (!old) await kvDel('diaryDraft');
      toast('日記已儲存'); location.hash = 'diary';
    }
  };
}

/* ---------- 設定 ---------- */
async function renderSettings() {
  setTitle('設定');
  setTab('');
  const theme = localStorage.getItem('theme') || 'auto';
  const customList = (arr, kind) => arr.length ? `<ul class="list">${arr.map((x, i) => `<li class="row" style="padding:8px 0"><span class="grow">${esc(x.name || x)}${x.unit ? `（${esc(x.unit)}）` : ''}</span><button class="link-btn" data-rm="${kind}:${i}">移除</button></li>`).join('')}</ul>` : '<p class="small muted" style="margin:0">（還沒有）</p>';
  view.innerHTML = `
    <div class="card">
      <h2>迴向文</h2>
      <textarea id="ded" style="min-height:120px">${esc(settings.dedication)}</textarea>
      <div class="row" style="margin-top:8px"><button class="btn" id="dedReset">恢復預設</button><button class="btn primary" id="dedSave">儲存</button></div>
    </div>
    <div class="card">
      <h2>正式啟用日</h2>
      <p class="small muted" style="margin-top:0">三段全部做完後再填。填了以後，首頁和累積只算這天以後的紀錄（之前的測試紀錄保留，不會刪）。</p>
      <div class="row"><input type="date" id="startDate" value="${esc(settings.startDate)}" style="max-width:12em"><button class="btn" id="startSave">儲存</button></div>
    </div>
    <div class="card">
      <h2>自訂經典（沒有內建經文，用自己的經本念）</h2>
      ${customList(settings.customSutras, 'customSutras')}
      <div class="row" style="margin-top:8px"><input type="text" id="newSutra" placeholder="例如：阿彌陀經" class="grow" style="flex:1"><input type="text" id="newSutraUnit" value="遍" style="width:4em"><button class="btn" data-add="customSutras">加入</button></div>
    </div>
    <div class="card">
      <h2>自訂佛號／咒語（計數器）</h2>
      ${customList(settings.customChants, 'customChants')}
      <div class="row" style="margin-top:8px"><input type="text" id="newChant" placeholder="例如：地藏王菩薩" style="flex:1"><input type="text" id="newChantUnit" value="聲" style="width:4em"><button class="btn" data-add="customChants">加入</button></div>
    </div>
    <div class="card">
      <h2>自訂心情標籤</h2>
      ${customList(settings.customMoods, 'customMoods')}
      <div class="row" style="margin-top:8px"><input type="text" id="newMood" placeholder="例如：慚愧" style="flex:1"><button class="btn" data-add="customMoods">加入</button></div>
    </div>
    <div class="card">
      <h2>外觀</h2>
      <div class="chips" id="theme">${[['auto', '跟手機'], ['light', '淺色'], ['dark', '深色']].map(([v, l]) => `<button class="chip ${theme === v ? 'on' : ''}" data-theme="${v}">${l}</button>`).join('')}</div>
    </div>
    <div class="card">
      <h2>備份</h2>
      <p class="small muted" style="margin-top:0">資料只存在這支手機（雲端同步在第二段加入）。建議每週匯出一次，存到雲端硬碟的私人資料夾。</p>
      <div class="row"><button class="btn primary" id="export">匯出備份</button><label class="btn" style="display:inline-flex;align-items:center">匯入備份<input type="file" id="import" accept="application/json,.json" hidden></label></div>
    </div>
    <p class="small muted">修行紀錄 v${APP_VERSION}・34.修行紀錄App。經文來源：CBETA 中華電子佛典協會（CC BY-NC-SA 3.0 TW）。</p>`;

  view.onclick = async e => {
    if (e.target.id === 'dedSave') { settings.dedication = $('#ded').value.trim() || DEFAULT_DEDICATION; await saveSettings(); toast('迴向文已儲存'); }
    if (e.target.id === 'dedReset') { $('#ded').value = DEFAULT_DEDICATION; }
    if (e.target.id === 'startSave') { settings.startDate = $('#startDate').value; await saveSettings(); toast(settings.startDate ? `正式啟用日：${settings.startDate}` : '已清除正式啟用日'); }
    const add = e.target.closest('[data-add]')?.dataset.add;
    if (add) {
      if (add === 'customMoods') {
        const v = $('#newMood').value.trim(); if (!v || moodList().includes(v)) { toast(v ? '已經有這個標籤' : '請輸入名稱'); return; }
        settings.customMoods.push(v);
      } else {
        const isS = add === 'customSutras';
        const name = $(isS ? '#newSutra' : '#newChant').value.trim();
        const unit = $(isS ? '#newSutraUnit' : '#newChantUnit').value.trim() || (isS ? '遍' : '聲');
        if (!name) { toast('請輸入名稱'); return; }
        settings[add].push({ id: 'c-' + uid(), name, unit });
      }
      await saveSettings(); renderSettings(); toast('已加入');
    }
    const rm = e.target.closest('[data-rm]')?.dataset.rm;
    if (rm) {
      const [kind, i] = rm.split(':');
      if (!confirm('移除這一項？（已經記過的紀錄不會刪）')) return;
      settings[kind].splice(Number(i), 1); await saveSettings(); renderSettings();
    }
    const th = e.target.closest('[data-theme]')?.dataset.theme;
    if (th) { localStorage.setItem('theme', th); applyTheme(); renderSettings(); }
    if (e.target.id === 'export') exportData();
  };
  $('#import').onchange = e => importData(e.target.files[0]);
}

function applyTheme() {
  let t = 'auto'; try { t = localStorage.getItem('theme') || 'auto'; } catch (e) { /* 無法讀就用預設 */ }
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

async function exportData() {
  const data = { app: 'xiuxing', version: APP_VERSION, exportedAt: new Date().toISOString(), settings, logs: await dbAll('logs'), diary: await dbAll('diary') };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `修行紀錄備份_${todayKey().replace(/-/g, '')}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(`已匯出：紀錄 ${data.logs.length} 筆、日記 ${data.diary.length} 篇`);
}

async function importData(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'xiuxing') throw new Error('不是修行紀錄的備份檔');
    if (!confirm(`匯入 紀錄 ${data.logs?.length || 0} 筆、日記 ${data.diary?.length || 0} 篇？\n同一筆會用備份檔的內容蓋過，其他資料保留。`)) return;
    for (const l of data.logs || []) await dbPut('logs', l);
    for (const d of data.diary || []) await dbPut('diary', d);
    if (data.settings && confirm('也要套用備份檔裡的設定（迴向文、自訂項目、正式啟用日）嗎？')) { settings = Object.assign(settings, data.settings); await saveSettings(); }
    toast('匯入完成'); renderSettings();
  } catch (err) { alert('匯入失敗：' + err.message); }
}

/* ---------- 啟動 ---------- */
(async function start() {
  applyTheme();
  await loadSettings();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  route();
})();

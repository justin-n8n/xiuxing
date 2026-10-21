/* 修行紀錄 App（34.修行紀錄App）：念經與功課、佛號、打坐（流水聲）、日記（語音）、首頁、迴向、離線、雲端同步 */
'use strict';

const APP_VERSION = '0.3.0';

/* ---------- 預設內容 ---------- */
// 依課誦本的順序（v0.3.0，10/21 新Q3）；part：只在功課裡念、不另記遍數（新Q4）；hidden：預設隱藏（新Q2）
const BUILTIN_SUTRAS = [
  { id: 'gongmian', name: '四眾佛子共勉語', unit: '遍', text: 'gongmian', part: true },
  { id: 'dabei', name: '大悲咒', unit: '遍', text: 'dabei' },
  { id: 'heart', name: '心經', unit: '遍', text: 'heart' },
  { id: 'pumen', name: '普門品', unit: '遍', text: 'pumen' },
  { id: 'puxian', name: '普賢十大願王', unit: '遍', text: 'puxian' },
  { id: 'sangui', name: '三皈依', unit: '遍', text: 'sangui', part: true },
  { id: 'huixiang', name: '回向偈', unit: '遍', text: 'huixiang', part: true, dedication: true },
  { id: 'hongyuan', name: '四弘誓願', unit: '遍', text: 'hongyuan', part: true },
  { id: 'jingzhong', name: '普賢警眾偈', unit: '遍', text: 'jingzhong', part: true },
  { id: 'diamond', name: '金剛經', unit: '遍', text: 'diamond', hidden: true },
];
const SET_ITEM = { id: 'set', name: '完整功課', unit: '次' };
const BUILTIN_CHANTS = [
  { id: 'amitabha', name: '阿彌陀佛', unit: '聲' },
  { id: 'guanyin', name: '觀世音菩薩', unit: '聲' },
];
const BUILTIN_MOODS = ['平靜', '歡喜', '感恩', '煩躁', '焦慮', '疲累', '低落'];
const FOUR_ITS = ['面對它', '接受它', '處理它', '放下它'];
const SIT_METHODS = ['數息', '默照', '念佛', '其他'];
const OLD_DEDICATION = '願以此功德　莊嚴佛淨土\n上報四重恩　下濟三途苦\n若有見聞者　悉發菩提心\n盡此一報身　同生極樂國';
const DEFAULT_DEDICATION = '願以此功德　回向諸眾生\n解脫三界苦　皆發菩提心'; // 課誦本的回向偈（新Q11）
const BEADS = 108;
const VOICE_MODES = [['both', '錄音＋轉文字'], ['text', '只轉文字'], ['audio', '只錄音']];

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

/* ---------- 雲端同步（第二段）：存檔時記進待同步清單，有網路就送到 Apps Script ---------- */
const emptyQueue = () => ({ logs: [], diary: [], deletes: [], audio: [] });
let qChain = Promise.resolve();
function withQueue(fn) { // 待同步清單的讀寫排隊進行，避免互相蓋掉
  const run = qChain.then(async () => { const q = Object.assign(emptyQueue(), await kvGet('syncQueue', {})); const r = await fn(q); await kvSet('syncQueue', q); return r; });
  qChain = run.catch(() => {});
  return run;
}
/** 新增或修改一筆紀錄（logs／diary），並排進待同步 */
async function saveRec(store, obj, touch = true) {
  if (touch) obj.updatedAt = new Date().toISOString();
  await dbPut(store, obj);
  await withQueue(q => {
    if (!q[store].includes(obj.id)) q[store].push(obj.id);
    if (store === 'diary' && obj.audio && !obj.audioFileId && !q.audio.includes(obj.id)) q.audio.push(obj.id);
  });
  scheduleSync();
}
async function delRec(store, id) {
  await dbDel(store, id);
  await withQueue(q => {
    q[store] = q[store].filter(x => x !== id); q.audio = q.audio.filter(x => x !== id);
    q.deletes.push(store + ':' + id);
  });
  scheduleSync();
}
let syncTimer = null, syncing = false;
function scheduleSync() { clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(false), 1500); }
const getRec = (store, id) => req(store, 'readonly', s => s.get(id));
const stripAudio = ({ audio, ...rest }) => ({ ...rest, hasAudio: !!(audio || rest.audioFileId) });
const blobToB64 = blob => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });

async function syncPost(cfg, payload) {
  const r = await fetch(cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...payload, pass: cfg.pass }) });
  const j = await r.json().catch(() => ({ ok: false, error: '回應看不懂（HTTP ' + r.status + '）' }));
  if (!j.ok) throw new Error(j.error || '同步失敗');
  return j;
}
async function syncNow(manual) {
  const cfg = await kvGet('sync', {});
  if (!cfg.url || !cfg.pass) { if (manual) toast('還沒設定雲端同步（⚙ 設定 → 雲端同步）'); return false; }
  if (!navigator.onLine) { if (manual) toast('沒有網路，有網路時會自動同步'); return false; }
  if (syncing) return false;
  syncing = true;
  try {
    const q = Object.assign(emptyQueue(), await kvGet('syncQueue', {}));
    const logs = (await Promise.all(q.logs.map(id => getRec('logs', id)))).filter(Boolean);
    const diary = (await Promise.all(q.diary.map(id => getRec('diary', id)))).filter(Boolean).map(stripAudio);
    const dels = [...q.deletes];
    for (let i = 0; i < Math.max(logs.length, diary.length, dels.length); i += 100) {
      await syncPost(cfg, { action: 'push', logs: logs.slice(i, i + 100), diary: diary.slice(i, i + 100), deletes: dels.slice(i, i + 100) });
    }
    await withQueue(q2 => { // 只拿掉這次送出的，同步途中新增的留著下次送
      q2.logs = q2.logs.filter(id => !q.logs.includes(id));
      q2.diary = q2.diary.filter(id => !q.diary.includes(id));
      q2.deletes = q2.deletes.filter(d => !dels.includes(d));
    });
    for (const id of q.audio) {
      const rec = await getRec('diary', id);
      if (rec?.audio) {
        const res = await syncPost(cfg, { action: 'audio', id, mime: rec.audio.type || 'audio/webm', data: await blobToB64(rec.audio) });
        const cur = await getRec('diary', id);
        if (cur?.audio) { cur.audioFileId = res.fileId; await dbPut('diary', cur); }
      }
      await withQueue(q2 => { q2.audio = q2.audio.filter(x => x !== id); });
    }
    cfg.lastAt = new Date().toISOString(); cfg.lastError = '';
    await kvSet('sync', cfg);
    if (manual) toast(`已同步：紀錄 ${logs.length}、日記 ${diary.length}、錄音 ${q.audio.length}`);
    return true;
  } catch (err) {
    cfg.lastError = err.message; await kvSet('sync', cfg);
    if (manual) toast('同步失敗：' + err.message);
    return false;
  } finally {
    syncing = false;
    if (location.hash === '#settings') renderSyncStatus();
  }
}
async function pendingCount() {
  const q = Object.assign(emptyQueue(), await kvGet('syncQueue', {}));
  return q.logs.length + q.diary.length + q.deletes.length + q.audio.length;
}

/* ---------- 設定 ---------- */
let settings = null;
async function loadSettings() {
  settings = Object.assign({
    dedication: DEFAULT_DEDICATION, startDate: '', customSutras: [], customChants: [], customMoods: [],
    showDiamond: false, setOrder: null,
  }, await kvGet('settings', {}));
  if (settings.dedication === OLD_DEDICATION) settings.dedication = DEFAULT_DEDICATION; // 沒改過的舊預設換成課誦本的
}
const saveSettings = () => kvSet('settings', settings);
const allSutraItems = () => [...BUILTIN_SUTRAS, ...settings.customSutras];
const sutraItems = () => allSutraItems().filter(s => !s.hidden || (s.id === 'diamond' && settings.showDiamond));
/** 功課順序：[{id, on}]；新加入的自訂經典排在最後、預設不念（新Q20） */
function setOrder() {
  const base = settings.setOrder || BUILTIN_SUTRAS.filter(s => !s.hidden).map(s => ({ id: s.id, on: true }));
  const ids = new Set(sutraItems().map(s => s.id));
  const out = base.filter(x => ids.has(x.id));
  sutraItems().forEach(s => { if (!out.some(x => x.id === s.id)) out.push({ id: s.id, on: false }); });
  return out;
}
const setItems = () => setOrder().filter(x => x.on).map(x => sutraItems().find(s => s.id === x.id)).filter(Boolean);
const chantItems = () => [...BUILTIN_CHANTS, ...settings.customChants];
const moodList = () => [...BUILTIN_MOODS, ...settings.customMoods];
const findItem = id => [SET_ITEM, ...allSutraItems(), ...chantItems()].find(i => i.id === id);
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
let pageCleanup = null; // 離開頁面時要做的事（例如停止錄音）
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
function bells(n = 1, delay = 0) {
  const ctx = audio(); const t = ctx.currentTime + .05 + delay;
  for (let i = 0; i < n; i++) strike(t + i * 2.4);
}

/* ---------- 打坐流水聲（新Q6）：Wikimedia Commons 公有領域的淺溪錄音，頭尾交疊成無縫循環 ---------- */
let waterBuf = null, waterSrc = null, waterGain = null;
const waterLevel = v => Math.max(0.001, (v / 100) * 0.7); // 滑桿 0～100 → 音量
function seamless(ctx, b, fadeSec) {
  const F = Math.floor(fadeSec * b.sampleRate), L = b.length - F;
  const out = ctx.createBuffer(b.numberOfChannels, L, b.sampleRate);
  for (let ch = 0; ch < b.numberOfChannels; ch++) {
    const src = b.getChannelData(ch), dst = out.getChannelData(ch);
    dst.set(src.subarray(0, L));
    for (let i = 0; i < F; i++) { const x = i / F; dst[i] = src[i] * Math.sqrt(x) + src[L + i] * Math.sqrt(1 - x); }
  }
  return out;
}
async function startWater(vol) {
  try {
    const ctx = audio();
    if (!waterBuf) {
      const ab = await (await fetch('assets/river.ogg')).arrayBuffer();
      waterBuf = seamless(ctx, await ctx.decodeAudioData(ab), 1.5);
    }
    stopWater(0);
    waterGain = ctx.createGain();
    waterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    waterGain.gain.exponentialRampToValueAtTime(waterLevel(vol), ctx.currentTime + 2);
    waterSrc = ctx.createBufferSource(); waterSrc.buffer = waterBuf; waterSrc.loop = true;
    waterSrc.connect(waterGain).connect(ctx.destination); waterSrc.start();
    return true;
  } catch (e) { toast('流水聲無法播放：' + (e.message || e.name)); return false; }
}
function setWaterVol(v) { if (waterGain) waterGain.gain.setTargetAtTime(waterLevel(v), audio().currentTime, 0.1); }
function stopWater(sec = 3) {
  if (!waterSrc) return;
  const ctx = audio(), g = waterGain, s = waterSrc, now = ctx.currentTime;
  waterSrc = null; waterGain = null;
  if (sec > 0) {
    g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value, now); g.gain.linearRampToValueAtTime(0, now + sec);
    s.stop(now + sec + 0.1);
  } else s.stop();
}

/* ---------- 路由 ---------- */
const routes = {
  home: renderHome, sutra: renderSutra, chant: renderChant, sit: renderSit, diary: renderDiary, settings: renderSettings,
};
async function route() {
  const [name, ...rest] = (location.hash.slice(1) || 'home').split('/');
  const fn = routes[name] || renderHome;
  if (pageCleanup) { try { pageCleanup(); } catch (_) { /* 忽略 */ } pageCleanup = null; }
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
  const totalLines = [SET_ITEM, ...allSutraItems(), ...chantItems()].filter(i => tot[i.id]).map(i =>
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
    </div>
    <p class="small muted" id="homeSync" style="text-align:center"></p>`;
  kvGet('sync', {}).then(async cfg => {
    const el = $('#homeSync'); if (!el) return;
    const n = await pendingCount();
    el.textContent = !cfg.url ? '☁️ 雲端同步尚未設定（⚙ 設定）'
      : cfg.lastError ? `⚠️ 同步失敗：${cfg.lastError}（待同步 ${n} 筆）`
      : `☁️ ${cfg.lastAt ? '上次同步 ' + fmtTime(cfg.lastAt) : '還沒同步過'}${n ? `・待同步 ${n} 筆` : ''}`;
  });

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
// 經文裡的（合掌）（三稱）這類提示，用灰色小字（新Q14）
// 以全形空白分開的句子（課誦本的寫法）不在句子中間換行
const hintHtml = s => {
  const parts = s.split('　'), hint = x => esc(x).replace(/（[^（）]*）/g, m => `<span class="hint">${m}</span>`);
  return parts.map(ph => parts.length > 1 && ph.replace(/（[^）]*）/g, '').length <= 14 ? `<span class="ph">${hint(ph)}</span>` : hint(ph)).join('　');
};
function sutraBody(s) {
  const t = s.text && window.SUTRA_TEXTS?.[s.text];
  if (!t) return `<h2>${esc(s.name)}</h2><p class="muted">這部沒有內建經文，請用自己的經本念。</p>`;
  return `<h2>${esc(t.title)}</h2>${t.translator ? `<div class="by">${esc(t.translator)}</div>` : ''}
    <div class="${s.text === 'dabei' ? 'mantra' : ''}">${t.paragraphs.map(p => `<p${p.includes('（') ? ' class="has-hint"' : ''}>${hintHtml(p)}</p>`).join('')}</div>`;
}
function sutraSource(t) {
  return `經文依據：${esc(t.source)}${t.cbeta ? '（CBETA 中華電子佛典協會，CC BY-NC-SA 3.0 TW）' : ''}。${t.note ? `<br>附註：${esc(t.note)}` : ''}`;
}
async function fontButtons() {
  const size = await kvGet('fontSize', 20);
  return { size, html: `<button class="btn" data-fs="-2" aria-label="字變小">A−</button><button class="btn" data-fs="2" aria-label="字變大">A＋</button>` };
}

async function renderSutra(id) {
  if (id === 'set') return renderSet();
  if (id) return renderSutraReader(id);
  setTitle('念經');
  const logs = (await dbAll('logs')).filter(counted);
  const tot = {}, todayN = {};
  logs.filter(l => l.type === 'sutra' || l.type === 'set').forEach(l => {
    tot[l.itemId] = (tot[l.itemId] || 0) + l.count;
    if (dayKey(l.at) === todayKey()) todayN[l.itemId] = (todayN[l.itemId] || 0) + l.count;
  });
  const run = await kvGet('setRun', null);
  const items = setItems();
  const runName = run && items.find(i => i.id === run.at)?.name;
  view.innerHTML = `
    <div class="card">
      <h2>📿 整套功課</h2>
      <p class="small muted" style="margin-top:0">${items.length ? items.map(i => esc(i.name)).join(' → ') : '（還沒有勾選任何一項，請到 ⚙ 設定 →「功課內容與順序」）'}</p>
      ${runName ? `<p class="small" style="margin:0 0 8px">⏸ 上次念到「${esc(runName)}」</p>` : ''}
      <button class="btn primary big" data-a="set" ${items.length ? '' : 'disabled'}>${runName ? '繼續功課' : '開始功課'}</button>
      <p class="small muted" style="margin-bottom:0">累積完整功課 ${fmtNum(tot.set || 0)} 次${todayN.set ? `・今天 ${todayN.set} 次` : ''}。順序可以在 ⚙ 設定 →「功課內容與順序」調整。</p>
    </div>
    <div class="card"><h2>單念一部</h2><ul class="list">${sutraItems().map(s => `
    <li><button class="item-btn" data-id="${esc(s.id)}">
      <span><span class="name">${esc(s.name)}</span><br><span class="sub">${s.part ? '功課的一部分（單念不記遍數）' : s.text && window.SUTRA_TEXTS?.[s.text] ? '有經文' : '自訂'}${todayN[s.id] ? `・今天 ${todayN[s.id]} ${esc(s.unit)}` : ''}</span></span>
      <span class="sub">${s.part ? '' : `累積 ${fmtNum(tot[s.id] || 0)} ${esc(s.unit)} `}›</span>
    </button></li>`).join('')}</ul></div>
    <p class="muted small">要加其他經典：右上角 ⚙ 設定 →「自訂經典」。</p>`;
  view.onclick = e => {
    if (e.target.closest('[data-a="set"]')) { location.hash = 'sutra/set'; return; }
    const b = e.target.closest('.item-btn'); if (b) location.hash = `sutra/${encodeURIComponent(b.dataset.id)}`;
  };
}

async function renderSutraReader(id) {
  view.onclick = null;
  const s = sutraItems().find(x => x.id === id);
  if (!s) { location.hash = 'sutra'; return; }
  setTitle(s.name);
  const t = s.text && window.SUTRA_TEXTS?.[s.text];
  const fb = await fontButtons();
  view.innerHTML = `
    <div class="sutra-head">
      <button class="btn" onclick="location.hash='sutra'">‹ 返回</button>
      <span class="grow"></span>${t ? fb.html : ''}
    </div>
    <div class="sutra-text" id="stext" style="font-size:${fb.size}px">${sutraBody(s)}</div>
    ${t ? `<div class="sutra-src">${sutraSource(t)}</div>` : ''}
    ${s.part ? `<p class="small muted" style="text-align:center">這一項是整套功課的一部分，單念不另外記遍數。</p>` : `
    <div class="sticky-bottom">
      <div class="stepper"><button data-st="-1" aria-label="減一">−</button><input id="cnt" type="number" inputmode="numeric" min="1" value="1"><button data-st="1" aria-label="加一">＋</button></div>
      <span class="small muted">${esc(s.unit)}</span>
      <button class="btn primary grow" id="done">完成</button>
    </div>`}`;
  let fs = fb.size;
  view.onclick = async e => {
    const f = e.target.closest('[data-fs]');
    if (f) { fs = Math.min(36, Math.max(14, fs + Number(f.dataset.fs))); $('#stext').style.fontSize = fs + 'px'; kvSet('fontSize', fs); return; }
    const st = e.target.closest('[data-st]');
    if (st) { const c = $('#cnt'); c.value = Math.max(1, (parseInt(c.value, 10) || 1) + Number(st.dataset.st)); return; }
    if (e.target.id === 'done') {
      const n = parseInt($('#cnt').value, 10);
      if (!(n > 0)) { toast('請輸入遍數'); return; }
      if (!await dedicate(`${s.name} ${n} ${s.unit}`)) return;
      await saveRec('logs', { id: uid(), type: 'sutra', itemId: s.id, name: s.name, unit: s.unit, count: n, dedicated: true, at: new Date().toISOString() });
      toast(`已記錄：${s.name} ${n} ${s.unit} 🙏`);
      $('#cnt').value = 1;
    }
  };
}

/* 整套功課（新Q3、新Q15～新Q17）：一路往下念；念到回向偈按「迴向」；最後按「完成這套功課」才記錄 */
function askResume(name) {
  return new Promise(resolve => {
    const card = openModal(`
      <h3>上次的功課還沒念完</h3>
      <p>要從「${esc(name)}」繼續嗎？</p>
      <div class="modal-actions"><button class="btn" data-a="restart">從頭開始</button><button class="btn primary" data-a="go">繼續</button></div>`);
    card.onclick = e => { const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; closeModal(); resolve(a === 'go'); };
  });
}
async function renderSet() {
  view.onclick = null;
  const items = setItems();
  if (!items.length) { toast('功課還沒有勾選任何一項'); location.hash = 'sutra'; return; }
  setTitle('整套功課');
  let run = await kvGet('setRun', null);
  let startIdx = run ? items.findIndex(i => i.id === run.at) : -1;
  if (run && startIdx > 0 && !await askResume(items[startIdx].name)) { run = null; startIdx = 0; }
  if (!run) { run = { id: uid(), start: new Date().toISOString(), at: items[0].id, dedicated: false }; startIdx = 0; }
  if (startIdx < 0) { startIdx = 0; run.at = items[0].id; }
  await kvSet('setRun', run);
  const fb = await fontButtons();
  const srcs = [...new Set(items.map(s => window.SUTRA_TEXTS?.[s.text]?.source).filter(Boolean))];
  view.innerHTML = `
    <div class="sutra-head">
      <button class="btn" data-a="leave">‹ 先離開</button>
      <span class="grow"></span>${fb.html}
    </div>
    <div class="sutra-text" id="stext" style="font-size:${fb.size}px">
      ${items.map((s, i) => `<section class="set-sec" data-i="${i}">
        <div class="set-no">${i + 1} / ${items.length}</div>
        ${sutraBody(s)}
        ${s.dedication ? `<div class="ded-inline" id="dedBox">${run.dedicated ? '<span class="tag">🙏 已迴向</span>' : '<button class="btn primary" data-a="ded">🙏 迴向</button>'}</div>` : ''}
      </section>`).join('')}
      <div class="set-end"><button class="btn primary big" data-a="finish">完成這套功課</button></div>
    </div>
    <div class="sutra-src">經文依據：${srcs.map(esc).join('；')}。</div>
    <div class="sticky-bottom set-bar">
      <span id="setPos" class="small grow"></span>
      <button class="btn" data-a="next">下一項 ↓</button>
    </div>`;
  keepAwake(true);
  const secs = $$('.set-sec');
  let cur = startIdx, saveT = null;
  const showPos = () => { $('#setPos').textContent = `第 ${cur + 1}/${items.length} 項・${items[cur].name}`; };
  const onScroll = () => {
    const line = innerHeight * 0.35;
    let i = 0;
    secs.forEach((el, k) => { if (el.getBoundingClientRect().top < line) i = k; });
    if (i !== cur) {
      cur = i; showPos();
      clearTimeout(saveT); saveT = setTimeout(() => { run.at = items[cur].id; kvSet('setRun', run); }, 400);
    }
  };
  showPos();
  window.addEventListener('scroll', onScroll, { passive: true });
  pageCleanup = () => { window.removeEventListener('scroll', onScroll); clearTimeout(saveT); keepAwake(false); };
  if (startIdx > 0) setTimeout(() => secs[startIdx].scrollIntoView(), 60); // route() 會先捲到最上面
  let fs = fb.size;
  view.onclick = async e => {
    const f = e.target.closest('[data-fs]');
    if (f) { fs = Math.min(36, Math.max(14, fs + Number(f.dataset.fs))); $('#stext').style.fontSize = fs + 'px'; kvSet('fontSize', fs); return; }
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'leave') { location.hash = 'sutra'; return; }
    if (a === 'next') { const nx = secs[Math.min(cur + 1, secs.length - 1)]; (cur + 1 < secs.length ? nx : $('.set-end')).scrollIntoView({ behavior: 'smooth' }); return; }
    if (a === 'ded') {
      run.dedicated = true; await kvSet('setRun', run);
      $('#dedBox').innerHTML = '<span class="tag">🙏 已迴向</span>'; toast('已迴向 🙏'); return;
    }
    if (a === 'finish') {
      if (cur < items.length - 1 && !confirm('還沒念到最後一項，確定完成這套功課？')) return;
      if (!run.dedicated && !await dedicate('整套功課')) return;
      const at = new Date().toISOString();
      await saveRec('logs', { id: uid(), type: 'set', itemId: 'set', name: SET_ITEM.name, unit: SET_ITEM.unit, count: 1, items: items.map(i => i.id), setId: run.id, dedicated: true, at });
      // 記遍數的經典各加一遍（新Q16）
      for (const s of items.filter(i => !i.part)) {
        await saveRec('logs', { id: uid(), type: 'sutra', itemId: s.id, name: s.name, unit: s.unit, count: 1, setId: run.id, dedicated: true, at });
      }
      await kvDel('setRun');
      toast('完成一套功課 🙏');
      location.hash = 'sutra';
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
      await saveRec('logs', { id: uid(), type: 'chant', itemId: c.id, name: c.name, unit: c.unit, count: n, dedicated: true, at: new Date().toISOString() });
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
  const p = Object.assign({ mode: 'down', minutes: 20, interval: false, intervalMin: 10, water: false, waterVol: 50 }, await kvGet('sitPrefs', {}));
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
      <h2 style="margin-top:16px">流水聲</h2>
      <div class="row"><label class="switch"><input type="checkbox" id="waterOn" ${p.water ? 'checked' : ''}> 🌊 播放溪流水聲</label>
        <button class="btn" id="waterTry">試聽</button></div>
      <label class="row small" style="gap:8px;margin-top:6px">音量 <input type="range" id="waterVol" min="5" max="100" value="${p.waterVol}" class="grow"></label>
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
  let trying = false;
  pageCleanup = () => { if (trying) stopWater(0.5); };
  $('#waterVol').oninput = e => { p.waterVol = Number(e.target.value); setWaterVol(p.waterVol); };
  view.onclick = async e => {
    const md = e.target.closest('[data-mode]'); if (md) { p.mode = md.dataset.mode; refresh(); }
    const pm = e.target.closest('[data-min]'); if (pm) { p.minutes = Number(pm.dataset.min); $('#customMin').value = ''; refresh(); }
    if (e.target.id === 'waterTry') {
      if (trying) { stopWater(1); trying = false; e.target.textContent = '試聽'; }
      else if (await startWater(p.waterVol)) { trying = true; e.target.textContent = '停止試聽'; }
      return;
    }
    if (e.target.id === 'start') {
      p.interval = $('#intOn').checked;
      p.intervalMin = Math.max(1, parseInt($('#intMin').value, 10) || 10);
      p.water = $('#waterOn').checked;
      if (p.mode === 'down' && !(p.minutes > 0)) { toast('請選時間'); return; }
      await kvSet('sitPrefs', p);
      const r = { start: Date.now(), mode: p.mode, minutes: p.minutes, interval: p.interval, intervalMin: p.intervalMin, rung: 0, water: p.water, waterVol: p.waterVol };
      trying = false;
      if (p.water) await startWater(p.waterVol); else stopWater(0.5);
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
      ${r.water ? `<label class="row small water-ctl">🌊 <input type="range" id="waterVol2" min="5" max="100" value="${r.waterVol}" aria-label="流水聲音量"></label>` : ''}
      <button class="btn" id="stop">${r.mode === 'down' ? '提前下坐' : '下坐'}</button>
    </div>`;
  if (r.water) {
    if (!waterSrc) startWater(r.waterVol); // 重新打開 App 時接著播（被瀏覽器擋住的話，動一下音量就會播）
    $('#waterVol2').oninput = e => { r.waterVol = Number(e.target.value); if (!waterSrc) startWater(r.waterVol); else setWaterVol(r.waterVol); kvSet('sitRun', r); };
  }
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
    const fade = waterSrc ? 3 : 0; // 流水聲先 3 秒淡出，再響引磬
    stopWater(fade);
    if (ring) bells(3, fade);
    keepAwake(false);
    const minutes = Math.round(sec / 60 * 10) / 10;
    const info = await sitForm(minutes);
    if (info && await dedicate(`打坐 ${fmtMinutes(minutes)}`)) {
      await saveRec('logs', { id: uid(), type: 'sit', itemId: 'sit', name: '打坐', unit: '分', minutes, seconds: Math.round(sec), mode: r.mode, method: info.method, note: info.note, dedicated: true, at: new Date(r.start).toISOString() });
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
    <p class="small muted">寫日記時可以按 🎤 用說的：錄音＋轉成文字。</p>
    ${list.length ? Object.entries(groups).map(([k, rs]) => `
      <div class="day-head">${fmtDay(k)}・${rs.length} 篇${settings.startDate && k < settings.startDate ? '（測試期間）' : ''}</div>
      ${rs.map(r => `<div class="card">
        ${r.text ? `<div class="entry">${esc(r.text)}</div>` : ''}
        ${r.audio ? `<audio controls preload="none" data-blob="${r.id}" style="width:100%;margin-top:6px"></audio>` : r.audioFileId ? '<div class="small muted">🎧 錄音存在雲端硬碟</div>' : ''}
        <div style="margin-top:6px">${(r.moods || []).map(m => `<span class="tag">${esc(m)}</span>`).join('')}${r.fourIt ? `<span class="tag">🪷 ${esc(r.fourIt)}</span>` : ''}</div>
        <div class="entry-meta"><span>${fmtTime(r.at)}・${r.share ? '🤝 給小輝看' : '🔒 只有自己'}</span>
          <span><button class="link-btn" data-edit="${r.id}">編輯</button><button class="link-btn" data-del="${r.id}">刪除</button></span></div>
      </div>`).join('')}`).join('') : '<div class="empty">還沒有日記</div>'}`;
  const urls = [];
  $$('audio[data-blob]').forEach(a => { const rec = list.find(x => x.id === a.dataset.blob); if (rec?.audio) { const u = URL.createObjectURL(rec.audio); urls.push(u); a.src = u; } });
  pageCleanup = () => urls.forEach(u => URL.revokeObjectURL(u));
  view.onclick = async e => {
    const ed = e.target.closest('[data-edit]'); if (ed) { location.hash = `diary/edit/${ed.dataset.edit}`; return; }
    const del = e.target.closest('[data-del]');
    if (del && confirm('確定刪除這篇日記？刪了就找不回來（除非有匯出備份）。')) { await delRec('diary', del.dataset.del); renderDiary(); toast('已刪除'); }
  };
}

async function renderDiaryForm(id) {
  view.onclick = null;
  const old = id ? (await dbAll('diary')).find(r => r.id === id) : null;
  const r = old ? { ...old, moods: [...(old.moods || [])] } : { id: uid(), text: '', moods: [], fourIt: '', share: false, at: new Date().toISOString() };
  setTitle(old ? '編輯日記' : '寫日記');
  const draft = !old ? await kvGet('diaryDraft', '') : '';
  let vmode = await kvGet('voiceMode', 'both');
  view.innerHTML = `
    <div class="card">
      <label class="field"><span>${old ? fmtDay(dayKey(r.at)) + ' ' + fmtTime(r.at) : '今天的心情'}</span><textarea id="txt" placeholder="今天發生了什麼？心裡有什麼感受？（也可以按下面的 🎤 用說的）">${esc(old ? r.text : draft)}</textarea></label>
      <div class="voice">
        <button class="btn" id="micBtn">🎤 用說的</button>
        <div class="chips small" id="vmode">${VOICE_MODES.map(([v, l]) => `<button class="chip ${vmode === v ? 'on' : ''}" data-vmode="${v}">${l}</button>`).join('')}</div>
        <div id="interim" class="small muted"></div>
        <div id="audioBox" class="small"></div>
      </div>
      <p class="small muted" style="margin:14px 0 6px">心情（可複選）</p>
      <div class="chips" id="moods">${moodList().map(m => `<button class="chip ${r.moods.includes(m) ? 'on' : ''}" data-mood="${esc(m)}">${esc(m)}</button>`).join('')}</div>
      <p class="small muted" style="margin:14px 0 6px">四它：這件事我正在…</p>
      <div class="chips" id="four">${FOUR_ITS.map(f => `<button class="chip ${r.fourIt === f ? 'on' : ''}" data-four="${f}">${f}</button>`).join('')}</div>
      <label class="switch" style="margin-top:12px"><input type="checkbox" id="share" ${r.share ? 'checked' : ''}> 給小輝看</label>
      <p class="small muted" style="margin:0">勾了以後，這篇的文字會寫進每週的「修行週摘要」，放在 34 專案資料夾（公司筆電也看得到）。錄音不會放進去。</p>
    </div>
    <div class="row"><button class="btn" data-a="cancel">取消</button><button class="btn primary grow" id="save">儲存</button></div>`;
  const txt = $('#txt');
  const saveDraft = () => { if (!old) kvSet('diaryDraft', txt.value); };
  txt.oninput = saveDraft;

  // ---- 語音：錄音（MediaRecorder）＋轉文字（Web Speech API） ----
  let audioBlob = r.audio || null, audioChanged = false, objUrl = null;
  let recorder = null, stream = null, recog = null, recording = false, recogFailed = false;
  const showAudio = () => {
    if (objUrl) URL.revokeObjectURL(objUrl);
    objUrl = audioBlob ? URL.createObjectURL(audioBlob) : null;
    $('#audioBox').innerHTML = audioBlob
      ? `<audio controls src="${objUrl}" style="width:100%;margin-top:8px"></audio><button class="link-btn" data-a="rmAudio">刪除這段錄音</button>`
      : r.audioFileId ? '🎧 這篇的錄音存在雲端硬碟（這支手機沒有副本）' : '';
  };
  const setMicUi = () => {
    const b = $('#micBtn'); if (!b) return;
    b.textContent = recording ? '⏹ 說完了' : '🎤 用說的';
    b.classList.toggle('primary', recording);
  };
  const note = msg => { const el = $('#interim'); if (el) el.textContent = msg; };
  const micErr = e => ({ NotAllowedError: '麥克風權限沒有允許。', NotFoundError: '找不到麥克風。', NotReadableError: '麥克風被別的 App 佔用中（例如通話、錄音）。' }[e.name]
    || '無法使用麥克風：' + (e.message || e.name));
  const appendText = t => {
    t = t.trim(); if (!t) return;
    const v = txt.value;
    const sep = !v || /[\s，。！？、；：,.!?]$/.test(v) ? '' : '，';
    txt.value = v + sep + t; saveDraft();
  };
  const startRecog = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { note(vmode === 'text' ? '這支手機不支援語音轉文字' : '這支手機不支援語音轉文字，這次只錄音'); return; }
    recogFailed = false;
    recog = new SR(); recog.lang = 'zh-TW'; recog.continuous = true; recog.interimResults = true;
    recog.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) appendText(t); else interim += t;
      }
      note(interim ? '…' + interim : '');
    };
    recog.onerror = e => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      recogFailed = true;
      note({ network: '沒有網路，無法轉文字（錄音照常）', 'not-allowed': '沒有麥克風權限', 'service-not-allowed': '這支手機不允許語音轉文字',
        'audio-capture': '麥克風被錄音佔用，無法同時轉文字。可以把模式改成「只轉文字」或「只錄音」' }[e.error] || '轉文字發生問題：' + e.error);
    };
    recog.onend = () => { if (recording && !recogFailed) { try { recog.start(); } catch (_) { /* 已在跑 */ } } };
    try { recog.start(); } catch (e) { note('轉文字無法開始：' + e.message); }
  };
  // 10/21：Justin 從主畫面 App 按了沒反應、也沒跳權限視窗 → 一按就顯示狀態，卡住或被封鎖時說明怎麼開
  const MIC_HELP = '請打開麥克風權限：用 Chrome 開 justin-n8n.github.io/xiuxing → 網址列左邊的圖示 → 權限 → 麥克風 →「允許」。'
    + '如果還是不行：手機的「設定 → 應用程式 → Chrome → 權限 → 麥克風」也要允許。改完把這個 App 關掉重開。';
  const micFail = msg => {
    const el = $('#interim'); if (el) el.innerHTML = `<div class="mic-help">⚠️ ${esc(msg)}<br>${esc(MIC_HELP)}</div>`;
  };
  let starting = false;
  const startVoice = async () => {
    if (starting) return;
    if (vmode !== 'text' && audioBlob && !confirm('要重錄嗎？原本的錄音會被取代。')) return;
    if (!navigator.mediaDevices?.getUserMedia) { micFail('這個瀏覽器不能使用麥克風。'); return; }
    try { // 已經被封鎖的話，Chrome 不會再跳視窗，直接說明
      const st = await navigator.permissions?.query({ name: 'microphone' });
      if (st?.state === 'denied') { micFail('麥克風權限被封鎖了，所以不會跳出詢問視窗。'); return; }
    } catch (_) { /* 有些瀏覽器不支援查詢，直接試 */ }
    starting = true;
    const b = $('#micBtn'); if (b) { b.textContent = '⏳ 正在開啟麥克風…'; b.disabled = true; }
    note('正在開啟麥克風…（如果跳出詢問，請按「允許」）');
    const slow = setTimeout(() => {
      if (!starting) return;
      starting = false; if (b) { b.disabled = false; b.textContent = '🎤 再試一次'; }
      micFail('5 秒了麥克風還沒有回應，可能是權限視窗沒有顯示出來。');
    }, 5000);
    const done = () => { starting = false; clearTimeout(slow); if (b) b.disabled = false; setMicUi(); };
    if (vmode === 'text') {
      // 只轉文字：先拿一次麥克風權限（拿到就放掉），才知道權限有沒有問題
      try { const s0 = await navigator.mediaDevices.getUserMedia({ audio: true }); s0.getTracks().forEach(t => t.stop()); }
      catch (e) { done(); micFail(micErr(e)); return; }
    }
    if (vmode !== 'text') {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => window.MediaRecorder?.isTypeSupported?.(t));
        recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        const chunks = [];
        recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
        recorder.onstop = () => {
          audioBlob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }); audioChanged = true;
          stream.getTracks().forEach(t => t.stop()); stream = null; showAudio();
        };
        recorder.start(1000);
      } catch (e) { done(); micFail(micErr(e)); return; }
    }
    done();
    recording = true; setMicUi(); note('請說…');
    if (vmode !== 'audio') startRecog();
    keepAwake(true);
  };
  const stopVoice = () => {
    if (!recording) return;
    recording = false;
    try { recog?.stop(); } catch (_) { /* 已停 */ }
    recog = null;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    recorder = null; setMicUi(); keepAwake(false);
    setTimeout(() => { if (!recording && !recogFailed) note(''); }, 1500);
  };
  pageCleanup = () => { stopVoice(); if (objUrl) URL.revokeObjectURL(objUrl); };
  showAudio();

  view.onclick = async e => {
    if (e.target.id === 'micBtn') { recording ? stopVoice() : startVoice(); return; }
    const vm = e.target.closest('[data-vmode]');
    if (vm) {
      if (recording) { toast('先按「說完了」再換模式'); return; }
      vmode = vm.dataset.vmode; kvSet('voiceMode', vmode);
      $$('#vmode .chip').forEach(b => b.classList.toggle('on', b.dataset.vmode === vmode)); return;
    }
    const m = e.target.closest('[data-mood]');
    if (m) { const v = m.dataset.mood; r.moods = r.moods.includes(v) ? r.moods.filter(x => x !== v) : [...r.moods, v]; m.classList.toggle('on'); return; }
    const f = e.target.closest('[data-four]');
    if (f) { r.fourIt = r.fourIt === f.dataset.four ? '' : f.dataset.four; $$('#four .chip').forEach(b => b.classList.toggle('on', b.dataset.four === r.fourIt)); return; }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'rmAudio' && confirm('刪除這段錄音？')) { audioBlob = null; audioChanged = true; showAudio(); return; }
    if (a === 'cancel') { stopVoice(); history.back(); return; }
    if (e.target.id === 'save') {
      stopVoice();
      await new Promise(res => setTimeout(res, 300)); // 等錄音收尾
      r.text = txt.value.trim(); r.share = $('#share').checked;
      if (!r.text && !audioBlob) { toast('還沒有寫內容或錄音'); return; }
      if (audioChanged) { r.audio = audioBlob; r.audioFileId = ''; }
      await saveRec('diary', r);
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
      <h2>功課內容與順序</h2>
      <p class="small muted" style="margin-top:0">勾選「整套功課」要念哪幾項，用 ↑ ↓ 調整順序。自訂經典加入後會出現在最下面（預設不勾）。</p>
      <ul class="list" id="setOrder">${setOrder().map((x, i, arr) => { const s = sutraItems().find(y => y.id === x.id); return `
        <li class="row" style="padding:6px 0"><label class="switch grow" style="margin:0"><input type="checkbox" data-son="${esc(x.id)}" ${x.on ? 'checked' : ''}> ${esc(s.name)}</label>
          <button class="btn" data-mv="${i}:-1" ${i ? '' : 'disabled'} aria-label="往上">↑</button><button class="btn" data-mv="${i}:1" ${i < arr.length - 1 ? '' : 'disabled'} aria-label="往下">↓</button></li>`; }).join('')}</ul>
      <div class="row" style="margin-top:8px"><button class="btn" id="setReset">恢復課誦本順序</button></div>
      <label class="switch" style="margin-top:12px"><input type="checkbox" id="showDiamond" ${settings.showDiamond ? 'checked' : ''}> 顯示金剛經（CBETA 版，可單念、可加進功課）</label>
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
      <h2>雲端同步（存到你的 Google 雲端硬碟）</h2>
      <p class="small muted" style="margin-top:0">照 34 專案的「雲端同步_設定步驟」部署 Apps Script 後，把網址和你自己設定的密語填在這裡。每次存檔都會自動同步，沒網路時等有網路再送。</p>
      <label class="field"><span>Apps Script 網址</span><input type="text" id="syncUrl" inputmode="url" autocomplete="off" placeholder="https://script.google.com/macros/s/…/exec"></label>
      <label class="field"><span>密語（和 Apps Script 裡設定的一樣）</span><input type="password" id="syncPass" autocomplete="off"></label>
      <div class="row"><button class="btn primary" id="syncSave">儲存並測試</button><button class="btn" id="syncNowBtn">立即同步</button><button class="btn" id="syncPull">從雲端還原</button></div>
      <div id="syncStatus" class="small" style="margin-top:10px"></div>
    </div>
    <div class="card">
      <h2>備份</h2>
      <p class="small muted" style="margin-top:0">還沒開雲端同步前，資料只存在這支手機，建議每週匯出一次，存到雲端硬碟的私人資料夾（不要放進專案資料夾）。備份檔不含錄音。</p>
      <div class="row"><button class="btn primary" id="export">匯出備份</button><label class="btn" style="display:inline-flex;align-items:center">匯入備份<input type="file" id="import" accept="application/json,.json" hidden></label></div>
    </div>
    <p class="small muted">修行紀錄 v${APP_VERSION}・34.修行紀錄App。經文依《佛教朝暮課誦本》與法鼓文化《觀音法門》，僅供個人修行使用；金剛經為 CBETA（CC BY-NC-SA 3.0 TW）。流水聲：Wikimedia Commons 公有領域錄音。</p>`;

  view.onchange = async e => {
    const son = e.target.dataset?.son;
    if (son) { const o = setOrder(); o.find(x => x.id === son).on = e.target.checked; settings.setOrder = o; await saveSettings(); return; }
    if (e.target.id === 'showDiamond') { settings.showDiamond = e.target.checked; await saveSettings(); renderSettings(); }
  };
  view.onclick = async e => {
    const mv = e.target.closest('[data-mv]')?.dataset.mv;
    if (mv) {
      const [i, d] = mv.split(':').map(Number), o = setOrder();
      [o[i], o[i + d]] = [o[i + d], o[i]]; settings.setOrder = o; await saveSettings(); renderSettings(); return;
    }
    if (e.target.id === 'setReset' && confirm('恢復成課誦本的 9 項與順序？')) { settings.setOrder = null; await saveSettings(); renderSettings(); return; }
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
    if (e.target.id === 'syncSave') {
      const cfg = await kvGet('sync', {});
      const url = $('#syncUrl').value.trim(), pass = $('#syncPass').value;
      if (url && !/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) { toast('網址要是 https://script.google.com/…/exec'); return; }
      Object.assign(cfg, { url, pass: pass || cfg.pass || '' });
      if (!url) { cfg.pass = ''; await kvSet('sync', cfg); toast('已關閉雲端同步'); renderSyncStatus(); return; }
      await kvSet('sync', cfg); $('#syncPass').value = '';
      try { const j = await syncPost(cfg, { action: 'ping' }); toast('連線成功：' + (j.message || 'ok')); await enqueueAll(); syncNow(true); }
      catch (err) { toast('連線失敗：' + err.message); }
      renderSyncStatus();
    }
    if (e.target.id === 'syncNowBtn') { await syncNow(true); renderSyncStatus(); }
    if (e.target.id === 'syncPull') pullFromCloud();
  };
  $('#import').onchange = e => importData(e.target.files[0]);
  const cfg = await kvGet('sync', {});
  $('#syncUrl').value = cfg.url || '';
  $('#syncPass').placeholder = cfg.pass ? '（已設定，不用重填）' : '';
  renderSyncStatus();
}

async function renderSyncStatus() {
  const el = $('#syncStatus'); if (!el) return;
  const cfg = await kvGet('sync', {}), n = await pendingCount();
  el.innerHTML = !cfg.url ? '<span class="muted">尚未設定</span>'
    : `${cfg.lastAt ? `上次同步：${fmtDay(dayKey(cfg.lastAt))} ${fmtTime(cfg.lastAt)}` : '還沒同步過'}・待同步 ${n} 筆`
      + (cfg.lastError ? `<br><span style="color:#b2463a">上次失敗：${esc(cfg.lastError)}</span>` : '');
}

/** 第一次接上雲端時，把手機上已有的紀錄全部排進待同步 */
async function enqueueAll() {
  const [logs, diary] = await Promise.all([dbAll('logs'), dbAll('diary')]);
  await withQueue(q => {
    logs.forEach(l => { if (!q.logs.includes(l.id)) q.logs.push(l.id); });
    diary.forEach(d => {
      if (!q.diary.includes(d.id)) q.diary.push(d.id);
      if (d.audio && !d.audioFileId && !q.audio.includes(d.id)) q.audio.push(d.id);
    });
  });
}

/** 從雲端還原：換手機或清掉資料時用；同一筆以比較新的為準，錄音留在雲端硬碟 */
async function pullFromCloud() {
  const cfg = await kvGet('sync', {});
  if (!cfg.url) { toast('還沒設定雲端同步'); return; }
  if (!confirm('從雲端硬碟把紀錄與日記抓回這支手機？\n同一筆以比較新的為準，這支手機上較新的不會被蓋掉。')) return;
  try {
    const j = await syncPost(cfg, { action: 'pull' });
    let n = 0;
    for (const [store, rows] of [['logs', j.logs || []], ['diary', j.diary || []]]) {
      for (const rec of rows) {
        const cur = await getRec(store, rec.id);
        if (!cur || (rec.updatedAt || rec.at) > (cur.updatedAt || cur.at)) {
          delete rec.hasAudio; if (cur?.audio) rec.audio = cur.audio;
          await dbPut(store, rec); n++;
        }
      }
    }
    toast(`還原完成：更新 ${n} 筆`);
  } catch (err) { toast('還原失敗：' + err.message); }
}

function applyTheme() {
  let t = 'auto'; try { t = localStorage.getItem('theme') || 'auto'; } catch (e) { /* 無法讀就用預設 */ }
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

async function exportData() {
  // 錄音檔太大，不放進備份檔（有開雲端同步的話，錄音在雲端硬碟）
  const data = { app: 'xiuxing', version: APP_VERSION, exportedAt: new Date().toISOString(), settings, logs: await dbAll('logs'), diary: (await dbAll('diary')).map(stripAudio) };
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
    for (const l of data.logs || []) await saveRec('logs', l, false);
    for (const d of data.diary || []) await saveRec('diary', d, false);
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
  window.addEventListener('online', () => syncNow(false));
  setTimeout(() => syncNow(false), 2000);
})();

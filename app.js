/* 修行紀錄 App（34.修行紀錄App）：念經與功課、佛號、打坐（流水聲）、日記（語音）、抄經（描紅）、首頁、迴向、離線、雲端同步 */
'use strict';

const APP_VERSION = '0.7.1';

/* ---------- 診斷模式（10/21：手機設定頁點不動）：網址加 ?diag 才會出現，畫面上方顯示手指點到什麼、有沒有錯誤 ---------- */
(function diag() {
  let on = /[?&]diag\b/.test(location.search);
  try { if (on) sessionStorage.setItem('diag', '1'); on = on || sessionStorage.getItem('diag') === '1'; } catch (_) { /* 無法存就只看網址 */ }
  if (!on) return;
  const lines = [];
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:4px;right:4px;top:4px;z-index:99999;background:rgba(0,0,0,.82);color:#9f9;font:11px/1.35 monospace;padding:6px;border-radius:6px;pointer-events:none;white-space:pre-wrap;max-height:55vh;overflow:hidden';
  const name = el => !el ? 'null' : el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : '');
  const log = s => { lines.push(s); while (lines.length > 20) lines.shift(); box.textContent = `診斷 v${APP_VERSION}｜${innerWidth}×${innerHeight}｜${location.hash}\n` + lines.join('\n'); };
  const add = () => { if (!box.isConnected) document.body.appendChild(box); };
  document.addEventListener('DOMContentLoaded', add); setTimeout(add, 0);
  addEventListener('error', e => log('❌ 錯誤：' + (e.message || e.error)));
  addEventListener('unhandledrejection', e => log('❌ 未處理：' + (e.reason?.message || e.reason)));
  for (const t of ['pointerdown', 'click', 'focusin']) {
    document.addEventListener(t, e => {
      const p = e.touches?.[0] || e;
      const stack = p.clientX != null ? document.elementsFromPoint(p.clientX, p.clientY).slice(0, 3).map(name).join(' > ') : '';
      log(`${t} 目標=${name(e.target)}${stack ? '｜點到=' + stack : ''}${e.defaultPrevented ? '｜被擋' : ''}`);
    }, true);
  }
  setTimeout(() => log(`啟動：${typeof settings !== 'undefined' && settings ? '設定已載入' : '⚠️ 設定沒載入（資料庫卡住？）'}｜SW=${navigator.serviceWorker?.controller ? '有' : '無'}`), 3000);
  // v0.6.2：點了之後發生什麼——失去焦點、打字、畫面大小（鍵盤）、畫面重畫、勾選框有沒有真的變
  document.addEventListener('focusout', e => log(`focusout ${name(e.target)} → ${name(e.relatedTarget)}`), true);
  document.addEventListener('input', e => log(`input ${name(e.target)} 長度=${(e.target.value || '').length}${e.target.type === 'checkbox' ? ' 勾=' + e.target.checked : ''}`), true);
  document.addEventListener('click', e => {
    const t = e.target;
    if (t.type === 'checkbox') { const before = t.checked; setTimeout(() => log(`勾選框 ${name(t)} 點完=${before} → 0.3 秒後=${t.isConnected ? t.checked : '（已被換掉）'}`), 300); }
  }, true);
  addEventListener('resize', () => log(`resize ${innerWidth}×${innerHeight}${window.visualViewport ? '｜可見 ' + Math.round(visualViewport.height) : ''}`));
  addEventListener('hashchange', () => log('hashchange ' + location.hash));
  document.addEventListener('visibilitychange', () => log('visibility ' + document.visibilityState));
  const watch = () => {
    const v = document.getElementById('view'); if (!v) return;
    new MutationObserver(() => log('🔄 畫面重畫（整頁內容換掉）')).observe(v, { childList: true });
    // v0.6.3：誰換掉整頁？記下呼叫的函式名稱
    const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    Object.defineProperty(v, 'innerHTML', {
      configurable: true, get() { return desc.get.call(this); },
      set(html) {
        const who = (new Error().stack || '').split('\n').slice(2, 6).map(s => (s.match(/at (?:async )?([\w$.]+)/) || [])[1] || '?').join(' ← ');
        log(`✏️ 換頁內容：${who}`);
        desc.set.call(this, html);
      },
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
})();

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
    const r = indexedDB.open('xiuxing', 2);
    r.onupgradeneeded = e => {
      const d = r.result;
      if (e.oldVersion < 1) {
        d.createObjectStore('logs', { keyPath: 'id' });
        d.createObjectStore('diary', { keyPath: 'id' });
        d.createObjectStore('kv', { keyPath: 'k' });
      }
      if (e.oldVersion < 2) d.createObjectStore('copies', { keyPath: 'id' }); // v0.4.0 抄經頁（圖）
    };
    // 手機上還開著舊版（另一個分頁或主畫面 App）時，新版要等它關掉才能存資料 → 直接說明，不要看起來沒反應
    r.onblocked = () => showStuck('⚠️ 手機上還開著舊版的修行紀錄（另一個 Chrome 分頁或主畫面 App）。請把它們都關掉（最近使用的 App 清單滑掉），再重新打開。');
    r.onsuccess = () => {
      const d = r.result;
      d.onversionchange = () => { d.close(); dbp = null; showStuck('🔄 修行紀錄有新版本，請把這個畫面關掉再重新打開。'); };
      hideStuck(); res(d);
    };
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
function showStuck(msg) {
  let el = document.getElementById('stuck');
  if (!el) { el = document.createElement('div'); el.id = 'stuck'; el.className = 'stuck'; document.body.appendChild(el); }
  el.textContent = msg;
}
function hideStuck() { document.getElementById('stuck')?.remove(); }
async function req(store, mode, fn, retry = true) {
  const d = await db();
  return new Promise((res, rej) => {
    let t;
    try { t = d.transaction(store, mode); } catch (e) { // 連線被關掉了（例如另一個分頁開了新版）：重新連一次
      if (retry && e.name === 'InvalidStateError') { dbp = null; return req(store, mode, fn, false).then(res, rej); }
      return rej(e);
    }
    const out = fn(t.objectStore(store));
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
  });
}
const dbAll = store => req(store, 'readonly', s => s.getAll());
const dbPut = (store, obj) => req(store, 'readwrite', s => s.put(obj));
const dbDel = (store, id) => req(store, 'readwrite', s => s.delete(id));
// 兩台同步（v0.6.0）：這些 key 是進度與設定，每次改都記時間、排進待同步；其他 key（外觀、字大小、描紅／臨寫、同步設定…）只留在這台
const SYNC_KEY = /^(settings|sitPrefs|setRun|sitRun|chant:.+|copyRun:.+)$/;
const kvRaw = k => req('kv', 'readonly', s => s.get(k));
const kvGet = async (k, dflt) => { const r = await kvRaw(k); return r && !r.deleted ? r.v : dflt; };
async function kvSet(k, v) {
  const synced = SYNC_KEY.test(k);
  await dbPut('kv', synced ? { k, v, at: new Date().toISOString() } : { k, v });
  if (synced) await markState(k);
}
async function kvDel(k) {
  if (!SYNC_KEY.test(k)) return dbDel('kv', k);
  await dbPut('kv', { k, v: null, deleted: true, at: new Date().toISOString() }); // 刪除也要傳到另一台
  await markState(k);
}
function markState(k) {
  scheduleSync(15000); // 佛號一直點、整套功課一直捲時不用每次都送，停下來 15 秒內送
  return withQueue(q => { if (!q.state.includes(k)) q.state.push(k); });
}

/* ---------- 雲端同步（第二段）：存檔時記進待同步清單，有網路就送到 Apps Script ---------- */
const emptyQueue = () => ({ logs: [], diary: [], deletes: [], audio: [], copies: [], state: [] });
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
let syncTimer = null, syncDue = 0, syncing = false, syncAgain = false;
function scheduleSync(ms = 1500) { // 已經排了比較早的就不改
  const due = Date.now() + ms;
  if (syncTimer && syncDue <= due) return;
  clearTimeout(syncTimer); syncDue = due;
  syncTimer = setTimeout(() => { syncTimer = null; syncNow(false); }, ms);
}
const getRec = (store, id) => req(store, 'readonly', s => s.get(id));
const stripAudio = ({ audio, ...rest }) => ({ ...rest, hasAudio: !!(audio || rest.audioFileId) });
const blobToB64 = blob => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });

async function syncPost(cfg, payload) {
  const r = await fetch(cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...payload, pass: cfg.pass }) });
  const j = await r.json().catch(() => ({ ok: false, error: r.status === 404
    ? '找不到 Apps Script（HTTP 404）：網址可能換了。到 Apps Script「部署 → 管理部署作業」複製目前的網址，貼到這裡的設定'
    : '回應看不懂（HTTP ' + r.status + '）' }));
  if (!j.ok) throw new Error(j.error || '同步失敗');
  return j;
}
async function syncNow(manual) {
  const cfg = await kvGet('sync', {});
  if (!cfg.url || !cfg.pass) { if (manual) toast('還沒設定雲端同步（⚙ 設定 → 雲端同步）'); return false; }
  if (!navigator.onLine) { if (manual) toast('沒有網路，有網路時會自動同步'); return false; }
  if (syncing) { syncAgain = true; return false; }
  syncing = true;
  try {
    const q = await withQueue(q0 => JSON.parse(JSON.stringify(q0))); // 排在還沒寫完的待同步之後讀，才不會漏
    const stateDocs = (await Promise.all(q.state.map(kvRaw))).filter(r => r && r.at).map(stateOut);
    const logs = (await Promise.all(q.logs.map(id => getRec('logs', id)))).filter(Boolean);
    const diary = (await Promise.all(q.diary.map(id => getRec('diary', id)))).filter(Boolean).map(stripAudio);
    const dels = [...q.deletes];
    for (let i = 0; i < Math.max(logs.length, diary.length, dels.length, stateDocs.length ? 1 : 0); i += 100) {
      await syncPost(cfg, { action: 'push', logs: logs.slice(i, i + 100), diary: diary.slice(i, i + 100), deletes: dels.slice(i, i + 100), state: i ? [] : stateDocs });
    }
    const sentAt = Object.fromEntries(stateDocs.map(d => [d.k, d.at]));
    await withQueue(async q2 => { // 只拿掉這次送出的，同步途中新增或又改過的留著下次送
      q2.logs = q2.logs.filter(id => !q.logs.includes(id));
      q2.diary = q2.diary.filter(id => !q.diary.includes(id));
      q2.deletes = q2.deletes.filter(d => !dels.includes(d));
      const now = await Promise.all(q2.state.map(kvRaw));
      q2.state = q2.state.filter((k, i) => !(k in sentAt) || now[i]?.at !== sentAt[k]);
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
    for (const id of q.copies) { // 抄經圖：一頁一張，上傳到雲端硬碟「抄經」資料夾
      const rec = await getRec('copies', id);
      if (rec?.image && !rec.imageFileId) {
        const { image, ...meta } = rec;
        const res = await syncPost(cfg, { action: 'copyimg', meta, mime: image.type || 'image/webp', data: await blobToB64(image) });
        const cur = await getRec('copies', id);
        if (cur) { cur.imageFileId = res.fileId; await dbPut('copies', cur); }
      }
      await withQueue(q2 => { q2.copies = q2.copies.filter(x => x !== id); });
    }
    // 抓另一台的變動：只抓上次以後的（伺服器時間），兩台的時鐘不準也不影響
    const j = await syncPost(cfg, { action: 'pull', since: cfg.lastPull || '' });
    const ch = await applyPull(j, cfg);
    cfg.lastPull = j.now;
    cfg.lastAt = new Date().toISOString(); cfg.lastError = '';
    await kvSet('sync', cfg);
    if (manual) toast(`已同步：送出 紀錄 ${logs.length}、日記 ${diary.length}、進度 ${stateDocs.length}；收到 ${ch.recs + ch.dels + ch.keys.size + ch.pics} 項`);
    refreshAfterSync(ch);
    return true;
  } catch (err) {
    cfg.lastError = err.message; await kvSet('sync', cfg);
    if (manual) toast('同步失敗：' + err.message);
    return false;
  } finally {
    syncing = false;
    if (location.hash === '#settings') renderSyncStatus();
    if (syncAgain) { syncAgain = false; scheduleSync(); }
  }
}

/* 進度送出時：抄經的草稿與目前位置只留在這台 */
function stateOut(r) {
  let v = r.v;
  if (v && r.k.startsWith('copyRun:')) v = copyShared(v);
  return { k: r.k, v, at: r.at, deleted: !!r.deleted };
}
const copyShared = v => ({ round: v.round || 1, page: v.page || 0, chars: v.chars || {}, charsAt: v.charsAt || {}, pendingDed: !!v.pendingDed });
/** 抄經進度合併（和 Apps Script 的 mergeCopyRun 一樣）：同一遍同一頁時兩台寫過的字都留下，同一個字以比較晚寫的為準 */
function mergeCopyRun(a, b) {
  const ra = a.round || 1, rb = b.round || 1, pa = a.page || 0, pb = b.page || 0;
  if (ra !== rb) return ra > rb ? a : b;
  if (pa !== pb) return pa > pb ? a : b;
  const chars = { ...a.chars }, at = { ...a.charsAt }, bc = b.chars || {}, bt = b.charsAt || {};
  Object.keys(bc).forEach(i => { if (!chars[i] || String(bt[i] || '') > String(at[i] || '')) { chars[i] = bc[i]; at[i] = bt[i]; } });
  return { round: ra, page: pa, chars, charsAt: at, pendingDed: !!(a.pendingDed || b.pendingDed) };
}
/** 比較內容是否一樣（不管欄位順序） */
function sameJSON(a, b) {
  const norm = x => Array.isArray(x) ? x.map(norm) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, norm(x[k])])) : x;
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}
/** 套用另一台的一筆進度或設定；有改到回傳 true */
async function applyState(d) {
  const local = await kvRaw(d.k);
  let rec;
  if (d.k === 'settings' && d.v && local?.v) {
    rec = { k: d.k, v: mergeSettings(local.v, d.v), at: String(local.at || '') > String(d.at) ? local.at : d.at };
  } else if (d.k.startsWith('copyRun:') && !d.deleted && d.v && local?.v && !local.deleted) {
    const m = mergeCopyRun(copyShared(local.v), d.v);
    const keepLocal = m.round === (local.v.round || 1) && m.page === (local.v.page || 0); // 換頁了，草稿和位置就不適用
    rec = { k: d.k, v: keepLocal ? { ...local.v, ...m } : { ...m, drafts: {}, pos: null }, at: String(local.at || '') > String(d.at) ? local.at : d.at };
  } else {
    if (local?.at && String(local.at) >= String(d.at)) return false; // 這台比較新（等一下會送出去）
    rec = d.deleted ? { k: d.k, v: null, deleted: true, at: d.at } : { k: d.k, v: d.v, at: d.at };
  }
  if (local && sameJSON(local.v, rec.v) && !!local.deleted === !!rec.deleted) return false;
  await dbPut('kv', rec);
  if (d.k === 'settings' && rec.v) await loadSettings();
  return true;
}
/** 套用 pull 回來的東西：紀錄、日記（較新的為準）、刪除、進度與設定、抄經圖（這台沒有的才下載） */
async function applyPull(j, cfg) {
  const ch = { recs: 0, dels: 0, pics: 0, keys: new Set() };
  for (const [store, rows] of [['logs', j.logs || []], ['diary', j.diary || []]]) {
    for (const rec of rows) {
      const cur = await getRec(store, rec.id);
      if (!cur || (rec.updatedAt || rec.at) > (cur.updatedAt || cur.at)) {
        delete rec.hasAudio; delete rec._srv; if (cur?.audio) rec.audio = cur.audio;
        await dbPut(store, rec); ch.recs++;
      }
    }
  }
  for (const d of j.deletes || []) {
    if (await getRec(d.store, d.id)) { await dbDel(d.store, d.id); ch.dels++; }
  }
  for (const d of j.state || []) if (await applyState(d)) ch.keys.add(d.k);
  for (const meta of j.copies || []) {
    if (await getRec('copies', meta.id) || !meta.imageFileId) continue;
    try {
      const g = await syncPost(cfg, { action: 'getimg', fileId: meta.imageFileId });
      const bin = Uint8Array.from(atob(g.data), c => c.charCodeAt(0));
      delete meta._srv;
      await dbPut('copies', { ...meta, image: new Blob([bin], { type: g.mime || 'image/webp' }) }); ch.pics++;
    } catch (_) { /* 這頁先略過，下次再抓 */ }
  }
  return ch;
}
/** 收到另一台的變動後，只重畫「不會打斷你」的畫面（寫日記、設定頁不重畫） */
function refreshAfterSync(ch) {
  if (!(ch.recs || ch.dels || ch.pics || ch.keys.size) || !$('#modal').hidden) return;
  const [name, sub] = (location.hash.slice(1) || 'home').split('/');
  if (name === 'settings' || (name === 'diary' && sub)) return;
  if (!sub || name === 'sit') route();
  else if (name === 'chant' && ch.keys.has('chant:' + sub)) route();
  else if (name === 'copy' && sub === 'book' && ch.pics) route();
  else if (name === 'copy' && sub !== 'book' && ch.keys.has('copyRun:' + sub)) route();
}
async function pendingCount() {
  const q = Object.assign(emptyQueue(), await kvGet('syncQueue', {}));
  return q.logs.length + q.diary.length + q.deletes.length + q.audio.length + q.copies.length;
}

/* ---------- 設定 ---------- */
let settings = null;
let settingsSaved = {}; // 上次存的樣子：存檔時比對哪幾項改了
async function loadSettings() {
  const stored = await kvGet('settings', {});
  settings = Object.assign({
    dedication: DEFAULT_DEDICATION, startDate: '', customSutras: [], customChants: [], customMoods: [],
    showDiamond: false, setOrder: null, myName: '張演平', dharmaName: '演平', nickName: '阿輝', __at: {},
  }, stored);
  if (settings.dedication === OLD_DEDICATION) settings.dedication = DEFAULT_DEDICATION; // 沒改過的舊預設換成課誦本的
  // 「手指也能寫」只屬於這台（v0.6.0 起另外存；以前存在設定裡的搬過來）
  settings.fingerWrite = await kvGet('fingerWrite', !!stored.fingerWrite);
  const { fingerWrite, ...shared } = settings;
  settingsSaved = JSON.parse(JSON.stringify(shared)); // 含預設值：新機器第一次存檔，沒動過的項目不會被當成「剛改的」
}
/** 存設定：只有改到的那幾項記上時間，兩台各改不同項目時都留得住（新Q3） */
async function saveSettings() {
  const { fingerWrite, ...shared } = settings;
  if (fingerWrite !== await kvGet('fingerWrite', false)) await kvSet('fingerWrite', !!fingerWrite);
  const now = new Date().toISOString(), at = { ...(shared.__at || {}) };
  let changed = false;
  for (const k of Object.keys(shared)) {
    if (k !== '__at' && JSON.stringify(shared[k]) !== JSON.stringify(settingsSaved[k])) { at[k] = now; changed = true; }
  }
  if (!changed) return;
  shared.__at = at; settings.__at = at;
  settingsSaved = JSON.parse(JSON.stringify(shared));
  await kvSet('settings', shared);
}
/** 設定合併（和 Apps Script 的 mergeSettings 一樣）：每一項以比較晚改的為準 */
function mergeSettings(a, b) {
  const out = { __at: {} }, aa = a.__at || {}, bb = b.__at || {};
  new Set([...Object.keys(a), ...Object.keys(b)]).forEach(k => {
    if (k === '__at') return;
    const useB = !(k in a) || (k in b && String(bb[k] || '') > String(aa[k] || ''));
    out[k] = useB ? b[k] : a[k];
    const t = useB ? bb[k] : aa[k]; if (t) out.__at[k] = t;
  });
  return out;
}
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
const findItem = id => [SET_ITEM, ...allSutraItems(), ...COPY_ITEMS, ...chantItems()].find(i => i.id === id);
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
  cover: renderCover, home: renderHome, sutra: renderSutra, chant: renderChant, sit: renderSit, copy: renderCopy, diary: renderDiary, settings: renderSettings,
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

/* ---------- 封面（v0.7.0，10/21 封面Q1～Q7）：每天第一次打開先看到禪坐圖、今日法語、打氣話 ---------- */
const dayNo = k => { const [y, m, d] = k.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 864e5); };
function dailyQuote() {
  const qs = window.DAILY_QUOTES || [];
  return qs.length ? qs[dayNo(todayKey()) % qs.length] : '';
}

/** 修行統計：連續天數、累積天數、今天做了沒、這個月打坐、各種累積（打氣話用） */
async function practiceStats() {
  const [logsAll, diaryAll] = await Promise.all([dbAll('logs'), dbAll('diary')]);
  const logs = logsAll.filter(counted), diary = diaryAll.filter(counted);
  const days = new Set([...logs, ...diary].map(r => dayKey(r.at)));
  const today = todayKey();
  let streak = 0, k = days.has(today) ? today : shiftDay(today, -1);
  while (days.has(k)) { streak++; k = shiftDay(k, -1); }
  const month = today.slice(0, 7);
  let sitMonth = 0; const tot = {};
  logs.forEach(l => {
    if (l.type === 'sit') { if (dayKey(l.at).startsWith(month)) sitMonth += l.minutes || 0; return; }
    tot[l.itemId] = (tot[l.itemId] || 0) + (l.count || 0);
  });
  return { streak, total: days.size, todayDone: days.has(today), sitMonth, tot };
}

// 打氣話（小輝寫；Q6：平常像好朋友，里程碑那天用「隨喜讚歎」）。{n} 連續天數、{t} 累積天數、{nick} 小名、{fa} 法名
const CHEERS = {
  start: [
    '{nick}，修行日誌的第一頁，從今天開始。一炷香、一遍心經都好 🙏',
    '萬事起頭難，但你已經打開這本日誌了。今天，先坐五分鐘吧。',
    '千里之行，始於足下。{fa}，第一步就是今天。',
  ],
  back: [
    '歡迎回來，{nick}。中間停了幾天沒關係——面對它、接受它、處理它、放下它，今天重新開始就好。',
    '你已經累積了 {t} 天，這些功夫都不會白費。今天再接上就好 🙏',
    '停下來不是退步，是休息。今天回到蒲團上，就是精進。',
    '累積 {t} 天的你，一定知道：重新開始的那一天最踏實。',
  ],
  t1: ['第 {n} 天，好的開始！{nick}，今天也照自己的步調來。', '連續 {n} 天了，慢慢來，比較快。', '今天的你，比昨天多了一點定力 🙏', '每天一點點，就是最好的修行。'],
  t2: ['連續 {n} 天了，{nick}，節奏出來了喔！', '第 {n} 天，不知不覺已經有習慣的樣子了。', '{n} 天不間斷，這份穩定，就是功夫。', '再撐一下就滿一週了，加油！'],
  t3: ['連續 {n} 天！{nick}，你已經是會照顧自己身心的人了。', '第 {n} 天，忙碌的日子裡還能坐下來，很不簡單。', '{n} 天了，修行不在多，在每天都有。', '累積 {t} 天、連續 {n} 天，穩穩的，很好。'],
  t4: ['連續 {n} 天，習慣已經長出根了 🌱', '{nick}，第 {n} 天。家人一定也感受得到你的安定。', '{n} 天的精進，像水滴穿石，看不見，但一直在。', '累積 {t} 天了，回頭翻翻日記，會看到自己的變化。'],
  t5: ['{fa}師兄，連續 {n} 天，隨喜讚歎 🙏', '第 {n} 天，修行已經是生活的一部分了。', '連續 {n} 天，這份恆心，值得給自己一個微笑。', '{n} 天了，{nick}，也記得好好休息，鬆而不懈。'],
  t6: ['{fa}師兄，連續精進 {n} 天，隨喜讚歎 🙏', '第 {n} 天。{nick}，這條路你已經走得很穩了。', '累積 {t} 天，一步一步，都算數。', '連續 {n} 天，願這份安定，也帶給身邊的人。'],
};
const STREAK_MILESTONES = {
  3: '連續 3 天！{fa}，好的開始是成功的一半 🙏',
  7: '滿一週了！{fa}師兄，精進第 7 天，隨喜讚歎 🙏',
  21: '連續 21 天，習慣養成了！{fa}師兄，隨喜讚歎 🙏',
  30: '連續一個月！{fa}師兄，三十天的堅持，隨喜讚歎 🙏',
  49: '四十九天，七七圓滿。{fa}師兄，隨喜讚歎 🙏',
  100: '百日精進！{fa}師兄，一百天不間斷，隨喜讚歎 🙏',
  108: '一百零八天，像一串念珠圓滿。{fa}師兄，隨喜讚歎 🙏',
  365: '整整一年！{fa}師兄，三百六十五天的修行，隨喜讚歎 🙏',
};
const TOTAL_MILESTONES = [10, 50, 100, 200, 300, 500, 1000];

function cheerFor(st) {
  const i = dayNo(todayKey());
  const pick = arr => arr[i % arr.length];
  let msg;
  if (!st.total) msg = pick(CHEERS.start);
  else if (!st.streak) msg = pick(CHEERS.back);
  else if (st.todayDone && STREAK_MILESTONES[st.streak]) msg = STREAK_MILESTONES[st.streak];
  else if (st.todayDone && TOTAL_MILESTONES.includes(st.total)) msg = '累積修行 {t} 天！{fa}師兄，點點滴滴都是功德 🙏';
  else {
    const n = st.streak;
    msg = pick(n <= 2 ? CHEERS.t1 : n <= 6 ? CHEERS.t2 : n <= 20 ? CHEERS.t3 : n <= 48 ? CHEERS.t4 : n <= 99 ? CHEERS.t5 : CHEERS.t6);
  }
  return msg.replace(/\{n\}/g, st.streak).replace(/\{t\}/g, st.total).replace(/\{nick\}/g, settings.nickName || '').replace(/\{fa\}/g, settings.dharmaName || '');
}
/** 具體的成果（每天輪一項有數字的） */
function cheerFact(st) {
  const facts = [];
  if (st.sitMonth) facts.push(`🧘 這個月打坐共 ${fmtMinutes(st.sitMonth)}`);
  if (st.tot.set) facts.push(`📿 完整功課已做 ${fmtNum(st.tot.set)} 次`);
  COPY_SUTRAS.forEach(c => { const n = st.tot['copy:' + c.id]; if (n) facts.push(`🖌️ ${c.name}已抄 ${fmtNum(n)} 遍`); });
  ['heart', 'dabei', 'pumen'].forEach(id => { const n = st.tot[id]; if (n) facts.push(`📖 ${findItem(id).name}已念 ${fmtNum(n)} 遍`); });
  chantItems().forEach(c => { const n = st.tot[c.id]; if (n) facts.push(`🙏 ${c.name}已念 ${fmtNum(n)} 聲`); });
  return facts.length ? facts[dayNo(todayKey()) % facts.length] : '';
}

async function renderCover() {
  setTitle('修行紀錄'); setTab('');
  document.body.classList.add('immersive');
  await kvSet('coverDay', todayKey()); // 這台今天看過封面了（不同步）
  const st = await practiceStats();
  const q = dailyQuote(), fact = cheerFact(st);
  view.innerHTML = `
    <div class="cover">
      <img class="cover-art" src="monk.svg" alt="小沙彌在蒲團上禪坐">
      <h1 class="cover-name">${esc(settings.myName || '我')}的修行日誌</h1>
      <div class="cover-date">${fmtDay(todayKey())}・${st.streak ? `連續 ${st.streak} 天・` : ''}累積 ${st.total} 天${st.todayDone ? '・今天已修行 ✓' : ''}</div>
      ${q ? `<div class="cover-card"><div class="cover-label">今日法語</div><p class="cover-quote">${esc(q).replace(/\n/g, '<br>')}</p><div class="cover-src">—— 摘自《聖嚴法師108自在語》</div></div>` : ''}
      <div class="cover-card cheer"><p>${esc(cheerFor(st))}</p>${fact ? `<div class="cover-fact">${esc(fact)}</div>` : ''}</div>
      <button class="btn primary big cover-enter" data-a="enter">進入修行紀錄 🙏</button>
    </div>`;
  view.onclick = e => { if (e.target.closest('[data-a="enter"]')) location.hash = 'home'; };
}

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
  const totalLines = [SET_ITEM, ...allSutraItems(), ...COPY_ITEMS, ...chantItems()].filter(i => tot[i.id]).map(i =>
    `<div class="stat"><b>${fmtNum(tot[i.id])}</b><span>${esc(i.name)}（${esc(i.unit)}）${i.unit === '聲' && tot[i.id] >= BEADS ? `・${Math.floor(tot[i.id] / BEADS)} 串` : ''}</span></div>`).join('');

  const copyProg = [];
  for (const c of COPY_SUTRAS) { const r = await getCopyRun(c.id); if (copyStarted(r)) copyProg.push(`${c.name} 第 ${r.page + 1}/${copyCells(c).length} 頁`); }
  const testing = !settings.startDate
    ? `<div class="banner">🧪 目前是<b>測試期間</b>：三段全部做完後，到設定填「正式啟用日」，累積就從那天算起。</div>` : '';

  view.innerHTML = `
    <div class="row" style="justify-content:flex-end;margin:-6px 0 6px"><button class="link-btn" onclick="location.hash='cover'">🪷 回封面</button></div>
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
      ${copyProg.length ? `<p class="small muted" style="margin:10px 0 0">🖌️ 抄經進行中：${copyProg.join('、')}</p>` : ''}
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

/* ---------- 抄經（v0.5.0，10/21 第三次 grill-me Q1～Q11）：一次寫一個大字，寫好的字放進上方整頁 ---------- */
const COPY_SUTRAS = [
  { id: 'heart', name: '心經', text: 'heart', upto: '菩提薩婆訶' },   // 經後的「摩訶般若波羅蜜多（三稱）」不抄
  { id: 'dabei', name: '大悲咒', text: 'dabei', after: '（三遍）' },  // 咒前的「南無大悲觀世音菩薩」不抄
  { id: 'pumen', name: '普門品', text: 'pumen' },
  { id: 'puxian', name: '普賢十大願王', text: 'puxian' },
];
const COPY_ITEMS = COPY_SUTRAS.map(c => ({ id: 'copy:' + c.id, name: '抄經・' + c.name, unit: '遍' }));
const GRID = 10;                 // 每頁 10 行 × 10 字
const INKS = { black: '#222222', red: '#b8322a' };
const PAPER = '#fffdf6', GRID_RED = '#d39a90', GUIDE = '#c9c4bc', CUR = '#9a6a2f';

/** 把經文排成格子：經題一行（太長就兩行），接著正文；句號、逗號不佔格，記在前一個字上 */
const copyCache = {};
function copyCells(c) {
  if (copyCache[c.id]) return copyCache[c.id];
  const t = window.SUTRA_TEXTS[c.text];
  let ps = t.paragraphs;
  if (c.after) ps = ps.slice(ps.indexOf(c.after) + 1);
  if (c.upto) ps = ps.slice(0, ps.findIndex(p => p.includes(c.upto)) + 1);
  const cells = [...t.title].map(ch => ({ ch }));
  while (cells.length % GRID) cells.push(null);
  for (const ch of ps.join('').replace(/（[^）]*）/g, '').replace(/[\s　]/g, '')) {
    if ('。，'.includes(ch)) { const last = cells[cells.length - 1]; if (last) last.p = ch; continue; }
    cells.push({ ch });
  }
  const pages = [];
  for (let i = 0; i < cells.length; i += GRID * GRID) pages.push(cells.slice(i, i + GRID * GRID));
  return (copyCache[c.id] = pages);
}
const copyRunKey = id => 'copyRun:' + id;
/** 進度：round 第幾遍、page 第幾頁、chars 這頁寫好的字 {格子: 筆畫}、drafts 還沒按 ✓ 的字 */
async function getCopyRun(id) {
  const r = Object.assign({ round: 1, page: 0, chars: {}, charsAt: {}, drafts: {}, pos: null, pendingDed: false }, await kvGet(copyRunKey(id), {}));
  delete r.strokes; // v0.4.0 整頁描的草稿不再使用
  return r;
}
const copyStarted = r => r.page > 0 || Object.keys(r.chars).length > 0;
const copyDone = r => Object.keys(r.chars).length;

let fontReady = null;
function loadCopyFont() {
  if (!fontReady) fontReady = document.fonts.load('48px CopyKai', '觀').catch(() => {});
  return fontReady;
}
const serifFallback = () => getComputedStyle(document.documentElement).getPropertyValue('--serif'); // 字型裡沒有的字（例如「嘇」）用明體補

/** 田字格：外框實線、十字虛線 */
function drawCellGrid(ctx, x, y, s, lw) {
  ctx.strokeStyle = GRID_RED; ctx.lineWidth = lw; ctx.setLineDash([]);
  ctx.strokeRect(x, y, s, s);
  ctx.lineWidth = lw / 2; ctx.setLineDash([s / 14, s / 14]);
  ctx.beginPath(); ctx.moveTo(x + s / 2, y); ctx.lineTo(x + s / 2, y + s); ctx.moveTo(x, y + s / 2); ctx.lineTo(x + s, y + s / 2); ctx.stroke();
  ctx.setLineDash([]);
}
function drawGlyph(ctx, ch, x, y, s, color) {
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${s * .8}px CopyKai, ${serifFallback()}`;
  ctx.fillText(ch, x + s / 2, y + s * .53);
}
/** 筆畫存成 0～1 的座標（相對於那個字的格子），畫到任何大小的格子都一樣比例 */
function drawStrokes(ctx, x, y, s, strokes) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  strokes.forEach(st => {
    ctx.strokeStyle = ctx.fillStyle = INKS[st.c] || INKS.black;
    const P = st.p;
    for (let i = 1; i < P.length; i++) {
      ctx.lineWidth = penWidth(s, (P[i - 1][2] + P[i][2]) / 2);
      ctx.beginPath(); ctx.moveTo(x + P[i - 1][0] * s, y + P[i - 1][1] * s); ctx.lineTo(x + P[i][0] * s, y + P[i][1] * s); ctx.stroke();
    }
    if (P.length === 1) { ctx.beginPath(); ctx.arc(x + P[0][0] * s, y + P[0][1] * s, penWidth(s, P[0][2]) / 2, 0, 7); ctx.fill(); }
  });
}
const penWidth = (s, p) => s * .055 * (.45 + 1.1 * (p || .5));
const cellXY = (i, size) => { const c = size / GRID; return [size - (Math.floor(i / GRID) + 1) * c, (i % GRID) * c, c]; }; // 直書：由右到左、由上到下

/** 畫整頁：寫好的格子放手寫字，沒寫的放淡灰字（guide=false 時不畫，存圖用）；cur 是正在寫的格子 */
function drawPage(ctx, size, cells, chars, { guide = true, cur = -1 } = {}) {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, size, size);
  const lw = Math.max(1, size / 500);
  for (let i = 0; i < GRID * GRID; i++) {
    const [x, y, s] = cellXY(i, size), c = cells[i];
    drawCellGrid(ctx, x, y, s, lw);
    if (!c) continue;
    if (chars[i]) drawStrokes(ctx, x, y, s, chars[i]);
    else if (guide) drawGlyph(ctx, c.ch, x, y, s, GUIDE);
    if (c.p) { ctx.fillStyle = chars[i] ? '#8a847b' : GUIDE; ctx.font = `${s * .34}px CopyKai, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.p, x + s * .92, y + s * .86); }
  }
  if (cur >= 0) { const [x, y, s] = cellXY(cur, size); ctx.strokeStyle = CUR; ctx.lineWidth = Math.max(2, size / 220); ctx.strokeRect(x + 1, y + 1, s - 2, s - 2); }
}

/* 抄經首頁 */
async function renderCopy(id, ...rest) {
  if (id === 'book') return renderCopyBook(...rest);
  if (id) return renderCopyPage(id);
  setTitle('抄經');
  const logs = (await dbAll('logs')).filter(l => l.type === 'copy' && counted(l));
  const tot = {}; logs.forEach(l => { tot[l.itemId] = (tot[l.itemId] || 0) + l.count; });
  const runs = {}; for (const c of COPY_SUTRAS) runs[c.id] = await getCopyRun(c.id);
  view.innerHTML = `
    <div class="card"><ul class="list">${COPY_SUTRAS.map(c => {
      const pages = copyCells(c).length, r = runs[c.id];
      const st = r.pendingDed ? `第 ${r.round} 遍抄完了，還沒迴向` : copyStarted(r) ? `第 ${r.round} 遍・第 ${r.page + 1}/${pages} 頁・這頁寫了 ${copyDone(r)} 字` : `共 ${pages} 頁`;
      return `<li><button class="item-btn" data-id="${c.id}">
        <span><span class="name">${esc(c.name)}</span><br><span class="sub">${st}</span></span>
        <span class="sub">已抄 ${fmtNum(tot['copy:' + c.id] || 0)} 遍 ›</span></button></li>`; }).join('')}</ul></div>
    <button class="btn big" onclick="location.hash='copy/book'">📚 我的抄經本</button>
    <p class="muted small">一次寫一個大字：寫好按「✓ 寫好了」，字會放進上方的整頁，接著寫下一個字。平板用觸控筆寫，手指不會畫到（設定可以打開「手指也能寫」）。寫到哪裡都會自動存。</p>`;
  view.onclick = async e => {
    const b = e.target.closest('.item-btn'); if (!b) return;
    const c = COPY_SUTRAS.find(x => x.id === b.dataset.id), r = runs[c.id];
    if (r.pendingDed) { await finishCopyRound(c, r); renderCopy(); return; }
    location.hash = `copy/${c.id}`;
  };
}

async function finishCopyRound(c, r) {
  if (!await dedicate(`抄經・${c.name} 第 ${r.round} 遍`)) {
    r.pendingDed = true; await kvSet(copyRunKey(c.id), r);
    toast('之後在抄經頁點這部經就可以迴向'); return false;
  }
  await saveRec('logs', { id: `copy-${c.id}-r${r.round}`, type: 'copy', itemId: 'copy:' + c.id, name: '抄經・' + c.name, unit: '遍', count: 1, round: r.round, dedicated: true, at: new Date().toISOString() });
  const done = r.round;
  Object.assign(r, { round: r.round + 1, page: 0, chars: {}, charsAt: {}, drafts: {}, pos: null, pendingDed: false }); // 直接改同一個物件，離開抄經頁時存的才會是新的進度
  await kvSet(copyRunKey(c.id), r);
  toast(`已記錄：抄經・${c.name} 第 ${done} 遍 🙏`);
  return true;
}

/* 抄經頁：上方（或右邊）整頁、下方（或左邊）一個大格子 */
async function renderCopyPage(id) {
  view.onclick = null;
  const c = COPY_SUTRAS.find(x => x.id === id);
  if (!c) { location.hash = 'copy'; return; }
  const run = await getCopyRun(id);
  if (run.pendingDed) { location.hash = 'copy'; return; }
  const pages = copyCells(c);
  setTitle('抄經・' + c.name);
  document.body.classList.add('immersive');
  keepAwake(true);
  const prefs = Object.assign({ ink: 'black', mode: 'trace' }, await kvGet('copyPrefs', {})); // mode：trace 描紅／copy 臨寫
  view.innerHTML = `
    <div class="copy">
      <div class="copy-bar">
        <button class="btn" data-a="leave">‹ 返回</button>
        <span class="copy-title grow">${esc(c.name)}・第 ${run.round} 遍・<b id="pgNo"></b></span>
        <button class="btn" data-a="mode" id="modeBtn"></button>
      </div>
      <div class="copy-main">
        <div class="copy-sheet" id="sheetBox"><canvas id="sheet" aria-label="整頁，點寫過的字可以重寫"></canvas></div>
        <div class="copy-write">
          <div class="copy-boxrow">
            <div class="copy-box" id="boxWrap"><canvas id="bxbg"></canvas><canvas id="bxink"></canvas></div>
            <div class="copy-side"><div id="model" class="copy-model"></div><div class="small muted">接下來</div><div id="nextChars" class="copy-next"></div></div>
          </div>
          <div class="copy-bar">
            <button class="btn" data-a="undo">↶ 上一筆</button>
            <button class="btn" data-a="eraser" id="eraserBtn">🧽 橡皮擦</button>
            <button class="btn" data-a="clear">清除</button>
            <button class="ink-dot" data-ink="black" style="--dot:${INKS.black}" aria-label="黑色墨"></button>
            <button class="ink-dot" data-ink="red" style="--dot:${INKS.red}" aria-label="朱紅墨"></button>
            <span class="grow"></span><span class="small muted" id="cnt"></span>
          </div>
          <div class="copy-bar copy-nav">
            <button class="btn" data-a="prev">◀ 上一字</button>
            <button class="btn primary copy-ok" data-a="ok">✓ 寫好了</button>
            <button class="btn" data-a="next" id="nextBtn">下一字 ▶</button>
          </div>
        </div>
      </div>
    </div>`;
  const sheet = $('#sheet'), bxbg = $('#bxbg'), bxink = $('#bxink');
  const sctx = sheet.getContext('2d'), bctx = bxbg.getContext('2d'), ictx = bxink.getContext('2d');
  let cells = pages[run.page], sheetSize = 0, box = 0, eraser = false, cur = null, sawPen = false, strokes = [];
  const writable = () => cells.map((x, i) => x ? i : -1).filter(i => i >= 0);
  const frontier = () => writable().find(i => !run.chars[i]) ?? -1; // 第一個還沒寫好的字＝原本寫到的地方
  if (run.pos == null || !cells[run.pos]) run.pos = frontier();
  const pageFull = run.pos < 0; // 另一台已經把這頁寫完（同步合併後）：畫好之後直接完成這頁
  if (pageFull) run.pos = writable().at(-1);
  const loadStrokes = () => { strokes = (run.drafts[run.pos] || run.chars[run.pos] || []).map(s => ({ c: s.c, p: s.p.slice() })); };
  const keepDraft = () => { run.drafts[run.pos] = strokes; };
  let saveT = null;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => saveCopyRun(id, run), 300); };
  const fingerOk = () => settings.fingerWrite && !sawPen; // 用過筆以後，手掌（觸控）一律不算

  const drawSheetNow = () => { sctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); drawPage(sctx, sheetSize, cells, run.chars, { cur: run.pos }); };
  const drawBox = () => {
    bctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    bctx.fillStyle = PAPER; bctx.fillRect(0, 0, box, box);
    drawCellGrid(bctx, 1, 1, box - 2, 2);
    if (prefs.mode === 'trace') drawGlyph(bctx, cells[run.pos].ch, 0, 0, box, GUIDE);
    redrawInk();
  };
  const redrawInk = () => { ictx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); ictx.clearRect(0, 0, box, box); drawStrokes(ictx, 0, 0, box, strokes); };
  const showInfo = () => {
    const w = writable(), k = w.indexOf(run.pos), ch = cells[run.pos].ch;
    $('#pgNo').textContent = `第 ${run.page + 1}/${pages.length} 頁`;
    $('#cnt').textContent = `這頁 ${copyDone(run)}/${w.length} 字`;
    $('#modeBtn').textContent = prefs.mode === 'trace' ? '描紅 ⇄ 臨寫' : '臨寫 ⇄ 描紅';
    $('#model').textContent = prefs.mode === 'copy' ? ch : '';
    // 接下來 4 個字（跨頁也接著看）
    const all = pages.flat().filter(Boolean), gi = pages.slice(0, run.page).flat().filter(Boolean).length + k;
    $('#nextChars').textContent = all.slice(gi + 1, gi + 5).map(x => x.ch).join('') || '（最後一字）';
    $('#nextBtn').disabled = !(w[k + 1] != null && w[k + 1] <= frontier() || (frontier() < 0 && w[k + 1] != null));
    $$('.ink-dot').forEach(b => b.classList.toggle('on', b.dataset.ink === prefs.ink && !eraser));
    $('#eraserBtn').classList.toggle('primary', eraser);
  };
  const layout = async () => {
    const fit = (cv, wrap, sz) => { cv.width = cv.height = Math.round(sz * devicePixelRatio); cv.style.width = cv.style.height = sz + 'px'; };
    const sb = $('#sheetBox').getBoundingClientRect(), bw = $('#boxWrap').getBoundingClientRect();
    sheetSize = Math.floor(Math.min(sb.width, sb.height)); box = Math.floor(Math.min(bw.width, bw.height));
    fit(sheet, null, sheetSize); fit(bxbg, null, box); fit(bxink, null, box);
    await loadCopyFont();
    drawSheetNow(); drawBox(); showInfo();
  };
  const goto = (i, keep = true) => { if (keep) keepDraft(); run.pos = i; loadStrokes(); save(); drawSheetNow(); drawBox(); showInfo(); };

  // 大格子寫字
  const pos = e => { const r = bxink.getBoundingClientRect(); return [+((e.clientX - r.left) / box).toFixed(4), +((e.clientY - r.top) / box).toFixed(4), e.pointerType === 'pen' ? +(e.pressure || .5).toFixed(2) : .5]; };
  const eraseAt = ([x, y]) => {
    const n = strokes.length;
    strokes = strokes.filter(s => !s.p.some(([a, b]) => Math.hypot(a - x, b - y) < .05));
    if (strokes.length !== n) { redrawInk(); keepDraft(); save(); }
  };
  bxink.addEventListener('pointerdown', e => {
    if (e.pointerType === 'pen') sawPen = true;
    if (e.pointerType === 'touch' && !fingerOk()) return; // 手指、手掌不畫
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault(); try { bxink.setPointerCapture(e.pointerId); } catch (_) { /* 沒有實體指標時忽略 */ }
    const p = pos(e);
    if (eraser) { cur = { erase: true, id: e.pointerId }; eraseAt(p); return; }
    cur = { id: e.pointerId, s: { c: prefs.ink, p: [p] } };
    strokes.push(cur.s); drawStrokes(ictx, 0, 0, box, [cur.s]);
  });
  bxink.addEventListener('pointermove', e => {
    if (!cur || e.pointerId !== cur.id) return;
    const co = e.getCoalescedEvents?.(); // 筆的細點（比較滑順）；拿不到就用這一個
    for (const ev of co && co.length ? co : [e]) {
      const p = pos(ev);
      if (cur.erase) { eraseAt(p); continue; }
      const pts = cur.s.p, last = pts[pts.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < .004) continue;
      pts.push(p); drawStrokes(ictx, 0, 0, box, [{ c: cur.s.c, p: [last, p] }]);
    }
  });
  const end = e => { if (cur && e.pointerId === cur.id) { cur = null; keepDraft(); save(); } };
  bxink.addEventListener('pointerup', end); bxink.addEventListener('pointercancel', end);

  // 點整頁上寫過的字 → 跳過去重寫（Q9）
  sheet.addEventListener('click', e => {
    const r = sheet.getBoundingClientRect(), s = sheetSize / GRID;
    const col = Math.floor((sheetSize - (e.clientX - r.left)) / s), row = Math.floor((e.clientY - r.top) / s);
    const i = col * GRID + row;
    if (cells[i] && (run.chars[i] || i === frontier())) goto(i);
    else if (cells[i]) toast('還沒寫到這個字');
  });

  const onResize = () => layout();
  window.addEventListener('resize', onResize);
  pageCleanup = () => { window.removeEventListener('resize', onResize); keepDraft(); clearTimeout(saveT); saveCopyRun(id, run); keepAwake(false); };
  loadStrokes(); await layout();

  // 這頁寫完（三Q10）：存成圖（只有格線和手寫字），換下一頁；整部寫完迴向
  async function finishPage() {
    const out = document.createElement('canvas'); out.width = out.height = 1000;
    drawPage(out.getContext('2d'), 1000, cells, run.chars, { guide: false });
    const blob = await new Promise(res => out.toBlob(res, 'image/webp', .85));
    // 圖的 id 固定（經＋遍＋頁），兩台都完成同一頁也只會有一張
    await saveCopy({ id: `${c.id}-r${run.round}-p${run.page + 1}`, sutraId: c.id, name: c.name, round: run.round, page: run.page + 1, pages: pages.length, image: blob, at: new Date().toISOString() });
    toast(`第 ${run.page + 1} 頁完成 🙏`);
    Object.assign(run, { page: run.page + 1, chars: {}, charsAt: {}, drafts: {}, pos: null });
    if (run.page >= pages.length) {
      run.pendingDed = true; await kvSet(copyRunKey(id), run);
      await finishCopyRound(c, run);
      location.hash = 'copy'; return;
    }
    cells = pages[run.page]; run.pos = frontier(); loadStrokes();
    await kvSet(copyRunKey(id), run);
    drawSheetNow(); drawBox(); showInfo();
  }
  if (pageFull) await finishPage();

  view.onclick = async e => {
    const dot = e.target.closest('[data-ink]');
    if (dot) { prefs.ink = dot.dataset.ink; eraser = false; kvSet('copyPrefs', prefs); showInfo(); return; }
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    const w = writable(), k = w.indexOf(run.pos);
    if (a === 'leave') { location.hash = 'copy'; return; }
    if (a === 'mode') { prefs.mode = prefs.mode === 'trace' ? 'copy' : 'trace'; kvSet('copyPrefs', prefs); drawBox(); showInfo(); return; }
    if (a === 'undo') { strokes.pop(); redrawInk(); keepDraft(); save(); return; }
    if (a === 'eraser') { eraser = !eraser; showInfo(); return; }
    if (a === 'clear') { if (strokes.length) { strokes = []; redrawInk(); keepDraft(); save(); } return; }
    if (a === 'prev') { if (k > 0) goto(w[k - 1]); else toast('這是這頁的第一個字'); return; }
    if (a === 'next') { if (!$('#nextBtn').disabled) goto(w[k + 1]); return; }
    if (a === 'ok') {
      if (!strokes.length) { toast('還沒寫'); return; }
      run.chars[run.pos] = strokes; run.charsAt[run.pos] = new Date().toISOString(); delete run.drafts[run.pos];
      const f = frontier();
      if (f >= 0) { goto(f, false); return; } // 回到原本寫到的地方（重寫時）或下一個字
      await finishPage();
    }
  };
}

/** 存抄經進度：先和已存的（可能剛從另一台同步來）合併再寫，才不會把另一台寫的字蓋掉 */
async function saveCopyRun(id, run) {
  const cur = await kvGet(copyRunKey(id), null);
  if (cur && !run.pendingDed) {
    const m = mergeCopyRun(copyShared(cur), copyShared(run));
    if (m.round === run.round && m.page === run.page) Object.assign(run, m);
  }
  await kvSet(copyRunKey(id), run);
}

/** 存一頁抄經圖，排進待同步（圖檔上傳到雲端硬碟「抄經」資料夾） */
async function saveCopy(rec) {
  rec.updatedAt = new Date().toISOString();
  await dbPut('copies', rec);
  await withQueue(q => { if (!q.copies.includes(rec.id)) q.copies.push(rec.id); });
  scheduleSync();
}

/* 我的抄經本：依經、依遍數整理，點進去一頁一頁看 */
async function renderCopyBook(sutraId, round) {
  setTitle('我的抄經本');
  const all = (await dbAll('copies')).sort((a, b) => a.at.localeCompare(b.at));
  const urls = []; pageCleanup = () => urls.forEach(u => URL.revokeObjectURL(u));
  if (sutraId) {
    const ps = all.filter(r => r.sutraId === sutraId && String(r.round) === String(round)).sort((a, b) => a.page - b.page);
    const name = COPY_SUTRAS.find(c => c.id === sutraId)?.name || sutraId;
    view.innerHTML = `<div class="sutra-head"><button class="btn" onclick="location.hash='copy/book'">‹ 返回</button></div>
      <h2 class="book-h">${esc(name)}・第 ${esc(round)} 遍</h2>
      <p class="book-sign">${esc(settings.dharmaName || '')} 敬書</p>
      ${ps.map(r => { let src = ''; if (r.image) { src = URL.createObjectURL(r.image); urls.push(src); }
        return `<figure class="book-page">${src ? `<img src="${src}" alt="第 ${r.page} 頁">` : '<div class="empty">這頁的圖在雲端硬碟（這台沒有副本）</div>'}<figcaption>第 ${r.page} 頁・${fmtDay(dayKey(r.at))}</figcaption></figure>`; }).join('')}`;
    view.onclick = null; return;
  }
  const groups = {};
  all.forEach(r => { const k = r.sutraId + '|' + r.round; (groups[k] ||= []).push(r); });
  const keys = Object.keys(groups).sort((a, b) => groups[b].at(-1).at.localeCompare(groups[a].at(-1).at));
  view.innerHTML = `<div class="sutra-head"><button class="btn" onclick="location.hash='copy'">‹ 抄經</button></div>
    ${keys.length ? `<div class="card"><ul class="list">${keys.map(k => { const g = groups[k], [sid, rd] = k.split('|');
      const name = COPY_SUTRAS.find(c => c.id === sid)?.name || sid, total = g[0].pages || copyCells(COPY_SUTRAS.find(c => c.id === sid)).length;
      return `<li><button class="item-btn" data-k="${esc(k)}"><span><span class="name">${esc(name)}・第 ${esc(rd)} 遍</span><br>
        <span class="sub">${fmtDay(dayKey(g[0].at))}${dayKey(g.at(-1).at) !== dayKey(g[0].at) ? ' ～ ' + fmtDay(dayKey(g.at(-1).at)) : ''}</span></span>
        <span class="sub">${g.length}/${total} 頁 ›</span></button></li>`; }).join('')}</ul></div>` : '<div class="empty">還沒有抄完的頁面</div>'}`;
  view.onclick = e => { const b = e.target.closest('[data-k]'); if (b) { const [s, r] = b.dataset.k.split('|'); location.hash = `copy/book/${s}/${r}`; } };
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
      <h2>我的名字</h2>
      <label class="field"><span>名字（封面「＿＿的修行日誌」）</span><input type="text" id="myName" value="${esc(settings.myName)}"></label>
      <label class="field"><span>法名（抄經署名「＿＿ 敬書」、師兄稱呼）</span><input type="text" id="dharmaName" value="${esc(settings.dharmaName)}"></label>
      <label class="field"><span>小名（打氣話用）</span><input type="text" id="nickName" value="${esc(settings.nickName)}"></label>
      <button class="btn primary" id="nameSave">儲存</button>
    </div>
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
      <h2>抄經</h2>
      <label class="switch"><input type="checkbox" id="fingerWrite" ${settings.fingerWrite ? 'checked' : ''}> 手指也能寫（手機用；平板用觸控筆時請關掉，手掌才不會畫到）</label>
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
      <p class="small muted" style="margin-top:0">還沒開雲端同步前，資料只存在這支手機，建議每週匯出一次，存到雲端硬碟的私人資料夾（不要放進專案資料夾）。備份檔不含錄音和抄經圖（這兩樣靠雲端同步）。</p>
      <div class="row"><button class="btn primary" id="export">匯出備份</button><label class="btn" style="display:inline-flex;align-items:center">匯入備份<input type="file" id="import" accept="application/json,.json" hidden></label></div>
    </div>
    <p class="small muted">修行紀錄 v${APP_VERSION}・34.修行紀錄App。經文依《佛教朝暮課誦本》與法鼓文化《觀音法門》，僅供個人修行使用；金剛經為 CBETA（CC BY-NC-SA 3.0 TW）。流水聲：Wikimedia Commons 公有領域錄音。抄經字型：霞鶩文楷 TC（SIL OFL 1.1）。</p>`;

  view.onchange = async e => {
    const son = e.target.dataset?.son;
    if (son) { const o = setOrder(); o.find(x => x.id === son).on = e.target.checked; settings.setOrder = o; await saveSettings(); return; }
    if (e.target.id === 'showDiamond') { settings.showDiamond = e.target.checked; await saveSettings(); renderSettings(); }
    if (e.target.id === 'fingerWrite') { settings.fingerWrite = e.target.checked; await saveSettings(); toast(settings.fingerWrite ? '手指也能寫了' : '只有觸控筆能寫'); }
  };
  view.onclick = async e => {
    const mv = e.target.closest('[data-mv]')?.dataset.mv;
    if (mv) {
      const [i, d] = mv.split(':').map(Number), o = setOrder();
      [o[i], o[i + d]] = [o[i + d], o[i]]; settings.setOrder = o; await saveSettings(); renderSettings(); return;
    }
    if (e.target.id === 'setReset' && confirm('恢復成課誦本的 9 項與順序？')) { settings.setOrder = null; await saveSettings(); renderSettings(); return; }
    if (e.target.id === 'nameSave') {
      settings.myName = $('#myName').value.trim(); settings.dharmaName = $('#dharmaName').value.trim(); settings.nickName = $('#nickName').value.trim();
      // 沒改過的預設名字也要送上雲端（週摘要標題、另一台要用）：當成這次有改
      ['myName', 'dharmaName', 'nickName'].forEach(k => { delete settingsSaved[k]; });
      await saveSettings(); toast('名字已儲存');
    }
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
    // 只找「外觀」那三個按鈕：網頁最外層 <html> 選了淺色／深色時也有 data-theme，不能被當成按鈕（10/21 手機深色時設定頁每點一下就重畫的原因）
    const th = e.target.closest('#theme [data-theme]')?.dataset.theme;
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
  const [logs, diary, copies, kvs] = await Promise.all([dbAll('logs'), dbAll('diary'), dbAll('copies'), dbAll('kv')]);
  // 進度與設定：v0.6.0 以前存的沒有時間，補上（補的時候就會排進待同步）
  for (const r of kvs) if (SYNC_KEY.test(r.k) && !r.at && !r.deleted) await kvSet(r.k, r.v);
  await withQueue(q => {
    kvs.forEach(r => { if (SYNC_KEY.test(r.k) && r.at && !q.state.includes(r.k)) q.state.push(r.k); });
    copies.forEach(c => { if (c.image && !c.imageFileId && !q.copies.includes(c.id)) q.copies.push(c.id); });
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
  if (!confirm('從雲端硬碟把全部的紀錄、日記、進度、設定、抄經圖重新抓一次？\n平常會自動同步，不用按；資料怪怪的時候再用。同一筆以比較新的為準。')) return;
  try {
    const j = await syncPost(cfg, { action: 'pull', since: '' }); // 全部重抓一次
    const ch = await applyPull(j, cfg);
    cfg.lastPull = j.now; await kvSet('sync', cfg);
    toast(`還原完成：紀錄 ${ch.recs} 筆、刪除 ${ch.dels} 筆、進度與設定 ${ch.keys.size} 項、抄經 ${ch.pics} 頁`);
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
  // 每天第一次打開先看封面（Q2；只看這台，不同步）
  if (['', '#home'].includes(location.hash) && await kvGet('coverDay', '') !== todayKey()) history.replaceState(null, '', location.pathname + location.search + '#cover');
  route();
  window.addEventListener('online', () => syncNow(false));
  setTimeout(() => syncNow(false), 2000);
  let lastWake = 0; // 從別的 App 切回來時同步一次（10 秒內只算一次）
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastWake > 10000) { lastWake = Date.now(); syncNow(false); }
  });
})();

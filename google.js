// The Gentle Stoic Parent — Google integration (Identity Services + Calendar + Sheets + Drive)
export const SHEET_ID = '11V5EoY84H8tDQ6DvZ9jqtIcoBarY7EODqueNmNr71iM';
export const FOLDER_ID = '1aRfxq7vsnOcqAt1eqyoGEVlWR4RBdWjD';
export const SCOPES = [
  'openid', 'email', 'profile',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
].join(' ');

export const TABS = {
  Familias: ['id', 'nombre', 'codigo', 'creadoPor', 'creado'],
  Miembros: ['familiaId', 'rol', 'email', 'nombre', 'apodo', 'correoContacto', 'idioma', 'calendarId', 'unido'],
  Notas: ['familiaId', 'id', 'fecha', 'autor', 'visibilidad', 'funciono', 'atasco', 'ajuste', 'mochilas', 'ropa', 'desayuno'],
  Archivos: ['familiaId', 'fecha', 'autor', 'nombre', 'driveId', 'enlace'],
};

let token = null, tokenExp = 0, tokenClient = null, gisReady = null;
const TK = 'gsp:gtok', RS = 'gsp:resume';
function loadTok() { try { const t = JSON.parse(sessionStorage.getItem(TK) || 'null'); if (t && Date.now() < t.exp) { token = t.token; tokenExp = t.exp; } } catch (e) {} }
function saveTok() { try { sessionStorage.setItem(TK, JSON.stringify({ token, exp: tokenExp })); } catch (e) {} }
const redirectUri = () => location.origin + location.pathname;
// Returns the saved resume object when coming back from Google, else null.
export function consumeRedirect() {
  loadTok();
  const h = location.hash || '';
  if (!/access_token=|error=/.test(h)) return null;
  const p = new URLSearchParams(h.slice(1));
  let st = {}; try { st = JSON.parse(localStorage.getItem(RS) || '{}'); localStorage.removeItem(RS); } catch (e) {}
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  if (p.get('error')) return { ...st, error: p.get('error') };
  token = p.get('access_token'); tokenExp = Date.now() + (Number(p.get('expires_in') || 3600) - 60) * 1000; saveTok();
  return st;
}
async function whoAmI() { const me = await api('https://www.googleapis.com/oauth2/v3/userinfo'); return { email: (me.email || '').toLowerCase(), name: me.given_name || me.name || '' }; }

function loadGis() {
  if (gisReady) return gisReady;
  gisReady = new Promise((res, rej) => {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return res();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => res(); s.onerror = () => rej(new Error('No se pudo cargar Google Identity Services'));
    document.head.appendChild(s);
  });
  return gisReady;
}

// Full-page redirect (reliable on iPad/iPhone, no popups). `resume` is stored and returned by consumeRedirect().
export async function connect(clientId, hint, resume) {
  if (!clientId) throw new Error('NO_CLIENT_ID');
  loadTok();
  if (isConnected()) { try { return await whoAmI(); } catch (e) { token = null; } }
  if (resume !== false) {
    try { localStorage.setItem(RS, JSON.stringify(resume || {})); } catch (e) {}
    const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri(), response_type: 'token', scope: SCOPES, include_granted_scopes: 'true', prompt: 'select_account' });
    if (hint) q.set('login_hint', hint);
    location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + q.toString());
    return new Promise(() => {});
  }
  await loadGis();
  return new Promise((res, rej) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId, scope: SCOPES, login_hint: hint || undefined, prompt: '',
      callback: async (r) => {
        if (r.error) return rej(new Error(r.error_description || r.error));
        token = r.access_token; tokenExp = Date.now() + (r.expires_in - 60) * 1000; saveTok();
        try { const me = await api('https://www.googleapis.com/oauth2/v3/userinfo'); res({ email: (me.email || '').toLowerCase(), name: me.given_name || me.name || '' }); }
        catch (e) { rej(e); }
      },
      error_callback: (e) => rej(new Error(e && e.type === 'popup_closed' ? 'POPUP_CLOSED' : (e && e.message) || 'OAuth error')),
    });
    tokenClient.requestAccessToken();
  });
}
function parseJwt(t) {
  const b = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(decodeURIComponent(atob(b).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
}
// Official "Sign in with Google" button (Google Identity Services)
export async function renderButton(el, clientId, { locale, text, onCredential }) {
  await loadGis();
  window.google.accounts.id.initialize({
    client_id: clientId, ux_mode: 'popup', auto_select: false, itp_support: true, use_fedcm_for_prompt: true,
    callback: (r) => { try { const p = parseJwt(r.credential); onCredential({ email: (p.email || '').toLowerCase(), name: p.given_name || p.name || '', picture: p.picture || '' }); } catch (e) {} },
  });
  el.innerHTML = '';
  window.google.accounts.id.renderButton(el, { type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: text || 'signin_with', logo_alignment: 'left', width: Math.min(400, Math.max(240, el.offsetWidth || 360)), locale: locale || 'es' });
}
export const isConnected = () => { if (!token) loadTok(); return !!token && Date.now() < tokenExp; };
export function disconnect() { if (token && window.google) window.google.accounts.oauth2.revoke(token, () => {}); token = null; try { sessionStorage.removeItem(TK); } catch (e) {} }

async function api(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + token, ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(opts.headers || {}) } });
  if (r.status === 204) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status));
  return j;
}

// ---------- Sheets as database ----------
const S = 'https://sheets.googleapis.com/v4/spreadsheets/' + SHEET_ID;
export async function ensureTabs() {
  const meta = await api(S + '?fields=sheets.properties.title');
  const have = new Set(meta.sheets.map(s => s.properties.title));
  const add = Object.keys(TABS).filter(t => !have.has(t));
  if (add.length) await api(S + ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: add.map(title => ({ addSheet: { properties: { title } } })) }) });
  for (const t of add) await api(S + '/values/' + t + '!A1:append?valueInputOption=RAW', { method: 'POST', body: JSON.stringify({ values: [TABS[t]] }) });
}
export async function readTab(tab) {
  const r = await api(S + '/values/' + tab + '!A1:Z2000');
  const [head, ...rows] = r.values || [];
  if (!head) return [];
  return rows.map((row, i) => ({ ...Object.fromEntries(head.map((h, j) => [h, row[j] ?? ''])), __row: i + 2 }));
}
export async function appendRow(tab, obj) {
  await api(S + '/values/' + tab + '!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { method: 'POST', body: JSON.stringify({ values: [TABS[tab].map(k => obj[k] ?? '')] }) });
}
export async function updateRow(tab, rowNum, obj) {
  const end = String.fromCharCode(64 + TABS[tab].length);
  await api(S + '/values/' + tab + '!A' + rowNum + ':' + end + rowNum + '?valueInputOption=RAW', { method: 'PUT', body: JSON.stringify({ values: [TABS[tab].map(k => obj[k] ?? '')] }) });
}

// ---------- Calendar ----------
const C = 'https://www.googleapis.com/calendar/v3';
export async function ensureCalendar(summary, tz, existingId) {
  if (existingId) { try { await api(C + '/calendars/' + encodeURIComponent(existingId)); return existingId; } catch (e) {} }
  const list = await api(C + '/users/me/calendarList?minAccessRole=owner');
  const found = (list.items || []).find(c => c.summary === summary);
  if (found) return found.id;
  const cal = await api(C + '/calendars', { method: 'POST', body: JSON.stringify({ summary, timeZone: tz, description: 'The Gentle Stoic Parent · recordatorios y bloques del ritmo familiar' }) });
  await api(C + '/users/me/calendarList/' + encodeURIComponent(cal.id), { method: 'PATCH', body: JSON.stringify({ colorId: '6', defaultReminders: [] }) }).catch(() => {});
  return cal.id;
}
// events: [{ key, title, desc, start:'HH:MM', end:'HH:MM', days:[1..5], firstDate: Date, reminder: true|false, colorId }]
export async function syncEvents(calendarId, tz, events, onProgress) {
  const cid = encodeURIComponent(calendarId);
  const old = await api(C + '/calendars/' + cid + '/events?privateExtendedProperty=gsp%3D1&maxResults=250&singleEvents=false');
  for (const ev of (old.items || [])) await api(C + '/calendars/' + cid + '/events/' + ev.id, { method: 'DELETE' });
  const BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  let n = 0;
  for (const e of events) {
    const d = e.firstDate, ymd = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const body = {
      summary: e.title, description: e.desc + '\n\nThe Gentle Stoic Parent',
      start: { dateTime: ymd + 'T' + e.start.padStart(5, '0') + ':00', timeZone: tz },
      end: { dateTime: ymd + 'T' + e.end.padStart(5, '0') + ':00', timeZone: tz },
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=' + e.days.map(x => BY[x]).join(',')],
      reminders: { useDefault: false, overrides: e.reminder ? [{ method: 'popup', minutes: 0 }] : [] },
      transparency: e.reminder ? 'transparent' : 'opaque',
      colorId: e.colorId || undefined,
      extendedProperties: { private: { gsp: '1', key: e.key } },
    };
    await api(C + '/calendars/' + cid + '/events', { method: 'POST', body: JSON.stringify(body) });
    n++; onProgress && onProgress(n, events.length);
  }
  return n;
}

// ---------- Drive ----------
export async function uploadFile(file, name) {
  const meta = { name: name || file.name, parents: [FOLDER_ID] };
  const fd = new FormData();
  fd.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  fd.append('file', file);
  return api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,thumbnailLink&supportsAllDrives=true', { method: 'POST', body: fd });
}

// ---------- Apps Script backend (emails, family rules) ----------
export async function callApi(url, action, payload) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, payload, accessToken: isConnected() ? token : undefined, session: (() => { try { return JSON.parse(localStorage.getItem('gsp:sess') || 'null'); } catch (e) { return null; } })() }) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'API error');
  return j.data;
}

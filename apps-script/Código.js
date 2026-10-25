/**
 * The Gentle Stoic Parent — Apps Script backend
 * Deploy: Implementar → Nueva implementación → Aplicación web
 *   Ejecutar como: Yo (tu cuenta)   ·   Quién tiene acceso: Cualquier usuario
 * Los correos salen desde TU Gmail (el dueño del script).
 */
const CFG = {
  SHEET_ID: '11V5EoY84H8tDQ6DvZ9jqtIcoBarY7EODqueNmNr71iM',
  FOLDER_ID: '1aRfxq7vsnOcqAt1eqyoGEVlWR4RBdWjD',
  APP_URL: 'https://thegentlestoicparent.com',
  SENDER_NAME: 'The Gentle Stoic Parent',
  FROM: 'mentor@thegentlestoicparent.com',   // debe estar como «Enviar como» en el Gmail dueño del script
  REPLY_TO: 'mentor@thegentlestoicparent.com',
  ASSETS: 'https://thegentlestoicparent.com/img/brand/', // imágenes de los correos
  TZ: 'Europe/Madrid',
};

const TABS = {
  Familias: ['id', 'nombre', 'codigo', 'creadoPor', 'creado', 'zona'],
  Miembros: ['familiaId', 'rol', 'email', 'nombre', 'apodo', 'correoContacto', 'idioma', 'calendarId', 'unido', 'avisosCorreo', 'claveHash', 'sesion', 'googleEmail', 'color'],
  Notas: ['familiaId', 'id', 'fecha', 'autor', 'visibilidad', 'funciono', 'atasco', 'ajuste', 'mochilas', 'ropa', 'desayuno', 'idea'],
  Ideas: ['familiaId', 'id', 'fecha', 'notaId', 'autor', 'estado', 'json'],
  Menus: ['familiaId', 'fecha', 'autor', 'json'],
  Archivos: ['familiaId', 'fecha', 'autor', 'nombre', 'driveId', 'enlace'],
  Correos: ['fecha', 'tipo', 'para', 'asunto', 'estado'],
  Alma: ['familiaId', 'fecha', 'autor', 'conversacion', 'origen', 'texto'],   // conversaciones con Alma por voz (vida personal, aparte del trabajo)
};

// ---------------- HTTP ----------------
function doGet(e) {
  return json_({ ok: true, app: 'gsp', version: 7 });
}
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.action === 'passwordLogin') return json_({ ok: true, data: passwordLogin_(body.payload || {}) });
    const a = body.action, pl = body.payload || {};
    let user;
    if (a === 'lookupInvite' || a === 'almaVerificar') user = null;   // almaVerificar: lo llama el Hub con un pase de un solo uso
    else if (a === 'createFamily' || a === 'joinFamily') user = (pl.method === 'google' && body.accessToken) ? verifyToken_(body.accessToken) : pwUser_(pl);
    else if (a === 'me' && body.accessToken) user = verifyToken_(body.accessToken);
    else if (body.session && body.session.key) user = verifySession_(body.session);
    else user = verifyToken_(body.accessToken);
    const fn = ACTIONS[a];
    if (!fn) throw new Error('Acción desconocida: ' + body.action);
    return json_({ ok: true, data: fn(body.payload || {}, user) });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function verifyToken_(tok) {
  if (!tok) throw new Error('Falta la sesión de Google');
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(tok), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('Sesión de Google no válida');
  const p = JSON.parse(r.getContentText());
  if (!p.email) throw new Error('La sesión no incluye el correo');
  return { email: String(p.email).toLowerCase(), name: '' };
}

// ---------------- Sheet helpers ----------------
const SH_OK_ = {};
function sh_(tab) {
  const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  let s = ss.getSheetByName(tab);
  if (!s) { s = ss.insertSheet(tab); s.appendRow(TABS[tab]); s.setFrozenRows(1); }
  else if (!SH_OK_[tab]) { // añade columnas nuevas al encabezado si faltan
    const n = TABS[tab].length, h = s.getRange(1, 1, 1, n).getValues()[0];
    if (h.join('|') !== TABS[tab].join('|')) s.getRange(1, 1, 1, n).setValues([TABS[tab]]);
    SH_OK_[tab] = true;
  }
  return s;
}
function rows_(tab) {
  const v = sh_(tab).getDataRange().getValues(); const h = v.shift() || [];
  return v.map((r, i) => Object.assign(Object.fromEntries(h.map((k, j) => [k, r[j]])), { __row: i + 2 }));
}
function append_(tab, o) { sh_(tab).appendRow(TABS[tab].map(k => o[k] == null ? '' : o[k])); }
function update_(tab, row, o) { sh_(tab).getRange(row, 1, 1, TABS[tab].length).setValues([TABS[tab].map(k => o[k] == null ? '' : o[k])]); }
function uniqueCode_(want) {
  const used = rows_('Familias').map(f => String(f.codigo).toUpperCase());
  let k = String(want || '').toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(k) || used.indexOf(k) >= 0) do { k = code_(); } while (used.indexOf(k) >= 0);
  return k;
}
function code_() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)]; return s; }
// Usuarios unificados con Spacio AM: si esta persona es administradora en el «Control de usuarios» (mismo correo o
// correo alterno), el Hub firma su llamada y Alma puede pedirle cosas de trabajo a la secretaria en su nombre.
const HUB_URL_ = 'https://script.google.com/macros/s/AKfycbzTdkEpRPgnwaUIHWbQmrysPEqGYqTqDKYwMaQlnun-OT7B2hIa6KdSNS-aedWN-I0cZQ/exec';
function almaHub_(ctx) {
  const m = ctx.me, c = CacheService.getScriptCache(), pase = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  const emails = [m.email, m.correoContacto, m.googleEmail].map(e => String(e || '').trim().toLowerCase()).filter(Boolean);
  c.put('almapase_' + pase, JSON.stringify({ emails, rol: m.rol, familia: ctx.family.id }), 120);
  try {
    const url = PropertiesService.getScriptProperties().getProperty('HUB_URL') || HUB_URL_;
    const r = UrlFetchApp.fetch(url, { method: 'post', contentType: 'text/plain;charset=utf-8', payload: JSON.stringify({ gspPase: pase }), muteHttpExceptions: true, followRedirects: true });
    const j = JSON.parse(r.getContentText() || '{}');
    return j && j.ok ? j : { admin: false };
  } finally { c.remove('almapase_' + pase); }
}
function almaPermitida_(ctx) {
  const ids = String(PropertiesService.getScriptProperties().getProperty('ALMA_FAMILIAS') || '').split(/[\s,;]+/).filter(Boolean);
  if (ids.indexOf(String(ctx.family.id)) >= 0) return true;
  let duenio = ''; try { duenio = String(Session.getEffectiveUser().getEmail() || '').toLowerCase(); } catch (e) {}
  return !!duenio && ctx.members.some(m => [m.email, m.correoContacto, m.googleEmail].some(e => String(e || '').toLowerCase() === duenio));
}
function familyOf_(email) {
  const m = rows_('Miembros').find(x => String(x.email).toLowerCase() === email || String(x.correoContacto).toLowerCase() === email || String(x.googleEmail || '').toLowerCase() === email);
  if (!m) return null;
  const f = rows_('Familias').find(x => x.id === m.familiaId);
  const members = rows_('Miembros').filter(x => x.familiaId === m.familiaId);
  return { family: f, me: m, members };
}
function pub_(ctx) {
  if (!ctx) return null;
  const f = ctx.family, me = ctx.me;
  if (f.zona === 'America/Guatemala' && !PropertiesService.getScriptProperties().getProperty('tzfix:' + f.id)) { f.zona = CFG.TZ; update_('Familias', f.__row, f); PropertiesService.getScriptProperties().setProperty('tzfix:' + f.id, '1'); }
  if (!me.sesion) { me.sesion = Utilities.getUuid(); update_('Miembros', me.__row, me); }
  return { myRole: me.rol, session: { email: String(me.email).toLowerCase(), key: me.sesion }, id: f.id, name: f.nombre, code: f.codigo, createdBy: f.creadoPor, tz: f.zona || CFG.TZ,
    members: ctx.members.map(m => ({ role: m.rol, email: m.email, contact: m.correoContacto, google: m.googleEmail || (m.claveHash ? '' : m.email), name: m.nombre, color: m.color || undefined, nick: m.apodo, lang: m.idioma, calendarId: m.calendarId, emails: m.avisosCorreo !== 'no' })) };
}

// ---------------- Actions ----------------
const ACTIONS = {
  me(p, u) { return pub_(familyOf_(u.email)); },

  linkGoogle(p, u) {
    const ctx = familyOf_(u.email); if (!ctx) throw new Error('Sin familia');
    const g = verifyToken_(p.googleToken);
    const other = rows_('Miembros').find(x => x.__row !== ctx.me.__row && (String(x.email).toLowerCase() === g.email || String(x.googleEmail || '').toLowerCase() === g.email));
    if (other) throw new Error('Esa cuenta de Google ya está enlazada a otro usuario.');
    ctx.me.googleEmail = g.email; update_('Miembros', ctx.me.__row, ctx.me);
    return pub_(familyOf_(u.email));
  },

  createFamily(p, u) {
    const ex = familyOf_(u.email); if (ex) return pub_(ex);   // reintento seguro
    const fam = { id: 'f' + Date.now().toString(36), nombre: p.familyName, codigo: uniqueCode_(p.code), creadoPor: p.role, creado: new Date().toISOString() };
    append_('Familias', fam);
    append_('Miembros', member_(fam.id, p, u));
    try { sendWelcome_(u.email, p, fam); } catch (e) {}
    return pub_(familyOf_(u.email));
  },

  lookupInvite(p) {
    const f = rows_('Familias').find(x => String(x.codigo).toUpperCase() === String(p.code || '').toUpperCase());
    if (!f) throw new Error('No encontramos esa invitación');
    const mem = rows_('Miembros').filter(x => x.familiaId === f.id);
    const taken = mem.map(m => m.rol);
    return { name: f.nombre, code: f.codigo, by: f.creadoPor, byNick: (mem[0] && mem[0].apodo) || f.creadoPor, taken, free: ['Juan', 'Christine'].filter(r => !taken.includes(r)), full: mem.length >= 2 };
  },

  joinFamily(p, u) {
    const f = rows_('Familias').find(x => String(x.codigo).toUpperCase() === String(p.code || '').toUpperCase());
    if (!f) throw new Error('No encontramos esa invitación');
    const lock = LockService.getScriptLock(); lock.waitLock(10000);
    try {
      const mem = rows_('Miembros').filter(x => x.familiaId === f.id);
      if (mem.some(m => String(m.email).toLowerCase() === u.email)) return pub_(familyOf_(u.email));
      if (mem.length >= 2) throw new Error('La familia ya está completa');
      const role = ['Juan', 'Christine'].find(r => !mem.some(m => m.rol === r));
      append_('Miembros', member_(f.id, Object.assign({}, p, { role }), u));
    } finally { lock.releaseLock(); }
    const ctx = familyOf_(u.email);
    try { sendWelcome_(u.email, Object.assign({}, p, { role: ctx.me.rol }), ctx.family); } catch (e) {}
    const other = ctx.members.find(m => m.email !== ctx.me.email);
    if (other) try { sendPartnerJoined_(other, ctx.me, ctx.family); } catch (e) {}
    return pub_(ctx);
  },

  sendInvite(p, u) {
    const ctx = familyOf_(u.email); if (!ctx) throw new Error('Primero crea tu familia');
    const link = CFG.APP_URL + '/?join=' + ctx.family.codigo + '&f=' + encodeURIComponent(ctx.family.nombre) + '&by=' + encodeURIComponent(ctx.me.rol);
    const L = ctx.me.idioma === 'en' ? 'en' : 'es';
    const t = L === 'es'
      ? { subj: ctx.me.apodo + ' te invita a la familia ' + ctx.family.nombre, kicker: 'Una invitación', title: 'Un solo ritmo, para los dos.', body: [ctx.me.apodo + ' creó «' + ctx.family.nombre + '» en The Gentle Stoic Parent y te guardó tu lugar.', 'Ahí vive nuestra rutina de mañana y noche, los recordatorios de cada uno y lo que vamos aprendiendo como equipo.'], cta: 'Unirme a la familia', foot: 'O entra con el código ' + ctx.family.codigo }
      : { subj: ctx.me.apodo + ' invites you to the ' + ctx.family.nombre + ' family', kicker: 'An invitation', title: 'One rhythm, for both of us.', body: [ctx.me.apodo + ' created "' + ctx.family.nombre + '" on The Gentle Stoic Parent and saved your place.', 'It holds our morning and evening rhythm, each of our reminders, and what we learn as a team.'], cta: 'Join the family', foot: 'Or use the code ' + ctx.family.codigo };
    send_('invite', p.to, t.subj, tpl_({ lang: L, kicker: t.kicker, title: t.title, paragraphs: t.body, cta: { label: t.cta, url: link }, note: t.foot, image: 'mail-invite.jpg' }));
    return { sent: true };
  },

  saveNote(p, u) {
    const ctx = familyOf_(u.email); if (!ctx) throw new Error('Sin familia');
    const n = p.note;
    append_('Notas', { familiaId: ctx.family.id, id: n.id, fecha: n.at, autor: ctx.me.rol, visibilidad: n.vis, funciono: n.worked, atasco: n.stuck, ajuste: n.tweak, mochilas: n.bags ? 1 : 0, ropa: n.clothes ? 1 : 0, desayuno: n.breakfast ? 1 : 0, idea: n.idea || '' });
    const other = ctx.members.find(m => m.email !== ctx.me.email);
    if (other && n.vis === 'shared' && other.avisosCorreo !== 'no') sendNoteShared_(other, ctx.me, n);
    return { saved: true };
  },

  listNotes(p, u) {
    const ctx = familyOf_(u.email); if (!ctx) return [];
    return rows_('Notas').filter(r => r.familiaId === ctx.family.id && (r.visibilidad === 'shared' || r.autor === ctx.me.rol))
      .map(r => ({ id: r.id, at: Number(r.fecha), author: r.autor, vis: r.visibilidad, worked: r.funciono, stuck: r.atasco, tweak: r.ajuste, bags: r.mochilas == 1, clothes: r.ropa == 1, breakfast: r.desayuno == 1, idea: r.idea || '' }));
  },

  uploadFile(p, u) {
    const ctx = familyOf_(u.email); if (!ctx) throw new Error('Sin familia');
    const blob = Utilities.newBlob(Utilities.base64Decode(p.base64), p.mime, p.name);
    const file = DriveApp.getFolderById(CFG.FOLDER_ID).createFile(blob);
    const rec = { familiaId: ctx.family.id, fecha: Date.now(), autor: ctx.me.rol, nombre: file.getName(), driveId: file.getId(), enlace: file.getUrl() };
    append_('Archivos', rec);
    return { name: rec.nombre, link: rec.enlace, author: rec.autor, at: rec.fecha };
  },

  listFiles(p, u) {
    const ctx = familyOf_(u.email); if (!ctx) return [];
    return rows_('Archivos').filter(r => r.familiaId === ctx.family.id).map(r => ({ name: r.nombre, link: r.enlace, author: r.autor, at: Number(r.fecha) }));
  },

  setPrefs(p, u) {
    const ctx = familyOf_(u.email); if (!ctx) throw new Error('Sin familia');
    const m = ctx.me;
    if (p.lang) m.idioma = p.lang;
    if (p.calendarId) m.calendarId = p.calendarId;
    if (p.emails != null) m.avisosCorreo = p.emails ? 'si' : 'no';
    update_('Miembros', m.__row, m);
    return pub_(familyOf_(u.email));
  },

  // Zona horaria de la familia: solo quien la creó puede cambiarla
  setFamily(p, u) {
    const ctx = familyOf_(u.email); if (!ctx) throw new Error('Sin familia');
    if (ctx.me.rol !== ctx.family.creadoPor) throw new Error('Solo quien creó la familia puede cambiar la zona horaria.');
    if (p.tz) { ctx.family.zona = String(p.tz); update_('Familias', ctx.family.__row, ctx.family); }
    return pub_(familyOf_(u.email));
  },

  // Color de cada padre (perfil)
  setColor(p, u) {
    const ctx = familyOf_(u.email); if (!ctx) throw new Error('Sin familia');
    const c = String(p.color || '');
    if (!/^#[0-9a-fA-F]{6}$/.test(c)) throw new Error('Color no válido');
    if (ctx.members.some(m => m.rol !== ctx.me.rol && String(m.color || '').toLowerCase() === c.toLowerCase())) throw new Error('Ese color ya lo usa tu pareja.');
    ctx.me.color = c; update_('Miembros', ctx.me.__row, ctx.me);
    return { saved: true };
  },

  // Alma por voz (el menú compartido del Hub de Spacio AM, con su agente familiar aparte).
  // Disponible para la familia del dueño del script y para las que estén en la propiedad ALMA_FAMILIAS (ids separados por coma).
  almaFicha(p, u) {
    const ctx = familyOf_(u.email); if (!ctx) throw new Error('Sin familia');
    if (!almaPermitida_(ctx)) throw new Error('Alma no está activada para esta familia');
    const props = PropertiesService.getScriptProperties();
    const me = ctx.me, otros = ctx.members.filter(m => m.rol !== me.rol);
    const nom = m => (m.apodo || m.nombre || m.rol);
    const en = String(p.lang || me.idioma || 'es') === 'en';
    let hub = { admin: false }; try { hub = almaHub_(ctx) || hub; } catch (e) { console.error('almaHub_: ' + e); }
    const ficha = [
      'Hablas con ' + nom(me) + (me.nombre && me.nombre !== nom(me) ? ' (' + me.nombre + ')' : '') + ', de la familia ' + (ctx.family.nombre || '') + '.',
      otros.length ? 'Su pareja y compañero de equipo: ' + otros.map(nom).join(', ') + '.' : '',
      'Zona horaria de la familia: ' + (ctx.family.zona || CFG.TZ) + '.',
      en ? 'Prefers English: answer in English unless they speak Spanish.' : ''
    ].filter(Boolean).join('\n');
    return {
      ok: true,
      agent_id: props.getProperty('ALMA_AGENT_ID') || 'agent_7201m5sr6rhvfg9vsf7227s8verp',
      dynamic_variables: { ficha: ficha + '\n' + (hub.admin ? 'Es ' + (hub.principal ? 'el administrador principal' : 'administrador') + ' de Spacio AM: la misma persona del Hub. Si te pide algo concreto de trabajo, puedes usar secretaria.' : 'No es administrador de Spacio AM: no uses secretaria.'), sa_web: hub.sa_web || '' },
      first_message: en ? 'Hi ' + nom(me) + '! I\'m here. How\'s everything going?' : '¡Hola, ' + nom(me) + '! Aquí estoy. ¿Cómo va todo?',
      language: en ? 'en' : 'es',
    };
  },
  // El Hub confirma un pase de almaFicha (un solo uso, 2 min): así sabe quién es sin compartir contraseñas ni sesiones.
  almaVerificar(p) {
    const c = CacheService.getScriptCache(), k = 'almapase_' + String(p.pase || '').slice(0, 80), v = c.get(k);
    if (!v) throw new Error('Pase no válido');
    c.remove(k);
    return JSON.parse(v);
  },
  almaGuardar(p, u) {
    const ctx = familyOf_(u.email); if (!ctx) throw new Error('Sin familia');
    if (!almaPermitida_(ctx)) throw new Error('Alma no está activada para esta familia');
    const conv = String(p.conv || '').slice(0, 80), msgs = Array.isArray(p.msgs) ? p.msgs.slice(0, 200) : [];
    const sh = sh_('Alma'), filas = msgs.filter(m => m && m.x).map(m => [ctx.family.id, new Date(Number(m.t) || Date.now()).toISOString(), ctx.me.rol, conv, m.o === 'ai' ? 'Alma' : ctx.me.rol, String(m.x).slice(0, 4000)]);
    if (filas.length) sh.getRange(sh.getLastRow() + 1, 1, filas.length, TABS.Alma.length).setValues(filas);
    return { saved: filas.length };
  },

  // Repositorio de ideas (notas de equipo convertidas en fichas de la biblioteca)
  saveIdea(p, u) {
    const ctx = familyOf_(u.email); if (!ctx) throw new Error('Sin familia');
    const g = p.idea || {}; if (!g.id) throw new Error('Idea sin id');
    const rec = { familiaId: ctx.family.id, id: g.id, fecha: g.at || Date.now(), notaId: g.noteId || '', autor: g.author || ctx.me.rol, estado: g.status || 'done', json: JSON.stringify(g) };
    const ex = rows_('Ideas').find(r => r.familiaId === ctx.family.id && r.id === g.id);
    if (ex) update_('Ideas', ex.__row, rec); else append_('Ideas', rec);
    return { saved: true };
  },
  // Menú de desayunos de la semana (compartido por la familia)
  setMenu(p, u) {
    const ctx = familyOf_(u.email); if (!ctx) throw new Error('Sin familia');
    const plan = p.plan || {}; const ok = ['1', '2', '3', '4', '5', 'b'].every(k => /^b[\w-]*$/.test(String(plan[k] || '')));
    if (!ok) throw new Error('Menú no válido');
    const rec = { familiaId: ctx.family.id, fecha: Date.now(), autor: ctx.me.rol, json: JSON.stringify(plan) };
    const ex = rows_('Menus').find(r => r.familiaId === ctx.family.id);
    if (ex) update_('Menus', ex.__row, rec); else append_('Menus', rec);
    return { saved: true };
  },
  getMenu(p, u) {
    const ctx = familyOf_(u.email); if (!ctx) return {};
    const ex = rows_('Menus').find(r => r.familiaId === ctx.family.id); if (!ex) return {};
    try { return { plan: JSON.parse(ex.json), by: ex.autor, at: ex.fecha }; } catch (e) { return {}; }
  },
  listIdeas(p, u) {
    const ctx = familyOf_(u.email); if (!ctx) return [];
    return rows_('Ideas').filter(r => r.familiaId === ctx.family.id).map(r => { try { return JSON.parse(r.json); } catch (e) { return null; } }).filter(Boolean);
  },

  // IA (preguntas y repositorio de ideas): guarda tu clave en Propiedades del script → ANTHROPIC_KEY
  ask(p) {
    const key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_KEY');
    if (!key) throw new Error('NO_AI_KEY');
    const r = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify(Object.assign({ model: PropertiesService.getScriptProperties().getProperty('ANTHROPIC_MODEL') || 'claude-sonnet-4-5', max_tokens: Math.min(Number(p.max_tokens) || 900, 2000), messages: [{ role: 'user', content: String(p.prompt || '') }] }, p.system ? { system: String(p.system) } : {})),
    });
    const j = JSON.parse(r.getContentText());
    if (j.error) throw new Error(j.error.message);
    return { text: j.content.map(c => c.text || '').join('') };
  },
};

function pwUser_(p) {
  const em = String(p.email || '').toLowerCase().trim();
  if (!/^\S+@\S+\.\S+$/.test(em)) throw new Error('Correo no válido');
  if (String(p.password || '').length < 8) throw new Error('La contraseña necesita al menos 8 caracteres.');
  return { email: em, name: p.fullName || '' };
}
function verifySession_(s) {
  const em = String(s.email || '').toLowerCase();
  const m = rows_('Miembros').find(x => String(x.email).toLowerCase() === em && x.sesion && x.sesion === s.key);
  if (!m) throw new Error('Tu sesión caducó. Vuelve a entrar.');
  return { email: em, name: m.apodo };
}
function hash_(email, pass) {
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(email).toLowerCase().trim() + ':' + pass, Utilities.Charset.UTF_8);
  return b.map(x => ('0' + (x & 0xff).toString(16)).slice(-2)).join('');
}
function passwordLogin_(p) {
  const em = String(p.email || '').toLowerCase().trim(), h = hash_(em, p.password || '');
  const m = rows_('Miembros').find(x => (String(x.email).toLowerCase() === em || String(x.correoContacto).toLowerCase() === em) && x.claveHash && x.claveHash === h);
  if (!m) { Utilities.sleep(800); throw new Error('Correo o contraseña incorrectos.'); }
  const ctx = familyOf_(String(m.email).toLowerCase());
  if (!ctx || !ctx.family) throw new Error('Tu usuario existe pero su familia no se encontró en la hoja.');
  return pub_(ctx);
}
function member_(famId, p, u) {
  return { familiaId: famId, rol: p.role, email: u.email, nombre: p.fullName || u.name, apodo: p.nick || (p.fullName || u.name || '').split(' ')[0],
    correoContacto: p.email || u.email, idioma: p.lang || 'es', calendarId: p.calendarId || '', unido: new Date().toISOString(), avisosCorreo: 'si',
    claveHash: p.password ? hash_(p.email || u.email, p.password) : '', sesion: Utilities.getUuid(), googleEmail: p.method === 'google' ? u.email : '' };
}

// ---------------- Emails ----------------
function send_(tipo, to, subject, html) {
  try {
    const opts = { htmlBody: html, name: CFG.SENDER_NAME, replyTo: CFG.REPLY_TO };
    if (CFG.FROM && GmailApp.getAliases().map(a => a.toLowerCase()).indexOf(CFG.FROM.toLowerCase()) >= 0) opts.from = CFG.FROM;
    GmailApp.sendEmail(to, subject, html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), opts);
    append_('Correos', { fecha: new Date().toISOString(), tipo, para: to, asunto: subject, estado: 'enviado' });
  } catch (e) {
    append_('Correos', { fecha: new Date().toISOString(), tipo, para: to, asunto: subject, estado: 'error: ' + e.message });
    throw e;
  }
}
function sendWelcome_(to, p, fam) {
  const es = (p.lang || 'es') === 'es', nick = p.nick || (p.fullName || '').split(' ')[0] || p.role;
  send_('bienvenida', to, es ? 'Bienvenida a casa, ' + nick : 'Welcome home, ' + nick, tpl_({
    lang: es ? 'es' : 'en', image: 'mail-welcome.jpg',
    kicker: es ? 'Familia ' + fam.nombre : 'The ' + fam.nombre + ' family',
    title: es ? 'Un regreso tranquilo a la estabilidad.' : 'A quiet return to steadiness.',
    paragraphs: es
      ? ['Hola ' + nick + ',', 'Ya tienes tu lugar como ' + p.role + '. Tu calendario «Nuestro ritmo» te irá avisando a la hora exacta: la mañana, el relevo, la noche.', 'No hace falta hacerlo perfecto. Solo pausa, observa, respira.']
      : ['Hi ' + nick + ',', 'Your place as ' + p.role + ' is ready. Your “Our rhythm” calendar will nudge you right on time: the morning, the hand-off, the evening.', "It doesn't need to be perfect. Just pause, observe, breathe."],
    cta: { label: es ? 'Abrir mi día' : 'Open my day', url: CFG.APP_URL },
    quote: es ? 'Los hogares tranquilos los construyen padres estables.' : 'Calm homes are built by steady parents.',
  }));
}
function sendPartnerJoined_(to, who, fam) {
  const es = to.idioma !== 'en';
  send_('pareja', to.email, es ? who.apodo + ' ya está en casa' : who.apodo + ' is home', tpl_({
    lang: es ? 'es' : 'en', image: 'mail-partner.jpg',
    kicker: es ? 'Familia ' + fam.nombre : 'The ' + fam.nombre + ' family',
    title: es ? 'Ahora somos dos.' : 'Now there are two of us.',
    paragraphs: es ? [who.apodo + ' se unió como ' + who.rol + '. Desde hoy cada uno ve su parte del día y la del otro.'] : [who.apodo + ' joined as ' + who.rol + '. From today each of you sees your part of the day, and each other’s.'],
    cta: { label: es ? 'Ver nuestro día' : 'See our day', url: CFG.APP_URL },
  }));
}
function sendNoteShared_(to, from, n) {
  const es = to.idioma !== 'en';
  const rows = [[es ? 'Qué funcionó' : 'What worked', n.worked], [es ? 'Dónde nos atoramos' : 'Where we got stuck', n.stuck], [es ? 'Un ajuste para mañana' : 'One tweak for tomorrow', n.tweak], [es ? 'Una idea o acuerdo' : 'An idea or agreement', n.idea]].filter(r => r[1]);
  send_('nota', to.email, es ? from.apodo + ' dejó una nota del día' : from.apodo + ' left a note about today', tpl_({
    lang: es ? 'es' : 'en', image: 'mail-note.jpg', kicker: es ? 'Nota de equipo' : 'Team note',
    title: es ? 'Cinco minutos, los dos.' : 'Five minutes, the two of us.', rows,
    cta: { label: es ? 'Responder en la app' : 'Reply in the app', url: CFG.APP_URL + '/#equipo' },
  }));
}

/** Resumen semanal (domingo 7 pm). Activar con: instalarTriggers() */
function weeklyDigest() {
  const fams = rows_('Familias'), mem = rows_('Miembros'), notes = rows_('Notas');
  const since = Date.now() - 7 * 864e5;
  fams.forEach(f => {
    const ns = notes.filter(n => n.familiaId === f.id && Number(n.fecha) > since && n.visibilidad === 'shared');
    mem.filter(m => m.familiaId === f.id && m.avisosCorreo !== 'no').forEach(m => {
      const es = m.idioma !== 'en';
      const tweaks = ns.map(n => n.ajuste).filter(Boolean).slice(0, 5);
      send_('semanal', m.email, es ? 'Nuestra semana, en calma' : 'Our week, calmly', tpl_({
        lang: es ? 'es' : 'en', image: 'mail-weekly.jpg', kicker: es ? 'Resumen del domingo' : 'Sunday summary',
        title: es ? 'Lo que aprendimos esta semana.' : 'What we learned this week.',
        paragraphs: [es ? ns.length + ' notas compartidas esta semana.' : ns.length + ' shared notes this week.'],
        list: tweaks.length ? { title: es ? 'Ajustes que propusimos' : 'Tweaks we proposed', items: tweaks } : null,
        quote: es ? 'La sabiduría crece cuando hay espacio para pensar.' : 'Wisdom grows when there is space to think.',
        cta: { label: es ? 'Planear la semana' : 'Plan the week', url: CFG.APP_URL },
      }));
    });
  });
}
/** Recordatorio de la noche anterior (8:45 pm, dom–jue). */
function eveningPrep() {
  const d = new Date(); const dow = d.getDay(); if (dow === 5 || dow === 6) return;
  const TOMORROW_TAKE = { 0: 'Juan', 1: 'Christine', 2: 'Juan', 3: 'Christine', 4: 'Juan' }; // ajusta a tu semana
  rows_('Miembros').filter(m => m.avisosCorreo !== 'no').forEach(m => {
    const es = m.idioma !== 'en', take = TOMORROW_TAKE[dow] === m.rol;
    send_('noche', m.email, es ? 'Para mañana: ' + (take ? 'llevas a los niños' : 'mañana en casa') : 'Tomorrow: ' + (take ? 'school run' : 'home morning'), tpl_({
      lang: es ? 'es' : 'en', image: 'mail-evening.jpg', kicker: es ? 'Antes de dormir' : 'Before bed',
      title: es ? 'Mañana empieza esta noche.' : 'Tomorrow starts tonight.',
      list: { title: es ? 'Tres cosas, y listo' : 'Three things, and done', items: es ? ['Mochilas en la puerta', 'Ropa elegida', 'Desayuno pensado'] : ['Backpacks by the door', 'Clothes chosen', 'Breakfast planned'] },
      cta: { label: es ? 'Ver mañana' : 'See tomorrow', url: CFG.APP_URL },
    }));
  });
}
function instalarTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('weeklyDigest').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(19).inTimezone(CFG.TZ).create();
  ScriptApp.newTrigger('eveningPrep').timeBased().everyDays(1).atHour(20).nearMinute(45).inTimezone(CFG.TZ).create();
}
/** Prueba rápida: te envía el correo de bienvenida a ti mismo. */
function probarCorreo() {
  const me = Session.getActiveUser().getEmail();
  sendWelcome_(me, { lang: 'es', nick: 'Juan', role: 'Juan' }, { nombre: 'Prueba' });
}

// ---------------- Brand email template ----------------
function tpl_(o) {
  const INK = '#2A2F2B', SOFT = '#4A4A45', MUTED = '#8A857A', PAPER = '#F6F1E8', CARD = '#FBF8F2', OCHRE = '#A45F22', SAGE = '#557552', LINE = '#E3DCCD';
  const serif = "'Cormorant Garamond',Georgia,'Times New Roman',serif", sans = "'Helvetica Neue',Helvetica,Arial,sans-serif";
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cap = (t, col) => '<div style="font-family:' + sans + ';font-size:10px;letter-spacing:3.5px;text-transform:uppercase;color:' + (col || MUTED) + ';">' + esc(t) + '</div>';
  const p = (o.paragraphs || []).map(t => '<p style="margin:0 0 18px;font-family:' + serif + ';font-size:19px;line-height:1.7;color:' + SOFT + ';">' + esc(t) + '</p>').join('');
  const rows = (o.rows || []).map(r => '<tr><td style="padding:22px 0;border-top:1px solid ' + LINE + ';">' + cap(r[0]) + '<div style="padding-top:10px;font-family:' + serif + ';font-size:20px;line-height:1.6;color:' + INK + ';">' + esc(r[1]) + '</div></td></tr>').join('');
  const list = o.list ? '<div style="padding:10px 0 6px;">' + cap(o.list.title) + '</div>' + o.list.items.map((i, n) => '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="36" valign="top" style="padding:16px 0;border-top:1px solid ' + LINE + ';font-family:' + serif + ';font-style:italic;font-size:18px;color:' + OCHRE + ';">' + ('0' + (n + 1)).slice(-2) + '</td><td style="padding:16px 0;border-top:1px solid ' + LINE + ';font-family:' + serif + ';font-size:20px;line-height:1.5;color:' + INK + ';">' + esc(i) + '</td></tr></table>').join('') : '';
  const cta = o.cta ? '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:36px auto 6px;"><tr><td style="border:1px solid ' + INK + ';"><a href="' + o.cta.url + '" style="display:inline-block;padding:16px 38px;font-family:' + sans + ';font-size:11px;letter-spacing:3.5px;text-transform:uppercase;color:' + INK + ';text-decoration:none;">' + esc(o.cta.label) + '</a></td></tr></table>' : '';
  const note = o.note ? '<p style="margin:14px 0 0;text-align:center;font-family:' + sans + ';font-size:12px;letter-spacing:1px;color:' + MUTED + ';">' + esc(o.note) + '</p>' : '';
  const quote = o.quote ? '<tr><td style="padding:8px 56px 48px;text-align:center;"><div style="width:40px;height:1px;background:' + OCHRE + ';margin:0 auto 22px;"></div><p style="margin:0;font-family:' + serif + ';font-style:italic;font-size:24px;line-height:1.45;color:' + SAGE + ';">' + esc(o.quote) + '</p></td></tr>' : '';
  const img = o.image ? '<tr><td style="padding:0;"><img src="' + CFG.ASSETS + o.image + '" width="640" alt="" style="display:block;width:100%;max-width:640px;height:auto;border:0;"></td></tr>' : '';
  const en = o.lang === 'en';
  const foot = en ? 'You receive this because you are part of a family on The Gentle Stoic Parent.' : 'Recibes este correo porque eres parte de una familia en The Gentle Stoic Parent.';
  const sign = en ? 'With calm,' : 'Con calma,';
  return '<!doctype html><html lang="' + (o.lang || 'es') + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>' + esc(o.title) + '</title>'
    + '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">'
    + '<style>@media (max-width:620px){.px{padding-left:28px!important;padding-right:28px!important}.h1{font-size:34px!important}}</style></head>'
    + '<body style="margin:0;padding:0;background:' + PAPER + ';">'
    + '<div style="display:none;max-height:0;overflow:hidden;">' + esc(o.preheader || o.title) + '</div>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:' + PAPER + ';"><tr><td align="center" style="padding:36px 12px 48px;">'
    + '<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;">'
    + '<tr><td style="padding:0 0 28px;text-align:center;"><img src="' + CFG.ASSETS + 'logo-mark.png" width="56" alt="" style="display:block;margin:0 auto 14px;border:0;">' + cap('The Gentle Stoic Parent', INK) + '</td></tr>'
    + '<tr><td style="background:' + CARD + ';"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + img
    + '<tr><td class="px" style="padding:52px 64px 20px;text-align:center;">' + cap(o.kicker, OCHRE)
    + '<h1 class="h1" style="margin:18px 0 30px;font-family:' + serif + ';font-weight:400;font-size:42px;line-height:1.15;letter-spacing:-0.3px;color:' + INK + ';">' + esc(o.title) + '</h1>'
    + '<div style="width:40px;height:1px;background:' + LINE + ';margin:0 auto 30px;"></div></td></tr>'
    + '<tr><td class="px" style="padding:0 64px 12px;">' + p + (rows ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + rows + '</table>' : '') + list + cta + note + '</td></tr>'
    + '<tr><td class="px" style="padding:30px 64px 44px;text-align:center;"><p style="margin:0;font-family:' + serif + ';font-style:italic;font-size:18px;color:' + SOFT + ';">' + sign + '</p><p style="margin:6px 0 0;font-family:' + sans + ';font-size:10px;letter-spacing:3px;text-transform:uppercase;color:' + MUTED + ';">Mentor · The Gentle Stoic Parent</p></td></tr>'
    + quote + '</table></td></tr>'
    + '<tr><td style="padding:28px 24px 0;text-align:center;font-family:' + sans + ';font-size:11px;line-height:1.8;letter-spacing:0.5px;color:' + MUTED + ';">' + foot + '<br><a href="' + CFG.APP_URL + '" style="color:' + MUTED + ';text-decoration:none;letter-spacing:2px;text-transform:uppercase;font-size:10px;">thegentlestoicparent.com</a></td></tr>'
    + '</table></td></tr></table></body></html>';
}

/* The Gentle Stoic Parent · tenerla como app y activar los avisos, con Alma.
   GSPInstalar.revisar({ lang, nombre, email, appId }) — la app lo llama una vez por sesión, con el menú ya montado.
   · iPhone en Chrome u otro navegador → «Ábrela en Safari»: Alma (la piedra del botón) cubre la pantalla y te lleva a
     Safari con tu sesión; allá te recibe y te sugiere agregarla a la pantalla de inicio.
   · iPhone en Safari → cómo agregarla a la pantalla de inicio (se abre con un botón).
   · Android → el botón instala la app con el aviso del navegador.
   · Ya instalada (o en computadora) → un aviso para activar las notificaciones (OneSignal, como el Hub de Spacio AM).
   Cada aviso se puede posponer («Ahora no» = 2 días). */
(function (w, d) {
  'use strict';
  if (w.GSPInstalar) return;
  var ua = navigator.userAgent || '';
  var ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var otroNav = ios && /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Line\/|DuckDuckGo|YaBrowser/i.test(ua);
  var safariIOS = ios && !otroNav && /Safari/i.test(ua);
  var android = /Android/i.test(ua);
  function standalone() { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function pospuesto(k) { var t = +ls('gsp:inst:' + k) || 0; return Date.now() - t < 2 * 86400000; }
  function posponer(k) { ls('gsp:inst:' + k, String(Date.now())); }
  var L = null, C = {};
  var TX = {
    es: {
      safariT: 'Tenla como app en tu iPhone', safariB: 'Para agregarla a tu pantalla de inicio y recibir avisos, ábrela en Safari. Te llevo con tu sesión abierta.', safariBtn: 'Abrir en Safari',
      llevo: 'Te llevo a Safari…', llegamos: 'Ya estamos en Safari', noSafari: 'No pude abrir Safari desde aquí. Copia el enlace y pégalo en Safari.', copiar: 'Copiar enlace', copiado: 'Enlace copiado',
      homeT: 'Agrégala a tu pantalla de inicio', homeB: 'Así se abre como una app, a pantalla completa, y puede avisarte.', homeBtn: 'Cómo agregarla',
      paso1: 'Toca el botón Compartir (el cuadrito con la flecha hacia arriba). Si no lo ves, está dentro de «•••».', paso2: 'Elige «Agregar a inicio».', paso3: 'Toca «Agregar» y abre Gentle Stoic desde tu pantalla de inicio.', entendido: 'Entendido',
      andT: 'Instálala como app', andB: 'Se abre a pantalla completa desde tu pantalla de inicio y puede avisarte.', andBtn: 'Instalar',
      notT: 'Activa las notificaciones', notB: 'Te aviso lo importante del ritmo familiar: la noche antes, los recordatorios y lo que acuerden en equipo.', notBtn: 'Activar',
      notOk: 'Listo, ya te puedo avisar.', notNo: 'Las notificaciones están bloqueadas. Actívalas en Ajustes › Notificaciones › Gentle Stoic.', ahoraNo: 'Ahora no', cerrar: 'Cerrar'
    },
    en: {
      safariT: 'Keep it as an app on your iPhone', safariB: 'To add it to your Home Screen and get reminders, open it in Safari. I’ll take you there, still signed in.', safariBtn: 'Open in Safari',
      llevo: 'Taking you to Safari…', llegamos: 'Here we are in Safari', noSafari: 'I couldn’t open Safari from here. Copy the link and paste it in Safari.', copiar: 'Copy link', copiado: 'Link copied',
      homeT: 'Add it to your Home Screen', homeB: 'It opens like an app, full screen, and can send you reminders.', homeBtn: 'Show me how',
      paso1: 'Tap the Share button (the square with the arrow). If you don’t see it, it’s inside «•••».', paso2: 'Choose «Add to Home Screen».', paso3: 'Tap «Add» and open Gentle Stoic from your Home Screen.', entendido: 'Got it',
      andT: 'Install it as an app', andB: 'It opens full screen from your Home Screen and can send you reminders.', andBtn: 'Install',
      notT: 'Turn on notifications', notB: 'I’ll remind you of what matters in your family rhythm: the night before, your reminders and what you agree as a team.', notBtn: 'Turn on',
      notOk: 'Done, I can remind you now.', notNo: 'Notifications are blocked. Turn them on in Settings › Notifications › Gentle Stoic.', ahoraNo: 'Not now', cerrar: 'Close'
    }
  };

  /* ── estilos (prefijo gi-) ── */
  function css() {
    if (d.getElementById('gi-css')) return;
    var s = d.createElement('style'); s.id = 'gi-css';
    s.textContent = [
      '.gi-av{position:fixed;left:50%;top:calc(10px + env(safe-area-inset-top));z-index:2147483000;width:min(440px,calc(100% - 20px));transform:translate(-50%,-140%);opacity:0;',
      'background:rgba(255,254,251,.86);-webkit-backdrop-filter:blur(22px) saturate(160%);backdrop-filter:blur(22px) saturate(160%);border:1px solid rgba(255,255,255,.7);border-radius:26px;',
      'box-shadow:0 18px 44px rgba(60,48,36,.18),0 2px 6px rgba(60,48,36,.08);padding:14px 14px 14px 12px;display:grid;grid-template-columns:44px 1fr;gap:12px;font-family:Figtree,system-ui,sans-serif;color:#2A2F2B}',
      '.gi-av.on{transform:translate(-50%,0);opacity:1;transition:transform .62s cubic-bezier(.2,1.25,.3,1),opacity .25s ease}',
      '.gi-av.out{transform:translate(-50%,-140%);opacity:0;transition:transform .38s cubic-bezier(.5,0,.75,0),opacity .3s ease .08s}',
      '.gi-al{width:44px;height:44px;border-radius:50%;position:relative;background:radial-gradient(circle at 40% 34%,#F7F5F2 0%,#EFECE8 45%,#E3DFDA 80%,#D3CEC8 100%);box-shadow:inset -5px -7px 12px rgba(90,80,70,.2),inset 4px 5px 9px rgba(255,255,255,.5),0 0 0 2.5px var(--san-t2,#EE7552),0 0 14px 2px color-mix(in srgb,var(--san-t2,#EE7552) 40%,transparent);display:grid;place-items:center;color:#C9C1B8}',
      '.gi-al svg{width:13px;height:13px}',
      '.gi-tx{display:flex;flex-direction:column;gap:3px;min-width:0}.gi-t{font-weight:600;font-size:15px;line-height:1.3}.gi-b{font-size:14px;line-height:1.45;color:#5E5D57}',
      '.gi-bs{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}',
      '.gi-btn{min-height:40px;padding:0 16px;border-radius:999px;border:0;background:var(--accBtn,#F7C49C);color:var(--accInk,#2A2F2B);font:600 14px Figtree,system-ui,sans-serif;cursor:pointer;transition:transform .15s cubic-bezier(.2,.8,.2,1)}',
      '.gi-btn:active{transform:scale(.96)}.gi-btn.gi-sec{background:transparent;color:#6B6A63;font-weight:500;padding:0 10px}',
      '.gi-sh{position:fixed;inset:0;z-index:2147483100;background:rgba(42,47,43,.32);display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity .25s ease}',
      '.gi-sh.on{opacity:1}.gi-shp{width:min(520px,100%);background:#FBF9F5;border-radius:28px 28px 0 0;padding:22px 22px calc(22px + env(safe-area-inset-bottom));transform:translateY(100%);transition:transform .45s cubic-bezier(.32,.72,0,1);font-family:Figtree,system-ui,sans-serif;color:#2A2F2B}',
      '.gi-sh.on .gi-shp{transform:none}.gi-sht{font:400 24px/1.2 Literata,Georgia,serif;margin:0 0 16px}',
      '.gi-st{display:grid;grid-template-columns:32px 1fr;gap:12px;align-items:start;margin-bottom:14px;font-size:15px;line-height:1.5}',
      '.gi-n{width:32px;height:32px;border-radius:50%;background:#2A2F2B;color:#FBF9F5;display:grid;place-items:center;font-weight:600;font-size:13px}',
      '.gi-ar{display:flex;justify-content:center;margin-top:6px;color:var(--san-t2,#EE7552);animation:gi-b 1.4s ease-in-out infinite}',
      '@keyframes gi-b{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}',
      '@media (prefers-reduced-motion:reduce){.gi-av.on,.gi-av.out{transition:opacity .2s ease}.gi-ar{animation:none}}'
    ].join('');
    d.head.appendChild(s);
  }
  var SPARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.5c.4 4.6 1.6 6.2 7 7.5-5.4 1.3-6.6 2.9-7 9.5-.4-6.6-1.6-8.2-7-9.5 5.4-1.3 6.6-2.9 7-7.5z"/></svg>';
  var actual = null;
  function quitar(el) { if (!el) return; el.classList.remove('on'); el.classList.add('out'); setTimeout(function () { el.remove(); }, 450); if (actual === el) actual = null; }
  /* Aviso de Alma arriba (como una notificación del teléfono). */
  function aviso(o) {
    css(); quitar(actual);
    var el = d.createElement('div'); el.className = 'gi-av'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<span class="gi-al">' + SPARK + '</span><div class="gi-tx"><span class="gi-t"></span><span class="gi-b"></span><div class="gi-bs"></div></div>';
    el.querySelector('.gi-t').textContent = o.titulo || ''; el.querySelector('.gi-b').textContent = o.texto || '';
    var bs = el.querySelector('.gi-bs');
    (o.botones || []).forEach(function (b) {
      var x = d.createElement('button'); x.type = 'button'; x.className = 'gi-btn' + (b.sec ? ' gi-sec' : ''); x.textContent = b.l;
      x.onclick = function () { b.f(el); }; bs.appendChild(x);
    });
    d.body.appendChild(el); actual = el;
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('on'); }); });
    if (o.dura) setTimeout(function () { quitar(el); }, o.dura);
    return el;
  }
  function hoja(titulo, pasos, boton) {
    css();
    var el = d.createElement('div'); el.className = 'gi-sh';
    el.innerHTML = '<div class="gi-shp" role="dialog" aria-modal="true"><h2 class="gi-sht"></h2><div class="gi-ps"></div><button type="button" class="gi-btn" style="width:100%;min-height:48px;margin-top:6px"></button><div class="gi-ar" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg></div></div>';
    el.querySelector('.gi-sht').textContent = titulo;
    var ps = el.querySelector('.gi-ps');
    pasos.forEach(function (p, i) { var r = d.createElement('div'); r.className = 'gi-st'; r.innerHTML = '<span class="gi-n">' + (i + 1) + '</span><span></span>'; r.lastChild.textContent = p; ps.appendChild(r); });
    var cerrar = function () { el.classList.remove('on'); setTimeout(function () { el.remove(); }, 320); };
    el.querySelector('.gi-btn').textContent = boton; el.querySelector('.gi-btn').onclick = cerrar;
    el.onclick = function (e) { if (e.target === el) cerrar(); };
    d.body.appendChild(el); requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('on'); }); });
  }

  /* ── Chrome → Safari, con Alma ── */
  function enlaceSafari(conSesion) {
    var u = location.origin + location.pathname + '?llegada=safari';
    if (!conSesion) return u;
    try {
      var j = function (k) { try { return JSON.parse(localStorage.getItem('gsp:' + k) || 'null'); } catch (e) { return null; } };
      var data = { session: j('session'), sess: j('sess'), family: j('family'), clientId: ls('gsp:clientId') || '' };
      if (!data.session || !data.sess) return u;
      return u + '#gsp_sso=' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(data)))));
    } catch (e) { return u; }
  }
  function irASafari(el) {
    quitar(el); posponer('safari');
    var P = w.SANav && SANav.portal ? SANav.portal('out', { texto: L.llevo }) : Promise.resolve(function () { return Promise.resolve(); });
    P.then(function (deshacer) {
      var se_fue = false, onVis = function () {
        if (d.visibilityState === 'hidden') { se_fue = true; return; }
        if (se_fue) { d.removeEventListener('visibilitychange', onVis); deshacer(); }   // volvió a Chrome: Alma lo devuelve
      };
      d.addEventListener('visibilitychange', onVis);
      location.href = 'x-safari-' + enlaceSafari(true);
      setTimeout(function () {
        if (se_fue || d.visibilityState === 'hidden') return;
        d.removeEventListener('visibilitychange', onVis);
        deshacer().then(function () {
          aviso({ titulo: L.safariT, texto: L.noSafari, botones: [{ l: L.copiar, f: function (a) { try { navigator.clipboard.writeText(enlaceSafari(false)); } catch (e) {} a.querySelector('.gi-b').textContent = L.copiado; setTimeout(function () { quitar(a); }, 1400); } }, { l: L.cerrar, sec: true, f: quitar }] });
        });
      }, 1800);
    });
  }

  /* ── Avisos push (OneSignal, igual que el Hub) ── */
  var OSp = null;
  function cargarOS() {
    if (OSp) return OSp;
    OSp = new Promise(function (ok, ko) {
      w.OneSignalDeferred = w.OneSignalDeferred || [];
      var s = d.createElement('script'); s.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'; s.defer = true;
      s.onerror = function (e) { OSp = null; ko(e); }; d.head.appendChild(s);
      w.OneSignalDeferred.push(function (OS) {
        OS.init({ appId: C.appId, serviceWorkerPath: 'OneSignalSDKWorker.js', serviceWorkerParam: { scope: '/' }, notifyButton: { enable: false } })
          .then(function () { ok(OS); }, function (e) { OSp = null; ko(e); });
      });
    });
    return OSp;
  }
  function pushPosible() { return !!C.appId && 'serviceWorker' in navigator && 'Notification' in w && (!ios || standalone()); }
  function activarPush(el) {
    var perm; try { perm = Notification.permission === 'default' ? Notification.requestPermission() : Notification.permission; } catch (e) { perm = Notification.permission; }
    Promise.resolve(perm).then(function (p) {
      if (p !== 'granted') { if (el) { el.querySelector('.gi-b').textContent = L.notNo; setTimeout(function () { quitar(el); }, 4200); } return; }
      if (el) { el.querySelector('.gi-b').textContent = L.notOk; el.querySelector('.gi-bs').innerHTML = ''; setTimeout(function () { quitar(el); }, 2200); }
      ls('gsp:push', '1');
      return cargarOS().then(function (OS) {
        return (C.email ? OS.login(C.email) : Promise.resolve()).catch(function () {}).then(function () { return OS.User.PushSubscription.optIn(); });
      }).catch(function (e) { console.error('push', e); });
    });
  }
  /* Ya activadas: mantiene el dispositivo ligado a su correo. */
  function reanudarPush() {
    if (!pushPosible() || Notification.permission !== 'granted') return;
    cargarOS().then(function (OS) {
      var actualId = ''; try { actualId = String(OS.User.externalId || '').toLowerCase(); } catch (e) {}
      return (C.email && actualId !== C.email ? OS.login(C.email) : Promise.resolve()).then(function () { if (!OS.User.PushSubscription.optedIn && ls('gsp:push') !== '0') return OS.User.PushSubscription.optIn(); });
    }).catch(function () {});
  }
  function ofrecerPush() {
    if (!pushPosible()) return false;
    if (Notification.permission === 'granted') { reanudarPush(); return false; }
    if (Notification.permission === 'denied' || pospuesto('push')) return false;
    aviso({ titulo: L.notT, texto: L.notB, botones: [{ l: L.notBtn, f: activarPush }, { l: L.ahoraNo, sec: true, f: function (el) { posponer('push'); quitar(el); } }] });
    return true;
  }

  function sugerirInicio() {
    aviso({ titulo: L.homeT, texto: L.homeB, botones: [
      { l: L.homeBtn, f: function (el) { quitar(el); posponer('home'); hoja(L.homeT, [L.paso1, L.paso2, L.paso3], L.entendido); } },
      { l: L.ahoraNo, sec: true, f: function (el) { posponer('home'); quitar(el); } }] });
  }

  var hecho = false;
  w.GSPInstalar = {
    revisar: function (o) {
      o = o || {}; C = { appId: o.appId || '', email: String(o.email || '').toLowerCase() };
      L = TX[o.lang === 'en' ? 'en' : 'es'];
      var llegada = /[?&]llegada=safari/.test(location.search);
      if (llegada) {
        try { history.replaceState(null, '', location.pathname); } catch (e) {}
        var P = w.SANav && SANav.portal ? SANav.portal('in', { texto: L.llegamos }) : Promise.resolve();
        requestAnimationFrame(function () { d.documentElement.classList.remove('gsp-llegando'); });
        P.then(function () { if (!standalone() && safariIOS) setTimeout(sugerirInicio, 500); });
        hecho = true; return;
      }
      if (hecho) return; hecho = true;
      setTimeout(function () {
        if (standalone()) { ofrecerPush(); return; }
        if (otroNav) { if (!pospuesto('safari')) aviso({ titulo: L.safariT, texto: L.safariB, botones: [{ l: L.safariBtn, f: irASafari }, { l: L.ahoraNo, sec: true, f: function (el) { posponer('safari'); quitar(el); } }] }); return; }
        if (safariIOS) { if (!pospuesto('home')) sugerirInicio(); return; }
        if (android && w.__gspInstalar && !pospuesto('android')) {
          aviso({ titulo: L.andT, texto: L.andB, botones: [{ l: L.andBtn, f: function (el) { quitar(el); var e = w.__gspInstalar; w.__gspInstalar = null; try { e.prompt(); e.userChoice.then(function (r) { if (r && r.outcome === 'accepted') setTimeout(ofrecerPush, 1500); }); } catch (x) {} } },
            { l: L.ahoraNo, sec: true, f: function (el) { posponer('android'); quitar(el); } }] });
          return;
        }
        ofrecerPush();
      }, 1800);
    },
    /* para probar o volver a mostrar: borra los «Ahora no» */
    reiniciar: function () { ['safari', 'home', 'android', 'push'].forEach(function (k) { ls('gsp:inst:' + k, null); }); hecho = false; }
  };
})(window, document);

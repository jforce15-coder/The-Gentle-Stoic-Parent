/* The Gentle Stoic Parent · llegada (corre en <head>, antes de la app).
   · Sesión que viaja de Chrome a Safari en el #fragmento (nunca llega a ningún servidor): se guarda y se limpia la URL.
   · Si venimos de «Abrir en Safari», la pantalla empieza cubierta por la piedra de Alma: ella termina la entrada.
   · Android: guarda el aviso de instalación del navegador para ofrecerlo con un botón. */
(function () {
  try {
    var m = location.hash.match(/[#&]gsp_sso=([^&]+)/);
    if (m) {
      var d = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
      if (d && d.session && d.sess) { ['session', 'sess', 'family'].forEach(function (k) { if (d[k]) localStorage.setItem('gsp:' + k, JSON.stringify(d[k])); }); if (d.clientId) localStorage.setItem('gsp:clientId', d.clientId); }
      history.replaceState(null, '', location.pathname + location.search);
    }
  } catch (e) {}
  try {
    if (/[?&]llegada=safari/.test(location.search) && localStorage.getItem('gsp:session')) {
      var s = document.createElement('style');
      s.textContent = 'html.gsp-llegando::after{content:"";position:fixed;inset:0;z-index:2147483500;background:radial-gradient(circle at 50% 45%,#F7F5F2 0%,#EFECE8 45%,#E3DFDA 100%)}';
      document.head.appendChild(s); document.documentElement.classList.add('gsp-llegando');
      setTimeout(function () { document.documentElement.classList.remove('gsp-llegando'); }, 6000);   // red de seguridad
    }
  } catch (e) {}
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); window.__gspInstalar = e; });
})();

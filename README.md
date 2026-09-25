# The Gentle Stoic Parent

Web app del ritmo familiar de Juan y Christine: rutina de mañana y noche por rol, recordatorios y bloques en Google Calendar, biblioteca con la filosofía, notas de equipo, documentos descargables y archivos en Google Drive.

Es un sitio estático (HTML + JS), sin servidor ni compilación. Se publica gratis con GitHub Pages.

---

## Qué hay en esta carpeta

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La app completa |
| `support.js` | Motor que dibuja la app (no editar) |
| `kb.js` | Base de conocimiento: rutinas, principios, acuerdos, situaciones, cuentos, desayunos (ES/EN) |
| `google.js` | Conexión con Google: inicio de sesión, Calendar, Sheets y Drive |
| `config.js` | **Aquí pegas tu Client ID de Google** |
| `img/` | Ilustraciones de los manuales |
| `docs/` | Manual y póster en PDF (ES/EN) y sus portadas |
| `.nojekyll` | Le dice a GitHub Pages que sirva los archivos tal cual |

---

## Paso 1 · Subir a GitHub y publicar

1. Entra a [github.com](https://github.com) y crea una cuenta si no tienes.
2. Arriba a la derecha: **+ → New repository**.
   - Nombre: `gentle-stoic-parent`
   - Visibilidad: **Public** (GitHub Pages gratis requiere público; los datos de la familia NO viven aquí, viven en tu Google Sheet).
   - Clic en **Create repository**.
3. En la página del repositorio vacío, clic en **uploading an existing file**.
4. Arrastra **todo el contenido** de esta carpeta (no la carpeta en sí): `index.html`, `support.js`, `kb.js`, `google.js`, `config.js`, `.nojekyll`, y las carpetas `img` y `docs`.
   - Si `.nojekyll` no se ve en tu computadora (archivo oculto), no pasa nada grave; puedes crearlo después con **Add file → Create new file**, nombre `.nojekyll`, vacío.
5. Clic en **Commit changes**.
6. Ve a **Settings → Pages**.
   - Source: **Deploy from a branch**
   - Branch: **main** · carpeta **/ (root)** → **Save**.
7. Espera 1–2 minutos. Arriba aparecerá tu dirección:
   `https://TU-USUARIO.github.io/gentle-stoic-parent/`

Ábrela: ya funciona en **modo demostración**. Guarda esa dirección, la necesitas en el paso 2.

---

## Paso 2 · Crear el proyecto en Google Cloud

Esto es lo que permite el inicio de sesión oficial con Google, crear el calendario y guardar datos en la hoja.

### 2.1 Proyecto
1. Entra a [console.cloud.google.com](https://console.cloud.google.com) con tu cuenta de Google.
2. Arriba, selector de proyectos → **New project** → nombre `Gentle Stoic Parent` → **Create**.
3. Asegúrate de que el proyecto nuevo esté seleccionado arriba.

### 2.2 Activar las APIs
Menú ☰ → **APIs & Services → Library**. Busca y pulsa **Enable** en cada una:
- **Google Calendar API**
- **Google Sheets API**
- **Google Drive API**

### 2.3 Pantalla de consentimiento (OAuth consent screen)
Menú ☰ → **APIs & Services → OAuth consent screen** (en la versión nueva se llama **Google Auth Platform → Branding / Audience / Data access**).
1. **App name:** The Gentle Stoic Parent · **User support email:** tu correo.
2. **Audience / User type:** **External**.
3. **Developer contact:** tu correo → guardar.
4. **Data access / Scopes → Add or remove scopes**, agrega:
   - `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive`
5. **Audience → Test users → Add users:** agrega **los dos Gmail** (el de Juan y el de Christine).
6. Deja la app en estado **Testing**. Para dos personas es suficiente y no necesitas la verificación de Google.

### 2.4 Crear el Client ID
Menú ☰ → **APIs & Services → Credentials → + Create credentials → OAuth client ID**.
1. **Application type:** **Web application**.
2. **Name:** GitHub Pages.
3. **Authorized JavaScript origins → + Add URI:**
   `https://TU-USUARIO.github.io`
   (solo el dominio: sin `/gentle-stoic-parent/` y sin `/` al final).
4. **Authorized redirect URIs:** déjalo vacío.
5. **Create** → copia el **Client ID** (termina en `.apps.googleusercontent.com`).

> Los cambios de orígenes pueden tardar de 5 minutos a unas horas en aplicarse.

---

## Paso 3 · Pegar el Client ID en la app

1. En GitHub, abre `config.js` → ícono del lápiz (**Edit**).
2. Pega tu Client ID entre las comillas:
   ```js
   window.GSP_CONFIG = {
     clientId: '1234567890-abc123.apps.googleusercontent.com',
   };
   ```
3. **Commit changes**. En 1 minuto la app se actualiza.

Al abrir la app, abajo verás un punto verde: «Conectado a tu proyecto de Google». Si ves «Modo demostración», revisa este paso.

---

## Paso 4 · Compartir la hoja y la carpeta de Drive

La app usa estos dos recursos (ya están configurados en `google.js`):

- **Base de datos (Sheet):** https://docs.google.com/spreadsheets/d/11V5EoY84H8tDQ6DvZ9jqtIcoBarY7EODqueNmNr71iM
- **Archivos (Drive):** https://drive.google.com/drive/folders/1aRfxq7vsnOcqAt1eqyoGEVlWR4RBdWjD

Para cada uno: **Compartir** → agrega los dos Gmail como **Editor**. Por privacidad, quita el acceso «Cualquier persona con el enlace».

La primera vez que alguien se conecte, la app crea sola estas pestañas en la hoja:

| Pestaña | Columnas |
|---|---|
| `Familias` | id, nombre, codigo, creadoPor, creado |
| `Miembros` | familiaId, rol, email, nombre, apodo, correoContacto, idioma, calendarId, unido |
| `Notas` | familiaId, id, fecha, autor, visibilidad, funciono, atasco, ajuste, mochilas, ropa, desayuno |
| `Archivos` | familiaId, fecha, autor, nombre, driveId, enlace |

No cambies los nombres de las pestañas ni de los encabezados.

---

## Paso 5 · Primer uso

**Quien crea la familia (por ejemplo, Juan):**
1. Abre `https://TU-USUARIO.github.io/gentle-stoic-parent/` → **Crear una familia**.
2. Nombre de la familia → nombre completo, correo (el mismo de Google) y apodo → rol → idioma.
3. **Invita a tu pareja:** escribe su correo (se abre tu app de correo con el mensaje listo) o **Copiar enlace** y mándalo por WhatsApp.
4. **Conecta tu Google Calendar** → acepta los permisos. Verás cómo se crean: la hoja familiar, el calendario «Nuestro ritmo · Juan», los recordatorios y los bloques.
5. **Entrar a mi día.**

**La pareja (Christine):**
1. Abre el enlace de la invitación (o **Tengo una invitación** y pega el código de 6 letras).
2. Sus datos → el rol queda asignado automáticamente → idioma → **Conectar Google Calendar**.

**En el teléfono:** abre la dirección en Safari/Chrome → Compartir → **Agregar a pantalla de inicio**. Queda como una app. En Google Calendar del teléfono, activa las notificaciones del calendario «Nuestro ritmo».

**Después:** para entrar, **Iniciar sesión con Google**. Si cambian recordatorios, ve a **Recordatorios → Sincronizar ahora** (reemplaza los eventos anteriores, no duplica).

---

## Cosas que conviene saber

- **Permisos cada tanto.** Por seguridad, la conexión con Google dura cerca de 1 hora; al volver a guardar notas o subir fotos puede aparecer la ventana de Google otra vez. Es normal.
- **Face ID** es un acceso rápido guardado en ese dispositivo (no usa la biometría real del teléfono todavía).
- **Buscador con IA:** en GitHub Pages responde con la búsqueda de la biblioteca (fichas relacionadas). Para respuestas redactadas por IA hace falta un pequeño servidor que guarde la clave de la IA de forma segura (el siguiente paso recomendado es un Apps Script).
- **Las invitaciones** se envían desde tu propia app de correo; la app no manda correos por sí sola.
- **Los datos** (familias, miembros, notas, archivos) viven en tu Google Sheet y tu Drive, no en GitHub.

---

## Si algo falla

| Mensaje / síntoma | Solución |
|---|---|
| `Error 400: origin_mismatch` | En el Client ID, el origen debe ser exactamente `https://TU-USUARIO.github.io` (sin ruta ni `/` final). Espera unos minutos tras guardarlo. |
| `Error 403: access_denied` | Ese Gmail no está en **Test users** (paso 2.3.5). |
| «Se cerró la ventana de Google…» | El navegador bloqueó la ventana emergente o se cerró antes de tiempo. Permite pop-ups para el sitio e inténtalo de nuevo. |
| No aparece el botón de Google | Revisa `config.js` y que la app no esté en «Modo demostración». Prueba en otra pestaña o sin bloqueadores. |
| `The caller does not have permission` / `File not found` | Comparte la hoja y la carpeta con ese Gmail como **Editor** (paso 4). |
| `... API has not been used in project ...` | Falta activar esa API (paso 2.2). |
| La app se ve vieja después de un cambio | Recarga forzada: Ctrl/Cmd + Shift + R. |

---

## Actualizar la app

Edita el archivo en GitHub (lápiz) o sube la nueva versión con **Add file → Upload files**, y haz **Commit**. GitHub Pages publica solo en ~1 minuto.

- Textos de rutinas, principios, cuentos y desayunos: `kb.js`
- Hoja o carpeta distintas: `SHEET_ID` y `FOLDER_ID` al inicio de `google.js`
- Manuales y pósters: reemplaza los PDF en `docs/` con el mismo nombre

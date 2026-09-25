# Actualización web: qué reemplazar en GitHub

Arrastra **el contenido** de esta carpeta a la raíz del repositorio con **Add file → Upload files** y luego haz **Commit**. GitHub reemplaza los archivos que ya existen y agrega los nuevos.

| Archivo | Qué cambió |
|---|---|
| index.html | Nueva pantalla de acceso con pestañas Entrar / Empezar. Inicio de sesión con correo y contraseña, y contraseña al crear el usuario. Farol de estado junto al selector de idioma. Face ID y Google aparecen como «no disponible» mientras no estén listos. Fondo de papel muy sutil y conexión con el Apps Script. |
| config.js | Campo `appsScriptUrl`: pega ahí la URL /exec del script. Tu Client ID ya está puesto. |
| google.js | Función para comunicarse con el Apps Script |
| img/brand/ | Textura de papel, ilustraciones, logo de los correos y dibujos botánicos |
| emails/ | Vista previa de los 5 correos de marca |

El Apps Script viene en una carpeta aparte llamada **apps-script**.

# Publicar Proyecto Atelier en Hostinger (PHP + MySQL)

La web y el admin conservan el diseño y las mismas rutas. Hostinger ejecuta PHP: **no necesita Node.js, npm ni Sharp en el servidor**. Node se sigue usando en tu computadora para trabajar y armar el paquete.

## 1. Preparar el paquete en tu computadora

Actualizá el proyecto sin borrar tu `.storage`. Abrí en VS Code la carpeta donde está `package.json`. Detené la web y ejecutá:

```powershell
npm ci
npm run build:hostinger
```

Se genera una carpeta con fecha y su ZIP en **`dist/hostinger-...`**. Incluye:

- `public_html`: la web, el admin, la API PHP, el instalador y las reglas de rutas.
- `atelier-private`: código del servidor, datos iniciales y fotos migradas. **Debe estar fuera de public_html**.
- `LEEME-HOSTINGER.md`: estas instrucciones.

Si existe `.storage/content.json` en esa carpeta, el paquete incluye tu contenido y las imágenes que usa (incluidas las miniaturas). Si tus datos están en otro lugar:

```powershell
npm run build:hostinger -- --storage "C:\ruta\al\proyecto\.storage"
```

Si no hay `.storage`, el paquete lleva el catálogo inicial sin tus fotos. El comando lo indica en la terminal: verificá ese mensaje antes de subir. Nunca copia la contraseña de desarrollo, sesiones, `.env` ni credenciales MySQL. No borra ni modifica `.storage`. Los ZIP contienen datos/fotos de tu negocio: guardalos de manera privada y no los subas a GitHub.

## 2. Crear la base de datos en hPanel

En **Bases de datos MySQL**, creá una base y su usuario. Anotá el nombre completo (incluido el prefijo que agrega Hostinger), el usuario, la contraseña y el host que indique hPanel. No hace falta compartirlos en el chat.

Usar **PHP 8.2 o superior**, con **pdo_mysql**, **GD o Imagick** y soporte **WebP**. Son compatibles MySQL 8 y MariaDB 10.6 o superior. Recomendado: PHP memory_limit 256 MB. Las fotos grandes pueden requerir Imagick; si GD no tiene memoria suficiente, el panel pide reducir la foto.

## 3. Subir las carpetas

Para la primera publicación, subí y extraé el ZIP **fuera de public_html**, con el administrador de archivos de Hostinger. Ubicá las carpetas como se indica abajo y eliminá el ZIP del servidor cuando termines:

```text
carpeta del dominio/
├── public_html/
│   ├── index.html
│   ├── admin.html
│   ├── api.php
│   ├── setup.php
│   ├── .htaccess
│   └── ...archivos JS/CSS...
└── atelier-private/
    ├── config.example.php
    ├── bootstrap.php
    ├── schema.sql
    ├── initial-content.json
    └── storage/uploads/  ← fotos migradas
```

Copiá **el contenido** de la carpeta `public_html` del ZIP dentro de la `public_html` real. No debe quedar otra `public_html` o `Proyecto-Atelier-main` anidada dentro. Conservá los archivos `.htaccess` y `.user.ini` (pueden aparecer como ocultos). El paquete supone la raíz de un dominio o subdominio, no una subcarpeta.

**No subas el repositorio completo, `.storage`, `node_modules` ni configuraciones privadas a public_html.** No reemplaces archivos de un sitio existente sin respaldarlo. Si ya hay WordPress en ese dominio, usá un subdominio/directorio raíz propio para Atelier y conservá su instalación.

## 4. Configurar la conexión privada

Dentro de **atelier-private**, copiá `config.example.php` como **config.php**. Completá ahí:

- `db.host`, `db.port`, `db.name`, `db.user`, `db.password`: los datos de hPanel.
- `app_url`: dirección exacta HTTPS del sitio, por ejemplo `https://atelier.tudominio.com`, sin barra final ni subcarpeta. Si redirigís www, usá el dominio final.
- `setup_token`: una clave **aleatoria** de al menos 32 caracteres. Podés generarla con tu gestor de contraseñas. No dejes el texto de ejemplo.
- `image_engine`: `auto` usa Imagick si está disponible y GD en caso contrario. También podés elegir `gd` o `imagick`.

La carpeta privada debe poder escribir en `storage`, sin permisos 777. Habitualmente los permisos de archivos/carpetas propios de hPanel son suficientes. `.user.ini` pide 22 MB para permitir subir fotos de hasta 20 MB; si tu plan impone un límite menor, ajustalo en la configuración de PHP. Los cambios de `.user.ini` pueden tardar en aplicarse.

## 5. Instalar

Abrí **https://tu-dominio.com/setup.php**. Ingresá:

1. La clave temporal de instalación (`setup_token`).
2. Una contraseña nueva del administrador de al menos 12 caracteres, dos veces.

El instalador crea las tablas, importa el contenido preparado y registra el administrador. No sobreescribe una base ya instalada. Guarda contraseñas con `password_hash` y bloquea otra instalación al terminar. **La contraseña atelier123 no funciona en producción.**

Si preferís crear las tablas desde phpMyAdmin, podés importar `atelier-private/schema.sql` en la base seleccionada y después completar el mismo instalador. Las tablas son InnoDB y usan utf8mb4 para conservar tildes y caracteres.

Después de entrar al admin correctamente, eliminá **public_html/setup.php** y vaciá `setup_token` en la configuración privada. No elimines `storage/installed.lock`.

## 6. Verificar antes de darla por publicada

- Abrí `/api/health`: debe devolver `database: true` e `imageEngine: imagick` o `gd`.
- Abrí `/admin` e ingresá con la contraseña que creaste.
- Revisá productos, fotos, telas, portada y número de WhatsApp.
- Editá una descripción, guardá, cerrá sesión y recargá: el cambio debe seguir guardado.
- Subí una foto y verificá WebP, miniatura y galería. Probá escritorio/celular.
- Confirmá que rutas privadas y archivos de configuración no se pueden descargar.

## Datos y copias de seguridad

MySQL guarda productos, materiales, ajustes de la web y el acceso al admin en tablas `atelier_*`. Las actualizaciones del contenido son transaccionales y controlan la revisión para impedir sobrescribir otra sesión. Las imágenes quedan en **toda atelier-private/storage** y se sirven por la API, sin ejecutar archivos subidos.

Respaldá **la base desde phpMyAdmin** y **toda atelier-private/storage**. Guardá también la configuración privada de forma segura. El JSON de Respaldo del admin sigue sirviendo para exportar/importar contenido, pero no incluye los archivos de las fotos.

Después de la primera publicación, los cambios hechos en Hostinger y en localhost son independientes. Para actualizar el código, respaldá primero la base y los archivos; reemplazá los archivos del programa pero **preservá config.php y toda storage**. No vuelvas a copiar fotos/semilla de un paquete antiguo sobre el contenido nuevo, ni ejecutes el instalador de nuevo.

Esta versión mantiene un administrador principal (el formulario actual usa contraseña). La tabla de usuarios permite ampliar ese acceso más adelante, pero todavía no incluye una pantalla para gestionar varias cuentas.

## Si aparece un error

- **No es JSON / HTML en lugar de respuesta:** verificá que `.htaccess` esté cargado y `/api/content` llegue a `api.php`, no a WordPress o un servidor estático.
- **503:** revisá la configuración privada, permisos y conexión MySQL. Los detalles técnicos quedan en los logs de PHP sin mostrar credenciales al visitante.
- **403 al guardar:** `app_url` debe coincidir exactamente con el dominio, HTTPS y puerto utilizados.
- **409:** otra sesión guardó cambios; exportá tu borrador, recargá y revisá antes de restaurarlo.
- **429:** cinco intentos de acceso fallidos; esperá 15 minutos.
- **Fotos faltantes al instalar:** generá el paquete desde la carpeta de tu proyecto que contiene los datos reales y las fotos en `.storage`.

La generación del ZIP y las pruebas locales no publican ni conectan tu cuenta Hostinger automáticamente.

## Comprobaciones de desarrollo (opcionales)

`npm test` verifica el catálogo, la API Node y el empaquetado/migración. Para probar PHP con una base MariaDB real en contenedores aislados se requiere Docker:

```bash
docker build -t atelier-php-test -f tests/php/Dockerfile .
docker pull mariadb:11.4
npm run test:php
```

Las pruebas crean una base y una configuración temporales con contraseñas aleatorias y limpian sus contenedores y archivos al terminar. Verifican instalación protegida, autenticación, límites de intentos, guardado, conflictos, persistencia y WebP con GD e Imagick. No usan la cuenta Hostinger. La comprobación opcional de navegador usa `ATELIER_BROWSER_CHECK=1`, con Playwright y Chromium disponibles (`CHROMIUM_PATH` permite indicar el ejecutable).

## Actualizar al editor de recorte

Conservá `config.php` y **toda `storage`** al actualizar los archivos del programa. No vuelvas a instalar ni borres la base. El servidor crea la tabla adicional `atelier_media` cuando se usa la herramienta por primera vez; si el usuario MySQL no tiene permiso para crear tablas, importá solo la sentencia `CREATE TABLE IF NOT EXISTS atelier_media ...` de `schema.sql` desde phpMyAdmin. No hace falta ejecutar de nuevo `/setup.php`.

Los originales nuevos se guardan de forma privada en `storage/originals`, los recortes en la tabla `atelier_media` y su copia portable en `storage/media`, y las versiones visibles en `storage/uploads`. **Las tres carpetas y la base forman parte del respaldo.** El paquete generado desde Node incluye originales y metadatos de las fotos que usa el catálogo; PHP importa esos metadatos a MySQL al volver a editar una foto. No publiques las carpetas privadas.

Las fotos anteriores siguen visibles y se pueden reencuadrar desde su versión disponible, con una advertencia. Las nuevas permiten volver al original sin recargar el archivo. Cada edición genera otra versión y no afecta la foto publicada hasta guardar el contenido del panel.

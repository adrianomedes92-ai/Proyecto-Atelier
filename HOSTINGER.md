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

MySQL guarda productos, materiales, ajustes de la web y el acceso al admin en tablas `atelier_*`. Las actualizaciones del contenido son transaccionales y controlan la revisión para impedir sobrescribir otra sesión. Las imágenes quedan en **atelier-private/storage/uploads** y se sirven por la API, sin ejecutar archivos subidos.

Respaldá **la base desde phpMyAdmin** y **atelier-private/storage/uploads**. Guardá también la configuración privada de forma segura. El JSON de Respaldo del admin sigue sirviendo para exportar/importar contenido, pero no incluye los archivos de las fotos.

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

## Tipos de tela y colores compartidos

La gestión actual usa un **catálogo único de colores** (nombre y código), las **casillas** de cada tipo de tela para habilitarlos y **una galería por producto/código de color**, independiente de la tela. No se cargan muestras ni texturas. El zoom, el recorte y la reedición siguen disponibles para fotografías del mueble y portada; no hay máscaras ni recoloreado automático.

Para actualizar, generá el paquete desde tu copia con `npm run build:hostinger` y copiá los archivos públicos y privados actualizados. Conservá `config.php` y toda la carpeta `storage`. Se agregan el módulo público **color-catalog-migration.js** y el módulo privado **color-migration.php**, que deben actualizarse junto con los demás archivos. No ejecutes el instalador ni importes todo el esquema sobre una base existente.

**No hay tablas nuevas ni tablas que borrar.** El catálogo de colores se guarda como configuración JSON en `atelier_settings` (filas `colors` y `catalogVersion`). Los tipos de tela y sus casillas siguen en `atelier_materials`; las galerías por producto/color siguen en `atelier_products`. Las fotos se guardan como archivos y sus rutas permanecen en las fichas actuales. El guardado mantiene el control de revisión y la transacción existente.

La lectura convierte en memoria las fichas anteriores. Al primer guardado, se respalda su versión completa en `storage/backups/content-before-global-colors-....json` antes de reescribirlas con `catalogVersion: 2`. Los códigos repetidos entre telas se unifican. Sus estados activos anteriores se convierten en casillas por tela, y las galerías de un mismo producto/código se reúnen sin duplicar rutas ni descartar fotos. Las muestras históricas dejan de usarse, pero sus archivos y las rutas originales se conservan en el almacenamiento/respaldo. La migración se verificó en PHP/MariaDB y Node, incluyendo conflictos y galerías de más de 12 fotos.

Si un código tenía nombres distintos, revisá **Catálogo único de colores → Confirmar nombre de este color**. Si un producto/código tenía galerías distintas según la tela, revisá **Productos → Imágenes por color → Confirmar galería compartida**. Se conservan todas las fotos y los nombres encontrados; esa combinación no se ofrece al cliente hasta resolver los avisos y guardar.

Uso: cargá los colores una sola vez en **Telas y colores**, marcá los disponibles en cada tipo de tela y asigná las fotos en **Productos → Imágenes por color del mueble**. Un color habilitado en dos telas usa las mismas imágenes del producto, sin volver a subirlas. El cliente solo ve colores marcados y con fotos para ese modelo; WhatsApp incluye producto, tela, nombre y código de color.

Conservá MySQL y toda `storage`, incluyendo `uploads`, `originals`, `media` y `backups`. El paquete mantiene las fotos, originales y metadatos de recorte anteriores. Las fotografías antiguas no se reprocesan ni borran automáticamente. No borres `images/`, **image-editor.js** ni **crop-geometry.js**, y no ejecutes scripts de limpieza de versiones anteriores. Consultá el flujo y los detalles de migración en README.md.

## Actualización: secciones y subsecciones administrables

El panel incorpora **Secciones** para crear, renombrar, ordenar y activar/desactivar secciones y subsecciones. En **Productos** se elige la sección y una subsección opcional, se cambia el orden con Antes/Después dentro de ese grupo y se habilita o deshabilita **Personalización de telas**. Las galerías por color, los originales y los encuadres se conservan. Al eliminar una categoría ocupada el panel exige reasignar sus productos; no se borran sus fotos. Si no hay otra sección de destino, creala primero.

Las secciones iniciales Sillones y Muebles de madera son datos editables, no opciones fijas de la navegación. Los productos anteriores se asignan a Sillones; sus categorías anteriores, incluso las personalizadas, se conservan como subsecciones. El campo `category` anterior se mantiene por compatibilidad. Los identificadores estables permiten renombrar las categorías sin romper sus asociaciones. Las categorías vacías o inactivas no aparecen en la navegación pública; desactivarlas no elimina sus productos.

**No se crean ni eliminan tablas MySQL.** Se agregan las filas JSON `sections` y `taxonomyVersion` a `atelier_settings`. Cada ficha en `atelier_products` agrega `sectionId`, `subsectionId` y `sortOrder`. El orden de secciones/subsecciones se guarda en sus listas JSON. La lectura migra los datos anteriores en memoria. Antes del primer guardado, PHP respalda el contenido anterior en `atelier-private/storage/backups/content-before-global-colors-….json`; luego guarda la estructura actual dentro de la transacción y el control de revisión existentes. El nombre histórico del respaldo se mantiene por compatibilidad. En Node también se respalda el contenido local anterior al iniciar. No hace falta ejecutar SQL ni un script de migración manual.

### Cómo actualizar una web que ya funciona

1. Hacé una copia de la base MySQL desde phpMyAdmin y de `atelier-private`, incluido `config.php` y **todo** `storage`.
2. Descargá `descargas/Proyecto-Atelier-Hostinger.zip` del repositorio. Copiá los archivos de su `public_html` dentro del `public_html` real del dominio, incluyendo `.htaccess` y los módulos JavaScript. No anides otra carpeta `public_html` ni subas las carpetas fuente `hosting/public` y `hosting/private`.
3. Actualizá los archivos PHP de `atelier-private`, incluido el nuevo **sections.php**, y conservá su `.htaccess`. **No reemplaces tu config.php ni borres/reemplaces tu storage con una carpeta vacía del paquete.** Ambas carpetas, `public_html` y `atelier-private`, son hermanas. El ZIP no incluye tus credenciales ni los datos/imágenes cargados directamente en Hostinger.
4. No ejecutes `setup.php` ni importes `schema.sql` o `initial-content.json` sobre la instalación existente. Para actualizar no se usa el contenido inicial del paquete.
5. Recargá el navegador sin caché. Entrá al panel, revisá **Secciones** y las asignaciones en **Productos** y guardá para persistir la migración. Revisá también telas/colores si hay avisos anteriores de confirmación.
6. Probá los enlaces públicos `/?section=ID#catalogo` y `/?section=ID&subsection=ID#catalogo`, una galería y una consulta por WhatsApp. Los productos sin personalización de telas ofrecen una consulta directa con su nombre y sus medidas; si WhatsApp no está configurado se conserva la consulta dentro del sitio con opción de copiar.

No hay que cambiar los datos de conexión MySQL de `config.php`. La ruta habitual de almacenamiento sigue siendo `'storage_dir' => __DIR__ . '/storage'` (sin punto inicial en el nombre `storage`).

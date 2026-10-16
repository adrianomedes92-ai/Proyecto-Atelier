# Proyecto Atelier

Web en español rioplatense para explorar y personalizar muebles y consultar por WhatsApp, sin precios ni pagos. Panel de administración con contenido persistente. Para desarrollo local usa Node.js 22 o superior y Sharp. Para Hostinger incluye una API PHP 8.2+ con MySQL y optimización mediante GD/Imagick.

## Publicar en Hostinger

Seguí [HOSTINGER.md](HOSTINGER.md). El comando **`npm run build:hostinger`** genera el paquete PHP/MySQL e incluye los datos y fotos actuales de `.storage` si están disponibles. No subas el repositorio entero al hosting. La instalación y los datos de acceso se configuran de forma privada en Hostinger; no se publican al generar el ZIP.

## Correr en Visual Studio Code (Windows, macOS o Linux)

1. Abrí la carpeta **Proyecto-Atelier**, donde está `package.json`.
2. Abrí **Terminal → Nueva terminal** y ejecutá `npm run dev`.
3. Visitá **http://127.0.0.1:3000**. Para detener el servidor, usá `Ctrl+C`.

La primera vez, y después de actualizar dependencias, ejecutá **`npm ci`** antes de `npm run dev`. No usar Live Server ni abrir el HTML como archivo: el panel y el catálogo necesitan el servidor Node.

## Entrar al panel durante el desarrollo

Ejecutá `npm run dev`, entrá a **http://127.0.0.1:3000/admin** y usá **`atelier123`**. No hace falta configurar una contraseña por terminal. Este modo se limita a localhost y no puede iniciarse con `NODE_ENV=production` ni un `HOST` público.

La contraseña sencilla se usa solo durante esta ejecución. No modifica la contraseña personal guardada ni elimina productos o fotos. Reiniciar cierra las sesiones anteriores. El panel muestra cuándo está activo el modo de desarrollo. Los usuarios individuales y su administración quedan para una próxima versión.

## Usar una contraseña propia

1. Detené el servidor con `Ctrl+C`.
2. Ejecutá `npm run admin:password` y escribí dos veces una contraseña de al menos 12 caracteres. No se muestran los caracteres mientras escribís.
3. Ejecutá **`npm start`**, que no utiliza la contraseña de desarrollo.
4. Entrá a **http://127.0.0.1:3000/admin** con tu contraseña personal.

Para recuperarla, repetí estos pasos. Se guarda como hash con salt, nunca como texto plano. El panel utiliza una sesión de ocho horas con cookie HttpOnly y control de origen. Después de cinco intentos incorrectos, el acceso desde esa dirección se limita durante 15 minutos.

## Administrar sin tocar código

- **Productos:** agregar/eliminar modelos, editar nombres, categorías, descripciones, estructura, medidas de referencia, rangos y patas confirmadas. Elegir qué opciones de personalización muestra cada modelo y qué telas admite. Ocultar modelos incompletos. Cargar hasta 12 fotos JPG, PNG o WebP (máximo 20 MB y 60 megapíxeles cada una), quitar fotos o elegir portada. La primera foto aparece en el catálogo y todas aparecen en la ficha.
- **Telas y colores:** agregar familias de material, tipo y descripción; cargar los códigos reales y una foto de cada muestra. Los códigos sin foto se muestran como texto, sin inventar colores. Podés restringir las familias por modelo desde Productos.
- **Contenido y contacto:** editar marca, títulos, textos de inicio/catálogo/contacto, los tres pasos, envíos, imagen de inicio, teléfono, personas de contacto y WhatsApp.
- **Respaldo:** exportar/restaurar un JSON de contenido. Este JSON contiene las rutas de fotos, pero no sus archivos.

Los cambios son un borrador hasta tocar **Guardar cambios**. Recargá la web pública para verlos. La subida de una foto conserva su archivo en el servidor, pero no aparece en el catálogo hasta guardar. El navegador avisa al salir con cambios pendientes. Si otra sesión guardó antes, se impide sobrescribirla: conservá tu borrador exportándolo, recargá y revisá los cambios antes de aplicar un respaldo.

### WhatsApp

El teléfono publicado es `11-73730703`. Antes de habilitar el botón, verificá con Guillermo o Agustín el número internacional correcto. Ingresalo en **Contenido y contacto → WhatsApp internacional**, solo dígitos, sin `+` ni espacios. No se asumió si corresponde `541173730703` o `5491173730703`. Vacío deshabilita WhatsApp; se permite copiar la consulta y llamar. El enlace abre WhatsApp sin enviar automáticamente el mensaje.

## Dónde se guarda la información en localhost

El servidor crea una carpeta **`.storage`** en el proyecto:

- `content.json`: productos, materiales y textos; se guarda de forma atómica.
- `uploads/`: fotos cargadas.
- `admin.json`: hash de la contraseña del panel.

**Respaldá toda la carpeta `.storage` en un lugar privado**, incluyendo las imágenes. Está excluida de Git: ni las fotos cargadas ni los cambios del admin se suben automáticamente a GitHub. Cada computadora tiene sus propios datos. Para compartir la administración, todos deben entrar al mismo servidor. No hay sincronización entre localhost y una futura web publicada.

No borres `.storage` al actualizar el código o extraer un ZIP nuevo. Con Git, `git pull origin main` actualiza el código y conserva esta carpeta. Si descargás un ZIP, reemplazá solo los archivos del programa o copiá `.storage` a la nueva carpeta antes de iniciar.

`data.js` contiene los datos iniciales, usados solo al crear el almacenamiento por primera vez. Una vez creado, editá el contenido desde `/admin`; modificar `data.js` no sobrescribe los datos guardados.

## Publicación alternativa con Node.js

Además de la opción PHP/MySQL para Hostinger, la versión local funciona en un servidor Node con almacenamiento persistente. No alcanza con subir el HTML a un alojamiento estático. Para publicar:

- Usar Node >=22, un dominio y HTTPS, ejecutar `npm ci` y luego `npm start`.
- Montar un volumen persistente y configurar `ATELIER_DATA_DIR` con su ruta. Respaldar datos e imágenes. No usar discos efímeros.
- Configurar `ADMIN_PASSWORD` de al menos 12 caracteres mediante las variables seguras del alojamiento; no escribirla en Git. Si se usa, prevalece sobre la contraseña creada por terminal.
- Configurar `HOST=0.0.0.0` y `PORT` según el proveedor. Localmente solo escucha en `127.0.0.1`.
- Activar `COOKIE_SECURE=true` bajo HTTPS. No activarlo en localhost HTTP.
- Mantener una sola instancia de servidor para este almacenamiento de archivos. Para múltiples instancias, migrar datos y sesiones a una base de datos y fotos a almacenamiento compartido.

## Validación y catálogo pendiente

`npm test` ejecuta pruebas de cotización y una prueba de API con autenticación, fotos, validación, conflictos y reinicio. También se probó en navegador el panel, las subidas, muestras, la web móvil y el mensaje de WhatsApp.

Los modelos iniciales conservan las medidas del pedido; no se inventaron fotografías, colores ni patas. El PDF adjunto superó el límite de transferencia de 32 MiB. Cargá las fotos reales y los códigos confirmados desde el panel y revisá la aplicabilidad de las familias por modelo antes de publicar. Las imágenes subidas durante las pruebas fueron temporales y no forman parte del catálogo real.

## Fotos: formato, tamaño y encuadre

Las imágenes nuevas se procesan automáticamente **en el servidor** mediante Sharp en localhost, o GD/Imagick en Hostinger:

- Se aceptan JPG, PNG y WebP, hasta **20 MB y 60 megapíxeles**, sin animación. HEIC no está soportado: exportá a JPG antes de subirlo.
- Se aplica la orientación de la cámara, se elimina la metadata original (incluida ubicación EXIF), se respeta el recorte confirmado. La imagen principal no se agranda; la miniatura llena el marco aunque necesite ampliación. Una fuente pequeña puede perder nitidez al ampliarse.
- Se convierten a **WebP**. Las fotos de productos se recortan en **5:4** según lo confirmado en el editor, conservan detalle hasta 1600 × 1600 px y generan una miniatura de **800 × 640 px** que llena el mismo marco **sin agregar fondo ni bandas**.
- Inicio: caja máxima de 1920 × 2160 px. Las muestras antiguas se conservan en el almacenamiento, pero la nueva gestión de colores no solicita imágenes de textura. La conversión con compresión puede variar ligeramente el color; la muestra física es la referencia.
- El original subido se conserva de forma privada en `originals/`; el encuadre y sus metadatos se guardan en `media/`, dentro del almacenamiento actual. Algunas imágenes muy pequeñas ya comprimidas pueden no reducir su peso; la optimización prioriza dimensiones apropiadas y formatos consistentes.

**Guía de preparación visible en el admin:**

- **Productos:** 1600 × 1280 px, horizontal **5:4**, mueble centrado, alrededor de un **10% de margen libre**. Mostrá el producto entero; evitá textos incrustados en la foto.
- **Inicio:** 1920 × 1080 px, horizontal **16:9**, con el producto hacia la derecha y aproximadamente el 40% izquierdo libre para texto. Conservá margen alrededor del mueble y verificá la composición en celular.
- **Colores:** se cargan una sola vez por nombre y código; no requieren muestras ni texturas.

El archivo de entrada puede tener cualquier proporción. Al cargar o reemplazar una imagen se abre el editor: **arrastrá, ajustá el zoom, revisá la vista previa y confirmá**. El marco tiene la proporción del destino y siempre queda lleno, sin estirar la foto ni agregar bandas. El zoom mínimo ya cubre todo el marco. Podés restablecer o cancelar; cancelar conserva la imagen anterior y no sube una nueva.

**Editar encuadre** permite repetir el ajuste en fotografías generales, imágenes de cada color del mueble y portada. Se usa el original privado cuando está disponible. Para fotos antiguas sin original/metadatos se usa la imagen principal disponible (nunca la miniatura con fondo añadido) y el editor informa esa limitación. Cada recorte confirmado crea una URL nueva; solo se publica al **Guardar**, conservando las versiones anteriores. Las fotos antiguas no se modifican en lote: para corregir bandas ya guardadas, editá su encuadre y guardá. Si el margen forma parte del propio archivo, aumentá el zoom y elegí la región que querés conservar.

## Galería del catálogo

Cuando un producto tiene varias fotos, la tarjeta muestra flechas y un contador. Las flechas solo cambian la foto; al tocarla se amplía esa misma imagen en una ventana superpuesta. En la vista ampliada se puede navegar con flechas, con las teclas izquierda/derecha o con deslizamientos horizontales en celular. Se cierra con **Cerrar**, **Escape** o tocando fuera de la ventana. Con una sola foto no se muestran flechas ni contador. La posición se conserva al cambiar de categoría durante la visita. El botón **Personalizar** mantiene el acceso al configurador.

Este cambio utiliza las fotos ya cargadas y no modifica `.storage`. Se verificaron productos sin foto, con una y con varias en navegador de escritorio y móvil, incluyendo gestos táctiles, foco de teclado y aislamiento de clics.

## Presentación de portada

En **Contenido y contacto → Imágenes de portada**, podés cargar hasta 12 fotos, ver las miniaturas, reordenarlas con ↑/↓, reemplazar cada foto o eliminarla. Las subidas usan la optimización WebP y los límites existentes (JPG/PNG/WebP, hasta 20 MB y 60 megapíxeles, sin animación). Si falla una foto, se informa el archivo y el motivo; las fotos ya cargadas permanecen en el borrador. **Guardar cambios** publica el nuevo orden. Quitar una imagen la saca de la presentación; su archivo permanece en el almacenamiento y en tus respaldos.

- Sin fotos: se conserva la composición gráfica original.
- Una foto: imagen fija, sin controles de presentación.
- Varias fotos: alternan cada **5 segundos** con un **fundido de 1 segundo**, contador, anterior/siguiente y pausa/reproducción. La siguiente foto se precarga y solo se muestra después de decodificarse, evitando cuadros vacíos.
- La portada ocupa el ancho completo. El texto y el botón se superponen a la izquierda con un degradado claro; en celular quedan arriba para reservar espacio al producto. Se muestra la foto completa, sin deformar, sobre una copia desenfocada que completa el fondo. Ambas capas mantienen el fundido del carrusel.
- La rotación se pausa mientras el puntero o el foco están dentro de la presentación, cuando se navega manualmente y cuando la pestaña está oculta. Las teclas izquierda/derecha también permiten navegar al enfocar los controles.
- Con **reducir movimiento** activado, no hay reproducción automática ni fundido; se puede avanzar manualmente.

Los datos se guardan en `.storage/content.json` y los archivos en `.storage/uploads/`, como el resto del catálogo. La portada única de versiones anteriores se conserva automáticamente como primera imagen; no hace falta volver a subirla. Los respaldos exportados incluyen la lista y su orden; para conservar las fotos, respaldá toda `.storage`.

## Encabezado y tamaño de marca

En **Contenido y contacto**, el control **Tamaño del nombre de la marca** permite elegir entre **16 y 36 px**, con **22 px** como valor predeterminado (también al actualizar datos anteriores). La vista previa se refleja en el encabezado del admin; tocá **Guardar cambios** para aplicarla a la web. Se conserva la tipografía actual, sin selector de fuentes.

En celular el tamaño se reduce automáticamente a un rango de 16–26 px. Los nombres largos, incluso sin espacios, se ajustan en varias líneas; el encabezado crece para mostrarlos completos sin invadir la navegación. El tamaño queda guardado en `site.brandFontSize` dentro de `.storage/content.json`.

La portada sigue admitiendo las imágenes ya cargadas. Para una composición óptima de borde a borde, usá fotos horizontales con espacio vacío a la izquierda. El carrusel conserva los controles, los tiempos, la pausa y la preferencia de reducir movimiento. No hace falta volver a cargar las fotos para actualizar el diseño.

## Tipos de tela, catálogo único de colores y galerías por producto

Cada tipo de tela se carga una sola vez y cada color se registra una sola vez con **nombre y código único**. Las casillas de cada tela habilitan sus colores disponibles; no se vuelven a crear colores ni se cargan muestras/texturas. Cada producto tiene **una galería por código de color**, compartida por todas las telas que lo habiliten. Las imágenes se preparan externamente; el editor de zoom/encuadre sigue disponible en cada carga, reemplazo y reedición. No hay recoloreado, máscaras ni generación de imágenes.

1. En **Administrador → Telas y colores → Catálogo único de colores**, agregá nombre y código de cada color. El código no se puede repetir. El panel impide guardar códigos duplicados; al renombrar uno válido actualiza las casillas de todas las telas y las galerías de todos los productos.
2. En la misma sección, cargá cada **tipo de tela** con nombre, categoría y código de tela opcional. Marcá sus colores con las **casillas**. Desmarcar un color afecta solo a esa tela: conserva el registro global, las fotos del producto y la disponibilidad en otras telas.
3. En **Productos → Imágenes por color del mueble**, elegí un código y cargá sus imágenes preparadas. La galería no depende de la tela. Se pueden ordenar, reemplazar, quitar y **Editar encuadre**, conservando los originales. Para cargas habituales se admiten hasta 12 fotos por producto/color, JPG/PNG/WebP de hasta 20 MB y 60 megapíxeles. Las galerías más largas heredadas de la migración se conservan completas y pueden revisarse y reducirse manualmente.
4. Presioná **Guardar** para publicar. La web ofrece únicamente tipos de tela habilitados para el producto y colores marcados en esa tela que tengan fotos asignadas a ese producto. Las combinaciones pendientes de revisión no se ofrecen.

El cliente elige producto, tela y color. Un color compartido muestra **exactamente la misma galería** al cambiar de tela; si sigue habilitado conserva la selección y la posición actual de la foto. Si no está disponible en la nueva tela, se limpia la elección de color y se vuelve a las fotos generales del mueble. Con varias fotos aparecen flechas, contador, teclado y deslizamiento en celular; con una sola no hay controles. Cambiar de color abre la primera foto de su galería. El resumen y WhatsApp incluyen producto, tipo/nombre de tela, código de tela si está cargado, nombre del color y código del color. Medidas, patas, disposición modular y observaciones conservan su funcionamiento. Sin colores con fotos habilitados se informa y se permite consultar con la fábrica sin inventar una selección.

### Datos y migración de versiones anteriores

El formato actual es `catalogVersion: 2`: `colors[] = {code, name, reviewRequired, legacyNames}`, `materials[].colorCodes` para las casillas y `products[].variants[] = {code, images, reviewRequired}` para las galerías. La clave de una galería es **ID del producto + código de color**. No se duplica por tela. Node conserva el contenido en `.storage/content.json`. En PHP, el catálogo de colores y su versión se guardan como filas `colors` y `catalogVersion` en **atelier_settings**; tipos de tela y galerías siguen usando las fichas JSON existentes de **atelier_materials** y **atelier_products**. Las imágenes y originales siguen siendo archivos privados/públicos del sistema actual, con sus rutas en las fichas. **No se crean ni se eliminan tablas.**

Al leer datos antiguos se convierten en memoria al nuevo modelo. El cambio se guarda al presionar **Guardar**:

- Los colores de las distintas telas se agrupan por código. Se usa un único registro por código y se conservan los nombres anteriores para revisión. Los colores que estaban activos se marcan en su tela de origen; los inactivos permanecen sin marcar.
- Las galerías antes guardadas por producto/tela/código se agrupan por **producto/código**. Las URLs idénticas se conservan una sola vez y se mantiene el orden de primera aparición. No se truncan galerías que superen 12 imágenes.
- Si un código tenía **nombres diferentes**, el administrador muestra los nombres encontrados y el botón **Confirmar nombre de este color**. Si un producto/código tenía **galerías diferentes**, se guardan todas las fotos sin repetir, se muestran para revisión y se ofrece **Confirmar galería compartida**. En ambos casos, revisá y corregí primero. No se publica esa combinación hasta confirmar ambos avisos pendientes y guardar.
- Las imágenes de muestras y texturas antiguas ya no se solicitan ni se muestran, pero sus archivos no se borran. Sus rutas y valores anteriores permanecen en el respaldo original.
- Node crea un respaldo privado `backups/content-before-global-colors-....json` antes de normalizar una ficha anterior. PHP conserva la ficha anterior completa en `storage/backups` antes de reescribirla. Al construir un paquete desde `.storage`, también se incluye el contenido original dentro de los respaldos privados. No se modifican las fotos ya cargadas ni sus URLs, originales o metadatos de encuadre.

**No borres `.storage`, `atelier-private/storage`, `config.php`, MySQL ni los originales.** No reinstales la base. El paquete incluye todas las fotos almacenadas, incluso las que dejaron de referenciarse, además de los originales, encuadres y respaldos privados. Conservá `image-editor.js`, `crop-geometry.js` y `color-catalog-migration.js`. No ejecutes scripts antiguos de limpieza. El esquema por máscaras sigue retirado; no hace falta modificar las tablas para usar el recortador.

Eliminar explícitamente un tipo de tela conserva el catálogo de colores y las galerías de los productos. Eliminar explícitamente un color global retira sus casillas y asociaciones de todos los productos, con confirmación en el panel; los archivos de imágenes permanecen almacenados. Antes de una actualización o eliminación, conservá tu respaldo de contenido, almacenamiento y MySQL.

### Verificación

`npm test` prueba migración sin duplicados, conservación de fotos y disponibilidad, conflictos de nombres/galerías, validaciones, WhatsApp y recortador. Con Playwright y Chromium, `node tests/prepared-variants-check.cjs` verifica en escritorio y celular un producto con dos tipos de tela, colores diferentes por casilla, una galería compartida de varias imágenes y galerías de una imagen, cambios de código y revisión de conflictos. `node tests/image-editor-check.cjs` verifica zoom, arrastre, cancelar, publicación y reedición en fotos de producto y portada. `ATELIER_BROWSER_CHECK=1 npm run test:php` comprueba las mismas migraciones contra PHP/MySQL, su equivalencia con Node, respaldos, persistencia y el flujo público. Las pruebas usan almacenamiento y bases temporales; no modifican tu catálogo real.

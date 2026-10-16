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
- `uploads/`: versiones públicas optimizadas y miniaturas.
- `originals/`: originales privados de las nuevas fotos.
- `media/`: encuadres y referencias de originales.
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
- Se aplica la orientación de la cámara, se elimina la metadata original (incluida ubicación EXIF), se respeta la proporción y no se agranda el contenido de fotos pequeñas.
- Se convierten a **WebP**. Las fotos de productos conservan detalle hasta 1600 × 1600 px (caja máxima, sin recortar), y generan una miniatura de **800 × 640 px** para las tarjetas con fondo neutro para completar el encuadre.
- Inicio: caja máxima de 1920 × 2160 px. Muestras: caja máxima de 400 × 400 px, con calidad mayor para preservar textura. La conversión con compresión puede variar ligeramente el color; la muestra física es la referencia.
- Las fotos nuevas conservan el original privado para volver a editar el encuadre. Las anteriores al editor solo tienen la versión optimizada disponible. Algunas imágenes muy pequeñas ya comprimidas pueden no reducir su peso; la optimización prioriza dimensiones apropiadas y formatos consistentes.

**Guía de preparación visible en el admin:**

- **Productos:** 1600 × 1280 px, horizontal **5:4**, mueble centrado, alrededor de un **10% de margen libre**. Mostrá el producto entero; evitá textos incrustados en la foto.
- **Inicio:** 1920 × 1080 px, horizontal **16:9**, con el producto hacia la derecha y aproximadamente el 40% izquierdo libre para texto. Conservá margen alrededor del mueble y verificá la composición en celular.
- **Telas:** 800 × 800 px, cuadrada **1:1**, luz neutra y sin filtros. Mostrá una superficie representativa de la textura.

Las dimensiones sugeridas ayudan a preparar la foto: al subirla, elegís el área que querés publicar dentro de la proporción de cada ubicación. Las fotos ya cargadas siguen funcionando; **Editar encuadre** permite generar una nueva versión optimizada sin volver a subirlas. Respaldá `.storage` antes de hacerlo.

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

## Editor de encuadre

Al elegir una imagen en el admin se abre un editor antes de subirla. Arrastrá la foto, ajustá el zoom (1×–4×) y mirá **Resultado final**. **Usar encuadre** genera la versión optimizada del borrador; **Guardar cambios** la publica. **Cancelar** o Escape conserva la foto anterior. **Restablecer** vuelve al centro y al zoom inicial de 1×. También podés mover el encuadre con las teclas de flecha al enfocar el marco.

Las proporciones son fijas por ubicación: **producto 5:4**, **portada 16:9**, **muestra 1:1**. La proporción se comprueba en el servidor y el recorte se aplica después de corregir la orientación de la cámara. El marco y la vista previa usan las mismas coordenadas que la versión publicada, sin estirarla.

Cada foto tiene **Editar encuadre**. Las nuevas conservan el archivo original privado y cada edición genera una URL nueva; cancelar o dejar cambios sin guardar no altera la publicación anterior. Si una foto es anterior a esta función, el editor avisa que solo puede usar la versión optimizada que todavía existe. No se puede recuperar el original descartado por versiones anteriores. Al editarla, la versión disponible pasa a conservarse como fuente para futuras ediciones.

En Node, originales y metadatos quedan en `.storage/originals` y `.storage/media`. En PHP se usa la tabla `atelier_media` y las carpetas privadas `storage/originals` y `storage/media`. Respaldá **todo el almacenamiento y la base**, además de las imágenes públicas. El JSON de contenido del admin no incluye los originales.

Para probar el editor en navegador: `node tests/image-editor-check.cjs`, con Playwright y Chromium disponibles (`CHROMIUM_PATH` admite otro ejecutable). La prueba verifica carga, zoom, arrastre real con mouse/touch, publicación, comparación de píxeles, privacidad, reedición, cancelación y las tres proporciones.

## Prueba de telas y colores por máscara

En **Administrador → Productos → Cargar prueba de tapizados** se agrega una sola ficha **oculta**, “Prueba visual · sillón de demostración”, y una tela de demostración con tres colores (Arena, Oliva y Azul). La imagen del sillón fue generada para probar la herramienta y las muestras son sintéticas: no representan modelos ni telas en venta. No se modifica ningún producto existente ni se publica el piloto al cargarlo. Elegí una variante en **Variante para revisar** dentro de la ficha para comparar el resultado sin publicarlo. Guardar mantiene la ficha oculta; marcar “Mostrar en la web” y guardar la publica expresamente.

Para probar con un modelo real:

1. En **Telas y colores**, cargá nombre y código de la tela, su textura (foto cercana del tejido) y, para cada color, nombre, código y una muestra fotográfica. Se reutiliza el editor de encuadre y el almacenamiento de originales. Los códigos anteriores siguen funcionando; completá los nombres/códigos de tela que falten.
2. En **Productos**, elegí primero un solo sillón y habilitale la opción Tapizado. Podés limitarlo a las familias que vas a probar.
3. En **Prueba de tapizados por máscara**, cargá una base frontal, preferentemente con tapizado neutro, iluminada sin brillos fuertes. Se conserva completa, con orientación corregida y hasta 1600 px por lado, como PNG sin pérdida. El original del archivo cargado queda privado.
4. Abrí **Crear o editar máscara**. Pintá únicamente tela; excluí patas, madera, fondo y huecos. Podés borrar, deshacer, vaciar o importar un PNG preparado en otra herramienta: blanco reemplaza, negro/transparente protege y gris permite bordes suaves. El PNG debe medir exactamente lo mismo que la base publicada; el editor muestra sus dimensiones cuando una importación no coincide. No recortes por separado la base y la máscara. En celular se dibuja con el dedo.
5. Confirmá y revisá las pocas variantes desde la ficha. Activá “Mostrar vista previa de tapizados en este modelo” y guardá. El configurador ofrecerá primero tela y después color; la muestra seleccionada y la vista del sillón cambian juntas. El resumen y el mensaje de WhatsApp incluyen el nombre/código de tela y el nombre/código del color.
6. Volvé al mismo editor para corregir o reemplazar la máscara. Reemplazar la base retira la máscara del borrador y desactiva la vista previa para evitar desalineaciones. Las versiones anteriores y los originales permanecen guardados; confirmar/cancelar no publica nada hasta **Guardar**.

El render Canvas 2D se comparte entre admin y configurador: compone la muestra de color y el detalle de la textura con la luminosidad de la foto base, únicamente donde indica la máscara. Fondo, madera y píxeles fuera de la máscara se conservan; no se deforma ni se modifica destructivamente la base. Las sombras y pliegues provienen de la foto, por lo que una foto con estampado, tela muy oscura o luces coloreadas limita el resultado. No calcula perspectiva/UV ni sustituye una muestra física: el texto público indica que textura, escala y color son representativos y pueden variar con la pantalla y la iluminación. Si una variante no tiene muestra, se conserva la base y se explica; un archivo faltante o una máscara desalineada produce un mensaje, sin cambiar la selección ni la consulta.

Los nuevos datos son aditivos: `materials[].code`, `texture`, `swatches[].name` y `products[].upholstery = {enabled, base, mask}`. Node los conserva en `.storage/content.json`; PHP usa las fichas JSON existentes de `atelier_products` y `atelier_materials`, **sin tablas nuevas ni reinstalación**. Base y máscara se guardan como PNG sin pérdida con originales privados y metadatos en el sistema existente. El paquete Hostinger incluye sus archivos y originales referenciados. Respaldá contenido, originales, metadatos y base MySQL antes de actualizar.

Verificación: `npm test` cubre compatibilidad, máscaras, píxeles protegidos, sombras, originales, empaquetado y mensaje. Con Playwright y Chromium instalados, `node tests/upholstery-check.cjs` prueba el flujo completo en escritorio y celular; `ATELIER_BROWSER_CHECK=1 npm run test:php` lo verifica contra PHP/MySQL, además de probar PNG sin pérdida tanto con GD como con Imagick. Las pruebas usan almacenes y bases temporales, no el catálogo real.

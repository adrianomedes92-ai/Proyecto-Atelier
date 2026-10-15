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
- Se aplica la orientación de la cámara, se elimina la metadata original (incluida ubicación EXIF), se respeta la proporción y no se agranda el contenido de fotos pequeñas.
- Se convierten a **WebP**. Las fotos de productos conservan detalle hasta 1600 × 1600 px (caja máxima, sin recortar), y generan una miniatura de **800 × 640 px** para las tarjetas con fondo neutro para completar el encuadre.
- Inicio: caja máxima de 1920 × 2160 px. Muestras: caja máxima de 400 × 400 px, con calidad mayor para preservar textura. La conversión con compresión puede variar ligeramente el color; la muestra física es la referencia.
- El original subido no se conserva: guardá tus originales aparte. Algunas imágenes muy pequeñas ya comprimidas pueden no reducir su peso; la optimización prioriza dimensiones apropiadas y formatos consistentes.

**Guía de preparación visible en el admin:**

- **Productos:** 1600 × 1280 px, horizontal **5:4**, mueble centrado, alrededor de un **10% de margen libre**. Mostrá el producto entero; evitá textos incrustados en la foto.
- **Inicio:** 1920 × 1080 px, horizontal **16:9**, con el producto hacia la derecha y aproximadamente el 40% izquierdo libre para texto. Conservá margen alrededor del mueble y verificá la composición en celular.
- **Telas:** 800 × 800 px, cuadrada **1:1**, luz neutra y sin filtros. Mostrá una superficie representativa de la textura.

Las proporciones son recomendaciones: el sistema acepta otras dimensiones y muestra la foto completa sin deformar ni recortar. Las fotos ya cargadas siguen funcionando, pero **no se reconvierten solas**: volvé a cargarlas si querés optimizarlas. Respaldá `.storage` antes de hacerlo.

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

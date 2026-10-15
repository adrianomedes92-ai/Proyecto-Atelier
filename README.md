# Proyecto Atelier

Web en español rioplatense para explorar y personalizar muebles y consultar por WhatsApp, sin precios ni pagos. Panel de administración con contenido persistente. Node.js 22 o superior; sin dependencias externas.

## Correr en Visual Studio Code (Windows, macOS o Linux)

1. Abrí la carpeta **Proyecto-Atelier**, donde está `package.json`.
2. Abrí **Terminal → Nueva terminal** y ejecutá `npm run dev`.
3. Visitá **http://localhost:3000**. Para detener el servidor, usá `Ctrl+C`.

No hace falta `npm install`. No usar Live Server ni abrir el HTML como archivo: el panel y el catálogo necesitan el servidor Node.

## Habilitar el panel por primera vez

1. Detené el servidor con `Ctrl+C`.
2. Ejecutá `npm run admin:password`.
3. Ingresá dos veces una contraseña de al menos 12 caracteres. Por privacidad no se muestran los caracteres mientras escribís.
4. Volvé a ejecutar `npm run dev`.
5. Entrá a **http://localhost:3000/admin** e ingresá con esa contraseña.

Para cambiarla o recuperarla, repetí estos pasos. Reiniciar cierra las sesiones anteriores. La contraseña se guarda como hash con salt, nunca como texto plano. El panel utiliza una sesión de ocho horas, con cookie HttpOnly y control de origen para las operaciones que modifican datos. Después de cinco intentos incorrectos, el acceso desde esa dirección se limita durante 15 minutos.

## Administrar sin tocar código

- **Productos:** agregar/eliminar modelos, editar nombres, categorías, descripciones, estructura, medidas de referencia, rangos y patas confirmadas. Elegir qué opciones de personalización muestra cada modelo y qué telas admite. Ocultar modelos incompletos. Cargar hasta 12 fotos JPG, PNG o WebP (máximo 8 MB cada una), quitar fotos o elegir portada. La primera foto aparece en el catálogo y todas aparecen en la ficha.
- **Telas y colores:** agregar familias de material, tipo y descripción; cargar los códigos reales y una foto de cada muestra. Los códigos sin foto se muestran como texto, sin inventar colores. Podés restringir las familias por modelo desde Productos.
- **Contenido y contacto:** editar marca, títulos, textos de inicio/catálogo/contacto, los tres pasos, envíos, imagen de inicio, teléfono, personas de contacto y WhatsApp.
- **Respaldo:** exportar/restaurar un JSON de contenido. Este JSON contiene las rutas de fotos, pero no sus archivos.

Los cambios son un borrador hasta tocar **Guardar cambios**. Recargá la web pública para verlos. La subida de una foto conserva su archivo en el servidor, pero no aparece en el catálogo hasta guardar. El navegador avisa al salir con cambios pendientes. Si otra sesión guardó antes, se impide sobrescribirla: conservá tu borrador exportándolo, recargá y revisá los cambios antes de aplicar un respaldo.

### WhatsApp

El teléfono publicado es `11-73730703`. Antes de habilitar el botón, verificá con Guillermo o Agustín el número internacional correcto. Ingresalo en **Contenido y contacto → WhatsApp internacional**, solo dígitos, sin `+` ni espacios. No se asumió si corresponde `541173730703` o `5491173730703`. Vacío deshabilita WhatsApp; se permite copiar la consulta y llamar. El enlace abre WhatsApp sin enviar automáticamente el mensaje.

## Dónde se guarda la información

El servidor crea una carpeta **`.storage`** en el proyecto:

- `content.json`: productos, materiales y textos; se guarda de forma atómica.
- `uploads/`: fotos cargadas.
- `admin.json`: hash de la contraseña del panel.

**Respaldá toda la carpeta `.storage` en un lugar privado**, incluyendo las imágenes. Está excluida de Git: ni las fotos cargadas ni los cambios del admin se suben automáticamente a GitHub. Cada computadora tiene sus propios datos. Para compartir la administración, todos deben entrar al mismo servidor. No hay sincronización entre localhost y una futura web publicada.

No borres `.storage` al actualizar el código o extraer un ZIP nuevo. Con Git, `git pull origin main` actualiza el código y conserva esta carpeta. Si descargás un ZIP, reemplazá solo los archivos del programa o copiá `.storage` a la nueva carpeta antes de iniciar.

`data.js` contiene los datos iniciales, usados solo al crear el almacenamiento por primera vez. Una vez creado, editá el contenido desde `/admin`; modificar `data.js` no sobrescribe los datos guardados.

## Publicación

Esta versión funciona en un servidor Node con almacenamiento persistente. No alcanza con subir el HTML a un alojamiento estático. Para publicar:

- Usar Node >=22, un dominio y HTTPS, con `npm start`.
- Montar un volumen persistente y configurar `ATELIER_DATA_DIR` con su ruta. Respaldar datos e imágenes. No usar discos efímeros.
- Configurar `ADMIN_PASSWORD` de al menos 12 caracteres mediante las variables seguras del alojamiento; no escribirla en Git. Si se usa, prevalece sobre la contraseña creada por terminal.
- Configurar `HOST=0.0.0.0` y `PORT` según el proveedor. Localmente solo escucha en `127.0.0.1`.
- Activar `COOKIE_SECURE=true` bajo HTTPS. No activarlo en localhost HTTP.
- Mantener una sola instancia de servidor para este almacenamiento de archivos. Para múltiples instancias, migrar datos y sesiones a una base de datos y fotos a almacenamiento compartido.

## Validación y catálogo pendiente

`npm test` ejecuta pruebas de cotización y una prueba de API con autenticación, fotos, validación, conflictos y reinicio. También se probó en navegador el panel, las subidas, muestras, la web móvil y el mensaje de WhatsApp.

Los modelos iniciales conservan las medidas del pedido; no se inventaron fotografías, colores ni patas. El PDF adjunto superó el límite de transferencia de 32 MiB. Cargá las fotos reales y los códigos confirmados desde el panel y revisá la aplicabilidad de las familias por modelo antes de publicar. Las imágenes subidas durante las pruebas fueron temporales y no forman parte del catálogo real.

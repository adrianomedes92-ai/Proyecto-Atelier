# Proyecto Atelier
Web en español rioplatense, sin precios, carrito ni pagos. HTML, CSS y JavaScript modular, sin dependencias de producción. Node.js 22 o superior.

## Ejecutar
Desde `/workspace/Proyecto-Atelier`: `npm run dev`. Puerto 3000, configurable con `PORT`. `npm test` verifica validación y mensajes de cotización.

## Editar
- `data.js`: productos, medidas de referencia, rangos y opciones por modelo. `image` admite una ruta local (por ejemplo `/images/clapton.jpg`); guardar las fotos en `images/`. No se incluyen fotografías inventadas.
- `materials`: cargar códigos exactos del catálogo en `codes`. Hasta entonces el cliente solicita el muestrario y define el color con la fábrica; no hay muestras ficticias.
- `products[].legs`: lista de etiquetas confirmadas de patas. Vacía hasta comprobar las variantes. Los materiales generales madera/aluminio se mencionan como consulta, no se asignan a variantes.
- `contact.whatsappInternational`: **pendiente de confirmación**. El catálogo indica `11-73730703`; verificar con Guillermo o Agustín si corresponde `541173730703` o `5491173730703`, probando el número correcto en WhatsApp. Guardarlo solo con dígitos. El enlace permanece deshabilitado hasta configurarlo. No se asumió el prefijo. `contact.display` contiene el teléfono publicado.
- `options` permite declarar capacidades por producto. Para futuros muebles, extender los datos y el renderizado/validación con especie, acabado y tamaño; no hay modelos de madera inventados.

El PDF adjunto supera el límite de transferencia de 32 MiB. Los datos iniciales proceden del pedido; fotos, códigos de color, variantes de patas y aplicabilidad por modelo requieren comprobar el catálogo antes de publicar. Las familias de tapizado se ofrecen para consultar en sillones; la fábrica debe confirmar su disponibilidad. Puffs permiten consulta de color y disponibilidad sin asumir materiales ni medidas.

Los borradores se conservan en memoria al cerrar la ficha y cambiar de categoría. No persisten al recargar. El resumen se actualiza en tiempo real; la consulta nunca se envía automáticamente. Las medidas personalizadas siempre son solicitudes a confirmar. Para poner el sitio en producción, servir los archivos estáticos con HTTPS; el servidor Node incluido es para desarrollo.

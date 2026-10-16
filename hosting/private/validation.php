<?php
namespace Atelier;
function object_value($value, string $label): array {
    if (!is_array($value) || ($value !== [] && array_is_list($value))) fail(400, "$label: datos inválidos.");
    return $value;
}
function text_value($value, string $label, int $max = 4000): string {
    if (!is_string($value) || preg_match_all('/./us', $value) > $max) fail(400, "$label: texto inválido.");
    return trim($value);
}
function list_value($value, string $label, int $max = 200): array {
    if (!is_array($value) || !array_is_list($value) || count($value) > $max) fail(400, "$label: lista inválida.");
    return $value;
}
function string_list($value, string $label): array {
    return array_map(fn($v) => text_value($v, $label, 200), list_value($value, $label));
}
function image_value($value): string {
    if ($value === null || $value === '') return '';
    $path = text_value($value, 'Imagen', 250);
    if (!preg_match('~^/uploads/[a-f0-9-]+(?:-(?:optimized|card))?\.(?:png|jpg|webp)$~D', $path) && !preg_match('~^/images/[a-zA-Z0-9_/-]+\.(?:png|jpg|jpeg|webp)$~D', $path)) fail(400, 'La imagen debe cargarse desde el panel.');
    return $path;
}
function unique_list(array $items): bool { return count(array_unique($items, SORT_STRING)) === count($items); }
function validate_content($input): array {
    $value = object_value($input, 'Contenido'); $s = object_value($value['site'] ?? null, 'Marca'); $site = [];
    foreach (['name','heroTitle','heroDescription','tagline','shipping','collectionTitle','collectionDescription','contactTitle','contactDescription','footer','heroButton','collectionEyebrow','contactEyebrow'] as $key) $site[$key] = text_value($s[$key] ?? null, $key);
    if ($site['name'] === '' || $site['heroTitle'] === '') fail(400, 'Completá el nombre y el título de inicio.');
    $size = $s['brandFontSize'] ?? 22;
    if (!is_int($size) || $size < 16 || $size > 36) fail(400, 'El tamaño de la marca debe ser un entero entre 16 y 36 px.');
    $site['brandFontSize'] = $size;
    $legacy = image_value($s['heroImage'] ?? '');
    $site['heroImages'] = array_key_exists('heroImages', $s) ? array_map(__NAMESPACE__.'\\image_value', list_value($s['heroImages'], 'Imágenes de portada', 12)) : ($legacy ? [$legacy] : []);
    if (in_array('', $site['heroImages'], true) || !unique_list($site['heroImages'])) fail(400, 'Las imágenes de portada deben ser válidas y no estar repetidas.');
    $site['heroImage'] = $site['heroImages'][0] ?? '';
    $site['steps'] = array_map(function($step) { $step = object_value($step, 'Paso'); return ['title'=>text_value($step['title'] ?? null,'Título del paso',100),'description'=>text_value($step['description'] ?? null,'Descripción del paso',500)]; }, list_value($s['steps'] ?? null,'Pasos',3));
    if (count($site['steps']) !== 3) fail(400, 'El proceso debe tener tres pasos.');
    $c = object_value($value['contact'] ?? null, 'Contacto');
    $contact = ['display'=>text_value($c['display'] ?? null,'Teléfono',100),'whatsappInternational'=>text_value($c['whatsappInternational'] ?? null,'WhatsApp',20),'people'=>string_list($c['people'] ?? null,'Contactos')];
    if ($contact['whatsappInternational'] !== '' && !preg_match('/^\d{10,15}$/D', $contact['whatsappInternational'])) fail(400, 'WhatsApp: usá entre 10 y 15 dígitos sin + ni espacios.');
    $materials = [];
    foreach (list_value($value['materials'] ?? null,'Materiales',100) as $m) {
        $m = object_value($m,'Material'); $name=text_value($m['name'] ?? null,'Familia',100); $type=text_value($m['type'] ?? null,'Tipo',100);
        if ($name === '' || $type === '') fail(400,'Completá nombre y tipo de cada familia.');
        $codes = string_list($m['codes'] ?? null,'Códigos');
        if (!unique_list($codes) || in_array('',$codes,true)) fail(400,'Los códigos deben ser únicos y no estar vacíos.');
        $swatches = [];
        foreach (list_value($m['swatches'] ?? [],'Muestras') as $swatch) {
            $swatch=object_value($swatch,'Muestra'); if(array_key_exists('active',$swatch)&&!is_bool($swatch['active']))fail(400,'El estado de la variante debe ser activo o inactivo.'); $code=text_value($swatch['code'] ?? null,'Código',200);
            if (!in_array($code,$codes,true)) fail(400,'La muestra debe corresponder a un código de su familia.');
            $swatches[]=['code'=>$code,'image'=>image_value($swatch['image'] ?? ''),'name'=>text_value($swatch['name'] ?? '','Nombre del color',100),'active'=>($swatch['active']??true)!==false];
        }
        if (!unique_list(array_column($swatches,'code'))) fail(400,'Cada muestra debe tener un código único.');
        $materials[]=['code'=>text_value($m['code'] ?? '','Código de tela',100),'name'=>$name,'type'=>$type,'description'=>text_value($m['description'] ?? '','Descripción de material'),'codes'=>$codes,'swatches'=>$swatches];
    }
    $names=array_column($materials,'name');
    if (!unique_list($names)) fail(400,'Los nombres de familias deben ser únicos.');
    $products=[];
    foreach (list_value($value['products'] ?? null,'Productos') as $p) {
        $p=object_value($p,'Producto'); $id=text_value($p['id'] ?? null,'ID',100); $name=text_value($p['name'] ?? null,'Modelo',100); $category=text_value($p['category'] ?? null,'Categoría',100);
        if (!preg_match('/^[a-z0-9-]+$/D',$id) || $name === '' || $category === '') fail(400,'Completá nombre, categoría e ID válido.');
        $reference=text_value($p['reference'] ?? '','Medidas',200); $options=string_list($p['options'] ?? null,'Opciones');
        if (array_diff($options,['material','measure','color','layout','notes'])) fail(400,'Opción desconocida.');
        if (in_array('measure',$options,true) && $reference === '') fail(400,"$name: ingresá medidas de referencia o desactivá esa opción.");
        $range=$p['range'] ?? null;
        if ($range !== null && (!is_array($range) || !array_is_list($range) || count($range)!==2 || !is_numeric($range[0]) || !is_numeric($range[1]) || is_string($range[0]) || is_string($range[1]) || $range[0]<=0 || $range[1]<$range[0])) fail(400,"$name: rango de ancho inválido.");
        $allowed=string_list($p['materialNames'] ?? [],'Familias habilitadas');
        if (array_diff($allowed,$names)) fail(400,"$name: hay familias que ya no existen.");
        if (in_array('material',$options,true) && !$materials) fail(400,"$name: cargá al menos una familia de tapizado.");
        $images=array_values(array_filter(array_map(__NAMESPACE__.'\\image_value',list_value($p['images'] ?? [],'Fotos',12)),fn($path)=>$path!==''));
        $products[]=['id'=>$id,'name'=>$name,'category'=>$category,'reference'=>$reference,'description'=>text_value($p['description'] ?? '','Descripción'),'structure'=>text_value($p['structure'] ?? '','Estructura',200),'visible'=>($p['visible'] ?? true)!==false,'range'=>$range,'options'=>$options,'materialNames'=>$allowed,'legs'=>string_list($p['legs'] ?? [],'Patas'),'variants'=>variant_values($p['variants'] ?? [],$materials),'image'=>image_value($p['image'] ?? ''),'images'=>$images];
    }
    if (!unique_list(array_column($products,'id'))) fail(400,'Los IDs de productos deben ser únicos.');
    return ['site'=>$site,'contact'=>$contact,'materials'=>$materials,'products'=>$products];
}

function content_image_paths(array $content): array {
    $paths=$content['site']['heroImages'];
    foreach ($content['products'] as $product) $paths=array_merge($paths,[$product['image']],$product['images'],array_merge([], ...array_column($product['variants'],'images')));
    foreach ($content['materials'] as $material) { foreach ($material['swatches'] as $swatch) $paths[]=$swatch['image']; }
    return array_values(array_unique(array_filter($paths,fn($path)=>$path!=='')));
}

function variant_values($value,array $materials): array {
    $result=[];$keys=[];
    foreach(list_value($value,'Variantes por mueble',200) as $item){
        $v=object_value($item,'Variante por mueble');$material=text_value($v['material']??null,'Tela asociada',100);$code=text_value($v['code']??null,'Código de variante',200);
        $found=false;foreach($materials as $m)if($m['name']===$material && in_array($code,$m['codes'],true))$found=true;
        if(!$found)fail(400,'La variante asociada debe corresponder a una tela y código existentes.');
        $images=array_map(__NAMESPACE__.'\\image_value',list_value($v['images']??[],'Fotos de variante',12));
        if(in_array('',$images,true)||!unique_list($images))fail(400,'Las fotos de una variante deben ser válidas y no estar repetidas.');
        $key=encode([$material,$code]);if(in_array($key,$keys,true))fail(400,'Cada mueble admite una sola asociación por tela y código.');$keys[]=$key;
        $result[]=['material'=>$material,'code'=>$code,'images'=>$images];
    }
    return $result;
}

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
require_once __DIR__.'/color-migration.php';
require_once __DIR__.'/sections.php';
function validate_content($input): array {
    $value = migrate_sections(migrate_color_catalog(object_value($input, 'Contenido'))); $sections=section_values($value['sections']); $s = object_value($value['site'] ?? null, 'Marca'); $site = [];
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
    $colors=[];
    foreach(list_value($value['colors']??null,'Catálogo de colores',20000) as $c){
        $c=object_value($c,'Color');$code=text_value($c['code']??null,'Código de color',200);$name=text_value($c['name']??null,'Nombre de color',200);
        if($code===''||$name==='')fail(400,'Completá el nombre y código de cada color.');
        if(array_key_exists('reviewRequired',$c)&&!is_bool($c['reviewRequired']))fail(400,'Estado de revisión inválido.');
        $colors[]=['code'=>$code,'name'=>$name,'reviewRequired'=>($c['reviewRequired']??false)===true,'legacyNames'=>string_list($c['legacyNames']??[],'Nombres anteriores')];
    }
    $colorKeys=array_column($colors,'code');if(!unique_list($colorKeys))fail(400,'Cada código de color debe cargarse una sola vez en el catálogo.');
    $materials=[];
    foreach(list_value($value['materials']??null,'Materiales',100) as $m){
        $m=object_value($m,'Tipo de tela');$name=text_value($m['name']??null,'Tela',100);$type=text_value($m['type']??null,'Tipo',100);$colorCodes=string_list($m['colorCodes']??[],'Colores habilitados');
        if($name===''||$type==='')fail(400,'Completá nombre y tipo de cada tela.');
        if(!unique_list($colorCodes)||array_diff($colorCodes,$colorKeys))fail(400,'La tela debe habilitar colores únicos existentes en el catálogo.');
        $materials[]=['name'=>$name,'type'=>$type,'code'=>text_value($m['code']??'','Código de tela',100),'description'=>text_value($m['description']??'','Descripción'),'colorCodes'=>$colorCodes];
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
        $sectionId=text_value($p['sectionId']??null,'Sección del producto',100);$subsectionId=text_value($p['subsectionId']??'','Subsección',100);$section=null;foreach($sections as $s)if($s['id']===$sectionId)$section=$s;
        if(!$section||($subsectionId!==''&&!in_array($subsectionId,array_column($section['subsections'],'id'),true)))fail(400,"$name: elegí una sección y subsección válidas.");
        $sortOrder=$p['sortOrder']??0;if(!is_int($sortOrder)||$sortOrder<0||$sortOrder>1000000)fail(400,'Orden de producto inválido.');
        $products[]=['sectionId'=>$sectionId,'subsectionId'=>$subsectionId,'sortOrder'=>$sortOrder,'id'=>$id,'name'=>$name,'category'=>$category,'reference'=>$reference,'description'=>text_value($p['description'] ?? '','Descripción'),'structure'=>text_value($p['structure'] ?? '','Estructura',200),'visible'=>($p['visible'] ?? true)!==false,'range'=>$range,'options'=>$options,'materialNames'=>$allowed,'legs'=>string_list($p['legs'] ?? [],'Patas'),'variants'=>variant_values($p['variants'] ?? [],$colors),'image'=>image_value($p['image'] ?? ''),'images'=>$images];
    }
    if (!unique_list(array_column($products,'id'))) fail(400,'Los IDs de productos deben ser únicos.');
    return ['taxonomyVersion'=>1,'sections'=>$sections,'catalogVersion'=>2,'site'=>$site,'contact'=>$contact,'colors'=>$colors,'materials'=>$materials,'products'=>$products];
}

function content_image_paths(array $content): array {
    $paths=$content['site']['heroImages'];
    foreach ($content['products'] as $product) $paths=array_merge($paths,[$product['image']],$product['images'],array_merge([], ...array_column($product['variants'],'images')));
    return array_values(array_unique(array_filter($paths,fn($path)=>$path!=='')));
}

function variant_values($value,array $colors): array {
    $result=[];$keys=[];
    foreach(list_value($value,'Colores por mueble',20000) as $item){
        $v=object_value($item,'Galería de color');$code=text_value($v['code']??null,'Código de color',200);
        if(!in_array($code,array_column($colors,'code'),true))fail(400,'La galería debe corresponder a un código del catálogo de colores.');
        $images=array_map(__NAMESPACE__.'\\image_value',list_value($v['images']??[],'Fotos de color',1200));
        if(in_array('',$images,true)||!unique_list($images))fail(400,'Las fotos de una galería deben ser válidas y no estar repetidas.');
        if(in_array($code,$keys,true))fail(400,'Cada mueble admite una sola galería por código de color.');$keys[]=$code;
        if(array_key_exists('reviewRequired',$v)&&!is_bool($v['reviewRequired']))fail(400,'Estado de revisión de galería inválido.');
        $result[]=['code'=>$code,'images'=>$images,'reviewRequired'=>($v['reviewRequired']??false)===true];
    }
    return $result;
}

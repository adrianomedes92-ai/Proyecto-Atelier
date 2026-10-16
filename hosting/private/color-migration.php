<?php
namespace Atelier;
function migrate_color_catalog(array $value): array {
    if(array_key_exists('colors',$value))return $value;
    $originalMaterials=list_value($value['materials']??null,'Materiales',100);$colors=[];
    foreach($value['materials'] as &$m){
        $m=object_value($m,'Material');$m['name']=text_value($m['name']??null,'Tela',100);$codes=string_list($m['codes']??[],'Códigos');$swatches=list_value($m['swatches']??[],'Muestras');
        if(!unique_list($codes)||in_array('',$codes,true))fail(400,'Los códigos deben ser únicos y no estar vacíos.');
        foreach($swatches as $s){$s=object_value($s,'Muestra');if(!in_array(text_value($s['code']??null,'Código',200),$codes,true)||(array_key_exists('active',$s)&&!is_bool($s['active'])))fail(400,'El catálogo anterior de colores contiene datos inválidos.');}
        $m['colorCodes']=[];
        foreach($codes as $code){
            $swatch=null;foreach($swatches as $s)if(trim($s['code'])===$code){$swatch=$s;break;}
            $name=text_value($swatch['name']??'','Nombre de color',100);$key='c:'.$code;
            if(!isset($colors[$key]))$colors[$key]=['code'=>$code,'name'=>$name?:$code,'reviewRequired'=>false,'legacyNames'=>[]];
            if($name!==''&&!in_array($name,$colors[$key]['legacyNames'],true))$colors[$key]['legacyNames'][]=$name;
            if(count($colors[$key]['legacyNames'])>1)$colors[$key]['reviewRequired']=true;
            if(count($colors[$key]['legacyNames'])===1)$colors[$key]['name']=$colors[$key]['legacyNames'][0];
            if(($swatch['active']??true)!==false)$m['colorCodes'][]=$code;
        }
        unset($m['codes'],$m['swatches'],$m['texture']);
    }unset($m);
    foreach(list_value($value['products']??null,'Productos') as $index=>$p){
        $p=object_value($p,'Producto');$galleries=[];
        foreach(list_value($p['variants']??[],'Variantes',200) as $old){
            $old=object_value($old,'Variante');$code=text_value($old['code']??null,'Código',200);$material=text_value($old['material']??null,'Tela asociada',100);$found=false;
            foreach($originalMaterials as $m)if(trim($m['name'])===$material&&in_array($code,array_map('trim',$m['codes']),true))$found=true;
            if(!$found)fail(400,'La variante anterior debe corresponder a una tela y código existentes.');
            $images=array_map(__NAMESPACE__.'\\text_value_image_path',list_value($old['images']??[],'Fotos',12));$key='c:'.$code;
            if(!isset($galleries[$key]))$galleries[$key]=['code'=>$code,'images'=>array_values(array_unique($images,SORT_STRING)),'reviewRequired'=>false];
            else {
                if($images && $galleries[$key]['images'] && $images!==$galleries[$key]['images'])$galleries[$key]['reviewRequired']=true;
                $galleries[$key]['images']=array_values(array_unique(array_merge($galleries[$key]['images'],$images),SORT_STRING));
            }
        }
        $value['products'][$index]['variants']=array_values($galleries);
    }
    $value['colors']=array_values($colors);$value['catalogVersion']=2;return $value;
}
function text_value_image_path($value): string {return text_value($value,'Ruta de foto',250);}

<?php
namespace Atelier;
function migrate_sections(array $value): array {
    if(array_key_exists('sections',$value))return $value;
    $names=['Individuales','Sillones','Modulares','Puffs'];foreach($value['products']??[] as $p)if(!empty($p['category'])&&!in_array($p['category'],$names,true))$names[]=$p['category'];
    $subs=[];foreach($names as $i=>$name)$subs[]=['id'=>'tapizados-'.($i+1),'name'=>$name,'active'=>true];
    $wood=[];foreach(['Racks','Mesas de luz','Mesas ratonas','Mesas','Sillas','Estanterías'] as $i=>$name)$wood[]=['id'=>'madera-'.($i+1),'name'=>$name,'active'=>true];
    $value['sections']=[['id'=>'sillones','name'=>'Sillones','active'=>true,'subsections'=>$subs],['id'=>'muebles-de-madera','name'=>'Muebles de madera','active'=>true,'subsections'=>$wood]];$value['taxonomyVersion']=1;
    foreach($value['products'] as $i=>&$p){$p['sectionId']='sillones';$p['subsectionId']='';foreach($subs as $sub)if($sub['name']===($p['category']??''))$p['subsectionId']=$sub['id'];$p['sortOrder']=$i;}unset($p);
    return $value;
}
function section_node($input): array {
    $n=object_value($input,'Categoría');$id=text_value($n['id']??null,'ID de categoría',100);$name=text_value($n['name']??null,'Nombre de categoría',100);
    if(!preg_match('/^[a-z0-9-]+$/D',$id)||$name===''||!is_bool($n['active']??null))fail(400,'Completá nombre, ID y estado de la categoría.');
    return ['id'=>$id,'name'=>$name,'active'=>$n['active']];
}
function section_values($input): array {
    $sections=[];$ids=[];
    foreach(list_value($input,'Secciones',100) as $s){$section=section_node($s);$ids[]=$section['id'];$section['subsections']=[];foreach(list_value($s['subsections']??null,'Subsecciones',200) as $sub){$sub=section_node($sub);$ids[]=$sub['id'];$section['subsections'][]=$sub;}$sections[]=$section;}
    if(!unique_list($ids))fail(400,'Los identificadores de categorías deben ser únicos.');return $sections;
}
function public_catalog(array $content): array {
    $products=[];$sections=[];
    foreach($content['sections'] as $s){if(!$s['active'])continue;$subs=[];
        foreach($s['subsections'] as $sub)if($sub['active'])$subs[]=$sub;
        $local=array_values(array_filter($content['products'],fn($p)=>$p['visible']&&$p['sectionId']===$s['id']&&($p['subsectionId']===''||in_array($p['subsectionId'],array_column($subs,'id'),true))));
        if(!$local)continue;$s['subsections']=array_values(array_filter($subs,fn($sub)=>in_array($sub['id'],array_column($local,'subsectionId'),true)));$sections[]=$s;$products=array_merge($products,$local);
    }
    $content['products']=$products;$content['sections']=$sections;return $content;
}

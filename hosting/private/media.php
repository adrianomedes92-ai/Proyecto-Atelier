<?php
namespace Atelier;
function image_engine(): string {
    $engine=config()['image_engine'] ?? 'auto';
    if ($engine==='auto') $engine=(class_exists('Imagick') && \Imagick::queryFormats('WEBP'))?'imagick':'gd';
    if ($engine==='imagick' && class_exists('Imagick') && \Imagick::queryFormats('WEBP')) return 'imagick';
    if ($engine==='gd' && function_exists('imagewebp')) return 'gd';
    fail(503,'El servidor necesita GD o Imagick con soporte WebP.');
}
function animated_image(string $bytes, int $type): bool {
    if ($type===IMAGETYPE_PNG) {
        for ($offset=8; $offset+12<=strlen($bytes);) {
            $length=unpack('N',substr($bytes,$offset,4))[1];$chunk=substr($bytes,$offset+4,4);
            if ($chunk==='acTL') return true;if ($length>strlen($bytes)-$offset-12) break;$offset+=$length+12;
        }
    }
    if ($type===IMAGETYPE_WEBP) {
        for ($offset=12; $offset+8<=strlen($bytes);) {
            $chunk=substr($bytes,$offset,4);$length=unpack('V',substr($bytes,$offset+4,4))[1];
            if (in_array($chunk,['ANIM','ANMF'],true)) return true;if ($length>strlen($bytes)-$offset-8) break;$offset+=8+$length+($length%2);
        }
    }
    return false;
}
function gd_canvas(int $width,int $height,bool $neutral=false) {
    $image=imagecreatetruecolor($width,$height);imagealphablending($image,false);imagesavealpha($image,true);
    imagefill($image,0,0,$neutral?imagecolorallocate($image,232,231,222):imagecolorallocatealpha($image,0,0,0,127));return $image;
}
function gd_webp($image,int $quality): string { ob_start();try { if (!imagewebp($image,null,$quality)) fail(400,'No se pudo convertir la imagen a WebP.');return ob_get_contents(); } finally {ob_end_clean();} }
function optimize_media(string $bytes,string $kind,?array $crop=null): array {
    $presets=['product'=>[1600,1600,82],'hero'=>[1920,2160,82],'swatch'=>[400,400,90]];
    if (!isset($presets[$kind])) fail(400,'Tipo de imagen inválido.');
    $size=@getimagesizefromstring($bytes);
    if (!$size || !in_array($size[2],[IMAGETYPE_JPEG,IMAGETYPE_PNG,IMAGETYPE_WEBP],true)) fail(400,'Usá una imagen JPG, PNG o WebP válida.');
    if ($size[0]*$size[1]>60000000 || animated_image($bytes,$size[2])) fail(400,'Usá una imagen sin animación y de hasta 60 megapíxeles.');
    [$maxw,$maxh,$quality]=$presets[$kind];$engine=image_engine();$card=null;
    try {
        if ($engine==='imagick') {
            \Imagick::setResourceLimit(\Imagick::RESOURCETYPE_MEMORY,128*1024*1024);
            \Imagick::setResourceLimit(\Imagick::RESOURCETYPE_MAP,256*1024*1024);
            \Imagick::setResourceLimit(\Imagick::RESOURCETYPE_DISK,256*1024*1024);
            $image=new \Imagick();$image->readImageBlob($bytes);
            if ($image->getNumberImages()!==1) fail(400,'No se admiten imágenes animadas.');
            $image->autoOrient();
            $sourceWidth=$image->getImageWidth();$sourceHeight=$image->getImageHeight();
            if ($crop!==null) { validate_crop($crop,$sourceWidth,$sourceHeight,$kind);$image->cropImage($crop['width'],$crop['height'],$crop['x'],$crop['y']);$image->setImagePage(0,0,0,0); }
            $image->transformImageColorspace(\Imagick::COLORSPACE_SRGB);
            $width=$image->getImageWidth();$height=$image->getImageHeight();$scale=min(1,$maxw/$width,$maxh/$height);
            if ($scale<1) $image->resizeImage(max(1,(int)round($width*$scale)),max(1,(int)round($height*$scale)),\Imagick::FILTER_LANCZOS,1);
            $width=$image->getImageWidth();$height=$image->getImageHeight();
            $image->stripImage();$image->setImageFormat('webp');$image->setImageCompressionQuality($quality);$data=$image->getImageBlob();
            if ($kind==='product') {
                $thumb=clone $image;$scale=min(1,800/$width,640/$height);
                if ($scale<1) $thumb->resizeImage(max(1,(int)round($width*$scale)),max(1,(int)round($height*$scale)),\Imagick::FILTER_LANCZOS,1);
                $canvas=new \Imagick();$canvas->newImage(800,640,new \ImagickPixel('#e8e7de'),'webp');
                $canvas->compositeImage($thumb,\Imagick::COMPOSITE_OVER,(int)((800-$thumb->getImageWidth())/2),(int)((640-$thumb->getImageHeight())/2));
                $canvas->stripImage();$canvas->setImageCompressionQuality(78);$card=$canvas->getImageBlob();$thumb->clear();$canvas->clear();
            }
            $image->clear();
        } else {
            $limit=ini_get('memory_limit');$memory=(int)$limit;
            if (str_ends_with(strtolower($limit),'g')) $memory*=1024*1024*1024;elseif(str_ends_with(strtolower($limit),'m')) $memory*=1024*1024;elseif(str_ends_with(strtolower($limit),'k')) $memory*=1024;
            if ($memory>0 && memory_get_usage(true)+strlen($bytes)*2+$size[0]*$size[1]*10+1600*1600*8>$memory*.85) fail(413,'La foto requiere demasiada memoria para GD. Reducí sus dimensiones o activá Imagick.');
            set_error_handler(function(){throw new \RuntimeException('Imagen dañada.');});try{$image=imagecreatefromstring($bytes);}finally{restore_error_handler();}
            if (!$image) fail(400,'No se pudo leer la imagen.');
            if ($size[2]===IMAGETYPE_JPEG && function_exists('exif_read_data')) {
                $file=tempnam(storage(),'exif-');try{file_put_contents($file,$bytes);$exif=@exif_read_data($file);$orientation=(int)($exif['Orientation'] ?? 1);}finally{unlink($file);}
                $angle=match($orientation){3,4=>180,5,6=>-90,7,8=>90,default=>0};
                if ($angle) {$rotated=imagerotate($image,$angle,0);imagedestroy($image);$image=$rotated;}
                if (in_array($orientation,[2,4,5,7],true)) imageflip($image,IMG_FLIP_HORIZONTAL);
            }
            $sourceWidth=imagesx($image);$sourceHeight=imagesy($image);
            if ($crop!==null) { validate_crop($crop,$sourceWidth,$sourceHeight,$kind);$cropped=imagecrop($image,$crop);if(!$cropped)fail(400,'No se pudo recortar la imagen.');imagedestroy($image);$image=$cropped; }
            $scale=min(1,$maxw/imagesx($image),$maxh/imagesy($image));$width=max(1,(int)round(imagesx($image)*$scale));$height=max(1,(int)round(imagesy($image)*$scale));
            $resized=gd_canvas($width,$height);imagecopyresampled($resized,$image,0,0,0,0,$width,$height,imagesx($image),imagesy($image));imagedestroy($image);
            $data=gd_webp($resized,$quality);
            if ($kind==='product') {
                $scale=min(1,800/$width,640/$height);$w=max(1,(int)round($width*$scale));$h=max(1,(int)round($height*$scale));
                $canvas=gd_canvas(800,640,true);imagealphablending($canvas,true);imagecopyresampled($canvas,$resized,(int)((800-$w)/2),(int)((640-$h)/2),0,0,$w,$h,$width,$height);$card=gd_webp($canvas,78);imagedestroy($canvas);
            }
            imagedestroy($resized);
        }
        return ['sourceWidth'=>$sourceWidth,'sourceHeight'=>$sourceHeight,'data'=>$data,'card'=>$card,'width'=>$width,'height'=>$height,'originalBytes'=>strlen($bytes),'optimizedBytes'=>strlen($data)+strlen($card ?? '')];
    } catch (HttpError $e) { throw $e; }
    catch (\Throwable $e) {error_log('Atelier image: '.$e->getMessage());fail(400,'No se pudo procesar la foto. Usá JPG, PNG o WebP sin animación y probá reducir sus dimensiones.');}
}

function validate_crop(array $crop,int $width,int $height,string $kind): void {
    $ratios=['product'=>5/4,'hero'=>16/9,'swatch'=>1];
    foreach (['x','y','width','height'] as $key) if(!isset($crop[$key])||!is_int($crop[$key]))fail(400,'El encuadre no es válido.');
    if (!isset($ratios[$kind]) || $crop['x']<0 || $crop['y']<0 || $crop['width']<1 || $crop['height']<1 || $crop['x']+$crop['width']>$width || $crop['y']+$crop['height']>$height || abs($crop['width']-$crop['height']*$ratios[$kind])>2) fail(400,'El encuadre está fuera de la imagen o no tiene la proporción adecuada.');
}
function media_table(): void {
    try {db()->query('SELECT url FROM atelier_media LIMIT 0');}
    catch (\PDOException $e) {if(($e->errorInfo[1]??0)!==1146)throw $e;db()->exec("CREATE TABLE IF NOT EXISTS atelier_media (url VARCHAR(250) NOT NULL PRIMARY KEY,payload LONGTEXT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin");}
}
function media_name(string $url): string {
    if (!preg_match('~^/uploads/[a-f0-9-]+(?:-(?:optimized|card))?\.(jpg|png|webp)$~D',$url))fail(400,'La imagen no es válida.');return substr($url,9);
}
function media_info(string $url): array {
    if(preg_match('~^/images/[a-zA-Z0-9_/-]+\.(jpg|jpeg|png|webp)$~D',$url)){if(!is_file(dirname(__DIR__).'/public_html'.$url))fail(404,'No se encontró la imagen.');return ['url'=>$url,'crop'=>null,'sourceUrl'=>$url,'legacy'=>true];}
    $name=media_name($url);media_table();$q=db()->prepare('SELECT payload FROM atelier_media WHERE url=?');$q->execute([$url]);$payload=$q->fetchColumn();
    if(!$payload && is_file(storage().'/media/'.$name.'.json')){$payload=file_get_contents(storage().'/media/'.$name.'.json');db()->prepare('INSERT IGNORE INTO atelier_media (url,payload) VALUES (?,?)')->execute([$url,$payload]);}
    if($payload){$info=json_decode($payload,true,512,JSON_THROW_ON_ERROR);return array_merge($info,['sourceUrl'=>'/api/admin/image-source?url='.rawurlencode($url),'legacy'=>false]);}
    if(!is_file(storage().'/uploads/'.$name))fail(404,'No se encontró la imagen.');return ['url'=>$url,'crop'=>null,'sourceUrl'=>$url,'legacy'=>true];
}
function original_bytes(array $info): string {
    if($info['legacy'] && str_starts_with($info['url'],'/images/'))$file=dirname(__DIR__).'/public_html'.image_value($info['url']);
    elseif($info['legacy'])$file=storage().'/uploads/'.media_name($info['url']);
    else {if(!preg_match('/^[a-f0-9-]+\.(jpg|png|webp)$/D',$info['original']))fail(400,'Original inválido.');$file=storage().'/originals/'.$info['original'];}
    if(!is_file($file))fail(404,'No se encontró el original. Revisá el respaldo de originales.');return file_get_contents($file);
}
function upload_media(string $bytes,string $kind,?array $crop=null,?string $original=null): array {
    $result=optimize_media($bytes,$kind,$crop);$id=bin2hex(random_bytes(16));$name=$id.($kind==='product'?'-optimized.webp':'.webp');$path=storage().'/uploads/';
    foreach(['originals','media'] as $directory)if(!is_dir(storage().'/'.$directory))mkdir(storage().'/'.$directory,0700,true);
    if($original===null){$type=getimagesizefromstring($bytes)[2];$original=bin2hex(random_bytes(16)).'.'.([IMAGETYPE_JPEG=>'jpg',IMAGETYPE_PNG=>'png',IMAGETYPE_WEBP=>'webp'][$type]);if(file_put_contents(storage().'/originals/'.$original,$bytes,LOCK_EX)===false)fail(503,'No se pudo conservar el original.');}
    if (file_put_contents($path.$name,$result['data'],LOCK_EX)===false) fail(503,'No se pudo guardar la foto. Revisá el espacio y los permisos.');
    $output=['url'=>'/uploads/'.$name,'original'=>$original,'kind'=>$kind,'crop'=>$crop,'sourceWidth'=>$result['sourceWidth'],'sourceHeight'=>$result['sourceHeight'],'width'=>$result['width'],'height'=>$result['height']];
    if ($result['card']!==null) {
        if (file_put_contents($path.$id.'-card.webp',$result['card'],LOCK_EX)===false) {unlink($path.$name);fail(503,'No se pudo guardar la miniatura.');}
        $output['thumbnailUrl']='/uploads/'.$id.'-card.webp';
    }
    media_table();$q=db()->prepare('INSERT INTO atelier_media (url,payload) VALUES (?,?)');$q->execute([$output['url'],encode($output)]);
    if(file_put_contents(storage().'/media/'.$name.'.json',encode($output),LOCK_EX)===false)fail(503,'No se pudo guardar el encuadre.');
    foreach (['originalBytes','optimizedBytes'] as $key) $output[$key]=$result[$key];return $output;
}

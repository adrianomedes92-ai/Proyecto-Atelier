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
function optimize_media(string $bytes,string $kind): array {
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
            $image->autoOrient();$image->transformImageColorspace(\Imagick::COLORSPACE_SRGB);
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
            $scale=min(1,$maxw/imagesx($image),$maxh/imagesy($image));$width=max(1,(int)round(imagesx($image)*$scale));$height=max(1,(int)round(imagesy($image)*$scale));
            $resized=gd_canvas($width,$height);imagecopyresampled($resized,$image,0,0,0,0,$width,$height,imagesx($image),imagesy($image));imagedestroy($image);
            $data=gd_webp($resized,$quality);
            if ($kind==='product') {
                $scale=min(1,800/$width,640/$height);$w=max(1,(int)round($width*$scale));$h=max(1,(int)round($height*$scale));
                $canvas=gd_canvas(800,640,true);imagealphablending($canvas,true);imagecopyresampled($canvas,$resized,(int)((800-$w)/2),(int)((640-$h)/2),0,0,$w,$h,$width,$height);$card=gd_webp($canvas,78);imagedestroy($canvas);
            }
            imagedestroy($resized);
        }
        return ['data'=>$data,'card'=>$card,'width'=>$width,'height'=>$height,'originalBytes'=>strlen($bytes),'optimizedBytes'=>strlen($data)+strlen($card ?? '')];
    } catch (HttpError $e) { throw $e; }
    catch (\Throwable $e) {error_log('Atelier image: '.$e->getMessage());fail(400,'No se pudo procesar la foto. Usá JPG, PNG o WebP sin animación y probá reducir sus dimensiones.');}
}
function upload_media(string $bytes,string $kind): array {
    $result=optimize_media($bytes,$kind);$id=bin2hex(random_bytes(16));$name=$id.($kind==='product'?'-optimized.webp':'.webp');$path=storage().'/uploads/';
    if (file_put_contents($path.$name,$result['data'],LOCK_EX)===false) fail(503,'No se pudo guardar la foto. Revisá el espacio y los permisos.');
    $output=['url'=>'/uploads/'.$name];
    if ($result['card']!==null) {
        if (file_put_contents($path.$id.'-card.webp',$result['card'],LOCK_EX)===false) {unlink($path.$name);fail(503,'No se pudo guardar la miniatura.');}
        $output['thumbnailUrl']='/uploads/'.$id.'-card.webp';
    }
    foreach (['width','height','originalBytes','optimizedBytes'] as $key) $output[$key]=$result[$key];return $output;
}

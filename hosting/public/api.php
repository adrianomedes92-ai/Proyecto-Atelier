<?php
require dirname(__DIR__).'/atelier-private/bootstrap.php';
use function Atelier\{headers_secure, config, fail, json_response, same_origin, body, json_input, installed, authenticated, login, start_session, read_content, save_content, validate_content, upload_media, storage, image_engine};
use Atelier\HttpError;
headers_secure();
try {
    $path=rawurldecode(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH) ?? '');$method=$_SERVER['REQUEST_METHOD'];
    config();
    if (str_starts_with($path,'/uploads/')) {
        if (!in_array($method,['GET','HEAD'],true)) fail(405,'Método no permitido.');
        if (!preg_match('~^/uploads/[a-f0-9-]+(?:-(?:optimized|card))?\.(jpg|png|webp)$~D',$path,$match)) fail(404,'No encontrado.');
        $file=storage().$path;if (!is_file($file)) fail(404,'No encontrado.');
        header('Content-Type: '.(['jpg'=>'image/jpeg','png'=>'image/png','webp'=>'image/webp'][$match[1]]));header('Cache-Control: public, max-age=31536000, immutable');header('Content-Length: '.filesize($file));if ($method!=='HEAD') readfile($file);exit;
    }
    if (!in_array($method,['GET','POST','PUT'],true)) fail(405,'Método no permitido.');
    if ($method!=='GET') same_origin();
    if ($path==='/api/admin/session' && $method==='GET') json_response(200,['authenticated'=>installed()&&authenticated(),'configured'=>installed(),'developmentLogin'=>false,'setupUrl'=>'/setup.php']);
    if (!installed()) fail(503,'Completá la instalación de Hostinger en /setup.php.');
    if ($path==='/api/content' && $method==='GET') json_response(200,read_content(true));
    if ($path==='/api/health' && $method==='GET') json_response(200,['database'=>true,'imageEngine'=>image_engine()]);
    if ($path==='/api/admin/login' && $method==='POST') {
        $input=json_input();$password=$input['password'] ?? '';
        if (!is_string($password) || strlen($password)>72) fail(400,'Contraseña inválida.');login($password);json_response(200,['ok'=>true]);
    }
    if (!authenticated()) fail(401,'Ingresá al panel para continuar.');
    if ($path==='/api/admin/logout' && $method==='POST') {
        start_session();$_SESSION=[];session_destroy();$options=session_get_cookie_params();unset($options['lifetime']);setcookie(session_name(),'',array_merge($options,['expires'=>time()-3600]));json_response(200,['ok'=>true]);
    }
    if ($path==='/api/admin/content' && $method==='GET') json_response(200,read_content());
    if ($path==='/api/admin/content' && $method==='PUT') {
        $input=json_input();if (!isset($input['revision']) || !is_int($input['revision']) || $input['revision']<0) fail(400,'Revisión inválida.');
        $revision=save_content(validate_content($input['content'] ?? null),$input['revision']);json_response(200,['revision'=>$revision,'ok'=>true]);
    }
    if ($path==='/api/admin/upload' && $method==='POST') json_response(201,upload_media(body(20*1024*1024),$_SERVER['HTTP_X_IMAGE_KIND'] ?? 'product'));
    fail(404,'No encontrado.');
} catch (HttpError $e) {json_response($e->status,['error'=>$e->getMessage()]);}
catch (\Throwable $e) {error_log('Atelier: error de servidor '.get_class($e).' ('.$e->getCode().')');json_response(503,['error'=>'No se pudo completar la operación. Revisá la conexión MySQL, la instalación y los permisos del almacenamiento.']);}

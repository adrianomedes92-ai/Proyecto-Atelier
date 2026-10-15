<?php
require dirname(__DIR__).'/atelier-private/bootstrap.php';
use function Atelier\{headers_secure,config,storage,db,fail,same_origin,validate_content,write_rows};
use Atelier\HttpError;
headers_secure();header('Cache-Control: no-store');$error='';$success=false;$ready=false;$done=false;
try {
    $cfg=config();$ready=true;
    $done=is_file(storage().'/installed.lock');
    if ($_SERVER['REQUEST_METHOD']==='POST') {
        same_origin();if ($done) fail(409,'La instalación ya está completada.');
        $token=$cfg['setup_token'] ?? '';
        if (strlen($token)<32 || str_starts_with($token,'REEMPLAZAR_') || !is_string($_POST['token'] ?? null) || !hash_equals($token,$_POST['token'])) fail(403,'La clave de instalación no es correcta. Revisá setup_token en la configuración privada.');
        $password=$_POST['password'] ?? '';if (!is_string($password) || strlen($password)<12 || strlen($password)>72 || $password!==($_POST['confirm'] ?? null)) fail(400,'Elegí una contraseña de entre 12 y 72 caracteres y repetila correctamente.');
        Atelier\image_engine();
        $raw=json_decode(file_get_contents(dirname(__DIR__).'/atelier-private/initial-content.json'),true,512,JSON_THROW_ON_ERROR);$content=validate_content($raw['content'] ?? $raw);
        foreach (Atelier\content_image_paths($content) as $value) if (str_starts_with($value,'/uploads/') && !is_file(storage().$value)) fail(400,'Faltan imágenes de la migración. Volvé a generar el paquete desde la carpeta que contiene tu .storage.');
        $pdo=db();$sql=file_get_contents(dirname(__DIR__).'/atelier-private/schema.sql');foreach (explode(';',$sql) as $statement) if(trim($statement)!=='')$pdo->exec($statement);
        $pdo->beginTransaction();try {
            $pdo->query('SELECT revision FROM atelier_state WHERE id=1 FOR UPDATE');
            if ((int)$pdo->query('SELECT COUNT(*) FROM atelier_users')->fetchColumn()>0) fail(409,'La base ya tiene un administrador. No se reemplazaron sus datos.');
            if ((int)$pdo->query('SELECT COUNT(*) FROM atelier_settings')->fetchColumn()>0) fail(409,'La base ya tiene contenido. No se sobrescribieron los datos.');
            write_rows($content);$pdo->prepare('INSERT INTO atelier_users (username,password_hash) VALUES (?,?)')->execute(['admin',password_hash($password,PASSWORD_DEFAULT)]);$pdo->commit();
        } catch (\Throwable $e) {if($pdo->inTransaction())$pdo->rollBack();throw $e;}
        file_put_contents(storage().'/installed.lock',date(DATE_ATOM),LOCK_EX);$success=true;$done=true;
    }
} catch (HttpError $e) {http_response_code($e->status);$error=$e->getMessage();}
catch (\Throwable $e) {http_response_code(503);error_log('Atelier: error de instalación '.get_class($e).' ('.$e->getCode().')');$error='No se pudo instalar. Revisá los datos de conexión MySQL, PHP 8.2+, pdo_mysql y GD/Imagick con WebP, y los permisos de atelier-private.';}
function h($text){return htmlspecialchars($text,ENT_QUOTES,'UTF-8');}
?><!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Instalación · Proyecto Atelier</title><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/admin.css"></head><body><main class="admin-main"><section class="editor-card"><span class="eyebrow">PROYECTO ATELIER · HOSTINGER</span><h1>Instalación</h1><?php if ($error): ?><p role="alert"><?=h($error)?></p><?php endif ?><?php if ($done): ?><p><?= $success?'La base, el catálogo y el administrador están preparados.':'La instalación ya está completada.' ?></p><a class="button" href="/admin">Entrar al administrador</a><p class="hint">Usá la contraseña que acabás de crear. Podés eliminar setup.php después de verificar el acceso.</p><?php elseif ($ready): ?><p>Configuración inicial de la base MySQL y del acceso al panel. Los datos existentes no se reemplazan.</p><form method="post" action="/setup.php"><label>Clave temporal de instalación<input type="password" name="token" autocomplete="off" required></label><label>Nueva contraseña del administrador (mínimo 12 caracteres)<input type="password" name="password" minlength="12" maxlength="72" autocomplete="new-password" required></label><label>Repetir contraseña<input type="password" name="confirm" minlength="12" maxlength="72" autocomplete="new-password" required></label><button class="button">Crear tablas y acceso</button></form><?php else: ?><p>Creá <code>atelier-private/config.php</code> a partir de <code>config.example.php</code>, fuera de <code>public_html</code>. Completá los datos de tu base y una clave aleatoria de instalación de al menos 32 caracteres. Después recargá esta página.</p><?php endif ?></section></main></body></html>

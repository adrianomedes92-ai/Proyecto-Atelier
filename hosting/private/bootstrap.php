<?php
namespace Atelier;
class HttpError extends \RuntimeException { public function __construct(public int $status, string $message) { parent::__construct($message); } }
function fail(int $status, string $message): never { throw new HttpError($status,$message); }
function encode($value): string { return json_encode($value, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR); }
function config(): array {
    static $config;
    if ($config !== null) return $config;
    if (!is_file(__DIR__.'/config.php')) fail(503,'Falta configurar atelier-private/config.php. Consultá HOSTINGER.md antes de instalar.');
    $config=require __DIR__.'/config.php';
    if (!is_array($config) || !isset($config['db'],$config['app_url'],$config['storage_dir'])) fail(503,'La configuración del servidor está incompleta.');
    $url=parse_url($config['app_url']);
    if (!$url || empty($url['host']) || !in_array($url['scheme'] ?? '',['http','https'],true) || !empty($url['user']) || !empty($url['pass']) || !empty($url['query']) || !empty($url['fragment']) || !in_array($url['path'] ?? '',['','/'],true)) fail(503,'Configurá app_url con la raíz del dominio, sin subcarpetas.');
    if ($url['scheme'] !== 'https' && !in_array($url['host'],['localhost','127.0.0.1','[::1]'],true)) fail(503,'La instalación publicada requiere HTTPS.');
    $config['app_url']=rtrim($config['app_url'],'/');
    return $config;
}
function storage(): string {
    $path=rtrim(config()['storage_dir'],'/');
    foreach ([$path,$path.'/uploads',$path.'/sessions'] as $dir) if (!is_dir($dir) && !mkdir($dir,0700,true) && !is_dir($dir)) fail(503,'No se pudo preparar el almacenamiento privado. Revisá los permisos.');
    return $path;
}
function db(): \PDO {
    static $pdo; if ($pdo) return $pdo; $d=config()['db'];
    return $pdo=new \PDO('mysql:host='.$d['host'].';port='.(int)($d['port'] ?? 3306).';dbname='.$d['name'].';charset=utf8mb4',$d['user'],$d['password'],[\PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION,\PDO::ATTR_EMULATE_PREPARES=>false,\PDO::ATTR_TIMEOUT=>5]);
}
function json_response(int $status, $data): never {
    http_response_code($status); header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store');echo encode($data);exit;
}
function headers_secure(): void {
    header('X-Content-Type-Options: nosniff'); header('Referrer-Policy: same-origin');
    header("Content-Security-Policy: default-src 'self'; img-src 'self' blob: data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
}
function same_origin(): void {
    if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site' || rtrim($_SERVER['HTTP_ORIGIN'] ?? '', '/') !== config()['app_url']) fail(403,'Solicitud de origen no permitido.');
}
function body(int $max=1048576): string {
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0)>$max) fail(413,'Archivo o contenido demasiado grande.');
    $stream=fopen('php://input','rb');$data=stream_get_contents($stream,$max+1);fclose($stream);
    if ($data===false || strlen($data)>$max) fail(413,'Archivo o contenido demasiado grande.');return $data;
}
function json_input(): array {
    try { $value=json_decode(body(),true,512,JSON_THROW_ON_ERROR); } catch (\JsonException $e) { fail(400,'JSON inválido.'); }
    if (!is_array($value)) fail(400,'JSON inválido.');return $value;
}
function installed(): bool {
    try { return (int)db()->query("SELECT COUNT(*) FROM atelier_users WHERE active=1")->fetchColumn()>0; }
    catch (\PDOException $e) {if (($e->errorInfo[1] ?? 0)===1146) return false; throw $e;}
}
function start_session(): void {
    if (session_status()===PHP_SESSION_ACTIVE) return;
    ini_set('session.use_strict_mode','1');ini_set('session.gc_maxlifetime','28800');
    session_save_path(storage().'/sessions');session_name('atelier_session');
    session_set_cookie_params(['lifetime'=>28800,'path'=>'/','secure'=>str_starts_with(config()['app_url'],'https://'),'httponly'=>true,'samesite'=>'Strict']);session_start();
}
function authenticated(): bool {
    start_session(); if (empty($_SESSION['user_id']) || ($_SESSION['expires'] ?? 0)<time()) return false;
    $q=db()->prepare('SELECT active FROM atelier_users WHERE id=?');$q->execute([$_SESSION['user_id']]);return (int)$q->fetchColumn()===1;
}
function login(string $password): void {
    $pdo=db();$key=hash('sha256',$_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $pdo->beginTransaction();
    try {
        $pdo->prepare('INSERT IGNORE INTO atelier_login_attempts (ip_hash,updated_at) VALUES (?,?)')->execute([$key,time()]);
        $q=$pdo->prepare('SELECT * FROM atelier_login_attempts WHERE ip_hash=? FOR UPDATE');$q->execute([$key]);$attempt=$q->fetch(\PDO::FETCH_ASSOC);
        if ((int)$attempt['blocked_until']>time()) { $pdo->commit();fail(429,'Demasiados intentos. Esperá 15 minutos.'); }
        $q=$pdo->prepare("SELECT id,password_hash FROM atelier_users WHERE username='admin' AND active=1");$q->execute();$user=$q->fetch(\PDO::FETCH_ASSOC);
        if (!$user || !password_verify($password,$user['password_hash'])) {
            $count=((int)$attempt['updated_at']<time()-900)?1:(int)$attempt['failures']+1;
            $pdo->prepare('UPDATE atelier_login_attempts SET failures=?,blocked_until=?,updated_at=? WHERE ip_hash=?')->execute([$count>=5?0:$count,$count>=5?time()+900:0,time(),$key]);$pdo->commit();fail(401,'Contraseña incorrecta.');
        }
        $pdo->prepare('DELETE FROM atelier_login_attempts WHERE ip_hash=? OR updated_at<?')->execute([$key,time()-86400]);$pdo->commit();
        start_session();session_regenerate_id(true);$_SESSION=['user_id'=>(int)$user['id'],'expires'=>time()+28800];
    } catch (\Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack();throw $e; }
}
function read_content(bool $public=false,bool $normalize=true): array {
    $pdo=db();$pdo->beginTransaction();
    try {
        $revision=$pdo->query('SELECT revision FROM atelier_state WHERE id=1 LOCK IN SHARE MODE')->fetchColumn();
        $settings=[];foreach ($pdo->query('SELECT setting_key,payload FROM atelier_settings') as $row) $settings[$row['setting_key']]=json_decode($row['payload'],true,512,JSON_THROW_ON_ERROR);
        if (!isset($settings['site'],$settings['contact'])) fail(503,'La base todavía no tiene contenido. Completá la instalación.');
        $content=['site'=>$settings['site'],'contact'=>$settings['contact'],'products'=>[],'materials'=>[]];if(array_key_exists('colors',$settings))$content['colors']=$settings['colors'];if(isset($settings['catalogVersion']))$content['catalogVersion']=$settings['catalogVersion'];
        foreach (['products','materials'] as $type) foreach ($pdo->query("SELECT payload FROM atelier_$type ORDER BY sort_order") as $row) { $item=json_decode($row['payload'],true,512,JSON_THROW_ON_ERROR);if ($type!=='products' || !$public || $item['visible']) $content[$type][]=$item; }
        $pdo->commit();return ['revision'=>(int)$revision,'content'=>$normalize?validate_content($content):$content];
    } catch (\Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack();throw $e; }
}
function write_rows(array $content): void {
    $pdo=db();foreach (['site','contact','colors','catalogVersion'] as $key) $pdo->prepare('REPLACE INTO atelier_settings (setting_key,payload) VALUES (?,?)')->execute([$key,encode($content[$key])]);
    foreach (['products'=>'id','materials'=>'name'] as $type=>$id) {
        $pdo->exec("DELETE FROM atelier_$type");$q=$pdo->prepare("INSERT INTO atelier_$type ($id,sort_order,payload) VALUES (?,?,?)");
        foreach ($content[$type] as $i=>$item) $q->execute([$item[$id],$i,encode($item)]);
    }
}
function save_content(array $content,int $expected): int {
    $pdo=db();$pdo->beginTransaction();
    try { $actual=(int)$pdo->query('SELECT revision FROM atelier_state WHERE id=1 FOR UPDATE')->fetchColumn();if ($actual!==$expected) fail(409,'El contenido cambió en otra sesión. Conservá tu borrador y recargá antes de guardar.');write_rows($content);$pdo->exec('UPDATE atelier_state SET revision=revision+1 WHERE id=1');$pdo->commit();return $actual+1; }
    catch (\Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack();throw $e; }
}
require __DIR__.'/validation.php';
require __DIR__.'/media.php';

// Antes de normalizar las fichas antiguas, guardar su versión completa fuera de public_html.
function archive_retired_content(array $saved): void {
    $legacy=!array_key_exists('colors',$saved['content']);
    foreach($saved['content']['products'] as $p)if(array_key_exists('upholstery',$p))$legacy=true;
    foreach($saved['content']['materials'] as $m)if(array_key_exists('texture',$m))$legacy=true;
    if(!$legacy)return;
    $dir=storage().'/backups';if(!is_dir($dir)&&!mkdir($dir,0700,true)&&!is_dir($dir))fail(503,'No se pudo crear el respaldo de datos anteriores.');
    $json=encode($saved);$file=$dir.'/content-before-global-colors-'.$saved['revision'].'-'.substr(hash('sha256',$json),0,12).'.json';
    if(!is_file($file) && file_put_contents($file,$json,LOCK_EX)===false)fail(503,'No se pudo respaldar la configuración anterior.');
    if(file_get_contents($file)!==$json)fail(503,'No se pudo verificar el respaldo de configuración.');chmod($file,0600);
}

<?php
// Solo terminal, fuera de public_html. Nunca se ejecuta durante una visita a la web.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__.'/bootstrap.php';
try {
    $pdo=Atelier\db();
    try { $rows=$pdo->query('SELECT url,payload FROM atelier_media ORDER BY url')->fetchAll(\PDO::FETCH_ASSOC); }
    catch (\PDOException $e) { if(($e->errorInfo[1]??0)===1146){echo "La tabla del recortador ya no existe. No se modificó ningún dato.\n";exit(0);}throw $e; }
    // Conservar todas las filas y las fichas antes de retirar únicamente la tabla obsoleta.
    $backup=Atelier\encode(['table'=>'atelier_media','rows'=>$rows,'saved'=>Atelier\read_content()]);
    $directory=Atelier\storage().'/backups';
    if(!is_dir($directory)&&!mkdir($directory,0700,true)&&!is_dir($directory))throw new \RuntimeException('No se pudo crear la carpeta privada de respaldos.');
    $file=$directory.'/retired-image-editor-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(4)).'.json';
    if(file_put_contents($file,$backup,LOCK_EX)===false || file_get_contents($file)!==$backup)throw new \RuntimeException('El respaldo no pudo verificarse; se conserva la tabla.');
    chmod($file,0600);
    $pdo->exec('DROP TABLE atelier_media');
    echo "Se respaldaron los metadatos y las fichas en storage/backups y se retiró solo atelier_media. Las fotos, originales, usuarios y demás tablas se conservan.\n";
} catch (\Throwable $e) {fwrite(STDERR,"No se completó la limpieza: ".$e->getMessage()."\n");exit(1);}

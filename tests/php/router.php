<?php
$path=rawurldecode(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH) ?? '');
if ($path==='/.user.ini' || str_starts_with($path,'/.') || str_starts_with($path,'/atelier-private')) {http_response_code(403);exit;}
if (str_starts_with($path,'/api/') || str_starts_with($path,'/uploads/')) {require $_SERVER['DOCUMENT_ROOT'].'/api.php';return true;}
if ($path==='/admin' || $path==='/admin/') {header('Content-Type: text/html');readfile($_SERVER['DOCUMENT_ROOT'].'/admin.html');return true;}
return false;

<?php
// Copiar como config.php DENTRO de atelier-private, fuera de public_html.
return [
    'db' => ['host' => 'localhost', 'port' => 3306, 'name' => 'NOMBRE_BASE', 'user' => 'USUARIO_BASE', 'password' => 'CONTRASENA_BASE'],
    'app_url' => 'https://tu-dominio.com', // Sin barra final; publicar en la raíz del dominio/subdominio.
    'setup_token' => 'REEMPLAZAR_POR_CLAVE_ALEATORIA_DE_AL_MENOS_32_CARACTERES',
    'storage_dir' => __DIR__ . '/storage',
    'image_engine' => 'auto', // auto: Imagick si está disponible; si no, GD. También: imagick o gd.
];

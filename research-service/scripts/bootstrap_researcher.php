<?php
declare(strict_types=1);
// Run only from the server shell: php bootstrap_researcher.php /private/config.php researcher@example.org
if (PHP_SAPI !== 'cli' || $argc !== 3) { fwrite(STDERR, "Usage: php bootstrap_researcher.php /private/config.php email\n"); exit(2); }
$config = require $argv[1];
$email = strtolower($argv[2]);
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { fwrite(STDERR, "Invalid email.\n"); exit(2); }
$password = rtrim(strtr(base64_encode(random_bytes(18)), '+/', '-_'), '=');
$id = bin2hex(random_bytes(16));
$pdo = new PDO($config['dsn'], $config['db_user'], $config['db_password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]);
$pdo->prepare("INSERT INTO accounts(id,email,password_hash,role,status) VALUES(UNHEX(?),?,?, 'researcher','active')")->execute([$id, $email, password_hash($password, PASSWORD_DEFAULT)]);
$pseudo = 'R-'.strtoupper(substr(bin2hex(random_bytes(8)),0,12));
$pdo->prepare('INSERT INTO study_identities(account_id,study_pseudonym) VALUES(UNHEX(?),?)')->execute([$id,$pseudo]);
fwrite(STDOUT, "Researcher created. Deliver this one-time password through an approved channel, then require a recovery reset: ".$password.PHP_EOL);

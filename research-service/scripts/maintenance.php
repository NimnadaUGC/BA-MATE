<?php
declare(strict_types=1);

// Run daily from the server shell or the hosting cron facility:
// php maintenance.php /private/config.php
if (PHP_SAPI !== 'cli' || $argc !== 2) { fwrite(STDERR, "Usage: php maintenance.php /private/config.php\n"); exit(2); }
$config = require $argv[1];
$db = new PDO($config['dsn'], $config['db_user'], $config['db_password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]);
$statements = [
  'expired invitations' => 'DELETE FROM invitations WHERE expires_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)',
  'expired recovery tokens' => 'DELETE FROM recovery_tokens WHERE expires_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)',
  'expired sessions' => 'DELETE FROM sessions WHERE expires_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)',
  'abuse throttles' => 'DELETE FROM auth_rate_limits WHERE last_attempt_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)',
];
foreach ($statements as $name => $sql) { $count = $db->exec($sql); fwrite(STDOUT, $name . ': ' . $count . PHP_EOL); }

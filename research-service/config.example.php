<?php
// Copy outside the public document root as private/config.php. Never ship this in the desktop app.
return [
  'dsn' => 'mysql:host=localhost;dbname=CHANGE_ME;charset=utf8mb4',
  'db_user' => 'CHANGE_ME',
  'db_password' => 'CHANGE_ME',
  'base_url' => 'https://bamate.csbodima.lk',
  // Exact origins for the desktop web renderer and public participant pages; never use a wildcard.
  'allowed_origins' => ['https://bamate.csbodima.lk', 'http://127.0.0.1:8000', 'http://localhost:8000'],
  'session_hours' => 12,
  'offline_grace_hours' => 168,
  // Must match the approved independent scoring instrument used by the researcher administration view.
  'quality_instrument_version' => 'ba-mate-stage-instrument-2026-09-21-v1',
  'mail_from' => 'research@example.invalid',
  // Replace this closure with the host-approved mail provider before deployment.
  'send_recovery' => static function (string $email, string $url): void { error_log('Recovery delivery required for ' . $email); },
];

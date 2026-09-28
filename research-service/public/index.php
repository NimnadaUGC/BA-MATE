<?php
declare(strict_types=1);
// HTTPS-only shared-host API. It accepts permitted research records, never desktop project content.
$configPath = getenv('BA_MATE_RESEARCH_CONFIG') ?: dirname(__DIR__) . '/private/config.php';
if (!is_file($configPath)) { http_response_code(503); exit('Research service is not configured.'); }
$config = require $configPath;
$db = new PDO($config['dsn'], $config['db_user'], $config['db_password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]);
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
  if (!in_array($origin, $config['allowed_origins'] ?? [], true)) { http_response_code(403); exit('Origin not allowed.'); }
  header('Access-Control-Allow-Origin: ' . $origin);
  header('Vary: Origin');
  header('Access-Control-Allow-Headers: Authorization, Content-Type');
  header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; base-uri 'none'; frame-ancestors 'none'");
header('X-Frame-Options: DENY');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');

function reply(array $value, int $status = 200): never { http_response_code($status); echo json_encode($value, JSON_UNESCAPED_SLASHES); exit; }
function fail(string $message, int $status = 400): never { reply(['error' => $message], $status); }
function body(): array { if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 262144) fail('Request is too large.', 413); $value = json_decode(file_get_contents('php://input'), true); if (!is_array($value)) fail('A JSON object is required.'); return $value; }
function only(array $value, array $keys): void { foreach ($value as $key => $_) if (!in_array($key, $keys, true)) fail('Unsupported field: ' . $key, 422); }
function uuidBytes(): string { return random_bytes(16); }
function uuidText(): string { return bin2hex(random_bytes(16)); }
function token(): string { return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '='); }
function tokenHash(string $token): string { return hash('sha256', $token); }
function databaseTimestamp(mixed $value): string {
  if (!is_string($value)) fail('A valid event time is required.', 422);
  try { return (new DateTimeImmutable($value))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'); }
  catch (Throwable) { fail('A valid event time is required.', 422); }
}
function throttleKey(string $route, string $principal): string { return hash('sha256', $route . '|' . strtolower(substr($principal, 0, 254)) . '|' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown')); }
function enforceAuthThrottle(PDO $db, string $route, string $principal): void {
  // Store only a short-lived, one-way account/network fingerprint for abuse protection; it is not research data.
  $key = throttleKey($route, $principal);
  $db->prepare('DELETE FROM auth_rate_limits WHERE last_attempt_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)')->execute();
  $q = $db->prepare('SELECT attempts,last_attempt_at FROM auth_rate_limits WHERE throttle_key=?');
  $q->execute([$key]); $row = $q->fetch(PDO::FETCH_ASSOC);
  if ($row && strtotime($row['last_attempt_at']) > time() - 600 && (int)$row['attempts'] >= 8) fail('Too many account requests. Try again later.', 429);
}
function recordAuthAttempt(PDO $db, string $route, string $principal): void {
  $db->prepare('INSERT INTO auth_rate_limits(throttle_key,attempts,last_attempt_at) VALUES(?,1,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE attempts=IF(last_attempt_at>DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 MINUTE),attempts+1,1),last_attempt_at=UTC_TIMESTAMP()')->execute([throttleKey($route, $principal)]);
}
function clearAuthThrottle(PDO $db, string $route, string $principal): void { $db->prepare('DELETE FROM auth_rate_limits WHERE throttle_key=?')->execute([throttleKey($route, $principal)]); }
function failedAccountRequest(PDO $db, string $route, string $principal, string $message, int $status): never { recordAuthAttempt($db, $route, $principal); fail($message, $status); }
function bearer(): string { $value = $_SERVER['HTTP_AUTHORIZATION'] ?? ''; if (!preg_match('/^Bearer ([A-Za-z0-9_-]{20,})$/', $value, $match)) fail('Authentication is required.', 401); return $match[1]; }
function audit(PDO $db, string $actor, string $action, string $subject): void { $db->prepare('INSERT INTO administrative_actions(id,actor_id,action,subject) VALUES(UNHEX(?),UNHEX(?),?,?)')->execute([uuidText(), $actor, $action, $subject]); }
function auth(PDO $db): array {
  $hash = tokenHash(bearer());
  $query = $db->prepare("SELECT HEX(a.id) account_id,a.role,a.status,si.study_pseudonym,s.expires_at,s.offline_until FROM sessions s JOIN accounts a ON a.id=s.account_id LEFT JOIN study_identities si ON si.account_id=a.id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>UTC_TIMESTAMP()");
  $query->execute([$hash]); $account = $query->fetch(PDO::FETCH_ASSOC);
  if (!$account || $account['status'] !== 'active') fail('The account session is invalid or revoked.', 401);
  return $account;
}
function researcher(PDO $db): array { $account = auth($db); if ($account['role'] !== 'researcher') fail('Researcher authority is required.', 403); return $account; }
function currentConsent(PDO $db, string $accountId): ?array { $q=$db->prepare("SELECT consent_version FROM consent_receipts WHERE account_id=UNHEX(?) AND state='active' ORDER BY recorded_at DESC LIMIT 1"); $q->execute([$accountId]); return $q->fetch(PDO::FETCH_ASSOC) ?: null; }
function prohibited(array $value): void {
  $blocked = '/project|source|document|prompt|response|filename|filepath|content|hash|credential|secret|api.?key|company|evaluator/i';
  $permittedVersionFields = ['app','framework','protocol','instrument','task_case','prompt_schema','model_profile'];
  foreach ($value as $key => $item) { if (preg_match($blocked, (string)$key) && !in_array($key, $permittedVersionFields, true)) fail('Private-content field rejected: ' . $key, 422); if (is_array($item)) prohibited($item); }
}
function checkEvent(array $event): void {
  only($event, ['event_id','occurred_at','run_code','condition','versions','measurement','stage','category','duration_ms','outcome','ratings','feedback']);
  prohibited($event);
  if (!isset($event['event_id'], $event['occurred_at'], $event['run_code'], $event['condition'], $event['measurement']) || !is_string($event['event_id']) || strlen($event['event_id']) > 100 || !is_string($event['run_code']) || strlen($event['run_code']) > 100 || !in_array($event['condition'], ['Manual','Generic AI','Proposed workflow'], true) || !in_array($event['measurement'], ['telemetry','rating'], true)) fail('Invalid measurement event.', 422);
  if (!isset($event['versions']) || !is_array($event['versions'])) fail('A frozen version manifest is required.', 422);
  only($event['versions'], ['app','framework','protocol','instrument','task_case','prompt_schema','model_profile']);
  foreach (['app','framework','protocol','instrument','task_case','prompt_schema','model_profile'] as $version) if (!is_string($event['versions'][$version] ?? null) || $event['versions'][$version] === '' || strlen($event['versions'][$version]) > 120) fail('Invalid frozen version manifest.', 422);
  databaseTimestamp($event['occurred_at']);
  if (isset($event['duration_ms']) && (!is_int($event['duration_ms']) || $event['duration_ms'] < 0 || $event['duration_ms'] > 86400000)) fail('Invalid duration.', 422);
  if (isset($event['ratings'])) { only($event['ratings'], ['task_completed','accuracy','usefulness','usability','confidence']); foreach (['accuracy','usefulness','usability','confidence'] as $rating) if (isset($event['ratings'][$rating]) && (!is_int($event['ratings'][$rating]) || $event['ratings'][$rating] < 1 || $event['ratings'][$rating] > 5)) fail('Invalid rating.', 422); }
  // Free text is intentionally not accepted by the routine measurement endpoint. It needs a separate,
  // participant-visible review workflow because it can accidentally contain confidential project material.
  if (isset($event['feedback'])) fail('Free-text feedback must use the separate reviewed feedback process.', 422);
}
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'GET' && $path === '/api/v1/health') reply(['status' => 'ok', 'schema' => 'ba-mate-research-batch-v1']);

if ($method === 'POST' && $path === '/api/v1/auth/register') {
  $data=body(); only($data,['invite_token','email','password']); $email=strtolower((string)($data['email']??'')); enforceAuthThrottle($db, 'register', $email); if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($data['password'] ?? '') < 12) failedAccountRequest($db, 'register', $email, 'Use the invited email and a password of at least 12 characters.',422);
  $invite=$db->prepare('SELECT HEX(id) id,role FROM invitations WHERE token_hash=? AND used_at IS NULL AND expires_at>UTC_TIMESTAMP() AND email=?'); $invite->execute([tokenHash((string)($data['invite_token']??'')), $email]); $row=$invite->fetch(PDO::FETCH_ASSOC); if (!$row) failedAccountRequest($db, 'register', $email, 'The invitation is invalid, expired or already used.',403);
  $id=uuidText(); $db->beginTransaction(); try { $db->prepare('INSERT INTO accounts(id,email,password_hash,role) VALUES(UNHEX(?),?,?,?)')->execute([$id,$email,password_hash($data['password'],PASSWORD_DEFAULT),$row['role']]); $pseudo='P-'.strtoupper(substr(bin2hex(random_bytes(8)),0,12)); $db->prepare('INSERT INTO study_identities(account_id,study_pseudonym) VALUES(UNHEX(?),?)')->execute([$id,$pseudo]); $db->prepare('UPDATE invitations SET used_at=UTC_TIMESTAMP() WHERE id=UNHEX(?)')->execute([$row['id']]); $db->commit(); } catch(Throwable $e) { $db->rollBack(); failedAccountRequest($db, 'register', $email, 'Registration could not be completed.',409); } clearAuthThrottle($db, 'register', $email); reply(['registered'=>true],201);
}
if ($method === 'POST' && $path === '/api/v1/auth/login') {
  $data=body(); only($data,['email','password']); $email=strtolower((string)($data['email']??'')); enforceAuthThrottle($db, 'login', $email); $q=$db->prepare('SELECT HEX(id) id,password_hash,role,status FROM accounts WHERE email=?'); $q->execute([$email]); $account=$q->fetch(PDO::FETCH_ASSOC); if (!$account || !password_verify((string)($data['password']??''),$account['password_hash']) || $account['status'] !== 'active') failedAccountRequest($db, 'login', $email, 'Sign-in failed.',401);
  $raw=token(); $db->prepare('INSERT INTO sessions(id,account_id,token_hash,expires_at,offline_until) VALUES(UNHEX(?),UNHEX(?),?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? HOUR),DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? HOUR))')->execute([uuidText(),$account['id'],tokenHash($raw),(int)$config['session_hours'],(int)$config['offline_grace_hours']]); $q=$db->prepare('SELECT study_pseudonym FROM study_identities WHERE account_id=UNHEX(?)'); $q->execute([$account['id']]); reply(['access_token'=>$raw,'study_pseudonym'=>$q->fetchColumn(),'session_expires_in_hours'=>(int)$config['session_hours'],'offline_grace_hours'=>(int)$config['offline_grace_hours'],'role'=>$account['role']]);
}
if ($method === 'POST' && $path === '/api/v1/auth/logout') { $raw=bearer(); $db->prepare('UPDATE sessions SET revoked_at=UTC_TIMESTAMP() WHERE token_hash=?')->execute([tokenHash($raw)]); reply(['signed_out'=>true]); }
if ($method === 'POST' && $path === '/api/v1/auth/recovery') {
  $data=body(); only($data,['email']); $email=strtolower((string)($data['email']??'')); enforceAuthThrottle($db, 'recovery', $email); $q=$db->prepare('SELECT HEX(id) id,email FROM accounts WHERE email=? AND status=?'); $q->execute([$email,'active']); $account=$q->fetch(PDO::FETCH_ASSOC);
  // Always return the same response to avoid account enumeration.
  if ($account) { $raw=token(); $db->prepare('INSERT INTO recovery_tokens(id,account_id,token_hash,expires_at) VALUES(UNHEX(?),UNHEX(?),?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR))')->execute([uuidText(),$account['id'],tokenHash($raw)]); ($config['send_recovery'])($account['email'],rtrim($config['base_url'],'/').'/research?recovery_token='.$raw); } recordAuthAttempt($db, 'recovery', $email);
  reply(['requested'=>true]);
}
if ($method === 'POST' && $path === '/api/v1/auth/reset') {
  $data=body(); only($data,['recovery_token','password']); if(strlen((string)($data['password']??''))<12) fail('Use a password of at least 12 characters.',422);
  $q=$db->prepare('SELECT HEX(id) id,HEX(account_id) account_id FROM recovery_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>UTC_TIMESTAMP()'); $q->execute([tokenHash((string)($data['recovery_token']??''))]); $row=$q->fetch(PDO::FETCH_ASSOC); if(!$row) fail('The recovery link is invalid, expired or already used.',403);
  $db->beginTransaction(); try { $db->prepare('UPDATE accounts SET password_hash=? WHERE id=UNHEX(?)')->execute([password_hash($data['password'],PASSWORD_DEFAULT),$row['account_id']]); $db->prepare('UPDATE recovery_tokens SET used_at=UTC_TIMESTAMP() WHERE id=UNHEX(?)')->execute([$row['id']]); $db->prepare('UPDATE sessions SET revoked_at=UTC_TIMESTAMP() WHERE account_id=UNHEX(?) AND revoked_at IS NULL')->execute([$row['account_id']]); $db->commit(); } catch(Throwable $e) { $db->rollBack(); fail('Recovery could not be completed.',409); } reply(['reset'=>true]);
}
if ($method === 'GET' && $path === '/api/v1/me') { $a=auth($db); reply(['study_pseudonym'=>$a['study_pseudonym'],'role'=>$a['role'],'offline_until'=>$a['offline_until'],'consent'=>currentConsent($db,$a['account_id'])]); }
if ($method === 'POST' && $path === '/api/v1/consent') { $a=auth($db); $data=body(); only($data,['consent_version','accepted']); if (($data['accepted']??false)!==true || !preg_match('/^[A-Za-z0-9._-]{1,80}$/',(string)($data['consent_version']??''))) fail('Explicit versioned consent is required.',422); $db->prepare("INSERT INTO consent_receipts(id,account_id,consent_version,state) VALUES(UNHEX(?),UNHEX(?),?,'active')")->execute([uuidText(),$a['account_id'],$data['consent_version']]); reply(['consent'=>'active','consent_version'=>$data['consent_version']],201); }
if ($method === 'POST' && $path === '/api/v1/withdraw') { $a=auth($db); $db->beginTransaction(); try { $db->prepare("UPDATE consent_receipts SET state='withdrawn',withdrawn_at=UTC_TIMESTAMP() WHERE account_id=UNHEX(?) AND state='active'")->execute([$a['account_id']]); $db->prepare("UPDATE feedback_submissions SET review_state='withdrawal_requested' WHERE account_id=UNHEX(?) AND review_state='unreviewed'")->execute([$a['account_id']]); $db->commit(); } catch(Throwable $e) { $db->rollBack(); fail('Withdrawal could not be completed.',409); } reply(['withdrawn'=>true,'unsent_records'=>'must be discarded by the desktop client','feedback_review'=>'Any unreviewed submitted feedback is marked for withdrawal review.']); }
if ($method === 'POST' && $path === '/api/v1/batches') {
  $a=auth($db); $data=body(); only($data,['schema','batch_id','consent_version','study_pseudonym','created_at','events']); prohibited($data); $consent=currentConsent($db,$a['account_id']); if (!$consent || $consent['consent_version'] !== ($data['consent_version']??null) || ($data['study_pseudonym']??null) !== $a['study_pseudonym']) fail('Active matching consent is required.',403); if (($data['schema']??'') !== 'ba-mate-research-batch-v1' || !is_array($data['events']) || count($data['events'])<1 || count($data['events'])>100) fail('Invalid upload batch.',422); foreach($data['events'] as $event) checkEvent($event);
  $existing=$db->prepare('SELECT 1 FROM upload_batches WHERE batch_id=?'); $existing->execute([$data['batch_id']]); if($existing->fetchColumn()) reply(['accepted'=>true,'duplicate'=>true]);
  $db->beginTransaction(); try { $db->prepare('INSERT INTO upload_batches(batch_id,account_id,study_pseudonym,consent_version) VALUES(?,UNHEX(?),?,?)')->execute([$data['batch_id'],$a['account_id'],$a['study_pseudonym'],$data['consent_version']]); $insert=$db->prepare('INSERT INTO research_events(event_id,batch_id,study_pseudonym,occurred_at,run_code,run_condition,payload) VALUES(?,?,?,?,?,?,?)'); foreach($data['events'] as $event) $insert->execute([$event['event_id'],$data['batch_id'],$a['study_pseudonym'],databaseTimestamp($event['occurred_at']),$event['run_code']??null,$event['condition']??null,json_encode($event,JSON_UNESCAPED_SLASHES)]); $db->commit(); } catch(Throwable $e) { $db->rollBack(); fail('The batch could not be accepted.',409); } reply(['accepted'=>true,'duplicate'=>false],201);
}
if ($method === 'POST' && $path === '/api/v1/feedback') {
  $a=auth($db); $data=body(); only($data,['schema','feedback_id','consent_version','study_pseudonym','created_at','feedback_text','confirmed']);
  $consent=currentConsent($db,$a['account_id']);
  if (!$consent || $consent['consent_version'] !== ($data['consent_version']??null) || ($data['study_pseudonym']??null) !== $a['study_pseudonym']) fail('Active matching consent is required.',403);
  if (($data['schema']??'') !== 'ba-mate-research-feedback-v1' || ($data['confirmed']??false)!==true || !is_string($data['feedback_text']??null) || mb_strlen(trim($data['feedback_text'])) < 1 || mb_strlen($data['feedback_text']) > 1200) fail('Previewed feedback of up to 1200 characters is required.',422);
  databaseTimestamp($data['created_at'] ?? null);
  try { $db->prepare('INSERT INTO feedback_submissions(feedback_id,account_id,study_pseudonym,consent_version,feedback_text) VALUES(?,UNHEX(?),?,?,?)')->execute([(string)($data['feedback_id']??''),$a['account_id'],$a['study_pseudonym'],$data['consent_version'],$data['feedback_text']]); }
  catch(Throwable $e) { fail('The feedback could not be accepted.',409); }
  reply(['accepted'=>true,'review_state'=>'unreviewed'],201);
}
if ($method === 'POST' && $path === '/api/v1/admin/invitations') { $a=researcher($db); $data=body(); only($data,['email','role','expires_hours']); if(!filter_var($data['email']??'',FILTER_VALIDATE_EMAIL) || !in_array($data['role']??'participant',['participant','researcher'],true)) fail('Invalid invitation.',422); $raw=token(); $db->prepare('INSERT INTO invitations(id,email,token_hash,role,expires_at,created_by) VALUES(UNHEX(?),?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? HOUR),UNHEX(?))')->execute([uuidText(),strtolower($data['email']),tokenHash($raw),$data['role'],min(168,max(1,(int)($data['expires_hours']??72))),$a['account_id']]); audit($db,$a['account_id'],'created_invitation',(string)$data['email']); reply(['invite_token'=>$raw],201); }
if ($method === 'POST' && preg_match('#^/api/v1/admin/accounts/([A-Fa-f0-9]{32})/revoke$#',$path,$match)) { $a=researcher($db); $db->beginTransaction(); try { $db->prepare("UPDATE accounts SET status='revoked',revoked_at=UTC_TIMESTAMP() WHERE id=UNHEX(?)")->execute([$match[1]]); $db->prepare('UPDATE sessions SET revoked_at=UTC_TIMESTAMP() WHERE account_id=UNHEX(?) AND revoked_at IS NULL')->execute([$match[1]]); $db->commit(); } catch(Throwable $e) { $db->rollBack(); fail('Revocation could not be completed.',409); } audit($db,$a['account_id'],'revoked_account',$match[1]); reply(['revoked'=>true]); }
if ($method === 'GET' && $path === '/api/v1/admin/participants') { researcher($db); $rows=$db->query("SELECT HEX(a.id) account_code,a.status,si.study_pseudonym,(SELECT c.consent_version FROM consent_receipts c WHERE c.account_id=a.id ORDER BY c.recorded_at DESC,c.id DESC LIMIT 1) consent_version,(SELECT c.state FROM consent_receipts c WHERE c.account_id=a.id ORDER BY c.recorded_at DESC,c.id DESC LIMIT 1) consent_state,(SELECT c.recorded_at FROM consent_receipts c WHERE c.account_id=a.id ORDER BY c.recorded_at DESC,c.id DESC LIMIT 1) consent_recorded_at FROM accounts a LEFT JOIN study_identities si ON si.account_id=a.id WHERE a.role='participant' ORDER BY a.created_at DESC")->fetchAll(PDO::FETCH_ASSOC); reply(['participants'=>$rows]); }
if ($method === 'GET' && $path === '/api/v1/admin/batches') { researcher($db); $rows=$db->query('SELECT study_pseudonym,consent_version,received_at,COUNT(re.event_id) event_count FROM upload_batches ub LEFT JOIN research_events re ON re.batch_id=ub.batch_id GROUP BY ub.batch_id,study_pseudonym,consent_version,received_at ORDER BY received_at DESC')->fetchAll(PDO::FETCH_ASSOC); reply(['batches'=>$rows]); }
if ($method === 'GET' && $path === '/api/v1/admin/feedback') { researcher($db); $rows=$db->query('SELECT feedback_id,study_pseudonym,feedback_text,review_state,submitted_at,reviewed_at FROM feedback_submissions ORDER BY submitted_at DESC')->fetchAll(PDO::FETCH_ASSOC); reply(['feedback'=>$rows]); }
if ($method === 'POST' && preg_match('#^/api/v1/admin/feedback/([A-Za-z0-9-]{1,36})/review$#',$path,$match)) { $a=researcher($db); $data=body(); only($data,['review_state']); if (!in_array($data['review_state']??'', ['reviewed','withheld'],true)) fail('Invalid feedback review state.',422); $q=$db->prepare('UPDATE feedback_submissions SET review_state=?,reviewed_at=UTC_TIMESTAMP() WHERE feedback_id=? AND review_state IN (\'unreviewed\',\'withdrawal_requested\')'); $q->execute([$data['review_state'],$match[1]]); if(!$q->rowCount()) fail('The feedback item is not available for review.',404); audit($db,$a['account_id'],'reviewed_feedback',$match[1]); reply(['reviewed'=>true]); }
if ($method === 'GET' && $path === '/api/v1/admin/runs') { researcher($db); $rows=$db->query('SELECT study_pseudonym,run_code,MAX(run_condition) run_condition,MAX(occurred_at) latest_event_at FROM research_events WHERE run_code IS NOT NULL GROUP BY study_pseudonym,run_code ORDER BY latest_event_at DESC')->fetchAll(PDO::FETCH_ASSOC); reply(['runs'=>$rows]); }
if ($method === 'POST' && $path === '/api/v1/admin/quality-assessments') { $a=researcher($db); $data=body(); only($data,['assessment_id','study_pseudonym','run_code','instrument_version','quality_score','correction_effort_minutes']); if (!is_string($data['assessment_id']??null) || !is_string($data['study_pseudonym']??null) || !is_string($data['run_code']??null) || !is_string($data['instrument_version']??null) || $data['instrument_version'] !== ($config['quality_instrument_version'] ?? '') || !is_int($data['quality_score']??null) || $data['quality_score']<1 || $data['quality_score']>5 || (isset($data['correction_effort_minutes']) && (!is_int($data['correction_effort_minutes']) || $data['correction_effort_minutes']<0 || $data['correction_effort_minutes']>1440))) fail('Invalid independent quality assessment.',422); $exists=$db->prepare('SELECT 1 FROM research_events WHERE study_pseudonym=? AND run_code=?'); $exists->execute([$data['study_pseudonym'],$data['run_code']]); if(!$exists->fetchColumn()) fail('The selected pseudonymous run is not available.',404); try { $db->prepare('INSERT INTO quality_assessments(assessment_id,researcher_id,study_pseudonym,run_code,instrument_version,quality_score,correction_effort_minutes) VALUES(?,UNHEX(?),?,?,?,?,?)')->execute([$data['assessment_id'],$a['account_id'],$data['study_pseudonym'],$data['run_code'],$data['instrument_version'],$data['quality_score'],$data['correction_effort_minutes']??null]); } catch(Throwable $e) { fail('An assessment already exists for this run and instrument.',409); } audit($db,$a['account_id'],'recorded_quality_assessment',$data['assessment_id']); reply(['recorded'=>true],201); }
if ($method === 'GET' && $path === '/api/v1/admin/quality-assessments') { researcher($db); $rows=$db->query('SELECT assessment_id,study_pseudonym,run_code,instrument_version,quality_score,correction_effort_minutes,recorded_at FROM quality_assessments ORDER BY recorded_at DESC')->fetchAll(PDO::FETCH_ASSOC); reply(['assessments'=>$rows]); }
if ($method === 'GET' && $path === '/api/v1/admin/export') { researcher($db); $rows=$db->query('SELECT study_pseudonym,occurred_at,run_code,run_condition,payload FROM research_events ORDER BY occurred_at')->fetchAll(PDO::FETCH_ASSOC); $assessments=$db->query('SELECT study_pseudonym,run_code,instrument_version,quality_score,correction_effort_minutes,recorded_at FROM quality_assessments ORDER BY recorded_at')->fetchAll(PDO::FETCH_ASSOC); reply(['schema'=>'ba-mate-research-export-v1','events'=>array_map(fn($r)=>['study_pseudonym'=>$r['study_pseudonym'],'occurred_at'=>$r['occurred_at'],'run_code'=>$r['run_code'],'condition'=>$r['run_condition'],'measurement'=>json_decode($r['payload'],true)],$rows),'independent_quality_assessments'=>$assessments]); }
fail('Route not found.',404);

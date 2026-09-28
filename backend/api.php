<?php
/**
 * Workshop Attendance & Payroll Management System
 * Bi-directional REST & Sync API for Offline-First PWA
 */

// Handle Cross-Origin Resource Sharing (CORS) & Security Headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-API-Key");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: SAMEORIGIN");
header("Referrer-Policy: strict-origin-when-cross-origin");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/config.php';

// ------------------------------------------------------------------------
// Hardened Authentication Check
// ------------------------------------------------------------------------
function verifyAuthentication() {
    // Block access if secret key has not been configured securely
    if (empty(API_SECRET_KEY) || API_SECRET_KEY === 'Workshop_Secret_Key_2026_ChangeMe') {
        sendJsonError('Security Warning: API_SECRET_KEY must be configured in config.php before accessing data.', 403);
    }

    $providedKey = null;

    // 1. Check HTTP Authorization header: Bearer <key>
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        if (preg_match('/Bearer\s+(.*)$/i', $_SERVER['HTTP_AUTHORIZATION'], $matches)) {
            $providedKey = trim($matches[1]);
        }
    }

    // 2. Check custom header: X-API-Key
    if (!$providedKey && !empty($_SERVER['HTTP_X_API_KEY'])) {
        $providedKey = trim($_SERVER['HTTP_X_API_KEY']);
    }

    // Disallow query parameter keys to prevent credential leakage in logs
    if (empty($providedKey) || !hash_equals(API_SECRET_KEY, $providedKey)) {
        sendJsonError('Unauthorized: Invalid or missing API security key.', 401);
    }

    return true;
}

// ------------------------------------------------------------------------
// RBAC Middleware Placeholder
// ------------------------------------------------------------------------
function getCurrentUserRole() {
    if (!empty($_SERVER['HTTP_X_USER_ROLE'])) {
        $role = strtolower(trim($_SERVER['HTTP_X_USER_ROLE']));
        if (in_array($role, ['admin', 'operator', 'viewer'])) {
            return $role;
        }
    }
    // Default active user is admin
    return 'admin';
}

function requireRole($requiredRole = 'admin') {
    $currentRole = getCurrentUserRole();
    if ($currentRole !== $requiredRole) {
        sendJsonError("403 Forbidden: This action requires '{$requiredRole}' role permissions.", 403);
    }
    return true;
}

// Route action
$action = isset($_GET['action']) ? trim($_GET['action']) : '';

// ------------------------------------------------------------------------
// Action: ping (Health Check & Connection Test)
// ------------------------------------------------------------------------
if ($action === 'ping') {
    $db = getDbConnection();
    $workerCount = $db->query("SELECT COUNT(*) FROM workers WHERE deleted_at IS NULL")->fetchColumn();
    $logsCount = $db->query("SELECT COUNT(*) FROM attendance_logs WHERE deleted_at IS NULL")->fetchColumn();

    sendJsonResponse([
        'success'      => true,
        'status'       => 'connected',
        'message'      => 'Workshop Server & MySQL Database are running smoothly.',
        'serverTime'   => date('c'),
        'counts'       => [
            'workers' => (int)$workerCount,
            'logs'    => (int)$logsCount
        ]
    ]);
}

// Enforce authentication for data operations
verifyAuthentication();
$db = getDbConnection();

// ------------------------------------------------------------------------
// Action: pull_all (Initial Full Download for New Device)
// ------------------------------------------------------------------------
if ($action === 'pull_all') {
    $workersStmt = $db->query("SELECT id, name, phone, role, daily_rate as dailyRate, overtime_hourly_rate as overtimeHourlyRate, is_active as isActive, created_at as createdAt, updated_at as updatedAt FROM workers WHERE deleted_at IS NULL");
    $workers = $workersStmt->fetchAll();

    // Map numeric types
    foreach ($workers as &$w) {
        $w['dailyRate'] = (float)$w['dailyRate'];
        $w['overtimeHourlyRate'] = (float)$w['overtimeHourlyRate'];
        $w['isActive'] = (int)$w['isActive'];
    }

    $logsStmt = $db->query("SELECT id, worker_id as workerId, date, type, overtime_hours as overtimeHours, calculated_daily_wage as calculatedDailyWage, calculated_overtime_wage as calculatedOvertimeWage, total_day_pay as totalDayPay, notes, created_at as createdAt, updated_at as updatedAt FROM attendance_logs WHERE deleted_at IS NULL");
    $logs = $logsStmt->fetchAll();

    foreach ($logs as &$l) {
        $l['overtimeHours'] = (float)$l['overtimeHours'];
        $l['calculatedDailyWage'] = (float)$l['calculatedDailyWage'];
        $l['calculatedOvertimeWage'] = (float)$l['calculatedOvertimeWage'];
        $l['totalDayPay'] = (float)$l['totalDayPay'];
    }

    $settingsStmt = $db->query("SELECT setting_key as `key`, setting_value as `value` FROM settings");
    $settings = $settingsStmt->fetchAll();

    sendJsonResponse([
        'success'    => true,
        'serverTime' => date('c'),
        'data'       => [
            'workers'  => $workers,
            'logs'     => $logs,
            'settings' => $settings
        ]
    ]);
}

// ------------------------------------------------------------------------
// Action: sync (Bidirectional Incremental Sync)
// ------------------------------------------------------------------------
if ($action === 'sync') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        sendJsonError('Sync requires HTTP POST method.', 405);
    }

    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);

    if (!is_array($payload)) {
        sendJsonError('Invalid JSON payload provided.');
    }

    $lastSyncTime = !empty($payload['lastSyncTime']) ? $payload['lastSyncTime'] : '1970-01-01 00:00:00';
    $changes = !empty($payload['changes']) ? $payload['changes'] : [];

    $db->beginTransaction();
    try {
        // 1. Upsert Client Workers
        if (!empty($changes['workers']) && is_array($changes['workers'])) {
            $stmtWorker = $db->prepare("
                INSERT INTO workers (id, name, phone, role, daily_rate, overtime_hourly_rate, is_active, updated_at, deleted_at)
                VALUES (:id, :name, :phone, :role, :daily_rate, :overtime_rate, :is_active, NOW(), :deleted_at)
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    phone = VALUES(phone),
                    role = VALUES(role),
                    daily_rate = VALUES(daily_rate),
                    overtime_hourly_rate = VALUES(overtime_hourly_rate),
                    is_active = VALUES(is_active),
                    updated_at = NOW(),
                    deleted_at = VALUES(deleted_at)
            ");

            foreach ($changes['workers'] as $w) {
                $stmtWorker->execute([
                    ':id'            => $w['id'],
                    ':name'          => $w['name'] ?? '',
                    ':phone'         => $w['phone'] ?? null,
                    ':role'          => $w['role'] ?? '',
                    ':daily_rate'    => (float)($w['dailyRate'] ?? 0),
                    ':overtime_rate' => (float)($w['overtimeHourlyRate'] ?? 0),
                    ':is_active'     => isset($w['isActive']) ? (int)$w['isActive'] : 1,
                    ':deleted_at'    => !empty($w['isDeleted']) ? date('Y-m-d H:i:s') : null
                ]);
            }
        }

        // 2. Upsert Client Attendance Logs
        if (!empty($changes['logs']) && is_array($changes['logs'])) {
            $stmtLog = $db->prepare("
                INSERT INTO attendance_logs (id, worker_id, date, type, overtime_hours, calculated_daily_wage, calculated_overtime_wage, total_day_pay, notes, updated_at, deleted_at)
                VALUES (:id, :worker_id, :date, :type, :overtime_hours, :base_wage, :ot_wage, :total_pay, :notes, NOW(), :deleted_at)
                ON DUPLICATE KEY UPDATE
                    worker_id = VALUES(worker_id),
                    date = VALUES(date),
                    type = VALUES(type),
                    overtime_hours = VALUES(overtime_hours),
                    calculated_daily_wage = VALUES(calculated_daily_wage),
                    calculated_overtime_wage = VALUES(calculated_overtime_wage),
                    total_day_pay = VALUES(total_day_pay),
                    notes = VALUES(notes),
                    updated_at = NOW(),
                    deleted_at = VALUES(deleted_at)
            ");

            foreach ($changes['logs'] as $l) {
                $stmtLog->execute([
                    ':id'             => $l['id'],
                    ':worker_id'      => $l['workerId'],
                    ':date'           => $l['date'],
                    ':type'           => in_array($l['type'] ?? '', ['full', 'half']) ? $l['type'] : 'full',
                    ':overtime_hours' => (float)($l['overtimeHours'] ?? 0),
                    ':base_wage'      => (float)($l['calculatedDailyWage'] ?? 0),
                    ':ot_wage'        => (float)($l['calculatedOvertimeWage'] ?? 0),
                    ':total_pay'      => (float)($l['totalDayPay'] ?? 0),
                    ':notes'          => $l['notes'] ?? null,
                    ':deleted_at'     => !empty($l['isDeleted']) ? date('Y-m-d H:i:s') : null
                ]);
            }
        }

        // 3. Handle explicit deletions
        if (!empty($changes['deletedWorkerIds']) && is_array($changes['deletedWorkerIds'])) {
            $delStmt = $db->prepare("UPDATE workers SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id");
            foreach ($changes['deletedWorkerIds'] as $delId) {
                $delStmt->execute([':id' => $delId]);
            }
        }

        if (!empty($changes['deletedLogIds']) && is_array($changes['deletedLogIds'])) {
            $delStmt = $db->prepare("UPDATE attendance_logs SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id");
            foreach ($changes['deletedLogIds'] as $delId) {
                $delStmt->execute([':id' => $delId]);
            }
        }

        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        sendJsonError('Sync commit failed: ' . $e->getMessage(), 500);
    }

    // 4. Query Server Updates modified since client's lastSyncTime
    // Workers updated or deleted
    $stmtUpWorkers = $db->prepare("
        SELECT id, name, phone, role, daily_rate as dailyRate, overtime_hourly_rate as overtimeHourlyRate, is_active as isActive, created_at as createdAt, updated_at as updatedAt, deleted_at as deletedAt
        FROM workers
        WHERE updated_at > :lastSync
    ");
    $stmtUpWorkers->execute([':lastSync' => $lastSyncTime]);
    $serverWorkers = $stmtUpWorkers->fetchAll();

    foreach ($serverWorkers as &$w) {
        $w['dailyRate'] = (float)$w['dailyRate'];
        $w['overtimeHourlyRate'] = (float)$w['overtimeHourlyRate'];
        $w['isActive'] = (int)$w['isActive'];
    }

    // Logs updated or deleted
    $stmtUpLogs = $db->prepare("
        SELECT id, worker_id as workerId, date, type, overtime_hours as overtimeHours, calculated_daily_wage as calculatedDailyWage, calculated_overtime_wage as calculatedOvertimeWage, total_day_pay as totalDayPay, notes, created_at as createdAt, updated_at as updatedAt, deleted_at as deletedAt
        FROM attendance_logs
        WHERE updated_at > :lastSync
    ");
    $stmtUpLogs->execute([':lastSync' => $lastSyncTime]);
    $serverLogs = $stmtUpLogs->fetchAll();

    foreach ($serverLogs as &$l) {
        $l['overtimeHours'] = (float)$l['overtimeHours'];
        $l['calculatedDailyWage'] = (float)$l['calculatedDailyWage'];
        $l['calculatedOvertimeWage'] = (float)$l['calculatedOvertimeWage'];
        $l['totalDayPay'] = (float)$l['totalDayPay'];
    }

    sendJsonResponse([
        'success'    => true,
        'serverTime' => date('Y-m-d H:i:s'),
        'updates'    => [
            'workers' => $serverWorkers,
            'logs'    => $serverLogs
        ]
    ]);
}

// ------------------------------------------------------------------------
// Action: approve_record (Two-Stage Verification: Draft -> Approved)
// ------------------------------------------------------------------------
if ($action === 'approve_record') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        sendJsonError('Approval requires HTTP POST method.', 405);
    }

    // Role-check middleware placeholder: only admin can approve
    requireRole('admin');

    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);

    $recordId = !empty($payload['recordId']) ? trim($payload['recordId']) : '';
    $recordType = !empty($payload['recordType']) ? trim($payload['recordType']) : 'attendance_logs';
    $userId = !empty($payload['userId']) ? trim($payload['userId']) : 'admin';

    if (!$recordId) {
        sendJsonError('recordId is required for approval.', 422);
    }

    $validTables = ['attendance_logs', 'expenses', 'payments'];
    if (!in_array($recordType, $validTables)) {
        sendJsonError('Invalid recordType specified.', 422);
    }

    $now = date('Y-m-d H:i:s');
    $stmt = $db->prepare("
        UPDATE {$recordType} 
        SET status = 'approved', approved_by = :approved_by, approved_at = :approved_at, updated_at = :updated_at 
        WHERE id = :id AND deleted_at IS NULL
    ");
    $stmt->execute([
        ':approved_by' => $userId,
        ':approved_at' => $now,
        ':updated_at'  => $now,
        ':id'          => $recordId
    ]);

    if ($stmt->rowCount() === 0) {
        sendJsonError('Record not found or already approved/deleted.', 404);
    }

    sendJsonResponse([
        'success'     => true,
        'message'     => 'Record has been successfully approved.',
        'recordId'    => $recordId,
        'recordType'  => $recordType,
        'status'      => 'approved',
        'approvedBy'  => $userId,
        'approvedAt'  => $now
    ]);
}

// ------------------------------------------------------------------------
// Action: backup (Export Server JSON Backup)
// ------------------------------------------------------------------------
if ($action === 'backup') {
    $workers = $db->query("SELECT * FROM workers WHERE deleted_at IS NULL")->fetchAll();
    $logs = $db->query("SELECT * FROM attendance_logs WHERE deleted_at IS NULL")->fetchAll();
    $settings = $db->query("SELECT * FROM settings")->fetchAll();

    $backup = [
        'version'     => '1.0',
        'generatedAt' => date('c'),
        'workers'     => $workers,
        'logs'        => $logs,
        'settings'    => $settings
    ];

    header('Content-Disposition: attachment; filename="workshop_db_backup_' . date('Y_m_d_His') . '.json"');
    sendJsonResponse($backup);
}

sendJsonError('Invalid action requested.', 404);

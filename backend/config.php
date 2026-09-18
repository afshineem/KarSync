<?php
/**
 * Workshop Attendance & Payroll Management System
 * Database & Security Configuration File
 * 
 * Instructions:
 * Edit the credentials below according to your cPanel / MySQL database details.
 */

// 1. Database Connection Parameters
define('DB_HOST', 'localhost');                  // Usually 'localhost' or '127.0.0.1'
define('DB_NAME', 'workshop_db');                 // Your database name created in cPanel
define('DB_USER', 'workshop_user');               // Database user
define('DB_PASS', 'YourStrongPasswordHere123!');  // Database user password
define('DB_CHARSET', 'utf8mb4');

// 2. Security Secret API Key
// This key prevents unauthorized access to your workshop financial data.
// Enter the same key inside the PWA Sync Settings modal.
define('API_SECRET_KEY', 'Workshop_Secret_Key_2026_ChangeMe');

// 3. Environment & Debugging
define('DEBUG_MODE', false); // Set to true only when troubleshooting setup errors

// 4. PDO Database Connection Helper
function getDbConnection() {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES " . DB_CHARSET . " COLLATE utf8mb4_unicode_ci"
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            header('Content-Type: application/json; charset=utf-8');
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error'   => 'Database connection error. Check config.php settings.',
                'detail'  => DEBUG_MODE ? $e->getMessage() : null
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
    return $pdo;
}

// 5. JSON Response Helpers
function sendJsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function sendJsonError($message, $statusCode = 400, $extra = []) {
    sendJsonResponse(array_merge([
        'success' => false,
        'error'   => $message
    ], $extra), $statusCode);
}

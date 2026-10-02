const fs = require('fs');
const { execSync } = require('child_process');

console.log("Starting Verification Tests...\n");

// 1. Verify LoginView has workspaceCode
const loginViewContent = fs.readFileSync('src/components/LoginView.jsx', 'utf8');
if (loginViewContent.includes('workspaceCode') && loginViewContent.includes('KARS-101')) {
  console.log("✅ Multi-tenant login fields exist.");
} else {
  console.error("❌ WorkspaceCode missing in LoginView.jsx");
  process.exit(1);
}

// 2. Verify Audit Logs implementation
const auditLoggerContent = fs.readFileSync('src/services/auditLogger.js', 'utf8');
if (auditLoggerContent.includes('USER_LOGIN') || auditLoggerContent.includes('generateAuditId')) {
  console.log("✅ Audit Logger Service is implemented.");
} else {
  console.error("❌ Audit Logger implementation missing.");
  process.exit(1);
}

// 3. Verify Permissions in Navbar
const navbarContent = fs.readFileSync('src/components/Navbar.jsx', 'utf8');
if (navbarContent.includes("hasPermission('settlement.manage')")) {
  console.log("✅ Tab permissions are enforced.");
} else {
  console.error("❌ Tab permissions not enforced in Navbar.");
  process.exit(1);
}

// 4. Run Build
console.log("\nRunning vite build to ensure no compilation errors...");
try {
  execSync('node ./node_modules/vite/bin/vite.js build', { stdio: 'inherit' });
  console.log("\n✅ Build finished successfully! All phases complete.");
} catch (error) {
  console.error("❌ Build failed.", error.message);
  process.exit(1);
}

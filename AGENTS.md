# Workflow & Deployment Rules

## CRITICAL: Staging & Preview First Workflow (MANDATORY)

1. **Local Preview Only by Default:**
   - Whenever changes, bug fixes, or new features are implemented, test and apply them ONLY in the local project environment.
   - Run `node ./node_modules/vite/bin/vite.js build` to ensure 0 build errors and update the local bundle.
   - Ensure the preview server is active on port 8080 so the user can inspect live:
     - PC: `http://localhost:8080/`
     - Mobile (LAN): `http://192.168.110.217:8080/`

2. **Strict Git & Versioning Workflow (USER PREFERENCE):**
   - **DO NOT MAKE ANY COMMITS.** (`git commit` is forbidden).
   - **NEVER PUSH AUTOMATICALLY.** (`git push` is forbidden).
   - After completing changes and receiving the user's explicit approval, provide a properly formatted English commit message for the user to use themselves.
   - After EVERY change (small or large), remind the user to bump the version number.

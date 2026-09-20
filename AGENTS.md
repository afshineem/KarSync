# Workflow & Deployment Rules

## CRITICAL: Staging & Preview First Workflow (MANDATORY)

1. **Local Preview Only by Default:**
   - Whenever changes, bug fixes, or new features are implemented, test and apply them ONLY in the local project environment.
   - Run `node ./node_modules/vite/bin/vite.js build` to ensure 0 build errors and update the local bundle.
   - Ensure the preview server is active on port 8080 so the user can inspect live:
     - PC: `http://localhost:8080/`
     - Mobile (LAN): `http://192.168.110.217:8080/`

2. **Strict Approval Before Any GitHub / Vercel Push:**
   - Present the changes to the user clearly in Persian.
   - **NEVER** run `push_to_github.js` or push commits to GitHub/Vercel automatically.
   - **ALWAYS** wait for the user's explicit confirmation and approval (e.g. «تایید شد»، «پوش کن»، «اوکیه») before pushing.
   - This rule is permanent across all sessions, restarts, and prompts.

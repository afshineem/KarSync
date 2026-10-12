# Workflow & Deployment Rules

## CRITICAL: Staging & Preview First Workflow (MANDATORY)

1. **Local Preview Only by Default:**
   - Whenever changes, bug fixes, or new features are implemented, test and apply them ONLY in the local project environment.
   - Run `node ./node_modules/vite/bin/vite.js build` to ensure 0 build errors and update the local bundle.
   - Ensure the preview server is active on port 8080 so the user can inspect live:
     - PC: `http://localhost:8080/`
     - Mobile (LAN): `http://192.168.110.217:8080/`

2. **Strict Git & Versioning Workflow:**
   - **AUTOMATIC STAGE & COMMIT:**
     - Whenever tasks, bug fixes, or changes are completed and verified, perform `git add .` and `git commit -m "descriptive message"` automatically.
   - **PUSH CONTROL & COMMAND CODE PHRASE:**
     - **DO NOT PUSH AUTOMATICALLY** during normal tasks unless explicitly ordered by the user.
     - **Push Trigger Words:** If the user says **«پوش کن»** (or "push"), immediately push the commits to the current remote branch:
       ```bash
       git push
       ```
     - **Merge & Push Trigger Words:** If working on a specific branch and the user says **«مرج و پوش کن»** (or "merge and push"):
       1. Switch back to the main branch (`git checkout main`).
       2. Merge the feature/working branch into main (`git merge <branch_name>`).
       3. Push the updated main branch to remote (`git push origin main`).
   - Remind the user about the current version number and any version bumps.

## UI Design System: [APP_THEME_BUTTON]
**Trigger Keyword:** "Theme Button", "دکمه با تم برنامه", or "[APP_THEME_BUTTON]"

When explicitly instructed to use this theme button pattern, you MUST strictly adhere to the following KarSync UI/UX specifications:

**1. Standalone Buttons:**
- Must have a large, uniform size (conceptually based on a 26x26 inner scale with generous padding).
- Must have fully rounded corners (e.g., `rounded-xl` or `rounded-2xl` in Tailwind).
- Typically contain only an icon unless specified otherwise.

**2. Grouped/Tabbed Buttons (Segmented Controls):**
- **Container:** All buttons in a series must be wrapped inside a shared pill-shaped or rounded container with a subtle background and padding.
- **Active State:** The currently active tab MUST have the primary blue background color (`bg-primary` or similar). It MUST display BOTH the text label and a light-colored icon.
- **Inactive State:** Unselected tabs MUST have a transparent or subtle background. They MUST display ONLY an icon (NO text label).
- **Transitions:** You MUST apply smooth CSS transitions (e.g., `transition-all duration-300 ease-in-out`) to all buttons in the group. This ensures that when a tab becomes active, it smoothly expands to reveal the text, and color changes animate gracefully.

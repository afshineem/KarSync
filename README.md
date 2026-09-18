# Workshop Attendance & Payroll Management (Local-First Offline PWA)
## بەڕێوەبردنی کارگە و ئامادەبوونی کارمەندان | مدیریت کارگاه و ثبت کارکرد پرسنل

A robust, production-ready, local-first offline Progressive Web Application (PWA) tailored for workshop management, daily attendance logging, and automated payroll calculations in **Iraqi Dinars (IQD / د.ع)** with real-time Supabase cloud synchronization and zero mandatory backend server dependencies.

---

## ✨ Key Features

### 1. 100% Client-Side & Local-First + Supabase Realtime Cloud Sync
- **Local-First Architecture:** Operates entirely inside the user's browser using **IndexedDB (Dexie.js)**.
- **Supabase Realtime Cloud Sync:** Seamless background 2-way synchronization with Supabase cloud database across devices.
- **Offline PWA:** Integrated Service Worker (`sw.js`) and Web App Manifest (`manifest.json`) enable installation on Windows, macOS, Android, and iOS home screens.
- **JSON Backup & Restore:** Complete data export to timestamped JSON (`workshop_backup_YYYY-MM-DD.json`) with safe restore and merge/replace modes.

### 2. Multi-Language & RTL Layout Engine (i18n)
- **Kurdish Sorani (کوردی):** Complete terminology, RTL layout, and Vazirmatn typography.
- **Persian (فارسی):** Full Persian translation, RTL layout.
- **English:** Full LTR layout with clean Inter typography.
- **Dynamic Switcher:** Instant bidirectional UI flipping (`dir="rtl"` / `dir="ltr"`) without page reloads.

### 3. Currency & Payroll Engine (Iraqi Dinars - IQD)
- Default currency unit: **IQD (د.ع / دیناری عێراقی / دینار عراق)**.
- Automated wage calculations:
  - **Full Working Day:** `1.0 × Daily Wage Rate`
  - **Half Working Day:** `0.5 × Daily Wage Rate`
  - **Hourly Work & Overtime:** `Hours × Hourly Rate`
  - **Net Total Pay:** `Base Pay + Overtime Pay`

### 4. Core Functional Modules
- **Dashboard View:**
  - Real-time monthly KPI summary cards (Active Workers, Total Worked Days, Overtime Hours, Total Payroll in IQD).
  - Monthly Worker Summary Table with net salary breakdown.
  - Month/Year navigator for historical payroll review.
- **Workers Management (کارکنان / کارمەندان):**
  - Full CRUD operations with soft-delete / active status toggle.
  - Custom wage structures per worker: Daily Wage Rate (IQD) & Hourly Overtime Rate (IQD).
  - **Quick Month Attendance Modal:** Mini interactive calendar for fast month logging with precision minute support (e.g. 1h 44m).
  - Worker Attendance History modal with 1-click edit.
- **Daily Attendance Modal (ثبت کارکرد روزانه / تۆماری ڕۆژانە):**
  - Date selector defaulting to today with manual override.
  - Multi-select bulk worker checkbox list with duplicate entry detection.
  - Granular per-worker adjustments: Full/Half/Hourly toggle, overtime stepper, notes/task description.
  - Real-time day wage preview per worker.
- **Calendar & Reporting View (تقویم و گزارش‌ها / ڕۆژژمێر و راپۆرتەکان):**
  - Interactive Visual Monthly Calendar with day indicators (workers present, overtime, daily expense).
  - Master Log View with filtering by date range, worker, and attendance type.
  - Aggregated metrics bar (Total entries, days, overtime hours, total payout in IQD).
  - **Excel Export (.xlsx):** Generates structured spreadsheets formatted for local analysis.
  - **Print & PDF Engine:** Printable statement stylesheet formatted for RTL and LTR with workshop header, summary KPIs, and signature lines.

---

## 🚀 Quick Start & How to Run

### Option 1: Double-Click Launcher (Windows)
Double-click `run_app.bat` in the project root. It launches the local server and opens `http://localhost:8080` in your browser.

### Option 2: Command Line
```bash
npm install
npm run build
npx vite preview --port 8080 --host
```
Then navigate to `http://localhost:8080` in any web browser.

---

## 📦 Tech Stack
- **Framework:** React 18
- **Build Tool:** Vite
- **Database (Local):** Dexie.js (IndexedDB)
- **Database (Cloud):** Supabase (PostgreSQL + Realtime Channels)
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Export Tools:** SheetJS (`xlsx`)

# ABDC Asset Management System

## How to run the app

### Option 1: Double-click (easiest)
1. Open the folder: `ABDC_Asset_Manager`
2. Double-click **`start.bat`**
3. Wait until you see **"✓ Ready"** in the window
4. Open your browser and go to: **http://localhost:3000**  
   - If that doesn’t load, try **http://localhost:3001**

### Option 2: From terminal/command prompt
1. Open Command Prompt or PowerShell
2. Go to the project folder:
   ```
   cd "c:\Users\ABDC 1\Videos\fixt asset\ABDC_Asset_Manager"
   ```
3. Run:
   ```
   npm run dev
   ```
4. When you see "✓ Ready", open **http://localhost:3000** (or **http://localhost:3001** if 3000 is in use)

### If it says "another instance of next dev running"
- Another server is already running. Try opening **http://localhost:3000** or **http://localhost:3001** in your browser.
- If you want to restart: close any other Command Prompt/PowerShell window that is running the app, then run **start.bat** again.

### If the app still doesn’t start
- Make sure **Node.js** is installed: open a new Command Prompt and type `node -v`. You should see a version number.
- If not, install Node.js from https://nodejs.org (LTS version), then try again.

---

## Hosting (production)

### 1. Environment variables
- Copy `.env.example` to `.env` and set:
  - **DATABASE_URL** (required): e.g. `file:./prisma/dev.db` for SQLite, or your production DB URL.
  - **API_KEY** (optional): Google AI Studio key for the Gemini assistant; omit to disable AI.

### 2. Build and run
```bash
npm install
npx prisma generate
npx prisma migrate deploy   # or: npx prisma db push
node prisma/seed.js          # optional: seed users and reference data (default login: admin@abdc.com / password123)
npm run build
npm start
```
The app will be available on port **3000** (or the port you set with `PORT=3001 npm start`).

### 3. Notes
- **Database**: SQLite is fine for single-instance hosting; for scale, switch `DATABASE_URL` to PostgreSQL and run migrations.
- **Work in Progress**: WIP projects are kept in browser memory and reset on refresh; assets are stored in the database.
- **Excel export**: Uses SheetJS from CDN; ensure the host can load `https://cdn.sheetjs.com/...`.

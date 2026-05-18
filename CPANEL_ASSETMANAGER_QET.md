# Deploy to assetmanager.qet.com.ng

## Important: Security

**Change your cPanel password immediately** if you shared it anywhere. Never commit passwords to code.

## Step 1: Prepare the Deployment Package

1. **Stop the dev server** (Ctrl+C) if it's running – this releases file locks.
2. Run:
   ```
   npm run build
   ```
3. Create a ZIP containing:
   - `.next` (entire folder)
   - `public`
   - `prisma`
   - `app`
   - `components`
   - `lib`
   - `utils`
   - `types.ts`
   - `constants.ts`
   - `package.json`
   - `package-lock.json`
   - `server.js`
   - `next.config.ts`
   - `tsconfig.json`
   - `tailwind.config.js`
   - `postcss.config.js`

   **Exclude:** `node_modules`, `.git`, `.env` (create `.env` on the server)

## Step 2: Upload to cPanel

1. Log in at **https://cpanel.qet.com.ng/**
2. Go to **File Manager**
3. Navigate to the document root for **assetmanager.qet.com.ng** (e.g. `public_html/assetmanager` or the subdomain folder)
4. Upload your ZIP and extract it

## Step 3: Setup Node.js Application

1. In cPanel, go to **Software** → **Setup Node.js App**
2. Click **Create Application**
3. Configure:

| Setting | Value |
|---------|-------|
| **Node.js version** | 18 or 20 |
| **Application mode** | Production |
| **Application root** | Path to your app (e.g. `public_html/assetmanager` or `assetmanager.abdc.com.ng`) |
| **Application URL** | assetmanager.qet.com.ng |
| **Application startup file** | `server.js` |

4. **Environment variables** (in the Node.js App UI):
   - `DATABASE_URL` = `file:./prisma/production.db`
   - `NODE_ENV` = `production`

5. Click **Run NPM Install**
6. Run **Run JS Script**: `npx prisma migrate deploy`
7. Click **Start** or **Restart**

## Step 4: Point Domain to the App

If the app runs on a port (e.g. 3000), cPanel may need a **Proxy** or **Application URL** so that `https://assetmanager.abdc.com.ng` forwards to the Node.js app. Check your host’s docs for “Node.js proxy” or “Application URL”.

## Step 5: Verify

Open **https://assetmanager.qet.com.ng** in your browser.

## Troubleshooting

- **502 Bad Gateway:** Configure the proxy from the domain to the Node.js app port.
- **App won’t start:** Confirm startup file is `server.js` and `npm run build` completed.
- **Database errors:** Ensure `prisma/production.db` is writable; run `npx prisma migrate deploy`.

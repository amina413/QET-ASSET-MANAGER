# Deploy QET ASSET MANAGER on cPanel

This guide walks you through deploying the Next.js app on cPanel hosting.

## Prerequisites

- cPanel hosting with **Node.js support** (Setup Node.js App)
- **Node.js 18+** available in cPanel
- SSH access (recommended) or File Manager

## Step 1: Build Locally (Recommended)

Build on your machine to avoid timeout/memory issues on shared hosting:

```bash
npm install
npm run build
```

**Windows:** Run `deploy-cpanel.bat` to build and create `deploy-cpanel.zip` for upload.

## Step 2: Upload to cPanel

### Option A: File Manager

1. Log in to cPanel → **File Manager**
2. Go to your domain or subdomain root (e.g. `public_html/assetmanager` or `yourdomain.com`)
3. Upload a ZIP of your project
4. Extract the ZIP

### Option B: Git (if SSH available)

```bash
cd ~/yourdomain.com
git clone https://github.com/your-repo/QET_Asset_Manager.git .
npm install
npm run build
```

## Step 3: Setup Node.js Application

1. In cPanel, go to **Software** → **Setup Node.js App**
2. Click **Create Application**
3. Configure:

| Setting | Value |
|---------|-------|
| **Node.js version** | 18 or 20 (match your local build) |
| **Application mode** | Production |
| **Application root** | Path to your app folder (e.g. `public_html/assetmanager`) |
| **Application URL** | Your domain or subdomain |
| **Application startup file** | `server.js` |

4. **Environment variables** (add in the UI):

   - `DATABASE_URL` = `file:./prisma/production.db`
   - `NODE_ENV` = `production`
   - (Optional) `API_KEY` = your Gemini API key for AI assistant

5. Click **Run NPM Install**
6. If you built locally, upload the `.next` folder. Otherwise, click **Run JS Script** and run: `npm run build`
7. Click **Start** or **Restart**

## Step 4: Database Setup

The app uses SQLite (file-based). Ensure the `prisma` folder is writable:

1. Create `prisma/production.db` if needed (or set `DATABASE_URL` to a writable path)
2. Run migrations via **Run JS Script** in cPanel:

   ```bash
   npx prisma migrate deploy
   ```

3. Or run locally and upload the `prisma` folder with the DB file

## Step 5: Verify

- **Local:** http://localhost:3000 (or your cPanel-assigned port)
- **Public:** Your domain/subdomain (cPanel may need Proxy setup to forward to the Node app port)

## Troubleshooting

### App won't start

- Check **Application startup file** is `server.js`
- Ensure `npm run build` completed successfully
- Check logs in cPanel → Setup Node.js App → Error Log

### 502 Bad Gateway

- cPanel may need a **Proxy** to forward your domain to the Node.js port. Check your host's docs for "Node.js proxy" or "Application URL" setup.

### Database errors

- Ensure `prisma/production.db` (or your `DATABASE_URL` path) is writable
- Run `npx prisma migrate deploy` after upload

### Build fails on server

- Build locally and upload the `.next` folder
- Use `npm run build` locally, then ZIP the project (including `.next`), upload, and extract

## Files to Include in Deployment

```
.next/          (built output - required)
node_modules/  (install on server)
public/
prisma/
app/
components/
lib/
utils/
types/
constants/
package.json
package-lock.json
server.js
next.config.ts
tsconfig.json
.env            (create on server, never commit)
```

## Files to Exclude

```
.git/
.env.example
*.md (except this guide)
```

## Optional: Deploy Script

Create `deploy-cpanel.sh` to build and zip for upload:

```bash
#!/bin/bash
npm run build
zip -r deploy.zip .next public prisma app components lib utils types constants package.json package-lock.json server.js next.config.ts tsconfig.json -x "*.git*" -x "node_modules/*"
echo "Upload deploy.zip to cPanel"
```

/**
 * Custom server for cPanel / Node.js hosting
 * cPanel Setup Node.js App: set Startup File to "server.js"
 */
import { createServer } from 'http';
import { parse } from 'url';
import { existsSync } from 'fs';
import { join } from 'path';
import next from 'next';

const port = parseInt(process.env.PORT || '3000', 10);
// Production if NODE_ENV=production or .next build exists (cPanel often doesn't set NODE_ENV)
const dev = process.env.NODE_ENV !== 'production' && !existsSync(join(process.cwd(), '.next'));
const hostname = process.env.HOSTNAME || 'localhost';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  }).listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});

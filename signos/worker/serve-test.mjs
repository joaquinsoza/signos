#!/usr/bin/env node
/**
 * Simple HTTP server to serve test-signs.html
 * Run: node serve-test.mjs
 */

import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const server = createServer(async (req, res) => {
    if (req.url === '/' || req.url === '/test-signs.html') {
        try {
            const html = await readFile(join(__dirname, 'test-signs.html'), 'utf-8');
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
        } catch (err) {
            res.writeHead(500);
            res.end('Error loading test page');
        }
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    console.log(`✅ Test page server running at http://localhost:${PORT}`);
    console.log(`\n📖 Open in browser: http://localhost:${PORT}\n`);
    console.log(`Make sure worker is running on ws://localhost:8787`);
    console.log(`  cd signos/worker && pnpm run dev\n`);
});

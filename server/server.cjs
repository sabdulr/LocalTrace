const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const { parseSVG, exportSVG } = require('../core/document.cjs');
const { validateDoc } = require('../core/validate.cjs');
const root = path.resolve(__dirname, '../dist');

function createServer({ publicOrigin = process.env.PUBLIC_ORIGIN } = {}) {
  let external;
  if (publicOrigin) {
    external = new URL(publicOrigin);
    if (!['http:', 'https:'].includes(external.protocol) || external.origin !== publicOrigin)
      throw Error('PUBLIC_ORIGIN must be an exact http(s) origin without a trailing slash or path');
  }
  const jobs = new Map();
  function job(client, operation, args) {
    if (jobs.has(client)) throw Error('Another operation is running');
    return new Promise((resolve, reject) => {
      const worker = new Worker(path.join(__dirname, '../electron/worker.cjs'), {
        workerData: { operation, args }, resourceLimits: { maxOldGenerationSizeMb: 768 },
      });
      jobs.set(client, worker);
      const finish = () => { if (jobs.get(client) === worker) jobs.delete(client); };
      worker.once('message', m => { finish(); void worker.terminate(); m.error ? reject(Error(m.error)) : resolve(m.result); });
      worker.once('error', e => { finish(); reject(e); });
      worker.once('exit', () => { finish(); reject(Error('Operation cancelled or worker stopped')); });
    });
  }
  const server = http.createServer(async (req, res) => {
    const json = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
    try {
      if (req.url === '/healthz' && req.method === 'GET') return json(200, { status: 'ok' });
      const authority = external?.host || `127.0.0.1:${server.address().port}`;
      if (req.headers.host !== authority) return json(403, { error: 'Invalid host' });
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');
      if (req.url.startsWith('/api/')) {
        if (req.method !== 'POST' || req.headers.origin !== (external?.origin || `http://${authority}`) || !req.headers['content-type']?.startsWith('application/json'))
          return json(403, { error: 'Same-origin JSON requests required' });
        let size = 0; const chunks = [];
        for await (const chunk of req) { size += chunk.length; if (size > 120e6) { json(413, { error: 'Request exceeds 120 MB limit' }); return; } chunks.push(chunk); }
        const data = JSON.parse(Buffer.concat(chunks).toString());
        const client = req.headers['x-localtrace-client'];
        if (typeof client !== 'string' || !/^[a-z0-9-]{1,80}$/i.test(client)) throw Error('Invalid browser session');
        const op = req.url.slice(5);
        let result;
        if (op === 'cancel') { await jobs.get(client)?.terminate(); result = null; }
        else if (op === 'prepare' || op === 'trace') {
          if (typeof data.bytes !== 'string' || data.bytes.length > 54e6) throw Error('Image exceeds 40 MB limit');
          const bytes = new Uint8Array(Buffer.from(data.bytes, 'base64'));
          result = await job(client, op, op === 'prepare' ? [bytes, data.count, data.options] : [bytes, data.settings]);
        } else if (op === 'merge') {
          validateDoc(data.doc);
          if (!Array.isArray(data.ids) || data.ids.length > 20000 || data.ids.some(id => typeof id !== 'string')) throw Error('Invalid selection');
          result = await job(client, op, [data.doc, data.ids]);
        } else if (op === 'import-svg') result = parseSVG(data.text);
        else if (op === 'project') {
          validateDoc(data.document);
          if (!data.settings || !Array.isArray(data.settings.palette) || data.settings.palette.length > 16 || data.settings.palette.some(c => !/^#[a-f0-9]{6}$/i.test(c))) throw Error('Invalid project settings');
          if (data.source !== undefined && (typeof data.source !== 'string' || data.source.length > 55e6 || !/^[A-Za-z0-9+/=]+$/.test(data.source))) throw Error('Invalid project source');
          if (data.original !== undefined && (typeof data.original !== 'string' || data.original.length > 50e6 || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data.original))) throw Error('Invalid project image');
          result = data;
        } else if (op === 'export') {
          const doc = validateDoc(data.doc);
          if (data.kind === 'colors') {
            result = [...new Set(doc.layers.filter(l => l.visible && doc.shapes.some(s => s.visible && s.layerId === l.id)).map(l => l.color))].map((color, i) => {
              const layers = doc.layers.filter(l => l.color === color);
              return { name: `color-${i + 1}-${color.replace(/[^a-z0-9]/gi, '')}.svg`, text: exportSVG({ ...doc, layers, shapes: doc.shapes.filter(s => layers.some(l => l.id === s.layerId)) }) };
            });
          } else {
            const svg = exportSVG(doc, data.layerId);
            if (data.kind === 'png') result = { base64: (await require('sharp')(Buffer.from(svg)).resize({ width: Math.round(doc.width), height: Math.round(doc.height), fit: 'contain' }).png().toBuffer()).toString('base64') };
            else if (data.kind === 'dxf') result = { text: require('../core/geometry.cjs').exportDXF(doc) };
            else if (data.kind === 'svg' || data.kind === 'pdf') result = { text: svg };
            else throw Error('Invalid export format');
          }
        } else return json(404, { error: 'Unknown operation' });
        return json(200, result);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(405, { error: 'Method not allowed' });
      const pathname = decodeURIComponent(new URL(req.url, `http://${authority}`).pathname);
      const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(root + path.sep)) return json(403, { error: 'Forbidden' });
      const content = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (e) { if (!res.headersSent) json(e.code === 'ENOENT' ? 404 : 400, { error: e.code === 'ENOENT' ? 'Build the application first with npm run build' : e.message }); else res.end(); }
  });
  server.on('close', () => { for (const worker of jobs.values()) void worker.terminate(); });
  return server;
}
if (require.main === module) {
  const server = createServer();
  const host = process.env.HOST || '127.0.0.1';
  server.listen(Number(process.env.PORT || 4173), host, () => console.log(`LocalTrace: ${process.env.PUBLIC_ORIGIN || `http://127.0.0.1:${server.address().port}`} (listening on ${host})`));
  const stop = () => {
    server.close();
    server.closeAllConnections();
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { createServer };

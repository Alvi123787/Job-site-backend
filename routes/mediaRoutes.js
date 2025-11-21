import express from 'express';
import { Readable } from 'stream';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { requireAuth } from '../middleware/authMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsRoot = path.join(__dirname, '..', 'uploads');
const avatarDir = path.join(uploadsRoot, 'avatars');
for (const dir of [uploadsRoot, avatarDir]) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    console.warn('Failed to ensure uploads directory:', dir, e?.message || e);
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarDir),
  filename: (_req, file, cb) => {
    const safeBase = Date.now().toString(36);
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    cb(null, `avatar-${safeBase}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only image files are allowed'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 3 * 1024 * 1024 } });

const router = express.Router();

// Simple image proxy to avoid ORB/CORS issues for external logos
router.get('/image-proxy', async (req, res) => {
  const url = String(req.query.url || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return sendPlaceholder(res);
  }

  try {
    const timeoutMs = Math.max(2000, Math.min(15000, Number(process.env.IMAGE_PROXY_TIMEOUT || 6000)));
    const signal = (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function')
      ? AbortSignal.timeout(timeoutMs)
      : undefined;
    const resp = await fetch(url, { redirect: 'follow', signal });
    if (!resp.ok) {
      // Fallback to a safe placeholder to avoid ORB/CORB
      return sendPlaceholder(res);
    }
    let contentType = resp.headers.get('content-type') || 'application/octet-stream';
    // Only allow known image content types to pass through to avoid ORB/CORB
    const allowed = ['image/png','image/jpeg','image/jpg','image/gif','image/webp','image/svg+xml'];
    const isImage = allowed.some(t => contentType.toLowerCase().startsWith(t));
    if (!isImage) {
      // Some hosts mislabel SVGs; try to sniff by URL extension as a safe fallback
      const lowerUrl = url.toLowerCase();
      if (lowerUrl.endsWith('.svg')) {
        contentType = 'image/svg+xml; charset=utf-8';
      } else if (lowerUrl.match(/\.(png|webp)$/)) {
        contentType = `image/${RegExp.$1}`;
      } else if (lowerUrl.match(/\.(jpe?g)$/)) {
        contentType = 'image/jpeg';
      } else if (lowerUrl.match(/\.(gif)$/)) {
        contentType = 'image/gif';
      } else {
        // If we still can't confidently treat as an image, return placeholder instead of JSON
        return sendPlaceholder(res);
      }
    }
    // Prefer streaming when possible to reduce memory and avoid client aborts
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (resp.body && typeof Readable.fromWeb === 'function') {
      try {
        const stream = Readable.fromWeb(resp.body);
        stream.on('error', () => sendPlaceholder(res));
        return stream.pipe(res);
      } catch (_) {
        // Fallback to buffer below
      }
    }

    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.send(buffer);
  } catch (err) {
    const code = err?.code || err?.name || 'ERR_IMAGE_PROXY';
    const msg = err?.message || String(err);
    console.warn('image-proxy warning:', code, msg);
    return sendPlaceholder(res);
  }
});

export default router;

// Authenticated avatar upload
router.post('/upload/avatar', requireAuth, (req, res) => {
  upload.single('avatar')(req, res, async (err) => {
    if (err) {
      console.error('avatar upload error', err);
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    // Public URL served by Express static under /uploads
    const publicUrl = `/uploads/avatars/${req.file.filename}`;
    return res.json({ url: publicUrl });
  });
});

function sendPlaceholder(res) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f3f4f6"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" fill="url(#g)"/>
  <rect x="20" y="20" width="88" height="88" rx="12" ry="12" fill="#e5e7eb"/>
  <circle cx="64" cy="60" r="18" fill="#d1d5db"/>
  <rect x="34" y="90" width="60" height="10" rx="5" ry="5" fill="#d1d5db"/>
  <text x="64" y="118" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="10" fill="#9ca3af">No Logo</text>
</svg>`;
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.send(svg);
}
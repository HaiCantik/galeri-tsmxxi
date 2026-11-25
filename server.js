require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { google } = require('googleapis');

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, DRIVE_FOLDER_ID, APP_PASSWORD } = process.env;
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN || !DRIVE_FOLDER_ID) {
  console.error('Environment Google Drive belum lengkap. Lihat .env.example');
  process.exit(1);
}

const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth });

const app = express();

// Password sederhana (opsional): browser akan menampilkan kotak login
if (APP_PASSWORD) {
  app.use((req, res, next) => {
    const h = req.headers.authorization || '';
    const pass = Buffer.from(h.split(' ')[1] || '', 'base64').toString().split(':').slice(1).join(':');
    if (pass === APP_PASSWORD) return next();
    res.set('WWW-Authenticate', 'Basic realm="Media Studio"').status(401).send('Password diperlukan');
  });
}

app.use(express.static(path.join(__dirname, 'public')));

// Pastikan file memang ada di folder Media Studio (cache supaya hemat panggilan API)
const okIds = new Set();
async function inFolder(id) {
  if (okIds.has(id)) return true;
  const r = await drive.files.get({ fileId: id, fields: 'parents,trashed' });
  const ok = !r.data.trashed && (r.data.parents || []).includes(DRIVE_FOLDER_ID);
  if (ok) okIds.add(id);
  return ok;
}

const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 500 * 1024 * 1024 } });

app.post('/api/upload', upload.array('files', 20), async (req, res) => {
  const out = [];
  for (const f of req.files) {
    try {
      if (!/^(image|video)\//.test(f.mimetype)) continue;
      const r = await drive.files.create({
        requestBody: {
          name: Date.now() + '-' + f.originalname,
          parents: [DRIVE_FOLDER_ID],
          appProperties: { original: f.originalname.slice(0, 60) }
        },
        media: { mimeType: f.mimetype, body: fs.createReadStream(f.path) },
        fields: 'id'
      });
      okIds.add(r.data.id);
      out.push(r.data.id);
    } catch (e) {
      console.error('Upload gagal:', e.message);
    } finally {
      fs.unlink(f.path, () => {});
    }
  }
  res.json({ ok: true, files: out });
});

app.get('/api/media', async (req, res) => {
  try {
    const files = [];
    let pageToken;
    do {
      const r = await drive.files.list({
        q: `'${DRIVE_FOLDER_ID}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id,name,size,mimeType,createdTime,appProperties)',
        orderBy: 'createdTime desc',
        pageSize: 200,
        pageToken
      });
      files.push(...r.data.files);
      pageToken = r.data.nextPageToken;
    } while (pageToken);
    res.json(files.map(f => {
      okIds.add(f.id);
      return {
        id: f.id,
        filename: f.id,
        original: (f.appProperties && f.appProperties.original) || f.name,
        type: f.mimeType.startsWith('video') ? 'video' : 'image',
        size: Number(f.size),
        created_at: f.createdTime
      };
    }));
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: e.message });
  }
});

// Stream file dari Drive (mendukung Range supaya video bisa di-seek)
app.get('/files/:id', async (req, res) => {
  try {
    if (!(await inFolder(req.params.id))) return res.status(404).end();
    const headers = req.headers.range ? { Range: req.headers.range } : {};
    const r = await drive.files.get(
      { fileId: req.params.id, alt: 'media' },
      { responseType: 'stream', headers }
    );
    res.status(r.status);
    ['content-type', 'content-length', 'content-range', 'accept-ranges'].forEach(h => {
      if (r.headers[h]) res.setHeader(h, r.headers[h]);
    });
    res.setHeader('Cache-Control', 'private, max-age=3600');
    r.data.pipe(res);
  } catch (e) {
    res.status(404).end();
  }
});

app.delete('/api/media/:id', async (req, res) => {
  try {
    if (!(await inFolder(req.params.id))) return res.status(404).json({ ok: false });
    await drive.files.delete({ fileId: req.params.id });
    okIds.delete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Media Studio jalan di port ' + PORT));

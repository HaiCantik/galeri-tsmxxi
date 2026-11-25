// Jalankan SEKALI di PC kamu: npm run token
require('dotenv').config();
const http = require('http');
const { google } = require('googleapis');

const REDIRECT = 'http://localhost:3001/oauth2callback';
const o = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, REDIRECT);
const url = o.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive.file']
});
console.log('\nBuka link ini di browser lalu login & izinkan:\n\n' + url + '\n');

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost:3001');
  if (u.pathname !== '/oauth2callback') return res.end();
  try {
    const { tokens } = await o.getToken(u.searchParams.get('code'));
    o.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: o });
    const f = await drive.files.create({
      requestBody: { name: 'MediaStudio', mimeType: 'application/vnd.google-apps.folder' },
      fields: 'id'
    });
    res.end('Berhasil! Kembali ke terminal.');
    console.log('Salin dua baris ini ke file .env dan ke Environment di hosting:\n');
    console.log('GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token);
    console.log('DRIVE_FOLDER_ID=' + f.data.id + '\n');
  } catch (e) {
    res.end('Gagal: ' + e.message);
    console.error(e.message);
  }
  setTimeout(() => process.exit(0), 500);
}).listen(3001);

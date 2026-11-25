# Media Studio (online, storage Google Drive)

Upload foto & video, edit (filter, teks, trim, kecepatan), simpan ke Google Drive.

## Lokal
1. Salin `.env.example` jadi `.env`, isi CLIENT_ID & CLIENT_SECRET
2. `npm install`
3. `npm run token` (sekali) -> salin REFRESH_TOKEN & FOLDER_ID ke `.env`
4. `npm start` -> http://localhost:3000

## Deploy (Render)
Build: `npm install` | Start: `npm start`
Isi Environment: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, DRIVE_FOLDER_ID, APP_PASSWORD

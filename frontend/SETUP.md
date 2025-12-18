# Sistem Antrian - Frontend React + Vite + Tailwind CSS

Aplikasi sistem antrian realtime dengan Firebase Firestore, dibuat menggunakan React, Vite, dan Tailwind CSS 3.

## Fitur

### Portal Pelanggan
- ✅ Ambil nomor antrian dengan satu klik
- ✅ Tampilan nomor antrian realtime
- ✅ Status tiket realtime (WAITING / CALLED / DONE / MISSED)
- ✅ Tampilan posisi dalam antrian
- ✅ Nomor sedang dipanggil
- ✅ Penyimpanan ticketId di localStorage
- ✅ Tidak perlu login

### Portal Admin
- ✅ Login menggunakan Firebase Authentication
- ✅ Dashboard realtime dengan statistik
- ✅ Nomor sedang dipanggil
- ✅ Daftar nomor berikutnya
- ✅ Total pelanggan menunggu
- ✅ Tombol NEXT (panggil nomor berikutnya)
- ✅ Tombol RESET (reset antrian harian)
- ✅ Tabel daftar antrian dengan status

## Logika Status Tiket

1. **WAITING** - Pelanggan sedang menunggu
   - Kondisi: `currentNumber < ticketNumber`

2. **CALLED** - Nomor sedang dipanggil
   - Kondisi: `currentNumber == ticketNumber`

3. **DONE** - Layanan selesai
   - Kondisi: Admin menekan tombol NEXT

4. **MISSED** - Nomor terlewat
   - Kondisi: `currentNumber > ticketNumber AND status != "done"`

## Setup Firebase

1. Buat project di [Firebase Console](https://console.firebase.google.com/)

2. Enable **Firestore Database**:
   - Pilih mode "Test mode" untuk development
   - Location: asia-southeast2 (Jakarta)

3. Enable **Authentication**:
   - Pilih Email/Password authentication
   - Buat user admin untuk login

4. Update konfigurasi Firebase di `src/firebase.js`:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## Firestore Rules (Production)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Tickets collection - customer can create, all can read
    match /tickets/{ticketId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if request.auth != null;
    }
    
    // Queue collection - admin can write, all can read
    match /queue/{queueId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## Struktur Database

### Collection: `tickets`
```javascript
{
  ticketNumber: 1,           // Number
  status: "waiting",         // String: waiting, called, done, missed
  createdAt: Timestamp       // Timestamp
}
```

### Collection: `queue`
Document ID: `current`
```javascript
{
  currentNumber: 0           // Number - nomor yang sedang dipanggil
}
```

## Instalasi

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Struktur Folder

```
frontend/
├── src/
│   ├── components/
│   │   ├── Customer.jsx    # Portal Pelanggan
│   │   └── Admin.jsx       # Portal Admin
│   ├── firebase.js         # Firebase configuration
│   ├── App.jsx            # Main app with routing
│   ├── index.css          # Tailwind CSS
│   └── main.jsx
├── public/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## Cara Menggunakan

### Untuk Pelanggan:
1. Buka `/customer`
2. Klik tombol "Ambil Nomor Antrian"
3. Lihat nomor antrian, status, dan posisi Anda
4. Status akan update secara realtime

### Untuk Admin:
1. Buka `/admin`
2. Login dengan email dan password
3. Lihat dashboard dengan statistik realtime
4. Klik "NEXT" untuk memanggil nomor berikutnya
5. Klik "RESET" untuk mereset antrian harian

## Tech Stack

- ⚡ **Vite** - Build tool
- ⚛️ **React 18** - UI framework
- 🎨 **Tailwind CSS 3** - Styling
- 🔥 **Firebase** - Backend & Realtime database
- 🛣️ **React Router** - Routing

## Deploy

### Vercel / Netlify
```bash
npm run build
# Upload dist folder
```

### Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
```

## Environment Variables (Optional)

Buat file `.env` untuk menyimpan Firebase config:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

Update `firebase.js`:
```javascript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};
```

## Troubleshooting

### Firestore Permission Denied
- Pastikan Firestore rules sudah diupdate
- Untuk testing, bisa gunakan test mode

### Authentication Error
- Pastikan Email/Password authentication sudah dienable
- Buat user di Firebase Console

### Realtime Update Tidak Bekerja
- Cek koneksi internet
- Pastikan Firebase SDK sudah terinstall dengan benar
- Cek console browser untuk error

## License

MIT

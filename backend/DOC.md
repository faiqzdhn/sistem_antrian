# Dokumentasi Backend - Sistem Antrian Customer Service

## Daftar Isi
1. [Overview](#overview)
2. [Arsitektur Backend](#arsitektur-backend)
3. [Teknologi yang Digunakan](#teknologi-yang-digunakan)
4. [Cloud Functions](#cloud-functions)
5. [Database Structure](#database-structure)
6. [Security Rules](#security-rules)
7. [Deployment](#deployment)
8. [Testing & Development](#testing--development)

---

## Overview

Backend sistem antrian ini dibangun menggunakan **Firebase Cloud Functions** (Serverless) dan **Firestore** sebagai database realtime. Sistem ini menyediakan 3 fungsi utama:
- Generate nomor antrian baru
- Memanggil nomor antrian berikutnya (Admin)
- Reset antrian harian (Admin)

Semua operasi write ke database dilakukan melalui Cloud Functions untuk menjaga keamanan dan integritas data.

---

## Arsitektur Backend

```
┌─────────────────┐
│  Client Apps    │
│ (Web Frontend)  │
└────────┬────────┘
         │
         │ HTTP/HTTPS Calls
         │
┌────────▼────────────────────────┐
│   Firebase Cloud Functions      │
│  (Serverless Backend)           │
│                                 │
│  ┌──────────────────────────┐  │
│  │ generateTicket()         │  │
│  │ callNext()     (Admin)   │  │
│  │ resetQueue()   (Admin)   │  │
│  └──────────────────────────┘  │
└────────┬────────────────────────┘
         │
         │ Firestore SDK
         │
┌────────▼────────────────────────┐
│     Cloud Firestore             │
│  (NoSQL Realtime Database)      │
│                                 │
│  Collections:                   │
│  ├─ tickets/                    │
│  └─ system/                     │
└─────────────────────────────────┘
```

### Alur Data:
1. **Client** memanggil Cloud Function via HTTPS
2. **Cloud Function** memvalidasi request dan autentikasi
3. **Cloud Function** menulis/membaca data ke/dari Firestore
4. **Firestore** mengirim update realtime ke semua client yang listening

---

## Teknologi yang Digunakan

| Teknologi | Versi | Fungsi |
|-----------|-------|--------|
| Node.js | 24 | Runtime environment |
| Firebase Functions | ^7.0.0 | Serverless functions |
| Firebase Admin SDK | ^13.6.0 | Server-side Firebase SDK |
| Firestore | Latest | NoSQL realtime database |

---

## Cloud Functions

### 1. **generateTicket()**

**Tipe:** Callable Function  
**Region:** us-central1  
**Auth Required:** No  
**Admin Only:** No

#### Deskripsi:
Membuat nomor antrian baru untuk pelanggan.

#### Flow:
1. Mengambil `queueState` dari collection `system`
2. Menggunakan **transaction** untuk increment `currentNumber`
3. Membuat dokumen baru di collection `tickets`
4. Return `ticketNumber` dan `ticketId` ke client

#### Request:
```javascript
// Tidak ada parameter
const result = await generateTicket();
```

#### Response:
```javascript
{
  success: true,
  ticketNumber: 5,
  ticketId: "abc123xyz"
}
```

#### Error Handling:
- Jika terjadi error, throw exception dengan pesan error
- Semua error di-log menggunakan Firebase Logger

#### Code Snippet:
```javascript
exports.generateTicket = onCall(
  {region: "us-central1"},
  async (request) => {
    const db = admin.firestore();
    const queueRef = db.collection("system").doc("queueState");
    
    // Transaction untuk atomic increment
    const result = await db.runTransaction(async (transaction) => {
      const queueDoc = await transaction.get(queueRef);
      const newNumber = (queueDoc.data().currentNumber || 0) + 1;
      transaction.update(queueRef, {currentNumber: newNumber});
      return newNumber;
    });
    
    // Create ticket document
    const ticketDoc = await ticketsRef.add({
      ticketNumber: result,
      status: "waiting",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    return {success: true, ticketNumber: result, ticketId: ticketDoc.id};
  }
);
```

---

### 2. **callNext()**

**Tipe:** Callable Function  
**Region:** us-central1  
**Auth Required:** Yes  
**Admin Only:** Yes

#### Deskripsi:
Memanggil nomor antrian berikutnya dan mengelola status tiket otomatis (hanya admin yang bisa).

#### Autentikasi & Autorisasi:
1. Cek `request.auth` - user harus login
2. Cek email user di daftar `ADMIN_EMAILS`
3. Jika bukan admin, throw error "Admin only"

#### Flow:
1. Validasi autentikasi dan admin
2. Get `currentCalled` dari `system/queueState`
3. Set status `"done"` untuk ticket yang sebelumnya dipanggil
4. Query tickets dengan `status = "waiting"`, sort by `ticketNumber` ASC
5. Ambil ticket pertama (nomor terkecil)
6. **Auto-detect missed tickets**: Jika ada gap antara `currentCalled` dan `nextTicket`, set status `"missed"`
7. Update status ticket berikutnya menjadi `"called"`
8. Update `currentCalled` di `system/queueState`
9. Return informasi ticket yang dipanggil

#### Logika Status Otomatis:
```
DONE: Ticket sebelumnya yang dipanggil → status: "done"
MISSED: Ticket dengan nomor antara currentCalled dan nextTicket → status: "missed"
CALLED: Ticket yang sedang dipanggil → status: "called"
WAITING: Ticket yang belum dipanggil → status: "waiting"
```

#### Request:
```javascript
// Tidak ada parameter (auth otomatis dari Firebase)
const result = await callNext();
```

#### Response Success:
```javascript
{
  success: true,
  ticketNumber: 3,
  ticketId: "xyz789abc"
}
```

#### Response Empty Queue:
```javascript
{
  success: false,
  message: "Tidak ada antrian"
}
```

#### Error Cases:
- **Not authenticated:** "Harus login terlebih dahulu"
- **Not admin:** "Admin only - Email Anda tidak terdaftar sebagai admin"

#### Code Snippet:
```javascript
exports.callNext = onCall({region: "us-central1"}, async (request) => {
  // Auth check
  if (!request.auth) {
    throw new Error("Harus login terlebih dahulu");
  }
  
  // Admin check
  const userEmail = request.auth.token.email;
  if (!ADMIN_EMAILS.includes(userEmail)) {
    throw new Error("Admin only");
  }
  
  // Find next waiting ticket
  const waitingTickets = await ticketsRef
    .where("status", "==", "waiting")
    .orderBy("ticketNumber", "asc")
    .limit(1)
    .get();
  
  if (waitingTickets.empty) {
    return {success: false, message: "Tidak ada antrian"};
  }
  
  // Update to called
  const nextTicket = waitingTickets.docs[0];
  await nextTicket.ref.update({
    status: "called",
    calledAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  
  return {success: true, ticketNumber: nextTicket.data().ticketNumber};
});
```

---

### 3. **resetQueue()**

**Tipe:** Callable Function  
**Region:** us-central1  
**Auth Required:** Yes  
**Admin Only:** Yes

#### Deskripsi:
Mereset antrian harian dengan mengatur `currentNumber` kembali ke 0.

#### Autentikasi & Autorisasi:
- Sama seperti `callNext()` - hanya admin yang bisa akses

#### Flow:
1. Validasi autentikasi dan admin
2. Update dokumen `system/queueState`
3. Set `currentNumber = 0`
4. Set `lastReset` dengan server timestamp
5. Return success message

#### Request:
```javascript
// Tidak ada parameter
const result = await resetQueue();
```

#### Response:
```javascript
{
  success: true,
  message: "Antrian berhasil direset"
}
```

#### Error Cases:
- **Not authenticated:** "Harus login terlebih dahulu"
- **Not admin:** "Admin only - Email Anda tidak terdaftar sebagai admin"

#### Code Snippet:
```javascript
exports.resetQueue = onCall({region: "us-central1"}, async (request) => {
  // Auth & Admin check
  if (!request.auth) {
    throw new Error("Harus login terlebih dahulu");
  }
  
  const userEmail = request.auth.token.email;
  if (!ADMIN_EMAILS.includes(userEmail)) {
    throw new Error("Admin only");
  }
  
  // Reset queue state
  const queueRef = db.collection("system").doc("queueState");
  await queueRef.set({
    currentNumber: 0,
    lastReset: admin.firestore.FieldValue.serverTimestamp(),
  });
  
  return {success: true, message: "Antrian berhasil direset"};
});
```

---

## Database Structure

### Collection: `tickets`

Menyimpan semua nomor antrian yang diambil pelanggan.

#### Schema:
```javascript
{
  ticketNumber: Number,      // Nomor antrian (1, 2, 3, ...)
  status: String,            // "waiting" | "called" | "done" | "missed"
  createdAt: Timestamp,      // Waktu ticket dibuat
  calledAt: Timestamp,       // Waktu ticket dipanggil (optional)
  doneAt: Timestamp,         // Waktu ticket selesai dilayani (optional)
  missedAt: Timestamp        // Waktu ticket terlewat (optional)
}
```

#### Status Ticket:
1. **"waiting"** - Pelanggan sedang menunggu giliran
   - Set saat ticket pertama kali dibuat
   - Logika: `currentCalled < ticketNumber`

2. **"called"** - Nomor sedang dipanggil admin
   - Set oleh `callNext()` function
   - Logika: `currentCalled == ticketNumber`

3. **"done"** - Layanan selesai
   - Set otomatis oleh `callNext()` untuk ticket sebelumnya
   - Menandakan pelanggan sudah selesai dilayani

4. **"missed"** - Nomor terlewat
   - Set otomatis oleh `callNext()` jika ada gap
   - Logika: `currentCalled > ticketNumber AND status == "waiting"`
   - Contoh: Nomor 5 dipanggil, tapi nomor 3 & 4 masih waiting → 3 & 4 jadi "missed"

#### Contoh Data:
```javascript
// Document ID: "abc123xyz"
{
  ticketNumber: 5,
  status: "called",
  createdAt: Timestamp(2025-11-29 10:30:00),
  calledAt: Timestamp(2025-11-29 10:35:00)
}
```

#### Indexes:
- Composite index pada `status` (ASC) dan `ticketNumber` (ASC)
- Untuk query: `where("status", "==", "waiting").orderBy("ticketNumber")`

---

### Collection: `system`

Menyimpan state global sistem antrian.

#### Document: `queueState`

#### Schema:
```javascript
{
  currentNumber: Number,     // Nomor terakhir yang digenerate
  currentCalled: Number,     // Nomor yang sedang/terakhir dipanggil
  lastReset: Timestamp,      // Waktu terakhir reset
  lastCalledAt: Timestamp    // Waktu terakhir panggil nomor
}
  lastReset: Timestamp       // Waktu terakhir reset
}
```

#### Contoh Data:
```javascript
// Document ID: "queueState"
{
  currentNumber: 15,
  lastReset: Timestamp(2025-11-29 08:00:00)
}
```

---

## Security Rules

### Firestore Rules

File: `firestore.rules`

```plaintext
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Collection system - read untuk semua, write hanya admin
    match /system/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Collection tickets - read untuk semua, write HANYA via Cloud Functions
    match /tickets/{ticketId} {
      allow read: if true;
      allow write: if false;  // Tidak ada client yang bisa write langsung
    }
  }
}
```

### Penjelasan Security Model:

#### 1. **Collection `tickets`**
- **Read:** Public (semua orang bisa baca)
- **Write:** FORBIDDEN (false) - hanya Cloud Functions yang bisa write
- **Alasan:** Mencegah manipulasi data antrian oleh client

#### 2. **Collection `system`**
- **Read:** Public (untuk melihat currentNumber)
- **Write:** Authenticated users only
- **Alasan:** Data state sistem harus terlindungi, tapi admin perlu akses

#### 3. **Admin Authorization**
- Dilakukan di level Cloud Functions
- Menggunakan whitelist email di `ADMIN_EMAILS` array
- Admin check: `ADMIN_EMAILS.includes(userEmail)`

---

## Deployment

### Prerequisites:
1. Firebase CLI terinstall: `npm install -g firebase-tools`
2. Login Firebase: `firebase login`
3. Project sudah initialized: `firebase init`

### Deploy Commands:

#### Deploy semua:
```bash
firebase deploy
```

#### Deploy functions saja:
```bash
firebase deploy --only functions
```

#### Deploy firestore rules saja:
```bash
firebase deploy --only firestore:rules
```

#### Deploy firestore indexes saja:
```bash
firebase deploy --only firestore:indexes
```

### Deployment Checklist:
- [ ] Functions berhasil deploy
- [ ] Firestore rules sudah aktif
- [ ] Indexes sudah dibuat
- [ ] Test semua endpoints
- [ ] Cek logs untuk error

### Viewing Logs:
```bash
# Real-time logs
firebase functions:log

# Logs untuk function tertentu
firebase functions:log --only generateTicket
```

---

## Testing & Development

### Local Emulator

#### Start emulator:
```bash
cd backend/functions
firebase emulators:start
```

#### Emulator Ports:
- Functions: `http://localhost:5001`
- Firestore: `http://localhost:8080`
- Hosting: `http://localhost:5000`
- Emulator UI: `http://localhost:4000`

### Testing Functions Locally:

#### Test generateTicket:
```javascript
// Di Firebase emulator atau production
const functions = firebase.functions();
const generateTicket = functions.httpsCallable('generateTicket');

const result = await generateTicket();
console.log(result.data);
// { success: true, ticketNumber: 1, ticketId: "..." }
```

#### Test callNext (requires auth):
```javascript
// Login dulu sebagai admin
await firebase.auth().signInWithEmailAndPassword('admin@antrian.com', 'password');

const callNext = functions.httpsCallable('callNext');
const result = await callNext();
console.log(result.data);
// { success: true, ticketNumber: 1, ticketId: "..." }
```

#### Test resetQueue (requires auth):
```javascript
// Login dulu sebagai admin
const resetQueue = functions.httpsCallable('resetQueue');
const result = await resetQueue();
console.log(result.data);
// { success: true, message: "Antrian berhasil direset" }
```

---

## Configuration

### Admin Emails

Edit file `backend/functions/index.js`:

```javascript
const ADMIN_EMAILS = [
  "admin@antrian.com",
  "admin2@antrian.com",  // Tambahkan admin baru di sini
];
```

### Function Region

Default region: `us-central1`

Untuk mengubah region:
```javascript
exports.generateTicket = onCall(
  {region: "asia-southeast2"},  // Ubah region
  async (request) => { ... }
);
```

---

## Error Handling

### Error Response Format:

Semua Cloud Functions menggunakan format error yang konsisten:

```javascript
{
  error: {
    message: "Deskripsi error",
    code: "permission-denied" | "unauthenticated" | "internal"
  }
}
```

### Common Errors:

| Error | Cause | Solution |
|-------|-------|----------|
| "Harus login terlebih dahulu" | User belum login | Panggil `firebase.auth().signInWithEmailAndPassword()` |
| "Admin only" | User bukan admin | Tambahkan email ke `ADMIN_EMAILS` |
| "Tidak ada antrian" | Queue kosong | Normal behavior, tidak ada yang menunggu |
| "Gagal generate ticket" | Database error | Check Firestore connection |

---

## Best Practices

### 1. **Transaction untuk Atomic Operations**
```javascript
// GOOD - menggunakan transaction
const result = await db.runTransaction(async (transaction) => {
  const doc = await transaction.get(ref);
  transaction.update(ref, {count: doc.data().count + 1});
});

// BAD - race condition
const doc = await ref.get();
await ref.update({count: doc.data().count + 1});
```

### 2. **Server Timestamp**
```javascript
// GOOD - menggunakan server timestamp
createdAt: admin.firestore.FieldValue.serverTimestamp()

// BAD - menggunakan client timestamp
createdAt: new Date()
```

### 3. **Logging**
```javascript
// GOOD - structured logging
logger.info("Ticket generated", {ticketId, ticketNumber, user});

// BAD - console.log
console.log("Ticket generated");
```

### 4. **Error Messages**
```javascript
// GOOD - informative error
throw new Error("Admin only - Email Anda tidak terdaftar sebagai admin");

// BAD - generic error
throw new Error("Access denied");
```

---

## API Reference

### Function Endpoints (Production):

```
https://us-central1-[PROJECT-ID].cloudfunctions.net/generateTicket
https://us-central1-[PROJECT-ID].cloudfunctions.net/callNext
https://us-central1-[PROJECT-ID].cloudfunctions.net/resetQueue
```

### Calling from JavaScript:

```javascript
// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const functions = firebase.functions(app);

// Call functions
const generateTicket = functions.httpsCallable('generateTicket');
const callNext = functions.httpsCallable('callNext');
const resetQueue = functions.httpsCallable('resetQueue');

// Execute
try {
  const result = await generateTicket();
  console.log(result.data);
} catch (error) {
  console.error(error.message);
}
```

---

## Troubleshooting

### Problem: "CORS Error"
**Solution:** Firebase Functions otomatis handle CORS untuk callable functions.

### Problem: "Permission Denied"
**Solution:** 
1. Check Firestore rules
2. Verify authentication token
3. Check admin email list

### Problem: "Index Required"
**Solution:** 
1. Check console error untuk index URL
2. Create index via Firebase Console
3. Atau deploy `firestore.indexes.json`

### Problem: "Function Timeout"
**Solution:**
1. Check function logs: `firebase functions:log`
2. Optimize database queries
3. Add indexes untuk composite queries

---

## Monitoring & Logging

### Firebase Console:
- **Functions:** Monitor invocations, errors, execution time
- **Firestore:** Monitor reads/writes, storage usage
- **Authentication:** Monitor sign-ins, active users

### Log Levels:
```javascript
logger.debug("Debug info");
logger.info("General info");
logger.warn("Warning");
logger.error("Error occurred");
```

---

## License & Credits

- **Firebase Functions:** Google LLC
- **Node.js:** OpenJS Foundation
- **Project:** Tugas Cloud Computing TIF1344

---

**Last Updated:** November 29, 2025  
**Version:** 1.0.0  
**Maintainer:** TIF1344 Team

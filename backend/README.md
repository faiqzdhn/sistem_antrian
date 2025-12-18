# Backend Functions - OPSIONAL

Backend functions sudah tidak diperlukan karena frontend langsung berkomunikasi dengan Firestore.

## Jika Anda tetap ingin menggunakan Cloud Functions:

### Setup
```bash
cd backend
npm install
```

### Deploy
```bash
firebase deploy --only functions
```

### Functions yang tersedia (dari index.js):

1. **createTicket** - HTTP function untuk membuat tiket baru
2. **getNextTicket** - HTTP function untuk memanggil nomor berikutnya
3. **resetQueue** - HTTP function untuk reset antrian

## Catatan

Frontend saat ini sudah langsung terhubung ke Firestore untuk performa realtime yang lebih baik.
Cloud Functions bisa digunakan jika Anda ingin menambahkan validasi tambahan atau logic bisnis yang kompleks.

## Struktur Collections

### tickets
```
{
  ticketNumber: Number,
  status: "waiting" | "called" | "done" | "missed",
  createdAt: Timestamp
}
```

### queue
```
{
  currentNumber: Number
}
```

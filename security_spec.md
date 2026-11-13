# Security Specification — GuruMapel LMS Firestore

## 1. Data Invariants
1. **Default Deny**: Semua path yang tidak didefinisikan eksplisit ditolak (`allow read, write: if false`).
2. **Email Verified Required**: Seluruh operasi tulis standar mensyaratkan `request.auth != null && request.auth.token.email_verified == true`.
3. **Admin / Guru Authority**: Hanya admin terverifikasi (`robisaiful@gmail.com` atau terdaftar di `/admins/{uid}`) yang dapat membuat/mengubah/menghapus kelas, bahan ajar, tugas, presensi, pengaturan guru, soal AI, dan memberi nilai (`score`, `note`).
4. **PII Isolation**: Nomor WhatsApp siswa disimpan pada subkoleksi terisolasi `/students/{studentId}/private/contact` dan hanya dapat dibaca/diubah oleh admin atau siswa pemilik (`studentUid == request.auth.uid`).
5. **Submission Ownership & Score Lock**: Siswa hanya bisa membuat dan membaca pengumpulan miliknya sendiri (`studentUid == request.auth.uid`), harus mereferensikan tugas yang benar-benar ada (`exists(/databases/.../tasks/$(taskId))`), dan tidak bisa mengisi atau memodifikasi nilai (`score`, `note`).
6. **Temporal Integrity & Immutability**: `createdAt == request.time` saat `create`, `updatedAt == request.time` saat `update`, dan field kunci (`ownerUid`, `createdAt`, `studentUid`, `taskId`) tidak dapat dimutasi.

## 2. The "Dirty Dozen" Attack Payloads
1. **Unauthenticated Read**: `get /classes/c1` dengan `auth = null` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: `create /submissions/sub1` dengan `email_verified = false` -> `PERMISSION_DENIED`.
3. **Privilege Escalation (Self-Admin)**: Siswa mencoba `create /admins/{uid}` -> `PERMISSION_DENIED`.
4. **Email Spoofing**: Pengguna mengirim email admin dengan `email_verified: false` -> `PERMISSION_DENIED`.
5. **PII Cross-Student Read**: Siswa A mencoba `get /students/s2/private/contact` milik Siswa B -> `PERMISSION_DENIED`.
6. **Shadow Field Injection**: Siswa mengirim `create /submissions/sub1` dengan field tambahan `isAdmin: true` atau `score: 100` -> `PERMISSION_DENIED`.
7. **Self-Grading Update**: Siswa mencoba `update /submissions/sub1` mengubah `score: 100` -> `PERMISSION_DENIED`.
8. **Orphaned Submission**: Siswa mengirim `create /submissions/sub1` dengan `taskId: "nonexistent"` -> `PERMISSION_DENIED`.
9. **ID Poisoning**: Operasi `get /tasks/<1500 char string>` -> `PERMISSION_DENIED`.
10. **Payload Poisoning (Oversized String)**: Mengirim `workText` melebihi 20.000 karakter -> `PERMISSION_DENIED`.
11. **Timestamp Forgery**: Mengirim `createdAt` manual di masa lalu/depan selain `request.time` -> `PERMISSION_DENIED`.
12. **Question Key Leakage**: Siswa mencoba membaca `/questionSets/{setId}` yang berisi kunci jawaban AI -> `PERMISSION_DENIED`.

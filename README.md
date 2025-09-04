# 📌 POA System (Pengajuan & Approval)

Sistem ini dibangun menggunakan **Next.js**, **Firebase Authentication**, dan **Firestore** untuk manajemen pengajuan dan approval sesuai alur perusahaan.

## 🚀 Fitur Utama

* **Authentication**

  * Register & Login menggunakan email & password
  * Role-based access: `staff`, `manager`, `gm`, `hrd`, `finance`, `admin`
* **Manajemen User**

  * Admin, HRD, dan GM dapat mengelola user
  * Assign user ke **departemen** tertentu
* **Manajemen Departemen**

  * Setiap departemen memiliki `manager`
  * Relasi `staff -> manager -> GM` untuk approval
* **Workflow Approval**

  * **Lembur (OT)** → Staff → Manager → GM → HRD
  * **Reimburse** → Staff → Manager → GM → Finance
  * **Broadcast** otomatis ke departemen terkait setelah disetujui GM
* **Pengajuan**

  * Staff dapat membuat form pengajuan (OT, reimburse, dll)
  * Support **multiple employees** via checkbox (bulk selection)
  * Validasi jam lembur, duplikasi karyawan, dll
* **Dashboard**

  * Staff → Lihat status pengajuan
  * Manager → Approve/Reject pengajuan staff dalam 1 departemen
  * GM → Approve/Reject semua departemen
  * HRD/Finance → Final approval sesuai jenis pengajuan
* **Security**

  * Firebase Authentication
  * Firestore rules berbasis role & dept

---

## 🏗️ Struktur Project

```
/poa-system
│── /app
│   ├── /dashboard
│   ├── /admin
│   │   ├── /users        → Manajemen User
│   │   └── /departments  → Manajemen Departemen
│   └── /auth
│       ├── login.tsx
│       └── register.tsx
│
│── /components
│   ├── Card.tsx
│   └── Navbar.tsx
│
│── /lib
│   └── firebase.ts       → Inisialisasi Firebase
│
│── README.md
```

---

## 🔑 Role & Akses

| Role        | Akses                                         |
| ----------- | --------------------------------------------- |
| **Admin**   | Full access (users, departments, approval)    |
| **Staff**   | Membuat pengajuan OT/Reimburse                |
| **Manager** | Approve pengajuan staff di dept masing-masing |
| **GM**      | Approve semua pengajuan setelah manager       |
| **HRD**     | Final approval untuk OT                       |
| **Finance** | Final approval untuk Reimburse                |

---

## 📂 Firestore Collections

### Users (`users`)

```json
{
  "uid": "xxx",
  "nik": "12345",
  "email": "user@mail.com",
  "nama": "John Doe",
  "dept": "it",
  "jabatan": "Staff",
  "role": "staff",
  "createdAt": "2025-09-02T11:38:21Z"
}
```

### Departments (`departments`)

```json
{
  "id": "it",
  "name": "IT",
  "managerId": "abc123",
  "managerNIK": "56789",
  "managerName": "Jane Manager",
  "createdAt": "2025-09-02T11:38:21Z"
}
```

### Pengajuan (`requests`)

```json
{
  "id": "req001",
  "type": "overtime", // or "reimburse"
  "employees": [{ "id": "uid123", "nama": "John Doe", "nik": "12345" }],
  "tanggal": "2025-09-02",
  "jamMulai": "18:00",
  "jamSelesai": "20:00",
  "totalJam": 2,
  "dept": "it",
  "status": "pending",
  "approvalFlow": [
    { "role": "manager", "status": "pending" },
    { "role": "gm", "status": "pending" },
    { "role": "hrd", "status": "pending" }
  ]
}
```

---

## ⚡ Instalasi

1. Clone repository

   ```bash
   git clone https://github.com/username/poa-system.git
   cd poa-system
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Setup Firebase

   * Buat project di [Firebase Console](https://console.firebase.google.com)
   * Enable Authentication (Email/Password)
   * Enable Firestore Database
   * Copy config ke `lib/firebase.ts`

4. Jalankan project

   ```bash
   npm run dev
   ```

---

## 📌 TODO / Next Steps

* [ ] Tambah notifikasi email / WhatsApp untuk approval
* [ ] Export laporan (Excel/PDF)
* [ ] Dashboard statistik lembur & reimburse
* [ ] Mobile-friendly UI

---

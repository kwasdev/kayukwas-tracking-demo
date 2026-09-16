# kayukwas-tracking-demo

Sistem Informasi Manajemen Produksi & Pelacakan SPK Berbasis WhatsApp untuk Industri Kayu (Kitchenware).

## Arsitektur Teknologi
- **Backend**: Go (Fiber v2 + GORM + SQLite / PostgreSQL) di folder `backend/`
- **Frontend**: Next.js 15+ (TypeScript + Tailwind CSS + Lucide Icons) di folder `frontend/`

---

## Panduan Menjalankan Sistem

### 1. Menjalankan Backend (Go Fiber)
```bash
cd backend
go run cmd/server/main.go
```
* API Server berjalan di `http://localhost:8080`
* Akun Superuser default otomatis di-seed:
  - **Email**: `admin@kayukwas.co.id`
  - **Kata Sandi**: `AdminKWAS2026!`

Untuk menjalankan unit & feature test:
```bash
cd backend
go test -v ./...
```

### 2. Menjalankan Frontend (Next.js)
```bash
cd frontend
npm run dev
```
* Akses aplikasi di `http://localhost:3000`
* Halaman Aktivasi Mandiri: `http://localhost:3000/aktivasi`
* Halaman Login: `http://localhost:3000/login`
* Halaman Dashboard: `http://localhost:3000/dashboard`

---

## Dokumentasi Konsep
- [Panduan Sistem Hak Akses, Database RBAC & Aktivasi Pengguna (Aturan Utama)](docs/konsep-sistem-manajemen-akun.md)
- [Blueprint & Dokumen Konsep Sistem Manajemen Produksi](docs/konsep-sistem-manajemen-produksi.md)
- [Konsep Agentic AI Parsing Laporan Produksi](docs/konsep-agentic-parsing-laporan.md)
- [Panduan Integrasi OpenWA Gateway](docs/archive/openwa.md)
- [Referensi OpenWA Webhook Signature](docs/archive/openwa-webhook.md)

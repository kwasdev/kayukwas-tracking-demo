# Konsep Agentic AI untuk Parsing & Validasi Laporan Produksi
## Studi Kasus: Industri Kayu Kitchenware (Kayu KWAS)

---

## 1. Latar Belakang & Urgensi Sistem Agentic

### 1.1 Kesenjangan Antara Format Kaku vs Realita Lapangan
Pada sistem konvensional, bot WhatsApp umumnya menuntut sintaks yang sangat kaku, misalnya:
`LAPOR SPK-0012 195 5 Kayu retak di mata`

Namun pada kenyataannya di bengkel kayu (*workshop*) dan pengrajin mitra:
- **Kondisi Fisik Lapangan**: Tangan operator sering kotor terkena serbuk kayu (*sawdust*), lem kayu (*crosslink PVA*), atau minyak pelapis (*beeswax/mineral oil*), sehingga mereka enggan mengetik format teks panjang atau kaku.
- **Bahasa Alami & Dialek Lokal**: Laporan sering dikirimkan dengan bahasa sehari-hari, singkatan tidak baku, atau bahasa daerah (Jawa/campuran istilah tukang), misalnya:
  > *"mas spk 0012 talenan jati wes tak serut kabeh 195 iji, sing 5 ajur pecah serat. sesuk esuk tak kirim nyang pabrik yo"*
- **Format Multi-Moda (Voice Note & Foto)**: Banyak operator dan mitra lebih suka mengirimkan **Pesan Suara (Voice Note)** berdurasi 10–20 detik atau memotret **papan kapur / kertas corat-coret tally count** di samping mesin bubut/meja amplas.

### 1.2 Peran Agentic AI (Bukan Sekadar Chatbot Pasif)
Sistem **Agentic AI** hadir sebagai agen cerdas aktif yang:
1. **Memahami Konteks & Multi-Moda**: Mampu memproses teks informal, pesan suara (Audio STT), dan foto lembar kerja fisik/foto cacat kayu (Vision).
2. **Memiliki Akses Alat (Tool Calling / Function Calling)**: Agen dapat mengecek ke database: *"Siapa yang sedang mengirim pesan ini? SPK apa saja yang sedang aktif di stasiunnya? Apakah jumlah yang dilaporkan masuk akal?"*
3. **Mampu Melakukan Klarifikasi Mandiri (Disambiguation Loop)**: Jika informasi kurang lengkap atau ambigu, agen tidak langsung *error*, melainkan menanyakan kembali poin yang kurang secara ramah dan terarah.
4. **Mencegah Halusinasi dengan Guardrails**: Agen dilarang mengarang data angka; agen selalu meminta konfirmasi akhir (*Human-in-the-Loop*) sebelum benar-benar memicu mutasi data (*commit*) ke database produksi.

### 1.3 Prinsip Nomenklatur Acuan Kerja: SPK untuk Manusia, Work Order (WO) untuk Sistem
Sistem memisahkan secara tegas antara istilah yang dipakai orang lapangan dengan istilah yang dipakai arsitektur sistem:
- **Ke Manusia (Operator, Mitra, Mandor, Supir, QC)**: Selalu menggunakan sebutan **SPK (Surat Perintah Kerja)** atau **No. SPK** (misalnya: *SPK-0012*). Orang lapangan tidak pernah dibebani istilah "Work Order" atau singkatan "WO".
- **Di Dalam Sistem (Database & Backend API)**: Entitas acuan kerja dikelola sebagai **Work Order (WO)** dengan tabel `work_orders`, kolom `work_order_id`, dan kode identifikasi `wo_2026_...`.
- Agen AI bertindak sebagai penerjemah dua arah: mengenali referensi "SPK" dalam pesan teks manusia, mengaitkannya ke record `work_orders` di database, dan membalas kembali menggunakan bahasa "SPK".

---

## 2. Arsitektur Alur Kerja Agentic Parser

```
                     [Operator / Mitra Produksi]
                     (Kirim Teks Santai / Voice Note / Foto)
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                WHATSAPP GATEWAY (OpenWA)                    │
 │ - Terima Pesan & Validasi Sender Whitelist                  │
 └──────────────────────────────┬──────────────────────────────┘
                                │ Webhook Payload
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                  AGENTIC PARSER ORCHESTRATOR                │
 │                                                             │
 │ 1. INGESTION & PERCEPTION                                   │
 │    - Teks: Pembersihan teks mentah                          │
 │    - Audio: Whisper Speech-to-Text Transcribe               │
 │    - Gambar: Vision Model (OCR Tally Sheet / Deteksi Cacat) │
 │                                                             │
 │ 2. CONTEXT RETRIEVAL (Tools Integration)                    │
 │    - Query data pengguna berdasarkan no. WhatsApp           │
 │    - Tarik daftar SPK aktif yang ditugaskan ke pengguna     │
 │                                                             │
 │ 3. REASONING & EXTRACTION ENGINE                            │
 │    - Ekstraksi entitas (SPK_ID, Qty OK, Qty Reject, Cacat)  │
 │    - Validasi batas logika kuantitas                        │
 │                                                             │
 │ 4. DECISION GATEWAY                                         │
 │    ├─► Data Lengkap & Valid? ──► Tampilkan Konfirmasi Ringkas│
 │    ├─► Data Ambigu?         ──► Tanya Balik (Klarifikasi)   │
 │    └─► Ada Cacat Kritis?    ──► Escalation Alert ke Mandor  │
 └──────────────────────────────┬──────────────────────────────┘
                                │ Commit Log Valid
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │             CORE PRODUCTION DATABASE (PostgreSQL)           │
 │ - Insert into production_logs & work_order_stations         │
 └─────────────────────────────────────────────────────────────┘
```

---

## 3. Toolset & Kemampuan Agen (Function Calling Definitions)

Agen AI dilengkapi serangkaian *Tools* (fungsi API internal) yang dapat dipanggil secara otonom saat memproses laporan:

| Nama Tool | Parameter Masukan | Fungsi / Deskripsi |
|:---|:---|:---|
| `get_user_active_assignments` | `phone_number` | Memverifikasi apakah nomor terdaftar di tabel `users` dengan `status == 'ACTIVE'`, `is_active == true`, dan `whatsapp_verified_at IS NOT NULL`. Mengambil profil, daftar peran dari tabel pivot `user_roles`, daftar SPK aktif di `work_order_stations`, serta **matriks penugasan produk yang dibatasi stasiun/proses** dari tabel `mitra_product_station_assignments`. |
| `resolve_mitra_product_context` | `mitra_user_id`, `raw_text` | Memanfaatkan pemetaan produk dan stasiun mitra untuk menyaring kemungkinan SKU dan stasiun kerja sekaligus (misal: jika Pak Baryadi melapor "telenan gagang", agen otomatis mengunci SKU `TLN-GGNG` dan Stasiun 1 Wood Working karena penugasannya memang dibatasi pada stasiun tersebut). |

| `fuzzy_resolve_spk` | `user_id`, `keyword` (misal: "talenan", "0012", "jati") | Mencocokkan kata kunci informal pengguna dengan nomor SPK resmi di database yang diprioritaskan pada produk spesialisasi mitra. |
| `validate_quantity_rules` | `work_order_station_id`, `reported_qty` | Mengecek apakah kuantitas yang dilaporkan wajar (tidak melebihi target bahan baku dan tidak bernilai negatif). |
| `lookup_wood_defect_category`| `defect_text` | Memetakan istilah cacat lokal tukang (misal: "tugel", "muntir", "gompal") ke kategori cacat standar QC pabrik. |
| `submit_verified_production_log`| `work_order_station_id`, `pass_qty`, `reject_qty`, `defect_id`, `notes` | Menyimpan hasil laporan resmi setelah dikonfirmasi oleh pengguna ke tabel `production_logs`. |
| `trigger_mandor_escalation` | `spk_id`, `reason`, `severity` | Mengirim notifikasi darurat ke mandor jika persentase reject > 10% atau terjadi keterlambatan fatal. |



---

## 4. Kamus Bahasa & Domain Khusus Kayu Kitchenware (Woodworking Lexicon)

Agar agen memahami istilah lokal tukang dan pengrajin mitra, agen dibekali *domain dictionary*:

### 4.1 Istilah Pengerjaan & Mesin (Operations)
* **Pasah / Serut / Ketam**: *Planer / Jointer* (Stasiun 1 - Wood Working).
* **Graji / Belah / Potong**: *Ripsaw / Crosscut* (Stasiun 1).
* **Bubut**: Pembubutan kayu bulat seperti mangkuk, piring bulat, gagang spatula (Stasiun 1).
* **Tatah / Bobok / Router**: Pembuatan cekungan piring/coakan nampan saji (Stasiun 1).
* **Amplas Halus / Kasar**: *Sanding* bertingkat (Grit 80–240) (Stasiun 2 - Pasca Wood Working).
* **Dempul / Menambal**: Aplikasi *wood filler* pada pori alami yang diperbolehkan (Stasiun 2).
* **Nyirami / Celup / Oiling**: Aplikasi *Food-grade Mineral Oil / Beeswax* (Stasiun 3 - Finishing).
* **Buffing / Lap Residu**: Pembersihan minyak berlebih pasca pengeringan (Stasiun 4 - Pasca Finishing).

### 4.2 Istilah Cacat Kayu (Defect Taxonomy Mapping)

| Istilah Bahasa Tukang / Mitra | Istilah Teknis QC | Kategori Tindakan |
|:---|:---|:---|
| *Tugel, Pecah serat, Retak rambut* | Crack / Split Along Grain | **Reject (Scrap) atau Down-size** |
| *Muntir, Nglinting, Bengkok* | Warping / Twisting (Kadar air tinggi) | **Rework (Oven ulang/Planer)** |
| *Mata mati, Bolong mata kayu* | Loose Knot Hole | **Reject jika produk kontak makanan** |
| *Gompal, Cuil, Somplak* | Chipped Edge (Akibat pisau bubut/serut tumpul) | **Rework (Amplas ulang / Chamfer)** |
| *Mlocot, Belang, Minyak ora rata* | Uneven Oil Penetration / Blotching | **Rework (Lap kering & re-coating)** |
| *Jamuren, Lembab* | Blue Stain / Surface Mold | **Reject Kritis (Pelanggaran Higienitas)** |

---

## 5. Pola Skenario Dialog Interaktif (Conversational Patterns)

### Skenario 1: Laporan Teks Santai (Data Lengkap)
* **Pesan Operator (Tukang)**:
  > *"Pak mandor, SPK 0012 talenan jati sampun rampung 190 iji. Sing 10 pecah serat pas diserut."*
* **Proses Internal Agen**:
  1. Identifikasi pengirim via no. WA: *Pak Joko (Stasiun 1 - Wood Working)*.
  2. `fuzzy_resolve_spk("0012")` ──► `SPK-2026-09-0012` (Target: 200 pcs).
  3. Ekstraksi: `Pass = 190`, `Reject = 10`, `Alasan = Pecah serat`.
  4. `validate_quantity_rules(190 + 10 = 200)` ──► Valid!
* **Balasan Agen (Meminta Konfirmasi Cepat)**:
  > *"Halo Pak Joko, saya bantu catat laporan produksi:*  
  > [SPK]: **SPK-2026-09-0012 (Talenan Jati)**  
  > [Stasiun]: **1. Wood Working**  
  > [Bagus (Pass)]: **190 pcs**  
  > [Cacat (Reject)]: **10 pcs (Pecah Serat)**  
  >  
  > *Apakah data ini sudah benar?*  
  > Balas **YA** untuk simpan, atau balas koreksi jika salah."*
* **Pesan Operator**: *"Ya bener"*
* **Respon Agen**:
  > *"[BERHASIL DISIMPAN] Data telah diteruskan ke QC & Mandor untuk persiapan lanjut ke Stasiun 2 (Pasca Wood Working)."*

---

### Skenario 2: Laporan Ambigu (Multi-SPK Aktif)
* **Pesan Mitra**:
  > *"Mas hari ini selesai 50 pcs ya barangnya siap diambil"*
* **Proses Internal Agen**:
  1. Cek SPK aktif untuk nomor mitra tersebut.
  2. Ditemukan 2 SPK aktif:
     - `SPK-0014`: Mangkuk Mahoni 15cm (Sisa 80 pcs)
     - `SPK-0016`: Sendok Garpu Kayu Akasia (Sisa 120 pcs)
  3. Agen mendeteksi ambiguitas kuantitas dan jenis barang.
* **Balasan Klarifikasi Agen**:
  > *"Terima kasih laporannya, Pak Budi. Saat ini ada 2 pekerjaan aktif di bengkel Bapak:*  
  > 1. *Mangkuk Mahoni (SPK-0014)*  
  > 2. *Sendok Garpu Akasia (SPK-0016)*  
  >  
  > *Laporan 50 pcs ini untuk produk yang mana? (Balas angka 1 atau 2)."*
* **Pesan Mitra**: *"Nomor 1 mas mangkok"*
* **Proses Agen**: Mengunci ke `SPK-0014`, menghitung sisa target, dan meminta konfirmasi final.

---

### Skenario 3: Laporan Berbasis Voice Note (Pesan Suara)
* **Pesan Operator**: *(Mengirim Voice Note 12 detik)*  
  *(Transkripsi Whisper AI internal)*: *"Halo admin, piring jati yang pesenan 100 biji udah tak amplas halus semua grit 240, barang mulus gak ada yang rusak mas."*
* **Proses Internal Agen**:
  1. Mengubah audio menjadi teks mentah dengan Whisper.
  2. Mengekstrak: Item = Piring Jati, Stasiun = Stasiun 2 (Amplas), Qty Pass = 100, Reject = 0.
  3. Menampilkan ringkasan teks terstruktur ke WhatsApp operator untuk validasi sebelum disimpan.

---

### Skenario 4: Foto Papan Tally / Catatan Kapur (Vision Extraction)
* **Pesan Operator**: *(Mengirim foto papan kayu kecil tempat ia membuat coretan garis lidi lima-lima (tally count) dengan kapur tulis bertuliskan "SPK 15 - IIII IIII IIII...")*
* **Proses Internal Agen**:
  1. Model Vision mendeteksi teks "SPK 15" dan menghitung jumlah turus/tally.
  2. Mengidentifikasi angka terhitung: misal 75 buah.
  3. Membalas operator:
     > *"[DETEKSI FOTO CATATAN]*  
     > *SPK:* **SPK-0015**  
     > *Jumlah terhitung:* **75 pcs**  
     > *Apakah angka ini sesuai dengan fisik yang selesai hari ini? (Balas YA / koreksi angka)."*

---

### Skenario 5: Peringatan Ambang Batas Cacat (Escalation Trigger)
* **Kondisi**: Operator melapor 150 selesai, namun 35 buah cacat karena kayu melengkung (*warp*).
* **Tindakan Agen**:
  1. Agen menghitung tingkat cacat: $\frac{35}{185} \approx 18.9\%$ (Melebihi ambang batas toleransi pabrik yaitu 5%).
  2. Agen menyimpan status log dengan bendera `WARNING_HIGH_DEFECT`.
  3. **Tindakan Proaktif**: Agen secara instan menembakkan pesan WhatsApp alert ke Mandor dan QC Inspector:
     > *"[PERINGATAN QC STASIUN 1]*  
     > *SPK:* **SPK-0012 (Talenan Jati)**  
     > *Operator:* Pak Joko  
     > *Tingkat Cacat:* **18.9% (35 pcs)**  
     > *Penyebab:* Kayu melengkung / kadar air tinggi  
     > *Tindakan Diperlukan:* Mandor harap periksa stok bahan baku oven sekarang!"*

---

### Skenario 6: Logistik Keluar & Masuk Mitra (Pembedaan Posisi Kendaraan vs Aksi Produk)

Dalam operasional harian industri kitchenware kayu, sistem membedakan secara tegas dua dimensi logistik:
1. **Posisi Kendaraan (`keluar` atau `masuk`)**: Status armada mobil (L300) melewati pos gerbang pabrik (*Gate Out / Gate In*).
2. **Aksi Produk (`kirim` atau `ambil`)**: Status pergerakan barang (KIRIM bahan ke mitra, atau AMBIL hasil olahan dari mitra).

```
                      DUA DIMENSI LOGISTIK LAPANGAN
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        ▼                                                       ▼
 [DIMENSI KENDARAAN: KELUAR / MASUK]           [DIMENSI PRODUK: AMBIL / KIRIM]
 - Mencatat posisi armada di gerbang           - Mencatat tindakan terhadap barang
 - Ket: KELUAR (Mobil berangkat dari pabrik)   - Aksi: AMBIL (Jemput produk dari mitra)
 - Ket: MASUK  (Mobil tiba kembali di pabrik)  - Aksi: KIRIM (Antar bahan baku ke mitra)
```

```
 [Supir / Admin Lapangan]
   Ketik pesan cepat (Pesan Hijau):
   "ambil pak baryadi REVISI TOTAL ... REVISI JAMUR ..."
                 │
                 ▼
 ┌─────────────────────────────────────────────────────────────┐
 │               AGENTIC LOGISTICS PARSER                      │
 │ 1. Deteksi Aksi Produk: "ambil" (Jemput Hasil Kerja Mitra)  │
 │ 2. Deteksi Kendaraan: L300 (8623) Kelik/Ridvan/QC Anto      │
 │ 3. Resolusi Entitas Mitra: "pak baryadi" ──► MITRA-BARYADI  │
 │ 4. Koreksi Typo Produk:                                     │
 │    - "tekenan gagang" ──► Auto-correct: "Telenan Gagang"    │
 │    - "telenan jepang" ──► SKU: TLN-JPN                      │
 │ 5. Segmentasi Status Produk:                                │
 │    - REVISI TOTAL (Total Fisik yang Diambil: 368 pcs)       │
 │    - REVISI JAMUR (Defect Jamur untuk Oven Pabrik: 148 pcs) │
 └─────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
 [Output Terstruktur ke Grup Logistik / Arsip Surat Jalan]
   Menghasilkan template resmi "Pesan Kaku" & Simpan ke DB:
   "Data Keluar dan Masuk Barang --- Ket: keluar (Kendaraan Berangkat Jemput)"
```

#### A. Contoh Masukan Pesan Cepat Lapangan ("Pesan Hijau")
Ketika supir dan QC menjemput barang di bengkel mitra:
```text
ambil pak baryadi

REVISI TOTAL

1.Telenan oval kecil 368 pcs
2.Telenan oval besar 25 pcs
3.Telenan jepang 3 pcs
4.Telenan gagang 25 pcs

REVISI JAMUR

1.Telenan oval kecil 148 pcs
2.Telenan oval besar 7 pcs
```

#### B. Kemampuan Koreksi Cerdas & Integrasi Dua Dimensi:
1. **Pemisahan Dimensi Kendaraan dan Produk**:
   - Agen AI memetakan bahwa pesan `ambil pak baryadi` mencatat aksi produk **AMBIL**, sementara posisi kendaraan dicatat sesuai posisinya di gerbang pabrik (`Ket: keluar` saat berangkat jemput, `Ket: masuk` saat armada tiba kembali membawa muatan).
2. **Pembersihan Typo Lapangan (*Smart Fuzzy Match*)**:
   - Teks `"tekenan gagang"` secara cerdas dipetakan oleh agen ke nama barang kanonikal **"Telenan Gagang"**.
   - Variasi penulisan nama mitra `"pak baryadi"` dan `"pak varyadi"` dinormalisasi ke entitas Mitra tunggal yang sama: **Pak Baryadi**.
3. **Pemanfaatan Matriks Spesialisasi Produk Mitra**:
   - Agen AI mencocokkan profil Pak Baryadi di tabel `mitra_product_station_assignments`. Karena terdaftar spesialis Lini Talenan, sistem memiliki keyakinan 0.98 bahwa `"tekenan gagang"` adalah SKU **Telenan Gagang**.
4. **Integrasi Hasil Pemilahan QC (Revisi Jamur)**:
   - Agen membedah: dari total 368 pcs yang diambil, **220 pcs lolos** langsung lanjut ke Stasiun Finishing, dan **148 pcs berjamur** dialihkan ke antrean oven pengering in-house.
5. **Konversi Menjadi "Pesan Kaku" Resmi**:
   Agen menghasilkan format pesan kaku terstandarisasi untuk di-broadcast ke grup WhatsApp Logistik:
```text
Data Keluar dan Masuk Barang

---Hari/tanggal---
Hari.      : Sabtu
Tanggal    : 01 - 08 - 2026
Jam.       : 09.45
Ket.       : keluar
Supir.     : kelik
Helper.    : ridvan
Kend.      : L300
Plat No.   : 8623

Mengetahui : Mandor Logistik

---Asal/Tujuan----

Mitra.  : pak baryadi
Barang.    : telenan oval besar
Jumlah.    : 25 pcs

Mitra.  : pak baryadi
Barang.    : telenan oval kecil
Jumlah.    : 368 pcs

Mitra.  : pak baryadi
Barang.    : telenan jepang
Jumlah.    : 3 pcs

Mitra.  : pak baryadi
Barang.    : telenan gagang
Jumlah.    : 25 pcs

--------------------
Revisi jamur
--------------------
Mitra   : pak baryadi
Barang.    : telenan oval kecil
Jumlah.    : 148 pcs
Barang.    : telenan oval besar
Jumlah.    : 7 pcs
```

#### C. Penanganan Dua Arah (Bidirectional Parsing)
- **Arah 1 (Pesan Hijau ──► Pesan Kaku & DB)**: Agen mengubah teks cepat dari mandor/admin menjadi Surat Jalan terstruktur.
- **Arah 2 (Pesan Kaku ──► Database Auto-Record)**: Jika ada personil gudang atau supir yang meneruskan (*forward*) pesan kaku tersebut ke nomor bot, agen langsung mengenali struktur blok teks tersebut dan memasukkannya ke tabel `mitra_shipments` tanpa perlu input ulang manual di komputer.

---

### Skenario 7: Parsing Laporan QC di Mitra (Standar Tugas Sama: Datang Sendiri atau Bersama Supir)

Tugas dan tanggung jawab QC di bengkel mitra **tidak dibeda-bedakan** (selalu memeriksa kekeringan kayu/jamur, kecocokan contoh mal, kehalusan amplas, dan pemilahan kuantitas). Agen AI secara cerdas mengenali dua situasi pelaporan di lapangan:

#### 1. Situasi 1: Laporan Hasil Sortir QC Saat Penjemputan Barang Bersama Supir
* **Konteks**: Petugas QC mendampingi supir (*Kelik*) dan helper (*Ridvan*) menaiki armada truk ke bengkel mitra (*Pak Baryadi*). Pengecekan 100% dan sortir jamur dilakukan di tempat sebelum barang dinaikkan ke bak truk.
* **Masukan Pesan Cepat ("Pesan Hijau") dari Lapangan**:
  > *"ambil pak baryadi\nREVISI TOTAL\n1.Telenan oval kecil 368 pcs\nREVISI JAMUR\n1.Telenan oval kecil 148 pcs"*
* **Proses Agen AI**:
  1. Mengenali bahwa pengirim sedang melakukan serah terima penjemputan barang jadi/setengah jadi di mitra.
  2. Memisahkan item `REVISI TOTAL` (368 pcs fisik yang diangkut) dan `REVISI JAMUR` (148 pcs temuan cacat akibat kelembaban).
  3. Menghitung otomatis:
     - Barang Lolos (Pass) = 368 - 148 = 220 pcs (Dialokasikan langsung ke Stasiun 3 Finishing).
     - Barang Revisi Jamur = 148 pcs (Dialokasikan ke antrean oven pengering & amplas ulang in-house).
  4. Menerbitkan draf mutasi logistik terstruktur ("Pesan Kaku") ke grup WhatsApp Logistik dan mencatat entitas serah terima di tabel `mitra_shipments` & `qc_logs`.

#### 2. Situasi 2: Laporan Cek Kualitas Langsung dari Bengkel Mitra (Datang Sendiri Naik Motor)
* **Konteks**: Petugas QC (*Mas Anto*) datang sendiri naik sepeda motor dinas mampir ke bengkel mitra untuk memeriksa pengerjaan kayu. Pelaporan mencakup 6 unsur penting: **SPK apa, Mitranya siapa, Produknya apa, Kuantitasnya (Lolos & 3 Tingkatan Rijek), Kondisi produknya apa, dan Kendalanya apa**.
* **Klasifikasi Kuantitas Rijek (3 Tingkat Penanganan)**:
  1. **Bisa diperbaiki tidak berubah banyak (Perbaikan Ringan / Minor Rework)**: Cacat permukaan ringan tanpa merombak bentuk dasar (amplas tipis ulang, dempul serat halus, jamur tipis permukaan).
  2. **Harus bongkar (Perbaikan Berat / Major Rework)**: Cacat konstruksi yang mengharuskan pembongkaran sambungan sebelum dirangkai ulang (sambungan laminasi lem renggang/miring, pasak melenceng, harus dibongkar lalu dilem/dipress ulang).
  3. **Harus ganti (Cacat Fatal / Scrap Replacement)**: Cacat fatal yang tidak dapat diselamatkan (kayu retak pecah tembus, mata kayu busuk jebol parah, salah potong kependekan). Wajib diafkir (*scrap*) dan diganti dengan potongan bahan kayu baru.

* **Variasi Masukan Pesan QC via WhatsApp Bot**:
  - *Format Chat Mengalir Lapangan:*  
    > *"Cek SPK 0012 Pak Baryadi produk telenan gagang: lolos 180 pcs, rijek 10 bisa diperbaiki ringan amplas, 3 harus bongkar lem, 2 harus ganti bahan kayu retak. Kondisi kayu kering, ukuran pas mal. Aman lanjut kerja."*
  - *Format Poin Lengkap Lapangan:*  
    > *"SPK 0012 | Pak Baryadi | Telenan Gagang | Lolos: 180 | Rijek: 10 perbaiki ringan, 3 harus bongkar, 2 harus ganti | Kondisi: kayu kering, mal pas | Kendala: nihil, aman lanjut"*
  - *Format Jika Ada Kendala Serius / Pending:*  
    > *"Cek SPK 0012 Pak Baryadi produk telenan gagang: Lolos 50, rijek 20 harus bongkar lem, 15 harus ganti retak. Kondisi mal pas, kendala kayu basah & lem kurang rekat. Pengerjaan dipending sementara."*

* **Proses Internal Agen AI (Ekstraksi Kuantitas & Entitas)**:
  1. Identifikasi pengirim via no. WA: *Mas Anto (Role: QC Inspector)*.
  2. Resolusi entitas:
     - **SPK apa**: `fuzzy_resolve_spk("SPK 0012")` -> `wo_id: "wo_2026_09_0012"`.
     - **Mitranya siapa**: `resolve_mitra("Pak Baryadi")` -> `mitra_id: 8829102`.
     - **Produknya apa**: `resolve_product("telenan gagang")` -> SKU `TLN-GGNG` ("Telenan Gagang").
  3. Ekstraksi Kuantitas Cerdas (*Smart Quantity & Defect Parser*):
     - `pass_qty`: 180
     - `reject_minor_qty`: 10 (*bisa diperbaiki tidak berubah banyak*)
     - `reject_major_qty`: 3 (*harus bongkar*)
     - `reject_scrap_qty`: 2 (*harus ganti*)
     - `total_inspected`: 195 pcs
  4. Ekstraksi Kondisi & Kendala:
     - `kondisi_kayu`: `Kering (Layak Serut)`
     - `kesesuaian_mal`: `Pas Contoh Master`
     - `amplas`: `Halus`
     - `kendala`: `Nihil`
  5. Penentuan keputusan (*Decision Engine*):
     - Jika persentase cacat berat/fatal dalam batas aman -> Status SPK: `AMAN LANJUT KERJA` (`action_taken: "accept"`).
     - Jika ada kendala bahan basah/lem lepas massal -> Status SPK: `DIPENDING SEMENTARA` (`action_taken: "rework_mitra"` / `hold`).
  6. Penyimpanan data:
     - Mencatat hasil rincian di tabel `qc_logs` (`pass_qty`, `reject_minor_qty`, `reject_major_qty`, `reject_scrap_qty`).
     - Memperbarui status pengerjaan batch mitra pada `work_order_stations`.
  7. Balasan Agen ke WhatsApp QC Inspector & Notifikasi ke Mandor Pabrik:
     > *"[CATATAN CEK QC DITERIMA]*  
     > *No. SPK: SPK-2026-09-0012*  
     > *Mitra: Pak Baryadi*  
     > *Produk: Telenan Gagang [TLN-GGNG]*  
     > *Pemeriksa: Mas Anto (QC)*  
     >   
     > *[HASIL PEMERIKSAAN]*  
     > *- Lolos (Bagus): 180 pcs (Siap lanjut)*  
     > *- Rijek Ringan : 10 pcs (Bisa diperbaiki tidak berubah banyak)*  
     > *- Rijek Bongkar: 3 pcs (Harus bongkar lem / press ulang)*  
     > *- Rijek Ganti  : 2 pcs (Harus ganti bahan / retak tembus)*  
     >   
     > *Kondisi: Kayu kering, mal contoh pas, amplas halus.*  
     > *Kendala: NIHIL (AMAN LANJUT KERJA)*  
     > *Status SPK di sistem telah diperbarui dan diteruskan ke Mandor."*

---


## 6. Struktur Schema Output Agentic Parser (JSON Payload)

Setiap ekstraksi yang berhasil dikonfirmasi oleh pengguna akan menghasilkan JSON yang tervalidasi skemanya (*structured output*) untuk dikonsumsi API backend.

### 6.1 Schema Output Laporan Progres Produksi (Operator / In-House / Mitra)

```json
{
  "event": "production_report_parsed",
  "confidence_score": 0.96,
  "user_context": {
    "user_id": 8829102,
    "name": "Budi Santoso - CV Kayu Makmur",
    "email": "budi.santoso@example.com",
    "phone_number": "6281234567890",
    "status": "ACTIVE",
    "is_active": true,
    "roles": ["Mitra Produksi"]
  },
  "extraction": {
    "work_order_id": "wo_2026_09_0012",
    "spk_number": "SPK-2026-09-0012",
    "station_id": "st_1_woodworking",
    "status_reported": "station_completed",
    "quantities": {
      "pass": 190,
      "reject": 10,
      "rework": 0
    },
    "defect_details": [
      {
        "category_code": "DEF_CRACK_GRAIN",
        "category_name": "Pecah Serat",
        "qty": 10,
        "raw_text": "pecah serat pas diserut"
      }
    ],
    "worker_notes": "Barang siap diambil besok pagi oleh sopir pabrik.",
    "media_references": {
      "audio_file_id": null,
      "photo_file_id": "img_wa_20260915_0912.jpg"
    }
  },
  "validation_checks": {
    "is_assigned_to_user": true,
    "is_within_tolerances": true,
    "user_explicitly_confirmed": true
  },
  "timestamp": "2026-09-15T13:30:00+07:00"
}
```

### 6.2 Schema Output Logistik Mitra (Pemisahan Posisi Kendaraan vs Aksi Produk)

Agen AI secara terpisah mencatat posisi gerbang kendaraan (`vehicle_gate_status`) dan aksi terhadap muatan produk (`product_action`):

```json
{
  "event": "logistics_manifest_parsed",
  "confidence_score": 0.98,
  "reporter_context": {
    "user_id": 991823,
    "name": "Kelik (Supir Armada)",
    "phone_number": "6285712345678",
    "roles": ["Logistik", "Supir"]
  },
  "logistics_movement": {
    "vehicle_gate_status": "keluar",
    "product_action": "ambil",
    "movement_date": "2026-08-01",
    "movement_time": "09:45",
    "vehicle": {
      "type": "L300",
      "license_plate": "AD 8623 KW"
    },
    "crew": {
      "driver_name": "Kelik",
      "helper_name": "Ridvan",
      "qc_inspector_name": "Mas Anto"
    },
    "partner": {
      "mitra_id": 8829102,
      "mitra_name": "Pak Baryadi"
    }
  },
  "items": [
    {
      "product_code": "TLN-BSR-4528",
      "product_name": "Telenan Oval Besar",
      "total_picked_qty": 25,
      "qc_breakdown": {
        "pass_qty": 18,
        "mold_rework_qty": 7,
        "scrap_qty": 0
      }
    },
    {
      "product_code": "TLN-LBG-OVL",
      "product_name": "Telenan Oval Kecil",
      "total_picked_qty": 368,
      "qc_breakdown": {
        "pass_qty": 220,
        "mold_rework_qty": 148,
        "scrap_qty": 0
      }
    },
    {
      "product_code": "TLN-JPN-DIY",
      "product_name": "Telenan Jepang Versi MR DIY",
      "total_picked_qty": 3,
      "qc_breakdown": {
        "pass_qty": 3,
        "mold_rework_qty": 0,
        "scrap_qty": 0
      }
    },
    {
      "product_code": "TLN-GGNG",
      "product_name": "Telenan Gagang",
      "total_picked_qty": 25,
      "qc_breakdown": {
        "pass_qty": 25,
        "mold_rework_qty": 0,
        "scrap_qty": 0
      }
    }
  ],
  "routing_actions": {
    "pass_target_station": "st_3_finishing",
    "mold_rework_target": "inhouse_kiln_dryer"
  },
  "timestamp": "2026-08-01T09:45:00+07:00"
}
```

### 6.3 Schema Output Laporan Cek QC Mandiri di Mitra (Kuantitas & 3 Tingkatan Rijek)

Skema output terstruktur hasil parsing pesan QC di lapangan:

```json
{
  "event": "onsite_qc_report_parsed",
  "confidence_score": 0.98,
  "inspector_context": {
    "user_id": 991845,
    "name": "Mas Anto (QC Inspector)",
    "phone_number": "6281299988776",
    "roles": ["QC Inspector"]
  },
  "work_order_reference": {
    "spk_number": "SPK-2026-09-0012",
    "work_order_id": "wo_2026_09_0012",
    "station_id": "st_1_woodworking",
    "mitra_id": 8829102,
    "mitra_name": "Pak Baryadi",
    "product_code": "TLN-GGNG",
    "product_name": "Telenan Gagang"
  },
  "quantities": {
    "total_inspected": 195,
    "pass_qty": 180,
    "reject_total": 15,
    "reject_breakdown": {
      "minor_rework": {
        "qty": 10,
        "label": "Bisa diperbaiki tidak berubah banyak",
        "action": "amplas_tipis_ulang"
      },
      "major_rework": {
        "qty": 3,
        "label": "Harus bongkar",
        "action": "bongkar_lem_press_ulang"
      },
      "scrap_replace": {
        "qty": 2,
        "label": "Harus ganti",
        "action": "afkir_potong_kayu_baru"
      }
    }
  },
  "physical_condition": {
    "wood_dryness": "kering",
    "dimension_jig_match": "presisi",
    "sanding_smoothness": "halus"
  },
  "obstacle_notes": "Nihil kendala bahan mentah, mitra sepakat perbaikan bongkar lem.",
  "status_decision": "AMAN_LANJUT_KERJA",
  "action_taken": "accept_with_rework_queue",
  "timestamp": "2026-09-15T14:20:00+07:00"
}
```

---

## 7. Penanganan Keamanan, Privasi, & Guardrails
*(Diselaraskan dengan tata kelola akun pada [Panduan Sistem Hak Akses](konsep-sistem-manajemen-akun))*

1. **Gate Pemeriksaan Status Akun & Aktivasi (*Activation Barrier*)**:
   - Jika pengirim pesan berstatus `PENDING_ACTIVATION` atau `is_active: false`, agen **tidak akan mengeksekusi ekstraksi laporan produksi**.
   - Agen langsung membalas dengan arahan aktivasi terarah:
     > *"Nomor WhatsApp Anda terdaftar namun BELUM DIAKTIFKAN. Silakan buka tautan Magic Link aktivasi yang telah dikirimkan ke Anda atau hubungi Superuser."*
2. **Pengecekan Otorisasi Peran Berdasarkan Hak Akses (*Role & Permission Check*)**:
   - Agen memeriksa apakah `roles` pengguna berwenang melaporkan stasiun tersebut (misal: Mitra Produksi hanya diizinkan melapor di Stasiun 1–3, bukan Stasiun 4 atau 5).
3. **Anti-Hallucination Barrier (Strict Entity Linking)**:
   - Agen tidak diperkenankan menciptakan ID SPK, nama produk, atau nomor telepon baru.
   - Semua entitas hasil ekstraksi wajib lolos pencocokan (*Exact Match* atau *Strict Fuzzy Match dengan Threshold > 0.85*) terhadap data master yang ada di database.
4. **Prinsip Konfirmasi Sebelum Eksekusi (Confirmation Gate)**:
   - Setiap mutasi data pengerjaan tidak dieksekusi secara diam-diam.
   - Agen selalu memberikan ringkasan singkat dalam bentuk poin dan menanyakan persetujuan akhir sebelum data dicatat ke database resmi (`production_logs` / `mitra_shipments`).
5. **Mekanisme Fallback ke Mandor (Human Takeover)**:
   - Jika pengguna gagal menjawab klarifikasi sebanyak 2 kali berurutan, sistem menghentikan sesi bot dan mengirimkan pesan:
     > *"Laporan Anda diteruskan ke Mandor (Pak Heri) untuk dibantu input manual. Terima kasih."*
   - Mandor menerima notifikasi berisi transkrip riwayat chat untuk ditindaklanjuti.


---

## 8. Rekomendasi Teknologi & Efisiensi Biaya

* **LLM Engine**: Model mutakhir yang cepat dan hemat biaya dengan dukungan *Native Structured Output* & *Tool Calling* (seperti **Gemini Flash**).
* **Audio Transcriber (STT)**: Model Speech-to-Text Whisper yang dioptimalkan untuk dialek Bahasa Indonesia.
* **State & Memory Management**: **Redis** untuk mencatat status dialog singkat pengguna (masa aktif sesi chat interaktif 10 menit).
* **Orkestrator**: Layanan backend terintegrasi (FastAPI / NestJS) yang menerima webhook dari OpenWA, memanggil AI Engine secara asinkron, dan merespons balik pengguna dengan latensi < 3 detik.

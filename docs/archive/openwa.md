# OpenWA — Panduan Integrasi & Notifikasi WhatsApp Gateway

Panduan lengkap penggunaan **OpenWA** (WhatsApp API Gateway) untuk kebutuhan notifikasi otomatis dan integrasi sistem pada proyek **Kayu KWAS Tracking Demo**. Dokumen ini mencakup konfigurasi kredensial produksi & lokal, otentikasi, format normalisasi nomor telepon, integrasi Laravel (Service, Queue, Controller), pengujian cURL, manajemen sesi, dan verifikasi webhook.

---

## 1. Informasi Server & Kredensial

### 1.1 Environment Produksi / Staging
- **Base URL API:** `https://openwaha.kayukwas.co.id/api`
- **Dashboard Web:** `https://openwaha.kayukwas.co.id`
- **Health Check Endpoint:** `https://openwaha.kayukwas.co.id/api/health`
- **Active API Key:** `owa_k1_d91008176a7d4d1ea371d721dda7cef9de1594f2cba38287d2b8f5cbca2564c0`
- **Active Session ID:** `5ab1774b-97a5-4656-96b7-52ca8a3a96bf` (Session Name: `development-bot`, Phone: `+6285169758096`, Status: `ready`)

### 1.2 Environment Lokal (Development)
- **Base URL API:** `http://localhost:2785/api`
- **Dashboard:** `http://localhost:2785`
- **Swagger UI:** `http://localhost:2785/api/docs` *(tersedia saat `NODE_ENV=development` atau `ENABLE_SWAGGER=true`)*
- **Health Check:** `http://localhost:2785/api/health`

---

## 2. Otentikasi & Otorisasi

OpenWA menggunakan otentikasi berbasis **Header API Key**:
```http
X-API-Key: owa_k1_d91008176a7d4d1ea371d721dda7cef9de1594f2cba38287d2b8f5cbca2564c0
```

> ⚠️ **Catatan Keamanan:**
> - Auth bersifat **header-only**. Parameter query `?apiKey=` tidak didukung demi mencegah kebocoran key ke access log proxy.
> - Di server, API Key disimpan dalam bentuk hash SHA-256 (one-way hashing).
> - Selalu gunakan HTTPS di lingkungan staging dan produksi.

### Tingkatan Role (RBAC)

| Role | Rank | Cakupan Akses |
| :--- | :--- | :--- |
| `viewer` | 1 | Read-only (melihat daftar sesi, status, histori read) |
| `operator` | 2 | `viewer` + aksi write (kirim pesan teks/media, restart/stop sesi, mutasi grup) |
| `admin` | 3 | Semua akses + manajemen API Key dan konfigurasi server |

### HTTP Status Code Penting

| Status | Arti & Penyebab |
| :--- | :--- |
| `200` / `201` | Request berhasil diproses |
| `400` | Validasi payload gagal (field tidak valid / format DTO salah) |
| `401` | API Key tidak disertakan, tidak valid, kadaluarsa, atau IP diblokir |
| `403` | API Key valid tetapi role tidak memenuhi batas minimal (misal viewer mencoba kirim pesan) |
| `404` | Endpoint atau UUID Session tidak ditemukan |
| `413` | Ukuran payload media melebihi batas (default max 50 MiB) |
| `500` | Kesalahan internal server atau kegagalan pada WhatsApp engine |

---

## 3. Format & Normalisasi Nomor WhatsApp

Nomor tujuan wajib berformat WhatsApp JID:
- **Personal Chat:** `[NomorHP]@c.us` (contoh: `628123456789@c.us`)
- **Group Chat:** `[GroupID]@g.us` (contoh: `628123456789-1612345678@g.us`)

### Aturan Normalisasi Nomor Indonesia (`628xxx`)

| Input Pengguna | Output Normalisasi | Format Chat ID (`chatId`) |
| :--- | :--- | :--- |
| `08123456789` | `628123456789` | `628123456789@c.us` |
| `8123456789` | `628123456789` | `628123456789@c.us` |
| `+628123456789` | `628123456789` | `628123456789@c.us` |
| `628123456789` | `628123456789` | `628123456789@c.us` |
| `0812-3456-7890` | `6281234567890` | `6281234567890@c.us` |
| _(kosong / null)_ | `''` *(string kosong)* | _(tidak dikirim)_ |

### Helper Formatter Laravel (`app/Services/WhatsAppPhoneFormatter.php`)

```php
<?php

namespace App\Services;

class WhatsAppPhoneFormatter
{
    /**
     * Normalisasi nomor telepon ke format standar internasional Indonesia (62xxx).
     */
    public static function normalize(?string $phone): string
    {
        if (empty($phone)) {
            return '';
        }

        // Hapus karakter non-digit (+, spasi, tanda hubung)
        $phone = preg_replace('/\D+/', '', $phone);

        if ($phone === '') {
            return '';
        }

        // Ubah awalan '0' menjadi '62'
        if (str_starts_with($phone, '0')) {
            return '62' . substr($phone, 1);
        }

        // Ubah awalan '8' langsung menjadi '628'
        if (str_starts_with($phone, '8')) {
            return '62' . $phone;
        }

        return $phone;
    }

    /**
     * Format nomor menjadi chatId siap pakai (@c.us).
     */
    public static function toChatId(?string $phone): ?string
    {
        $normalized = self::normalize($phone);

        return $normalized !== '' ? $normalized . '@c.us' : null;
    }
}
```

---

## 4. Integrasi Laravel

### 4.1 Environment Variables (`.env`)

Tambahkan variabel konfigurasi berikut pada file `.env`:

```dotenv
# Konfigurasi OpenWA WhatsApp Gateway
OPENWA_BASE_URL=https://openwaha.kayukwas.co.id/api
OPENWA_API_KEY=owa_k1_d91008176a7d4d1ea371d721dda7cef9de1594f2cba38287d2b8f5cbca2564c0
OPENWA_SESSION_ID=5ab1774b-97a5-4656-96b7-52ca8a3a96bf
OPENWA_WEBHOOK_SECRET=your-webhook-hmac-secret
```

### 4.2 Configuration File (`config/services.php`)

Daftarkan konfigurasi OpenWA ke dalam `config/services.php`:

```php
'openwa' => [
    'base_url' => env('OPENWA_BASE_URL', 'https://openwaha.kayukwas.co.id/api'),
    'api_key' => env('OPENWA_API_KEY'),
    'session_id' => env('OPENWA_SESSION_ID'),
    'webhook_secret' => env('OPENWA_WEBHOOK_SECRET'),
],
```

### 4.3 Service Class (`app/Services/WhatsAppService.php`)

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class WhatsAppService
{
    protected string $baseUrl;
    protected ?string $apiKey;
    protected ?string $sessionId;

    public function __construct()
    {
        $this->baseUrl = rtrim(config('services.openwa.base_url', 'https://openwaha.kayukwas.co.id/api'), '/');
        $this->apiKey = config('services.openwa.api_key');
        $this->sessionId = config('services.openwa.session_id');
    }

    /**
     * Kirim pesan teks ke nomor tujuan.
     */
    public function sendTextMessage(string $phone, string $message): bool
    {
        $chatId = WhatsAppPhoneFormatter::toChatId($phone);

        if (!$chatId) {
            Log::warning('[OpenWA] Nomor telepon tidak valid, pengiriman dibatalkan.', ['phone' => $phone]);
            return false;
        }

        if (empty($this->apiKey) || empty($this->sessionId)) {
            Log::error('[OpenWA] Konfigurasi API Key atau Session ID belum disetel di .env');
            return false;
        }

        $endpoint = "{$this->baseUrl}/sessions/{$this->sessionId}/messages/send-text";

        try {
            $response = Http::withHeaders([
                'X-API-Key' => $this->apiKey,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ])->timeout(15)->post($endpoint, [
                'chatId' => $chatId,
                'text' => $message,
            ]);

            if ($response->successful()) {
                Log::info('[OpenWA] Pesan berhasil dikirim.', [
                    'chatId' => $chatId,
                    'response' => $response->json(),
                ]);
                return true;
            }

            Log::error('[OpenWA] Gagal mengirim pesan.', [
                'status' => $response->status(),
                'body' => $response->body(),
                'chatId' => $chatId,
            ]);
            return false;

        } catch (Throwable $e) {
            Log::error('[OpenWA] Exception saat mengirim pesan: ' . $e->getMessage(), [
                'chatId' => $chatId,
            ]);
            return false;
        }
    }

    /**
     * Contoh: Notifikasi SPK Baru Dibuat.
     */
    public function sendSpkCreatedNotification(string $phone, string $spkNumber, string $productName, int $qty): bool
    {
        $text = "📋 *Pemberitahuan SPK Baru — Kayu KWAS*\n\n"
              . "Nomor SPK: *{$spkNumber}*\n"
              . "Produk: {$productName}\n"
              . "Jumlah Target: {$qty} pcs\n"
              . "Status: *Menunggu Produksi*\n\n"
              . "Silakan pantau perkembangan pengerjaan melalui sistem tracking KWAS.";

        return $this->sendTextMessage($phone, $text);
    }
}
```

### 4.4 Pengiriman Asynchronous via Queue Job

Untuk menjaga responsivitas UI dan mencegah blocking HTTP request:

```php
<?php

namespace App\Jobs;

use App\Services\WhatsAppService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendWhatsAppNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 10;

    public function __construct(
        public string $phone,
        public string $message
    ) {}

    public function handle(WhatsAppService $whatsAppService): void
    {
        $whatsAppService->sendTextMessage($this->phone, $this->message);
    }
}
```

Dispatch dari Controller / Event Listener:
```php
SendWhatsAppNotificationJob::dispatch($user->phone_number, "Halo, status SPK Anda telah diperbarui.");
```

---

## 5. Pengujian API Langsung (cURL)

### 5.1 Cek Kesehatan Server (Health Check)
```bash
curl -s "https://openwaha.kayukwas.co.id/api/health"
```
**Respons:**
```json
{"status":"ok","timestamp":"2026-09-15T06:32:21.408Z"}
```

### 5.2 Cek Status Sesi Aktif
```bash
curl -s -X GET "https://openwaha.kayukwas.co.id/api/sessions" \
  -H "X-API-Key: owa_k1_d91008176a7d4d1ea371d721dda7cef9de1594f2cba38287d2b8f5cbca2564c0"
```

### 5.3 Kirim Pesan Teks
```bash
curl -X POST "https://openwaha.kayukwas.co.id/api/sessions/5ab1774b-97a5-4656-96b7-52ca8a3a96bf/messages/send-text" \
  -H "X-API-Key: owa_k1_d91008176a7d4d1ea371d721dda7cef9de1594f2cba38287d2b8f5cbca2564c0" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "628123456789@c.us",
    "text": "Halo, ini adalah pesan uji coba dari sistem KWAS Tracking."
  }'
```

---

## 6. Manajemen Sesi OpenWA (cURL)

| Aksi | Method & Path | Keterangan |
| :--- | :--- | :--- |
| **List Sesi** | `GET /api/sessions` | Menampilkan seluruh sesi dan statusnya |
| **Buat Sesi Baru** | `POST /api/sessions` | Payload: `{"name": "bot-name"}` |
| **Start Sesi** | `POST /api/sessions/:id/start` | Mengaktifkan sesi WhatsApp |
| **Ambil QR Code** | `GET /api/sessions/:id/qr` | Mengembalikan PNG / data QR untuk login WA |
| **Pairing Code** | `POST /api/sessions/:id/pairing-code` | Alternatif QR Code via nomor HP |
| **Stop Sesi** | `POST /api/sessions/:id/stop` | Menonaktifkan sementara sesi |
| **Logout Sesi** | `POST /api/sessions/:id/logout` | Keluar dari akun WhatsApp pada sesi |

---

## 7. Webhook & Verifikasi Signature

Jika sistem menerima event webhook masuk dari OpenWA (misal `message.received` atau `session.status`), verifikasi signature HMAC-SHA256 untuk memastikan keaslian request.

### Header Webhook dari OpenWA

| Header | Deskripsi |
| :--- | :--- |
| `X-OpenWA-Signature` | `sha256=<hex_digest>` dari raw request body menggunakan webhook secret |
| `X-OpenWA-Event` | Jenis event (contoh: `message.received`, `message.sent`, `session.status`) |
| `X-OpenWA-Idempotency-Key` | Kunci unik untuk mencegah pemrosesan duplikat saat retry |
| `X-OpenWA-Delivery-Id` | ID unik proses pengiriman webhook |

### Implementasi Verifikasi Signature di Laravel

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class OpenWAWebhookController extends Controller
{
    public function handle(Request $request): JsonResponse
    {
        $signature = $request->header('X-OpenWA-Signature');
        $secret = config('services.openwa.webhook_secret');
        $rawBody = $request->getContent();

        // 1. Validasi Keberadaan Signature & Secret
        if (!$signature || !$secret) {
            Log::warning('[OpenWA Webhook] Signature atau secret kosong.');
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        // 2. Hitung Expected HMAC-SHA256
        $expected = 'sha256=' . hash_hmac('sha256', $rawBody, $secret);

        // 3. Constant-time comparison
        if (!hash_equals($expected, $signature)) {
            Log::warning('[OpenWA Webhook] Signature tidak valid.');
            return response()->json(['error' => 'Invalid signature'], 401);
        }

        $event = $request->header('X-OpenWA-Event');
        $idempotencyKey = $request->header('X-OpenWA-Idempotency-Key');
        $payload = $request->json()->all();

        Log::info("[OpenWA Webhook] Menerima event: {$event}", [
            'idempotency_key' => $idempotencyKey,
            'payload' => $payload,
        ]);

        // 4. Proses payload sesuai kebutuhan bisnis
        // switch ($event) { ... }

        return response()->json(['status' => 'success']);
    }
}
```

---

## 8. Ringkasan Endpoint Penting

Semua endpoint diawali dengan base URL `/api` dan membutuhkan header `X-API-Key`:

| Kategori | Method & Path | Minimal Role | Deskripsi |
| :--- | :--- | :--- | :--- |
| **Health** | `GET /api/health` | Public | Cek status server |
| **Sessions** | `GET /api/sessions` | `viewer` | Ambil semua sesi |
| **Sessions** | `POST /api/sessions` | `operator` | Buat sesi baru |
| **Sessions** | `POST /api/sessions/:id/start` | `operator` | Jalankan sesi |
| **Sessions** | `GET /api/sessions/:id/qr` | `operator` | Ambil QR code autentikasi |
| **Pesan** | `POST /api/sessions/:id/messages/send-text` | `operator` | Kirim pesan teks (max 4096 char) |
| **Pesan** | `POST /api/sessions/:id/messages/send-image` | `operator` | Kirim gambar (URL / Base64) |
| **Pesan** | `POST /api/sessions/:id/messages/send-document` | `operator` | Kirim dokumen / PDF |
| **Webhook** | `POST /api/sessions/:id/webhooks` | `operator` | Daftarkan URL webhook |
| **API Keys** | `POST /api/auth/api-keys` | `admin` | Generate API Key baru |

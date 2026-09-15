# OpenWA — Panduan Notifikasi WhatsApp

Panduan penggunaan **OpenWA** (WhatsApp API Gateway open-source) untuk mengirim notifikasi otomatis dari aplikasi Laravel. Dokumen ini mencakup instalasi, otentikasi, format nomor, integrasi, dan referensi API lengkap berdasarkan dokumentasi resmi OpenWA (`rmyndharis/OpenWA`, branch `main`).

> Semua spesifikasi endpoint, otentikasi, dan format respons di bawah diambil dari dokumentasi resmi repositori OpenWA.

---

## 1. Gambaran Umum

OpenWA menjembatani aplikasi dengan WhatsApp. Aplikasi mengirim HTTP request ke REST API OpenWA, lalu OpenWA meneruskan sebagai pesan WhatsApp ke nomor tujuan.

**Akses default (lokal):**

- API: `http://localhost:2785/api`
- Swagger UI: `http://localhost:2785/api/docs` (mati saat `NODE_ENV=production` kecuali `ENABLE_SWAGGER=true`)
- Dashboard: `http://localhost:2785`
- Health: `http://localhost:2785/api/health`

---

## 2. Otentikasi

OpenWA menggunakan **API key** di header `X-API-Key` pada setiap request non-public. Auth **header-only** — query param `?apiKey=` **tidak** didukung (dihapus untuk mencegah kebocoran ke log proxy).

```http
X-API-Key: owa_k1_your-api-key-here
```

### Format API Key

```
owa_<32-char-random-string>
Contoh: owa_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

Disimpan sebagai hash SHA-256 (one-way) di server, tidak pernah plaintext. Key awal di-_seed_ saat pertama run dan ditulis ke `data/.api-key` (atau `/app/data/.api-key` di Docker), juga dicetak di log startup. Gunakan key admin tersebut untuk membuat key scoped berprivilege rendah untuk integrasi.

### Role & Authorization

| Role       | Rank | Akses                                                       |
| ---------- | ---- | ----------------------------------------------------------- |
| `viewer`   | 1    | Read-only                                                   |
| `operator` | 2    | `viewer` + write/action (kirim pesan, mutasi group/contact) |
| `admin`    | 3    | Semua + manajemen key & settings                            |

Route tanpa `@RequireRole` menerima key apa pun (termasuk `viewer`). Route mutasi butuh `operator`. Manajemen key/settings butuh `admin`. Key bisa di-scope ke `allowedSessions` dan/atau `allowedIps`.

| Status | Arti                                                                                  |
| ------ | ------------------------------------------------------------------------------------- |
| `401`  | Key hilang/invalid/expired/revoked, IP diblokir, atau di luar scope `allowedSessions` |
| `403`  | Key valid & in-scope tapi role di bawah requirement                                   |
| `404`  | Resource tidak ada                                                                    |
| `400`  | Validasi DTO gagal / field body tak dikenal / precondition bisnis tak terpenuhi       |
| `500`  | Gagal kirim di mesin WhatsApp                                                         |

### At-Rest & In-Transit

- **TLS**: OpenWA serve plain HTTP di port-nya. Terminasi TLS di reverse proxy (nginx/Traefik/Caddy); ekspos gateway hanya via HTTPS di produksi. API key setara bearer — jangan lewat `http://` di luar dev lokal.
- **At-rest**: Key di-hash. Nilai sensitif lain (auth state, webhook secret, proxy creds, isi pesan) **plaintext** di DB/disk — dilindungi permission filesystem/DB, bukan enkripsi. Enkripsi at-rest belum diimplementasi.

---

## 3. Format Nomor Telepon

Nomor harus diformat ke format WhatsApp valid: `628…@c.us` (personal) atau `628…-…@g.us` (group).

`chatId` divalidasi dengan pola `^\d+@(c\.us|g\.us)$`.

### Aturan Normalisasi

| Input           | Output             |
| --------------- | ------------------ |
| `08123456789`   | `628123456789`     |
| `8123456789`    | `628123456789`     |
| `+628123456789` | `628123456789`     |
| `628123456789`  | `628123456789`     |
| _(kosong/null)_ | `''` (dikosongkan) |

### Helper PHP (`app/Services/WhatsAppPhoneFormatter.php`)

```php
class WhatsAppPhoneFormatter
{
    public static function normalize(string $phone): string
    {
        $phone = preg_replace('/\D+/', '', $phone);

        if ($phone === '' || $phone === null) {
            return '';
        }

        if (str_starts_with($phone, '0')) {
            return '62' . substr($phone, 1);
        }

        if (str_starts_with($phone, '8')) {
            return '62' . $phone;
        }

        return $phone;
    }
}
```

Gabung dengan `@c.us` untuk `chatId`:

```php
$chatId = WhatsAppPhoneFormatter::normalize($user->phone_number) . '@c.us';
```

---

## 4. Integrasi Laravel

### 4.1 Environment Variables (`.env`)

```env
OPENWA_BASE_URL=http://localhost:2785/api
OPENWA_API_KEY=owa_k1_your-api-key-here
OPENWA_SESSION_ID=your-session-uuid
```

> `OPENWA_SESSION_ID` adalah **UUID session** (dari response `POST /api/sessions`), bukan nama session.

### 4.2 Config (`config/services.php`)

```php
'openwa' => [
    'base_url' => env('OPENWA_BASE_URL', 'http://localhost:2785/api'),
    'api_key' => env('OPENWA_API_KEY'),
    'session_id' => env('OPENWA_SESSION_ID'),
],
```

### 4.3 WhatsApp Service

```php
class WhatsAppService
{
    public function sendUserCreatedNotification(object $user): bool
    {
        $phone = WhatsAppPhoneFormatter::normalize($user->phone_number ?? '');

        if ($phone === '') {
            return false;
        }

        $chatId = $phone . '@c.us';

        $response = Http::withHeaders([
            'X-API-Key' => config('services.openwa.api_key'),
            'Content-Type' => 'application/json',
        ])->post(
            rtrim(config('services.openwa.base_url'), '/')
                . '/sessions/'
                . config('services.openwa.session_id')
                . '/messages/send-text',
            [
                'chatId' => $chatId,
                'text' => "Selamat datang di KWAS. Akun Anda telah berhasil dibuat dan sudah aktif. Silakan login menggunakan email dan password yang telah diberikan.",
            ]
        );

        return $response->successful();
    }
}
```

> **Response tanpa envelope.** OpenWA mengembalikan payload mentah — bukan `{ success, data }`. Resource route mengembalikan object langsung; list route mengembalikan bare array. Baca field langsung (`$response->json()['id']`), bukan `$response->json('data.id')`.
>
> **Error shape:** `{ "statusCode": 404, "message": "...", "error": "Not Found" }`. Validasi gagal (`400`) → `message` berupa **array** string per-field.

### 4.4 Pemanggilan dari Livewire (async)

```php
use App\Services\WhatsAppService;

// di method save()
$user = User::create([...]);

dispatch(function () use ($user) {
    app(WhatsAppService::class)->sendUserCreatedNotification($user);
})->afterResponse();
```

`dispatch()->afterResponse()` kirim notifikasi async setelah HTTP response. **Butuh queue worker** (`php artisan queue:work`) di produksi.

### 4.5 Pemanggilan dari Controller (sync)

```php
public function store(Request $request, WhatsAppService $whatsAppService)
{
    $user = User::create([
        'name' => $request->name,
        'email' => $request->email,
        'phone_number' => $request->phone_number,
        'password' => bcrypt($request->password),
    ]);

    $whatsAppService->sendUserCreatedNotification($user);

    return redirect()->back()->with('success', 'User berhasil dibuat');
}
```

---

## 5. Kirim Pesan Langsung (cURL)

```bash
export BASE=http://localhost:2785/api
export API_KEY=owa_k1_your-api-key-here
export SESSION_ID=8f3c2b1a-9d4e-4c7a-8b2f-1e6d5a4c3b2a

curl -X POST "$BASE/sessions/$SESSION_ID/messages/send-text" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "628123456789@c.us",
    "text": "Selamat datang di KWAS. Akun Anda telah berhasil dibuat dan sudah aktif."
  }'
```

`text` maksimal **4096 karakter**.

---

## 6. Manajemen Session (cURL)

`:sessionId` selalu UUID, bukan nama.

```bash
# Buat session (OPERATOR)
curl -X POST "$BASE/sessions" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "kwas-bot" }'

# Start session
curl -X POST "$BASE/sessions/$SESSION_ID/start" \
  -H "X-API-Key: $API_KEY"

# QR code (PNG data URL) — OPERATOR
curl "$BASE/sessions/$SESSION_ID/qr" \
  -H "X-API-Key: $API_KEY"

# Stop / logout / force-kill (OPERATOR)
curl -X POST "$BASE/sessions/$SESSION_ID/stop" -H "X-API-Key: $API_KEY"
curl -X POST "$BASE/sessions/$SESSION_ID/logout" -H "X-API-Key: $API_KEY"
curl -X POST "$BASE/sessions/$SESSION_ID/force-kill" -H "X-API-Key: $API_KEY"

# Pairing code via nomor HP (alternatif scan QR) — OPERATOR
curl -X POST "$BASE/sessions/$SESSION_ID/pairing-code" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "phoneNumber": "628123456789" }'
```

**Session status (lowercase):** `created | initializing | qr_ready | authenticating | ready | disconnected | action_required | failed`.

---

## 7. Webhook & Monitoring

OpenWA bisa konfigurasi webhook untuk memantau status session dan pesan.

### Event

| Event                  | Keterangan               |
| ---------------------- | ------------------------ |
| `message.received`     | Pesan masuk diterima     |
| `message.sent`         | Pesan berhasil dikirim   |
| `message.failed`       | Pesan gagal dikirim      |
| `session.status`       | Perubahan status session |
| `session.qr`           | QR code baru di-generate |
| `session.disconnected` | WhatsApp terputus        |

### Registrasi Webhook

```bash
curl -X POST "$BASE/sessions/$SESSION_ID/webhooks" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-server.com/webhook/openwa",
    "events": ["message.received", "session.status", "message.failed"],
    "secret": "your-hmac-secret"
  }'
```

### Verifikasi Signature (Penting)

Bila webhook punya `secret`, OpenWA men-sign delivery dengan `X-OpenWA-Signature` (HMAC-SHA256 atas raw body). Header sistem:

| Header                     | Deskripsi                                           |
| -------------------------- | --------------------------------------------------- |
| `X-OpenWA-Signature`       | `sha256=<hex digest>` (ada hanya bila secret diset) |
| `X-OpenWA-Event`           | Nama event, mis. `message.received`                 |
| `X-OpenWA-Idempotency-Key` | Key stabil untuk deduplikasi                        |
| `X-OpenWA-Delivery-Id`     | ID unik delivery (stabil antar retry)               |
| `X-OpenWA-Retry-Count`     | Jumlah retry                                        |

Verifikasi (Node/Express — pakai `express.raw()` agar signature atas raw body):

```javascript
const crypto = require("crypto");
const express = require("express");
const app = express();
const WEBHOOK_SECRET = process.env.OPENWA_WEBHOOK_SECRET;

function verify(rawBody, signature, secret) {
    if (!signature || !secret) return false;
    const expected =
        "sha256=" +
        crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected),
    );
}

app.post(
    "/webhook/openwa",
    express.raw({ type: "application/json" }),
    (req, res) => {
        if (
            !verify(req.body, req.header("X-OpenWA-Signature"), WEBHOOK_SECRET)
        ) {
            return res.status(401).send("Invalid signature");
        }
        const event = JSON.parse(req.body.toString("utf8"));
        // proses event; return 2xx hanya setelah berhasil diterima
        return res.status(200).send("OK");
    },
);
```

> Gunakan perbandingan constant-time. Pakai `X-OpenWA-Idempotency-Key` untuk cegah pemrosesan ganda saat retry.

---

## 8. Catatan Operasional

- **Session aktif:** WhatsApp butuh session aktif & QR di-scan. Monitor `session.status`; bila `disconnected`, scan ulang.
- **Nomor valid:** Pastikan nomor user valid. Bila kosong, notifikasi di-skip.
- **Queue worker:** Pakai `dispatch()` → pastikan `php artisan queue:work` jalan.
- **Media cap:** Shared byte cap `MEDIA_DOWNLOAD_MAX_BYTES` default **50 MiB**. Base64/URL melebihi → `413`.
- **TLS:** Jangan expose OpenWA via HTTP plaintext di produksi; terminasi TLS di proxy.
- **Key scope:** Buat key `operator` scoped (`allowedIps`/`allowedSessions`) untuk integrasi produksi, jangan pakai admin key.

---

## 9. Referensi Endpoint Cepat

Semua path di-bawah di-prefix `/api` dan butuh header `X-API-Key`. `:id` = UUID session (kecuali resource lain).

| Kebutuhan      | Method & Path                                                             | Min Role |
| -------------- | ------------------------------------------------------------------------- | -------- |
| Buat session   | `POST /sessions`                                                          | operator |
| Start session  | `POST /sessions/:id/start`                                                | operator |
| QR code        | `GET /sessions/:id/qr`                                                    | operator |
| Pairing code   | `POST /sessions/:id/pairing-code`                                         | operator |
| Stop / logout  | `POST /sessions/:id/stop` · `/logout`                                     | operator |
| Kirim teks     | `POST /sessions/:id/messages/send-text`                                   | operator |
| Kirim media    | `POST /sessions/:id/messages/send-image\|video\|audio\|document\|sticker` | operator |
| Daftar webhook | `POST /sessions/:id/webhooks`                                             | operator |
| List sessions  | `GET /sessions`                                                           | viewer   |
| Health         | `GET /health`                                                             | public   |
| Buat API key   | `POST /auth/api-keys`                                                     | admin    |

Dokumentasi lengkap: `openapi.json` di root repo & Swagger `/api/docs`.

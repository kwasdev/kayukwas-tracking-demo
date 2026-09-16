# Webhook Signature Verification — OpenWA Gateway

Dokumentasi spesifikasi dan verifikasi webhook untuk gateway **OpenWA** pada sistem **Kayu KWAS**. OpenWA menandatangani setiap pengiriman webhook menggunakan HMAC-SHA256 jika `secret` dikonfigurasi pada sesi/webhook. Penerima (backend) wajib memverifikasi signature sebelum memproses event untuk menjamin integritas data dan keamanan sistem.

---

## 1. Konfigurasi Gateway

- **Gateway URL:** `https://openwaha.kayukwas.co.id/api`
- **Active Session ID:** `5ab1774b-97a5-4656-96b7-52ca8a3a96bf`
- **Header Autentikasi API:** `X-API-Key: owa_k1_d91008176a7d4d1ea371d721dda7cef9de1594f2cba38287d2b8f5cbca2564c0`

---

## 2. HTTP Headers Webhook OpenWA

Setiap payload webhook yang dikirimkan OpenWA menyertakan header sistem berikut:

| Header | Tipe | Deskripsi |
| :--- | :--- | :--- |
| `X-OpenWA-Signature` | `string` | Signature HMAC-SHA256 format `sha256=<hex digest>`. Hadir jika webhook memiliki secret. |
| `X-OpenWA-Event` | `string` | Nama event, contoh: `message.received`, `message.sent`, `message.failed`, `session.status`. |
| `X-OpenWA-Idempotency-Key` | `string` | Kunci unik stabil untuk deteksi dan pencegahan duplikasi data saat retry. |
| `X-OpenWA-Delivery-Id` | `string` | UUID unik proses delivery (stabil di seluruh percobaan retry pengiriman). |
| `X-OpenWA-Retry-Count` | `integer` | Jumlah percobaan retry pengiriman saat ini (`0` untuk pengiriman pertama). |

### Format Signature
```text
sha256=<hex_digest>
```
Digest dihitung atas byte mentah (*raw request body*) yang dikirimkan, menggunakan secret HMAC yang telah disepakati.

---

## 3. Implementasi Verifikasi

### 3.1 PHP / Laravel 11+ (Stack Utama)

Gunakan method `$request->getContent()` untuk membaca raw request body dan `hash_equals()` untuk perbandingan constant-time demi mencegah *timing attack*.

#### Controller (`app/Http/Controllers/OpenWAWebhookController.php`):

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class OpenWAWebhookController extends Controller
{
    public function handle(Request $request): JsonResponse
    {
        $signature = $request->header('X-OpenWA-Signature');
        $secret = config('services.openwa.webhook_secret');
        $rawBody = $request->getContent();

        // 1. Validasi Keberadaan Signature & Secret
        if (empty($signature) || empty($secret)) {
            Log::warning('[OpenWA Webhook] Missing signature or webhook secret.');
            return response()->json(['error' => 'Unauthorized: missing signature'], 401);
        }

        // 2. Hitung Expected Signature HMAC-SHA256
        $expectedSignature = 'sha256=' . hash_hmac('sha256', $rawBody, $secret);

        // 3. Constant-time Safe Comparison
        if (!hash_equals($expectedSignature, $signature)) {
            Log::warning('[OpenWA Webhook] Invalid signature verification attempt.');
            return response()->json(['error' => 'Invalid signature'], 401);
        }

        // 4. Idempotency Guard (Cegah proses ganda saat network retry)
        $idempotencyKey = $request->header('X-OpenWA-Idempotency-Key');
        if ($idempotencyKey) {
            $cacheKey = "openwa_webhook_processed:{$idempotencyKey}";
            if (Cache::has($cacheKey)) {
                Log::info("[OpenWA Webhook] Event duplicate ignored: {$idempotencyKey}");
                return response()->json(['status' => 'already_processed']);
            }
            Cache::put($cacheKey, true, now()->addHours(24));
        }

        // 5. Parse Payload & Dispatch Event
        $event = $request->header('X-OpenWA-Event');
        $payload = $request->json()->all();

        Log::info("[OpenWA Webhook] Event diterima: {$event}", [
            'delivery_id' => $request->header('X-OpenWA-Delivery-Id'),
            'event' => $event,
        ]);

        $this->processEvent($event, $payload);

        // Return status 2xx setelah payload diterima dengan aman
        return response()->json(['status' => 'success']);
    }

    protected function processEvent(string $event, array $payload): void
    {
        match ($event) {
            'message.received' => $this->handleIncomingMessage($payload),
            'session.status'   => $this->handleSessionStatusChange($payload),
            default            => Log::debug("[OpenWA Webhook] Unhandled event: {$event}"),
        };
    }

    protected function handleIncomingMessage(array $payload): void
    {
        // Logika penerimaan pesan (aktivasi Cold Bonding / instruksi SPK)
    }

    protected function handleSessionStatusChange(array $payload): void
    {
        // Logika pemantauan status koneksi WhatsApp
    }
}
```

#### Route Registration (`routes/api.php`):

```php
use App\Http\Controllers\OpenWAWebhookController;

Route::post('/webhook/openwa', [OpenWAWebhookController::class, 'handle']);
```

---

### 3.2 Node.js / Express

Gunakan middleware `express.raw()` pada endpoint webhook agar signature diuji terhadap byte mentah body.

```javascript
const crypto = require('crypto');
const express = require('express');

const app = express();
const WEBHOOK_SECRET = process.env.OPENWA_WEBHOOK_SECRET;

function verifyOpenWASignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;

  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

app.post('/webhook/openwa', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.header('X-OpenWA-Signature');

  if (!verifyOpenWASignature(req.body, signature, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }

  const eventName = req.header('X-OpenWA-Event');
  const event = JSON.parse(req.body.toString('utf8'));

  // Proses event sesuai kebutuhan
  console.log(`Event diterima: ${eventName}`, event);

  return res.status(200).json({ status: 'ok' });
});
```

---

### 3.3 Python / FastAPI

```python
import hmac
import hashlib
import os
from fastapi import FastAPI, Request, HTTPException

app = FastAPI()
WEBHOOK_SECRET = os.environ.get("OPENWA_WEBHOOK_SECRET", "")


def verify_openwa_signature(raw_body: bytes, signature: str | None, secret: str) -> bool:
    if not signature or not secret:
        return False

    expected = "sha256=" + hmac.new(
        secret.encode("utf-8"), raw_body, hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(signature, expected)


@app.post("/webhook/openwa")
async def openwa_webhook(request: Request):
    raw_body = await request.body()
    signature = request.headers.get("x-openwa-signature")

    if not verify_openwa_signature(raw_body, signature, WEBHOOK_SECRET):
        raise HTTPException(status_code=401, detail="Invalid signature")

    event_name = request.headers.get("x-openwa-event")
    event_data = await request.json()

    # Proses event
    return {"status": "ok", "event": event_name}
```

---

## 4. Checklist & Best Practices

1. **Selalu Verifikasi Signature:** Jangan pernah memproses body JSON sebelum signature tervalidasi.
2. **Gunakan Raw Body:** Perhitungan HMAC wajib menggunakan exact raw body string/bytes sebelum di-parse oleh parser JSON middleware.
3. **Constant-Time Comparison:** Wajib menggunakan fungsi anti-timing attack (`hash_equals()` di PHP, `crypto.timingSafeEqual()` di Node.js, `hmac.compare_digest()` di Python).
4. **Idempotency Handling:** Simpan `X-OpenWA-Idempotency-Key` ke Redis / cache selama minimal 24 jam untuk mencegah eksekusi berulang jika OpenWA melakukan retry saat koneksi bermasalah.
5. **Kembalikan Status 2xx Segera:** Kembalikan status HTTP `200` segera setelah payload berhasil diterima dan diverifikasi; proses bisnis yang berat harus didelegasikan ke queue background worker (`dispatch()->afterResponse()` atau `ShouldQueue`).
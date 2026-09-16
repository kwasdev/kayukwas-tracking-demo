'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  MessageSquare,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Lock,
  Phone,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

function AktivasiContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get('token');

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form states
  const [phoneNumber, setPhoneNumber] = useState('081298765432');
  const [magicToken, setMagicToken] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [userName, setUserName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Auto-verify if token is present in URL (e.g. user clicked link from WhatsApp)
  useEffect(() => {
    if (tokenParam) {
      verifyToken(tokenParam);
    }
  }, [tokenParam]);

  const verifyToken = async (token: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{
        token: string;
        phone_mask: string;
        user_name: string;
        expires_at: string;
      }>(`/activation/verify?token=${token}`);

      if (!res.success || !res.data) {
        setError(res.message || 'Tautan aktivasi tidak valid atau telah kadaluarsa. Silakan kirim pesan AKTIVASI ke bot WhatsApp.');
        setLoading(false);
        return;
      }

      setSessionToken(res.data.token);
      setMaskedPhone(res.data.phone_mask);
      setUserName(res.data.user_name);
      setOtpCode(''); // Clean empty field for user to input from WhatsApp
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Gagal memverifikasi tautan aktivasi');
    } finally {
      setLoading(false);
    }
  };

  // 1. User initiates WhatsApp activation by sending message to bot (Step 1 -> Step 2)
  const handleOpenWhatsAppAndRequest = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const botNumber = '6285169758096';
    const message = 'AKTIVASI';
    const waUrl = `https://wa.me/${botNumber}?text=${encodeURIComponent(message)}`;

    // Open WhatsApp in new tab/app so user can send the message
    window.open(waUrl, '_blank');

    // Move web interface to Step 2 (waiting for user's chat)
    setStep(2);
  };

  // 3. Verify OTP & Set Password (Step 3)
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('Kata sandi minimal 6 karakter');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok');
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch('/activation/set-password', {
        method: 'POST',
        body: JSON.stringify({
          token: sessionToken,
          otp: otpCode,
          new_password: newPassword,
        }),
      });

      if (!res.success) {
        setError(res.message || 'Kode OTP salah atau telah kadaluarsa.');
        setLoading(false);
        return;
      }

      setStep(4);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat aktivasi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative selection:bg-amber-500 selection:text-black py-12">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Back button */}
      <div className="w-full max-w-lg mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-amber-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Beranda
        </Link>
      </div>

      <div className="w-full max-w-lg glass-card rounded-2xl p-8 border border-slate-800 shadow-2xl relative z-10">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800/80">
          {[
            { num: 1, label: 'Nomor WA' },
            { num: 2, label: 'Magic Link' },
            { num: 3, label: 'OTP & Sandi' },
            { num: 4, label: 'Selesai' },
          ].map((s) => (
            <div key={s.num} className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                  step === s.num
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                    : step > s.num
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {step > s.num ? '✓' : s.num}
              </div>
              <span className={`text-[10px] mt-1 font-medium ${step >= s.num ? 'text-amber-300' : 'text-slate-500'}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Input WhatsApp Number & Open WhatsApp */}
        {step === 1 && (
          <div>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto mb-3">
                <Phone className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white">Aktivasi Mandiri via WhatsApp</h2>
              <p className="text-xs text-slate-400 mt-1">
                Untuk keamanan dan pencegahan spam, kirim pesan <b>&quot;AKTIVASI&quot;</b> terlebih dahulu ke WhatsApp Bot resmi pabrik.
              </p>
            </div>

            <form onSubmit={handleOpenWhatsAppAndRequest} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Nomor WhatsApp Terdaftar
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Contoh: 08123456789 atau 628123456789"
                    className="w-full pl-10 pr-4 py-3 bg-slate-900/90 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm transition-all font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Nomor harus sudah didaftarkan sebelumnya oleh Superuser di sistem.
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-4 bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer mt-2 text-sm"
              >
                <MessageSquare className="w-5 h-5 fill-current" />
                Kirim Pesan &quot;AKTIVASI&quot; ke Bot WhatsApp
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: Waiting for User's Chat on WhatsApp */}
        {step === 2 && (
          <div className="text-center space-y-6">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto animate-pulse">
              <MessageSquare className="w-6 h-6 fill-current" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">Menunggu Pesan dari Anda</h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Silakan tekan tombol <b>Kirim (Send)</b> pada pesan WhatsApp bertuliskan <b>&quot;AKTIVASI&quot;</b> ke nomor bot <b>+62 851-6975-8096</b>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-emerald-500/30 text-left space-y-2 text-xs">
              <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Langkah Selanjutnya:
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                1. Kirim pesan <b>AKTIVASI</b> ke WhatsApp Bot.<br />
                2. Bot akan otomatis membalas dengan <b>tautan aktivasi mandiri</b> khusus akun Anda.<br />
                3. Ketuk tautan tersebut di WhatsApp untuk masuk ke tahap pembuatan sandi.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleOpenWhatsAppAndRequest()}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <ExternalLink className="w-4 h-4" />
                Buka WhatsApp Lagi
              </button>

              <button
                onClick={() => setStep(1)}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Ganti Nomor WhatsApp
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: OTP Verification & Set Password */}
        {step === 3 && (
          <div>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto mb-3">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white">Verifikasi OTP & Atur Sandi</h2>
              <p className="text-xs text-slate-400 mt-1">
                Halo <b>{userName}</b>, masukkan 6 digit kode verifikasi yang dikirim ke <b>{maskedPhone}</b> (Berlaku 5 menit).
              </p>
            </div>

            <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="leading-relaxed text-left">
                Kode verifikasi 6 digit telah dikirimkan ke pesan WhatsApp nomor <b>{maskedPhone}</b>. Silakan periksa aplikasi WhatsApp Anda dan masukkan 6 digit kode tersebut di bawah ini.
              </div>
            </div>

            <form onSubmit={handleSetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Kode Verifikasi OTP (6 Digit)
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="123456"
                  className="w-full text-center tracking-[0.5em] text-lg font-mono py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-amber-400 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-all font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Kata Sandi Baru Pribadi
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-4 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Ulangi Kata Sandi Baru
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi di atas"
                  className="w-full px-4 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer mt-6"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    Aktifkan Akun Saya Sekarang
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* STEP 4: Activation Success */}
        {step === 4 && (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white">Akun Berhasil Diaktifkan!</h2>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                Nomor WhatsApp dan kata sandi Anda telah terverifikasi secara sah. Status akun Anda kini <b>ACTIVE</b>.
              </p>
            </div>

            {/* Cold Bonding Reminder card */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-left text-xs space-y-2 text-slate-300">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-amber-400" />
                PENTING: Simpan Kontak Bot KWAS
              </div>
              <p className="text-slate-400 leading-relaxed">
                Silakan simpan nomor WhatsApp Bot resmi sistem kami dengan nama <b>"Sistem Produksi KWAS"</b> agar notifikasi instruksi kerja SPK dan surat jalan logistik dapat masuk tanpa terblokir filter spam.
              </p>
            </div>

            <button
              onClick={() => router.push('/login')}
              className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              Masuk ke Halaman Login
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AktivasiPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0b0f17] flex items-center justify-center text-amber-400 font-mono">Memuat Aktivasi...</div>}>
      <AktivasiContent />
    </Suspense>
  );
}

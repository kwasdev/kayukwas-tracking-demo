'use client';

import Link from 'next/link';
import { ShieldCheck, MessageSquare, Users, Cpu, ArrowRight, CheckCircle2, Lock } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f17] text-slate-100 selection:bg-amber-500 selection:text-black">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-[#0f1523]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl wood-gradient flex items-center justify-center font-bold text-slate-950 text-xl shadow-lg shadow-amber-500/20">
              KW
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white block leading-none">Kayu KWAS</span>
              <span className="text-xs text-amber-400 font-medium">Production & SPK Tracking</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              href="/aktivasi"
              className="text-sm font-medium px-4 py-2 rounded-lg border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 transition-colors flex items-center gap-1.5"
            >
              <MessageSquare className="w-4 h-4 text-amber-400" />
              Aktivasi WhatsApp
            </Link>
            <Link
              href="/login"
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5"
            >
              <Lock className="w-4 h-4" />
              Masuk Sistem
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 py-16 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold mb-6 animate-pulse">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          Sistem Manajemen Akun & RBAC Berbasis WhatsApp Cold Bonding
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl leading-tight sm:leading-tight">
          Kendali Hak Akses Terpusat & Aktivasi Mandiri Industri Kayu
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl leading-relaxed">
          Platform manajemen peran multi-user dengan otentikasi aman tanpa bocor kata sandi. Terintegrasi langsung dengan WhatsApp Gateway untuk tim pabrik dan bengkel mitra.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center">
          <Link
            href="/login"
            className="px-8 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-base shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
          >
            Masuk ke Dashboard Superuser
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/aktivasi"
            className="px-8 py-3.5 rounded-xl glass-panel hover:bg-slate-800/80 text-amber-200 border border-amber-500/30 font-semibold text-base flex items-center justify-center gap-2 transition-all"
          >
            <MessageSquare className="w-5 h-5 text-amber-400" />
            Aktivasi Akun Mandiri (Karyawan/Mitra)
          </Link>
        </div>

        {/* 3 Core Features Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 text-left w-full">
          <div className="glass-card p-6 rounded-2xl border border-slate-800 hover:border-amber-500/30 transition-all">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">RBAC & Superuser Bypass</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Dukungan rangkap jabatan multi-role (*Union Permissions*) serta kendali mutlak Superuser untuk mengelola hak akses seluruh lantai pabrik.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-slate-800 hover:border-amber-500/30 transition-all">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">WhatsApp Cold Bonding</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Superuser mendaftarkan nomor telepon tanpa password. Calon pengguna mengaktifkan akunnya sendiri via Magic Link 15 menit & OTP 6-digit.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-slate-800 hover:border-amber-500/30 transition-all">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
              <Cpu className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Buku Tamu Audit Trail</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Setiap kali terjadi pendaftaran user baru, perubahan jabatan, aktivasi OTP, atau login sistem, seluruh jejak rekam dicatat secara permanen.
            </p>
          </div>
        </div>

        {/* Superuser Credentials Note */}
        <div className="mt-14 p-4 rounded-xl glass-panel border border-amber-500/30 max-w-lg w-full flex items-start gap-3 text-left">
          <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300">
            <span className="font-semibold text-amber-300 block mb-1">Kredensial Akun Administrator:</span>
            <div className="font-mono bg-slate-900/80 p-2 rounded border border-slate-800 text-slate-200">
              Email: <b>admin@kayukwas.co.id</b><br />
              Sandi: <b>AdminKWAS2026!</b>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        © 2026 Kayu KWAS Tracking System — Industri Peralatan Dapur Kayu.
      </footer>
    </div>
  );
}

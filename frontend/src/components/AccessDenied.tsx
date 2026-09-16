'use client';

import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import Link from 'next/link';

interface AccessDeniedProps {
  title?: string;
  message?: string;
  requiredPermission?: string;
}

export default function AccessDenied({
  title = 'Akses Dibatasi (403 Forbidden)',
  message = 'Akun dan peran Anda saat ini tidak memiliki izin untuk membuka atau mengelola modul ini.',
  requiredPermission,
}: AccessDeniedProps) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="glass-card p-8 rounded-3xl border border-red-500/20 max-w-lg w-full space-y-6 shadow-2xl relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
          <p className="text-xs text-slate-400 leading-relaxed">{message}</p>
          {requiredPermission && (
            <div className="inline-block mt-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[11px] font-mono text-amber-400">
              Izin Diperlukan: <span className="text-white font-semibold">{requiredPermission}</span>
            </div>
          )}
        </div>

        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20"
          >
            <Home className="w-4 h-4" />
            Kembali ke Dashboard Utama
          </Link>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { History, Search, Clock, User, ShieldAlert, Loader2, RefreshCw } from 'lucide-react';
import { apiFetch, AuditLog, User as UserType, getStoredUser, hasPermission, isSuperuser } from '@/lib/api';
import AccessDenied from '@/components/AccessDenied';

export default function AuditLogsPage() {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ audit_logs: AuditLog[]; total: number; page: number }>(
        `/audit-logs?page=${page}&limit=${limit}`
      );
      if (res.success && res.data) {
        setLogs(res.data.audit_logs || []);
        setTotal(res.data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user);
    if (user && (isSuperuser(user) || hasPermission(user, 'lihat catatan aktivitas'))) {
      fetchLogs();
    } else {
      setLoading(false);
    }
  }, [page]);

  if (!loading && currentUser && !isSuperuser(currentUser) && !hasPermission(currentUser, 'lihat catatan aktivitas')) {
    return <AccessDenied requiredPermission="lihat catatan aktivitas" />;
  }

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'account_activated':
      case 'create_user':
      case 'create_role':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'update_user':
      case 'sync_role_permissions':
      case 'toggle_user_status':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'auth_login':
      case 'system_initialized':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
      case 'auth_failed':
      case 'wa_otp_failed':
      case 'delete_role':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-amber-400" />
            Buku Tamu Jejak Rekam (Audit Trail)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Log permanen mutasi hak akses, pendaftaran user baru, perubahan peran, dan event keamanan sistem.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Segarkan Data
        </button>
      </div>

      {/* Logs Table */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Waktu Kejadian</th>
                <th className="py-3.5 px-4 font-semibold">Aktor / Pengguna</th>
                <th className="py-3.5 px-4 font-semibold">Tipe Aksi</th>
                <th className="py-3.5 px-4 font-semibold">Deskripsi Aktivitas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-400" />
                    Memuat catatan audit...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    Belum ada log aktivitas tercatat.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500/80" />
                        {new Date(log.created_at).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {log.user ? (
                        <div>
                          <div className="font-bold text-white text-xs">{log.user.name}</div>
                          <div className="text-[10px] text-slate-400">{log.user.email}</div>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic text-[11px]">Sistem / Tamu</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-bold uppercase inline-block ${getActionBadgeColor(
                          log.action_type
                        )}`}
                      >
                        {log.action_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-200 text-xs max-w-md break-words">
                      {log.description}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Menampilkan <b>{logs.length}</b> dari total <b>{total}</b> log
          </div>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-medium"
            >
              Sebelumnya
            </button>
            <span className="px-3 py-1 font-bold text-amber-400 bg-slate-900 rounded-lg border border-slate-800">
              Halaman {page}
            </span>
            <button
              disabled={page * limit >= total}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-medium"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

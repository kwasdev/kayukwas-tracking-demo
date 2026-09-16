'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  CheckCircle2,
  XCircle,
  Shield,
  Edit2,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  Loader2,
  Phone,
  Mail,
  User,
  X,
  Sparkles,
} from 'lucide-react';
import { apiFetch, User as UserType, Role, getStoredUser, hasPermission, isSuperuser } from '@/lib/api';
import AccessDenied from '@/components/AccessDenied';

export default function UsersPage() {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [users, setUsers] = useState<UserType[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editUserId, setEditUserId] = useState<number | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRoleIds, setFormRoleIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user);
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await apiFetch<{ users: UserType[]; total: number }>(`/users?search=${encodeURIComponent(search)}`);
      if (res.success && res.data) {
        setUsers(res.data.users || []);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await apiFetch<Role[]>('/roles');
      if (res.success && res.data) {
        setRoles(res.data);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    const user = getStoredUser();
    if (user && (isSuperuser(user) || hasPermission(user, 'kelola pengguna'))) {
      Promise.all([fetchUsers(), fetchRoles()]).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [search]);

  if (!loading && currentUser && !isSuperuser(currentUser) && !hasPermission(currentUser, 'kelola pengguna')) {
    return <AccessDenied requiredPermission="kelola pengguna" />;
  }

  const handleOpenCreate = () => {
    setModalMode('create');
    setEditUserId(null);
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormRoleIds([]);
    setError(null);
    setSuccess(null);
    setShowModal(true);
  };

  const handleOpenEdit = (u: UserType) => {
    setModalMode('edit');
    setEditUserId(u.id);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormPhone(u.phone_number || '');
    setFormRoleIds(u.roles?.map((r) => r.id) || []);
    setError(null);
    setSuccess(null);
    setShowModal(true);
  };

  const handleToggleRole = (roleId: number) => {
    setFormRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      if (modalMode === 'create') {
        const res = await apiFetch('/users', {
          method: 'POST',
          body: JSON.stringify({
            name: formName,
            email: formEmail,
            phone_number: formPhone,
            role_ids: formRoleIds,
          }),
        });

        if (!res.success) {
          setError(res.message || 'Gagal mendaftarkan calon pengguna');
          setSubmitting(false);
          return;
        }

        setSuccess('Calon pengguna berhasil didaftarkan dengan status PENDING_ACTIVATION!');
      } else if (editUserId) {
        const res = await apiFetch(`/users/${editUserId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: formName,
            email: formEmail,
            phone_number: formPhone,
            role_ids: formRoleIds,
          }),
        });

        if (!res.success) {
          setError(res.message || 'Gagal memperbarui pengguna');
          setSubmitting(false);
          return;
        }

        setSuccess('Data pengguna dan penugasan peran berhasil diperbarui!');
      }

      setShowModal(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (u: UserType) => {
    const nextStatus = !u.is_active;
    try {
      const res = await apiFetch(`/users/${u.id}/toggle-active`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: nextStatus }),
      });

      if (res.success) {
        setSuccess(`Status pengguna ${u.name} berhasil diubah!`);
        fetchUsers();
      } else {
        setError(res.message || 'Gagal mengubah status pengguna');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Title & Action Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-400" />
            Manajemen Pengguna & Jabatan
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Pendaftaran calon karyawan terpusat oleh Superuser tanpa kata sandi manual (Aktivasi mandiri WhatsApp).
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Tambah Calon Pengguna Baru
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
          <span>{success}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="glass-card p-4 rounded-xl border border-slate-800">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama karyawan, email, atau nomor WhatsApp..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs transition-all"
          />
        </div>
      </div>

      {/* User Table */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Nama & Email</th>
                <th className="py-3.5 px-4 font-semibold">No. WhatsApp</th>
                <th className="py-3.5 px-4 font-semibold">Peran / Jabatan</th>
                <th className="py-3.5 px-4 font-semibold">Status Aktivasi</th>
                <th className="py-3.5 px-4 font-semibold">Keaktifan</th>
                <th className="py-3.5 px-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-400" />
                    Memuat data pengguna...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Tidak ada pengguna ditemukan.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white text-sm">{u.name}</div>
                      <div className="text-[11px] text-slate-400">{u.email}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {u.phone_number || <span className="text-slate-600">-</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {u.roles && u.roles.length > 0 ? (
                          u.roles.map((r) => (
                            <span
                              key={r.id}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium"
                            >
                              {r.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">Tanpa Peran</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {u.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold animate-pulse">
                          PENDING_ACTIVATION
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleToggleActive(u)}
                        title="Klik untuk mengubah status aktif"
                        className="cursor-pointer"
                      >
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                            <ToggleRight className="w-5 h-5 text-emerald-400" />
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-red-400 font-semibold">
                            <ToggleLeft className="w-5 h-5 text-slate-600" />
                            Nonaktif
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px] font-medium"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit Peran
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Create / Edit User */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-400" />
                {modalMode === 'create' ? 'Tambah Calon Pengguna Baru' : 'Edit Data & Penugasan Peran'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalMode === 'create' && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <span>
                  <b>Aturan Keamanan Sistem:</b> Kata sandi sengaja dikosongkan. Pengguna akan melakukan aktivasi mandiri dan menentukan sandi pribadinya melalui verifikasi WhatsApp.
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Nama Lengkap Karyawan / Mitra
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Budi Santoso - Pengrajin"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Alamat Email Kantor / Pribadi
                </label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="budi@kayukwas.co.id"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Nomor WhatsApp Aktif (Untuk Aktivasi Cold Bonding)
                </label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="08123456789 atau 628123456789"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {/* Multi-Role Checklist */}
              <div>
                <label className="block font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                  Penugasan Jabatan / Peran (Multi-Role Support)
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-slate-900/80 rounded-xl border border-slate-800">
                  {roles.map((r) => (
                    <label
                      key={r.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                        formRoleIds.includes(r.id)
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 font-semibold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formRoleIds.includes(r.id)}
                        onChange={() => handleToggleRole(r.id)}
                        className="rounded border-slate-700 text-amber-500 focus:ring-amber-500"
                      />
                      <span>{r.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      {modalMode === 'create' ? 'Daftarkan Pengguna' : 'Simpan Perubahan'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

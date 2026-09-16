'use client';

import { useState, useEffect } from 'react';
import {
  Shield,
  ShieldPlus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Lock,
  X,
  Sparkles,
  Key,
} from 'lucide-react';
import { apiFetch, Role, Permission, User as UserType, getStoredUser, hasPermission, isSuperuser } from '@/lib/api';
import AccessDenied from '@/components/AccessDenied';

export default function RolesPage() {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit Permissions Modal
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedPermIds, setSelectedPermIds] = useState<number[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);

  // Create Role Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [creatingRole, setCreatingRole] = useState(false);

  const fetchData = async () => {
    try {
      const [rolesRes, permsRes] = await Promise.all([
        apiFetch<Role[]>('/roles'),
        apiFetch<Permission[]>('/permissions'),
      ]);

      if (rolesRes.success && rolesRes.data) {
        setRoles(rolesRes.data);
      }
      if (permsRes.success && permsRes.data) {
        setPermissions(permsRes.data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user);
    if (user && (isSuperuser(user) || hasPermission(user, 'kelola peran') || hasPermission(user, 'kelola akses'))) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, []);

  if (!loading && currentUser && !isSuperuser(currentUser) && !hasPermission(currentUser, 'kelola peran') && !hasPermission(currentUser, 'kelola akses')) {
    return <AccessDenied requiredPermission="kelola peran / kelola akses" />;
  }

  const handleOpenEditPerms = (role: Role) => {
    setSelectedRole(role);
    setSelectedPermIds(role.permissions?.map((p) => p.id) || []);
    setError(null);
    setSuccess(null);
  };

  const handleTogglePerm = (permId: number) => {
    setSelectedPermIds((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  const handleSavePerms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    setSavingPerms(true);
    setError(null);

    try {
      const res = await apiFetch(`/roles/${selectedRole.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permission_ids: selectedPermIds }),
      });

      if (!res.success) {
        setError(res.message || 'Gagal memperbarui izin peran');
        setSavingPerms(false);
        return;
      }

      setSuccess(`Hak akses untuk peran ${selectedRole.name} berhasil diperbarui!`);
      setSelectedRole(null);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingPerms(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName) return;
    setCreatingRole(true);
    setError(null);

    try {
      const res = await apiFetch('/roles', {
        method: 'POST',
        body: JSON.stringify({ name: newRoleName, permission_ids: [] }),
      });

      if (!res.success) {
        setError(res.message || 'Gagal membuat peran baru');
        setCreatingRole(false);
        return;
      }

      setSuccess(`Peran ${newRoleName} berhasil dibuat!`);
      setNewRoleName('');
      setShowCreateModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingRole(false);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (role.name === 'Superuser') {
      setError('Peran Superuser tidak boleh dihapus.');
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus peran "${role.name}"?`)) return;

    try {
      const res = await apiFetch(`/roles/${role.id}`, { method: 'DELETE' });
      if (res.success) {
        setSuccess(`Peran ${role.name} berhasil dihapus!`);
        fetchData();
      } else {
        setError(res.message || 'Gagal menghapus peran (mungkin sedang digunakan user aktif).');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-amber-400" />
            Matriks Peran & Hak Akses (RBAC)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Konfigurasi paket izin per jabatan operasional sistem dengan mekanisme Superuser Bypass dan Union Permissions.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer shrink-0"
        >
          <ShieldPlus className="w-4 h-4" />
          Tambah Peran Baru
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

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
            Memuat daftar peran...
          </div>
        ) : (
          roles.map((role) => {
            const isSuperuser = role.name === 'Superuser';
            return (
              <div
                key={role.id}
                className="glass-card rounded-2xl border border-slate-800 p-5 flex flex-col justify-between hover:border-amber-500/30 transition-all space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xs">
                        {role.name.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="font-bold text-white text-base">{role.name}</span>
                    </div>

                    {isSuperuser && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Bypass All
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400 font-semibold mb-2">Hak Akses Terdaftar:</div>

                  <div className="flex flex-wrap gap-1.5 min-h-[60px]">
                    {isSuperuser ? (
                      <span className="text-[10px] px-2 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
                        ✨ Seluruh Izin Sistem (Superuser Bypass)
                      </span>
                    ) : role.permissions && role.permissions.length > 0 ? (
                      role.permissions.map((p) => (
                        <span
                          key={p.id}
                          className="text-[10px] px-2 py-0.5 rounded bg-slate-800/90 text-slate-300 border border-slate-700 font-medium"
                        >
                          {p.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-500 italic">Belum ada izin ditetapkan</span>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenEditPerms(role)}
                    disabled={isSuperuser}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-amber-400 text-xs font-semibold border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5" />
                    Atur Hak Akses
                  </button>

                  {!isSuperuser && (
                    <button
                      onClick={() => handleDeleteRole(role)}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors cursor-pointer"
                      title="Hapus Peran"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Permissions Modal */}
      {selectedRole && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-amber-400" />
                  Atur Izin: Peran {selectedRole.name}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tandai butir-butir hak akses yang diizinkan untuk jabatan ini.
                </p>
              </div>
              <button
                onClick={() => setSelectedRole(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePerms} className="space-y-4">
              <div className="space-y-2 max-h-72 overflow-y-auto p-2 bg-slate-900/80 rounded-xl border border-slate-800">
                {permissions.map((perm) => (
                  <label
                    key={perm.id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      selectedPermIds.includes(perm.id)
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPermIds.includes(perm.id)}
                      onChange={() => handleTogglePerm(perm.id)}
                      className="rounded border-slate-700 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-xs">{perm.name}</span>
                  </label>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedRole(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingPerms}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
                >
                  {savingPerms ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Simpan Paket Izin
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Role Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldPlus className="w-5 h-5 text-amber-400" />
                Tambah Peran / Jabatan Baru
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Nama Jabatan / Peran
                </label>
                <input
                  type="text"
                  required
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="Contoh: Staff Gudang Kemas"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creatingRole}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
                >
                  {creatingRole ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Membuat...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Buat Peran
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

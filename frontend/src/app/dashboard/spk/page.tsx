'use client';

import { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  User,
  Shield,
  ArrowRight,
  Flame,
  X,
  Sparkles,
  ClipboardCheck,
  Building,
  UserCheck,
} from 'lucide-react';
import { apiFetch, WorkOrder, Product, User as UserType, getStoredUser, hasPermission, isSuperuser, hasRole } from '@/lib/api';

export default function SPKPage() {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number>(0);
  const [targetQty, setTargetQty] = useState<number>(200);
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [deadlineDays, setDeadlineDays] = useState<number>(5);
  const [submittingSPK, setSubmittingSPK] = useState(false);

  // Assign Worker Modal
  const [assignModalWOS, setAssignModalWOS] = useState<any | null>(null);
  const [assignedType, setAssignedType] = useState<'internal' | 'mitra'>('internal');
  const [assignedUserId, setAssignedUserId] = useState<number | undefined>(undefined);
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // Progress Report Modal
  const [reportModalWOS, setReportModalWOS] = useState<any | null>(null);
  const [reportPassQty, setReportPassQty] = useState<number>(50);
  const [reportRejQty, setReportRejQty] = useState<number>(0);
  const [reportNotes, setReportNotes] = useState<string>('');
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, []);

  const canCreateSPK = isSuperuser(currentUser) || hasRole(currentUser, 'PPIC') || hasPermission(currentUser, 'kelola spk');
  const canAssignWorker = isSuperuser(currentUser) || hasRole(currentUser, 'PPIC') || hasRole(currentUser, 'Mandor') || hasPermission(currentUser, 'kelola spk');
  const canReportProgress = isSuperuser(currentUser) || hasRole(currentUser, 'Operator') || hasRole(currentUser, 'Mitra') || hasRole(currentUser, 'Mandor') || hasPermission(currentUser, 'verifikasi laporan produksi') || hasPermission(currentUser, 'kelola spk');

  const fetchSPKs = async () => {
    try {
      const res = await apiFetch<{ work_orders: WorkOrder[]; total: number }>(
        `/spk?search=${encodeURIComponent(search)}`
      );
      if (res.success && res.data) {
        setWorkOrders(res.data.work_orders || []);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchMeta = async () => {
    try {
      const prodRes = await apiFetch<{ products: Product[] }>('/products?limit=100');
      if (prodRes.success && prodRes.data) setProducts(prodRes.data.products || []);
      
      const userRes = await apiFetch<{ users: UserType[] }>('/users?limit=100');
      if (userRes.success && userRes.data) setUsers(userRes.data.users || []);
    } catch (err) {
      // Ignored for non-admin roles where /users might be forbidden
    }
  };

  useEffect(() => {
    Promise.all([fetchSPKs(), fetchMeta()]).finally(() => setLoading(false));
  }, [search]);

  const handleCreateSPK = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return;
    setSubmittingSPK(true);
    setError(null);

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + Number(deadlineDays));

    try {
      const res = await apiFetch('/spk', {
        method: 'POST',
        body: JSON.stringify({
          product_id: Number(selectedProductId),
          total_target_qty: Number(targetQty),
          priority: priority,
          deadline_date: deadline.toISOString(),
        }),
      });

      if (!res.success) {
        setError(res.message || 'Gagal menerbitkan SPK');
        setSubmittingSPK(false);
        return;
      }

      setSuccess(`SPK baru berhasil diterbitkan dengan 5 alur stasiun routing otomatis!`);
      setShowCreateModal(false);
      fetchSPKs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingSPK(false);
    }
  };

  const handleOpenAssign = (wos: any) => {
    setAssignModalWOS(wos);
    setAssignedType(wos.assigned_type || 'internal');
    setAssignedUserId(wos.assigned_user_id || undefined);
    setError(null);
  };

  const handleSaveAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalWOS) return;
    setSubmittingAssign(true);
    setError(null);

    try {
      const res = await apiFetch(`/spk/stations/${assignModalWOS.id}/assign`, {
        method: 'PUT',
        body: JSON.stringify({
          assigned_type: assignedType,
          assigned_user_id: assignedUserId ? Number(assignedUserId) : null,
        }),
      });

      if (!res.success) {
        setError(res.message || 'Gagal memperbarui penugasan');
        setSubmittingAssign(false);
        return;
      }

      setSuccess('Penugasan stasiun berhasil diperbarui!');
      setAssignModalWOS(null);
      fetchSPKs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingAssign(false);
    }
  };

  const handleOpenReport = (wos: any) => {
    setReportModalWOS(wos);
    setReportPassQty(50);
    setReportRejQty(0);
    setReportNotes('');
    setError(null);
  };

  const handleSaveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportModalWOS) return;
    setSubmittingReport(true);
    setError(null);

    try {
      const res = await apiFetch(`/spk/stations/${reportModalWOS.id}/progress`, {
        method: 'POST',
        body: JSON.stringify({
          log_type: 'progress_report',
          reported_qty_pass: Number(reportPassQty),
          reported_qty_reject: Number(reportRejQty),
          notes: reportNotes,
          channel: 'web',
        }),
      });

      if (!res.success) {
        setError(res.message || 'Gagal menyimpan laporan progres');
        setSubmittingReport(false);
        return;
      }

      setSuccess('Laporan progres pengerjaan stasiun berhasil dicatat!');
      setReportModalWOS(null);
      fetchSPKs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingReport(false);
    }
  };

  const getStationStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'in_progress':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse';
      case 'qc_wait':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
      default:
        return 'bg-slate-800 text-slate-500 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-amber-400" />
            Pelacakan & Penerbitan SPK (5 Stasiun Kerja)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Pantau pergerakan Surat Perintah Kerja (SPK) dari Wood Working hingga Packing & Serah Terima Barang Jadi.
          </p>
        </div>

        {canCreateSPK && (
          <button
            onClick={() => {
              if (products.length > 0 && !selectedProductId) {
                setSelectedProductId(products[0].id);
              }
              setShowCreateModal(true);
            }}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Terbitkan SPK Baru
          </button>
        )}
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
            placeholder="Cari Nomor SPK (misal: SPK-2026-09-0012) atau nama produk..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs transition-all"
          />
        </div>
      </div>

      {/* SPK List with 5-Station Kanban Flow */}
      <div className="space-y-5">
        {loading ? (
          <div className="py-12 text-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
            Memuat data SPK...
          </div>
        ) : workOrders.length === 0 ? (
          <div className="glass-card p-12 text-center text-slate-500 rounded-2xl border border-slate-800">
            Belum ada SPK terbit. Klik "Terbitkan SPK Baru" untuk memulai perintah kerja.
          </div>
        ) : (
          workOrders.map((wo) => (
            <div
              key={wo.id}
              className="glass-card rounded-2xl border border-slate-800 p-6 space-y-5 shadow-xl hover:border-amber-500/30 transition-all"
            >
              {/* SPK Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-800/80 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-sm font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                      {wo.spk_number}
                    </span>
                    <h2 className="text-base font-bold text-white">{wo.product?.product_name}</h2>
                    <span className="text-[11px] font-mono text-slate-400">[{wo.product?.product_code}]</span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-3">
                    <span>
                      Target: <b className="text-white">{wo.total_target_qty} pcs</b>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3 h-3 text-amber-400" />
                      Deadline:{' '}
                      {wo.deadline_date
                        ? new Date(wo.deadline_date).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '-'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {wo.priority === 'urgent' && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold animate-pulse">
                      <Flame className="w-3.5 h-3.5" />
                      URGENT
                    </span>
                  )}
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700 uppercase">
                    {wo.status}
                  </span>
                </div>
              </div>

              {/* 5 Work Stations Pipeline */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {wo.stations?.map((wos, idx) => {
                  const isExternal = wos.assigned_type === 'mitra';
                  return (
                    <div
                      key={wos.id}
                      className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between space-y-3 relative group"
                    >
                      <div>
                        {/* Station Name & Status */}
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold text-slate-400">
                            {idx + 1}. {wos.station?.name}
                          </span>
                        </div>

                        <div className="mb-2">
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full border font-bold uppercase ${getStationStatusBadge(
                              wos.status
                            )}`}
                          >
                            {wos.status}
                          </span>
                        </div>

                        {/* Progress metrics */}
                        <div className="space-y-1 text-[11px]">
                          <div className="flex justify-between text-slate-300">
                            <span>Selesai (Pass):</span>
                            <b className="text-emerald-400 font-mono">{wos.completed_qty} pcs</b>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>Cacat (Reject):</span>
                            <b className="text-red-400 font-mono">{wos.reject_qty} pcs</b>
                          </div>
                          <div className="flex justify-between text-slate-500 text-[10px]">
                            <span>Input:</span>
                            <span className="font-mono">{wos.input_qty} pcs</span>
                          </div>
                        </div>

                        {/* Assigned Worker */}
                        <div className="mt-3 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
                          <div className="flex items-center gap-1 font-semibold text-slate-300 mb-0.5">
                            {isExternal ? (
                              <Building className="w-3 h-3 text-amber-400" />
                            ) : (
                              <User className="w-3 h-3 text-blue-400" />
                            )}
                            <span>{isExternal ? 'Mitra Borongan' : 'In-House Pabrik'}</span>
                          </div>
                          <div className="truncate text-slate-300 font-medium">
                            {wos.assigned_user?.name || (
                              <span className="italic text-slate-500">Belum ditugaskan</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {(canAssignWorker || canReportProgress) && (
                        <div className="pt-2 border-t border-slate-800 flex gap-1.5">
                          {canAssignWorker && (
                            <button
                              onClick={() => handleOpenAssign(wos)}
                              className="flex-1 py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-[10px] font-semibold transition-colors cursor-pointer"
                            >
                              Tugaskan
                            </button>
                          )}
                          {canReportProgress && (
                            <button
                              onClick={() => handleOpenReport(wos)}
                              className="flex-1 py-1 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold transition-colors cursor-pointer"
                            >
                              Lapor
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create SPK Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                Penerbitan Surat Perintah Kerja (SPK) Baru
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSPK} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Pilih Produk Kitchenware (47 Katalog Master)
                </label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.product_name} ({p.product_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Target Kuantitas (Pcs)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={targetQty}
                    onChange={(e) => setTargetQty(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Tingkat Prioritas
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent / Prioritas Tinggi</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Target Waktu Selesai (Hari dari Sekarang)
                </label>
                <input
                  type="number"
                  min={1}
                  value={deadlineDays}
                  onChange={(e) => setDeadlineDays(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <span className="font-semibold text-amber-300 block">Otomasi Sistem:</span>
                <p>
                  Sistem akan secara otomatis membuat 5 tahapan stasiun kerja berurutan: <b>Wood Working</b> ➔ <b>Pasca Wood Working</b> ➔ <b>Finishing</b> ➔ <b>Pasca Finishing (In-House)</b> ➔ <b>Packing (In-House)</b>.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingSPK}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
                >
                  {submittingSPK ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menerbitkan...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Terbitkan SPK
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Worker Modal */}
      {assignModalWOS && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-amber-400" />
                Penugasan: {assignModalWOS.station?.name}
              </h2>
              <button
                onClick={() => setAssignModalWOS(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAssign} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Tipe Pelaksana
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignedType('internal')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                      assignedType === 'internal'
                        ? 'bg-amber-500 text-slate-950 font-bold border-amber-500'
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    In-House Pabrik
                  </button>

                  <button
                    type="button"
                    disabled={!assignModalWOS.station?.is_external_allowed}
                    onClick={() => setAssignedType('mitra')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                      assignedType === 'mitra'
                        ? 'bg-amber-500 text-slate-950 font-bold border-amber-500'
                        : 'bg-slate-900 border-slate-700 text-slate-400 disabled:opacity-30'
                    }`}
                  >
                    <Building className="w-4 h-4" />
                    Mitra Produksi
                  </button>
                </div>
                {!assignModalWOS.station?.is_external_allowed && (
                  <p className="text-[11px] text-amber-400/90 mt-1.5">
                    * Stasiun 4 & 5 diwajibkan 100% In-House pabrik demi standar mutu dan kerahasiaan grafir kemasan.
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Pilih Pekerja / Mitra Penanggung Jawab
                </label>
                <select
                  value={assignedUserId || ''}
                  onChange={(e) => setAssignedUserId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Pilih Pekerja / Mitra --</option>
                  {users
                    .filter((u) => u.is_active)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                </select>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAssignModalWOS(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingAssign}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
                >
                  {submittingAssign ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Simpan Penugasan
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Progress Report Modal */}
      {reportModalWOS && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-amber-400" />
                Lapor Progres: {reportModalWOS.station?.name}
              </h2>
              <button
                onClick={() => setReportModalWOS(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReport} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Jumlah Bagus (Pass)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={reportPassQty}
                    onChange={(e) => setReportPassQty(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-emerald-400 focus:outline-none focus:border-amber-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Jumlah Cacat (Reject)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={reportRejQty}
                    onChange={(e) => setReportRejQty(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-red-400 focus:outline-none focus:border-amber-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Catatan Pekerjaan / Penyebab Cacat
                </label>
                <textarea
                  rows={2}
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  placeholder="Contoh: 5 pcs pecah serat saat serut, sisa pengerjaan aman."
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReportModalWOS(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingReport}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
                >
                  {submittingReport ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Simpan Laporan
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

'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
  Building,
  Tag,
  DollarSign,
  Layers,
} from 'lucide-react';
import { apiFetch, MitraProductStationAssignment, User as UserType, Product, WorkStation, getStoredUser, hasPermission, isSuperuser } from '@/lib/api';
import AccessDenied from '@/components/AccessDenied';

export default function MitraAssignmentsPage() {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [assignments, setAssignments] = useState<MitraProductStationAssignment[]>([]);
  const [mitras, setMitras] = useState<UserType[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stations, setStations] = useState<WorkStation[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedMitraId, setSelectedMitraId] = useState<number>(0);
  const [selectedProductId, setSelectedProductId] = useState<number>(0);
  const [selectedStationId, setSelectedStationId] = useState<number>(0);
  const [pieceRateFee, setPieceRateFee] = useState<number>(3500);
  const [dailyCapacity, setDailyCapacity] = useState<number>(200);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [assignRes, userRes, prodRes, stRes] = await Promise.all([
        apiFetch<MitraProductStationAssignment[]>('/mitra-assignments'),
        apiFetch<{ users: UserType[] }>('/users?limit=100'),
        apiFetch<{ products: Product[] }>('/products?limit=100'),
        apiFetch<WorkStation[]>('/stations'),
      ]);

      if (assignRes.success && assignRes.data) setAssignments(assignRes.data);
      if (userRes.success && userRes.data) setMitras(userRes.data.users?.filter((u) => u.is_active) || []);
      if (prodRes.success && prodRes.data) setProducts(prodRes.data.products || []);
      if (stRes.success && stRes.data) setStations(stRes.data.filter((s) => s.is_external_allowed));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user);
    if (user && (isSuperuser(user) || hasPermission(user, 'kelola stasiun & routing') || hasPermission(user, 'kelola spk'))) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, []);

  if (!loading && currentUser && !isSuperuser(currentUser) && !hasPermission(currentUser, 'kelola stasiun & routing') && !hasPermission(currentUser, 'kelola spk')) {
    return <AccessDenied requiredPermission="kelola stasiun & routing" />;
  }

  const handleOpenCreate = () => {
    if (mitras.length > 0) setSelectedMitraId(mitras[0].id);
    if (products.length > 0) setSelectedProductId(products[0].id);
    if (stations.length > 0) setSelectedStationId(stations[0].id);
    setPieceRateFee(3500);
    setDailyCapacity(200);
    setNotes('');
    setShowModal(true);
    setError(null);
    setSuccess(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await apiFetch('/mitra-assignments', {
        method: 'POST',
        body: JSON.stringify({
          mitra_user_id: Number(selectedMitraId),
          product_id: Number(selectedProductId),
          station_id: Number(selectedStationId),
          piece_rate_fee: Number(pieceRateFee),
          daily_capacity_estimate: Number(dailyCapacity),
          notes: notes,
        }),
      });

      if (!res.success) {
        setError(res.message || 'Gagal menyimpan penugasan mitra');
        setSubmitting(false);
        return;
      }

      setSuccess('Penugasan spesialisasi produk dan stasiun mitra berhasil disimpan!');
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus pemetaan spesialisasi ini?')) return;
    try {
      const res = await apiFetch(`/mitra-assignments/${id}`, { method: 'DELETE' });
      if (res.success) {
        setSuccess('Penugasan mitra berhasil dihapus!');
        fetchData();
      } else {
        setError(res.message || 'Gagal menghapus penugasan');
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
            <Building className="w-6 h-6 text-amber-400" />
            Matriks Spesialisasi Produk & Stasiun Mitra
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Aturan pemetaan 3 dimensi [Mitra] + [Produk] + [Stasiun 1 s.d. 3] dan tarif upah borongan per pcs produk selesai.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Petakan Spesialisasi Mitra
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

      {/* Assignments Table */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Nama Pengrajin / Mitra</th>
                <th className="py-3.5 px-4 font-semibold">Spesialisasi Produk</th>
                <th className="py-3.5 px-4 font-semibold">Stasiun Kerja Diizinkan</th>
                <th className="py-3.5 px-4 font-semibold">Tarif Borongan (Per Pcs)</th>
                <th className="py-3.5 px-4 font-semibold">Kapasitas / Hari</th>
                <th className="py-3.5 px-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-400" />
                    Memuat matriks spesialisasi mitra...
                  </td>
                </tr>
              ) : assignments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Belum ada penugasan spesialisasi mitra.
                  </td>
                </tr>
              ) : (
                assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white text-sm">{a.mitra_user?.name}</div>
                      <div className="text-[10px] text-slate-400">{a.mitra_user?.phone_number || a.mitra_user?.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-200">{a.product?.product_name}</div>
                      <span className="inline-block text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 mt-0.5">
                        {a.product?.product_code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/30 font-semibold">
                        <Layers className="w-3 h-3" />
                        {a.station?.name}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 text-sm">
                      Rp {a.piece_rate_fee.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {a.daily_capacity_estimate} pcs/hari
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors cursor-pointer"
                        title="Hapus Pemetaan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Assignment */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                Tambah Spesialisasi Produk & Stasiun Mitra
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Pilih Mitra Rekanan
                </label>
                <select
                  required
                  value={selectedMitraId}
                  onChange={(e) => setSelectedMitraId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                >
                  {mitras.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.phone_number || m.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Pilih Produk Kitchenware
                </label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.product_name} [{p.product_code}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Pilih Stasiun Kerja Diizinkan (Dibatasi Stasiun 1 s.d. 3)
                </label>
                <select
                  required
                  value={selectedStationId}
                  onChange={(e) => setSelectedStationId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                >
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.station_code}: {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Tarif Borongan (Rp/Pcs)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={pieceRateFee}
                    onChange={(e) => setPieceRateFee(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Estimasi Kapasitas (Pcs/Hari)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={dailyCapacity}
                    onChange={(e) => setDailyCapacity(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Catatan Spesialisasi / Kapabilitas Alat
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Memiliki 2 mesin bubut kayu jati dan mal profil gagang"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
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
                      Simpan Pemetaan
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

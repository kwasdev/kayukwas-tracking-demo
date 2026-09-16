'use client';

import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Filter,
  RefreshCw,
  Plus,
  Sparkles,
  ClipboardList,
  Flame,
  Check,
  History,
  AlertCircle
} from 'lucide-react';
import { apiFetch, QCLog, WorkOrder, WorkStation, User as UserType, getStoredUser, hasPermission, isSuperuser, hasRole } from '@/lib/api';

const DEFECT_TAGS = [
  'Jamur / Kelembaban',
  'Retak Serat Kayu',
  'Dimensi / Ketebalan Selisih',
  'Finishing Kasar / Belum Rata',
  'Lem Sambungan Terbuka',
  'Mata Kayu Mati (Dead Knots)',
  'Lengkung / Warping',
  'Goresan / Dent Bekas Mesin',
];

export default function QCPage() {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [logs, setLogs] = useState<QCLog[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, []);

  const canInputQC = isSuperuser(currentUser) || hasRole(currentUser, 'QC') || hasPermission(currentUser, 'input inspeksi qc');

  // Form State
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedWosId, setSelectedWosId] = useState<number>(0);
  const [inspectionModel, setInspectionModel] = useState<string>('in_house');
  const [sampleQty, setSampleQty] = useState<number>(50);
  const [passQty, setPassQty] = useState<number>(45);
  const [rejectMinorQty, setRejectMinorQty] = useState<number>(3);
  const [rejectMajorQty, setRejectMajorQty] = useState<number>(2);
  const [rejectScrapQty, setRejectScrapQty] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>('');

  const fetchQCLogs = async () => {
    try {
      const res = await apiFetch<QCLog[]>('/qc/recent?limit=50');
      if (res.success && res.data) {
        setLogs(res.data);
      }
    } catch {
      setError('Gagal memuat riwayat log QC');
    }
  };

  const fetchActiveSPKs = async () => {
    try {
      const res = await apiFetch<{ work_orders: WorkOrder[]; total: number }>('/spk?status=in_progress');
      if (res.success && res.data) {
        setWorkOrders(res.data.work_orders || []);
      }
    } catch {
      // Fallback
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchQCLogs(), fetchActiveSPKs()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const totalReject = rejectMinorQty + rejectMajorQty + rejectScrapQty;
  const isSumValid = passQty + totalReject === sampleQty;

  const handleSubmitQC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWosId) {
      setError('Silakan pilih stasiun SPK yang diinspeksi');
      return;
    }
    if (!isSumValid) {
      setError(`Jumlah Lolos (${passQty}) + Total Reject (${totalReject}) harus sama persis dengan Total Sampel (${sampleQty})`);
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch<QCLog>('/qc/inspect', {
        method: 'POST',
        body: JSON.stringify({
          work_order_station_id: Number(selectedWosId),
          inspection_model: inspectionModel,
          sample_qty: Number(sampleQty),
          pass_qty: Number(passQty),
          reject_minor_qty: Number(rejectMinorQty),
          reject_major_qty: Number(rejectMajorQty),
          reject_scrap_qty: Number(rejectScrapQty),
          defect_categories: selectedTags.join(', '),
          notes: notes,
        }),
      });

      if (res.success) {
        setSuccess('Inspeksi QC 3-Tingkat berhasil disimpan dan dicatat ke sistem.');
        setShowFormModal(false);
        // Reset form
        setSelectedWosId(0);
        setSelectedTags([]);
        setNotes('');
        await fetchQCLogs();
      } else {
        setError(res.message || 'Gagal menyimpan hasil inspeksi QC');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmitting(false);
    }
  };

  // Stats calculation
  const totalSampled = logs.reduce((acc, l) => acc + l.sample_qty, 0);
  const totalPassed = logs.reduce((acc, l) => acc + l.pass_qty, 0);
  const totalMinor = logs.reduce((acc, l) => acc + l.reject_minor_qty, 0);
  const totalMajor = logs.reduce((acc, l) => acc + l.reject_major_qty, 0);
  const totalScrap = logs.reduce((acc, l) => acc + l.reject_scrap_qty, 0);
  const overallPassRate = totalSampled > 0 ? ((totalPassed / totalSampled) * 100).toFixed(1) : '100.0';

  // Extract all station options from active SPKs
  const activeStationOptions: { wosId: number; label: string }[] = [];
  workOrders.forEach((wo) => {
    wo.stations?.forEach((st) => {
      activeStationOptions.push({
        wosId: st.id,
        label: `${wo.spk_number} - ${wo.product.product_name} (Stasiun ${st.sequence_order}: ${st.station.name})`,
      });
    });
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-amber-500" />
            Quality Control & Reject 3-Tingkat
          </h1>
          <p className="text-sm text-stone-400 mt-1">
            Standar inspeksi multi-model Kayu KWAS: Minor (Amplas), Major (Bongkar Lem), & Scrap (Ganti Bahan).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Muat Ulang
          </button>
          {canInputQC && (
            <button
              onClick={() => setShowFormModal(true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold rounded-lg text-sm transition-colors flex items-center gap-2 shadow-lg shadow-amber-950/40 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Input Inspeksi QC
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
            &times;
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-emerald-200">
            &times;
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-stone-400 text-xs mb-1">
            <span>Pass Rate Rata-rata</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">{overallPassRate}%</div>
          <div className="text-xs text-stone-500 mt-1">{totalPassed} lolos dari {totalSampled} sampel</div>
        </div>

        <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-stone-400 text-xs mb-1">
            <span>Reject Minor (Amplas)</span>
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="text-2xl font-bold text-yellow-400">{totalMinor} pcs</div>
          <div className="text-xs text-stone-500 mt-1">Perbaikan ringan / perataan</div>
        </div>

        <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-stone-400 text-xs mb-1">
            <span>Reject Major (Bongkar)</span>
            <Flame className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-2xl font-bold text-orange-400">{totalMajor} pcs</div>
          <div className="text-xs text-stone-500 mt-1">Bongkar sambungan / revisi total</div>
        </div>

        <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-stone-400 text-xs mb-1">
            <span>Reject Scrap (Ganti)</span>
            <XCircle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-400">{totalScrap} pcs</div>
          <div className="text-xs text-stone-500 mt-1">Kayu rusak permanen</div>
        </div>

        <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-stone-400 text-xs mb-1">
            <span>Total Log Inspeksi</span>
            <History className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-stone-200">{logs.length} Sesi</div>
          <div className="text-xs text-stone-500 mt-1">Tercatat di sistem</div>
        </div>
      </div>

      {/* QC Logs Table */}
      <div className="bg-stone-900/60 border border-stone-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-stone-200">Riwayat Inspeksi QC Terkini</h2>
          </div>
          <span className="text-xs text-stone-500">Menampilkan {logs.length} catatan terakhir</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-stone-300">
            <thead className="bg-stone-950/60 text-xs uppercase tracking-wider text-stone-400 border-b border-stone-800">
              <tr>
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-4">Model QC</th>
                <th className="py-3 px-4">Sampel / Lolos</th>
                <th className="py-3 px-4">Rincian Reject (Minor / Major / Scrap)</th>
                <th className="py-3 px-4">Kategori Cacat</th>
                <th className="py-3 px-4">Tindakan</th>
                <th className="py-3 px-4">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
                    Memuat riwayat QC...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-500">
                    Belum ada riwayat inspeksi QC yang tercatat.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const passRate = log.sample_qty > 0 ? ((log.pass_qty / log.sample_qty) * 100).toFixed(0) : '0';
                  return (
                    <tr key={log.id} className="hover:bg-stone-800/30 transition-colors">
                      <td className="py-3 px-4 text-xs font-mono text-stone-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                            log.inspection_model === 'in_house'
                              ? 'bg-amber-950/40 text-amber-300 border-amber-800/50'
                              : log.inspection_model === 'pickup_joint_model_a'
                              ? 'bg-blue-950/40 text-blue-300 border-blue-800/50'
                              : 'bg-purple-950/40 text-purple-300 border-purple-800/50'
                          }`}
                        >
                          {log.inspection_model === 'in_house'
                            ? 'In-House QC'
                            : log.inspection_model === 'pickup_joint_model_a'
                            ? 'Jemput Model A'
                            : 'Onsite Model B'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-emerald-400">{log.pass_qty}</span>
                          <span className="text-xs text-stone-500">/ {log.sample_qty}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 font-mono">
                            {passRate}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span
                            className={`px-1.5 py-0.5 rounded font-mono ${
                              log.reject_minor_qty > 0
                                ? 'bg-yellow-950/50 text-yellow-300 border border-yellow-800/40'
                                : 'text-stone-600'
                            }`}
                          >
                            Min: {log.reject_minor_qty}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-mono ${
                              log.reject_major_qty > 0
                                ? 'bg-orange-950/50 text-orange-300 border border-orange-800/40'
                                : 'text-stone-600'
                            }`}
                          >
                            Maj: {log.reject_major_qty}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-mono ${
                              log.reject_scrap_qty > 0
                                ? 'bg-red-950/50 text-red-300 border border-red-800/40'
                                : 'text-stone-600'
                            }`}
                          >
                            Scrap: {log.reject_scrap_qty}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {log.defect_categories
                            ? log.defect_categories.split(',').map((cat, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] px-1.5 py-0.5 bg-stone-800/80 text-stone-300 rounded border border-stone-700/60"
                                >
                                  {cat.trim()}
                                </span>
                              ))
                            : <span className="text-xs text-stone-600">-</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-stone-300">
                        {log.action_taken || '-'}
                      </td>
                      <td className="py-3 px-4 text-xs text-stone-400 max-w-xs truncate">
                        {log.notes || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QC Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
            <div className="p-5 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-amber-500" />
                <h3 className="text-lg font-bold text-stone-100">Input Hasil Inspeksi QC</h3>
              </div>
              <button
                onClick={() => setShowFormModal(false)}
                className="text-stone-400 hover:text-stone-200 text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitQC} className="p-6 space-y-5">
              {/* Select Station / SPK */}
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">
                  Target Stasiun SPK
                </label>
                <select
                  value={selectedWosId}
                  onChange={(e) => setSelectedWosId(Number(e.target.value))}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2.5 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
                  required
                >
                  <option value={0}>-- Pilih SPK & Stasiun Aktif --</option>
                  {activeStationOptions.map((opt) => (
                    <option key={opt.wosId} value={opt.wosId}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Inspection Model */}
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">
                  Model Inspeksi
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setInspectionModel('in_house')}
                    className={`p-3 rounded-xl border text-xs text-left transition-all ${
                      inspectionModel === 'in_house'
                        ? 'bg-amber-950/40 border-amber-500 text-amber-300'
                        : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                    }`}
                  >
                    <div className="font-bold mb-1">In-House QC</div>
                    <div className="text-[10px] text-stone-500">Stasiun 4/5 atau internal workshop</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInspectionModel('pickup_joint_model_a')}
                    className={`p-3 rounded-xl border text-xs text-left transition-all ${
                      inspectionModel === 'pickup_joint_model_a'
                        ? 'bg-blue-950/40 border-blue-500 text-blue-300'
                        : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                    }`}
                  >
                    <div className="font-bold mb-1">Jemput Model A</div>
                    <div className="text-[10px] text-stone-500">QC bersama saat jemput di mitra</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInspectionModel('onsite_autonomous_model_b')}
                    className={`p-3 rounded-xl border text-xs text-left transition-all ${
                      inspectionModel === 'onsite_autonomous_model_b'
                        ? 'bg-purple-950/40 border-purple-500 text-purple-300'
                        : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                    }`}
                  >
                    <div className="font-bold mb-1">On-Site Model B</div>
                    <div className="text-[10px] text-stone-500">Mitra kirim mandiri & QC gerbang</div>
                  </button>
                </div>
              </div>

              {/* Quantities Breakdown */}
              <div className="bg-stone-950/80 border border-stone-800/80 rounded-xl p-4 space-y-4">
                <div className="text-xs font-semibold text-stone-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Kalkulasi Sampel & 3-Tingkat Reject</span>
                  <span
                    className={`text-xs font-mono ${
                      isSumValid ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    Total Masuk: {passQty + totalReject} / {sampleQty}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-[11px] text-stone-400 mb-1">Sample Qty</label>
                    <input
                      type="number"
                      min={1}
                      value={sampleQty}
                      onChange={(e) => setSampleQty(Math.max(1, parseInt(e.target.value) || 0))}
                      className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 font-mono text-sm focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-emerald-400 mb-1">Pass (Lolos)</label>
                    <input
                      type="number"
                      min={0}
                      value={passQty}
                      onChange={(e) => setPassQty(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-stone-900 border border-emerald-800/60 rounded-lg px-3 py-2 text-emerald-300 font-mono text-sm focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-yellow-400 mb-1">Minor (Amplas)</label>
                    <input
                      type="number"
                      min={0}
                      value={rejectMinorQty}
                      onChange={(e) => setRejectMinorQty(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-stone-900 border border-yellow-800/60 rounded-lg px-3 py-2 text-yellow-300 font-mono text-sm focus:border-yellow-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-orange-400 mb-1">Major (Bongkar)</label>
                    <input
                      type="number"
                      min={0}
                      value={rejectMajorQty}
                      onChange={(e) => setRejectMajorQty(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-stone-900 border border-orange-800/60 rounded-lg px-3 py-2 text-orange-300 font-mono text-sm focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-red-400 mb-1">Scrap (Ganti)</label>
                    <input
                      type="number"
                      min={0}
                      value={rejectScrapQty}
                      onChange={(e) => setRejectScrapQty(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-stone-900 border border-red-800/60 rounded-lg px-3 py-2 text-red-300 font-mono text-sm focus:border-red-500"
                    />
                  </div>
                </div>
              </div>

              {/* Defect Categories Picker */}
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">
                  Kategori Cacat Ditemukan (Tag)
                </label>
                <div className="flex flex-wrap gap-2">
                  {DEFECT_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-amber-600/30 border-amber-500 text-amber-200'
                            : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">
                  Catatan & Rekomendasi Tindakan
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instruksi perbaikan ke pekerja/mitra (misal: amplas grit 240 di bagian tepi samping)..."
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || !isSumValid || !selectedWosId}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-950 font-bold rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Simpan Hasil QC
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

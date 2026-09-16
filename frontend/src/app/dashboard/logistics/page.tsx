'use client';

import { useState, useEffect } from 'react';
import {
  Truck,
  Search,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  Calendar,
  Clock,
  User,
  Shield,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Trash2,
  Layers,
  Sparkles,
  RefreshCw,
  Eye,
  Filter,
} from 'lucide-react';
import { apiFetch, MitraShipment, Product, User as UserType, getStoredUser, hasPermission, isSuperuser, hasRole } from '@/lib/api';

interface ShipmentItemInput {
  product_id?: number;
  raw_item_name: string;
  qty: number;
  status_category: 'revisi_total' | 'revisi_jamur' | 'revisi_cacat_lain';
  notes: string;
}

export default function LogisticsPage() {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [shipments, setShipments] = useState<MitraShipment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [mitras, setMitras] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filter
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterGate, setFilterGate] = useState<string>('all');

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<MitraShipment | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, []);

  const canCreateShipment = isSuperuser(currentUser) || hasRole(currentUser, 'Logistik') || hasRole(currentUser, 'PPIC') || hasPermission(currentUser, 'kelola mutasi logistik');

  // Form State
  const [vehicleGateStatus, setVehicleGateStatus] = useState<'keluar' | 'masuk'>('keluar');
  const [productAction, setProductAction] = useState<'kirim' | 'ambil'>('kirim');
  const [movementDate, setMovementDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [movementTime, setMovementTime] = useState<string>('08:30');
  const [driverName, setDriverName] = useState<string>('Budi Santoso');
  const [helperName, setHelperName] = useState<string>('Agus Prasetyo');
  const [qcInspectorName, setQcInspectorName] = useState<string>('Hendro QC');
  const [vehicleType, setVehicleType] = useState<string>('Daihatsu Gran Max Pickup');
  const [licensePlate, setLicensePlate] = useState<string>('AD 8920 EF');
  const [mitraId, setMitraId] = useState<number | undefined>(undefined);
  const [notes, setNotes] = useState<string>('');

  const [items, setItems] = useState<ShipmentItemInput[]>([
    {
      raw_item_name: 'Piring Mahoni D20 (Revisi Jamur)',
      qty: 120,
      status_category: 'revisi_jamur',
      notes: 'Pengeringan ulang & pembersihan spora jamur',
    },
  ]);

  const fetchShipments = async () => {
    try {
      const res = await apiFetch<{ shipments: MitraShipment[]; total: number }>('/logistics/shipments?limit=50');
      if (res.success && res.data) {
        setShipments(res.data.shipments || []);
      }
    } catch {
      setError('Gagal memuat manifest logistik');
    }
  };

  const fetchDependencies = async () => {
    try {
      const prodRes = await apiFetch<{ products: Product[] }>('/products?limit=100');
      if (prodRes.success && prodRes.data) {
        setProducts(prodRes.data.products || []);
      }
      
      const userRes = await apiFetch<{ users: UserType[] }>('/users?limit=100');
      if (userRes.success && userRes.data) {
        setMitras(userRes.data.users || []);
      }
    } catch {
      // Graceful fallback for non-admin roles
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([fetchShipments(), fetchDependencies()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const addItemRow = () => {
    setItems([
      ...items,
      {
        raw_item_name: '',
        qty: 50,
        status_category: 'revisi_total',
        notes: '',
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItemRow = (index: number, field: keyof ShipmentItemInput, val: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: val };
    setItems(updated);
  };

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some((it) => !it.raw_item_name.trim() || it.qty <= 0)) {
      setError('Pastikan semua rincian barang memiliki nama dan jumlah kuantitas lebih dari 0');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch<MitraShipment>('/logistics/shipments', {
        method: 'POST',
        body: JSON.stringify({
          vehicle_gate_status: vehicleGateStatus,
          product_action: productAction,
          movement_date: movementDate,
          movement_time: movementTime,
          driver_name: driverName,
          helper_name: helperName,
          qc_inspector_name: qcInspectorName || null,
          vehicle_type: vehicleType,
          license_plate: licensePlate,
          mitra_id: mitraId ? Number(mitraId) : null,
          notes: notes,
          items: items.map((it) => ({
            product_id: it.product_id ? Number(it.product_id) : null,
            raw_item_name: it.raw_item_name,
            qty: Number(it.qty),
            status_category: it.status_category,
            notes: it.notes,
          })),
        }),
      });

      if (res.success && res.data) {
        setSuccess(`Surat Jalan ${res.data.sj_number} berhasil diterbitkan dan dicatat dalam manifest.`);
        setShowCreateModal(false);
        await fetchShipments();
      } else {
        setError(res.message || 'Gagal membuat surat jalan logistik');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter logic
  const filteredShipments = shipments.filter((s) => {
    if (filterAction !== 'all' && s.product_action !== filterAction) return false;
    if (filterGate !== 'all' && s.vehicle_gate_status !== filterGate) return false;
    return true;
  });

  // KPI Calculations
  const totalKirim = shipments.filter((s) => s.product_action === 'kirim').length;
  const totalAmbil = shipments.filter((s) => s.product_action === 'ambil').length;
  const totalJamur = shipments.reduce(
    (acc, s) =>
      acc + (s.items?.filter((i) => i.status_category === 'revisi_jamur').reduce((sum, it) => sum + it.qty, 0) || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2.5">
            <Truck className="w-7 h-7 text-amber-500" />
            Logistik & Manifest Surat Jalan (2-Dimensi)
          </h1>
          <p className="text-sm text-stone-400 mt-1">
            Tracking armada & status muatan: Gerbang Kendaraan (Keluar/Masuk) vs Aksi Barang (Kirim/Ambil).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAll}
            className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Muat Ulang
          </button>
          {canCreateShipment && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold rounded-lg text-sm transition-colors flex items-center gap-2 shadow-lg shadow-amber-950/40 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Buat Surat Jalan
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-stone-400 text-xs mb-1">
            <span>Total Surat Jalan</span>
            <FileText className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-stone-100">{shipments.length} Manifest</div>
          <div className="text-xs text-stone-500 mt-1">Pergerakan logistik terdata</div>
        </div>

        <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-stone-400 text-xs mb-1">
            <span>Aksi: Kirim ke Mitra</span>
            <ArrowUpRight className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400">{totalKirim} Perjalanan</div>
          <div className="text-xs text-stone-500 mt-1">Bahan mentah / setengah jadi</div>
        </div>

        <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-stone-400 text-xs mb-1">
            <span>Aksi: Ambil dari Mitra</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">{totalAmbil} Perjalanan</div>
          <div className="text-xs text-stone-500 mt-1">Penjemputan hasil produksi</div>
        </div>

        <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-stone-400 text-xs mb-1">
            <span>Muatan Revisi Jamur</span>
            <Sparkles className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="text-2xl font-bold text-yellow-400">{totalJamur} Pcs</div>
          <div className="text-xs text-stone-500 mt-1">Treatment pembersihan & oven</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-3 bg-stone-900/40 border border-stone-800/80 p-3 rounded-xl">
        <div className="flex items-center gap-2 text-xs text-stone-400">
          <Filter className="w-4 h-4 text-amber-500" />
          <span>Filter Dimensi:</span>
        </div>

        <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-lg border border-stone-800">
          <button
            onClick={() => setFilterAction('all')}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
              filterAction === 'all' ? 'bg-amber-600 text-stone-950 font-semibold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Semua Aksi
          </button>
          <button
            onClick={() => setFilterAction('kirim')}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
              filterAction === 'kirim' ? 'bg-blue-600 text-white font-semibold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Kirim
          </button>
          <button
            onClick={() => setFilterAction('ambil')}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
              filterAction === 'ambil' ? 'bg-emerald-600 text-white font-semibold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Ambil
          </button>
        </div>

        <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-lg border border-stone-800">
          <button
            onClick={() => setFilterGate('all')}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
              filterGate === 'all' ? 'bg-amber-600 text-stone-950 font-semibold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Semua Gerbang
          </button>
          <button
            onClick={() => setFilterGate('keluar')}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
              filterGate === 'keluar' ? 'bg-orange-600 text-white font-semibold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Gerbang Keluar
          </button>
          <button
            onClick={() => setFilterGate('masuk')}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
              filterGate === 'masuk' ? 'bg-purple-600 text-white font-semibold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Gerbang Masuk
          </button>
        </div>
      </div>

      {/* Shipment Manifest Table */}
      <div className="bg-stone-900/60 border border-stone-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-stone-200">Daftar Surat Jalan & Manifest Perjalanan</h2>
          </div>
          <span className="text-xs text-stone-500">Total {filteredShipments.length} dokumen</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-stone-300">
            <thead className="bg-stone-950/60 text-xs uppercase tracking-wider text-stone-400 border-b border-stone-800">
              <tr>
                <th className="py-3 px-4">No. Surat Jalan</th>
                <th className="py-3 px-4">Klasifikasi 2D</th>
                <th className="py-3 px-4">Waktu Gerbang</th>
                <th className="py-3 px-4">Kendaraan & Kru</th>
                <th className="py-3 px-4">Tujuan / Mitra</th>
                <th className="py-3 px-4">Muatan & Item</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
                    Memuat data logistik...
                  </td>
                </tr>
              ) : filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-500">
                    Belum ada surat jalan pada filter ini.
                  </td>
                </tr>
              ) : (
                filteredShipments.map((s) => {
                  const totalItemsQty = s.items?.reduce((acc, it) => acc + it.qty, 0) || 0;
                  return (
                    <tr key={s.id} className="hover:bg-stone-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-amber-400 text-xs">
                        {s.sj_number}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                              s.product_action === 'kirim'
                                ? 'bg-blue-950/50 text-blue-300 border-blue-800/50'
                                : 'bg-emerald-950/50 text-emerald-300 border-emerald-800/50'
                            }`}
                          >
                            {s.product_action === 'kirim' ? (
                              <>
                                <ArrowUpRight className="w-3 h-3" /> KIRIM
                              </>
                            ) : (
                              <>
                                <ArrowDownLeft className="w-3 h-3" /> AMBIL
                              </>
                            )}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border ${
                              s.vehicle_gate_status === 'keluar'
                                ? 'bg-orange-950/40 text-orange-300 border-orange-800/40'
                                : 'bg-purple-950/40 text-purple-300 border-purple-800/40'
                            }`}
                          >
                            Gate: {s.vehicle_gate_status.toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="text-stone-200 font-medium">{s.movement_date}</div>
                        <div className="text-stone-500 font-mono text-[11px]">{s.movement_time} WIB</div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="text-stone-200 font-semibold">{s.license_plate}</div>
                        <div className="text-stone-400">{s.driver_name} {s.helper_name ? `+ ${s.helper_name}` : ''}</div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="text-amber-300 font-medium">{s.mitra?.name || 'Mitra KWAS'}</div>
                        <div className="text-stone-500 text-[11px]">{s.mitra?.phone_number || '-'}</div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="font-semibold text-stone-200">
                          {totalItemsQty} Pcs ({s.items?.length || 0} Jenis)
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {s.items?.slice(0, 2).map((it, idx) => (
                            <span
                              key={idx}
                              className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                it.status_category === 'revisi_jamur'
                                  ? 'bg-yellow-950/50 text-yellow-300 border-yellow-800/40'
                                  : 'bg-stone-800 text-stone-400 border-stone-700'
                              }`}
                            >
                              {it.raw_item_name} ({it.qty})
                            </span>
                          ))}
                          {(s.items?.length || 0) > 2 && (
                            <span className="text-[10px] text-stone-500 self-center">
                              +{s.items!.length - 2} lagi
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedShipment(s)}
                          className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-stone-100 rounded text-xs transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Detail
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shipment Detail Modal */}
      {selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-6 h-6 text-amber-500" />
                <div>
                  <h3 className="text-lg font-bold text-stone-100">
                    Surat Jalan: {selectedShipment.sj_number}
                  </h3>
                  <p className="text-xs text-stone-400">
                    {selectedShipment.movement_date} • {selectedShipment.movement_time} WIB
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedShipment(null)}
                className="text-stone-400 hover:text-stone-200 text-lg"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* 2D Matrix badge summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-950 p-4 rounded-xl border border-stone-800">
                <div>
                  <div className="text-[10px] uppercase text-stone-500 font-semibold">Aksi Muatan</div>
                  <div className="text-sm font-bold text-blue-400 capitalize">
                    {selectedShipment.product_action}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-stone-500 font-semibold">Status Gerbang</div>
                  <div className="text-sm font-bold text-purple-400 capitalize">
                    {selectedShipment.vehicle_gate_status}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-stone-500 font-semibold">Kendaraan</div>
                  <div className="text-sm font-semibold text-stone-200">
                    {selectedShipment.license_plate}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-stone-500 font-semibold">Sopir & Helper</div>
                  <div className="text-sm text-stone-300">
                    {selectedShipment.driver_name} {selectedShipment.helper_name ? `(${selectedShipment.helper_name})` : ''}
                  </div>
                </div>
              </div>

              {/* Items Breakdown */}
              <div>
                <h4 className="text-xs font-semibold text-stone-300 uppercase tracking-wider mb-3">
                  Rincian Barang Muatan ({selectedShipment.items?.length || 0} Item)
                </h4>
                <div className="bg-stone-950 rounded-xl border border-stone-800 overflow-hidden">
                  <table className="w-full text-left text-xs text-stone-300">
                    <thead className="bg-stone-900/60 text-stone-400 border-b border-stone-800">
                      <tr>
                        <th className="py-2.5 px-3">Nama Produk / Bahan</th>
                        <th className="py-2.5 px-3">Status Kategori</th>
                        <th className="py-2.5 px-3 text-right">Qty</th>
                        <th className="py-2.5 px-3">Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-800/60">
                      {selectedShipment.items?.map((it, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-3 font-medium text-stone-200">{it.raw_item_name}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono border ${
                                it.status_category === 'revisi_jamur'
                                  ? 'bg-yellow-950/60 text-yellow-300 border-yellow-800/50'
                                  : it.status_category === 'revisi_total'
                                  ? 'bg-orange-950/60 text-orange-300 border-orange-800/50'
                                  : 'bg-stone-800 text-stone-300 border-stone-700'
                              }`}
                            >
                              {it.status_category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-400">
                            {it.qty} Pcs
                          </td>
                          <td className="py-2.5 px-3 text-stone-400">{it.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedShipment.notes && (
                <div className="p-3 bg-stone-950 rounded-lg border border-stone-800 text-xs text-stone-400">
                  <span className="font-semibold text-stone-300">Catatan Khusus:</span> {selectedShipment.notes}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-stone-800 flex justify-end">
              <button
                onClick={() => setSelectedShipment(null)}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Shipment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-8">
            <div className="p-5 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-6 h-6 text-amber-500" />
                <h3 className="text-lg font-bold text-stone-100">Terbitkan Surat Jalan Baru</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-stone-400 hover:text-stone-200 text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateShipment} className="p-6 space-y-5">
              {/* 2D Dimension Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-stone-950 p-4 rounded-xl border border-stone-800">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">
                    1. Aksi Muatan Barang
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setProductAction('kirim')}
                      className={`p-2.5 rounded-lg border text-xs font-bold text-center transition-all ${
                        productAction === 'kirim'
                          ? 'bg-blue-950/60 border-blue-500 text-blue-300'
                          : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
                      }`}
                    >
                      KIRIM (Bahan/Revisi)
                    </button>
                    <button
                      type="button"
                      onClick={() => setProductAction('ambil')}
                      className={`p-2.5 rounded-lg border text-xs font-bold text-center transition-all ${
                        productAction === 'ambil'
                          ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                          : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
                      }`}
                    >
                      AMBIL (Jemput Hasil)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">
                    2. Pergerakan Gerbang Workshop
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setVehicleGateStatus('keluar')}
                      className={`p-2.5 rounded-lg border text-xs font-bold text-center transition-all ${
                        vehicleGateStatus === 'keluar'
                          ? 'bg-orange-950/60 border-orange-500 text-orange-300'
                          : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
                      }`}
                    >
                      GATE KELUAR
                    </button>
                    <button
                      type="button"
                      onClick={() => setVehicleGateStatus('masuk')}
                      className={`p-2.5 rounded-lg border text-xs font-bold text-center transition-all ${
                        vehicleGateStatus === 'masuk'
                          ? 'bg-purple-950/60 border-purple-500 text-purple-300'
                          : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
                      }`}
                    >
                      GATE MASUK
                    </button>
                  </div>
                </div>
              </div>

              {/* Date, Vehicle & Crew */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={movementDate}
                    onChange={(e) => setMovementDate(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-stone-200 text-xs focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Jam</label>
                  <input
                    type="time"
                    value={movementTime}
                    onChange={(e) => setMovementTime(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-stone-200 text-xs focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Plat Nomor</label>
                  <input
                    type="text"
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                    placeholder="AD 8920 EF"
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-stone-200 text-xs focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Tipe Kendaraan</label>
                  <input
                    type="text"
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    placeholder="Grand Max Pickup"
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-stone-200 text-xs focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Driver, Helper & Mitra */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Nama Sopir</label>
                  <input
                    type="text"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-stone-200 text-xs focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Nama Helper (Kernet)</label>
                  <input
                    type="text"
                    value={helperName}
                    onChange={(e) => setHelperName(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-stone-200 text-xs focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Mitra Tujuan / Asal</label>
                  <select
                    value={mitraId || 0}
                    onChange={(e) => setMitraId(Number(e.target.value) || undefined)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-stone-200 text-xs focus:border-amber-500"
                  >
                    <option value={0}>-- Pilih Mitra --</option>
                    {mitras.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.phone_number || m.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Items Rows */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider">
                    Rincian Barang Muatan
                  </label>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-amber-400 text-xs font-medium rounded-lg flex items-center gap-1 border border-stone-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Baris
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-stone-950 p-2.5 rounded-lg border border-stone-800 items-center"
                    >
                      <div className="sm:col-span-5">
                        <input
                          type="text"
                          value={it.raw_item_name}
                          onChange={(e) => updateItemRow(idx, 'raw_item_name', e.target.value)}
                          placeholder="Nama Barang (contoh: Piring Mahoni D20)"
                          className="w-full bg-stone-900 border border-stone-800 rounded px-2.5 py-1.5 text-xs text-stone-200 focus:border-amber-500"
                          required
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          min={1}
                          value={it.qty}
                          onChange={(e) => updateItemRow(idx, 'qty', parseInt(e.target.value) || 0)}
                          placeholder="Qty"
                          className="w-full bg-stone-900 border border-stone-800 rounded px-2 py-1.5 text-xs text-stone-200 font-mono focus:border-amber-500 text-right"
                          required
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <select
                          value={it.status_category}
                          onChange={(e) => updateItemRow(idx, 'status_category', e.target.value)}
                          className="w-full bg-stone-900 border border-stone-800 rounded px-2 py-1.5 text-xs text-stone-200 focus:border-amber-500"
                        >
                          <option value="revisi_total">Revisi Total</option>
                          <option value="revisi_jamur">Revisi Jamur</option>
                          <option value="revisi_cacat_lain">Revisi Cacat Lain</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          disabled={items.length <= 1}
                          className="p-1.5 text-stone-500 hover:text-red-400 disabled:opacity-30 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-950 font-bold rounded-lg text-xs transition-colors flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menerbitkan...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Terbitkan Surat Jalan
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

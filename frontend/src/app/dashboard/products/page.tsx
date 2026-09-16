'use client';

import { useState, useEffect } from 'react';
import { Package, Plus, Search, CheckCircle2, AlertCircle, Loader2, X, Tag } from 'lucide-react';
import { apiFetch, Product, User as UserType, getStoredUser, hasPermission, isSuperuser, hasRole } from '@/lib/api';

export default function ProductsPage() {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create Product Modal
  const [showModal, setShowModal] = useState(false);
  const [productName, setProductName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, []);

  const canManageProduct = isSuperuser(currentUser) || hasRole(currentUser, 'PPIC') || hasPermission(currentUser, 'kelola produk');

  const fetchProducts = async () => {
    try {
      const res = await apiFetch<{ products: Product[]; total: number }>(
        `/products?search=${encodeURIComponent(search)}&limit=100`
      );
      if (res.success && res.data) {
        setProducts(res.data.products || []);
        setTotal(res.data.total || 0);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [search]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({
          product_name: productName,
          product_code: productCode,
        }),
      });

      if (!res.success) {
        setError(res.message || 'Gagal menambahkan produk');
        setSubmitting(false);
        return;
      }

      setSuccess(`Produk ${productName} (${productCode}) berhasil ditambahkan!`);
      setProductName('');
      setProductCode('');
      setShowModal(false);
      fetchProducts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-amber-400" />
            Katalog Master Produk Kitchenware
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Master data 47 katalog produk dapur kayu terstandarisasi untuk acuan penerbitan SPK dan spesialisasi mitra.
          </p>
        </div>

        {canManageProduct && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Tambah Produk Baru
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
      <div className="glass-card p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama produk (misal: Telenan, Mangkok, Spatula) atau kode SKU..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs transition-all"
          />
        </div>
        <div className="text-xs text-slate-400 shrink-0 font-medium">
          Total: <b className="text-amber-400">{total}</b> produk
        </div>
      </div>

      {/* Products Table */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-semibold w-16">No</th>
                <th className="py-3.5 px-4 font-semibold">Nama Produk Kitchenware</th>
                <th className="py-3.5 px-4 font-semibold">Kode SKU Sistem</th>
                <th className="py-3.5 px-4 font-semibold">Status Master</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-400" />
                    Memuat katalog produk...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    Tidak ada produk ditemukan.
                  </td>
                </tr>
              ) : (
                products.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 text-slate-500 font-mono">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-bold text-white text-sm">
                      {p.product_name}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 font-mono text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                        <Tag className="w-3 h-3" />
                        {p.product_code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                        <CheckCircle2 className="w-3 h-3" />
                        AKTIF
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                Tambah Master Produk Baru
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Nama Komersial Produk
                </label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Contoh: Talenan Persegi Jati"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Kode SKU / Nomor Unik Sistem
                </label>
                <input
                  type="text"
                  required
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  placeholder="Contoh: TLN-PSG-JT"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
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
                      Simpan Produk
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

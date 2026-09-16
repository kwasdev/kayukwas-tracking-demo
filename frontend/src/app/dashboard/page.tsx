'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Shield,
  History,
  UserCheck,
  MessageSquare,
  ArrowRight,
  Clock,
  Sparkles,
  Layers,
  Package,
  ClipboardList,
  Truck,
  Bot,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Plus,
  Send,
  ExternalLink,
} from 'lucide-react';
import {
  apiFetch,
  User,
  Role,
  AuditLog,
  WorkOrder,
  Product,
  QCLog,
  MitraShipment,
  MitraProductStationAssignment,
  getStoredUser,
  isSuperuser,
  hasRole,
  hasAnyRole,
  hasPermission,
} from '@/lib/api';

export default function DashboardOverviewPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Stats states
  const [userCount, setUserCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [rolesCount, setRolesCount] = useState(0);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);

  const [spkList, setSpkList] = useState<WorkOrder[]>([]);
  const [productsCount, setProductsCount] = useState(0);
  const [qcLogs, setQcLogs] = useState<QCLog[]>([]);
  const [shipments, setShipments] = useState<MitraShipment[]>([]);
  const [mitraAssignments, setMitraAssignments] = useState<MitraProductStationAssignment[]>([]);

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user);

    async function loadRoleData() {
      if (!user) return;
      try {
        const promises: Promise<any>[] = [];

        // 1. Superuser / User Manager permissions
        const canManageUsers = isSuperuser(user) || hasPermission(user, 'kelola pengguna');
        const canViewAudit = isSuperuser(user) || hasPermission(user, 'lihat catatan aktivitas');

        if (canManageUsers) {
          promises.push(
            apiFetch<{ users: User[]; total: number }>('/users?limit=100').then((res) => {
              if (res.success && res.data) {
                const u = res.data.users || [];
                setUserCount(res.data.total || u.length);
                setActiveCount(u.filter((x) => x.status === 'ACTIVE' && x.is_active).length);
                setPendingCount(u.filter((x) => x.status === 'PENDING_ACTIVATION').length);
              }
            })
          );
          promises.push(
            apiFetch<Role[]>('/roles').then((res) => {
              if (res.success && res.data) {
                setRolesCount(res.data.length);
              }
            })
          );
        }

        if (canViewAudit) {
          promises.push(
            apiFetch<{ audit_logs: AuditLog[]; total: number }>('/audit-logs?limit=5').then((res) => {
              if (res.success && res.data) {
                setRecentLogs(res.data.audit_logs || []);
              }
            })
          );
        }

        // 2. Production / SPK permissions
        const canViewSPK = isSuperuser(user) || hasAnyRole(user, ['PPIC', 'Mandor', 'QC', 'Operator', 'Mitra']);
        if (canViewSPK) {
          promises.push(
            apiFetch<WorkOrder[]>('/spk').then((res) => {
              if (res.success && res.data) {
                setSpkList(res.data || []);
              }
            })
          );
        }

        // 3. Products
        const canViewProducts = isSuperuser(user) || hasAnyRole(user, ['PPIC', 'Mandor']);
        if (canViewProducts) {
          promises.push(
            apiFetch<{ products: Product[]; total: number }>('/products?limit=100').then((res) => {
              if (res.success && res.data) {
                setProductsCount(res.data.total || res.data.products?.length || 0);
              }
            })
          );
        }

        // 4. QC Logs
        const canViewQC = isSuperuser(user) || hasAnyRole(user, ['QC', 'Mandor']);
        if (canViewQC) {
          promises.push(
            apiFetch<QCLog[]>('/qc/recent').then((res) => {
              if (res.success && res.data) {
                setQcLogs(res.data || []);
              }
            })
          );
        }

        // 5. Logistics
        const canViewLogistics = isSuperuser(user) || hasAnyRole(user, ['Logistik', 'PPIC']);
        if (canViewLogistics) {
          promises.push(
            apiFetch<MitraShipment[]>('/logistics/shipments').then((res) => {
              if (res.success && res.data) {
                setShipments(res.data || []);
              }
            })
          );
        }

        // 6. Mitra Assignments
        const canViewMitra = isSuperuser(user) || hasAnyRole(user, ['PPIC', 'Mandor', 'Mitra']);
        if (canViewMitra) {
          promises.push(
            apiFetch<MitraProductStationAssignment[]>('/mitra-assignments').then((res) => {
              if (res.success && res.data) {
                setMitraAssignments(res.data || []);
              }
            })
          );
        }

        await Promise.allSettled(promises);
      } catch (err) {
        console.error('Error fetching role dashboard stats', err);
      } finally {
        setLoading(false);
      }
    }

    loadRoleData();
  }, []);

  const getPrimaryRole = () => {
    if (!currentUser || !currentUser.roles || currentUser.roles.length === 0) {
      return 'Superuser';
    }
    return currentUser.roles[0].name;
  };

  const roleName = getPrimaryRole();

  // Role Banner Config
  const getBannerInfo = () => {
    if (isSuperuser(currentUser)) {
      return {
        badge: 'Superuser / Admin Utama',
        title: 'Pusat Pengendali Akun & Operasional Pabrik',
        desc: 'Pemegang kendali penuh: kelola otorisasi RBAC, pantau pelacakan SPK 5 stasiun, audit trail, serta integrasi WhatsApp Gateway.',
        primaryBtn: { href: '/dashboard/users', label: 'Kelola Pengguna', icon: Users },
        secondaryBtn: { href: '/dashboard/spk', label: 'Pelacakan SPK', icon: Layers },
      };
    }
    if (hasRole(currentUser, 'PPIC')) {
      return {
        badge: 'Divisi PPIC & Perencanaan',
        title: 'Pusat Perencanaan Produksi & Routing SPK',
        desc: 'Rencanakan Surat Perintah Kerja (SPK), tetapkan rute stasiun & tarif borongan mitra, serta pantau pergerakan logistik.',
        primaryBtn: { href: '/dashboard/spk', label: 'Kelola SPK Pabrik', icon: Layers },
        secondaryBtn: { href: '/dashboard/products', label: 'Katalog Produk', icon: Package },
      };
    }
    if (hasRole(currentUser, 'Mandor')) {
      return {
        badge: 'Mandor Lantai Produksi',
        title: 'Pusat Pengawasan & Verifikasi Lantai Produksi',
        desc: 'Pantau kelancaran 5 stasiun produksi, verifikasi laporan hasil kerja harian operator dan mitra, serta pantau ambang batas cacat.',
        primaryBtn: { href: '/dashboard/spk', label: 'Pantau SPK 5 Stasiun', icon: Layers },
        secondaryBtn: { href: '/dashboard/agent-parser', label: 'Uji Laporan AI (WA)', icon: Bot },
      };
    }
    if (hasRole(currentUser, 'QC')) {
      return {
        badge: 'Inspektor Kontrol Kualitas (QC)',
        title: 'Pusat Kendali Mutu & Inspeksi 3-Tingkat',
        desc: 'Catat hasil inspeksi mandiri di pabrik dan bengkel mitra: verifikasi produk lolos, rijek ringan (amplas), rijek bongkar, atau afkir.',
        primaryBtn: { href: '/dashboard/qc', label: 'Input Form Inspeksi QC', icon: ClipboardList },
        secondaryBtn: { href: '/dashboard/spk', label: 'Lihat Daftar SPK', icon: Layers },
      };
    }
    if (hasRole(currentUser, 'Logistik')) {
      return {
        badge: 'Divisi Logistik & Armada',
        title: 'Pusat Distribusi & Surat Jalan Pengiriman',
        desc: 'Kelola alur keluar-masuk kendaraan pabrik (L300), terbitkan surat jalan kirim/ambil barang, serta catat pemisahan Revisi Jamur & Revisi Total.',
        primaryBtn: { href: '/dashboard/logistics', label: 'Kelola Surat Jalan', icon: Truck },
        secondaryBtn: { href: '/dashboard/agent-parser', label: 'Parsing Manifest WA', icon: Bot },
      };
    }
    if (hasRole(currentUser, 'Mitra')) {
      return {
        badge: 'Mitra Produksi Eksternal',
        title: 'Bengkel Kerja Mitra Kayu KWAS',
        desc: 'Pantau alokasi SPK borongan Anda (Stasiun 1-3 Wood Working & Finishing), lihat tarif pengerjaan, dan laporkan hasil via WhatsApp.',
        primaryBtn: { href: '/dashboard/spk', label: 'Daftar Pekerjaan SPK', icon: Layers },
        secondaryBtn: { href: '/dashboard/mitra-assignments', label: 'Tarif & Kapasitas', icon: Users },
      };
    }
    // Default Operator
    return {
      badge: 'Operator In-House Pabrik',
      title: 'Stasiun Pengerjaan & Pelaporan Produksi',
      desc: 'Lihat target SPK yang ditugaskan di stasiun kerja Anda dan kirim laporan hasil pengerjaan via WhatsApp.',
      primaryBtn: { href: '/dashboard/spk', label: 'Lihat SPK Saya', icon: Layers },
      secondaryBtn: { href: '/aktivasi', label: 'Status Akun WA', icon: MessageSquare },
    };
  };

  const banner = getBannerInfo();
  const PrimaryBtnIcon = banner.primaryBtn.icon;
  const SecondaryBtnIcon = banner.secondaryBtn.icon;

  const urgentSPK = spkList.filter((s) => s.priority === 'urgent');
  const activeSPK = spkList.filter((s) => s.status === 'in_progress');
  const completedSPK = spkList.filter((s) => s.status === 'completed');

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden p-6 md:p-8 rounded-2xl glass-card border border-amber-500/20 shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            {banner.badge}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {banner.title}
          </h1>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed">
            {banner.desc}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={banner.primaryBtn.href}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              <PrimaryBtnIcon className="w-4 h-4" />
              {banner.primaryBtn.label}
            </Link>
            <Link
              href={banner.secondaryBtn.href}
              className="px-4 py-2 glass-panel hover:bg-slate-800 text-amber-200 border border-amber-500/30 font-semibold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <SecondaryBtnIcon className="w-4 h-4" />
              {banner.secondaryBtn.label}
            </Link>
          </div>
        </div>
      </div>

      {/* Role-Specific Metric Cards */}
      {/* 1. Superuser Metrics */}
      {isSuperuser(currentUser) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="glass-card p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Pengguna</span>
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white mt-3">{userCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Terdaftar dalam database</div>
          </div>

          <div className="glass-card p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Akun Aktif</span>
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <UserCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-emerald-400 mt-3">{activeCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Terverifikasi WhatsApp & aktif</div>
          </div>

          <div className="glass-card p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">SPK Berjalan</span>
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-amber-400 mt-3">{activeSPK.length}</div>
            <div className="text-[11px] text-slate-500 mt-1">Dari {spkList.length} total SPK</div>
          </div>

          <div className="glass-card p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Jabatan / Role</span>
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Shield className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-purple-300 mt-3">{rolesCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Struktur peran operasional</div>
          </div>
        </div>
      )}

      {/* 2. PPIC Metrics */}
      {!isSuperuser(currentUser) && hasRole(currentUser, 'PPIC') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="glass-card p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total SPK</span>
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white mt-3">{spkList.length}</div>
            <div className="text-[11px] text-slate-500 mt-1">{activeSPK.length} SPK sedang diproses</div>
          </div>

          <div className="glass-card p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">SPK Prioritas Urgent</span>
              <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <Flame className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-red-400 mt-3">{urgentSPK.length}</div>
            <div className="text-[11px] text-slate-500 mt-1">Perlu pemantauan ketat</div>
          </div>

          <div className="glass-card p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Katalog Produk</span>
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Package className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-blue-300 mt-3">{productsCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Varian produk standar pabrik</div>
          </div>

          <div className="glass-card p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mitra Terdaftar</span>
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-emerald-400 mt-3">{mitraAssignments.length}</div>
            <div className="text-[11px] text-slate-500 mt-1">Pemetaan stasiun borongan</div>
          </div>
        </div>
      )}

      {/* 3. Mandor Metrics */}
      {!isSuperuser(currentUser) && hasRole(currentUser, 'Mandor') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="glass-card p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">SPK Aktif di Lapangan</span>
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-amber-400 mt-3">{activeSPK.length}</div>
            <div className="text-[11px] text-slate-500 mt-1">Dalam pengerjaan 5 stasiun</div>
          </div>

          <div className="glass-card p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">SPK Selesai</span>
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-emerald-400 mt-3">{completedSPK.length}</div>
            <div className="text-[11px] text-slate-500 mt-1">Lolos packing & siap kirim</div>
          </div>

          <div className="glass-card p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Laporan QC Terbaru</span>
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <ClipboardList className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-purple-300 mt-3">{qcLogs.length}</div>
            <div className="text-[11px] text-slate-500 mt-1">Catatan inspeksi QC mandiri</div>
          </div>

          <div className="glass-card p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bengkel Mitra</span>
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-blue-300 mt-3">{mitraAssignments.length}</div>
            <div className="text-[11px] text-slate-500 mt-1">Penugasan stasiun aktif</div>
          </div>
        </div>
      )}

      {/* 4. QC Inspector Metrics */}
      {!isSuperuser(currentUser) && hasRole(currentUser, 'QC') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="glass-card p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Inspeksi QC</span>
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <ClipboardList className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white mt-3">{qcLogs.length}</div>
            <div className="text-[11px] text-slate-500 mt-1">Sesi inspeksi lapangan tercatat</div>
          </div>

          <div className="glass-card p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Produk Lolos (Pass)</span>
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-emerald-400 mt-3">
              {qcLogs.reduce((sum, l) => sum + (l.pass_qty || 0), 0)} pcs
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Kualitas memenuhi standar</div>
          </div>

          <div className="glass-card p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rijek Butuh Perbaikan</span>
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-amber-400 mt-3">
              {qcLogs.reduce((sum, l) => sum + (l.reject_minor_qty || 0) + (l.reject_major_qty || 0), 0)} pcs
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Amplas halus & bongkar lem</div>
          </div>

          <div className="glass-card p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rijek Scrap / Ganti Bahan</span>
              <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-red-400 mt-3">
              {qcLogs.reduce((sum, l) => sum + (l.reject_scrap_qty || 0), 0)} pcs
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Kayu pecah / afkir total</div>
          </div>
        </div>
      )}

      {/* 5. Logistik Metrics */}
      {!isSuperuser(currentUser) && hasRole(currentUser, 'Logistik') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="glass-card p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Surat Jalan</span>
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Truck className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white mt-3">{shipments.length}</div>
            <div className="text-[11px] text-slate-500 mt-1">Pengiriman & penjemputan mitra</div>
          </div>

          <div className="glass-card p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gate Keluar (Kirim)</span>
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Truck className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-amber-400 mt-3">
              {shipments.filter((s) => s.vehicle_gate_status === 'keluar').length}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Barang diantar ke bengkel mitra</div>
          </div>

          <div className="glass-card p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gate Masuk (Ambil)</span>
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-emerald-400 mt-3">
              {shipments.filter((s) => s.vehicle_gate_status === 'masuk').length}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Barang tiba kembali di pabrik</div>
          </div>

          <div className="glass-card p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Armada Operasional</span>
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Truck className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-purple-300 mt-3">L300 (AD 8623 KW)</div>
            <div className="text-[11px] text-slate-500 mt-1">Supir: Kelik | Helper: Ridvan</div>
          </div>
        </div>
      )}

      {/* 6. Operator & Mitra Metrics */}
      {!isSuperuser(currentUser) && hasAnyRole(currentUser, ['Operator', 'Mitra']) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="glass-card p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">SPK Tersedia</span>
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white mt-3">{spkList.length} SPK</div>
            <div className="text-[11px] text-slate-500 mt-1">{activeSPK.length} sedang dalam pengerjaan</div>
          </div>

          <div className="glass-card p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Jalur Pelaporan WA</span>
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <MessageSquare className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-emerald-400 mt-3">Aktif (Agent AI)</div>
            <div className="text-[11px] text-slate-500 mt-1">Kirim chat format santai / suara</div>
          </div>

          <div className="glass-card p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status Akun Saya</span>
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <UserCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-blue-300 mt-3">{currentUser?.status}</div>
            <div className="text-[11px] text-slate-500 mt-1">HP: {currentUser?.phone_number || '-'}</div>
          </div>
        </div>
      )}

      {/* Main Content Sections Based on Role */}
      {/* A. Superuser / Admin Section: Audit Logs */}
      {(isSuperuser(currentUser) || hasPermission(currentUser, 'lihat catatan aktivitas')) && recentLogs.length > 0 && (
        <div className="glass-card rounded-2xl border border-slate-800 p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold text-white">Catatan Aktivitas Terkini (Audit Trail)</h2>
            </div>
            <Link
              href="/dashboard/audit-logs"
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
            >
              Lihat Semua Log
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {recentLogs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-400 font-mono uppercase bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {log.action_type}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      Oleh: <b>{log.user?.name || 'Sistem / Tamu'}</b>
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{log.description}</p>
                </div>
                <div className="text-[11px] text-slate-500 whitespace-nowrap flex items-center gap-1 shrink-0">
                  <Clock className="w-3 h-3" />
                  {new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* B. SPK List Overview (Visible to Production roles) */}
      {spkList.length > 0 && hasAnyRole(currentUser, ['Superuser', 'PPIC', 'Mandor', 'QC', 'Operator', 'Mitra']) && (
        <div className="glass-card rounded-2xl border border-slate-800 p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold text-white">Status SPK & Pengerjaan 5 Stasiun</h2>
            </div>
            <Link
              href="/dashboard/spk"
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
            >
              Buka Modul SPK
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 rounded-l-lg">No. SPK</th>
                  <th className="py-3 px-4">Produk</th>
                  <th className="py-3 px-4">Target Qty</th>
                  <th className="py-3 px-4">Prioritas</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 rounded-r-lg text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {spkList.slice(0, 5).map((spk) => (
                  <tr key={spk.id} className="hover:bg-slate-900/40">
                    <td className="py-3 px-4 font-mono font-bold text-amber-300">{spk.spk_number}</td>
                    <td className="py-3 px-4 font-medium text-white">{spk.product?.product_name || 'Produk Kayu KWAS'}</td>
                    <td className="py-3 px-4 font-bold">{spk.total_target_qty} pcs</td>
                    <td className="py-3 px-4">
                      {spk.priority === 'urgent' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                          URGENT
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                          Normal
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {spk.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href="/dashboard/spk"
                        className="text-amber-400 hover:text-amber-300 font-semibold"
                      >
                        Detail &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* C. QC Recent Inspections (Visible to QC & Mandor & Superuser) */}
      {qcLogs.length > 0 && hasAnyRole(currentUser, ['Superuser', 'QC', 'Mandor']) && (
        <div className="glass-card rounded-2xl border border-slate-800 p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-purple-400" />
              <h2 className="text-base font-bold text-white">Inspeksi Mutu QC Terkini</h2>
            </div>
            <Link
              href="/dashboard/qc"
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
            >
              Lihat Semua Log QC
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {qcLogs.slice(0, 4).map((log) => (
              <div
                key={log.id}
                className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Pass: {log.pass_qty} pcs
                    </span>
                    {(log.reject_minor_qty > 0 || log.reject_major_qty > 0) && (
                      <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        Rijek Ringan/Bongkar: {(log.reject_minor_qty || 0) + (log.reject_major_qty || 0)}
                      </span>
                    )}
                    {log.reject_scrap_qty > 0 && (
                      <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                        Afkir/Scrap: {log.reject_scrap_qty}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300">
                    Inspektor: <b>{log.inspector_user?.name || 'QC Lapangan'}</b> &bull; Keputusan: <b className="text-amber-300">{log.action_taken}</b>
                  </p>
                </div>
                <div className="text-[11px] text-slate-500 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleDateString('id-ID')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* D. Logistics Shipments (Visible to Logistik & PPIC & Superuser) */}
      {shipments.length > 0 && hasAnyRole(currentUser, ['Superuser', 'Logistik', 'PPIC']) && (
        <div className="glass-card rounded-2xl border border-slate-800 p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-400" />
              <h2 className="text-base font-bold text-white">Surat Jalan & Manifest Logistik Terkini</h2>
            </div>
            <Link
              href="/dashboard/logistics"
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
            >
              Buka Modul Logistik
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {shipments.slice(0, 3).map((s) => (
              <div
                key={s.id}
                className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      {s.sj_number}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      Aksi: {s.product_action?.toUpperCase()} ({s.vehicle_gate_status})
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Mitra: <b>{s.mitra?.name || 'Pak Baryadi'}</b> &bull; Kendaraan: <b>{s.vehicle_type} ({s.license_plate})</b> &bull; Driver: <b>{s.driver_name}</b>
                  </p>
                </div>
                <div className="text-[11px] text-slate-500 whitespace-nowrap">
                  {s.movement_date} {s.movement_time}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

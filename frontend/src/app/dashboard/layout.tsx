'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Users,
  Shield,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Package,
  Layers,
  Sparkles,
  ClipboardList,
  Truck,
  Bot,
  ExternalLink,
} from 'lucide-react';
import { getStoredUser, clearToken, User, hasPermission, hasAnyRole, isSuperuser } from '@/lib/api';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  roles?: string[];
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const u = getStoredUser();
    if (!u) {
      router.push('/login');
    } else {
      setUser(u);
    }
  }, [router]);

  const handleLogout = () => {
    clearToken();
    router.push('/login');
  };

  const isItemVisible = (item: NavItem) => {
    if (!user) return false;
    if (isSuperuser(user)) return true;
    if (item.permission && hasPermission(user, item.permission)) return true;
    if (item.roles && hasAnyRole(user, item.roles)) return true;
    if (!item.permission && !item.roles) return true;
    return false;
  };

  const allNavAccount: NavItem[] = [
    { href: '/dashboard/users', label: 'Kelola Pengguna', icon: Users, permission: 'kelola pengguna' },
    { href: '/dashboard/roles', label: 'Peran & Hak Akses', icon: Shield, permission: 'kelola peran' },
    { href: '/dashboard/audit-logs', label: 'Catatan Audit', icon: History, permission: 'lihat catatan aktivitas' },
  ];

  const allNavProduction: NavItem[] = [
    { href: '/dashboard/products', label: 'Katalog Produk (47)', icon: Package, permission: 'kelola spk', roles: ['Superuser', 'PPIC', 'Mandor'] },
    { href: '/dashboard/spk', label: 'Pelacakan SPK 5 Stasiun', icon: Layers, roles: ['Superuser', 'PPIC', 'Mandor', 'QC', 'Operator', 'Mitra'] },
    { href: '/dashboard/mitra-assignments', label: 'Spesialisasi Mitra', icon: Users, roles: ['Superuser', 'PPIC', 'Mandor', 'Mitra'] },
    { href: '/dashboard/qc', label: 'Kontrol Kualitas (QC)', icon: ClipboardList, permission: 'input inspeksi qc', roles: ['Superuser', 'QC', 'Mandor'] },
    { href: '/dashboard/logistics', label: 'Logistik Armada', icon: Truck, permission: 'kelola mutasi logistik', roles: ['Superuser', 'PPIC', 'Logistik'] },
    { href: '/dashboard/agent-parser', label: 'Agentic Parser AI', icon: Bot, roles: ['Superuser', 'PPIC', 'Mandor', 'QC'] },
  ];

  const visibleAccount = allNavAccount.filter(isItemVisible);
  const visibleProduction = allNavProduction.filter(isItemVisible);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Topbar */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-800 bg-[#0f1523]">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg wood-gradient flex items-center justify-center font-bold text-slate-950 text-sm">
            KW
          </div>
          <span className="font-bold text-sm text-white">Kayu KWAS</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 h-screen w-64 border-r border-slate-800/80 bg-[#0f1523]/95 backdrop-blur-md flex flex-col justify-between z-40 transition-transform duration-200 overflow-y-auto ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div>
          {/* Logo Brand */}
          <div className="p-5 border-b border-slate-800/80 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl wood-gradient flex items-center justify-center font-bold text-slate-950 text-base shadow-md shadow-amber-500/20">
              KW
            </div>
            <div>
              <span className="font-bold text-sm text-white block leading-none">Kayu KWAS</span>
              <span className="text-[10px] text-amber-400 font-medium">Tracking & Manajemen Produksi</span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="p-3 space-y-4">
            {/* Primary Dashboard Link */}
            <div>
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  pathname === '/dashboard'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800/60'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
                Ringkasan Sistem
              </Link>
            </div>

            {/* Production Management Section */}
            {visibleProduction.length > 0 && (
              <div>
                <div className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Manajemen Produksi
                </div>
                <nav className="space-y-1">
                  {visibleProduction.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                          isActive
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                            : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800/60'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            )}

            {/* Account & Security Section (Only shown if authorized) */}
            {visibleAccount.length > 0 && (
              <div>
                <div className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Otorisasi & Akun
                </div>
                <nav className="space-y-1">
                  {visibleAccount.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                          isActive
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                            : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800/60'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            )}
          </div>
        </div>

        {/* User Card & Logout */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/50">
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 mb-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-white truncate max-w-[130px]">{user.name}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                {user.status}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {user.roles?.map((r) => (
                <span
                  key={r.id}
                  className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium"
                >
                  {r.name}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-all cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            Keluar Sistem
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Navbar */}
        <header className="h-16 border-b border-slate-800/80 bg-[#0f1523]/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Jabatan Aktif: <b>{user.roles?.map((r) => r.name).join(', ') || 'Superuser'}</b></span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/aktivasi"
              target="_blank"
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 flex items-center gap-1 transition-all"
            >
              Aktivasi WhatsApp
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </header>

        {/* Page Children */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">{children}</main>
      </div>
    </div>
  );
}

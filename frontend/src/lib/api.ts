export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export interface User {
  id: number;
  name: string;
  email: string;
  phone_number?: string;
  status: 'ACTIVE' | 'PENDING_ACTIVATION';
  is_active: boolean;
  email_verified_at?: string;
  whatsapp_verified_at?: string;
  roles?: Role[];
  permissions?: string[];
  created_at: string;
}

export interface Role {
  id: number;
  name: string;
  is_active: boolean;
  permissions?: Permission[];
}

export interface Permission {
  id: number;
  name: string;
}

// ---------------- Authorization Helpers ----------------
export const isSuperuser = (user: User | null): boolean => {
  if (!user) return false;
  return user.roles?.some((r) => r.name.toLowerCase() === 'superuser') ?? false;
};

export const hasRole = (user: User | null, roleName: string): boolean => {
  if (!user) return false;
  if (isSuperuser(user)) return true;
  return user.roles?.some((r) => r.name.toLowerCase() === roleName.toLowerCase()) ?? false;
};

export const hasAnyRole = (user: User | null, roleNames: string[]): boolean => {
  if (!user) return false;
  if (isSuperuser(user)) return true;
  const lowerNames = roleNames.map((n) => n.toLowerCase());
  return user.roles?.some((r) => lowerNames.includes(r.name.toLowerCase())) ?? false;
};

export const hasPermission = (user: User | null, permissionName: string): boolean => {
  if (!user) return false;
  if (isSuperuser(user)) return true;

  if (user.permissions && Array.isArray(user.permissions)) {
    if (user.permissions.some((p) => p.toLowerCase() === permissionName.toLowerCase())) {
      return true;
    }
  }

  if (user.roles) {
    for (const r of user.roles) {
      if (r.permissions) {
        for (const p of r.permissions) {
          if (p.name.toLowerCase() === permissionName.toLowerCase()) {
            return true;
          }
        }
      }
    }
  }

  return false;
};

export interface AuditLog {
  id: number;
  user_id?: number;
  user?: User;
  action_type: string;
  description: string;
  created_at: string;
}

// ---------------- Production Types ----------------
export interface Product {
  id: number;
  product_name: string;
  product_code: string;
  is_active: boolean;
  created_at: string;
}

export interface WorkStation {
  id: number;
  station_code: string;
  name: string;
  sequence_order: number;
  is_external_allowed: boolean;
}

export interface WorkOrderStation {
  id: number;
  work_order_id: number;
  station_id: number;
  station: WorkStation;
  sequence_order: number;
  assigned_type: 'internal' | 'mitra';
  assigned_user_id?: number;
  assigned_user?: User;
  status: 'pending' | 'in_progress' | 'qc_wait' | 'completed';
  input_qty: number;
  completed_qty: number;
  reject_qty: number;
  rework_qty: number;
  notes?: string;
}

export interface WorkOrder {
  id: number;
  spk_number: string;
  product_id: number;
  product: Product;
  total_target_qty: number;
  priority: 'normal' | 'urgent';
  status: 'draft' | 'in_progress' | 'completed' | 'cancelled';
  start_date?: string;
  deadline_date?: string;
  stations?: WorkOrderStation[];
  created_at: string;
}

export interface MitraProductStationAssignment {
  id: number;
  mitra_user_id: number;
  mitra_user?: User;
  product_id: number;
  product?: Product;
  station_id: number;
  station?: WorkStation;
  piece_rate_fee: number;
  daily_capacity_estimate: number;
  is_primary: boolean;
  notes?: string;
}

export interface QCLog {
  id: number;
  work_order_station_id: number;
  inspector_user_id: number;
  inspector_user?: User;
  inspection_model: string;
  sample_qty: number;
  pass_qty: number;
  reject_qty: number;
  reject_minor_qty: number;
  reject_major_qty: number;
  reject_scrap_qty: number;
  defect_categories?: string;
  action_taken: string;
  notes?: string;
  created_at: string;
}

export interface MitraShipmentItem {
  id: number;
  shipment_id: number;
  product_id?: number;
  product?: Product;
  raw_item_name: string;
  qty: number;
  status_category: 'revisi_total' | 'revisi_jamur' | 'revisi_cacat_lain';
  notes?: string;
}

export interface MitraShipment {
  id: number;
  sj_number: string;
  vehicle_gate_status: 'keluar' | 'masuk';
  product_action: 'kirim' | 'ambil';
  movement_date: string;
  movement_time: string;
  driver_name: string;
  helper_name?: string;
  qc_inspector_name?: string;
  vehicle_type: string;
  license_plate: string;
  mitra_id?: number;
  mitra?: User;
  notes?: string;
  items?: MitraShipmentItem[];
  created_at: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: any;
}

// Token helper
export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('kwas_token');
};

export const setToken = (token: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('kwas_token', token);
  }
};

export const clearToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('kwas_token');
    localStorage.removeItem('kwas_user');
  }
};

export const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('kwas_user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

export const setStoredUser = (user: User) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('kwas_user', JSON.stringify(user));
  }
};

// Generic fetcher
export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      message: 'Gagal terhubung ke server backend API',
      error: err.message,
    };
  }
}

import { storage } from "@/src/utils/storage";

import { Platform } from "react-native";

let BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";
if (!BASE) {
  if (__DEV__) {
    // Default fallback for development
    if (Platform.OS === 'android') {
      BASE = 'http://10.0.2.2:8000';
    } else if (Platform.OS === 'web') {
      BASE = 'http://localhost:8000';
    } else {
      BASE = 'http://127.0.0.1:8000';
    }
    console.warn(`EXPO_PUBLIC_BACKEND_URL is not set. Falling back to ${BASE}`);
  }
}
const TOKEN_KEY = "tps_token";
const USER_KEY = "tps_user";

export type User = {
  id: string;
  nama: string;
  no_hp: string;
  role: "admin" | "petugas";
  created_at?: string;
};

async function authHeaders(): Promise<Record<string, string>> {
  const token = await storage.secureGet<string>(TOKEN_KEY, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function apiFetch<T = any>(
  path: string,
  opts: { method?: string; body?: any } = {}
): Promise<T> {
  const headers = await authHeaders();
  const url = `${BASE}/api${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method || "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch (err: any) {
    throw new Error(`Gagal terhubung ke server (${err.message}) di URL: ${url}`);
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = data?.detail || data?.message || `Error ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data as T;
}

export const authApi = {
  async login(no_hp: string, password: string) {
    const data = await apiFetch<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { no_hp, password },
    });
    await storage.secureSet(TOKEN_KEY, data.access_token);
    await storage.setItem(USER_KEY, JSON.stringify(data.user));
    return data;
  },
  async logout() {
    await storage.secureRemove(TOKEN_KEY);
    await storage.removeItem(USER_KEY);
  },
  async me() {
    return apiFetch<User>("/auth/me");
  },
  async changePassword(current_password: string, new_password: string) {
    return apiFetch("/auth/change-password", {
      method: "POST",
      body: { current_password, new_password },
    });
  },
  async getStoredUser(): Promise<User | null> {
    const raw = await storage.getItem<string>(USER_KEY, "");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },
  async getToken(): Promise<string | null> {
    const t = await storage.secureGet<string>(TOKEN_KEY, "");
    return t || null;
  },
};

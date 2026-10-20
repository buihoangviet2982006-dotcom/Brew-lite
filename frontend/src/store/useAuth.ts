import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  fullName: string;
  loyaltyPoints?: number;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (userData: User, token: string) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuth = create<AuthStore>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  login: (userData, token) => {
    if (typeof window !== 'undefined') {
      // 1. Lưu vào LocalStorage
      localStorage.setItem('accessToken', token);
      localStorage.setItem('user', JSON.stringify(userData));
      // 2. Lưu vào Cookie (để Middleware chặn Private Route đọc được)
      document.cookie = `accessToken=${token}; path=/; max-age=86400; SameSite=Lax`;
    }
    set({ user: userData, token, isAuthenticated: true });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      // Xóa Cookie
      document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
    set({ user: null, token: null, isAuthenticated: false });
  },

  // Giữ trạng thái đăng nhập khi F5 lại trang
  hydrate: () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      const savedUser = localStorage.getItem('user');
      if (token && savedUser) {
        try {
          set({ user: JSON.parse(savedUser), token, isAuthenticated: true });
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
        }
      }
    }
  },
}));
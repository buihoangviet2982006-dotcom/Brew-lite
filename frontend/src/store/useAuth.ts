import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  fullName?: string;
  name?: string;
  role?: string;
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
      localStorage.setItem('accessToken', token);
      localStorage.setItem('user', JSON.stringify(userData));
      document.cookie = `accessToken=${token}; path=/; max-age=86400; SameSite=Lax`;
    }
    set({ user: userData, token, isAuthenticated: true });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
    set({ user: null, token: null, isAuthenticated: false });
  },

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
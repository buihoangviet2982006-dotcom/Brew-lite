"use client";

import { useState, Suspense } from "react";
import { useAuth } from "@/store/useAuth";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Coffee } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = useAuth((state) => state.login);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Email hoặc mật khẩu không chính xác!");
      }

      const realToken = data.accessToken || data.access_token || data.token;
      const realUser = data.user || {
        id: data.id || "u1",
        email: email,
        fullName: data.fullName || data.name || email.split("@")[0],
      };

      if (!realToken) {
        throw new Error("Không nhận được Token từ server Backend!");
      }

      login(realUser, realToken);
      router.push(redirectUrl);
    } catch (err: any) {
      setError(err.message || "Không thể kết nối đến máy chủ Backend!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-5">
      <div className="w-16 h-16 bg-brew-500 rounded-2xl flex items-center justify-center shadow-lg mb-6">
        <Coffee className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-2xl font-extrabold text-brew-950 mb-1">Chào mừng trở lại</h2>
      <p className="text-sm text-brew-600 mb-6">Đăng nhập vào BrewLite để đặt món</p>

      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-medium text-center">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-bold text-brew-900 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3.5 rounded-xl border border-brew-200 focus:outline-none focus:border-brew-600"
            placeholder="nhap@email.com"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-brew-900 mb-1">Mật khẩu</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3.5 rounded-xl border border-brew-200 focus:outline-none focus:border-brew-600"
            placeholder="••••••••"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brew-600 text-white py-3.5 rounded-xl font-bold text-base hover:bg-brew-700 active:scale-95 transition-all shadow-md mt-4 disabled:opacity-50"
        >
          {loading ? "Đang kết nối API..." : "Đăng nhập"}
        </button>
      </form>

      <p className="mt-6 text-sm text-brew-600">
        Chưa có tài khoản?{" "}
        <Link href={`/register${redirectUrl !== "/" ? `?redirect=${encodeURIComponent(redirectUrl)}` : ""}`} className="font-bold text-brew-800 hover:underline">
          Đăng ký ngay
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] flex items-center justify-center text-brew-700">Đang tải...</div>}>
      <LoginForm />
    </Suspense>
  );
}
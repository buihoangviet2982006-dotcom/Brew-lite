"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Coffee } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp!");
      return;
    }

    setLoading(true);

    try {
      // Payload đã loại bỏ trường 'name' thừa để tránh lỗi ValidationPipe từ NestJS
      const payload = {
        email: email.trim(),
        password: password,
        fullName: fullName.trim(),
      };

      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (Array.isArray(data.message)) {
          throw new Error(data.message.join(" | "));
        }
        throw new Error(data.message || "Đăng ký không thành công!");
      }

      alert("Đăng ký tài khoản thành công! Vui lòng đăng nhập.");
      router.push("/login");
    } catch (err: any) {
      setError(err.message || "Lỗi kết nối máy chủ!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-5">
      <div className="w-14 h-14 bg-brew-500 rounded-2xl flex items-center justify-center shadow-lg mb-4">
        <Coffee className="w-7 h-7 text-white" />
      </div>
      <h2 className="text-2xl font-extrabold text-brew-950 mb-1">Tạo tài khoản mới</h2>
      <p className="text-sm text-brew-600 mb-6">Tham gia tích điểm thưởng cùng BrewLite</p>

      <form onSubmit={handleRegister} className="w-full max-w-sm space-y-3.5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-medium text-center">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-bold text-brew-900 mb-1">Họ và tên</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full p-3 rounded-xl border border-brew-200 focus:outline-none focus:border-brew-600"
            placeholder="Nguyễn Văn A"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-brew-900 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 rounded-xl border border-brew-200 focus:outline-none focus:border-brew-600"
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
            className="w-full p-3 rounded-xl border border-brew-200 focus:outline-none focus:border-brew-600"
            placeholder="Nhập mật khẩu"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-brew-900 mb-1">Xác nhận mật khẩu</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full p-3 rounded-xl border border-brew-200 focus:outline-none focus:border-brew-600"
            placeholder="Nhập lại mật khẩu"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brew-600 text-white py-3.5 rounded-xl font-bold text-base hover:bg-brew-700 active:scale-95 transition-all shadow-md mt-2 disabled:opacity-50"
        >
          {loading ? "Đang xử lý..." : "Đăng ký"}
        </button>
      </form>

      <p className="mt-6 text-sm text-brew-600">
        Đã có tài khoản?{" "}
        <Link href="/login" className="font-bold text-brew-800 hover:underline">
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
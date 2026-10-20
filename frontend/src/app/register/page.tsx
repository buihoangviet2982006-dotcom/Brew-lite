"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Coffee } from "lucide-react";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const router = useRouter();

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự!");
      return;
    }

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp!");
      return;
    }

    // Lưu tạm thông tin đăng ký để test ngay với trang Login
    localStorage.setItem(
      "registeredUser",
      JSON.stringify({ fullName, email, password })
    );

    alert("Đăng ký thành công! Vui lòng đăng nhập.");
    router.push("/login");
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
            placeholder="Tối thiểu 6 ký tự"
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
          className="w-full bg-brew-600 text-white py-3.5 rounded-xl font-bold text-base hover:bg-brew-700 active:scale-95 transition-all shadow-md mt-2"
        >
          Đăng ký
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
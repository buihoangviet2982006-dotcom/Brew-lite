"use client";

import { useEffect } from "react";
import { ShoppingCart, Coffee, UserCircle, LogOut } from "lucide-react";
import Link from "next/link";
import { useCartStore } from "@/lib/cart-store";
import { useAuth } from "@/store/useAuth";

export default function Header() {
  const cartItemCount = useCartStore((state) =>
    state.items.reduce((total, item) => total + item.quantity, 0),
  );

  const { user, isAuthenticated, logout, hydrate } = useAuth();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Fallback an toàn tránh lỗi TypeScript undefined khi build Production
  const displayName = user?.fullName || user?.name || user?.email || "User";

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-brew-100 px-5 py-4 flex items-center justify-between shadow-sm">
      <Link href="/" className="flex items-center gap-2">
        <div suppressHydrationWarning className="w-8 h-8 bg-brew-500 rounded-lg flex items-center justify-center shadow-inner">
          <Coffee className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-extrabold text-brew-950 tracking-tight">
          BrewLite
        </span>
      </Link>

      <div className="flex items-center gap-3">
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brew-100 rounded-full flex items-center justify-center text-brew-800 font-bold border border-brew-200">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-bold text-brew-900 max-w-[100px] truncate">
              {displayName}
            </span>
            <button
              onClick={logout}
              title="Đăng xuất"
              className="p-1.5 text-brew-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-sm font-bold text-brew-700 hover:text-brew-950 px-3 py-1.5 rounded-xl hover:bg-brew-50 transition"
          >
            <UserCircle className="w-5 h-5" />
            <span>Đăng nhập</span>
          </Link>
        )}

        <Link href="/cart" className="relative p-2 hover:bg-brew-50 rounded-full transition-colors">
          <ShoppingCart className="w-6 h-6 text-brew-800" />
          {/* Badge số lượng màu đỏ nổi bật */}
          {cartItemCount > 0 && (
            <span suppressHydrationWarning className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
              {cartItemCount > 99 ? "99+" : cartItemCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
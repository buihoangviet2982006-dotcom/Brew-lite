"use client"; // Bắt buộc có vì sau này Giỏ hàng sẽ dùng state (Zustand)

import { ShoppingCart, Coffee } from "lucide-react";
import Link from "next/link";
import { useCartStore } from "@/lib/cart-store";

export default function Header() {
  const cartItemCount = useCartStore((state) =>
    state.items.reduce((total, item) => total + item.quantity, 0),
  );

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-brew-100 px-5 py-4 flex items-center justify-between shadow-sm">
      <Link href="/" className="flex items-center gap-2">
        {/* Đã thêm suppressHydrationWarning vào div bọc icon */}
        <div suppressHydrationWarning className="w-8 h-8 bg-brew-500 rounded-lg flex items-center justify-center shadow-inner">
          <Coffee className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-extrabold text-brew-950 tracking-tight">
          BrewLite
        </span>
      </Link>

      <Link href="/cart" className="relative p-2 hover:bg-brew-50 rounded-full transition-colors">
        <ShoppingCart className="w-6 h-6 text-brew-800" />
        {/* Badge số lượng màu đỏ nổi bật */}
        {cartItemCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
            {cartItemCount > 99 ? "99+" : cartItemCount}
          </span>
        )}
      </Link>
    </header>
  );
}
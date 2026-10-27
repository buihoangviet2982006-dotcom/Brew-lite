"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { CartItem } from "@/types";
import { useCartStore } from "@/lib/cart-store";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price);
}

function getCartItemKey(item: CartItem): string {
  return JSON.stringify([
    item.productId,
    item.size,
    [...(item.toppingIds ?? item.toppings)].sort(),
  ]);
}

export default function CartPage() {
  const [isMounted, setIsMounted] = useState(false);
  const items = useCartStore((state) => state.items);
  const setItemQuantity = useCartStore((state) => state.setItemQuantity);
  const removeItem = useCartStore((state) => state.removeItem);

  useEffect(() => setIsMounted(true), []);

  if (!isMounted) {
    return (
      <section className="flex min-h-[calc(100vh-65px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brew-600" />
      </section>
    );
  }

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <section className="mx-auto min-h-[calc(100vh-65px)] max-w-2xl p-5 pb-28">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-bold text-brew-700 hover:text-brew-950"
      >
        <ArrowLeft className="h-4 w-4" />
        Tiếp tục chọn món
      </Link>

      <div className="mb-5 mt-5 flex items-end justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brew-500">
            BrewLite · Đơn của bạn
          </p>
          <h1 className="mt-1 text-2xl font-black text-brew-950">Giỏ hàng</h1>
        </div>
        {items.length > 0 && (
          <span className="rounded-full bg-brew-100 px-3 py-1 text-xs font-bold text-brew-800">
            {itemCount} món
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-brew-300 bg-white px-5 py-14 text-center">
          <ShoppingBag className="mx-auto h-10 w-10 text-brew-300" />
          <p className="mt-3 font-semibold text-brew-800">Giỏ hàng đang trống.</p>
          <p className="mt-1 text-sm text-brew-500">Chọn một món ngon để bắt đầu nhé.</p>
          <Link
            href="/"
            className="mt-5 inline-flex rounded-xl bg-brew-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brew-700"
          >
            Khám phá thực đơn
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item) => (
              <article
                key={getCartItemKey(item)}
                className="flex gap-3 rounded-2xl border border-brew-100 bg-white p-3.5 shadow-sm"
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-20 w-20 rounded-xl bg-brew-100 object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-brew-100 text-brew-400">
                    <ShoppingBag className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate font-bold text-brew-950">{item.name}</h2>
                      <p className="mt-0.5 text-xs text-brew-600">
                        Size {item.size}
                        {item.toppings.length > 0 && ` · ${item.toppings.join(", ")}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Xóa ${item.name} khỏi giỏ`}
                      onClick={() => removeItem(item)}
                      className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 rounded-xl bg-brew-50 p-1">
                      <button
                        type="button"
                        aria-label={`Giảm số lượng ${item.name}`}
                        disabled={item.quantity <= 1}
                        onClick={() => setItemQuantity(item, item.quantity - 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-brew-800 disabled:opacity-40"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Tăng số lượng ${item.name}`}
                        onClick={() => setItemQuantity(item, item.quantity + 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-brew-800"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="text-sm font-extrabold text-brew-700">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-brew-100 bg-white p-4 shadow-sm">
            <div className="flex justify-between text-sm text-brew-700">
              <span>Tạm tính ({itemCount} món)</span>
              <span>{formatPrice(total)}</span>
            </div>
            <div className="mt-3 flex justify-between border-t border-brew-100 pt-3 font-black text-brew-950">
              <span>Tổng cộng</span>
              <span>{formatPrice(total)}</span>
            </div>
            <Link
              href="/checkout"
              className="mt-4 flex w-full items-center justify-center rounded-xl bg-brew-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-brew-700"
            >
              Tiến hành thanh toán
            </Link>
            <p className="mt-3 text-center text-xs text-brew-500">
              Giỏ hàng sẽ được giữ lại nếu thanh toán chưa thành công.
            </p>
          </div>
        </>
      )}
    </section>
  );
}

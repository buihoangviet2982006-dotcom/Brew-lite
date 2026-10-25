"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Minus, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { CartItem, CreateOrderResponse } from "@/types";
import { useCartStore } from "@/lib/cart-store";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/store/useAuth";

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
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const items = useCartStore((state) => state.items);
  const setItemQuantity = useCartStore((state) => state.setItemQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);

  const { user, isAuthenticated, hydrate } = useAuth();

  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [orderResult, setOrderResult] =
    useState<CreateOrderResponse["data"] | null>(null);

  useEffect(() => {
    setIsMounted(true);
    hydrate();
  }, [hydrate]);

  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = async () => {
    if (items.length === 0 || isSubmitting) return;

    if (!isAuthenticated) {
      router.push("/login?redirect=/cart");
      return;
    }

    setIsSubmitting(true);
    setCheckoutError(null);
    try {
      const response = await fetchApi<CreateOrderResponse>("/orders", {
        method: "POST",
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId,
            size: item.size,
            qty: item.quantity,
            toppings: (item.toppingIds ?? []).map((toppingId) => ({
              toppingId,
            })),
          })),
          note: note.trim() || undefined,
        }),
      });

      if (!response.success) {
        throw new Error(response.message || "Không thể tạo đơn hàng.");
      }

      setOrderResult(response.data);
      clearCart();
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : "Không thể kết nối đến máy chủ để tạo đơn hàng.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isMounted) {
    return (
      <section className="p-5 pb-24 min-h-[calc(100vh-65px)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brew-600" />
      </section>
    );
  }

  return (
    <section className="p-5 pb-24 min-h-[calc(100vh-65px)] max-w-2xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-bold text-brew-700 hover:text-brew-950"
      >
        <ArrowLeft className="w-4 h-4" />
        Tiếp tục chọn món
      </Link>

      <h1 className="mt-5 mb-4 text-xl font-black text-brew-950">
        Giỏ hàng
      </h1>

      {orderResult ? (
        <div className="rounded-3xl border border-emerald-200 bg-white px-6 py-10 text-center shadow-md animate-in fade-in zoom-in-95 duration-200">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <p className="text-xl font-black text-emerald-800">
            Đặt hàng thành công!
          </p>
          <div className="my-5 inline-block rounded-2xl bg-brew-50 px-6 py-3 border border-brew-200">
            <p className="text-xs font-semibold uppercase text-brew-600">
              Mã nhận món tại quầy
            </p>
            <p className="text-3xl font-black tracking-wider text-brew-900 mt-1">
              {orderResult.orderNumber}
            </p>
          </div>
          <div className="space-y-1.5 text-sm text-brew-700">
            <p>
              Trạng thái: <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">{orderResult.status} (Chờ pha chế)</span>
            </p>
            <p>
              Tổng tiền: <span className="font-extrabold text-brew-950">{formatPrice(orderResult.total)}</span>
            </p>
          </div>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-xl bg-brew-600 px-5 py-3 text-sm font-bold text-white hover:bg-brew-700 transition"
          >
            Quay lại thực đơn
          </Link>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-brew-300 bg-white px-5 py-14 text-center">
          <p className="font-semibold text-brew-700">Giỏ hàng đang trống.</p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-xl bg-brew-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brew-700 transition"
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
                  <div className="h-20 w-20 rounded-xl bg-brew-100" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate font-bold text-brew-950">
                        {item.name}
                      </h2>
                      <p className="mt-0.5 text-xs text-brew-600">
                        Size {item.size}
                        {item.toppings.length > 0 &&
                          ` · ${item.toppings.join(", ")}`}
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
                        onClick={() =>
                          setItemQuantity(item, item.quantity - 1)
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-brew-800 disabled:opacity-40"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-5 text-center text-sm font-bold">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={`Tăng số lượng ${item.name}`}
                        onClick={() =>
                          setItemQuantity(item, item.quantity + 1)
                        }
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

          <div className="mt-5 rounded-2xl bg-white border border-brew-100 p-4 shadow-sm">
            <label className="block text-xs font-bold uppercase text-brew-700 mb-1.5">
              Ghi chú cho quán (Tùy chọn)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Ít đường, nhiều đá, giao trước 9h..."
              className="w-full rounded-xl border border-brew-200 p-3 text-sm focus:outline-none focus:border-brew-600"
            />
          </div>

          <div className="mt-4 rounded-2xl bg-brew-50 p-4 border border-brew-100">
            <div className="flex justify-between text-sm text-brew-700">
              <span>Tạm tính ({itemCount} món)</span>
              <span>{formatPrice(total)}</span>
            </div>
            <div className="mt-3 flex justify-between border-t border-brew-200 pt-3 font-black text-brew-950">
              <span>Tổng cộng</span>
              <span>{formatPrice(total)}</span>
            </div>

            {checkoutError && (
              <p role="alert" className="mt-3 text-sm font-medium text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">
                {checkoutError}
              </p>
            )}

            {!isAuthenticated ? (
              <div className="mt-4 space-y-2">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-800 text-center">
                  Vui lòng đăng nhập để hoàn tất đặt món
                </div>
                <Link
                  href="/login?redirect=/cart"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brew-600 px-4 py-3 text-sm font-black text-white hover:bg-brew-700 transition shadow-sm"
                >
                  Đăng nhập để đặt hàng
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <div className="text-xs text-brew-600 flex items-center justify-between px-1">
                  <span>Đặt hàng với tài khoản:</span>
                  <span className="font-bold text-brew-900 truncate max-w-[180px]">
                    {user?.fullName || user?.name || user?.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brew-600 px-4 py-3 text-sm font-black text-white hover:bg-brew-700 disabled:cursor-not-allowed disabled:opacity-60 transition shadow-sm"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSubmitting ? "Đang tạo đơn hàng..." : "Đặt hàng"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

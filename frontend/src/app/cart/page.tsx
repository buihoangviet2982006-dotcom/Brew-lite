"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { CartItem, CreateOrderResponse } from "@/types";
import { useCartStore } from "@/lib/cart-store";
import { fetchApi } from "@/lib/api";

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
  const items = useCartStore((state) => state.items);
  const setItemQuantity = useCartStore((state) => state.setItemQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [orderResult, setOrderResult] =
    useState<CreateOrderResponse["data"] | null>(null);
  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = async () => {
    if (items.length === 0 || isSubmitting) return;

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

  return (
    <section className="p-5 pb-24 min-h-[calc(100vh-65px)]">
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
        <div className="rounded-3xl border border-emerald-200 bg-white px-5 py-10 text-center shadow-sm">
          <p className="text-lg font-black text-emerald-700">
            Đặt hàng thành công!
          </p>
          <p className="mt-2 text-sm text-brew-700">
            Mã đơn: <span className="font-bold">{orderResult.orderNumber}</span>
          </p>
          <p className="mt-1 text-sm text-brew-700">
            Tổng tiền:{" "}
            <span className="font-bold">{formatPrice(orderResult.total)}</span>
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex rounded-xl bg-brew-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brew-700"
          >
            Quay lại thực đơn
          </Link>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-brew-300 bg-white px-5 py-14 text-center">
          <p className="font-semibold text-brew-700">Giỏ hàng đang trống.</p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-xl bg-brew-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brew-700"
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

          <div className="mt-5 rounded-2xl bg-brew-50 p-4">
            <div className="flex justify-between text-sm text-brew-700">
              <span>Tạm tính ({itemCount} món)</span>
              <span>{formatPrice(total)}</span>
            </div>
            <div className="mt-3 flex justify-between border-t border-brew-200 pt-3 font-black text-brew-950">
              <span>Tổng cộng</span>
              <span>{formatPrice(total)}</span>
            </div>
            {checkoutError && (
              <p role="alert" className="mt-3 text-sm font-medium text-red-600">
                {checkoutError}
              </p>
            )}
            <button
              type="button"
              onClick={handleCheckout}
              disabled={isSubmitting}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brew-600 px-4 py-3 text-sm font-black text-white hover:bg-brew-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Đang tạo đơn hàng..." : "Đặt hàng"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}


"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, ClipboardList, RefreshCw } from "lucide-react";
import { fetchApi } from "@/lib/api";

type OrderItem = {
  productId: string;
  size: string;
  qty: number;
  basePrice: number;
  lineTotal: number;
  toppings: unknown;
  product?: {
    id: string;
    name: string;
    imageUrl?: string;
  };
};

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  note?: string | null;
  createdAt: string;
  itemsCount: number;
  items: OrderItem[];
};

type OrdersResponse = {
  success: boolean;
  message?: string;
  data: Order[];
};

const statusLabels: Record<string, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  PAYMENT_FAILED: "Thanh toán thất bại",
  CANCELLED: "Đã hủy",
  PREPARING: "Đang pha chế",
  READY: "Sẵn sàng nhận món",
  COMPLETED: "Đã hoàn thành",
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadOrders() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchApi<OrdersResponse>("/orders/me");

      if (!response.success) {
        throw new Error(response.message || "Không thể tải lịch sử đơn hàng.");
      }

      setOrders(response.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể kết nối đến máy chủ.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, []);

  return (
    <main className="mx-auto min-h-[calc(100vh-65px)] max-w-3xl p-5 pb-24">
      <Link
        href="/cart"
        className="inline-flex items-center gap-2 text-sm font-bold text-brew-700 hover:text-brew-950"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại giỏ hàng
      </Link>

      <div className="mb-5 mt-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-brew-950">
            Lịch sử đơn hàng
          </h1>
          <p className="mt-1 text-sm text-brew-600">
            Theo dõi các đơn hàng bạn đã đặt.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadOrders()}
          disabled={isLoading}
          aria-label="Tải lại lịch sử đơn hàng"
          className="rounded-xl border border-brew-200 bg-white p-3 text-brew-700 hover:bg-brew-50 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-brew-700">
          <Loader2 className="h-6 w-6 animate-spin" />
          Đang tải lịch sử đơn hàng...
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void loadOrders()}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-700"
          >
            Thử lại
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-brew-300 bg-white px-5 py-14 text-center">
          <ClipboardList className="mx-auto mb-3 h-10 w-10 text-brew-400" />
          <p className="font-bold text-brew-800">
            Bạn chưa có đơn hàng nào.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-xl bg-brew-600 px-5 py-3 text-sm font-bold text-white hover:bg-brew-700"
          >
            Khám phá thực đơn
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <article
              key={order.id}
              className="rounded-2xl border border-brew-100 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-brew-500">
                    Mã đơn hàng
                  </p>
                  <h2 className="mt-1 text-lg font-black text-brew-950">
                    {order.orderNumber}
                  </h2>
                  <p className="mt-1 text-xs text-brew-500">
                    {formatDate(order.createdAt)}
                  </p>
                </div>

                <span className="rounded-full border border-brew-200 bg-brew-50 px-3 py-1.5 text-xs font-bold text-brew-800">
                  {statusLabels[order.status] ?? order.status}
                </span>
              </div>

              <div className="my-4 border-t border-brew-100" />

              <div className="space-y-2 text-sm text-brew-700">
                <div className="flex justify-between gap-3">
                  <span>Số lượng món</span>
                  <span className="font-semibold">
                    {order.items.reduce((sum, item) => sum + item.qty, 0)}
                  </span>
                </div>

                {order.items.map((item, index) => (
                  <div
                    key={`${order.id}-${index}`}
                    className="flex justify-between gap-3"
                  >
                    <span>
                      {item.product?.name ? `${item.product.name} (${item.size})` : item.size} × {item.qty}
                    </span>
                    <span>{formatPrice(item.lineTotal)}</span>
                  </div>
                ))}

                {order.discountAmount > 0 && (
                  <div className="flex justify-between gap-3 text-emerald-700">
                    <span>Giảm giá</span>
                    <span>-{formatPrice(order.discountAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between border-t border-brew-100 pt-3 text-base font-black text-brew-950">
                  <span>Tổng cộng</span>
                  <span>{formatPrice(order.total)}</span>
                </div>

                {order.note && (
                  <p className="pt-1 text-xs text-brew-500">
                    Ghi chú: {order.note}
                  </p>
                )}
              </div>
            </article>
          ))}

          <Link
            href="/"
            className="flex w-full items-center justify-center rounded-xl bg-brew-600 px-5 py-3 text-sm font-bold text-white hover:bg-brew-700"
          >
            Tiếp tục chọn món
          </Link>
        </div>
      )}
    </main>
  );
}

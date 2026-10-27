"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Coffee,
  Copy,
  Loader2,
  LockKeyhole,
  QrCode,
  RefreshCw,
  ShoppingBag,
  Tag,
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/store/useAuth";
import { useCartStore } from "@/lib/cart-store";
import { CartItem, CreateOrderResponse } from "@/types";

type PickupType = "DINE_IN" | "TAKEAWAY";

type PendingOrder = {
  id: string;
  orderNumber: string;
  total: number;
  userId: string;
  cartSignature: string;
  idempotencyKey: string;
};

type PaymentResponse = {
  status?: string;
  message?: string;
  payment?: { status?: string };
  order?: {
    id?: string;
    orderNumber?: string;
    status?: string;
    total?: number;
    pointsEarned?: number;
  };
};

type VietQRResponse = {
  success: boolean;
  orderId: string;
  amount: number;
  transferContent: string;
  qrUrl: string;
  bankId?: string;
  accountNo?: string;
  accountName?: string;
};

const PENDING_ORDER_KEY = "brewlite-pending-checkout";
const POINT_VALUE_VND = 10; // 100 điểm = 1.000đ

function formatPrice(price: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price);
}

function getCartSignature(items: CartItem[]): string {
  return JSON.stringify(
    items.map((item) => [
      item.productId,
      item.size,
      [...(item.toppingIds ?? item.toppings)].sort(),
      item.quantity,
    ]),
  );
}

function createIdempotencyKey(): string {
  return window.crypto.randomUUID();
}

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const { user, isAuthenticated, hydrate } = useAuth();

  const [isMounted, setIsMounted] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);
  const [pickupType, setPickupType] = useState<PickupType>("DINE_IN");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [note, setNote] = useState("");

  // Voucher state
  const [voucherCode, setVoucherCode] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<string | null>(null);

  // Loyalty points state
  const [useLoyalty, setUseLoyalty] = useState(false);
  const [pointsUsed, setPointsUsed] = useState(0);

  // VietQR state
  const [vietQrData, setVietQrData] = useState<VietQRResponse | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);
  const [copiedContent, setCopiedContent] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paidOrder, setPaidOrder] = useState<any | null>(null);

  useEffect(() => {
    hydrate();
    try {
      const savedOrder = sessionStorage.getItem(PENDING_ORDER_KEY);
      if (savedOrder) setPendingOrder(JSON.parse(savedOrder) as PendingOrder);
    } catch (storageError) {
      console.error("Không thể khôi phục đơn thanh toán:", storageError);
    }
    setIsMounted(true);
  }, [hydrate]);

  useEffect(() => {
    if (user && !customerName) {
      setCustomerName(user.fullName || user.name || "");
    }
  }, [user, customerName]);

  const cartSignature = useMemo(() => getCartSignature(items), [items]);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const usablePendingOrder =
    pendingOrder && pendingOrder.userId === user?.id ? pendingOrder : null;

  // Tính toán giảm giá dự kiến
  const estimatedVoucherDiscount = useMemo(() => {
    if (!appliedVoucher) return 0;
    const v = appliedVoucher.toUpperCase();
    if (v === "BREWLITE10") {
      return cartTotal >= 50000 ? Math.min(Math.round(cartTotal * 0.1), 20000) : 0;
    }
    if (v === "BANMOI") {
      return cartTotal >= 40000 ? Math.min(15000, cartTotal) : 0;
    }
    return 0;
  }, [appliedVoucher, cartTotal]);

  const userLoyaltyPoints = user?.loyaltyPoints ?? 120;
  const maxPossiblePoints = Math.min(
    userLoyaltyPoints,
    Math.floor((cartTotal - estimatedVoucherDiscount) / POINT_VALUE_VND),
  );

  useEffect(() => {
    if (useLoyalty) {
      setPointsUsed(Math.max(0, maxPossiblePoints));
    } else {
      setPointsUsed(0);
    }
  }, [useLoyalty, maxPossiblePoints]);

  const loyaltyDiscount = useLoyalty ? pointsUsed * POINT_VALUE_VND : 0;
  const estimatedTotal = Math.max(0, cartTotal - estimatedVoucherDiscount - loyaltyDiscount);

  useEffect(() => {
    if (isMounted && !isAuthenticated) {
      router.replace("/login?redirect=/checkout");
    }
  }, [isAuthenticated, isMounted, router]);

  // Tạo hoặc tái sử dụng pending order
  const ensurePendingOrder = async (): Promise<PendingOrder> => {
    if (usablePendingOrder) return usablePendingOrder;

    const fullNoteParts: string[] = [
      pickupType === "DINE_IN" ? "[Dùng tại quán]" : "[Mang đi]",
    ];
    if (customerName.trim()) fullNoteParts.push(`Khách: ${customerName.trim()}`);
    if (customerPhone.trim()) fullNoteParts.push(`SĐT: ${customerPhone.trim()}`);
    if (note.trim()) fullNoteParts.push(note.trim());

    const orderResponse = await fetchApi<CreateOrderResponse>("/orders", {
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
        voucherCode: appliedVoucher || undefined,
        pointsUsed: useLoyalty ? pointsUsed : 0,
        note: fullNoteParts.join(" | "),
      }),
    });

    if (!orderResponse.success) {
      throw new Error(orderResponse.message || "Không thể tạo đơn hàng.");
    }

    const order: PendingOrder = {
      id: orderResponse.data.id,
      orderNumber: orderResponse.data.orderNumber,
      total: orderResponse.data.total,
      userId: user!.id,
      cartSignature,
      idempotencyKey: createIdempotencyKey(),
    };

    setPendingOrder(order);
    sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(order));
    return order;
  };

  // Tự động tải mã VietQR cho đơn hàng
  const loadVietQR = async () => {
    if (items.length === 0 || !user) return;
    setIsLoadingQr(true);
    setError(null);
    try {
      const order = await ensurePendingOrder();
      const qrRes = await fetchApi<VietQRResponse>(`/payments/vietqr/${order.id}`);
      setVietQrData(qrRes);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Không thể tải mã VietQR.");
    } finally {
      setIsLoadingQr(false);
    }
  };

  // Tải mã QR tự động khi người dùng vào trang
  useEffect(() => {
    if (isMounted && isAuthenticated && items.length > 0 && !vietQrData && !paidOrder) {
      loadVietQR();
    }
  }, [isMounted, isAuthenticated, items.length]);

  const handleCopyContent = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedContent(true);
    setTimeout(() => setCopiedContent(false), 2000);
  };

  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Tự động kiểm tra trạng thái thanh toán từ hệ thống / SePay
  const checkStatusNow = async (targetOrderId?: string) => {
    const orderId = targetOrderId || pendingOrder?.id;
    if (!orderId || paidOrder || isCheckingStatus) return;

    setIsCheckingStatus(true);
    try {
      const res = await fetchApi<{ status: string; order?: any }>(
        `/payments/status/${orderId}`,
      );

      if (res.status === "PAID") {
        sessionStorage.removeItem(PENDING_ORDER_KEY);
        clearCart();
        setPaidOrder(res.order || pendingOrder);
        setVietQrData(null);
        setError(null);
      }
    } catch (err: any) {
      console.warn("Lỗi kiểm tra trạng thái thanh toán:", err);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Tự động polling kiểm tra trạng thái mỗi 2.5s khi có mã QR và đơn chờ
  useEffect(() => {
    if (!isMounted || !isAuthenticated || !pendingOrder?.id || paidOrder) return;

    const interval = setInterval(() => {
      checkStatusNow(pendingOrder.id);
    }, 2500);

    return () => clearInterval(interval);
  }, [isMounted, isAuthenticated, pendingOrder?.id, paidOrder]);

  if (!isMounted) {
    return (
      <section className="flex min-h-[calc(100vh-65px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brew-600" />
      </section>
    );
  }

  // Màn hình 5: Xác nhận đặt hàng thành công (Chuẩn Wireframe Mục 7)
  if (paidOrder) {
    return (
      <section className="mx-auto flex min-h-[calc(100vh-65px)] max-w-2xl items-center p-5 pb-24">
        <div className="w-full rounded-3xl border border-emerald-200 bg-white px-6 py-10 text-center shadow-lg animate-in fade-in zoom-in-95 duration-200">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="mt-4 text-2xl font-black text-brew-950">
            Đặt hàng thành công
          </h1>
          <p className="mt-1 text-sm font-semibold text-emerald-700">
            Mời tới quầy lấy nước
          </p>

          <div className="my-6 rounded-2xl bg-brew-50 p-5 border border-brew-200 shadow-inner">
            <p className="text-xs font-semibold uppercase tracking-wider text-brew-600">
              Mã đơn hàng
            </p>
            <p className="mt-1 text-4xl font-black tracking-widest text-brew-900">
              {paidOrder.orderNumber}
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="text-xs font-semibold text-brew-600">Trạng thái:</span>
              <span className="font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 text-xs tracking-wider">
                PAID
              </span>
            </div>
            <p className="mt-2 text-sm font-extrabold text-brew-800">
              Tổng thanh toán: {formatPrice(paidOrder.total)}
            </p>
          </div>

          <div className="space-y-1.5 text-xs text-brew-600 mb-6 bg-zinc-50 p-4 rounded-xl border border-zinc-200 text-left">
            <div className="flex justify-between">
              <span>Hình thức:</span>
              <span className="font-bold text-brew-900">
                {pickupType === "DINE_IN" ? "Dùng tại quán" : "Mang đi"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Phương thức:</span>
              <span className="font-bold text-brew-900">
                Quét mã VietQR 24/7
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/orders/history"
              className="inline-flex items-center justify-center rounded-xl bg-brew-600 px-6 py-3 text-sm font-black text-white transition hover:bg-brew-700 shadow-md active:scale-95"
            >
              Xem lịch sử đơn hàng
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-brew-300 bg-white px-6 py-3 text-sm font-bold text-brew-800 transition hover:bg-brew-50 active:scale-95"
            >
              Về trang chủ
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="flex min-h-[calc(100vh-65px)] items-center justify-center p-5">
        <Loader2 className="h-8 w-8 animate-spin text-brew-600" />
      </section>
    );
  }

  if (items.length === 0 && !usablePendingOrder) {
    return (
      <section className="mx-auto min-h-[calc(100vh-65px)] max-w-2xl p-5 pb-24">
        <Link
          href="/cart"
          className="inline-flex items-center gap-2 text-sm font-bold text-brew-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại giỏ hàng
        </Link>
        <div className="mt-6 rounded-3xl border border-dashed border-brew-300 bg-white px-5 py-14 text-center">
          <p className="font-semibold text-brew-700">Bạn chưa có món nào để thanh toán.</p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-xl bg-brew-600 px-4 py-2.5 text-sm font-bold text-white"
          >
            Chọn món ngay
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-[calc(100vh-65px)] max-w-2xl p-4 sm:p-5 pb-28">
      <Link
        href="/cart"
        className="inline-flex items-center gap-2 text-sm font-bold text-brew-700 hover:text-brew-950 transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại giỏ hàng
      </Link>

      <div className="mb-5 mt-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brew-500">
          BrewLite
        </p>
        <h1 className="mt-1 text-2xl font-black text-brew-950">Màn hình Thanh toán</h1>
        <p className="mt-1 text-sm text-brew-600">
          Quét mã QR qua ứng dụng Ngân hàng và xác nhận nhận nước tại quầy.
        </p>
      </div>

      <div className="space-y-4">
        {/* 1. Hình thức nhận món */}
        <section className="rounded-2xl border border-brew-100 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-black uppercase tracking-wider text-brew-900 mb-3">
            1. Hình thức nhận món
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPickupType("DINE_IN")}
              className={`p-3 rounded-xl border text-center font-bold text-sm transition flex flex-col items-center gap-1 ${pickupType === "DINE_IN"
                ? "border-brew-600 bg-brew-50 text-brew-950 ring-1 ring-brew-600"
                : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                }`}
            >
              <Coffee className="w-5 h-5 text-brew-600" />
              <span>Dùng tại quán</span>
              <span className="text-[11px] font-normal text-zinc-500">Ly sứ / thủy tinh</span>
            </button>
            <button
              type="button"
              onClick={() => setPickupType("TAKEAWAY")}
              className={`p-3 rounded-xl border text-center font-bold text-sm transition flex flex-col items-center gap-1 ${pickupType === "TAKEAWAY"
                ? "border-brew-600 bg-brew-50 text-brew-950 ring-1 ring-brew-600"
                : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                }`}
            >
              <ShoppingBag className="w-5 h-5 text-brew-600" />
              <span>Mang đi</span>
              <span className="text-[11px] font-normal text-zinc-500">Đóng gói quai xách</span>
            </button>
          </div>
        </section>

        {/* 2. Đơn hàng của bạn */}
        <section className="rounded-2xl border border-brew-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-extrabold text-brew-950 text-sm uppercase tracking-wider">
              Đơn hàng của bạn ({itemCount} món)
            </h2>
            <Link href="/cart" className="text-xs font-bold text-brew-700 underline">
              Sửa giỏ hàng
            </Link>
          </div>
          {items.map((item, index) => (
            <div
              key={`${item.productId}-${item.size}-${index}`}
              className="flex items-start justify-between gap-3 border-t border-brew-50 py-3 first:border-t-0"
            >
              <div className="flex min-w-0 gap-3">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-12 w-12 rounded-xl bg-brew-100 object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-brew-100" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-brew-950">{item.name}</p>
                  <p className="mt-0.5 text-xs text-brew-500">
                    Size {item.size} · SL {item.quantity}
                    {item.toppings.length > 0 && ` · ${item.toppings.join(", ")}`}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-sm font-bold text-brew-800">
                {formatPrice(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </section>

        {/* 3. Ưu đãi & Điểm thưởng */}
        {!usablePendingOrder && (
          <section className="rounded-2xl border border-brew-100 bg-white p-4 shadow-sm space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-brew-950 flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-brew-600" />
              3. Ưu đãi & Điểm thưởng
            </h2>

            <div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  placeholder="Mã voucher (VD: BREWLITE10, BANMOI)"
                  className="flex-1 rounded-xl border border-brew-200 px-3 py-2 text-xs uppercase text-brew-950 focus:outline-none focus:border-brew-600 font-bold"
                />
                {appliedVoucher ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAppliedVoucher(null);
                      setVoucherCode("");
                    }}
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600"
                  >
                    Gỡ
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!voucherCode.trim()) return;
                      setAppliedVoucher(voucherCode.trim().toUpperCase());
                    }}
                    className="rounded-xl bg-brew-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-brew-700"
                  >
                    Áp dụng
                  </button>
                )}
              </div>

              {!appliedVoucher && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVoucherCode("BREWLITE10");
                      setAppliedVoucher("BREWLITE10");
                    }}
                    className="text-xs bg-brew-50 text-brew-800 border border-brew-200 px-2.5 py-1 rounded-lg font-bold"
                  >
                    BREWLITE10 (-10%)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVoucherCode("BANMOI");
                      setAppliedVoucher("BANMOI");
                    }}
                    className="text-xs bg-brew-50 text-brew-800 border border-brew-200 px-2.5 py-1 rounded-lg font-bold"
                  >
                    BANMOI (-15k)
                  </button>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-brew-100 flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-brew-900">
                <input
                  type="checkbox"
                  checked={useLoyalty}
                  onChange={(e) => setUseLoyalty(e.target.checked)}
                  className="h-4 w-4 rounded text-brew-600 focus:ring-brew-500"
                />
                <span>Dùng điểm tích lũy ({userLoyaltyPoints} điểm)</span>
              </label>
              <span className="text-zinc-500">100 điểm = 1.000₫</span>
            </div>
          </section>
        )}

        {/* 4. Ghi chú */}
        {!usablePendingOrder && (
          <section className="rounded-2xl border border-brew-100 bg-white p-4 shadow-sm">
            <label
              htmlFor="order-note"
              className="block text-xs font-extrabold uppercase tracking-wider text-brew-950"
            >
              4. Ghi chú cho quán <span className="font-normal text-brew-400 lowercase">(tùy chọn)</span>
            </label>
            <input
              id="order-note"
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={250}
              placeholder="Ví dụ: ít đá, ít đường..."
              className="mt-2.5 w-full rounded-xl border border-brew-200 p-3 text-sm outline-none transition focus:border-brew-600"
            />
          </section>
        )}

        {/* 5. Phương thức thanh toán duy nhất: Quét mã VietQR */}
        <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-brew-950">
                Quét mã QR thanh toán
              </h2>
              <p className="text-xs text-brew-600">
                Hỗ trợ tất cả ứng dụng Ngân hàng (MB, VCB, Techcombank, ...) và Ví điện tử
              </p>
            </div>
          </div>

          {isLoadingQr ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <p className="text-xs text-brew-600 font-medium">Đang tạo mã QR thanh toán...</p>
            </div>
          ) : vietQrData ? (
            <div className="mt-4 flex flex-col items-center rounded-2xl bg-emerald-50/70 p-5 border border-emerald-200">
              <img
                src={vietQrData.qrUrl}
                alt="VietQR Payment Code"
                className="h-56 w-56 rounded-2xl border border-emerald-300 bg-white p-2.5 shadow-md"
              />

              <div className="mt-4 w-full max-w-sm rounded-xl bg-white p-3.5 border border-emerald-100 shadow-sm space-y-2 text-xs">
                <div className="flex justify-between items-center text-zinc-600">
                  <span>Ngân hàng thụ hưởng:</span>
                  <span className="font-bold text-zinc-900">
                    {vietQrData.bankId ? `${vietQrData.bankId} Bank` : "MB Bank"}
                  </span>
                </div>
                {vietQrData.accountNo && (
                  <div className="flex justify-between items-center text-zinc-600">
                    <span>Số tài khoản:</span>
                    <span className="font-bold text-zinc-900 font-mono">
                      {vietQrData.accountNo}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-zinc-600">
                  <span>Chủ tài khoản:</span>
                  <span className="font-bold text-zinc-900">
                    {vietQrData.accountName || "BREWLITE COFFEE"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-zinc-600">
                  <span>Số tiền:</span>
                  <span className="font-black text-emerald-700 text-sm">
                    {formatPrice(vietQrData.amount)}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-zinc-100 pt-2">
                  <span className="text-zinc-600">Nội dung chuyển khoản:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-brew-900 bg-brew-50 px-2 py-0.5 rounded border border-brew-200">
                      {vietQrData.transferContent}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyContent(vietQrData.transferContent)}
                      className="p-1 rounded text-brew-600 hover:bg-brew-100 transition"
                      title="Sao chép nội dung"
                    >
                      {copiedContent ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-[11px] text-emerald-800 text-center">
                Mở app ngân hàng quét mã để thanh toán tự động đúng số tiền và nội dung.
              </p>
            </div>
          ) : (
            <div className="py-6 text-center">
              <button
                type="button"
                onClick={loadVietQR}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700"
              >
                <QrCode className="h-4 w-4" />
                Tải lại mã VietQR
              </button>
            </div>
          )}
        </section>

        {/* 6. Chi tiết thanh toán & Xác nhận */}
        <section className="rounded-2xl border border-brew-100 bg-brew-50 p-4 shadow-sm">
          <div className="space-y-1.5 text-sm text-brew-800">
            <div className="flex justify-between">
              <span>Tạm tính ({itemCount} món)</span>
              <span>{formatPrice(cartTotal)}</span>
            </div>
            {appliedVoucher && estimatedVoucherDiscount > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Voucher giảm giá ({appliedVoucher}):</span>
                <span>-{formatPrice(estimatedVoucherDiscount)}</span>
              </div>
            )}
            {useLoyalty && loyaltyDiscount > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Điểm tích lũy ({pointsUsed} pts):</span>
                <span>-{formatPrice(loyaltyDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-zinc-500">
              <span>Phí phục vụ:</span>
              <span className="font-bold text-emerald-700">Miễn phí</span>
            </div>
          </div>

          <div className="mt-3 flex justify-between border-t border-brew-200 pt-3 font-black text-brew-950">
            <span>Tổng thanh toán</span>
            <span className="text-xl text-brew-700">
              {formatPrice(usablePendingOrder?.total ?? estimatedTotal)}
            </span>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700"
            >
              {error}
            </p>
          )}

          {/* Hộp trạng thái lắng nghe chuyển khoản tự động (SePay / Ngân hàng) */}
          <div className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50/80 p-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-emerald-900 font-bold text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              <span>Đang chờ hệ thống ghi nhận chuyển khoản...</span>
            </div>
            <p className="text-xs text-emerald-800">
              Vui lòng mở ứng dụng ngân hàng quét mã QR ở trên và chuyển chính xác số tiền.
            </p>
            <p className="text-[11px] text-zinc-500">
              Hệ thống sẽ tự động chuyển sang trang nhận nước ngay khi tiền vào tài khoản (không cần bấm nút).
            </p>

            <div className="pt-2 border-t border-emerald-200/60 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => checkStatusNow()}
                disabled={isCheckingStatus}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brew-700 hover:text-brew-950 underline disabled:opacity-50 transition"
              >
                <RefreshCw className={`h-3 w-3 ${isCheckingStatus ? "animate-spin" : ""}`} />
                Kiểm tra lại giao dịch ngay
              </button>
            </div>
          </div>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-brew-500">
            <LockKeyhole className="h-3.5 w-3.5" />
            Tự động đối soát giao dịch ngân hàng 24/7
          </p>
        </section>
      </div>
    </section>
  );
}

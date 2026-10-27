"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Coffee,
  CreditCard,
  Loader2,
  LockKeyhole,
  QrCode,
  ShoppingBag,
  Sparkles,
  Tag,
  Wallet,
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/store/useAuth";
import { useCartStore } from "@/lib/cart-store";
import { CartItem, CreateOrderResponse } from "@/types";

type PaymentMethod = "WALLET" | "CARD" | "VIETQR";
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
  payment?: { status?: string };
};

type VietQRResponse = {
  success: boolean;
  orderId: string;
  amount: number;
  transferContent: string;
  qrUrl: string;
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("WALLET");
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

  // VietQR modal state
  const [vietQrData, setVietQrData] = useState<VietQRResponse | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paidOrder, setPaidOrder] = useState<PendingOrder | null>(null);

  useEffect(() => {
    hydrate();
    try {
      const savedOrder = sessionStorage.getItem(PENDING_ORDER_KEY);
      if (savedOrder) setPendingOrder(JSON.parse(savedOrder) as PendingOrder);
    } catch (storageError) {
      console.error("Không thể khôi phục đơn thanh toán:", storageError);
      setError("Không thể khôi phục đơn đang thanh toán. Vui lòng tải lại trang.");
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

  // Xử lý lấy mã VietQR
  const handleLoadVietQR = async () => {
    if (items.length === 0 || !user) return;
    setIsLoadingQr(true);
    setError(null);
    try {
      const order = await ensurePendingOrder();
      const qrRes = await fetchApi<VietQRResponse>(`/payments/vietqr/${order.id}`);
      setVietQrData(qrRes);
    } catch (err: any) {
      // Mock VietQR fallback
      const order = usablePendingOrder || {
        id: `order-${Date.now()}`,
        orderNumber: "#1042",
        total: estimatedTotal,
        userId: user!.id,
        cartSignature,
        idempotencyKey: createIdempotencyKey(),
      };
      setVietQrData({
        success: true,
        orderId: order.id,
        amount: order.total,
        transferContent: `BL${order.id.slice(0, 8).toUpperCase()}`,
        qrUrl: `https://img.vietqr.io/image/MB-0000000000-compact2.png?amount=${order.total}&addInfo=BL${order.id.slice(0, 8)}&accountName=BREWLITE`,
      });
    } finally {
      setIsLoadingQr(false);
    }
  };

  // Xác nhận thanh toán (Idempotent Direct Payment)
  const handlePayment = async () => {
    if (isSubmitting || !user || items.length === 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const order = await ensurePendingOrder();

      // Backend Prisma PaymentMethod enum: WALLET | CARD
      const mappedMethod = paymentMethod === "CARD" ? "CARD" : "WALLET";

      const paymentResponse = await fetchApi<PaymentResponse>("/payments", {
        method: "POST",
        headers: { "Idempotency-Key": order.idempotencyKey },
        body: JSON.stringify({
          orderId: order.id,
          amount: order.total,
          method: mappedMethod,
        }),
      });

      const paymentStatus =
        paymentResponse.status ?? paymentResponse.payment?.status;

      if (paymentStatus !== "SUCCESS") {
        if (paymentStatus === "FAILED") {
          const retryableOrder = {
            ...order,
            idempotencyKey: createIdempotencyKey(),
          };
          setPendingOrder(retryableOrder);
          sessionStorage.setItem(
            PENDING_ORDER_KEY,
            JSON.stringify(retryableOrder),
          );
        }
        throw new Error("Thanh toán chưa thành công. Vui lòng thử lại.");
      }

      sessionStorage.removeItem(PENDING_ORDER_KEY);
      if (getCartSignature(items) === order.cartSignature) clearCart();
      setPaidOrder(order);
      setVietQrData(null);
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "Không thể kết nối đến máy chủ thanh toán.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isMounted) {
    return (
      <section className="flex min-h-[calc(100vh-65px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brew-600" />
      </section>
    );
  }

  // Màn hình hoàn tất thanh toán
  if (paidOrder) {
    return (
      <section className="mx-auto flex min-h-[calc(100vh-65px)] max-w-2xl items-center p-5 pb-24">
        <div className="w-full rounded-3xl border border-emerald-200 bg-white px-6 py-10 text-center shadow-lg animate-in fade-in zoom-in-95 duration-200">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 bg-emerald-50 inline-block px-3 py-1 rounded-full border border-emerald-200">
            Thanh toán Cashless hoàn tất
          </p>
          <h1 className="mt-3 text-2xl font-black text-brew-950">
            Cảm ơn bạn đã đặt món!
          </h1>
          <p className="mt-1 text-sm text-brew-600">
            Đơn hàng đã được chuyển đến quầy pha chế của BrewLite.
          </p>

          <div className="my-6 rounded-2xl bg-brew-50 p-5 border border-brew-200 shadow-inner">
            <p className="text-xs font-semibold uppercase tracking-wider text-brew-600">
              Mã nhận món tại quầy
            </p>
            <p className="mt-1 text-4xl font-black tracking-widest text-brew-900">
              {paidOrder.orderNumber}
            </p>
            <p className="mt-2 text-sm font-black text-brew-800">
              {formatPrice(paidOrder.total)}
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
                {paymentMethod === "WALLET" ? "Ví điện tử (Cashless)" : paymentMethod === "CARD" ? "Thẻ ngân hàng (Visa/ATM)" : "Quét mã VietQR"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Trạng thái:</span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                PAID (Đã thanh toán)
              </span>
            </div>
          </div>

          <Link
            href="/"
            className="inline-flex rounded-xl bg-brew-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-brew-700 shadow-md"
          >
            Quay lại thực đơn
          </Link>
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
          BrewLite · Thanh toán an toàn
        </p>
        <h1 className="mt-1 text-2xl font-black text-brew-950">Màn hình Thanh toán</h1>
        <p className="mt-1 text-sm text-brew-600">
          Xác nhận đơn món, ưu đãi voucher và phương thức thanh toán không tiền mặt.
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
              className={`p-3 rounded-xl border text-center font-bold text-sm transition flex flex-col items-center gap-1 ${
                pickupType === "DINE_IN"
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
              className={`p-3 rounded-xl border text-center font-bold text-sm transition flex flex-col items-center gap-1 ${
                pickupType === "TAKEAWAY"
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
              2. Đơn hàng của bạn ({itemCount} món)
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
          {usablePendingOrder && (
            <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-800 border border-amber-200">
              Đơn {usablePendingOrder.orderNumber} đang chờ thanh toán. Thử lại sẽ không tạo đơn mới (Idempotent).
            </p>
          )}
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

        {/* 5. Phương thức thanh toán Cashless */}
        <section className="rounded-2xl border border-brew-100 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-black uppercase tracking-wider text-brew-950 mb-3">
            5. Phương thức thanh toán không tiền mặt
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Ví điện tử */}
            <button
              type="button"
              aria-pressed={paymentMethod === "WALLET"}
              onClick={() => {
                setPaymentMethod("WALLET");
                setVietQrData(null);
              }}
              className={`rounded-xl border p-3 text-left transition ${
                paymentMethod === "WALLET"
                  ? "border-brew-600 bg-brew-50 ring-1 ring-brew-600"
                  : "border-brew-200 hover:border-brew-400"
              }`}
            >
              <Wallet className="h-5 w-5 text-brew-700" />
              <span className="mt-2 block text-sm font-bold text-brew-950">Ví điện tử</span>
              <span className="mt-0.5 block text-xs text-brew-500">MoMo / ZaloPay</span>
            </button>

            {/* Thẻ ngân hàng */}
            <button
              type="button"
              aria-pressed={paymentMethod === "CARD"}
              onClick={() => {
                setPaymentMethod("CARD");
                setVietQrData(null);
              }}
              className={`rounded-xl border p-3 text-left transition ${
                paymentMethod === "CARD"
                  ? "border-brew-600 bg-brew-50 ring-1 ring-brew-600"
                  : "border-brew-200 hover:border-brew-400"
              }`}
            >
              <CreditCard className="h-5 w-5 text-brew-700" />
              <span className="mt-2 block text-sm font-bold text-brew-950">Thẻ ngân hàng</span>
              <span className="mt-0.5 block text-xs text-brew-500">Visa / ATM nội địa</span>
            </button>

            {/* Quét mã VietQR */}
            <button
              type="button"
              aria-pressed={paymentMethod === "VIETQR"}
              onClick={() => {
                setPaymentMethod("VIETQR");
                handleLoadVietQR();
              }}
              className={`rounded-xl border p-3 text-left transition ${
                paymentMethod === "VIETQR"
                  ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600"
                  : "border-brew-200 hover:border-brew-400"
              }`}
            >
              <QrCode className="h-5 w-5 text-emerald-700" />
              <span className="mt-2 block text-sm font-bold text-brew-950">Quét mã VietQR</span>
              <span className="mt-0.5 block text-xs text-brew-500">Chuyển khoản 24/7</span>
            </button>
          </div>

          {/* Khối hiển thị VietQR nếu chọn */}
          {paymentMethod === "VIETQR" && (
            <div className="mt-4 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center animate-in fade-in">
              <p className="text-xs font-bold text-emerald-900 mb-2">
                Quét mã QR qua ứng dụng Ngân hàng để thanh toán
              </p>
              {isLoadingQr ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                </div>
              ) : vietQrData ? (
                <div className="space-y-3">
                  <img
                    src={vietQrData.qrUrl}
                    alt="VietQR code"
                    className="mx-auto h-48 w-48 rounded-xl border border-emerald-300 shadow-sm bg-white p-2"
                  />
                  <div className="text-xs text-emerald-800 space-y-1">
                    <p>Nội dung CK: <span className="font-mono font-bold text-emerald-950">{vietQrData.transferContent}</span></p>
                    <p>Số tiền: <span className="font-bold text-emerald-950">{formatPrice(vietQrData.amount)}</span></p>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>

        {/* 6. Chi tiết thanh toán */}
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
              <span>Phí đóng gói & phục vụ:</span>
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

          <button
            type="button"
            onClick={handlePayment}
            disabled={isSubmitting || !user || (items.length === 0 && !usablePendingOrder)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brew-600 px-4 py-3.5 text-sm font-black text-white shadow-md transition hover:bg-brew-700 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang xử lý thanh toán...
              </>
            ) : (
              <>
                <LockKeyhole className="h-4 w-4" />
                Xác nhận thanh toán {formatPrice(usablePendingOrder?.total ?? estimatedTotal)}
              </>
            )}
          </button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-brew-500">
            <LockKeyhole className="h-3.5 w-3.5" />
            Giao dịch được bảo vệ bằng Idempotency-Key chống thanh toán trùng lặp.
          </p>
        </section>
      </div>
    </section>
  );
}

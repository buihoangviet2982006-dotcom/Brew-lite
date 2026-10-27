
'use client';

import Link from 'next/link';

type OrderConfirmationProps = {
  orderNumber: string;
  status: string;
};

const statusLabels: Record<string, string> = {
  PENDING: 'Đang chờ thanh toán',
  PAID: 'Đã thanh toán',
  PAYMENT_FAILED: 'Thanh toán thất bại',
  CANCELLED: 'Đã hủy',
  PREPARING: 'Đang pha chế',
  READY: 'Đã sẵn sàng',
  COMPLETED: 'Đã hoàn thành',
};

export default function OrderConfirmation({
  orderNumber,
  status,
}: OrderConfirmationProps) {
  const statusLabel = statusLabels[status] ?? status;

  return (
    <main className="mx-auto max-w-lg p-6">
      <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
        <div className="mb-4 text-5xl">✓</div>

        <h1 className="mb-2 text-2xl font-bold">
          Thông tin đơn hàng
        </h1>

        <p className="mb-6 text-gray-600">
          Đơn hàng của bạn đã được ghi nhận.
        </p>

        <div className="space-y-4 rounded-xl bg-gray-50 p-4 text-left">
          <div>
            <p className="text-sm text-gray-500">Mã đơn hàng</p>
            <p className="text-xl font-bold">{orderNumber}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Trạng thái</p>
            <p className="font-semibold">{statusLabel}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/orders/history"
            className="rounded-lg bg-amber-700 px-4 py-3 text-white hover:bg-amber-800"
          >
            Xem lịch sử đơn hàng
          </Link>

          <Link
            href="/"
            className="rounded-lg border px-4 py-3 hover:bg-gray-50"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </main>
  );
}

import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/common/Header';

export const metadata: Metadata = {
  title: 'BrewLite - Đặt & Thanh toán cà phê không dùng tiền mặt',
  description: 'Ứng dụng đặt đồ uống và thanh toán không dùng tiền mặt nhanh chóng tại quầy.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="antialiased min-h-screen bg-brew-50 text-brew-950" suppressHydrationWarning>
        {/* Đã thêm suppressHydrationWarning vào div bọc khung điện thoại */}
        <div suppressHydrationWarning className="mx-auto max-w-md min-h-screen relative overflow-hidden flex flex-col bg-white shadow-2xl shadow-brew-900/20">
          <Header />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
import type { Metadata } from 'next';
import './globals.css';

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
      <body className="antialiased">{children}</body>
    </html>
  );
}

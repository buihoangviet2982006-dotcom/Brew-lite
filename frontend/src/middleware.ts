import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Các đường dẫn yêu cầu phải đăng nhập mới được vào
const privateRoutes = ['/checkout', '/orders', '/profile'];

// Các đường dẫn dành cho người chưa đăng nhập
const authRoutes = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('accessToken')?.value;
  const { pathname } = request.nextUrl;

  // 1. Nếu chưa đăng nhập mà cố vào Private Route -> đá về /login
  if (privateRoutes.some((route) => pathname.startsWith(route)) && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set(
      'redirect',
      `${pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  // 2. Nếu đã đăng nhập rồi mà cố vào lại /login hoặc /register -> đẩy về trang chủ
  if (authRoutes.some((route) => pathname.startsWith(route)) && token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/checkout/:path*', '/orders/:path*', '/profile/:path*', '/login', '/register'],
};
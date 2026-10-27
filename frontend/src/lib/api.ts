import { MOCK_PRODUCTS, getMockProductDetail } from "./mock-data";
import { CreateOrderResponse } from "@/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${normalizedEndpoint}`;

  const headers = new Headers(options.headers);
  if (
    !headers.has("Content-Type") &&
    !(typeof FormData !== "undefined" && options.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (typeof window !== "undefined" && !headers.has("Authorization")) {
    const token = localStorage.getItem("accessToken");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    // Graceful demo fallback khi backend chưa chạy
    if (normalizedEndpoint === "/products" || normalizedEndpoint === "products") {
      return MOCK_PRODUCTS as unknown as T;
    }

    if (normalizedEndpoint.startsWith("/products/")) {
      const id = normalizedEndpoint.replace("/products/", "");
      const detail = getMockProductDetail(id);
      if (detail) {
        return detail as unknown as T;
      }
    }

    if (normalizedEndpoint === "/orders" && options.method === "POST") {
      const body = options.body ? JSON.parse(options.body as string) : {};
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const subtotal = (body.items ?? []).reduce(
        (sum: number, it: any) => sum + (it.qty || 1) * 35000,
        0,
      ) || 70000;

      const mockResponse: CreateOrderResponse = {
        success: true,
        message: "Tạo đơn hàng thành công!",
        data: {
          id: `order-demo-${Date.now()}`,
          orderNumber: `#${randomNum}`,
          status: "PENDING",
          subtotal,
          discountAmount: body.voucherCode ? 15000 : 0,
          total: subtotal - (body.voucherCode ? 15000 : 0),
          itemsCount: body.items?.length || 1,
          createdAt: new Date().toISOString(),
        },
      };
      return mockResponse as unknown as T;
    }

    if (normalizedEndpoint === "/payments" && options.method === "POST") {
      const body = options.body ? JSON.parse(options.body as string) : {};
      return {
        status: "SUCCESS",
        payment: {
          id: `pay-${Date.now()}`,
          orderId: body.orderId,
          amount: body.amount,
          method: body.method,
          status: "SUCCESS",
        },
      } as unknown as T;
    }

    throw error;
  }
}

// TypeScript types for BrewLite

export type ProductSize = 'S' | 'M' | 'L';

export interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  stock: number;
  description?: string;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  size: ProductSize;
  toppings: string[];
  quantity: number;
  imageUrl: string;
  itemTotal: number;
}

export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'PAYMENT_FAILED'
  | 'CANCELLED';

export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  items?: CartItem[];
}

export interface User {
  id: string;
  email: string;
  fullName?: string;
  loyaltyPoints: number;
}

// TypeScript types for BrewLite

export type ProductSize = 'S' | 'M' | 'L' | string;

export interface ProductSizeItem {
  size: string;
  price: number;
}

export interface ToppingItem {
  id: string;
  name: string;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  stock: number;
  description?: string;
  category?: 'coffee' | 'tea' | 'special' | 'bakery' | string;
  sizes?: ProductSizeItem[];
  isAvailable?: boolean;
}

export interface ProductDetail extends Product {
  availableToppings: ToppingItem[];
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  size: ProductSize;
  toppings: string[];
  toppingIds?: string[];
  quantity: number;
  imageUrl: string;
  itemTotal: number;
}

export interface CreateOrderResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    subtotal: number;
    discountAmount: number;
    total: number;
    itemsCount: number;
    createdAt: string;
  };
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
  orderNumber?: string;
  userId: string;
  status: OrderStatus;
  subtotal?: number;
  discountAmount?: number;
  total: number;
  createdAt: string;
  items?: CartItem[];
}

export interface User {
  id: string;
  email: string;
  fullName?: string;
  role?: 'CUSTOMER' | 'BARISTA' | 'ADMIN';
  loyaltyPoints: number;
}

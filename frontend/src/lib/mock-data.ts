import { Product, ProductDetail, ToppingItem } from "@/types";

export const MOCK_TOPPINGS: ToppingItem[] = [
  { id: "top-pearl", name: "Trân châu đen hoàng kim", price: 5000 },
  { id: "top-cheese", name: "Kem Cheese Macchiato", price: 10000 },
  { id: "top-peach", name: "Đào ngâm giòn", price: 8000 },
  { id: "top-lotus", name: "Hạt sen vàng bùi ngọt", price: 9000 },
  { id: "top-jelly", name: "Thạch sương sáo thanh mát", price: 5000 },
];

export const MOCK_PRODUCTS: Product[] = [
  {
    id: "prod-cf-01",
    name: "Cà phê sữa đá Sài Gòn",
    price: 29000,
    imageUrl:
      "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80",
    stock: 45,
    isAvailable: true,
    description:
      "Hương vị cà phê Robusta Đắk Lắk đậm đà kết hợp sữa đặc béo ngậy truyền thống.",
    category: "coffee",
    sizes: [
      { size: "S", price: 29000 },
      { size: "M", price: 35000 },
      { size: "L", price: 42000 },
    ],
  },
  {
    id: "prod-cf-02",
    name: "Bạc xỉu 3 tầng BrewLite",
    price: 32000,
    imageUrl:
      "https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&w=600&q=80",
    stock: 38,
    isAvailable: true,
    description:
      "Nhiều sữa ít cà phê, béo ngậy thơm lừng hòa quyện sữa tươi thanh trùng.",
    category: "coffee",
    sizes: [
      { size: "S", price: 32000 },
      { size: "M", price: 39000 },
      { size: "L", price: 45000 },
    ],
  },
  {
    id: "prod-cf-03",
    name: "Cà phê muối xứ Huế",
    price: 35000,
    imageUrl:
      "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80",
    stock: 25,
    isAvailable: true,
    description:
      "Sự kết hợp độc đáo giữa vị đậm đà của cà phê phin và lớp kem béo mặn sánh mịn.",
    category: "special",
    sizes: [
      { size: "S", price: 35000 },
      { size: "M", price: 42000 },
      { size: "L", price: 49000 },
    ],
  },
  {
    id: "prod-tea-01",
    name: "Trà đào cam sả thanh nhiệt",
    price: 38000,
    imageUrl:
      "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80",
    stock: 40,
    isAvailable: true,
    description:
      "Vị trà lài tươi mát cùng đào ngâm giòn sần sật và lát cam vàng tươi.",
    category: "tea",
    sizes: [
      { size: "M", price: 38000 },
      { size: "L", price: 45000 },
    ],
  },
  {
    id: "prod-tea-02",
    name: "Trà sen vàng Macchiato",
    price: 42000,
    imageUrl:
      "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80",
    stock: 30,
    isAvailable: true,
    description:
      "Trà ô long thanh khiết kết hợp hạt sen bùi bùi và lớp bọt sữa macchiato đậm vị.",
    category: "tea",
    sizes: [
      { size: "M", price: 42000 },
      { size: "L", price: 50000 },
    ],
  },
  {
    id: "prod-bk-01",
    name: "Bánh Croissant Bơ Tỏi",
    price: 28000,
    imageUrl:
      "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80",
    stock: 20,
    isAvailable: true,
    description:
      "Vỏ bánh ngàn lớp giòn rụm tỏa ngát hương bơ Pháp và tỏi thơm nức.",
    category: "bakery",
    sizes: [{ size: "STANDARD", price: 28000 }],
  },
];

export function getMockProductDetail(id: string): ProductDetail | null {
  const prod = MOCK_PRODUCTS.find((p) => p.id === id);
  if (!prod) return null;
  return {
    ...prod,
    availableToppings: MOCK_TOPPINGS,
  };
}


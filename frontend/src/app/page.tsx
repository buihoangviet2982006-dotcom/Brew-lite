"use client";

import { useState, useEffect } from "react";
import ProductCard from "@/components/menu/ProductCard";
import ProductDetailModal from "@/components/menu/ProductDetailModal";
import { Product } from "@/types";
import { fetchApi } from "@/lib/api";
import { useCartStore } from "@/lib/cart-store";

export default function MenuPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const addItemToCart = useCartStore((state) => state.addItem);

  useEffect(() => {
    setIsMounted(true);
    
    const fetchProducts = async () => {
      try {
        const data = await fetchApi<Product[]>("/products");
        setProducts(data);
      } catch (error) {
        console.error("Lỗi khi tải Menu:", error);
        // Fallback fetch trực tiếp nếu có lỗi
        try {
          const res = await fetch("http://localhost:4000/api/products");
          if (res.ok) {
            const fallbackData = await res.json();
            setProducts(fallbackData);
          }
        } catch {
          setProducts([]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const handleAddToCart = (item: Parameters<typeof addItemToCart>[0]) => {
    addItemToCart(item);
    // Thông báo toast phản hồi người dùng
    setToastMessage(`Đã thêm ${item.name} (${item.size}) vào giỏ!`);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  if (!isMounted) return null;

  return (
    <div className="p-5 pb-24 relative min-h-[calc(100vh-65px)]">
      {/* Toast thông báo nhanh */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-brew-950 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-sm font-semibold animate-in fade-in slide-in-from-top-3 duration-200">
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-black text-brew-950 tracking-tight">Danh sách thức uống</h2>
          <p className="text-xs text-brew-600 mt-0.5">Chạm vào món để chọn Size và Topping</p>
        </div>
      </div>
      
      {isLoading ? (
        <div className="space-y-3.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-brew-200/40 animate-pulse rounded-2xl"></div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-3xl border border-dashed border-brew-300">
          <p className="text-brew-600 font-medium">Hiện chưa có món nào được bán hoặc mất kết nối máy chủ.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onSelect={(p) => setSelectedProductId(p.id)}
            />
          ))}
        </div>
      )}

      {/* Modal Chi Tiết Món (Task 4) */}
      {selectedProductId && (
        <ProductDetailModal
          productId={selectedProductId}
          onClose={() => setSelectedProductId(null)}
          onAddToCart={handleAddToCart}
        />
      )}
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";
import ProductCard from "@/components/menu/ProductCard";
import { Product } from "@/types";

export default function MenuPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    const fetchProducts = async () => {
      try {
        const response = await fetch("http://localhost:4000/api/products");
        if (!response.ok) throw new Error("Lỗi máy chủ");
        const data = await response.json();
        setProducts(data);
      } catch (error) {
        console.error("Lỗi khi tải Menu:", error);
        setProducts([]); 
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (!isMounted) return null;

  return (
    <div className="p-5 pb-20 relative">
      <h2 className="text-xl font-extrabold text-brew-900 mb-6">Danh sách thức uống</h2>
      
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-brew-200/40 animate-pulse rounded-2xl"></div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-3xl border border-dashed border-brew-300">
          <p className="text-brew-600 font-medium">Hiện chưa có món nào được bán hoặc mất kết nối máy chủ.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
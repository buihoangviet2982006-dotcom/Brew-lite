"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Plus, Minus, Check, Loader2, AlertCircle } from "lucide-react";
import { CartItem, ProductDetail, ToppingItem, ProductSizeItem } from "@/types";
import { fetchApi } from "@/lib/api";

interface ProductDetailModalProps {
  productId: string;
  onClose: () => void;
  onAddToCart?: (item: CartItem) => void;
}

export default function ProductDetailModal({
  productId,
  onClose,
  onAddToCart,
}: ProductDetailModalProps) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSize, setSelectedSize] = useState<string>("S");
  const [selectedToppings, setSelectedToppings] = useState<ToppingItem[]>([]);
  const [quantity, setQuantity] = useState<number>(1);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // Format tiền tệ VNĐ
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price);
  };

  // Fetch dữ liệu chi tiết từ Backend API
  useEffect(() => {
    let isMounted = true;
    const loadDetail = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchApi<ProductDetail>(`/products/${productId}`);
        if (!isMounted) return;
        setProduct(data);

        // Mặc định chọn size đầu tiên nếu có
        if (data.sizes && data.sizes.length > 0) {
          setSelectedSize(data.sizes[0].size);
        } else {
          setSelectedSize("STANDARD");
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || "Không thể tải thông tin món");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadDetail();
    return () => {
      isMounted = false;
    };
  }, [productId]);

  // Đóng bằng phím ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Tính giá theo Size đã chọn
  const getSizePrice = (): number => {
    if (!product) return 0;
    if (product.sizes && product.sizes.length > 0) {
      const found = product.sizes.find((s) => s.size === selectedSize);
      if (found) return found.price;
    }
    return product.price;
  };

  // Tính tổng phụ thu từ Toppings
  const getToppingsPrice = (): number => {
    return selectedToppings.reduce((sum, item) => sum + item.price, 0);
  };

  // Tổng tiền = (Giá size + Tổng topping) * Số lượng
  const unitPrice = getSizePrice() + getToppingsPrice();
  const totalPrice = unitPrice * quantity;

  // Toggle Topping
  const handleToggleTopping = (topping: ToppingItem) => {
    const exists = selectedToppings.some((t) => t.id === topping.id);
    if (exists) {
      setSelectedToppings(selectedToppings.filter((t) => t.id !== topping.id));
    } else {
      setSelectedToppings([...selectedToppings, topping]);
    }
  };

  // Xử lý thêm vào giỏ
  const handleAddToCart = () => {
    if (!product) return;

    const payload = {
      productId: product.id,
      name: product.name,
      price: unitPrice,
      size: selectedSize,
      toppings: selectedToppings.map((t) => t.name),
      toppingIds: selectedToppings.map((t) => t.id),
      quantity,
      imageUrl: product.imageUrl,
      itemTotal: totalPrice,
    };

    if (onAddToCart) {
      onAddToCart(payload);
    }

    setIsSuccess(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Background click để đóng */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden z-10 transition-transform duration-300">
        {/* Top Header Bar */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-5 py-4 border-b border-brew-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-full hover:bg-brew-50 text-brew-900 transition-colors flex items-center gap-1.5 text-sm font-semibold"
          >
            <ArrowLeft className="w-5 h-5 text-brew-800" />
            <span>Quay lại</span>
          </button>
          <span className="text-base font-bold text-brew-950 truncate max-w-[200px]">
            {product?.name || "Chi tiết món"}
          </span>
          <div className="w-8" />
        </div>

        {/* Nội dung chi tiết (Cuộn được) */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-brew-600 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-brew-600" />
              <p className="text-sm font-medium">Đang tải thông tin món...</p>
            </div>
          ) : error || !product ? (
            <div className="py-16 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
              <p className="text-brew-800 font-semibold">{error || "Không tìm thấy món"}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-brew-100 text-brew-900 rounded-xl text-sm font-bold hover:bg-brew-200"
              >
                Đóng
              </button>
            </div>
          ) : (
            <>
              {/* Hình ảnh & Thông tin cơ bản */}
              <div className="space-y-4">
                <div className="w-full h-52 rounded-2xl overflow-hidden bg-brew-100 shadow-inner">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-2xl font-black text-brew-950 tracking-tight">
                      {product.name}
                    </h2>
                    <span className="text-xl font-extrabold text-brew-600 shrink-0">
                      {formatPrice(product.price)}
                    </span>
                  </div>
                  {product.description && (
                    <p className="text-brew-700 text-sm mt-1.5 leading-relaxed">
                      {product.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Phần Chọn Size (Nếu có danh sách sizes) */}
              {product.sizes && product.sizes.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-brew-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-brew-900 uppercase tracking-wider">
                      Chọn kích cỡ (Size)
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-brew-100 text-brew-800 rounded-full">
                      Bắt buộc
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    {product.sizes.map((s: ProductSizeItem) => {
                      const isSelected = selectedSize === s.size;
                      return (
                        <button
                          key={s.size}
                          type="button"
                          onClick={() => setSelectedSize(s.size)}
                          className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${
                            isSelected
                              ? "border-brew-600 bg-brew-50 shadow-sm shadow-brew-600/10"
                              : "border-brew-100 bg-white hover:border-brew-300"
                          }`}
                        >
                          <span
                            className={`text-base font-black ${
                              isSelected ? "text-brew-900" : "text-brew-800"
                            }`}
                          >
                            Size {s.size}
                          </span>
                          <span
                            className={`text-xs mt-1 font-semibold ${
                              isSelected ? "text-brew-600" : "text-brew-600"
                            }`}
                          >
                            {formatPrice(s.price)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Phần Chọn Topping (Nếu có danh sách availableToppings) */}
              {product.availableToppings && product.availableToppings.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-brew-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-brew-900 uppercase tracking-wider">
                      Chọn Topping
                    </span>
                    <span className="text-xs text-brew-600">Tùy chọn</span>
                  </div>

                  <div className="space-y-2">
                    {product.availableToppings.map((topping: ToppingItem) => {
                      const isChecked = selectedToppings.some((t) => t.id === topping.id);
                      return (
                        <div
                          key={topping.id}
                          onClick={() => handleToggleTopping(topping)}
                          className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                            isChecked
                              ? "border-brew-600 bg-brew-50/70"
                              : "border-brew-100 bg-white hover:border-brew-200"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                                isChecked
                                  ? "border-brew-600 bg-brew-600 text-white"
                                  : "border-brew-300 bg-white"
                              }`}
                            >
                              {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                            <span className="text-sm font-bold text-brew-900">
                              {topping.name}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-brew-600">
                            +{formatPrice(topping.price)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Điều chỉnh số lượng */}
              <div className="flex items-center justify-between pt-2 border-t border-brew-100">
                <span className="text-sm font-bold text-brew-900 uppercase tracking-wider">
                  Số lượng
                </span>
                <div className="flex items-center gap-3 bg-brew-50 p-1 rounded-2xl border border-brew-200/80">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="w-9 h-9 rounded-xl bg-white border border-brew-200 flex items-center justify-center text-brew-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brew-100 transition-colors shadow-xs"
                  >
                    <Minus className="w-4 h-4 stroke-[2.5]" />
                  </button>
                  <span className="w-7 text-center font-black text-base text-brew-950">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-9 h-9 rounded-xl bg-white border border-brew-200 flex items-center justify-center text-brew-800 hover:bg-brew-100 transition-colors shadow-xs"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Fixed Bottom Action Bar */}
        {!isLoading && product && (
          <div className="p-4 bg-white border-t border-brew-100 shadow-lg">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isSuccess}
              className={`w-full py-4 px-6 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] ${
                isSuccess
                  ? "bg-emerald-600 shadow-emerald-600/30"
                  : "bg-brew-600 hover:bg-brew-700 shadow-brew-600/30"
              }`}
            >
              {isSuccess ? (
                <>
                  <Check className="w-5 h-5 stroke-[3]" />
                  <span>Đã thêm vào giỏ hàng!</span>
                </>
              ) : (
                <>
                  <span>Thêm vào giỏ</span>
                  <span>•</span>
                  <span>{formatPrice(totalPrice)}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

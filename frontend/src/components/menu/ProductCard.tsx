import { Product } from "@/types";

interface ProductCardProps {
  product: Product;
  onSelect?: (product: Product) => void;
}

export default function ProductCard({ product, onSelect }: ProductCardProps) {
  // Hàm format tiền tệ VNĐ
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const handleCardClick = () => {
    if (onSelect) {
      onSelect(product);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-brew-100 hover:shadow-md hover:border-brew-300 transition-all cursor-pointer group select-none"
    >
      {/* Ảnh thu nhỏ sản phẩm nếu có */}
      {product.imageUrl && (
        <div className="w-16 h-16 rounded-xl overflow-hidden bg-brew-100 shrink-0 mr-3.5 shadow-inner">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <h3 className="text-base font-bold text-brew-950 truncate group-hover:text-brew-700 transition-colors">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-xs text-brew-600 line-clamp-1 mt-0.5">
            {product.description}
          </p>
        )}
        <p className="text-brew-600 font-extrabold text-sm mt-1">
          {formatPrice(product.price)}
        </p>
      </div>
      
      {/* Nút Thêm - Mở Modal chọn Size/Topping */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleCardClick();
        }}
        className="ml-3 px-4 py-2 bg-brew-600 text-white text-xs font-bold rounded-xl hover:bg-brew-700 active:scale-95 transition-all shadow-sm shrink-0"
      >
        Thêm
      </button>
    </div>
  );
}
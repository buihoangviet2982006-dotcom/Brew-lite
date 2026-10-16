import { Product } from "@/types";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  // Hàm format tiền tệ VNĐ
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  return (
    <div className="flex items-center justify-between p-5 bg-white rounded-2xl shadow-sm border border-brew-100 hover:shadow-md transition-all">
      <div className="flex-1">
        <h3 className="text-lg font-bold text-brew-950">{product.name}</h3>
        <p className="text-brew-600 font-semibold mt-1">{formatPrice(product.price)}</p>
      </div>
      
      {/* Nút Thêm - Task 4 mình sẽ bấm nút này để mở Modal chọn Size/Topping */}
      <button className="ml-4 px-5 py-2.5 bg-brew-600 text-white text-sm font-bold rounded-xl hover:bg-brew-700 active:scale-95 transition-all shadow-sm">
        Thêm
      </button>
    </div>
  );
}
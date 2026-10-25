# Tài Liệu API & Thực Thể Tối Thiểu (API Endpoints & Entities)

## 1. Danh Sách Endpoint Chính

| Phương Thức | Endpoint | Chức Năng | Quyền Truy Cập |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/products` | Lấy danh sách sản phẩm (menu kèm ảnh, size, giá) | Public |
| `GET` | `/api/products/:id` | Xem chi tiết sản phẩm | Public |
| `POST` | `/api/auth/register` | Đăng ký tài khoản người dùng mới | Public |
| `POST` | `/api/auth/login` | Đăng nhập và nhận JWT token | Public |
| `POST` | `/api/orders` | Tạo đơn hàng mới (trạng thái `PENDING`) | Demo account |
| `POST` | `/api/payments` | Thanh toán đơn hàng không tiền mặt (Idempotent) | Authenticated |
| `GET` | `/api/orders/me` | Lấy lịch sử đơn hàng của người dùng hiện tại | Authenticated |

### Tạo đơn hàng

`POST /api/orders` nhận danh sách sản phẩm và lựa chọn, không nhận giá do client tính:

```json
{
  "items": [
    {
      "productId": "prod-cf-01",
      "size": "M",
      "qty": 1,
      "toppings": [{ "toppingId": "top-pearl" }]
    }
  ],
  "voucherCode": "BREWLITE10",
  "pointsUsed": 100,
  "note": "Ít đá"
}
```

Backend đọc giá sản phẩm, size và topping từ database, kiểm tra khả dụng/tồn kho, điều kiện và giới hạn voucher, rồi tính tổng trong transaction. `100` điểm được đổi thành `1.000đ`; điểm và lượt voucher được ghi nhận ngay khi đơn được tạo. Giá gửi từ client (như `basePrice`, `price` hoặc `discountAmount`) không được dùng để tính tiền.

Hiện module auth và API thanh toán/hủy đơn chưa được triển khai. Vì vậy endpoint này tạm gắn đơn vào tài khoản demo `usr-demo-01`; nếu đơn `PENDING` bị bỏ hoặc hủy, cần bổ sung luồng hoàn điểm/lượt voucher trước khi dùng redemption trong production.

---

## 2. Thực Thể Dữ Liệu Tối Thiểu (Core Entities)

1. **Product**
   - `id`: UUID / Int (Khóa chính)
   - `name`: String (Tên đồ uống: Cà phê sữa, Americano, ...)
   - `price`: Decimal (Giá cơ bản)
   - `imageUrl`: String (URL hình ảnh)
   - `stock`: Int (Số lượng tồn kho nguyên liệu)
   - `createdAt`: DateTime

2. **User**
   - `id`: UUID / Int (Khóa chính)
   - `email`: String (Unique)
   - `passwordHash`: String (Băm bcrypt)
   - `fullName`: String
   - `loyaltyPoints`: Int (Điểm tích lũy thành viên)
   - `createdAt`: DateTime

3. **Order**
   - `id`: UUID / Int (Khóa chính)
   - `userId`: Foreign Key -> User
   - `status`: Enum (`PENDING`, `PAID`, `PREPARING`, `READY`, `COMPLETED`, `PAYMENT_FAILED`, `CANCELLED`)
   - `total`: Decimal (Tổng tiền thanh toán)
   - `createdAt`: DateTime

4. **OrderItem**
   - `id`: UUID / Int (Khóa chính)
   - `orderId`: Foreign Key -> Order
   - `productId`: Foreign Key -> Product
   - `size`: Enum (`S`, `M`, `L`)
   - `toppings`: String / JSON (Danh sách topping chọn thêm)
   - `qty`: Int (Số lượng)
   - `lineTotal`: Decimal (Thành tiền của món)

5. **Payment**
   - `id`: UUID / Int (Khóa chính)
   - `orderId`: Foreign Key -> Order
   - `idempotencyKey`: String (Unique, tránh thanh toán trùng)
   - `amount`: Decimal (Số tiền thanh toán)
   - `method`: Enum (`WALLET`, `CARD`)
   - `status`: Enum (`SUCCESS`, `FAILED`)
   - `createdAt`: DateTime

# Kế Hoạch 3 Sprint - Dự Án BrewLite

Dự án phát triển ứng dụng **BrewLite** được quản lý theo khung làm việc **Agile Scrum** với 3 Sprint (mỗi Sprint 1-2 tuần, tổng cộng 10 Task Backlog, mỗi Task 1 điểm).

---

## 1. Tổng Quan 3 Sprint

| Sprint | Mục Tiêu (Sprint Goal) | Danh Sách Task | Tổng Điểm |
| :--- | :--- | :--- | :--- |
| **Sprint 1** | **Nền tảng & Hiển thị Menu** | Task 1, Task 2, Task 3, Task 4 | 4 điểm |
| **Sprint 2** | **Giỏ hàng, Đặt đơn & Đăng nhập (Auth)** | Task 5, Task 6, Task 7 | 3 điểm |
| **Sprint 3** | **Thanh toán, Bàn giao & Nghiệp vụ nâng cao** | Task 8, Task 9, Task 10 | 3 điểm |

---

## 2. Chi Tiết Product Backlog (10 Task)

### Sprint 1: Nền tảng & Hiển thị Menu
- **Task 1 (Story): Khởi tạo dự án và cấu trúc**
  - **Tiêu chí chấp nhận:** Monorepo gồm 2 thư mục `frontend` (Next.js) và `backend` (NestJS), cấu trúc chuẩn, chạy được "Hello", đầy đủ README.md, .gitignore, Git branching, .env.example.
  - **Điểm:** 1.0
  - **Nhánh:** `feature/task-1-project-setup`

- **Task 2 (Story): API danh sách sản phẩm**
  - **Tiêu chí chấp nhận:** NestJS cung cấp `GET /products` trả về JSON danh sách đồ uống (id, name, price, imageUrl, stock) từ mock/database.
  - **Điểm:** 1.0
  - **Nhánh:** `feature/task-2-product-api`

- **Task 3 (Story): Trang Menu (Frontend)**
  - **Tiêu chí chấp nhận:** Next.js gọi `GET /products`, render lưới sản phẩm đồ uống đẹp mắt, xử lý trạng thái loading/empty/error.
  - **Điểm:** 1.0
  - **Nhánh:** `feature/task-3-menu-frontend`

- **Task 4 (Story): Chi tiết và tùy chọn sản phẩm**
  - **Tiêu chí chấp nhận:** Modal/Trang chi tiết sản phẩm: chọn Size (S/M/L) và Topping (trân châu, kem cheese,...), tự động tính giá theo tùy chọn.
  - **Điểm:** 1.0
  - **Nhánh:** `feature/task-4-product-detail-options`

---

### Sprint 2: Giỏ hàng, Đặt đơn & Đăng nhập
- **Task 5 (Story): Giỏ hàng (Cart)**
  - **Tiêu chí chấp nhận:** Thêm/sửa số lượng/xóa sản phẩm trong giỏ; quản lý state (Zustand/Context); tự động tính tổng tiền; hiển thị badge số lượng.
  - **Điểm:** 1.0
  - **Nhánh:** `feature/task-5-cart-management`

- **Task 6 (Story): API tạo đơn hàng**
  - **Tiêu chí chấp nhận:** NestJS cung cấp `POST /orders` nhận giỏ hàng, validate dữ liệu (class-validator), lưu đơn trạng thái `PENDING`, trả mã đơn.
  - **Điểm:** 1.0
  - **Nhánh:** `feature/task-6-order-api`

- **Task 7 (Story): Đăng ký / Đăng nhập (JWT)**
  - **Tiêu chí chấp nhận:** `POST /auth/register`, `POST /auth/login`; băm mật khẩu (bcrypt); cấp token JWT; guard bảo vệ route thanh toán và đặt hàng.
  - **Điểm:** 1.0
  - **Nhánh:** `feature/task-7-auth-jwt`

---

### Sprint 3: Thanh toán, Bàn giao & Nghiệp vụ nâng cao
- **Task 8 (Story): Thanh toán không tiền mặt**
  - **Tiêu chí chấp nhận:** Tích hợp Mock Payment Service (Ví điện tử Momo/ZaloPay/Thẻ), gọi `POST /payments`; đơn chuyển `PAID` khi thành công, `PAYMENT_FAILED` khi lỗi.
  - **Điểm:** 1.0
  - **Nhánh:** `feature/task-8-cashless-payment`

- **Task 9 (Story): Xác nhận, lịch sử đơn & Bàn giao**
  - **Tiêu chí chấp nhận:** Màn hình xác nhận đơn (#mã đơn, trạng thái) và `GET /orders/me` (lịch sử đơn); Docker Compose chạy đồng thời 3 container (frontend, backend, postgres); README hoàn chỉnh; demo end-to-end.
  - **Điểm:** 1.0
  - **Nhánh:** `feature/task-9-order-confirmation-history`

- **Task 10 (Story): Nghiệp vụ Backend nâng cao**
  - **Tiêu chí chấp nhận:** 
    1. Order State Machine: Chặn chuyển trạng thái không hợp lệ.
    2. Thanh toán Idempotent: Sử dụng `Idempotency-Key` tránh duplicate charge.
    3. Kiểm soát tồn kho: Transaction + Optimistic Locking khi đặt đồng thời.
    4. Mã giảm giá & Điểm thưởng tích lũy (Loyalty Points).
    5. Unit/Integration tests chứng minh cả 4 tiêu chí.
  - **Điểm:** 1.0
  - **Nhánh:** `feature/task-10-backend-advanced-business`

---

## 3. Các Sự Kiện Scrum (Scrum Events)
1. **Sprint Planning:** Đầu mỗi Sprint, PO và Team họp chọn backlog items vào Sprint Backlog.
2. **Daily Scrum:** 15 phút hàng ngày cập nhật tiến độ, gỡ khó khăn, cập nhật Burndown chart.
3. **Sprint Review:** Cuối Sprint, demo Increment chạy được cho Product Owner và Giảng viên.
4. **Sprint Retrospective:** Rút kinh nghiệm những việc đã làm tốt và cải tiến cho Sprint tiếp theo.

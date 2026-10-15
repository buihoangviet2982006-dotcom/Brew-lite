# Definition of Done (DoD) - Tiêu Chí Hoàn Thành

Theo quy định mục 10 của đề bài **BrewLite VER 1.0**, một Task chỉ được tính điểm khi thỏa mãn đầy đủ các điều kiện sau:

1. **Chất lượng mã nguồn & Build:**
   - Code chạy được, không có lỗi build hoặc cảnh báo nghiêm trọng.
   - Tuân thủ chính xác tiêu chí chấp nhận (Acceptance Criteria) của Task.

2. **Quy chuẩn Git & Code Review:**
   - Commit trên Git với thông điệp rõ ràng theo chuẩn Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`).
   - Được review chéo bởi thành viên trong nhóm trước khi merge vào nhánh `develop`.

3. **Validation & Xử lý ngoại lệ:**
   - API Backend có validate dữ liệu đầu vào (sử dụng `class-validator`, `ValidationPipe`).
   - Frontend có xử lý đầy đủ các trạng thái: Loading (Skeleton/Spinner), Empty state, Error state.

4. **Tài liệu & Hướng dẫn:**
   - Có cập nhật hướng dẫn chạy tương ứng trong file `README.md`.
   - Cập nhật tài liệu API / Swagger nếu có endpoint mới.

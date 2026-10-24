# Tuần tra West Bay: cài đặt báo về trưởng ca

Gồm ba phần:
- `index.html`: trang cho nhân viên (mở bằng link riêng có mã).
- `admin.html`: trang trưởng ca, hiện thẻ từng nhân viên và báo đỏ.
- `Code.gs`: mã chạy trong Google Sheet của bạn, nhận báo cáo và tính trạng thái.

## Bước 1. Tạo Google Sheet và dán mã
1. Vào sheets.google.com, tạo Sheet trống, đặt tên "Tuần tra West Bay".
2. Menu **Tiện ích mở rộng > Apps Script**.
3. Xoá nội dung mặc định, dán toàn bộ file `Code.gs` vào, bấm biểu tượng lưu.
4. Ở cột trái chọn **Cài đặt dự án** (bánh răng), đặt **Múi giờ** là `(GMT+07:00) Bangkok, Hanoi, Jakarta`.
5. Quay lại **Trình chỉnh sửa**, chọn hàm `khoiTao` ở thanh trên, bấm **Chạy**, cấp quyền khi Google hỏi.
   - Google có thể hiện "Ứng dụng chưa được xác minh". Bấm **Nâng cao > Đi tới ... (không an toàn)**. Đây là mã của chính bạn.
6. Chạy tiếp hàm `caiTrigger` để bật email cảnh báo mỗi 10 phút.

## Bước 2. Triển khai thành ứng dụng web
1. Bấm **Triển khai > Tuỳ chọn triển khai mới**, loại **Ứng dụng web**.
2. **Thực thi dưới tên**: Tôi. **Người có quyền truy cập**: **Bất kỳ ai**.
3. Bấm **Triển khai**, sao chép **URL ứng dụng web** (kết thúc bằng `/exec`) và gửi cho Claude để điền vào `config.js`.

## Bước 3. Điền nhân viên (làm trực tiếp trên trang trưởng ca)
Mở `admin.html`, mục **Nhân viên và ca trực** để thêm, sửa tên, đổi ca, tạm dừng, đổi mã, xoá và sao chép link từng người. Mục **Quy tắc báo đỏ** sửa các con số. Bảng dưới đây chỉ để tham khảo cấu trúc trang NhanVien trong Sheet.

Trong Sheet, trang **NhanVien**:

| id | ten | ma | ca_truc | hoat_dong |
|---|---|---|---|---|
| A01 | Nguyễn Văn A | (mã tự tạo) | Ngày | x |

- `ca_truc`: `Ngày`, `Đêm`, `Cả hai`, hoặc để trống khi nghỉ. Chỉ người đang trong ca mới bị tính báo đỏ.
- `hoat_dong`: để `x` khi đang làm. Xoá `x` thì link của người đó ngừng hoạt động.
- `ma`: mã bí mật của từng người. Đổi mã để vô hiệu link cũ.

## Bước 4. Dùng
- Trưởng ca mở `admin.html`, nhập `adminKey` (lấy ở trang **CauHinh**). Ở mục "Link cho nhân viên" bấm sao chép link từng người rồi gửi riêng.
- Nhân viên mở link của mình, trang tự nhận tên. Mỗi lần chạm một điểm, giờ và điểm được báo về trưởng ca.

## Khi nào báo đỏ (chỉnh trong trang CauHinh)
- Quá giờ vòng kế tiếp: sau `gapMin` (90) cộng `tolMin` (10) phút mà chưa có vòng mới.
- Vòng còn thiếu điểm sau `roundGraceMin` (30) phút.
- Không có tín hiệu nào sau `startGraceMin` (30) phút đầu ca.
- Ca vừa kết thúc chưa đủ `minRounds` (6) vòng, hiện trong 4 giờ đầu ca mới.

Giờ ghi nhận là giờ máy chủ Google lúc nhận, nhân viên không đổi giờ máy để sửa được.

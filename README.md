# 971 Relax Court - Web nhân viên

Web quản lý ca và đối soát doanh thu cho nhân viên 971 Relax Court.

## Chức năng

- Ca 1: 05:00 - 11:00
- Ca 2: 14:00 - 18:00
- Ca 3: 18:00 - 22:00
- Nhập tên nhân viên và bắt đầu ca
- Lưu giờ bắt đầu/kết thúc thực tế
- Kết ca với: chuyển khoản, tiền mặt, doanh thu sân, doanh thu nước
- Tự tính tổng tiền thu, tổng doanh thu và chênh lệch
- Tổng hợp doanh thu theo ngày
- Lọc lịch sử theo ngày và ca
- Xuất CSV
- Có thể cài lên điện thoại như ứng dụng PWA

## Lưu dữ liệu

Phiên bản hiện tại dùng localStorage của trình duyệt. Dữ liệu được giữ khi tải lại trang trên cùng thiết bị/trình duyệt. Nếu cần nhiều điện thoại cùng xem chung một dữ liệu, có thể nâng cấp sang Supabase/Firebase.

## GitHub Pages

Repo có sẵn workflow `.github/workflows/pages.yml`. Trong GitHub vào **Settings → Pages → Source → GitHub Actions** để bật website công khai. Sau đó workflow sẽ deploy nội dung trên nhánh `main`.

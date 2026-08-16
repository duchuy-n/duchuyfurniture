# Nội thất Đức Huy

Website tĩnh được dựng lại từ dữ liệu public còn thu thập được từ `noithatduchuy.eportal.vn` và phần admin đọc-only của `noithathoaphatgroup.com.vn`.

## Chạy local

Mở trực tiếp:

```text
file:///D:/Desktop/Workspace/something/dhf/index.html
```

Hoặc chạy server tĩnh:

```powershell
python -m http.server 8000
```

Rồi vào `http://localhost:8000`.

## File chính

- `index.html`: khung trang, nội dung giới thiệu, sản phẩm, dịch vụ, liên hệ.
- `styles.css`: toàn bộ giao diện responsive, hover sản phẩm, modal, catalog.
- `products.js`: 1.369 sản phẩm khôi phục, gồm tên, mã, giá, VAT, kích thước, bảo hành, ảnh local.
- `script.js`: render catalog, lọc/tìm kiếm/sắp xếp, xem thêm, modal xem nhanh.
- `assets/`: ảnh giao diện, banner, tin tức.
- `crawl-output/product-images/`: 1.369 ảnh sản phẩm đã tải về local.
- `admin-readonly-output/`: báo cáo đọc-only từ admin, dùng để đối chiếu cây trang/file/skin.

## Tính năng đã có

- Catalog 1.369 sản phẩm thật đã khôi phục.
- Bộ lọc danh mục, tìm kiếm tiếng Việt không dấu, sắp xếp theo bán chạy/giá/tên.
- Chỉ hiển thị 24 sản phẩm ban đầu, có nút xem thêm để trang gọn và nhẹ.
- Card sản phẩm có badge, mã, giá, kích thước và hover hiện CTA gọi báo giá/xem nhanh.
- Modal xem nhanh hiển thị ảnh, mã sản phẩm, giá, VAT, thông số và bảo hành.
- Form báo giá nhanh, nút gọi/Zalo/báo giá nổi.
- Responsive cho desktop/tablet/mobile.
- Mobile responsive: menu danh mục cuộn ngang, card sản phẩm có nút luôn hiện trên màn cảm ứng, modal và floating actions tối ưu cho điện thoại.

## Ghi chú an toàn

Các lần đăng nhập admin chỉ dùng để đọc thông tin phục dựng. Không bấm lưu, cập nhật, xóa, thêm trang, đổi cấu hình hoặc chỉnh dữ liệu trên website cũ.





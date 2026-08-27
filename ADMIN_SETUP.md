# Cấu hình đăng nhập quản trị

Khu `/dang-nhap/` và `/quan-tri/` dùng API serverless trong thư mục `/api`. Không có mật khẩu thật nào nằm trong HTML/JS public.

## Biến môi trường cần thêm trên Vercel

- `ADMIN_USERNAME`: tên đăng nhập, ví dụ `admin`.
- `ADMIN_PASSWORD_SHA256`: hash SHA-256 dạng hex của mật khẩu.
- `ADMIN_SESSION_SECRET`: chuỗi bí mật dài, dùng để ký cookie đăng nhập.

## Tạo hash mật khẩu bằng PowerShell

Chạy trên máy của bạn, thay `mat-khau-manh-cua-ban` bằng mật khẩu thật:

```powershell
$p = "mat-khau-manh-cua-ban"
[BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($p))).Replace("-", "").ToLower()
```

Copy kết quả vào `ADMIN_PASSWORD_SHA256` trên Vercel.

## Tạo session secret

Có thể dùng PowerShell:

```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

Sau khi thêm env vars, redeploy Vercel rồi đăng nhập tại `/dang-nhap/`.

## Lưu ý hiện tại

Khu quản trị hiện lưu bản nháp sản phẩm trên trình duyệt và có nút xuất file `products.updated.js`. Để bấm lưu là cập nhật live ngay trên website, bước tiếp theo cần nối database hoặc CMS thật.

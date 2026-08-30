# Cấu hình đăng nhập quản trị, ImageKit và GitHub

Khu `/dang-nhap/` và `/quan-tri/` dùng API serverless trong thư mục `/api`. Không có mật khẩu thật, GitHub token hoặc khóa ImageKit nào nằm trong HTML/JS public.

## 1. Biến đăng nhập admin trên Vercel

- `ADMIN_USERNAME`: tên đăng nhập admin.
- `ADMIN_PASSWORD_SHA256`: hash SHA-256 dạng hex của mật khẩu.
- `ADMIN_SESSION_SECRET`: chuỗi bí mật dài, dùng để ký cookie đăng nhập.

Tạo hash mật khẩu bằng PowerShell, thay `mat-khau-manh-cua-ban` bằng mật khẩu thật:

```powershell
$p = "mat-khau-manh-cua-ban"
[BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($p))).Replace("-", "").ToLower()
```

Tạo session secret:

```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

## 2. Biến ImageKit trên Vercel

ImageKit dùng để lưu ảnh mẹ upload từ máy.

Thêm biến bắt buộc:

- `IMAGEKIT_PRIVATE_KEY`: private API key của ImageKit, lấy trong ImageKit Dashboard.

Có thể thêm biến tùy chọn:

- `IMAGEKIT_FOLDER`: thư mục lưu ảnh trên ImageKit. Nếu không nhập, web tự dùng `/duchuy-products`.

Cách lấy private key ImageKit:

1. Đăng nhập ImageKit.
2. Vào `Developer options` hoặc `API keys`.
3. Copy `Private key` vào `IMAGEKIT_PRIVATE_KEY` trên Vercel.

Chỉ nhập private key ở Vercel Environment Variables. Không đưa private key vào code, HTML, hoặc JavaScript public.

## 3. Biến GitHub trên Vercel

GitHub dùng để lưu danh sách sản phẩm trong file `products.js`. Khi mẹ bấm `Lưu lên web`, API sẽ commit file này lên GitHub, rồi Vercel tự deploy bản mới.

Thêm các biến này:

- `GITHUB_TOKEN`: GitHub fine-grained personal access token.
- `GITHUB_OWNER`: `duchuy-n`
- `GITHUB_REPO`: `duchuyfurniture`
- `GITHUB_BRANCH`: `main`

Cách tạo GitHub token an toàn:

1. Vào GitHub.
2. Mở `Settings` của tài khoản.
3. Vào `Developer settings`.
4. Chọn `Personal access tokens` -> `Fine-grained tokens`.
5. Bấm `Generate new token`.
6. Repository access: chọn đúng repo `duchuy-n/duchuyfurniture`.
7. Permissions: chỉ bật `Contents: Read and write`.
8. Tạo token, copy vào biến `GITHUB_TOKEN` trên Vercel.

Không commit token vào GitHub. Chỉ lưu token trong Vercel Environment Variables.

## 4. Sau khi thêm biến

Sau khi thêm hoặc sửa Environment Variables trên Vercel, vào `Deployments` và bấm `Redeploy` bản mới nhất.

Sau đó:

1. Mở `/dang-nhap/`.
2. Đăng nhập bằng tài khoản admin.
3. Vào `/quan-tri/`.
4. Bấm `Thêm sản phẩm`, chọn ảnh, nhập tên, nhập giá.
5. Bấm `Lưu lên web`.
6. Chờ Vercel deploy xong, thường khoảng 30 giây đến vài phút.
7. Khách vẫn xem được web trong lúc deploy; họ sẽ thấy bản mới sau khi deploy hoàn tất.

# Cấu hình đăng nhập quản trị, Firebase và ImageKit

Khu `/dang-nhap/` và `/quan-tri/` dùng API serverless trong thư mục `/api`. Không có mật khẩu thật, khóa Firebase hoặc khóa ImageKit nào nằm trong HTML/JS public.

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

## 2. Biến Firebase/Firestore trên Vercel

Firestore dùng để lưu data sản phẩm: tên, giá, mã, mô tả, link ảnh. Không dùng Firebase Storage nữa.

Thêm 3 biến này:

- `FIREBASE_PROJECT_ID`: ID project Firebase, ví dụ `duchuyfurniture`.
- `FIREBASE_CLIENT_EMAIL`: email của service account, thường có dạng `firebase-adminsdk-...@...iam.gserviceaccount.com`.
- `FIREBASE_PRIVATE_KEY`: private key trong file service account JSON, gồm cả dòng `-----BEGIN PRIVATE KEY-----` và `-----END PRIVATE KEY-----`.

Cách lấy trong Firebase Console:

1. Vào Firebase project.
2. Bấm bánh răng `Project settings`.
3. Vào tab `Service accounts`.
4. Chọn `Firebase Admin SDK`.
5. Bấm `Generate new private key`.
6. Tải file JSON về máy.
7. Mở file JSON bằng Notepad.
8. Copy:
   - `project_id` vào `FIREBASE_PROJECT_ID`
   - `client_email` vào `FIREBASE_CLIENT_EMAIL`
   - `private_key` vào `FIREBASE_PRIVATE_KEY`

Với `FIREBASE_PRIVATE_KEY`, chỉ copy giá trị của dòng `private_key`, không copy cả file JSON và không copy dấu `"` ngoài cùng. Giữ nguyên các đoạn `\n` trong value.

Không commit file JSON service account vào GitHub.

## 3. Biến ImageKit trên Vercel

ImageKit dùng để lưu ảnh mẹ upload từ máy. Không cần Firebase Storage/Blaze cho ảnh nữa.

Thêm biến bắt buộc:

- `IMAGEKIT_PRIVATE_KEY`: private API key của ImageKit, lấy trong ImageKit Dashboard.

Có thể thêm biến tùy chọn:

- `IMAGEKIT_FOLDER`: thư mục lưu ảnh trên ImageKit. Nếu không nhập, web tự dùng `/duchuy-products`.

Cách lấy private key ImageKit:

1. Tạo tài khoản hoặc đăng nhập ImageKit.
2. Vào ImageKit Dashboard.
3. Vào `Developer options` hoặc `API keys`.
4. Copy `Private key` vào `IMAGEKIT_PRIVATE_KEY` trên Vercel.

Chỉ nhập private key ở Vercel Environment Variables. Không đưa private key vào code, HTML, hoặc JavaScript public.

## 4. Firestore Rules khuyến nghị

Vì web đọc/ghi Firestore qua Vercel API server-side, có thể khóa client trực tiếp:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Service account của Vercel vẫn ghi được nhờ quyền IAM, còn người ngoài trình duyệt không ghi trực tiếp được.

## 5. Sau khi thêm biến

Sau khi thêm hoặc sửa Environment Variables trên Vercel, vào `Deployments` và bấm `Redeploy` bản mới nhất.

Sau đó:

1. Mở `/dang-nhap/`.
2. Đăng nhập bằng tài khoản admin.
3. Vào `/quan-tri/`.
4. Nếu Firestore đang trống, web sẽ tự đưa toàn bộ sản phẩm cũ lên Firebase theo từng mẻ. Chỉ cần để trang mở và chờ trạng thái báo xong.
5. Nếu sản phẩm cũ vẫn đang dùng ảnh local, web sẽ tự đưa ảnh cũ lên ImageKit theo từng mẻ rồi cập nhật lại link ảnh trong Firestore.
6. Sau đó mẹ chỉ cần bấm `Thêm sản phẩm`, chọn ảnh, nhập tên, nhập giá và bấm `Lưu lên web`.

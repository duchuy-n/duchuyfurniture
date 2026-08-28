# Cấu hình đăng nhập quản trị và Firebase

Khu `/dang-nhap/` và `/quan-tri/` dùng API serverless trong thư mục `/api`. Không có mật khẩu thật hoặc khóa Firebase nào nằm trong HTML/JS public.

## 1. Biến đăng nhập admin trên Vercel

- `ADMIN_USERNAME`: tên đăng nhập, ví dụ `noithatduchuy`.
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

Thêm tiếp 3 biến này để nút `Lưu lên web` và `Đưa sản phẩm cũ lên Firebase` hoạt động:

- `FIREBASE_PROJECT_ID`: ID project Firebase, ví dụ `duchuyfurniture`.
- `FIREBASE_CLIENT_EMAIL`: email của service account, thường có dạng `firebase-adminsdk-...@...iam.gserviceaccount.com`.
- `FIREBASE_PRIVATE_KEY`: private key trong file service account JSON, gồm cả dòng `-----BEGIN PRIVATE KEY-----` và `-----END PRIVATE KEY-----`.

Cách lấy 3 giá trị này trong Firebase Console:

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

Không commit file JSON service account vào GitHub.

## 3. Firestore Rules khuyến nghị

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

## 4. Sau khi thêm biến

Sau khi thêm hoặc sửa Environment Variables trên Vercel, vào `Deployments` và bấm `Redeploy` bản mới nhất.

Sau đó:

1. Mở `/dang-nhap/`.
2. Đăng nhập bằng tài khoản admin.
3. Vào `/quan-tri/`.
4. Nếu Firebase trống, bấm `Đưa sản phẩm cũ lên Firebase` một lần.
5. Sau đó mẹ chỉ cần sửa sản phẩm và bấm `Lưu lên web`.

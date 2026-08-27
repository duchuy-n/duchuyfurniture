const form = document.querySelector("#adminLoginForm");
const identity = document.querySelector("#loginIdentity");
const password = document.querySelector("#loginPassword");
const message = document.querySelector("#loginMessage");
const togglePassword = document.querySelector("#togglePassword");

function setMessage(text, type = "info") {
  if (!message) return;
  message.textContent = text;
  message.dataset.type = type;
}

togglePassword?.addEventListener("click", () => {
  if (!password) return;
  const isHidden = password.type === "password";
  password.type = isHidden ? "text" : "password";
  togglePassword.textContent = isHidden ? "Ẩn" : "Hiện";
  togglePassword.setAttribute("aria-label", isHidden ? "Ẩn mật khẩu" : "Hiện mật khẩu");
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = identity?.value.trim() || "";
  const pass = password?.value || "";

  if (!username || !pass) {
    setMessage("Bạn nhập đủ tài khoản và mật khẩu để vào khu quản trị nhé.", "error");
    return;
  }

  setMessage("Đang kiểm tra đăng nhập...", "info");

  try {
    const response = await fetch("../api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password: pass })
    });

    if (response.ok) {
      setMessage("Đăng nhập thành công. Đang mở khu quản trị sản phẩm...", "success");
      window.setTimeout(() => {
        window.location.href = "../quan-tri/";
      }, 650);
      return;
    }

    if (response.status === 503) {
      setMessage("Chưa cấu hình biến môi trường đăng nhập trên Vercel. Cần ADMIN_USERNAME, ADMIN_PASSWORD_SHA256 và ADMIN_SESSION_SECRET.", "error");
      return;
    }

    setMessage("Tài khoản hoặc mật khẩu chưa đúng.", "error");
  } catch {
    setMessage("Chưa gọi được API đăng nhập. Hãy chạy qua Vercel/dev server có hỗ trợ /api, không mở bằng file trực tiếp.", "error");
  }
});

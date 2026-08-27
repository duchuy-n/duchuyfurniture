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

form?.addEventListener("submit", (event) => {
  event.preventDefault();

  const user = identity?.value.trim() || "";
  const pass = password?.value || "";

  if (!user || !pass) {
    setMessage("Bạn nhập đủ email/số điện thoại và mật khẩu để kiểm tra form nhé.", "error");
    return;
  }

  setMessage("Form đăng nhập đã hoạt động. Bước tiếp theo là nối backend/auth để quản trị sản phẩm thật.", "success");
});


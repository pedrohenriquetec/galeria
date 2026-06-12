const AUTH_USERS_KEY = "nexarium_omega_users";
const AUTH_SESSION_KEY = "nexarium_omega_session";

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function loadUsers() {
  return safeJsonParse(localStorage.getItem(AUTH_USERS_KEY)) || [];
}

function saveUsers(users) {
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

function getSession() {
  return safeJsonParse(localStorage.getItem(AUTH_SESSION_KEY));
}

function setSession(session) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

function hashPassword(password) {
  return btoa(password || "");
}

function findUser(email) {
  return loadUsers().find((user) => user.email === email.toLowerCase());
}

function registerUser(email, password) {
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail || !password || password.length < 6) {
    return { success: false, message: "Senha deve ter pelo menos 6 caracteres." };
  }

  if (findUser(normalizedEmail)) {
    return { success: false, message: "Já existe uma conta com esse email." };
  }

  const users = loadUsers();
  const user = {
    userId: `user-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    email: normalizedEmail,
    password: hashPassword(password),
  };
  users.push(user);
  saveUsers(users);
  setSession({ userId: user.userId, email: user.email });

  return { success: true, user };
}

function loginUser(email, password) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = findUser(normalizedEmail);
  if (!user) {
    return { success: false, message: "Email ou senha incorretos." };
  }

  if (user.password !== hashPassword(password)) {
    return { success: false, message: "Email ou senha incorretos." };
  }

  setSession({ userId: user.userId, email: user.email });
  return { success: true, user };
}

function showAuthMessage(message, type = "error") {
  const messageEl = document.getElementById("authMessage");
  if (!messageEl) {
    return;
  }

  messageEl.textContent = message;
  messageEl.className = `auth-message auth-${type}`;
}

function setAuthMode(mode) {
  const loginBtn = document.getElementById("loginModeBtn");
  const registerBtn = document.getElementById("registerModeBtn");
  const submitBtn = document.getElementById("authSubmitBtn");

  if (!loginBtn || !registerBtn || !submitBtn) {
    return;
  }

  const isLogin = mode === "login";
  loginBtn.classList.toggle("active", isLogin);
  registerBtn.classList.toggle("active", !isLogin);
  loginBtn.setAttribute("aria-selected", String(isLogin));
  registerBtn.setAttribute("aria-selected", String(!isLogin));
  submitBtn.textContent = isLogin ? "Entrar" : "Cadastrar";
  submitBtn.dataset.mode = mode;
  showAuthMessage("", "info");
}

function initAuthPage() {
  const session = getSession();
  if (session?.userId) {
    window.location.replace("galeria.html");
    return;
  }

  const loginBtn = document.getElementById("loginModeBtn");
  const registerBtn = document.getElementById("registerModeBtn");
  const authForm = document.getElementById("authForm");
  const emailInput = document.getElementById("authEmail");
  const passwordInput = document.getElementById("authPassword");

  if (!authForm || !emailInput || !passwordInput || !loginBtn || !registerBtn) {
    return;
  }

  loginBtn.addEventListener("click", () => setAuthMode("login"));
  registerBtn.addEventListener("click", () => setAuthMode("register"));
  setAuthMode("login");

  authForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    if (!email || !password) {
      showAuthMessage("Informe email e senha.", "error");
      return;
    }

    const mode = event.submitter?.dataset?.mode || authForm.querySelector("button[type='submit']")?.dataset?.mode || "login";
    const result = mode === "register" ? registerUser(email, password) : loginUser(email, password);
    if (!result.success) {
      showAuthMessage(result.message, "error");
      return;
    }

    window.location.replace("galeria.html");
  });
}

function requireAuth() {
  const session = getSession();
  if (!session?.userId) {
    window.location.replace("index.html");
    return null;
  }
  return session;
}

function logout() {
  clearSession();
  window.location.replace("index.html");
}

window.auth = {
  getSession,
  requireAuth,
  logout,
};

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("authForm")) {
    initAuthPage();
  }
});

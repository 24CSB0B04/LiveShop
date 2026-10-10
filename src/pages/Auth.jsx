import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";

const REMEMBER_KEY = "liveshop_remembered_credentials";

function loadRemembered() {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function Auth() {
  const remembered = loadRemembered();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: remembered?.email || "",
    password: remembered?.password || "",
    shopName: "",
  });
  const [rememberMe, setRememberMe] = useState(!!remembered?.email);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem("token")) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  function switchMode(next) {
    setMode(next);
    setError("");
    setShowPassword(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = mode === "login" ? await api.login(form) : await api.register(form);

      localStorage.setItem("token", data.token);
      localStorage.setItem("seller", JSON.stringify(data.seller));

      if (rememberMe) {
        localStorage.setItem(
          REMEMBER_KEY,
          JSON.stringify({ email: form.email.trim(), password: form.password })
        );
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }

      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <aside className="auth-aside">
          <p className="join-brand">LiveShop</p>
          <h2>Sell live. Get paid on WhatsApp.</h2>
          <p className="muted">
            Upload products, share your shop link, and receive orders with bargain offers from customers.
          </p>
          <ul className="auth-perks">
            <li>Shareable customer storefront</li>
            <li>Bargain offers on every item</li>
            <li>WhatsApp bill in one tap</li>
          </ul>
        </aside>

        <div className="auth-card">
          <div className="auth-header">
            <h1>{mode === "login" ? "Welcome back" : "Create your shop"}</h1>
            <p className="muted">
              {mode === "login"
                ? "Sign in to manage products and orders"
                : "Set up your seller account in under a minute"}
            </p>
          </div>

          <div className="auth-toggle" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={mode === "login" ? "active" : ""}
              onClick={() => switchMode("login")}
            >
              Log in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              className={mode === "register" ? "active" : ""}
              onClick={() => switchMode("register")}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} autoComplete="on">
            {mode === "register" && (
              <>
                <div className="input-group">
                  <label htmlFor="auth-name">Full name</label>
                  <input
                    id="auth-name"
                    name="name"
                    autoComplete="name"
                    placeholder="e.g. Utsav Agrawal"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="auth-shop">Shop name</label>
                  <input
                    id="auth-shop"
                    name="organization"
                    autoComplete="organization"
                    placeholder="e.g. Utsav's Gadgets"
                    value={form.shopName}
                    onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                  />
                </div>
              </>
            )}

            <div className="input-group">
              <label htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="auth-password">Password</label>
              <div className="password-field">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {mode === "login" ? (
              <label className="remember-row">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember email & password on this device</span>
              </label>
            ) : (
              <label className="remember-row">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Save credentials for next login</span>
              </label>
            )}

            {error && <p className="error">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary-block">
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Log in →"
                  : "Create shop →"}
            </button>
          </form>

          <p className="auth-customer-link muted small">
            Looking to shop? <Link to="/">Join a shop as customer</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

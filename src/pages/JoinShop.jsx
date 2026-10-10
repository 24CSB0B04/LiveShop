import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";

const LAST_SHOP_KEY = "liveshop_last_shop_code";

function extractSlug(raw) {
  const value = (raw || "").trim();
  if (!value) return "";

  try {
    if (value.includes("/shop/")) {
      const url = value.startsWith("http") ? new URL(value) : new URL(value, window.location.origin);
      const parts = url.pathname.split("/").filter(Boolean);
      const shopIdx = parts.indexOf("shop");
      if (shopIdx >= 0 && parts[shopIdx + 1]) return parts[shopIdx + 1];
    }
  } catch {
    // fall through to plain slug
  }

  return value.replace(/^\/+|\/+$/g, "").split("/").pop();
}

export default function JoinShop() {
  const [code, setCode] = useState(() => localStorage.getItem(LAST_SHOP_KEY) || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleJoin(e) {
    e.preventDefault();
    setError("");
    const slug = extractSlug(code);
    if (!slug) {
      setError("Enter a shop code or paste the shop link.");
      return;
    }

    setLoading(true);
    try {
      await api.getShop(slug);
      localStorage.setItem(LAST_SHOP_KEY, slug);
      navigate(`/shop/${slug}`);
    } catch (err) {
      setError(err.message || "Shop not found. Check the code and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="join-page">
      <div className="join-card">
        <p className="join-brand">LiveShop</p>
        <h1>Join a shop</h1>
        <p className="muted">
          Enter the shop code from your seller, or paste the link they shared with you.
        </p>

        <form onSubmit={handleJoin}>
          <div className="input-group">
            <label htmlFor="shop-code">Shop code or link</label>
            <input
              id="shop-code"
              placeholder="e.g. my-shop-x7f2 or full shop URL"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              required
            />
          </div>

          {error && <p className="error">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary-block">
            {loading ? "Joining..." : "Enter shop →"}
          </button>
        </form>

        <p className="join-footer muted small">
          Are you a seller? <Link to="/login">Open seller portal</Link>
        </p>
      </div>
    </div>
  );
}

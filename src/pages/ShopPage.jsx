import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, getImageUrl, generateWhatsAppLink } from "../api.js";

const TRACK_KEY = (slug) => `liveshop_track_${slug}`;

export default function ShopPage() {
  const { slug } = useParams();
  const [shop, setShop] = useState(null);
  const [cart, setCart] = useState({});
  const [offers, setOffers] = useState({});
  const [activeBargainId, setActiveBargainId] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customer, setCustomer] = useState({ customerName: "", customerPhone: "", customerNote: "" });
  const [address, setAddress] = useState("");
  const [placing, setPlacing] = useState(false);
  const [submittingAddress, setSubmittingAddress] = useState(false);
  const [tracked, setTracked] = useState(null); // { order, shopName }
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getShop(slug)
      .then(setShop)
      .catch((err) => setError(err.message));

    try {
      const saved = JSON.parse(localStorage.getItem(TRACK_KEY(slug)) || "null");
      if (saved?.orderId && saved?.phone) {
        api
          .getCustomerOrder(slug, saved.orderId, saved.phone)
          .then((data) => {
            setTracked(data);
            setCustomer((c) => ({ ...c, customerPhone: saved.phone, customerName: data.order.customerName || c.customerName }));
          })
          .catch(() => localStorage.removeItem(TRACK_KEY(slug)));
      }
    } catch {
      // ignore
    }
  }, [slug]);

  // Poll while waiting for seller accept / after accept until address done
  useEffect(() => {
    if (!tracked?.order) return;
    const status = tracked.order.status;
    if (!["pending", "accepted"].includes(status)) return;

    const timer = setInterval(() => {
      const phone = tracked.order.customerPhone;
      api
        .getCustomerOrder(slug, tracked.order._id, phone)
        .then(setTracked)
        .catch(() => {});
    }, 4000);

    return () => clearInterval(timer);
  }, [slug, tracked?.order?._id, tracked?.order?.status, tracked?.order?.customerPhone]);

  function addToCart(product) {
    setCart((prev) => {
      const current = prev[product._id] || 0;
      if (current >= product.stock) return prev;
      return { ...prev, [product._id]: current + 1 };
    });
  }

  function removeFromCart(productId) {
    setCart((prev) => {
      const next = { ...prev };
      if (next[productId] <= 1) delete next[productId];
      else next[productId] -= 1;
      return next;
    });
  }

  function setBargainOffer(productId, priceVal, listedPrice) {
    const val = Number(priceVal);
    if (!priceVal || isNaN(val) || val <= 0) {
      setOffers((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      return;
    }
    // Cap at listed - 1 so customer proposes a bargain, not a new list price
    const capped = Math.min(val, Math.max(1, listedPrice - 1));
    setOffers((prev) => ({ ...prev, [productId]: capped }));
  }

  const cartItems = shop
    ? Object.entries(cart).map(([productId, quantity]) => {
        const product = shop.products.find((p) => p._id === productId);
        const offerPrice = offers[productId] ? Number(offers[productId]) : null;
        return { productId, quantity, product, offerPrice };
      })
    : [];

  const listedTotal = cartItems.reduce((sum, item) => sum + (item.product?.price || 0) * item.quantity, 0);
  const proposedTotal = cartItems.reduce((sum, item) => {
    const unit = item.offerPrice != null ? item.offerPrice : item.product?.price || 0;
    return sum + unit * item.quantity;
  }, 0);

  async function placeOrder(e) {
    e.preventDefault();
    setPlacing(true);
    setError("");
    try {
      const items = cartItems.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        offerPrice: i.offerPrice,
      }));
      const result = await api.placeOrder(slug, { items, ...customer });
      const order = result.order;
      localStorage.setItem(
        TRACK_KEY(slug),
        JSON.stringify({ orderId: order._id, phone: customer.customerPhone })
      );
      setTracked({ order, shopName: result.shopName || shop.shopName });
      setCart({});
      setOffers({});
      setCheckoutOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setPlacing(false);
    }
  }

  async function submitAddress(e) {
    e.preventDefault();
    setSubmittingAddress(true);
    setError("");
    try {
      const result = await api.submitOrderAddress(slug, tracked.order._id, {
        phone: tracked.order.customerPhone,
        customerAddress: address,
      });
      setTracked({ order: result.order, shopName: result.shopName || shop.shopName });
      setAddress("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingAddress(false);
    }
  }

  function clearTracking() {
    localStorage.removeItem(TRACK_KEY(slug));
    setTracked(null);
    setAddress("");
    setError("");
  }

  if (error && !shop) {
    return (
      <div className="shop-page">
        <p className="error">{error}</p>
        <Link to="/" className="ghost">
          ← Back to join shop
        </Link>
      </div>
    );
  }

  if (!shop) return <div className="shop-page"><p className="loading-txt">Loading storefront...</p></div>;

  // ---- Order tracking / post-submit states ----
  if (tracked?.order) {
    const order = tracked.order;
    const idShort = (order._id || "").slice(-6).toUpperCase();

    if (order.status === "pending") {
      return (
        <div className="shop-page">
          <div className="confirmation">
            <div className="status-pulse">Waiting</div>
            <h1>Sent to seller</h1>
            <p className="muted">Request #{idShort}</p>
            <p className="total-display">
              Proposed total: <span>₹{order.total}</span>
              {order.originalTotal > order.total && (
                <span className="savings-badge"> vs listed ₹{order.originalTotal}</span>
              )}
            </p>
            <p className="muted">
              Your cart{order.hasBargain ? " and bargain offers are" : " is"} waiting for the shop owner to accept.
              You can send your delivery address only after they accept.
            </p>
            <a
              href={generateWhatsAppLink(order, shop.shopName, "request")}
              target="_blank"
              rel="noopener noreferrer"
              className="whatsapp-btn"
            >
              Notify seller on WhatsApp
            </a>
            <p className="muted small mt-4">This page updates automatically.</p>
            <button className="ghost mt-4" onClick={clearTracking}>
              ← Back to store
            </button>
          </div>
        </div>
      );
    }

    if (order.status === "accepted") {
      return (
        <div className="shop-page">
          <div className="confirmation">
            <div className="success-icon">✓</div>
            <h1>Cart accepted</h1>
            <p className="muted">Request #{idShort} · Total ₹{order.total}</p>
            <p className="muted">The seller accepted your cart. Enter your delivery address below.</p>

            <form className="address-form" onSubmit={submitAddress}>
              <div className="input-group">
                <label>Delivery address</label>
                <textarea
                  placeholder="House / street, area, city, pincode"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                  rows={4}
                />
              </div>
              {error && <p className="error">{error}</p>}
              <button type="submit" disabled={submittingAddress} className="btn-primary-block">
                {submittingAddress ? "Sending..." : "Send address →"}
              </button>
            </form>
          </div>
        </div>
      );
    }

    if (order.status === "rejected") {
      return (
        <div className="shop-page">
          <div className="confirmation">
            <h1>Cart declined</h1>
            <p className="muted">
              The seller declined request #{idShort}
              {order.hasBargain ? " (bargain not accepted)." : "."} You can browse again and send a new request.
            </p>
            <button className="btn-primary-block" onClick={clearTracking}>
              Back to store →
            </button>
          </div>
        </div>
      );
    }

    // confirmed / shipped / completed
    return (
      <div className="shop-page">
        <div className="confirmation">
          <div className="success-icon">✓</div>
          <h1>Address sent</h1>
          <p className="muted">Order #{idShort} · {order.status}</p>
          <p className="total-display">
            Total: <span>₹{order.total}</span>
          </p>
          {order.customerAddress && (
            <p className="address-preview muted">📍 {order.customerAddress}</p>
          )}
          <a
            href={generateWhatsAppLink(order, shop.shopName, "address")}
            target="_blank"
            rel="noopener noreferrer"
            className="whatsapp-btn"
          >
            Share address on WhatsApp
          </a>
          <button className="ghost mt-4" onClick={clearTracking}>
            ← Keep shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shop-page">
      <div className="shop-topbar">
        <Link to="/" className="ghost small">
          ← Switch shop
        </Link>
        <span className="muted small">Customer view</span>
      </div>

      {shop.shopBanner && <img className="banner" src={getImageUrl(shop.shopBanner)} alt="Store Banner" />}

      <div className="shop-header-info">
        <h1>{shop.shopName}</h1>
        <p className="muted">Sold by <strong>{shop.sellerName}</strong></p>
        <p className="shop-hint muted small">
          Add items, propose a bargain price if you want, then send the cart for seller approval.
          Address is shared only after they accept.
        </p>
      </div>

      <div className="shop-grid">
        {shop.products.map((p) => {
          const hasOffer = offers[p._id] != null;
          const currentOffer = offers[p._id];

          return (
            <div className={`shop-product-card ${hasOffer ? "has-bargain" : ""}`} key={p._id}>
              {p.image && <img src={getImageUrl(p.image)} alt={p.name} />}
              <div className="product-details">
                <h3>{p.name}</h3>
                {p.description && <p className="muted small">{p.description}</p>}

                <div className="price-tag-box">
                  <span className="price">₹{p.price}</span>
                  {hasOffer && <span className="offer-price-tag">Your offer: ₹{currentOffer}</span>}
                </div>

                <p className="muted small">{p.stock} left</p>
              </div>

              <div className="bargain-section">
                {activeBargainId === p._id ? (
                  <div className="bargain-input-box">
                    <label>Propose offer below ₹{p.price}</label>
                    <div className="row">
                      <input
                        type="number"
                        min="1"
                        max={p.price - 1}
                        step="1"
                        placeholder={`Max ₹${p.price - 1}`}
                        value={offers[p._id] || ""}
                        onChange={(e) => setBargainOffer(p._id, e.target.value, p.price)}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="ghost small"
                        onClick={() => setActiveBargainId(null)}
                      >
                        Done
                      </button>
                    </div>
                    <p className="muted small bargain-save-hint">
                      Offer is a request only — seller must accept before it applies.
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="bargain-toggle-btn"
                    onClick={() => setActiveBargainId(p._id)}
                  >
                    {hasOffer ? `Edit offer · ₹${currentOffer}` : "Bargain"}
                  </button>
                )}
              </div>

              {cart[p._id] ? (
                <div className="qty-control">
                  <button type="button" onClick={() => removeFromCart(p._id)}>−</button>
                  <span>{cart[p._id]} in cart</span>
                  <button type="button" onClick={() => addToCart(p)}>+</button>
                </div>
              ) : (
                <button type="button" className="add-cart-btn" onClick={() => addToCart(p)}>
                  Add to cart
                </button>
              )}
            </div>
          );
        })}
        {shop.products.length === 0 && (
          <p className="muted shop-empty">No products listed yet. Check back soon.</p>
        )}
      </div>

      {cartItems.length > 0 && (
        <div className="cart-bar" onClick={() => setCheckoutOpen(true)}>
          <div className="row space-between">
            <span>{cartItems.reduce((n, i) => n + i.quantity, 0)} items</span>
            <span>
              Listed <strong>₹{listedTotal}</strong>
              {proposedTotal < listedTotal && (
                <small className="saving-text"> · offer ₹{proposedTotal}</small>
              )}
            </span>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div className="modal-backdrop" onClick={() => setCheckoutOpen(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={placeOrder}>
            <h2>Send cart for approval</h2>
            <p className="muted small">
              The seller must accept this cart first. You will enter your delivery address only after acceptance.
            </p>
            <ul className="cart-item-list">
              {cartItems.map((i) => (
                <li key={i.productId}>
                  <div>
                    <strong>{i.product.name}</strong> × {i.quantity}
                    {i.offerPrice != null && (
                      <div className="bargain-summary-badge">
                        Offer ₹{i.offerPrice} (listed ₹{i.product.price}) — needs approval
                      </div>
                    )}
                  </div>
                  <span>₹{(i.offerPrice != null ? i.offerPrice : i.product.price) * i.quantity}</span>
                </li>
              ))}
            </ul>

            <div className="cart-totals-summary">
              <div className="row space-between muted">
                <span>Listed total</span>
                <span>₹{listedTotal}</span>
              </div>
              <div className="row space-between grand-total">
                <span>Your proposed total</span>
                <strong>₹{proposedTotal}</strong>
              </div>
            </div>

            <div className="input-group">
              <label>Your name</label>
              <input
                placeholder="e.g. Rahul Sharma"
                value={customer.customerName}
                onChange={(e) => setCustomer({ ...customer, customerName: e.target.value })}
                required
              />
            </div>
            <div className="input-group">
              <label>Phone / WhatsApp</label>
              <input
                placeholder="e.g. 9876543210"
                value={customer.customerPhone}
                onChange={(e) => setCustomer({ ...customer, customerPhone: e.target.value })}
                required
              />
            </div>
            <div className="input-group">
              <label>Note (optional)</label>
              <textarea
                placeholder="Why you're bargaining, preferred time, etc. — not your address yet"
                value={customer.customerNote}
                onChange={(e) => setCustomer({ ...customer, customerNote: e.target.value })}
              />
            </div>

            {error && <p className="error">{error}</p>}

            <div className="row">
              <button type="submit" disabled={placing} className="btn-primary-block">
                {placing ? "Sending..." : "Send to seller →"}
              </button>
              <button type="button" className="ghost" onClick={() => setCheckoutOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

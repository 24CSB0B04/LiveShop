import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getImageUrl, generateWhatsAppLink } from "../api.js";


const EMPTY_PRODUCT = { name: "", description: "", price: "", image: "", stock: "", category: "", isShowcased: true };

export default function Dashboard() {
  const [tab, setTab] = useState("products"); // "products" | "orders"
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [editingId, setEditingId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const seller = JSON.parse(localStorage.getItem("seller") || "{}");
  const navigate = useNavigate();

  const shopLink = `${window.location.origin}/shop/${seller.shareSlug}`;

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (tab === "orders") loadOrders();
  }, [tab]);

  async function loadProducts() {
    const data = await api.getProducts();
    setProducts(data);
  }

  async function loadOrders() {
    const data = await api.getOrders();
    setOrders(data);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("seller");
    navigate("/login");
  }

  async function handleImageFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const res = await api.uploadImage(file);
      setForm((prev) => ({ ...prev, image: res.imageUrl }));
    } catch (err) {
      alert("Failed to upload image: " + err.message);
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, price: Number(form.price), stock: Number(form.stock) || 0 };
    if (editingId) {
      await api.updateProduct(editingId, payload);
    } else {
      await api.createProduct(payload);
    }
    setForm(EMPTY_PRODUCT);
    setEditingId(null);
    loadProducts();
  }

  function startEdit(product) {
    setEditingId(product._id);
    setForm({
      name: product.name,
      description: product.description,
      price: product.price,
      image: product.image,
      stock: product.stock,
      category: product.category,
      isShowcased: product.isShowcased !== false,
    });
  }

  async function toggleShowcase(product) {
    await api.updateProduct(product._id, { isShowcased: !product.isShowcased });
    loadProducts();
  }

  async function removeProduct(id) {
    if (!confirm("Delete this product?")) return;
    await api.deleteProduct(id);
    loadProducts();
  }

  function copyLink() {
    navigator.clipboard.writeText(shopLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div>
          <h1>{seller.shopName}</h1>
          <p className="share-link" onClick={copyLink}>
            {shopLink} {copied ? "✓ copied" : "· click to copy link"}
          </p>
        </div>
        <div className="row">
          <a
            href={`/shop/${seller.shareSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ghost small btn-store-link"
          >
            🌐 Open Storefront
          </a>
          <button className="ghost small" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}>
          Products ({products.length})
        </button>
        <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>
          Orders ({orders.length})
        </button>
      </nav>

      {tab === "products" && (
        <div className="products-tab">
          <form className="product-form" onSubmit={handleSubmit}>
            <h2>{editingId ? "Edit product" : "Add a product"}</h2>
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div className="row">
              <input
                type="number"
                placeholder="Price"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
              />
              <input
                type="number"
                placeholder="Stock"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            </div>
            <div className="file-input-group">
              <label>Product Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                disabled={uploadingImage}
              />
              {uploadingImage && <p className="muted small">Uploading image to local storage...</p>}
              {form.image && (
                <div className="image-preview-box">
                  <img src={getImageUrl(form.image)} alt="Preview" />
                  <button
                    type="button"
                    className="ghost small danger"
                    onClick={() => setForm({ ...form, image: "" })}
                  >
                    Remove image
                  </button>
                </div>
              )}
            </div>
            <input
              placeholder="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            <label className="showcase-toggle form-showcase">
              <input
                type="checkbox"
                checked={form.isShowcased !== false}
                onChange={(e) => setForm({ ...form, isShowcased: e.target.checked })}
              />
              Mark as featured
            </label>
            <div className="row">
              <button type="submit" disabled={uploadingImage}>
                {editingId ? "Save changes" : "Add product"}
              </button>
              {editingId && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setEditingId(null);
                    setForm(EMPTY_PRODUCT);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="product-list">
            {products.map((p) => (
              <div className="product-card" key={p._id}>
                {p.image && <img src={getImageUrl(p.image)} alt={p.name} />}
                <div className="product-info">
                  <h3>{p.name}</h3>
                  <p>₹{p.price} · stock {p.stock}</p>

                  <div className="row">
                    <label className="showcase-toggle">
                      <input
                        type="checkbox"
                        checked={p.isShowcased}
                        onChange={() => toggleShowcase(p)}
                      />
                      Featured
                    </label>
                  </div>
                  {p.stock <= 0 && (
                    <p className="muted small hidden-hint">Out of stock — hidden from customers</p>
                  )}
                  <div className="row">
                    <button className="ghost small" onClick={() => startEdit(p)}>
                      Edit
                    </button>
                    <button className="ghost small danger" onClick={() => removeProduct(p._id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {products.length === 0 && <p className="muted">No products yet — add your first one above.</p>}
          </div>
        </div>
      )}

      {tab === "orders" && (
        <div className="orders-tab">
          {orders.map((o) => (
            <div className={`order-card status-border-${o.status}`} key={o._id}>
              <div className="row space-between">
                <div>
                  <strong>{o.customerName}</strong>
                  {o.hasBargain && <span className="bargain-badge-tag">BARGAIN OFFER</span>}
                </div>
                <span className={`status status-${o.status}`}>{o.status}</span>
              </div>
              {o.customerPhone && <p className="muted">{o.customerPhone}</p>}
              <ul className="order-item-list">
                {o.items.map((item, i) => (
                  <li key={i}>
                    {item.name} × {item.quantity} —{" "}
                    {item.offerPrice != null ? (
                      <span className="bargain-price-text">
                        <strong>₹{item.offerPrice * item.quantity}</strong> (offered, listed ₹
                        {item.price * item.quantity})
                      </span>
                    ) : (
                      <span>₹{item.price * item.quantity}</span>
                    )}
                  </li>
                ))}
              </ul>
              <div className="row space-between total-row">
                <span className="total">Proposed total: ₹{o.total}</span>
                {o.originalTotal && o.originalTotal > o.total && (
                  <span className="savings-tag">vs listed ₹{o.originalTotal}</span>
                )}
              </div>
              {o.customerNote && <p className="muted small">Note: {o.customerNote}</p>}
              {o.customerAddress ? (
                <p className="address-line">📍 {o.customerAddress}</p>
              ) : o.status === "accepted" ? (
                <p className="muted small waiting-address">Waiting for customer to send address…</p>
              ) : o.status === "pending" ? (
                <p className="muted small">Accept to unlock address from customer</p>
              ) : null}
              <p className="muted small">{new Date(o.createdAt).toLocaleString()}</p>

              <div className="order-actions">
                {o.status === "pending" && (
                  <div className="row">
                    <button
                      type="button"
                      className="small"
                      onClick={async () => {
                        try {
                          await api.acceptOrder(o._id);
                          loadOrders();
                          loadProducts();
                        } catch (err) {
                          alert(err.message);
                        }
                      }}
                    >
                      Accept cart
                    </button>
                    <button
                      type="button"
                      className="ghost small danger"
                      onClick={async () => {
                        try {
                          await api.rejectOrder(o._id);
                          loadOrders();
                        } catch (err) {
                          alert(err.message);
                        }
                      }}
                    >
                      Reject
                    </button>
                    <a
                      href={generateWhatsAppLink(o, seller.shopName, "request")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="whatsapp-btn-sm"
                    >
                      WhatsApp customer
                    </a>
                  </div>
                )}

                {o.status === "accepted" && (
                  <div className="row">
                    <button
                      type="button"
                      className="ghost small danger"
                      onClick={async () => {
                        try {
                          await api.rejectOrder(o._id);
                          loadOrders();
                          loadProducts();
                        } catch (err) {
                          alert(err.message);
                        }
                      }}
                    >
                      Cancel / reject
                    </button>
                    <a
                      href={generateWhatsAppLink(o, seller.shopName, "bill")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="whatsapp-btn-sm"
                    >
                      Remind for address
                    </a>
                  </div>
                )}

                {["confirmed", "shipped", "completed"].includes(o.status) && (
                  <div className="row space-between">
                    <select
                      value={o.status}
                      onChange={async (e) => {
                        await api.updateOrderStatus(o._id, e.target.value);
                        loadOrders();
                      }}
                    >
                      {["confirmed", "shipped", "completed", "cancelled"].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <a
                      href={generateWhatsAppLink(o, seller.shopName, "bill")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="whatsapp-btn-sm"
                    >
                      Send bill
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
          {orders.length === 0 && <p className="muted">No cart requests yet.</p>}
        </div>
      )}

    </div>
  );
}

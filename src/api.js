const BASE_URL = "/api";
const SERVER_URL = "";

export function generateWhatsAppLink(order, shopName = "Live Shop", purpose = "bill") {
  if (!order) return "#";

  const hasBargain = order.hasBargain || (order.items && order.items.some((i) => i.offerPrice != null));
  const orderIdSnippet = (order._id || "").slice(-6).toUpperCase();

  const itemsText = order.items
    ? order.items
        .map((i) => {
          const unitPrice = i.offerPrice != null ? i.offerPrice : i.price;
          const lineTotal = unitPrice * i.quantity;
          if (i.offerPrice != null) {
            return `• *${i.name}* x ${i.quantity} — *₹${lineTotal}* (offer vs listed ₹${i.price * i.quantity})`;
          }
          return `• *${i.name}* x ${i.quantity} — ₹${lineTotal}`;
        })
        .join("\n")
    : "";

  let message;

  if (purpose === "request") {
    message = `🛍️ *CART REQUEST — ${shopName}*${hasBargain ? "\n🤝 *Includes bargain offers*" : ""}
--------------------------------
*Request ID:* #${orderIdSnippet}
*Customer:* ${order.customerName || "Customer"}${order.customerPhone ? ` (${order.customerPhone})` : ""}

*Items:*
${itemsText}

--------------------------------
💰 *Proposed total:* ₹${order.total}${order.originalTotal && order.originalTotal > order.total ? ` (listed ₹${order.originalTotal})` : ""}
--------------------------------
${order.customerNote ? `*Note:* ${order.customerNote}\n--------------------------------\n` : ""}Please accept or reject this cart in your seller dashboard. Address will be shared after you accept.`;
  } else if (purpose === "address") {
    message = `📍 *DELIVERY ADDRESS — ${shopName}*
--------------------------------
*Order ID:* #${orderIdSnippet}
*Customer:* ${order.customerName || "Customer"}${order.customerPhone ? ` (${order.customerPhone})` : ""}

*Address:*
${order.customerAddress || ""}

--------------------------------
💰 *Total:* ₹${order.total}
--------------------------------
Thank you!`;
  } else {
    const bargainHeader = hasBargain ? `\n🤝 *BARGAIN INCLUDED*\n` : "";
    message = `🛍️ *INVOICE / BILL — ${shopName}*${bargainHeader}--------------------------------
*Order ID:* #${orderIdSnippet}
*Customer:* ${order.customerName || "Customer"}${order.customerPhone ? ` (${order.customerPhone})` : ""}
${order.customerAddress ? `*Address:* ${order.customerAddress}\n` : ""}
*Items:*
${itemsText}

--------------------------------
💰 *Total Amount:* ₹${order.total}${order.originalTotal && order.originalTotal > order.total ? ` *(Saved ₹${order.originalTotal - order.total})*` : ""}
--------------------------------
${order.customerNote ? `*Note:* ${order.customerNote}\n--------------------------------\n` : ""}Thank you for shopping with ${shopName}!`;
  }

  let cleanPhone = (order.customerPhone || "").replace(/\D/g, "");
  if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;

  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  }
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}

export function getImageUrl(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  return `${SERVER_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  register: (body) =>
    fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handle),

  login: (body) =>
    fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handle),

  uploadImage: (file) => {
    const formData = new FormData();
    formData.append("image", file);
    return fetch(`${BASE_URL}/upload`, {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    }).then(handle);
  },

  getProducts: () => fetch(`${BASE_URL}/products`, { headers: authHeaders() }).then(handle),

  createProduct: (body) =>
    fetch(`${BASE_URL}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    }).then(handle),

  updateProduct: (id, body) =>
    fetch(`${BASE_URL}/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    }).then(handle),

  deleteProduct: (id) =>
    fetch(`${BASE_URL}/products/${id}`, { method: "DELETE", headers: authHeaders() }).then(handle),

  getShop: (slug) => fetch(`${BASE_URL}/shop/${slug}`).then(handle),

  placeOrder: (slug, body) =>
    fetch(`${BASE_URL}/shop/${slug}/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handle),

  getCustomerOrder: (slug, orderId, phone) =>
    fetch(`${BASE_URL}/shop/${slug}/order/${orderId}?phone=${encodeURIComponent(phone)}`).then(handle),

  submitOrderAddress: (slug, orderId, body) =>
    fetch(`${BASE_URL}/shop/${slug}/order/${orderId}/address`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handle),

  getOrders: () => fetch(`${BASE_URL}/orders`, { headers: authHeaders() }).then(handle),

  acceptOrder: (id) =>
    fetch(`${BASE_URL}/orders/${id}/accept`, {
      method: "POST",
      headers: authHeaders(),
    }).then(handle),

  rejectOrder: (id) =>
    fetch(`${BASE_URL}/orders/${id}/reject`, {
      method: "POST",
      headers: authHeaders(),
    }).then(handle),

  updateOrderStatus: (id, status) =>
    fetch(`${BASE_URL}/orders/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status }),
    }).then(handle),
};

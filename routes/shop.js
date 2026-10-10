import express from "express";
import Seller from "../models/Seller.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";

const router = express.Router();

// PUBLIC: what a customer sees when they open the shared link
router.get("/:slug", async (req, res) => {
  const seller = await Seller.findOne({ shareSlug: req.params.slug });
  if (!seller || !seller.isLive) return res.status(404).json({ error: "Shop not found or not live" });

  const products = await Product.find({ seller: seller._id, stock: { $gt: 0 } }).sort({
    createdAt: -1,
  });

  res.json({
    shopName: seller.shopName,
    shopBanner: seller.shopBanner,
    sellerName: seller.name,
    products,
  });
});

function phoneMatches(a, b) {
  const clean = (v) => String(v || "").replace(/\D/g, "").slice(-10);
  return clean(a) && clean(a) === clean(b);
}

// PUBLIC: submit cart request (name/phone + optional bargain offers). No address yet.
// Stock is NOT decremented until the seller accepts (works without Mongo replica-set transactions).
router.post("/:slug/order", async (req, res) => {
  try {
    const seller = await Seller.findOne({ shareSlug: req.params.slug });
    if (!seller || !seller.isLive) return res.status(404).json({ error: "Shop not found or not live" });

    const { items, customerName, customerPhone, customerNote } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }
    if (!customerName?.trim() || !customerPhone?.trim()) {
      return res.status(400).json({ error: "Name and phone are required" });
    }

    let total = 0;
    let originalTotal = 0;
    let hasBargain = false;
    const orderItems = [];

    for (const cartItem of items) {
      const qty = Number(cartItem.quantity) || 0;
      if (qty < 1) throw new Error("Invalid quantity");

      const product = await Product.findOne({
        _id: cartItem.productId,
        seller: seller._id,
      });

      if (!product) throw new Error(`Product not found: ${cartItem.productId}`);
      if (product.stock < qty) {
        throw new Error(`Not enough stock for ${product.name}`);
      }

      const offerVal = Number(cartItem.offerPrice);
      const hasOffer = !isNaN(offerVal) && offerVal > 0 && offerVal !== product.price;

      // Bargain is a proposal only — must be below listed price
      if (hasOffer) {
        if (offerVal >= product.price) {
          throw new Error(`Offer for ${product.name} must be less than listed price ₹${product.price}`);
        }
        if (offerVal < 1) {
          throw new Error(`Offer for ${product.name} is too low`);
        }
        hasBargain = true;
      }

      const proposedUnit = hasOffer ? offerVal : product.price;

      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        offerPrice: hasOffer ? offerVal : null,
        quantity: qty,
      });
      originalTotal += product.price * qty;
      total += proposedUnit * qty;
    }

    const createdOrder = await Order.create({
      seller: seller._id,
      items: orderItems,
      total,
      originalTotal,
      hasBargain,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerNote: customerNote || "",
      customerAddress: "",
      status: "pending",
      stockReserved: false,
    });

    res.status(201).json({
      success: true,
      message: "Cart sent to seller for approval. Address is collected only after they accept.",
      total,
      originalTotal,
      hasBargain,
      order: createdOrder,
      shopName: seller.shopName,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUBLIC: customer checks order status (needs matching phone)
router.get("/:slug/order/:orderId", async (req, res) => {
  try {
    const seller = await Seller.findOne({ shareSlug: req.params.slug });
    if (!seller) return res.status(404).json({ error: "Shop not found" });

    const order = await Order.findOne({ _id: req.params.orderId, seller: seller._id });
    if (!order) return res.status(404).json({ error: "Order not found" });

    const phone = req.query.phone || "";
    if (!phoneMatches(phone, order.customerPhone)) {
      return res.status(403).json({ error: "Phone does not match this order" });
    }

    res.json({ order, shopName: seller.shopName });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUBLIC: customer submits delivery address AFTER seller accepts
router.post("/:slug/order/:orderId/address", async (req, res) => {
  try {
    const seller = await Seller.findOne({ shareSlug: req.params.slug });
    if (!seller) return res.status(404).json({ error: "Shop not found" });

    const order = await Order.findOne({ _id: req.params.orderId, seller: seller._id });
    if (!order) return res.status(404).json({ error: "Order not found" });

    const { phone, customerAddress } = req.body;
    if (!phoneMatches(phone, order.customerPhone)) {
      return res.status(403).json({ error: "Phone does not match this order" });
    }
    if (order.status !== "accepted") {
      return res.status(400).json({
        error:
          order.status === "pending"
            ? "Wait for the seller to accept your cart before sending the address"
            : `Cannot add address while order is ${order.status}`,
      });
    }
    if (!customerAddress?.trim()) {
      return res.status(400).json({ error: "Delivery address is required" });
    }

    order.customerAddress = customerAddress.trim();
    order.status = "confirmed";
    await order.save();

    res.json({ success: true, order, shopName: seller.shopName });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

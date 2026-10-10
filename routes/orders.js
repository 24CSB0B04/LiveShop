import express from "express";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import requireAuth from "../middleware/auth.js";

const router = express.Router();
router.use(requireAuth);

async function reserveStock(order) {
  if (order.stockReserved) return;

  for (const item of order.items) {
    const updated = await Product.findOneAndUpdate(
      {
        _id: item.product,
        seller: order.seller,
        stock: { $gte: item.quantity },
      },
      { $inc: { stock: -item.quantity } },
      { new: true }
    );
    if (!updated) {
      throw new Error(`Not enough stock for ${item.name}`);
    }
  }

  order.stockReserved = true;
}

async function releaseStock(order) {
  if (!order.stockReserved) return;

  for (const item of order.items) {
    await Product.findOneAndUpdate(
      { _id: item.product, seller: order.seller },
      { $inc: { stock: item.quantity } }
    );
  }

  order.stockReserved = false;
}

// Seller order history
router.get("/", async (req, res) => {
  const orders = await Order.find({ seller: req.sellerId }).sort({ createdAt: -1 });
  res.json(orders);
});

// Accept cart (+ bargain offers). Stock is reserved here. Customer can then send address.
router.post("/:id/accept", async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, seller: req.sellerId });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status !== "pending") {
      return res.status(400).json({ error: `Order is already ${order.status}` });
    }

    await reserveStock(order);

    // Accepting locks in offer prices as the billed amounts
    order.status = "accepted";
    await order.save();

    res.json({
      success: true,
      message: "Cart accepted. Ask the customer to send their delivery address.",
      order,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Reject cart / bargain — no stock change if never reserved
router.post("/:id/reject", async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, seller: req.sellerId });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (!["pending", "accepted"].includes(order.status)) {
      return res.status(400).json({ error: `Cannot reject order in status ${order.status}` });
    }

    if (order.status === "accepted") {
      await releaseStock(order);
    }

    order.status = "rejected";
    await order.save();
    res.json({ success: true, order });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["confirmed", "shipped", "completed", "cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: "Use Accept/Reject for pending carts, or set confirmed/shipped/completed/cancelled",
      });
    }

    const order = await Order.findOne({ _id: req.params.id, seller: req.sellerId });
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (status === "cancelled" && order.stockReserved) {
      await releaseStock(order);
    }

    order.status = status;
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

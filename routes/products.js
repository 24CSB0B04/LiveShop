import express from "express";
import Product from "../models/Product.js";
import requireAuth from "../middleware/auth.js";

const router = express.Router();
router.use(requireAuth); // everything here is seller-only

// List ALL of the seller's products (showcased + hidden) — this is the dashboard view
router.get("/", async (req, res) => {
  const products = await Product.find({ seller: req.sellerId }).sort({ createdAt: -1 });
  res.json(products);
});

router.post("/", async (req, res) => {
  try {
    const { name, description, price, image, stock, category, isShowcased } = req.body;
    if (!name || price === undefined) return res.status(400).json({ error: "name and price required" });

    const product = await Product.create({
      seller: req.sellerId,
      name,
      description,
      price,
      image,
      stock: stock ?? 0,
      category,
      // Newly uploaded products show in the customer shop unless seller opts out
      isShowcased: isShowcased === undefined ? true : !!isShowcased,
    });
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generic edit — also used for the "toggle showcase" action from the dashboard
router.put("/:id", async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, seller: req.sellerId }, // scoped to this seller — can't edit others' products
      req.body,
      { new: true }
    );
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  const result = await Product.findOneAndDelete({ _id: req.params.id, seller: req.sellerId });
  if (!result) return res.status(404).json({ error: "Product not found" });
  res.json({ success: true });
});

export default router;

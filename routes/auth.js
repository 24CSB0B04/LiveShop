import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import Seller from "../models/Seller.js";

const router = express.Router();

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, shopName } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email, password required" });
    }

    const existing = await Seller.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const baseSlug = slugify(shopName || name) || "shop";
    const shareSlug = `${baseSlug}-${nanoid(6)}`;

    const seller = await Seller.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      shopName: shopName || `${name}'s Shop`,
      shareSlug,
    });

    const token = jwt.sign({ sellerId: seller._id }, process.env.JWT_SECRET, { expiresIn: "30d" });
    res.status(201).json({
      token,
      seller: { id: seller._id, name: seller.name, shopName: seller.shopName, shareSlug: seller.shareSlug },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const seller = await Seller.findOne({ email: (email || "").toLowerCase() });
    if (!seller) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, seller.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ sellerId: seller._id }, process.env.JWT_SECRET, { expiresIn: "30d" });
    res.json({
      token,
      seller: { id: seller._id, name: seller.name, shopName: seller.shopName, shareSlug: seller.shareSlug },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

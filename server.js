import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import multer from "multer";
import { MongoMemoryServer } from "mongodb-memory-server";

import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import shopRoutes from "./routes/shop.js";
import orderRoutes from "./routes/orders.js";

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json());

// Setup local upload directory for images
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${uniqueSuffix}${ext}`);
  },
});
const upload = multer({ storage });

// Image Upload Endpoint
app.post("/api/upload", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image file provided" });
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);   // seller-only: manage products
app.use("/api/shop", shopRoutes);          // public: browse + self-checkout
app.use("/api/orders", orderRoutes);       // seller-only: order history

app.get("/api/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 5000;

async function startServer() {
  let mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/live-shop";

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
    console.log("MongoDB connected to local instance:", mongoUri);
  } catch (err) {
    console.log("Local MongoDB server not reachable. Starting in-memory MongoDB server...");
    try {
      const mongod = await MongoMemoryServer.create();
      mongoUri = mongod.getUri();
      await mongoose.connect(mongoUri);
      console.log("In-Memory MongoDB connected:", mongoUri);
    } catch (memErr) {
      console.error("Failed to start MongoDB:", memErr);
    }
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://0.0.0.0:${PORT}`));
}


startServer();



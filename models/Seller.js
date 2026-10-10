import mongoose from "mongoose";

// One Seller = one shop. shareSlug is what makes the shop link unique & guessable-but-not-obvious.
const sellerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    shopName: { type: String, default: "My Shop" },
    shopBanner: { type: String, default: "" }, // image URL, optional
    shareSlug: { type: String, required: true, unique: true }, // e.g. "utsav-shop-x7f2"
    isLive: { type: Boolean, default: true }, // seller can pause the whole shop
  },
  { timestamps: true }
);

export default mongoose.model("Seller", sellerSchema);

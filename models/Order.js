import mongoose from "mongoose";

// Items are SNAPSHOTTED (name/price copied at order time) so editing a product later
// doesn't rewrite history — this is important for an accurate order log.
const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: String,
    price: Number, // listed price snapshot
    offerPrice: { type: Number, default: null }, // customer bargain offer (pending until seller accepts)
    quantity: { type: Number, min: 1 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "Seller", required: true, index: true },
    items: [orderItemSchema],
    // Proposed total using offer prices (or listed if no offer). Finalized when seller accepts.
    total: { type: Number, required: true },
    originalTotal: { type: Number, default: 0 },
    hasBargain: { type: Boolean, default: false },
    customerName: { type: String, default: "Guest" },
    customerPhone: { type: String, default: "" },
    customerNote: { type: String, default: "" },
    // Address is only collected AFTER the seller accepts the cart / bargain.
    customerAddress: { type: String, default: "" },
    status: {
      type: String,
      enum: [
        "pending", // waiting for seller to accept/reject cart (+ bargains)
        "accepted", // seller accepted — customer must send address
        "confirmed", // address received
        "shipped",
        "completed",
        "rejected",
        "cancelled",
      ],
      default: "pending",
    },
    stockReserved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);

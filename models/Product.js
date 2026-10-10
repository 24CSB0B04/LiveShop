import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "Seller", required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, default: "" }, // image URL
    stock: { type: Number, default: 0, min: 0 },
    category: { type: String, default: "General" },
    isShowcased: { type: Boolean, default: true }, // listed in customer shop by default when uploaded
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);

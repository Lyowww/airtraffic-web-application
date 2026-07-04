import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ICustomText extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  content: string;
  createdAt: Date;
}

export interface ICustomImage extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  imageBufferOrBase64: string;
  correctExplanation: string;
  createdAt: Date;
}

const CustomTextSchema = new Schema<ICustomText>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "custom_texts" },
);

const CustomImageSchema = new Schema<ICustomImage>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    imageBufferOrBase64: { type: String, required: true },
    correctExplanation: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "custom_images" },
);

export const CustomText: Model<ICustomText> =
  mongoose.models.CustomText ??
  mongoose.model<ICustomText>("CustomText", CustomTextSchema);

export const CustomImage: Model<ICustomImage> =
  mongoose.models.CustomImage ??
  mongoose.model<ICustomImage>("CustomImage", CustomImageSchema);

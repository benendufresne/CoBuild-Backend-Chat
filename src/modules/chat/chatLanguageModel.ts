"use strict";

const mongoose = require("mongoose");
import { Document, model, Model, Schema } from "mongoose";
import { DB_MODEL_REF, STATUS } from "@config/constant";

export interface ChatsLanguage extends Document {
  userId: Schema.Types.ObjectId;
  status: String;
  languageCode: String;
}

const chatLanguageSchema: Schema = new mongoose.Schema(
  {
    _id: { type: Schema.Types.ObjectId, required: true, auto: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    status: {
      type: String,
      enum: [STATUS.BLOCKED, STATUS.UN_BLOCKED, STATUS.DELETED],
      default: STATUS.UN_BLOCKED
    },
    languageCode: { type: String, required: false },
    created: { type: Number, default: Date.now },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);
chatLanguageSchema.index({ userId: 1, languageCode: 1, status: 1 }, { unique: true });

export const chat_languages: Model<ChatsLanguage> = model<ChatsLanguage>(DB_MODEL_REF.CHAT_LANGUAGES, chatLanguageSchema);

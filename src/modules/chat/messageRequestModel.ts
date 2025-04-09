"use strict";
import { Document, model, Model, Schema } from "mongoose";
import { DB_MODEL_REF, STATUS } from "@config/constant";

export interface MessageRequest extends Document {
  type: string,
  senderId: Schema.Types.ObjectId;
  receiverId: Schema.Types.ObjectId;
  members: Array<string>;
  message: string;
  deletedBy: Array<string>;
  messageId: string;
  messageType: string;
  translatedMessages: Object;
  isRead: Array<string>;
  status: string;
  langCodes: Array<string>;
  created: number;
}

let messageRequestSchema = new Schema({
  _id: { type: Schema.Types.ObjectId, required: true, auto: true },
  senderId: { type: Schema.Types.ObjectId },
  receiverId: { type: Schema.Types.ObjectId },
  members: { type: [Schema.Types.ObjectId], default: [] },
  deletedBy: { type: [Schema.Types.ObjectId], default: [] },
  messageId: { type: Schema.Types.ObjectId },
  message: { type: String },
  translatedMessages: { type: Object },
  status: {
    type: String,
    enum: [
      STATUS.PENDING, STATUS.DELETED, STATUS.REJECTED, STATUS.ACCEPTED
    ],
    default: STATUS.PENDING
  },
  langCodes: { type: [String], default: [] },
  userLang: [{
    userId: { type: Schema.Types.ObjectId },
    languageCode: { type: String }
  }],
  created: { type: Number, default: Date.now },
}, {
  versionKey: false,
  timestamps: true
});

messageRequestSchema.index({ senderId: -1 });
messageRequestSchema.index({ receiverId: -1 });;

export const message_requests: Model<MessageRequest> = model<MessageRequest>(DB_MODEL_REF.MESSAGES_REQUESTS, messageRequestSchema);


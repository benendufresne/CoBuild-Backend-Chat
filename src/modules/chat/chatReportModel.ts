"use strict";

const mongoose = require("mongoose");
import { Document, model, Model, Schema } from "mongoose";

import { DB_MODEL_REF, STATUS, CHAT_TYPE,CHAT_REPORT_TYPE} from "@config/constant";

export interface CHAT_REPORT extends Document {
  type: string,
  reportedBy: Schema.Types.ObjectId;
  reportedUser: Schema.Types.ObjectId;
  chatId: Schema.Types.ObjectId,
  reason: string;
  messageId: Schema.Types.ObjectId;
  chatType: string;
  status: string;
  created: number;
}

var reportSchema = new Schema({
  _id: { type: Schema.Types.ObjectId, required: true, auto: true },
  type: {
    type: String,
    enum: [CHAT_REPORT_TYPE.MESSAGE,CHAT_REPORT_TYPE.USER, CHAT_REPORT_TYPE.GROUP],
  },
  reportedBy: { type: Schema.Types.ObjectId},
  reportedUser: {type: Schema.Types.ObjectId},
  reason: { type: String },
  messageId: { type: Schema.Types.ObjectId}, 
  chatId: { type: Schema.Types.ObjectId},
  chatType: {type: String,
    enum: [CHAT_TYPE.ONE_TO_ONE,CHAT_TYPE.GROUP,CHAT_TYPE.COMMUNITY]
  },
  status: {
    type: String,
    enum: [
      STATUS.ACTIVE,STATUS.DELETED,
      STATUS.ACTIVE
    ],
    default: STATUS.ACTIVE
  },  
  created: { type: Number,default: Date.now },
}, {
  versionKey: false,
  timestamps: true
});
reportSchema.index({ created: -1 });

export const chat_report: Model<CHAT_REPORT> = model<CHAT_REPORT>(DB_MODEL_REF.CHAT_REPORT, reportSchema);


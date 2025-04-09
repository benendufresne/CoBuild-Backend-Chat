"use strict";

const mongoose = require("mongoose");
import { Document, model, Model, Schema } from "mongoose";

import { DB_MODEL_REF } from "@config/constant";

export interface CallTranscript extends Document {
  chatId: Schema.Types.ObjectId,
  transcript: string;
  userId: string;
  sourceLanguageCode: string;
  created: number;
}

var callTranscriptSchema = new Schema({
  _id: { type: Schema.Types.ObjectId, required: true, auto: true },
  userId: { type: Schema.Types.ObjectId, required: true  },
  chatId: { type: Schema.Types.ObjectId, required: true }, 
  transcript: { type: String },
  sourceLanguageCode: { type: String },
  created: { type: Number, default: Date.now },
}, {
  versionKey: false,
  timestamps: true
});
callTranscriptSchema.index({ chatId: -1 });
callTranscriptSchema.index({ userId: -1 });
callTranscriptSchema.index({ created: -1 });

export const call_transcripts: Model<CallTranscript> = model<CallTranscript>(DB_MODEL_REF.CALL_TRANSCRIPTS, callTranscriptSchema);


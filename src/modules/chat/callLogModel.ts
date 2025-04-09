"use strict";

const mongoose = require("mongoose");
import { Document, model, Model, Schema } from "mongoose";

import {
  CALL_MODE_TYPE,
  CALL_STATUS,
  CALL_TYPE,
  DB_MODEL_REF,
} from "@config/constant";

export interface CallLog extends Document {
  chatId: Schema.Types.ObjectId;
  callerId: Schema.Types.ObjectId;
  receiverId: Schema.Types.ObjectId;
  callType: string;
  mode: string;
  status: string;
  created: number;
  startTime: Date;
  endTime: Date;
  meetingDetails: {
    meetingId: string;
    externalMeetingId: string;
    mediaRegion: string;
    mediaPlacement: {
      audioHostUrl: string;
      audioFallbackUrl: string;
      signalingUrl: string;
      turnControlUrl: string;
      screenDataUrl: string;
      screenViewingUrl: string;
      screenSharingUrl: string;
      eventIngestionUrl: string;
    };
    tenantIds: string[];
    meetingArn: string;
  }
}

var callLogSchema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, required: true, auto: true },
    chatId: { type: Schema.Types.ObjectId, required: true },
    callType: { type: String, enum: [CALL_TYPE.GROUP, CALL_TYPE.PERSONAL] },
    callerId: { type: Schema.Types.ObjectId, required: true },
    receiverId: { type: Schema.Types.ObjectId },
    mode: { type: String, enum: [CALL_MODE_TYPE.AUDIO, CALL_MODE_TYPE.VIDEO] },
    status: {
      type: String,
      enum: [CALL_STATUS.ONGOING, CALL_STATUS.MISSED, CALL_STATUS.END],
    },
    meetingDetails: {
      meetingId: { type: String },
      externalMeetingId: { type: String },
      mediaRegion: { type: String },
      mediaPlacement: {
        audioHostUrl: { type: String },
        audioFallbackUrl: { type: String },
        signalingUrl: { type: String },
        turnControlUrl: { type: String },
        screenDataUrl: { type: String },
        screenViewingUrl: { type: String },
        screenSharingUrl: { type: String },
        eventIngestionUrl: { type: String },
      },
      tenantIds: [{ type: String }],
      meetingArn: { type: String },
    },
    created: { type: Number },
    startTime: { type: Date },
    endTime: { type: Date },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);
callLogSchema.index({ chatId: -1 });
callLogSchema.index({ receiverId: -1 });
callLogSchema.index({ callerId: -1 });
callLogSchema.index({ created: -1 });

export const call_logs: Model<CallLog> = model<CallLog>(
  DB_MODEL_REF.CALL_LOGS,
  callLogSchema
);

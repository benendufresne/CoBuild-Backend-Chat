"use strict";

const mongoose = require("mongoose");
import { Document, model, Model, Schema } from "mongoose";

import { DB_MODEL_REF, STATUS, CHAT_TYPE, USER_TYPE, CHAT_MODE, JOB_PRIORITY, JOB_TYPE } from "@config/constant";

export interface UserLang {
  userId: Schema.Types.ObjectId;
  languageCode: string;
  userLang;
}

const geoSchema: Schema = new mongoose.Schema(
  {
    type: { type: String, default: "Point" },
    address: { type: String, required: false },
    coordinates: { type: [Number], index: "2dsphere", required: false },
  },
  {
    _id: false,
  }
);


export interface Chats extends Document {
  type: string;
  members: Array<string>;
  lastMsgId: Schema.Types.ObjectId;
  status: string;
  created: number;
  langCodes: Array<string>;
  userLang: UserLang;
  lastMsgCreated: number;
}

const chatSchema: Schema = new mongoose.Schema(
  {
    _id: { type: Schema.Types.ObjectId, required: true, auto: true },
    type: {
      type: String,
      enum: [CHAT_TYPE.ONE_TO_ONE],
      default: CHAT_TYPE.ONE_TO_ONE,
    },
    chatMode: { type: String, ENUM: [CHAT_MODE.REQUEST, CHAT_MODE.REPORT, CHAT_MODE.JOB], default: CHAT_MODE.REQUEST },
    name: { type: String },
    profilePicture: { type: String },
    members: { type: [Schema.Types.ObjectId], default: [] },
    lastMsgId: { type: Schema.Types.ObjectId },
    lastBlockedMsgId: { type: Schema.Types.ObjectId },
    lastMsgCreated: { type: Number },
    deletedBy: { type: [Schema.Types.ObjectId], default: [] },

    status: {
      type: String,
      enum: [STATUS.ACTIVE, STATUS.DELETED, STATUS.REJECTED, STATUS.ACCEPTED, STATUS.COMPLETED, JOB_TYPE.CANCELED],
      default: STATUS.ACTIVE,
    },

    lastMsgIdByUsers: {
      type: [
        {
          _id: false,
          userId: Schema.Types.ObjectId,
          lastMsgId: Schema.Types.ObjectId,
        },
      ],
      default: [],
    },
    created: { type: Number, default: Date.now },
    reportCount: { type: Number, default: 0 },
    reportedDate: { type: Number, required: false },
    request: {
      reqId: { type: Schema.Types.ObjectId },
      requestIdString: { type: String },
      serviceType: { type: String },
      categoryName: { type: String },
      categoryId: { type: Schema.Types.ObjectId },
      categoryIdString: { type: String },
      issueTypeName: { type: String },
      subIssueName: { type: String },
      media: { type: String },
      mediaType: { type: String },
    },
    report: {
      reportId: { type: Schema.Types.ObjectId },
      type: { type: String },
      description: { type: String },
      location: { type: geoSchema, required: false },
      status: { type: String },
      media: { type: Array<{ media: String, mediaType: String }>, required: false },
    },
    job: {
      jobId: { type: Schema.Types.ObjectId },
      title: { type: String, required: false },
      categoryName: { type: String, required: false },
      categoryId: { type: Schema.Types.ObjectId, required: false },
      serviceName: { type: String, required: false },
      serviceId: { type: Schema.Types.ObjectId, required: false },
      personalName: { type: String, required: false },
      location: { type: geoSchema, required: false },
      companyLocation: { type: geoSchema, required: false },
      email: { type: String, required: false },
      fullMobileNo: { type: String, required: false },
      aboutCompany: { type: String, required: false },
      priority: { type: String, required: false, enum: [JOB_PRIORITY.HIGH, JOB_PRIORITY.MEDIUM, JOB_PRIORITY.LOW] },
      procedure: { type: String, required: false },
      jobIdString: { type: String, required: false },
      status: { type: String, required: false, enum: [JOB_TYPE.COMPLETED, JOB_TYPE.IN_PROGRESS, JOB_TYPE.SCHEDULED, JOB_TYPE.DELETED, JOB_TYPE.CANCELED], default: JOB_TYPE.SCHEDULED },
      schedule: { type: Number, required: false },
      doorTag: { type: String, required: false },
      completedAt: { type: Number, required: false },
      created: { type: Number, required: false },
    },
    isChatDeletedByUser: { type: Boolean, default: false },
    isChatDeletedByAdmin: { type: Boolean, default: false },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);
chatSchema.index({ lastMsgId: -1, created: -1 });
chatSchema.index({ created: -1 });
chatSchema.index({ type: -1 });
chatSchema.index({ status: 1 });

export const chats: Model<Chats> = model<Chats>(DB_MODEL_REF.CHATS, chatSchema);

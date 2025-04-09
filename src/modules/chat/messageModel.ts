"use strict";

const mongoose = require("mongoose");
import { Document, model, Model, Schema } from "mongoose";

import { DB_MODEL_REF, STATUS, CHAT_TYPE, MESSAGE_TYPE, USER_TYPE, JOB_PRIORITY, JOB_TYPE, CHAT_MODE } from "@config/constant";
import { required } from "joi";

export interface UserLang {
  userId: Schema.Types.ObjectId;
  languageCode: string;
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


export interface Message extends Document {
  type: string,
  senderId: Schema.Types.ObjectId;
  members: Array<string>;
  chatId: Schema.Types.ObjectId,
  message: string;
  mediaUrl: string;
  messageType: string;
  translatedMessages: Object;
  isRead: Array<string>;
  status: string;
  langCodes: Array<string>;
  userLang: UserLang;
  created: number;
}

var messageSchema = new Schema({
  _id: { type: Schema.Types.ObjectId, required: true, auto: true },
  type: {
    type: String,
    enum: [CHAT_TYPE.ONE_TO_ONE],
    default: CHAT_TYPE.ONE_TO_ONE
  },
  chatMode: { type: String, ENUM: [CHAT_MODE.REQUEST, CHAT_MODE.REPORT, CHAT_MODE.JOB] },
  senderId: { type: Schema.Types.ObjectId },
  members: { type: [Schema.Types.ObjectId], default: [] },
  deletedBy: { type: [Schema.Types.ObjectId], default: [] },
  chatId: { type: Schema.Types.ObjectId, required: true },
  messageId: { type: Schema.Types.ObjectId }, //replied messageId
  // broadCastId: {type: Schema.Types.ObjectId},
  message: { type: String },
  // translatedMessages: { type: Object },
  mediaUrl: { type: String },
  thumbnailUrl: { type: String },
  contact: {
    name: { type: String },
    mobileNo: { type: String },
  },
  size: { type: String },
  location: {
    lat: { type: Number },
    long: { type: Number }
  },
  imageRatio: { type: Number },
  localUrl: { type: String },
  messageType: {
    type: String,
    enum: [
      MESSAGE_TYPE.TEXT,
      MESSAGE_TYPE.IMAGE,
      MESSAGE_TYPE.QUOTATION,
      MESSAGE_TYPE.REPLIED
      // MESSAGE_TYPE.DOCS,
      // MESSAGE_TYPE.VIDEO,
      // MESSAGE_TYPE.VOICE,
      // MESSAGE_TYPE.LINK,
      // MESSAGE_TYPE.LOCATION,
      // MESSAGE_TYPE.HEADING,
      // MESSAGE_TYPE.STICKER,
      // MESSAGE_TYPE.CONTACT,
    ]
  },
  notes: { type: String, required: false },
  estimatedDays: { type: String, required: false },
  amount: { type: Number, required: false },
  isRead: {
    type: [Schema.Types.ObjectId], default: []
  },
  isDelivered: {
    type: [Schema.Types.ObjectId], default: []
  },
  status: {
    type: String,
    enum: [
      STATUS.ACTIVE, STATUS.DELETED, STATUS.REJECTED,
      STATUS.ACCEPTED, STATUS.BIDAGAIN
    ],
    default: STATUS.ACTIVE
  },
  // reaction: {
  //   type: [{
  //     userId: Schema.Types.ObjectId,
  //     reaction: String
  //   }],
  //   default: []
  // },
  // taggedUser: { type: [Schema.Types.ObjectId], default: [] },
  // blockedMessage: {type: Boolean, default: false},
  // langCodes: { type: [String], default: [] },
  // userLang: [{
  //   userId: { type: Schema.Types.ObjectId },
  //   languageCode: { type: String }
  // }],
  // transcribe: { type: String },
  created: { type: Number, default: Date.now },
  // isInteracted: {type: Boolean, default: true},
  userType: { type: String, enum: [USER_TYPE.USER, USER_TYPE.ADMIN, USER_TYPE.SUB_ADMIN] },
  name: { type: String },
  profilePicture: { type: String },
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
}, {
  versionKey: false,
  timestamps: true
});
messageSchema.index({ members: 1 });
// messageSchema.index({ deletedBy: 1 });
messageSchema.index({ isDelivered: 1 });
messageSchema.index({ created: -1 });
messageSchema.index({ chatId: 1 });
messageSchema.index({ type: -1 });
messageSchema.index({ status: 1 });
// messageSchema.index({ members: 1, deletedBy: 1, isDelivered: 1 });

export const messages: Model<Message> = model<Message>(DB_MODEL_REF.MESSAGES, messageSchema);


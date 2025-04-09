"use strict";

import mongoose, { Document, model, Model, Schema } from "mongoose";

import {
  DB_MODEL_REF,
  GENDER,
  STATUS,
  USER_PREFERENCE,
  USER_TYPE,
} from "@config/index";

export interface Category {
  _id: Schema.Types.ObjectId;
  name: string;
}

export interface IUser extends Document {
  _id: string;
  name?: string;
  email: string;
  salt: string;
  hash: string;
  gender?: string;
  profilePicture?: string;
  language?: string;
  countryCode?: string;
  mobileNo?: string;
  fullMobileNo?: string;
  isMobileVerified: boolean;
  location?: GeoLocation;
  status: string;
  created: number;  
  refreshToken: string;
}

const geoSchema: Schema = new mongoose.Schema(
  {
    type: { type: String, default: "Point" },
    address: { type: String, required: false },
    coordinates: { type: [Number], index: "2dsphere", required: false }, // [longitude, latitude]
  },
  {
    _id: false,
  }
);

const userSchema: Schema = new mongoose.Schema(
  {
    _id: { type: Schema.Types.ObjectId, required: true, auto: true },
    name: { type: String, trim: true, required: false },
    email: { type: String, trim: true, required: false },
    countryCode: { type: String, required: true },
    mobileNo: { type: String, required: true },
    fullMobileNo: { type: String, required: false },
    isMobileVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    isProfileCompleted: { type: Boolean, default: false },
    firstName: { type: String, trim: true, required: false },
    lastName: { type: String, trim: true, required: false },
    salt: { type: String, required: false },
    hash: { type: String, required: false },
    location: { type: geoSchema, required: false },
    profilePicture: { type: String, required: false },
    flagCode: { type: String, required: false },
    userType: {
      type: String,
      default: USER_TYPE.USER,
      enum: Object.values(USER_TYPE),
    },
    status: {
      type: String,
      enum: [STATUS.BLOCKED, STATUS.UN_BLOCKED, STATUS.DELETED],
      default: STATUS.UN_BLOCKED,
    },
    created: { type: Number, default: Date.now },
    lastSeen: { type: String, default: Date.now },  
    deleteTime: { type: Number, required: false } 
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

userSchema.post("save", async function (doc) {
  setTimeout(() => {}, 10);
});

userSchema.post("findOneAndUpdate", function (doc) {
  setTimeout(() => {}, 10);
});

userSchema.index({ created: -1 });
userSchema.index({ assistantId: 1 });
userSchema.index({ status: 1 });
userSchema.index({ name: 1 });
userSchema.index({ mobileNo: 1 });
userSchema.index({ email: 1 });

// Export user
export const users: Model<IUser> = model<IUser>(DB_MODEL_REF.USER, userSchema);

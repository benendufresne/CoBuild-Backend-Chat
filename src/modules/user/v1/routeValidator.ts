import {
  REGEX,
  VALIDATION_CRITERIA,
  VALIDATION_MESSAGE,
  GENDER,
  STATUS,
  USER_PREFERENCE,
  OTP_TYPE,
} from "@config/constant";
import { SERVER } from "@config/environment";
import Joi = require("joi");

export const signup = Joi.object({
  email: Joi.string()
    .trim()
    .lowercase()
    .email({ minDomainSegments: 2 })
    // .email({ minDomainSegments: 2, tlds: { allow: ["com", "net"] } })
    .regex(REGEX.EMAIL)
    .required(),
  password: Joi.string()
    .trim()
    .regex(REGEX.PASSWORD)
    .min(VALIDATION_CRITERIA.PASSWORD_MIN_LENGTH)
    .max(VALIDATION_CRITERIA.PASSWORD_MAX_LENGTH)
    .default(SERVER.DEFAULT_PASSWORD)
    .required()
    .messages({
      "string.pattern.base": VALIDATION_MESSAGE.password.pattern,
      "string.min": VALIDATION_MESSAGE.password.minlength,
      "string.max": VALIDATION_MESSAGE.password.maxlength,
      "string.empty": VALIDATION_MESSAGE.password.required,
      "any.required": VALIDATION_MESSAGE.password.required,
    }),
  flagCode: Joi.string().optional(),  
  countryCode: Joi.string().required(),
  mobileNo: Joi.string()
    .trim()
    .regex(REGEX.MOBILE_NUMBER)
    .required()
    .messages({ "string.pattern.base": VALIDATION_MESSAGE.mobileNo.pattern }),
})

export const login = Joi.object({
  email: Joi.string()
    .trim()
    .lowercase()
    .email({ minDomainSegments: 2 })
    // .email({ minDomainSegments: 2, tlds: { allow: ["com", "net"] } })
    .regex(REGEX.EMAIL)
    .required(),
  password: Joi.string()
    .trim()
    .regex(REGEX.PASSWORD)
    .min(VALIDATION_CRITERIA.PASSWORD_MIN_LENGTH)
    .max(VALIDATION_CRITERIA.PASSWORD_MAX_LENGTH)
    .default(SERVER.DEFAULT_PASSWORD)
    .required()
    .messages({
      "string.pattern.base": VALIDATION_MESSAGE.password.pattern,
      "string.min": VALIDATION_MESSAGE.password.minlength,
      "string.max": VALIDATION_MESSAGE.password.maxlength,
      "string.empty": VALIDATION_MESSAGE.password.required,
      "any.required": VALIDATION_MESSAGE.password.required,
    }),
  deviceId: Joi.string().trim().required(),
  deviceToken: Joi.string().optional(),
});

export const forgotPassword = Joi.object({
  email: Joi.string()
    .trim()
    .lowercase()
    // .email({ minDomainSegments: 2 })
    .regex(REGEX.EMAIL)
    .required()
    .messages({
      "string.pattern.base": VALIDATION_MESSAGE.email.pattern,
    }),
});

export const resetPassword = Joi.object({
  email: Joi.string().required(),
  password: Joi.string()
    .trim()
    .regex(REGEX.PASSWORD)
    .min(VALIDATION_CRITERIA.PASSWORD_MIN_LENGTH)
    .max(VALIDATION_CRITERIA.PASSWORD_MAX_LENGTH)
    .default(SERVER.DEFAULT_PASSWORD)
    .required()
    .messages({
      "string.pattern.base": VALIDATION_MESSAGE.password.pattern,
      "string.min": VALIDATION_MESSAGE.password.minlength,
      "string.max": VALIDATION_MESSAGE.password.maxlength,
      "string.empty": VALIDATION_MESSAGE.password.required,
      "any.required": VALIDATION_MESSAGE.password.required,
    }),
    confirmPassword: Joi.string()
    .trim()
    .regex(REGEX.PASSWORD)
    .min(VALIDATION_CRITERIA.PASSWORD_MIN_LENGTH)
    .max(VALIDATION_CRITERIA.PASSWORD_MAX_LENGTH)
    .default(SERVER.DEFAULT_PASSWORD)
    .required()
    .messages({
      "string.pattern.base": VALIDATION_MESSAGE.password.pattern,
      "string.min": VALIDATION_MESSAGE.password.minlength,
      "string.max": VALIDATION_MESSAGE.password.maxlength,
      "string.empty": VALIDATION_MESSAGE.password.required,
      "any.required": VALIDATION_MESSAGE.password.required,
    }), 
});

export const changePassword = Joi.object({
  oldPassword: Joi.string()
    .trim()
    .min(VALIDATION_CRITERIA.PASSWORD_MIN_LENGTH)
    .max(VALIDATION_CRITERIA.PASSWORD_MAX_LENGTH)
    .default(SERVER.DEFAULT_PASSWORD)
    .required(),
  password: Joi.string()
    .trim()
    .regex(REGEX.PASSWORD)
    .min(VALIDATION_CRITERIA.PASSWORD_MIN_LENGTH)
    .max(VALIDATION_CRITERIA.PASSWORD_MAX_LENGTH)
    .default(SERVER.DEFAULT_PASSWORD)
    .required()
    .messages({
      "string.pattern.base": VALIDATION_MESSAGE.password.pattern,
      "string.min": VALIDATION_MESSAGE.password.minlength,
      "string.max": VALIDATION_MESSAGE.password.maxlength,
      "string.empty": VALIDATION_MESSAGE.password.required,
      "any.required": VALIDATION_MESSAGE.password.required,
    }),
  confirmPassword: Joi.string()
  .trim()
  .regex(REGEX.PASSWORD)
  .min(VALIDATION_CRITERIA.PASSWORD_MIN_LENGTH)
  .max(VALIDATION_CRITERIA.PASSWORD_MAX_LENGTH)
  .default(SERVER.DEFAULT_PASSWORD)
  .required()
  .messages({
    "string.pattern.base": VALIDATION_MESSAGE.password.pattern,
    "string.min": VALIDATION_MESSAGE.password.minlength,
    "string.max": VALIDATION_MESSAGE.password.maxlength,
    "string.empty": VALIDATION_MESSAGE.password.required,
    "any.required": VALIDATION_MESSAGE.password.required,
  }), 
});

export const editProfile = Joi.object({
  profilePicture: Joi.string().trim().optional().allow(""),
  firstName: Joi.string().trim().optional(),
  lastName: Joi.string().trim().optional(),
  flagCode: Joi.string().optional(),
  countryCode: Joi.string().optional(),
  mobileNo: Joi.string()
    .trim()
    .regex(REGEX.MOBILE_NUMBER)
    .optional()
    .messages({ "string.pattern.base": VALIDATION_MESSAGE.mobileNo.pattern }),
  location: Joi.object({
    coordinates: Joi.array().items(Joi.number()).optional(),
    address: Joi.string().optional(),
  }).optional().description("location: {coordinates: [26.5,25.4], address: 'house 1 inner road'}"),  
});

export const preSignedURL = Joi.object({
  filename: Joi.string().trim().required().description("FileName"),
  fileType: Joi.string().trim().required().description("File Type of filename"),
});

export const verifyMobileOtp = Joi.object({
  // countryCode: Joi.string().required(),
  otp: Joi.string().default(SERVER.DEFAULT_OTP).required(),
  flagCode: Joi.string().optional(),
  countryCode: Joi.string().required(),
  deviceId: Joi.string().trim().optional(),
  deviceToken: Joi.string().trim().optional(),
  mobileNo: Joi.string()
    .trim()
    .regex(REGEX.MOBILE_NUMBER)
    .required()
    .messages({ "string.pattern.base": VALIDATION_MESSAGE.mobileNo.pattern }),
});

export const sendOtpOnMobile = Joi.object({
  flagCode: Joi.string().optional(),
  countryCode: Joi.string().required(),
  mobileNo: Joi.string()
    .trim()
    .regex(REGEX.MOBILE_NUMBER)
    .required()
    .messages({ "string.pattern.base": VALIDATION_MESSAGE.mobileNo.pattern }),
});

export const sendOtpOnEmail = Joi.object({
  type: Joi.string().required().valid(OTP_TYPE.SIGNUP,OTP_TYPE.FORGOT_PASSWORD),
  email: Joi.string()
    .trim()
    .lowercase()
    // .email({ minDomainSegments: 2 })
    .regex(REGEX.EMAIL)
    .required()
    .messages({
      "string.pattern.base": VALIDATION_MESSAGE.email.pattern,
    }),
});

export const verifyEmailOtp = Joi.object({
  type: Joi.string().required().valid(OTP_TYPE.SIGNUP,OTP_TYPE.FORGOT_PASSWORD),
  otp: Joi.string().default(SERVER.DEFAULT_OTP).required(),
  email: Joi.string()
    .trim()
    .lowercase()
    // .email({ minDomainSegments: 2 })
    .regex(REGEX.EMAIL)
    .required()
    .messages({
      "string.pattern.base": VALIDATION_MESSAGE.email.pattern,
    }),
  deviceId: Joi.string().trim().required(),
  deviceToken: Joi.string().optional(),
});

export const userListing = Joi.object({
  pageNo: Joi.number().min(1).required(),
  limit: Joi.number().min(1).required(),
  searchKey: Joi.string()
    .allow("")
    .optional()
    .description("Search by name, email"),
  sortBy: Joi.string()
    .trim()
    .valid("created")
    .optional()
    .description("Sort by created"),
  sortOrder: Joi.number()
    .valid(1, -1)
    .optional()
    .description("1 for asc, -1 for desc"),
  assistantId: Joi.string().trim().regex(REGEX.MONGO_ID).optional(),
  isSharedTask: Joi.boolean().optional(),
  userId: Joi.string().trim().regex(REGEX.MONGO_ID).optional()
});

export const userDetail = Joi.object({
  userId: Joi.string().trim().regex(REGEX.MONGO_ID).optional(),
});


export const blockDeleteUser = Joi.object({
  type: Joi.string()
    .valid(STATUS.BLOCKED, STATUS.UN_BLOCKED, STATUS.DELETED)
    .required(),
  userId: Joi.string().trim().regex(REGEX.MONGO_ID).optional(),
})

export const notificationList = Joi.object({
  pageNo: Joi.number().required().description("Page no"),
  limit: Joi.number().required().description("limit"),
  searchKey: Joi.string().allow("").optional().description("Search by title"),
  sortBy: Joi.string().trim().valid("created").optional().description("Sort by created"),
  sortOrder: Joi.number().valid(1, -1).optional().description("1 for asc, -1 for desc"),
  fromDate: Joi.number().optional().description("in timestamp"),
  toDate: Joi.number().optional().description("in timestamp")
})

export const deleteAccount = Joi.object({
  password: Joi.string()
    .trim()
    .regex(REGEX.PASSWORD)
    .min(VALIDATION_CRITERIA.PASSWORD_MIN_LENGTH)
    .max(VALIDATION_CRITERIA.PASSWORD_MAX_LENGTH)
    .default(SERVER.DEFAULT_PASSWORD)
    .required()
    })
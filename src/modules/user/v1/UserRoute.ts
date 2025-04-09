"use strict";

import { Request, ResponseToolkit } from "@hapi/hapi";

import { failActionFunction } from "@utils/appUtils";
import { authorizationHeaderObj, headerObject } from "@utils/validator";
import { SWAGGER_DEFAULT_RESPONSE_MESSAGES, SERVER } from "@config/index";
import { responseHandler } from "@utils/ResponseHandler";
import {
  blockDeleteUser,
  changePassword,
  deleteAccount,
  editProfile,
  login,
  notificationList,
  preSignedURL,
  resetPassword,
  sendOtpOnEmail,
  signup,
  userDetail,
  userListing,
  verifyEmailOtp
} from "./routeValidator";
import { userControllerV1 } from "..";

export const userRoute = [
  {
    method: "POST",
    path: `${SERVER.API_BASE_URL}/v1/user/signup`,
    handler: async (request: Request | any, h: ResponseToolkit) => {
      try {
        const payload: UserRequest.SignUp = request.payload;
        const result = await userControllerV1.signUp(payload);
        return responseHandler.sendSuccess(h, result);
      } catch (error) {
        return responseHandler.sendError(request, error);
      }
    },
    options: {
      tags: ["api", "user"],
      description: "User SignUp ",
      auth: {
        strategies: ["BasicAuth"],
      },
      validate: {
        headers: headerObject["required"],
        payload: signup,
        failAction: failActionFunction,
      },
      plugins: {
        "hapi-swagger": {
          responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES,
        },
      },
    },
  },
  {
    method: "POST",
    path: `${SERVER.API_BASE_URL}/v1/user/login`,
    handler: async (request: Request | any, h: ResponseToolkit) => {
      try {
        const headers = request.headers;
        const payload: UserRequest.Login = request.payload;
        payload.remoteAddress =
          request["headers"]["x-forwarded-for"] || request.info.remoteAddress;
        const result = await userControllerV1.login({
          ...headers,
          ...payload,
        });
        return responseHandler.sendSuccess(h, result);
      } catch (error) {
        return responseHandler.sendError(request, error);
      }
    },
    config: {
      tags: ["api", "user"],
      description: "User login-signUp",
        auth: {
          strategies: ["BasicAuth"],
        },
      validate: {
        headers: headerObject["required"],
        payload: login,
        failAction: failActionFunction,
      },
      plugins: {
        "hapi-swagger": {
          responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES,
        },
      },
    },
  },
  // {
  //   method: "POST",
  //   path: `${SERVER.API_BASE_URL}/v1/user/resend-otp`,
  //   handler: async (request: Request | any, h: ResponseToolkit) => {
  //     try {
  //       const payload: UserRequest.SendOtp = request.payload;
  //       const result = await userControllerV1.sendOtpOnMobile(payload);
  //       return responseHandler.sendSuccess(h, result);
  //     } catch (error) {
  //       return responseHandler.sendError(request, error);
  //     }
  //   },
  //   options: {
  //     tags: ["api", "user"],
  //     description: "Resend Otp On mobile no",
  //       auth: {
  //         strategies: ["BasicAuth"],
  //       },
  //     validate: {
  //       headers: headerObject["required"],
  //       payload: sendOtpOnMobile,
  //       failAction: failActionFunction,
  //     },
  //     plugins: {
  //       "hapi-swagger": {
  //         responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES,
  //       },
  //     },
  //   },
  // },
  {
    method: "POST",
    path: `${SERVER.API_BASE_URL}/v1/user/send-otp`,
    handler: async (request: Request | any, h: ResponseToolkit) => {
      try {
        const payload: UserRequest.SendOtp = request.payload;
        const tokenData: TokenData =
          request.auth &&
          request.auth.credentials &&
          request.auth.credentials.tokenData;
        const result = await userControllerV1.sendOtpOnEmail(
          payload
        );
        return responseHandler.sendSuccess(h, result);
      } catch (error) {
        return responseHandler.sendError(request, error);
      }
    },
    options: {
      tags: ["api", "user"],
      description: "Resend Otp On email",
      auth: {
      	strategies: ["BasicAuth"]
      },
      validate: {
        headers: headerObject["required"],
        payload: sendOtpOnEmail,
        failAction: failActionFunction,
      },
      plugins: {
        "hapi-swagger": {
          responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES,
        },
      },
    },
  },
  {
    method: "POST",
    path: `${SERVER.API_BASE_URL}/v1/user/reset-password`,
    handler: async (request: Request | any, h: ResponseToolkit) => {
      try {
        const payload: UserRequest.ResetPassword = request.payload;        
        const result = await userControllerV1.resetPassword(
          payload
        );
        return responseHandler.sendSuccess(h, result);
      } catch (error) {
        return responseHandler.sendError(request, error);
      }
    },
    options: {
      tags: ["api", "user"],
      description: "Reset Password",
      auth: {
      	strategies: ["BasicAuth"]
      },
      validate: {
        headers: headerObject["required"],
        payload: resetPassword,
        failAction: failActionFunction,
      },
      plugins: {
        "hapi-swagger": {
          responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES,
        },
      },
    },
  },
  {
    method: "PUT",
    path: `${SERVER.API_BASE_URL}/v1/user/profile`,
    handler: async (request: Request | any, h: ResponseToolkit) => {
      try {
        const tokenData: TokenData =
          request.auth &&
          request.auth.credentials &&
          request.auth.credentials.tokenData;
        const payload: UserRequest.EditProfile = request.payload;
        const result = await userControllerV1.editProfile(payload, tokenData);
        return responseHandler.sendSuccess(h, result);
      } catch (error) {
        return responseHandler.sendError(request, error);
      }
    },
    config: {
      tags: ["api", "user"],
      description: "Edit user profile",
      auth: {
        strategies: ["UserAuth"],
      },
      validate: {
        headers: authorizationHeaderObj,
        payload: editProfile,
        failAction: failActionFunction,
      },
      plugins: {
        "hapi-swagger": {
          responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES,
        },
      },
    },
  },
  {
    method: "POST",
    path: `${SERVER.API_BASE_URL}/v1/user/change-password`,
    handler: async (request: Request | any, h: ResponseToolkit) => {
      try {
        const tokenData: TokenData =
          request.auth &&
          request.auth.credentials &&
          request.auth.credentials.tokenData;
        const payload: UserRequest.ChangePassword = request.payload;
        const result = await userControllerV1.changePassword(payload, tokenData);
        return responseHandler.sendSuccess(h, result);
      } catch (error) {
        return responseHandler.sendError(request, error);
      }
    },
    config: {
      tags: ["api", "user"],
      description: "change user password",
      auth: {
        strategies: ["UserAuth"],
      },
      validate: {
        headers: authorizationHeaderObj,
        payload: changePassword,
        failAction: failActionFunction,
      },
      plugins: {
        "hapi-swagger": {
          responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES,
        },
      },
    },
  },
  {
    method: "POST",
    path: `${SERVER.API_BASE_URL}/v1/user/logout`,
    handler: async (request: Request | any, h: ResponseToolkit) => {
      try {
        const tokenData: TokenData =
          request.auth &&
          request.auth.credentials &&
          request.auth.credentials.tokenData;
        const result = await userControllerV1.logout(tokenData);
        return responseHandler.sendSuccess(h, result);
      } catch (error) {
        return responseHandler.sendError(request, error);
      }
    },
    config: {
      tags: ["api", "user"],
      description: "Logout",
      auth: {
        strategies: ["UserAuth"],
      },
      validate: {
        headers: authorizationHeaderObj,
        failAction: failActionFunction,
      },
      plugins: {
        "hapi-swagger": {
          responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES,
        },
      },
    },
  },
  {
    method: "POST",
    path: `${SERVER.API_BASE_URL}/v1/user/delete`,
    handler: async (request: any, h: ResponseToolkit) => {
      try {
        const tokenData: TokenData =
        request.auth &&
        request.auth.credentials &&
        request.auth.credentials.tokenData;
        const payload: UserRequest.DeleteAccount = request.payload;
        const result = await userControllerV1.deleteAccount(payload,tokenData);
        return responseHandler.sendSuccess(h, result);
      } catch (error) {
        return responseHandler.sendError(request, error);
      }
    },
    config: {
      tags: ["api", "patient"],
      description: "delete user's account",
      auth: {
        strategies: ["UserAuth"],
      },
      validate: {
        headers: authorizationHeaderObj,
        payload: deleteAccount,
        failAction: failActionFunction,
      },
      plugins: {
        "hapi-swagger": {
          responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES,
        },
      },
    },
  },
  // {
  //   method: "POST",
  //   path: `${SERVER.API_BASE_URL}/v1/user/verify-otp`,
  //   handler: async (request: Request | any, h: ResponseToolkit) => {
  //     try {
  //       const headers = request.headers;
  //       const payload: UserRequest.VerifyOTP = request.payload;
  //       payload.remoteAddress =
  //         request["headers"]["x-forwarded-for"] || request.info.remoteAddress;
  //       const result = await userControllerV1.verifyMobileOTP({
  //         ...headers,
  //         ...payload,
  //       });
  //       return responseHandler.sendSuccess(h, result);
  //     } catch (error) {
  //       return responseHandler.sendError(request, error);
  //     }
  //   },
  //   config: {
  //     tags: ["api", "user"],
  //     description: "Verify OTP on mobile no",
  //       auth: {
  //         strategies: ["BasicAuth"],
  //       },
  //     validate: {
  //       headers: headerObject["required"],
  //       payload: verifyMobileOtp,
  //       failAction: failActionFunction,
  //     },
  //     plugins: {
  //       "hapi-swagger": {
  //         responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES,
  //       },
  //     },
  //   },
  // },
  {
    method: "POST",
    path: `${SERVER.API_BASE_URL}/v1/user/verify-otp`,
    handler: async (request: Request | any, h: ResponseToolkit) => {
      try {
        const headers = request.headers;
        const payload: UserRequest.VerifyOTP = request.payload;  
        payload.remoteAddress =
          request["headers"]["x-forwarded-for"] || request.info.remoteAddress;     
        const result = await userControllerV1.verifyEmailOTP({
          ...payload,
          ...headers
        }
        );
        return responseHandler.sendSuccess(h, result);
      } catch (error) {
        return responseHandler.sendError(request, error);
      }
    },
    config: {
      tags: ["api", "user"],
      description: "Verify OTP on Email",
      auth: {
        strategies: ["BasicAuth"],
      },
      validate: {
        headers: headerObject["required"],
        payload: verifyEmailOtp,
        failAction: failActionFunction,
      },
      plugins: {
        "hapi-swagger": {
          responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES,
        },
      },
    },
  },
  {
    method: "GET",
    path: `${SERVER.API_BASE_URL}/v1/user/profile`,
    handler: async (request: Request | any, h: ResponseToolkit) => {
      try {
        const tokenData: TokenData =
          request.auth &&
          request.auth.credentials &&
          request.auth.credentials.tokenData;
        const query: UserId = request.query;
        const result = await userControllerV1.profile(query, tokenData);
        return responseHandler.sendSuccess(h, result);
      } catch (error) {
        return responseHandler.sendError(request, error);
      }
    },
    config: {
      tags: ["api", "user"],
      description: "User Details",
      auth: {
        strategies: ["CommonAuth"],
      },
      validate: {
        headers: authorizationHeaderObj,
        query: userDetail,
        failAction: failActionFunction,
      },
      plugins: {
        "hapi-swagger": {
          responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES,
        },
      },
    },
  },
  {
    method: "GET",
    path: `${SERVER.API_BASE_URL}/v1/user/preSignedUrl`,
    handler: async (request: Request | any, h: ResponseToolkit) => {
      try {
        const tokenData: TokenData =
          request.auth &&
          request.auth.credentials &&
          request.auth.credentials.tokenData;
        const query: UserRequest.PreSignedUrl = request.query;
        const result = await userControllerV1.preSignedURL(query, tokenData);
        return responseHandler.sendSuccess(h, result);
      } catch (error) {
        return responseHandler.sendError(request, error);
      }
    },
    config: {
      tags: ["api", "user"],
      description: "presigned URL",
      auth: {
        strategies: ["UserAuth"],
      },
      validate: {
        headers: authorizationHeaderObj,
        query: preSignedURL,
        failAction: failActionFunction,
      },
      plugins: {
        "hapi-swagger": {
          responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES,
        },
      },
    },
  },
  {
    method: "GET",
    path: `${SERVER.API_BASE_URL}/v1/user/listing`,
    handler: async (request, h) => {
      try {
        let query: ListingRequest = request.query;
        const tokenData: TokenData = request.auth && request.auth.credentials && request.auth.credentials.tokenData;
        let result = await userControllerV1.userListing(query, tokenData);
        return responseHandler.sendSuccess(h, result);
      } catch (error) {
        return responseHandler.sendError(request, error);
      }
    },
    config: {
      tags: ["api", "user"],
      description: "user Listing",
      auth: {
        strategies: ["CommonAuth"],
      },
      validate: {
        headers: authorizationHeaderObj,
        query: userListing,
        failAction: failActionFunction,
      },
      plugins: {
        "hapi-swagger": {
          responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES,
        },
      },
    },
  },
  // {
  //   method: "GET",
  //   path: `${SERVER.API_BASE_URL}/v1/user/list`,
  //   handler: async (request, h) => {
  //     try {
  //       const tokenData: TokenData = request.auth && request.auth.credentials && request.auth.credentials.tokenData;
  //       let query: ListingRequest = request.query;
  //       let result = await userControllerV1.assistantUserListing(query, tokenData);
  //       return responseHandler.sendSuccess(h, result);
  //     } catch (error) {
  //       return responseHandler.sendError(request, error);
  //     }
  //   },
  //   config: {
  //     tags: ["api", "internal"],
  //     description: "user Listing assigned to an assistant",
  //     auth: {
  //       strategies: ["AdminAuth"],
  //     },
  //     validate: {
  //       headers: authorizationHeaderObj,
  //       query: userListing,
  //       failAction: failActionFunction,
  //     },
  //     plugins: {
  //       "hapi-swagger": {
  //         responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES,
  //       },
  //     },
  //   },
  // },

  {
    method: "POST",
    path: `${SERVER.API_BASE_URL}/v1/user/block-delete`,
    handler: async (request: Request | any, h: ResponseToolkit) => {
      try {
        const tokenData: TokenData =
          request.auth &&
          request.auth.credentials &&
          request.auth.credentials.tokenData;
        const payload: UserRequest.blockDeleteUser = request.payload;
        const result = await userControllerV1.blockOrDeleteUser(
          payload,
          tokenData
        );
        return responseHandler.sendSuccess(h, result);
      } catch (error) {
        return responseHandler.sendError(request, error);
      }
    },
    options: {
      tags: ["api", "user"],
      description: "User Block/Unblock or Delete By Admin",
      auth: {
        strategies: ["AdminAuth"],
      },
      validate: {
        headers: authorizationHeaderObj,
        payload:blockDeleteUser,
        failAction: failActionFunction,
      },
      plugins: {
        "hapi-swagger": {
          responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES,
        },
      },
    },
  },
  // {
  //   method: "GET",
  //   path: `${SERVER.API_BASE_URL}/v1/user/notification-list`,
  //   handler: async (request, h) => {
  //     try {
  //       const tokenData = request.auth && request.auth.credentials;
  //       let query: ListingRequest = request.query;
  //       let result = await userControllerV1.notificationListing(query, tokenData);
  //       return responseHandler.sendSuccess(h, result);
  //     } catch (error) {
  //       return responseHandler.sendError(request, error);
  //     }
  //   },
  //   config: {
  //     tags: ["api", "user"],
  //     description: "user Listing assigned to an assistant",
  //     auth: {
  //       strategies: ["UserAuth"],
  //     },
  //     validate: {
  //       headers: authorizationHeaderObj,
  //       query: notificationList,
  //       failAction: failActionFunction,
  //     },
  //     plugins: {
  //       "hapi-swagger": {
  //         responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES,
  //       },
  //     },
  //   },
  // },
];

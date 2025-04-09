"use strict";

import { Request, ResponseToolkit } from "@hapi/hapi";
import * as Joi from "joi";
import { failActionFunction } from "@utils/appUtils";
import { chatControllerV1 } from "@modules/chat/index";
import {
	REGEX,
	STATUS,
	SWAGGER_DEFAULT_RESPONSE_MESSAGES,
	SERVER,
	MESSAGE_TYPE,
	MESSAGES,
	CALL_TYPE,
	CALL_MODE_TYPE,
	CALL_STATUS
} from "@config/index";
import { responseHandler } from "@utils/ResponseHandler";
import { authorizationHeaderObj, headerObject } from "@utils/validator";
import { Token } from "aws-sdk";
import Axios from "axios";


export const chatRoute = [
	{
		method: "GET",
		path: `${SERVER.API_BASE_URL}/v1/chat-listing`,
		handler: async (request: Request | any, h: ResponseToolkit) => {
			try {
				const query: ListingRequest = request.query;
				const tokenData: TokenData = request.auth && request.auth.credentials && request.auth.credentials.tokenData;
				const result = await chatControllerV1.chatList(query, tokenData);
				return responseHandler.sendSuccess(h, result);
			} catch (error) {
				return responseHandler.sendError(request, error);
			}
		},
		config: {
			tags: ["api", "chats"],
			description: "Chats List",
			notes: "User chats list",
			auth: {
				strategies: ["UserAuth"]
			},
			validate: {
				headers: authorizationHeaderObj,
				query: Joi.object({
					pageNo: Joi.number().optional().description("Page no"),
					limit: Joi.number().optional().description("limit"),
					searchKey: Joi.string().optional().description("Search by message"),
					sortBy: Joi.string().trim().valid("created").optional().description("created"),
					sortOrder: Joi.number().optional().valid(1, -1).description("1 for asc, -1 for desc"),
					status: Joi.string()
						.trim()
						.optional()
						.valid(STATUS.ACTIVE, STATUS.ARCHIVED)
						.default(STATUS.ACTIVE)
				}),
				failAction: failActionFunction
			},
			plugins: {
				"hapi-swagger": {
					responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES
				}
			}
		}
	},
	{
		method: "GET",
		path: `${SERVER.API_BASE_URL}/v1/message`,
		handler: async (request: Request | any, h: ResponseToolkit) => {
			try {
				const query: ChatRequest.MessageList = request.query;
				const tokenData: TokenData = request.auth && request.auth.credentials && request.auth.credentials.tokenData;
				const result = await chatControllerV1.messageList(query, tokenData);
				return responseHandler.sendSuccess(h, result);
			} catch (error) {
				return responseHandler.sendError(request, error);
			}
		},
		config: {
			tags: ["api", "chats"],
			description: "Message List",
			notes: "User messages list",
			auth: {
				strategies: ["UserAuth"]
			},
			validate: {
				headers: authorizationHeaderObj,
				query: Joi.object({
					chatId: Joi.string().trim().required().regex(REGEX.MONGO_ID),
					pageNo: Joi.number().required().description("Page no"),
					limit: Joi.number().required().description("limit"),
					searchKey: Joi.string().optional().description("Search by message")
				}),
				failAction: failActionFunction
			},
			plugins: {
				"hapi-swagger": {
					responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES
				}
			}
		}
	},
	// {
	// 	method: "GET",
	// 	path: `${SERVER.API_BASE_URL}/v1/redis-ttl`,
	// 	handler: async (request: Request | any, h: ResponseToolkit) => {
	// 		try {
	// 			const query: {key: string} = request.query;
	// 			const result = await chatControllerV1.getRedisExpiry(query.key);
	// 			return responseHandler.sendSuccess(h, result);
	// 		} catch (error) {
	// 			return responseHandler.sendError(request, error);
	// 		}
	// 	},
	// 	config: {
	// 		tags: ["api", "chats"],
	// 		description: "Get redis ttl",
	// 		validate: {
	// 			query: Joi.object({
	// 				key: Joi.string().trim().required(),
	// 			}),
	// 			failAction: failActionFunction
	// 		},
	// 		plugins: {
	// 			"hapi-swagger": {
	// 				responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES
	// 			}
	// 		}
	// 	}
	// },
	{
		method: "POST",
		path: `${SERVER.API_BASE_URL}/v1/call-log`,
		handler: async (request: Request | any, h: ResponseToolkit) => {
			try {
				const params: ChatRequest.StoreCallLogRequest = request.payload;
				const tokenData: TokenData =
					request.auth &&
					request.auth.credentials &&
					request.auth.credentials.tokenData;
				const result = await chatControllerV1.storeCallLogs(params, tokenData);
				return responseHandler.sendSuccess(h, result);
			} catch (error) {
				return responseHandler.sendError(request, error);
			}
		},
		config: {
			tags: ["api", "chats"],
			description: "Store call log",
			auth: {
				strategies: ["UserAuth"],
			},
			validate: {
				headers: authorizationHeaderObj,
				payload: Joi.object({
					callLogs: Joi.array()
						.items(
							Joi.object({
								chatId: Joi.string().trim().regex(REGEX.MONGO_ID).required(),
								_id: Joi.string().trim().regex(REGEX.MONGO_ID).required(),
								callerId: Joi.string().trim().regex(REGEX.MONGO_ID).required(),
								meetingDetails: Joi.object({
									meetingId: Joi.string().trim().optional(),
									externalMeetingId: Joi.string().trim().optional(),
									mediaRegion: Joi.string().trim().optional(),
									mediaPlacement: Joi.object({
										audioHostUrl: Joi.string().trim().optional(),
										audioFallbackUrl: Joi.string().trim().optional(),
										signalingUrl: Joi.string().trim().optional(),
										turnControlUrl: Joi.string().trim().optional(),
										screenDataUrl: Joi.string().trim().optional(),
										screenViewingUrl: Joi.string().trim().optional(),
										screenSharingUrl: Joi.string().trim().optional(),
										eventIngestionUrl: Joi.string().trim().optional(),
									}),
									tenantIds: Joi.array().optional(),
									meetingArn: Joi.string().trim().optional(),
								}).optional(),
								receiverId: Joi.string()
									.trim()
									.regex(REGEX.MONGO_ID)
									.optional(),
								callType: Joi.string()
									.trim()
									.required()
									.valid(CALL_TYPE.GROUP, CALL_TYPE.PERSONAL)
									.description("Call type"),
								mode: Joi.string()
									.trim()
									.required()
									.valid(CALL_MODE_TYPE.AUDIO, CALL_MODE_TYPE.VIDEO)
									.description("Call mode"),
								status: Joi.string()
									.trim()
									.valid(CALL_STATUS.END, CALL_STATUS.ONGOING, CALL_STATUS.MISSED)
									.required()
									.description("call status"),
								created: Joi.number().description(
									"Created time in unix timestamp"
								),
								startTime: Joi.date()
									.required()
									.description("Call start time in utc+0"),
								endTime: Joi.date()
									.optional()
									.description("Call end time in utc+0"),
							})
						)
						.required(),
				}),
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
		method: "DELETE",
		path: `${SERVER.API_BASE_URL}/v1/call-log`,
		handler: async (request: Request | any, h: ResponseToolkit) => {
			try {
				const query: { id: string } = request.query;
				const tokenData: TokenData =
					request.auth &&
					request.auth.credentials &&
					request.auth.credentials.tokenData;
				const result = await chatControllerV1.deleteCallLog(query, tokenData);
				return responseHandler.sendSuccess(h, result);
			} catch (error) {
				return responseHandler.sendError(request, error);
			}
		},
		config: {
			tags: ["api", "chats"],
			description: "Delete call log",
			auth: {
				strategies: ["UserAuth"],
			},
			validate: {
				headers: authorizationHeaderObj,
				query: Joi.object({
					id: Joi.string().trim().regex(REGEX.MONGO_ID).required(),
				}),
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
		path: `${SERVER.API_BASE_URL}/v1/call-log`,
		handler: async (request: Request | any, h: ResponseToolkit) => {
			try {
				const query: ChatRequest.CallLogList = request.query;
				const tokenData: TokenData = request.auth && request.auth.credentials && request.auth.credentials.tokenData;
				const result = await chatControllerV1.getCallLogs(query, tokenData);
				return responseHandler.sendSuccess(h, result);
			} catch (error) {
				return responseHandler.sendError(request, error);
			}
		},
		config: {
			tags: ["api", "chats"],
			description: "Get call log list",
			auth: {
				strategies: ["UserAuth"]
			},
			validate: {
				headers: authorizationHeaderObj,
				query: Joi.object({
					pageNo: Joi.number().required().description("Page no"),
					limit: Joi.number().required().description("limit"),
				}),
				failAction: failActionFunction
			},
			plugins: {
				"hapi-swagger": {
					responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES
				}
			}
		}
	},
	{
		method: "POST",
		path: `${SERVER.API_BASE_URL}/v1/chat/profile`,
		handler: async (request: Request | any, h: ResponseToolkit) => {
			try {
				const params: ChatRequest.Id = request.payload;
				const tokenData: TokenData = request.auth && request.auth.credentials && request.auth.credentials.tokenData;
				const result = await chatControllerV1.chatProfile(params, tokenData);
				return responseHandler.sendSuccess(h, result);
			} catch (error) {
				return responseHandler.sendError(request, error);
			}
		},
		config: {
			tags: ["api", "chats"],
			description: "Chat Profile Details",
			auth: {
				strategies: ["UserAuth"]
			},
			validate: {
				headers: authorizationHeaderObj,
				payload: Joi.object({
					contactUserId: Joi.string().trim().regex(REGEX.MONGO_ID).required(),
					pageNo: Joi.number().optional().description("Page no").default(1),
					limit: Joi.number().optional().description("limit").default(10),
					sortBy: Joi.string().trim().valid("created").optional().description("created"),
					sortOrder: Joi.number().optional().valid(1, -1).description("1 for asc, -1 for desc").default(-1),
					type: Joi.string()
						.trim()
						.optional()
						.valid(MESSAGE_TYPE.MEDIA)
						.default(MESSAGE_TYPE.MEDIA)
				}),
				failAction: failActionFunction
			},
			plugins: {
				"hapi-swagger": {
					responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES
				}
			}
		}
	},
	{
		method: "POST",
		path: `${SERVER.API_BASE_URL}/v1/group/details`,
		handler: async (request: Request | any, h: ResponseToolkit) => {
			try {
				const params: ChatRequest.Id = request.payload;
				const tokenData: TokenData = request.auth && request.auth.credentials && request.auth.credentials.tokenData;
				const result = await chatControllerV1.viewGroupDetails(params, tokenData);
				return responseHandler.sendSuccess(h, result);
			} catch (error) {
				return responseHandler.sendError(request, error);
			}
		},
		config: {
			tags: ["api", "chats"],
			description: "Group Chat Profile Details",
			auth: {
				strategies: ["UserAuth"]
			},
			validate: {
				headers: authorizationHeaderObj,
				payload: Joi.object({
					groupId: Joi.string().trim().regex(REGEX.MONGO_ID).required(),
					pageNo: Joi.number().optional().description("Page no").default(1),
					limit: Joi.number().optional().description("limit").default(10),
					sortBy: Joi.string().trim().valid("created").optional().description("created"),
					sortOrder: Joi.number().optional().valid(1, -1).description("1 for asc, -1 for desc").default(-1),
					type: Joi.string()
						.trim()
						.optional()
						.valid(MESSAGE_TYPE.MEDIA)
						.default(MESSAGE_TYPE.MEDIA)
				}),
				failAction: failActionFunction
			},
			plugins: {
				"hapi-swagger": {
					responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES
				}
			}
		}
	},
	{
		method: "POST",
		path: `${SERVER.API_BASE_URL}/v1/subscription/expired`,
		handler: async (request: Request | any, h: ResponseToolkit) => {
			try {
				const params: any = request.payload;
				const result = await chatControllerV1.subscriptionExpired(params);
				return responseHandler.sendSuccess(h, result);
			} catch (error) {
				return responseHandler.sendError(request, error);
			}
		},
		config: {
			tags: ["api", "chats"],
			description: "API for subscription callback",
			validate: {
				// headers: authorizationHeaderObj,
				payload: Joi.object(),
				failAction: failActionFunction
			},
			plugins: {
				"hapi-swagger": {
					responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES
				}
			}
		}
	},
	{
		method: "POST",
		path: `${SERVER.API_BASE_URL}/v1/user-setting`,
		handler: async (request: Request | any, h: ResponseToolkit) => {
			try {
				const params: any = request.payload;
				const tokenData: TokenData = request.auth && request.auth.credentials && request.auth.credentials.tokenData;
				const result = await chatControllerV1.userSetting(params, tokenData);
				return responseHandler.sendSuccess(h, result);
			} catch (error) {
				return responseHandler.sendError(request, error);
			}
		},
		config: {
			tags: ["api", "chats"],
			description: "API for subscription callback",
			auth: {
				strategies: ["UserAuth"]
			},
			validate: {
				headers: authorizationHeaderObj,
				payload: Joi.object(),
				failAction: failActionFunction
			},
			plugins: {
				"hapi-swagger": {
					responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES
				}
			}
		}
	},
	{
		method: "POST",
		path: `${SERVER.API_BASE_URL}/v1/deleteUser`,
		handler: async (request: Request | any, h: ResponseToolkit) => {
			try {
				const params: any = request.payload;
				console.log('****************params---- deleteUser***********', params)
				const tokenData: TokenData = request.auth && request.auth.credentials && request.auth.credentials.tokenData;
				const result = await chatControllerV1.deleteUserHandling(tokenData);
				return responseHandler.sendSuccess(h, result);
			} catch (error) {
				return responseHandler.sendError(request, error);
			}
		},
		config: {
			tags: ["api", "chats"],
			description: "API for subscription callback",
			auth: {
				strategies: ["UserAuth"]
			},
			validate: {
				headers: authorizationHeaderObj,
				payload: Joi.object(),
				failAction: failActionFunction
			},
			plugins: {
				"hapi-swagger": {
					responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES
				}
			}
		}
	},
	{
		method: "GET",
		path: `${SERVER.API_BASE_URL}/v1/messageMapping`,
		handler: async (request: Request | any, h: ResponseToolkit) => {
			try {
				const result = await chatControllerV1.messageWeightageMapping();
				return responseHandler.sendSuccess(h, result);
			} catch (error) {
				return responseHandler.sendError(request, error);
			}
		},
		config: {
			tags: ["api", "Script"],
			description: "Map message weightage for last 20 Days",
			validate: {
				failAction: failActionFunction
			},
			plugins: {
				"hapi-swagger": {
					responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES
				}
			}
		}
	},
	// {
	// 	method: "GET",
	// 	path: `${SERVER.API_BASE_URL}/v1/badge-script`,
	// 	handler: async (request: Request | any, h: ResponseToolkit) => {
	// 		try {
	// 			// const tokenData: TokenData = request.auth && request.auth.credentials && request.auth.credentials.tokenData;
	// 			const result = await chatControllerV1.badgesScript();
	// 			return responseHandler.sendSuccess(h, result);
	// 		} catch (error) {
	// 			return responseHandler.sendError(request, error);
	// 		}
	// 	},
	// 	config: {
	// 		tags: ["api", "chats"],
	// 		description: "API for badges script",
	// 		auth: {
	// 			strategies: ["BasicAuth"]
	// 		},
	// 		validate: {
	// 			headers: authorizationHeaderObj,
	// 			failAction: failActionFunction
	// 		},
	// 		plugins: {
	// 			"hapi-swagger": {
	// 				responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES
	// 			}
	// 		}
	// 	}
	// },
	{
		method: "POST",
		path: `${SERVER.API_BASE_URL}/v1/request-accepted`,
		handler: async (request: Request | any, h: ResponseToolkit) => {
			try {
				const params: ChatRequest.CreateRequest = request.payload;
				const tokenData: TokenData = request.auth && request.auth.credentials && request.auth.credentials.tokenData;
				const result = await chatControllerV1.chatCreation(params, tokenData);
				return responseHandler.sendSuccess(h, result);
			} catch (error) {
				return responseHandler.sendError(request, error);
			}
		},
		config: {
			tags: ["api", "chats"],
			description: "Accept Request",
			auth: {
				strategies: ["CommonAuth"]
			},
			validate: {
				headers: authorizationHeaderObj,
				payload: Joi.object({
					reqId: Joi.string().trim().regex(REGEX.MONGO_ID).required(),
					userId: Joi.string().trim().regex(REGEX.MONGO_ID).required(),
					requestIdString: Joi.string().optional(),
					userName: Joi.string().optional(),
					userProfilePicture: Joi.string().optional(),
					serviceType: Joi.string().optional(),
					categoryName: Joi.string().optional(),
					categoryId: Joi.string().optional(),
					categoryIdString: Joi.string().optional(),
					issueTypeName: Joi.string().optional(),
					subIssueName: Joi.string().optional(),
					media: Joi.string().optional(),
					mediaType: Joi.string().optional(),
				}),
				failAction: failActionFunction
			},
			plugins: {
				"hapi-swagger": {
					responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES
				}
			}
		}
	},
	{
		method: "POST",
		path: `${SERVER.API_BASE_URL}/v1/job`,
		handler: async (request: Request | any, h: ResponseToolkit) => {
			try {
				const params: ChatRequest.CreateJob = request.payload;
				const tokenData: TokenData = request.auth && request.auth.credentials && request.auth.credentials.tokenData;
				const result = await chatControllerV1.jobChatFormation(params, tokenData);
				return responseHandler.sendSuccess(h, result);
			} catch (error) {
				return responseHandler.sendError(request, error);
			}
		},
		config: {
			tags: ["api", "chats"],
			description: "Create Chat for Job",
			auth: {
				strategies: ["CommonAuth"]
			},
			validate: {
				headers: authorizationHeaderObj,
				payload: Joi.object({
					jobId: Joi.string().trim().regex(REGEX.MONGO_ID).required(),
				}),
				failAction: failActionFunction
			},
			plugins: {
				"hapi-swagger": {
					responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES
				}
			}
		}
	},
	{
		method: "PUT",
		path: `${SERVER.API_BASE_URL}/v1/update-request`,
		handler: async (request: Request | any, h: ResponseToolkit) => {
			try {
				const params: ChatRequest.UpdateRequest = request.payload;
				const result = await chatControllerV1.updateDetailsInChatModel(params);
				return responseHandler.sendSuccess(h, result);
			} catch (error) {
				return responseHandler.sendError(request, error);
			}
		},
		config: {
			tags: ["api", "internal"],
			description: "Chat Req in Chat Model (Trigger)",
			auth: {
				strategies: ["BasicAuth"]
			},
			validate: {
				headers: headerObject["required"],
				payload: Joi.object({
					reqId: Joi.string().trim().regex(REGEX.MONGO_ID).optional(),
					jobId: Joi.string().trim().regex(REGEX.MONGO_ID).optional(),
					reportId: Joi.string().trim().regex(REGEX.MONGO_ID).optional(),
					userId: Joi.string().trim().regex(REGEX.MONGO_ID).optional(),
					requestIdString: Joi.string().optional(),
					userName: Joi.string().optional(),
					userProfilePicture: Joi.string().optional(),
					serviceType: Joi.string().optional(),
					categoryName: Joi.string().optional(),
					categoryId: Joi.string().optional(),
					categoryIdString: Joi.string().optional(),
					issueTypeName: Joi.string().optional(),
					subIssueName: Joi.string().optional(),
					media: Joi.string().optional(),
					mediaType: Joi.string().optional(),
					status: Joi.string().optional(),
				}),
				failAction: failActionFunction
			},
			plugins: {
				"hapi-swagger": {
					responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES
				}
			}
		}
	},
	{
		method: "POST",
		path: `${SERVER.API_BASE_URL}/v1/report-damage`,
		handler: async (request: Request | any, h: ResponseToolkit) => {
			try {
				const params: ChatRequest.ReportDamage = request.payload;
				const tokenData: TokenData = request.auth && request.auth.credentials && request.auth.credentials.tokenData;

				const result = await chatControllerV1.chatCreationReportDamage(params, tokenData);
				return responseHandler.sendSuccess(h, result);
			} catch (error) {
				return responseHandler.sendError(request, error);
			}
		},
		config: {
			tags: ["api", "chats"],
			description: "Chat Creation in Report Damage",
			auth: {
				strategies: ["CommonAuth"]
			},
			validate: {
				headers: authorizationHeaderObj,
				payload: Joi.object({
					reportId: Joi.string().trim().regex(REGEX.MONGO_ID).required(),
					userId: Joi.string().trim().regex(REGEX.MONGO_ID).required(),
					userName: Joi.string().optional(),
					userProfilePicture: Joi.string().optional(),
					type: Joi.string().optional(),
					description: Joi.string().optional(),
					status: Joi.string().optional(),
					media: Joi.array().items(
						Joi.object({
							media: Joi.string().required(),
							mediaType: Joi.string().required()
						})
					).optional(),
					location: Joi.object({
						coordinates: Joi.array().items(Joi.number()).optional(),
						address: Joi.string().optional(),
					}).optional().description("location: {coordinates: [26.5,25.4], address: 'house 1 inner road'}"),

				}),
				failAction: failActionFunction
			},
			plugins: {
				"hapi-swagger": {
					responseMessages: SWAGGER_DEFAULT_RESPONSE_MESSAGES
				}
			}
		}
	},
];
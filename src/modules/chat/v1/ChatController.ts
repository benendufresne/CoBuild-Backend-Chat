
"use strict";

import * as _ from "lodash";
import { SERVER } from '@config/environment';
import { MESSAGES, STATUS, SOCKET, CHAT_TYPE, MESSAGE_TYPE, REDIS_KEY_PREFIX, PAGINATION_DEFAULT, CHAT_REPORT_TYPE, LANGUAGE_CODE, BROADCAST_MODE, NOTIFICATION_TYPE, CHAT_HEADERS, CHAT_MODE_TYPE, WEIGHTAGE_SCORE, SUBSCRIPTION_CONFIG, DEFAULT_CONFIG, USER_TYPE, CHAT_MODE, JOB_TYPE } from "@config/constant";
import { baseDao } from "@modules/baseDao";
import { chatDaoV1 } from "@modules/chat/index";
import { userDaoV1 } from "@modules/user";
import { redisClient } from "@lib/redis/RedisClient";
import { toObjectId, consolelog, diffBw2Arrays, sendNotification, messageTypeInChat, mediaType } from "@utils/appUtils";
import { SocketIO } from "@socket/socket";
import * as  moment from 'moment'
import { axiosService } from "@lib/axiosService";
import { adminDaoV1 } from "@modules/admin";
// import { badgeDaoV1 } from '@modules/badges';
export class ChatController {

	/**
	 * @function chatFormation
	 * event for entering into a room for chatting with users
	 */
	async chatFormation(io: any, socket: any, params: ChatRequest.ONE_TO_ONE_CHAT_MESSAGE, ack: any, tokenData: TokenData) {
		try {
			console.log("token", tokenData);
			if (tokenData.userType == USER_TYPE.USER) {
				if (!params.chatId) {
					ack(MESSAGES.ERROR.PARAMS_MISSING);
				}
				const chat = await chatDaoV1.findOne("chats", { _id: params.chatId, deletedBy: { $nin: [tokenData.userId] } }, {});
				if (!chat) return ack(MESSAGES.ERROR.CHAT_NOT_FOUND);
				let data = {
					chatId: chat._id,
					lastSeen: 0,
					name: "Admin",
					request: chat.request,
					created: chat.created,
					status: chat.status,
					members: chat.members,
					type: chat.type,
					report: chat.report,
					chatMode: chat.chatMode,
					job: chat.job
				}
				ack(MESSAGES.SUCCESS.CHAT_FORMATION(data));
				socket.join(`${chat._id}`);
				// console.log("io.in(socket_user).fetchSockets();",await io.in(params.chatId).fetchSockets());
				return socket.emit(SOCKET.LISTNER.ONE_TO_ONE, MESSAGES.SUCCESS.CHAT_FORMATION(data));
			} else {
				if (!params.chatId) {
					ack(MESSAGES.ERROR.PARAMS_MISSING);
				}
				const chat = await chatDaoV1.findOne("chats", { _id: params.chatId }, {});
				if (!chat) return ack(MESSAGES.ERROR.CHAT_NOT_FOUND);
				const user = await userDaoV1.findUserById(chat.members[0]);
				if (!user) return ack(MESSAGES.ERROR.USER_NOT_FOUND);
				let isOnline = false;
				const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + chat.members[0] + REDIS_KEY_PREFIX.SOCKET_ID);
				if (socket_user) isOnline = true;
				let data = {
					chatId: chat._id,
					lastSeen: user.lastSeen || 0,
					name: user.name || "",
					request: chat.request,
					created: chat.created,
					status: chat.status,
					members: chat.members,
					type: chat.type,
					isOnline: isOnline,
					report: chat.report,
					chatMode: chat.chatMode,
					job: chat.job
				}
				ack(MESSAGES.SUCCESS.CHAT_FORMATION(data));
				socket.join(`${chat._id}`);
				// console.log("io.in(socket_user).fetchSockets();",await io.in(params.chatId).fetchSockets());
				return socket.emit(SOCKET.LISTNER.ONE_TO_ONE, MESSAGES.SUCCESS.CHAT_FORMATION(data));
			}
		} catch (error) {
			throw error;
		}
	}


	async rejectRequest(io: any, socket: any, params: ChatRequest.oneToOneChat, ack: any, tokenData: TokenData) {
		try {
			if (!params.chatId) {
				ack(MESSAGES.ERROR.PARAMS_MISSING)
				return
			}
			if (tokenData.userType == USER_TYPE.USER) {
				ack(MESSAGES.ERROR.UNAUTHORIZED_ACCESS)
			}
			let chat = await chatDaoV1.findOne("chats", { _id: params.chatId, status: { $ne: STATUS.REJECTED } }, {});
			if (!chat) return ack(MESSAGES.ERROR.CHAT_NOT_FOUND);
			chat = await chatDaoV1.findOneAndUpdate("chats", { _id: params.chatId }, { $set: { status: STATUS.REJECTED } }, { new: true });
			ack(MESSAGES.SUCCESS.DETAILS(chat));
			io.to(`${params.chatId}`).emit(`${params.chatId}`, {
				eventType: SOCKET.LISTNER_TYPE.CHAT.REJECT_REQUEST,
				data: chat
			});
			const axiosParams = {
				"reqId": chat.request.reqId,
				"status": STATUS.REJECTED
			}
			// send push to user
			console.log("rejectRequest AcccessToken", tokenData);
			axiosService.putData({ "url": SERVER.USER_APP_URL + SERVER.REQUEST, "body": axiosParams, auth: `Bearer ${tokenData.accessToken}` });
			return
		} catch (error) {
			throw error;
		}
	}


	async unreadNotify(io: any, socket: any, params: any, ack: any, tokenData: TokenData) {
		try {
			if (tokenData.userType != USER_TYPE.USER) {
				let data = {
					isRequestUnread: false,
					isReportUnread: false,
					isJobUnread: false
				}
				const admins = await adminDaoV1.distinct("admins", "_id", { status: STATUS.UN_BLOCKED });
				let rqst = await chatDaoV1.findOne("messages", { chatMode: CHAT_MODE.REQUEST, isRead: { $nin: admins } }, {});
				if (rqst) data.isRequestUnread = true;
				let report = await chatDaoV1.findOne("messages", { chatMode: CHAT_MODE.REPORT, isRead: { $nin: admins } }, {});
				if (report) data.isReportUnread = true;
				let job = await chatDaoV1.findOne("messages", { chatMode: CHAT_MODE.JOB, isRead: { $nin: admins } }, {});
				if (job) data.isJobUnread = true;
				console.log("admin unreadNotify", data);
				socket.emit(SOCKET.LISTNER_TYPE.NOTIFY.UNREAD_NOTIFY, data);
				return
			}
			let data = {
				userId: tokenData.userId,
				unread: false
			}
			let chat = await chatDaoV1.findOne("messages", { members: { $in: [tokenData.userId] }, isRead: { $nin: [tokenData.userId] } }, {});
			if (chat) {
				data = {
					userId: tokenData.userId,
					unread: true
				}
			}
			console.log("user unreadNotify", data);
			socket.emit(SOCKET.LISTNER_TYPE.NOTIFY.UNREAD_NOTIFY, data);
			return
		} catch (error) {
			throw error;
		}
	}


	/**
 * @function jobChatFormation
 * event for entering into a room for chatting with admin related to job
 */
	async jobChatFormation(params: ChatRequest.jobFormationChat, tokenData: TokenData) {
		try {
			if (!params.jobId) {
				return (MESSAGES.ERROR.PARAMS_MISSING)
			}
			const user = await userDaoV1.findUserById(tokenData.userId);
			if (!user)
				return (MESSAGES.ERROR.USER_NOT_FOUND)
			const isChatExist = await chatDaoV1.findOne("chats", { members: { $in: [tokenData.userId] }, "job.jobId": params.jobId }, {});
			if (isChatExist) {
				let data = {
					chatId: isChatExist._id,
					job: isChatExist.job,
					status: isChatExist.status,
					chatMode: isChatExist.chatMode,
					members: isChatExist.members
				}
				return (MESSAGES.SUCCESS.DETAILS(data));
			}
			const job = await chatDaoV1.getJobDetailsById(params.jobId)
			if (!job) return (MESSAGES.ERROR.JOB_NOT_FOUND)
			let members = [];
			members.push(tokenData.userId);
			const data: any = {
				members: members,
				name: user.name || "",
				profilePicture: user.profilePicture || "",
				chatMode: CHAT_MODE.JOB,
				job: {
					jobId: job._id,
					jobIdString: job.jobIdString,
					title: job.title,
					categoryName: job.category,
					categoryId: job.categoryId,
					status: job.status,
					doorTag: job.doorTag,
					personalName: job.personalName,
					location: {
						address: job.location.address,
						coordinates: job.location.coordinates,
					},
					companyLocation: {
						address: job.companyLocation.address,
						coordinates: job.companyLocation.coordinates,
					},
					email: job.email,
					fullMobileNo: job.fullMobileNo,
					aboutCompany: job.aboutCompany,
					priority: job.priority,
					procedure: job.procedure,
					schedule: job.schedule,
					completedAt: job.completedAt,
					created: job.created,
				}
			}

			const chat = await chatDaoV1.save("chats", data);
			return (MESSAGES.SUCCESS.DETAILS({
				chatId: chat._id,
				job: chat.job,
				status: chat.status,
				chatMode: chat.chatMode,
				members: chat.members
			}));
		} catch (error) {
			throw error;
		}
	}

	/**
 * @function chatCreation
 * event for entering into a room for chatting with users
 */
	async chatCreation(params: ChatRequest.CreateRequest, tokenData: TokenData) {
		try {
			const user = await userDaoV1.findUserById(params.userId);
			if (!user)
				return Promise.reject(MESSAGES.ERROR.USER_NOT_FOUND)

			let members = [];
			members.push(params.userId);
			const data: any = {
				members: members,
				name: user.name || "",
				profilePicture: user.profilePicture || "",
				request: {
					reqId: toObjectId(params.reqId),
					requestIdString: params.requestIdString,
					serviceType: params.serviceType,
					categoryName: params.categoryName,
					categoryId: toObjectId(params.categoryId),
					categoryIdString: params.categoryIdString,
					issueTypeName: params.issueTypeName,
					subIssueName: params.subIssueName,
					media: params.media,
					mediaType: params.mediaType,
				}
			}
			const chat = await chatDaoV1.save("chats", data)
			return MESSAGES.SUCCESS.CHAT_FORMATION(chat);
		} catch (error) {
			throw error;
		}
	}

	/**
 * @function chatCreation
 * event for entering into a room for chatting with users
 */
	async chatCreationReportDamage(params: ChatRequest.ReportDamage, tokenData: TokenData) {
		try {
			const user = await userDaoV1.findUserById(params.userId);
			if (!user)
				return Promise.reject(MESSAGES.ERROR.USER_NOT_FOUND)

			let members = [];
			members.push(params.userId);
			const data: any = {
				members: members,
				name: user.name || "",
				profilePicture: user.profilePicture || "",
				chatMode: CHAT_MODE.REPORT,
				report: {
					reportId: toObjectId(params.reportId),
					type: params.type,
					description: params.description,
					location: params.location,
					status: params.status,
					media: params.media,
				}
			}
			console.log({ data })
			const chat = await chatDaoV1.save("chats", data)
			return MESSAGES.SUCCESS.CHAT_FORMATION(chat);
		} catch (error) {
			throw error;
		}
	}


	/**
 * @function oneToOneMessage
 * exchange messages in a room with chat user for real time chatting
 */
	async oneToOneMessage(io: any, socket: any, params: ChatRequest.ONE_TO_ONE_CHAT_MESSAGE, ack: any, tokenData: TokenData) {
		try {
			if (!params.chatId || !params.messageType || !params.senderId || !params.localMessageId) {
				ack(MESSAGES.ERROR.PARAMS_MISSING);
				return
			}
			if (params.messageType == MESSAGE_TYPE.TEXT && !params.message) {
				ack(MESSAGES.ERROR.PARAMS_MISSING);
				return
			}
			if (params.messageType == MESSAGE_TYPE.QUOTATION && !params.amount && !params.estimatedDays) {
				return ack(MESSAGES.ERROR.PARAMS_MISSING);
			}
			const chat = await chatDaoV1.findOne("chats", { _id: params.chatId, deletedBy: { $nin: [tokenData.userId] } }, {});
			if (!chat) return ack(MESSAGES.ERROR.CHAT_NOT_FOUND);
			const contactUserId = await userDaoV1.findUserById(chat.members[0]);
			if (!contactUserId) {
				ack(MESSAGES.ERROR.USER_NOT_FOUND)
			}
			const isBlocked = await this.checkUserBlockedStatus(params.contactUserId, tokenData.userId)
			let isDelivered = [], isRead = [], deletedBy = [], blockedMessage = false, socket_user: any;
			const admins = await adminDaoV1.distinct("admins", "_id", { status: STATUS.UN_BLOCKED });
			if (tokenData.userType != USER_TYPE.USER) {
				socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + (chat.members[0]).toString() + REDIS_KEY_PREFIX.SOCKET_ID);
				if (isBlocked) {
					blockedMessage = true
					deletedBy.push(toObjectId(contactUserId))
				} else if (socket_user) {
					isDelivered.push(contactUserId);
					const roomSockets = io.sockets.adapter.rooms.get(params.chatId);
					if (roomSockets && roomSockets.has(socket_user)) {
						isRead.push(chat.members[0]);
					}
				}
			} else {
				console.log("ADMIN lENGTH", admins.length);
				for (let admin of admins) {
					let socket_admin = await redisClient.getValue(SERVER.APP_NAME + "_" + (admin).toString() + REDIS_KEY_PREFIX.ADMIN_SOCKET_ID);
					if (socket_admin) {
						isDelivered.push(admin);
						break;
					}
				}
				for (let admin of admins) {
					let socket_admin = await redisClient.getValue(SERVER.APP_NAME + "_" + (admin).toString() + REDIS_KEY_PREFIX.ADMIN_SOCKET_ID);
					const roomSockets = io.sockets.adapter.rooms.get(params.chatId);
					if (roomSockets && roomSockets.has(socket_admin)) {
						isRead.push(admin);
						break;
					}
				}
			}

			let members = [];
			isRead.push(params.senderId);
			isDelivered.push(params.senderId);
			isRead = [... new Set(isRead)];
			isDelivered = [... new Set(isDelivered)];
			members.push(chat.members[0]);
			let data: any = {
				_id: params.localMessageId,
				type: CHAT_TYPE.ONE_TO_ONE,
				senderId: params.senderId,
				members: members,
				chatId: params.chatId,
				message: params.message,
				mediaUrl: params.mediaUrl,
				messageType: params.messageType,
				isRead: isRead,
				isDelivered: isDelivered,
				thumbnailUrl: params.thumbnailUrl ? params.thumbnailUrl : null,
				location: params.location,
				contact: params.contact,
				size: params.size ? params.size : null,
				// transcribe: params.transcribe ? params.transcribe : null,
				status: params.status,
				deletedBy: deletedBy,
				blockedMessage: blockedMessage,
				imageRatio: params.imageRatio,
				localUrl: params.localUrl,
				request: chat.request,
				name: chat.name || "",
				profilePicture: chat.profilePicture || "",
				amount: params.amount,
				notes: params.notes,
				estimatedDays: params.estimatedDays,
				report: chat.report,
				chatMode: chat.chatMode
			}
			const message = await baseDao.save("messages", data);
			const Chat = await baseDao.findOneAndUpdate("chats", {
				_id: params.chatId
			}, {
				lastMsgId: message._id,
				lastMsgCreated: Date.now(),
				deletedBy: []
			}, { new: true });
			const membersDetails = await userDaoV1.find("users", { _id: { $in: members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
			message.membersDetails = membersDetails;
			ack(MESSAGES.SUCCESS.LIST(message));
			io.to(`${params.chatId}`).emit(`${params.chatId}`, {
				eventType: SOCKET.LISTNER_TYPE.SOCKET_SERVICE.ONE_TO_ONE_CHAT,
				data: message
			});
			this.inboxChat(io, socket, PAGINATION_DEFAULT, ack, { userId: tokenData.userId, userType: tokenData.userType });
			socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + (chat.members[0]).toString() + REDIS_KEY_PREFIX.SOCKET_ID);
			const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;
			if (contactUserIdSocket) {
				this.inboxChat(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: chat.members[0], userType: USER_TYPE.USER });
				this.unreadNotify(io, contactUserIdSocket, {}, ack, { userId: chat.members[0], userType: USER_TYPE.USER })
			}

			//admin
			for (let admin of admins) {
				let socket_admin = await redisClient.getValue(SERVER.APP_NAME + "_" + (admin).toString() + REDIS_KEY_PREFIX.ADMIN_SOCKET_ID);
				if (socket_admin) {
					const adminIdSocket = io.sockets.sockets.get(socket_admin);
					if (adminIdSocket) {
						this.inboxChat(io, adminIdSocket, PAGINATION_DEFAULT, ack, { userId: admin, userType: USER_TYPE.ADMIN });
						this.unreadNotify(io, adminIdSocket, {}, ack, { userId: admin, userType: USER_TYPE.ADMIN })
					}
				}
			}
			const userId = data.members[0]
			if (tokenData.userType == USER_TYPE.ADMIN && params.messageType == MESSAGE_TYPE.QUOTATION) {
				const notificationParams = {
					"type": "ESTIMATE_REQUEST_ACCEPTED_USER",
					"userType": "USER",
					"receiverIds": [userId.toString()],
					"details": { "reqId": data.request.requestIdString, "requestId": data.request.reqId, "chatId": data.chatId.toString() }
				}
				axiosService.post({ "url": SERVER.NOTIFICATION_APP_URL + SERVER.SEND_NOTFICATION, "body": notificationParams, auth: `Bearer ${tokenData.accessToken}` });
			}
			return true;
		} catch (error) {
			const errorMessage = error?.message || "Internal server error"
			ack(MESSAGES.ERROR.CHAT_MESSAGE_ERROR(errorMessage, params.chatId, 500))
			throw error;
		}
	}




	/**
	 * @function messageInteractions
	* message interaction helps in creation for jobs for user-user interaction weightage for algo in social
	 */
	async messageInteractions(params: ChatRequest.INTERACTIONS, tokenData: TokenData) {
		try {
			// const score = WEIGHTAGE_SCORE.MESSAGE;
			// const followingKey = `following:${tokenData.userId}`;
			// const interaction_score= await redisClient.findSortedSet(followingKey,params.contactUserId.toString());
			// console.log(`following:${tokenData.userId} interaction_score`,interaction_score)
			// await redisClient.incrementSortedSetScore(followingKey, score, params.contactUserId.toString());
			// const key= `${JOB_SCHEDULER_TYPE.USER_MESSAGE_INTERACTIONS}.${tokenData.userId}_${params.contactUserId}.${params.localMessageId}`;
			// console.log('checkClusterNode(key)==REDIS_CLUSTER_CONFIG.NODE_1',checkClusterNode(key)==REDIS_CLUSTER_CONFIG.NODE_1)
			// if(checkClusterNode(key)==REDIS_CLUSTER_CONFIG.NODE_1) {
			// 	await redisClusterNodeOne.redisWeightageManagement(key,JOB_SCHEDULER_TYPE.USER_MESSAGE_INTERACTIONS,{
			// 		userIds: `${tokenData.userId}_${params.contactUserId}`,
			// 		messageId: params.localMessageId
			// 	})	
			// }else {
			// 	await redisClusterNodeTwo.redisWeightageManagement(key,JOB_SCHEDULER_TYPE.USER_MESSAGE_INTERACTIONS,{
			// 		userIds: `${tokenData.userId}_${params.contactUserId}`,
			// 		messageId: params.localMessageId
			// 	})	
			// }						
		} catch (error) {
			throw error
		}
	}

	/**
	 * @function forwardMessage
	 * forward message to users
	 */
	// async forwardMessage(io: any, socket: any, params: ChatRequest.FORWARD, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.contactUserId || !params.messageType || !params.senderId || !params.localMessageId) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		if (params.messageType == MESSAGE_TYPE.TEXT && !params.message) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		const contactUserId = await userDaoV1.findUserById(params.contactUserId);
	// 		if (!contactUserId) {
	// 			ack(MESSAGES.ERROR.USER_NOT_FOUND)
	// 		}
	// 		const isBlocked = await this.checkUserBlockedStatus(params.contactUserId, tokenData.userId)
	// 		let members = [], isDelivered = [], deletedBy = [], isRead = [], blockedMessage = false;
	// 		members.push(tokenData.userId, params.contactUserId);
	// 		let isExist = await chatDaoV1.isChatExists(members);
	// 		if (!isExist) {
	// 			const data: any = {
	// 				members: members
	// 			}
	// 			if (SERVER.IS_TRANSLATION_ENABLE) {
	// 				const chatUserInfo = await this.setUserLanguage([params.contactUserId, tokenData.userId])
	// 				data.userLang = chatUserInfo.userLang;
	// 				data.langCodes = chatUserInfo.langCodes;
	// 			}
	// 			isExist = await chatDaoV1.save("chats", data)
	// 		}
	// 		else if (!isExist.langCodes?.length && SERVER.IS_TRANSLATION_ENABLE) {
	// 			const toUpdate: any = {}
	// 			const chatUserInfo = await this.setUserLanguage(isExist?.members)
	// 			toUpdate.userLang = chatUserInfo.userLang;
	// 			toUpdate.langCodes = chatUserInfo.langCodes;
	// 			await chatDaoV1.findOneAndUpdate("chats", { _id: isExist._id }, toUpdate)
	// 		}
	// 		const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + (params.contactUserId).toString() + REDIS_KEY_PREFIX.SOCKET_ID);
	// 		if (isBlocked) {
	// 			blockedMessage = true
	// 			deletedBy.push(toObjectId(params.contactUserId))
	// 		} else if (socket_user) {
	// 			if (!isBlocked) {
	// 				isDelivered.push(params.contactUserId);
	// 			}
	// 			const scoketIds = await io.in(socket_user).fetchSockets();
	// 			for (const socket of scoketIds) {
	// 				if (socket?.rooms?.has(`${isExist._id}`)) isRead.push(params.contactUserId);
	// 			}
	// 		}
	// 		isRead.push(params.senderId);
	// 		isDelivered.push(params.senderId);
	// 		let data: any = {
	// 			_id: params.localMessageId,
	// 			type: CHAT_TYPE.ONE_TO_ONE,
	// 			senderId: params.senderId,
	// 			members: members,
	// 			chatId: isExist._id,
	// 			message: params.message,
	// 			mediaUrl: params.mediaUrl,
	// 			messageType: params.messageType,
	// 			isRead: isRead,
	// 			isDelivered: isDelivered,
	// 			thumbnailUrl: params.thumbnailUrl ? params.thumbnailUrl : null,
	// 			location: params.location,
	// 			size: params.size ? params.size : null,
	// 			transcribe: params.transcribe ? params.transcribe : null,
	// 			status: params.status,
	// 			deletedBy: deletedBy,
	// 			blockedMessage: blockedMessage,
	// 			imageRatio: params.imageRatio,
	// 			localUrl: params.localUrl,
	// 			contact: params.contact
	// 		}
	// 		let translatedInfo: any = {}
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			// translatedInfo = params.languageCode ? await translateMessage(params.languageCode, params.message, isExist._id, tokenData) : await autoTranslateMessage(params.message, isExist._id)
	// 			// data.translatedMessages = translatedInfo.encryptedMessages;
	// 			// data.langCodes = translatedInfo.langCodes;
	// 			// data.userLang = translatedInfo.userLang;
	// 		}
	// 		const message = await baseDao.save("messages", data);
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			data.translatedMessages = translatedInfo.translatedMessages;
	// 		}
	// 		const Chat = await baseDao.findOneAndUpdate("chats", {
	// 			_id: isExist._id
	// 		}, {
	// 			lastMsgId: message._id,
	// 			lastMsgCreated: Date.now(),
	// 			deletedBy: []
	// 		}, { new: true });
	// 		const membersDetails = await userDaoV1.find("users", { _id: { $in: members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 		message.membersDetails = membersDetails;
	// 		ack(message);
	// 		await this.messageInteractions(params, tokenData);
	// 		const isSenderArchive = await this.checkChatArchiveStatus(tokenData.userId, isExist._id);
	// 		const isReceiverArchive = await this.checkChatArchiveStatus(params.contactUserId, isExist._id);
	// 		if (isBlocked) {
	// 			socket.emit(`${isExist._id}`, {
	// 				eventType: SOCKET.LISTNER_TYPE.SOCKET_SERVICE.ONE_TO_ONE_CHAT,
	// 				data: message
	// 			});
	// 			if (isSenderArchive) {
	// 				// this.inboxArchive(io, socket, PAGINATION_DEFAULT, ack, { userId: tokenData.userId });
	// 				// this.refreshArchiveChatBox(io, socket, {chatId:isExist._id}, ack, { userId: tokenData.userId });
	// 			} else {
	// 				this.inboxChat(io, socket, PAGINATION_DEFAULT, ack, { userId: tokenData.userId });
	// 				// this.refreshChatBox(io,socket,{chatId:isExist._id},ack,{userId: tokenData.userId});
	// 			}
	// 		} else {
	// 			io.to(`${isExist._id}`).emit(`${isExist._id}`, {
	// 				eventType: SOCKET.LISTNER_TYPE.SOCKET_SERVICE.ONE_TO_ONE_CHAT,
	// 				data: message
	// 			});
	// 			if (isSenderArchive) {
	// 				// this.inboxArchive(io, socket, PAGINATION_DEFAULT, ack, { userId: tokenData.userId });
	// 				// this.refreshArchiveChatBox(io, socket, {chatId:isExist._id}, ack, { userId: tokenData.userId });
	// 			} else {
	// 				this.inboxChat(io, socket, PAGINATION_DEFAULT, ack, { userId: tokenData.userId });
	// 				// this.refreshChatBox(io,socket,{chatId:isExist._id},ack,{userId: tokenData.userId});
	// 			}
	// 			let IsNotificationMuted = await this.checkforChatNotification(params.contactUserId, isExist._id);
	// 			const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;//io.sockets.sockets.get(socket_user);
	// 			const sender = await userDaoV1.findUserById(params.senderId);
	// 			let notification_message = messageTypeInChat(params.messageType) != MESSAGE_TYPE.TEXT ? messageTypeInChat(params.messageType) : data.translatedMessages[`${contactUserId.languageCode}`] ? data.translatedMessages[`${contactUserId.languageCode}`] : params.message;
	// 			console.log('***************************notification_message***************************', notification_message)
	// 			if (contactUserIdSocket) {
	// 				if (isReceiverArchive) {
	// 					// this.inboxArchive(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: params.contactUserId });
	// 					// this.refreshArchiveChatBox(io, contactUserIdSocket, {chatId:isExist._id}, ack, { userId: params.contactUserId });
	// 				} else {
	// 					//online notification
	// 					if (socket_user) {
	// 						let roomParams = {
	// 							chatId: isExist._id,
	// 							socketId: socket_user
	// 						};
	// 						let IsNotification = await this.checkUserRoomInSocket(io, roomParams);
	// 						if (!IsNotification) //TODO:notification service 
	// 						{
	// 							let notificationData: ChatRequest.CHAT_NOTIFICATION = {
	// 								type: NOTIFICATION_TYPE.CHAT_NOTIFICATION,
	// 								title: sender?.name,
	// 								message: data.translatedMessages[`${contactUserId.languageCode}`] ? data.translatedMessages[`${contactUserId.languageCode}`] : params.message,
	// 								body: data.translatedMessages[`${contactUserId.languageCode}`] ? data.translatedMessages[`${contactUserId.languageCode}`] : params.message,
	// 								details: {
	// 									chatId: isExist._id,
	// 									senderId: params.senderId,
	// 									receiverId: params.contactUserId,
	// 									receiverIdName: contactUserId?.name,
	// 									messageType: params.messageType,
	// 									profilePicture: sender?.profilePicture,
	// 									countryCode: sender.countryCode,
	// 									mobileNo: sender.mobileNo,
	// 									fullMobileNo: sender?.fullMobileNo,
	// 									type: CHAT_TYPE.ONE_TO_ONE,
	// 									senderName: sender?.name,
	// 									flagCode: sender?.flagCode,
	// 									membersDetails: message.membersDetails ? message.membersDetails : {}
	// 								}
	// 							}
	// 							console.log('***********notificationData*************', notificationData)
	// 							if (!IsNotificationMuted) await this.sendChatNotification(contactUserIdSocket, notificationData);
	// 						}
	// 					}
	// 					this.inboxChat(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: params.contactUserId });
	// 					// this.refreshChatBox(io,contactUserIdSocket,{chatId:isExist._id},ack,{userId: params.contactUserId});
	// 				}
	// 			} else {
	// 				let notificationDataDetails: ChatRequest.CHAT_NOTIFICATION = {
	// 					type: NOTIFICATION_TYPE.CHAT_NOTIFICATION,
	// 					title: sender?.name,
	// 					message: notification_message,
	// 					body: notification_message,
	// 					details: {
	// 						chatId: isExist._id,
	// 						senderId: params.senderId,
	// 						receiverId: params.contactUserId,
	// 						receiverIdName: contactUserId?.name,
	// 						messageType: params.messageType,
	// 						profilePicture: sender?.profilePicture,
	// 						countryCode: sender.countryCode,
	// 						mobileNo: sender.mobileNo,
	// 						fullMobileNo: sender?.fullMobileNo,
	// 						type: CHAT_TYPE.ONE_TO_ONE,
	// 						senderName: sender?.name,
	// 						flagCode: sender?.flagCode,
	// 						membersDetails: message.membersDetails ? message.membersDetails : {}
	// 					}
	// 				}
	// 				let contact = await userDaoV1.findOne("contacts", { userId: notificationDataDetails.details.receiverId, contactUserId: notificationDataDetails.details.senderId }, { name: 1 });
	// 				notificationDataDetails.title = contact?.name || notificationDataDetails.details.fullMobileNo;
	// 				notificationDataDetails.details.senderName = contact?.name || notificationDataDetails.details.fullMobileNo;
	// 				consolelog(`************Push notification details****************`, notificationDataDetails, true);
	// 				const isSubscribedUser = await this.checkUserSubscription(notificationDataDetails.details.receiverId);
	// 				if (isSubscribedUser.isSubscribed || isSubscribedUser?.expiryTime < Date.now()) {
	// 					if (!IsNotificationMuted) await sendNotification(notificationDataDetails, socket.accessToken);
	// 				}
	// 			}
	// 		}
	// 		return true;
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }
	/**
 * @function checkUserRoomInSocket
 * check user is present in a room or not
 * 
 */
	async checkUserRoomInSocket(io: any, params) {
		try {
			const scoketIds = await io.in(params.socketId).fetchSockets();
			for (const socket of scoketIds) {
				consolelog(`*********[checkUserRoomInSocket] params in room true************`, params, true);
				if (socket?.rooms?.has(`${params.chatId}`)) return true;
			}
			return false
		} catch (error) {

		}
	}

	/**
	* @function messageModelDataMapping
	* map "message" model data for saving in schema
	*/

	async messageModelDataMapping(params, details) {
		try {
			let data: any = {
				_id: params.localMessageId,
				type: CHAT_TYPE.ONE_TO_ONE,
				senderId: params.senderId,
				members: details.members,
				chatId: params.chatId,
				message: params.message,
				mediaUrl: params.mediaUrl,
				messageType: params.messageType,
				isRead: details.isRead,
				isDelivered: details.isDelivered,
				thumbnailUrl: params.thumbnailUrl ? params.thumbnailUrl : null,
				location: params.location,
				size: params.size ? params.size : null,
				transcribe: params.transcribe ? params.transcribe : null,
				status: params.status,
				deletedBy: details.deletedBy,
				contact: params.contact
			}
			return data
		} catch (error) {
			throw error
		}
	}



	/**
	 * @function chatReaction
	 * react to a message in a current room
	 */
	// async chatReaction(io: any, socket: any, params: ChatRequest.CHAT_REACTION, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.messageId || !params.reaction) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		let reaction = [];
	// 		let messageId = await baseDao.findOne("messages", { _id: params.messageId });
	// 		if (!messageId) {
	// 			ack(MESSAGES.ERROR.MESSAGE_NOT_FOUND)
	// 			return
	// 		}
	// 		const messageUserId = await baseDao.findOne("messages", { _id: params.messageId, "reaction.userId": toObjectId(tokenData.userId) });
	// 		if (messageUserId) {
	// 			messageId = await baseDao.findOneAndUpdate("messages", { _id: params.messageId, "reaction.userId": toObjectId(tokenData.userId) }, { "reaction.$.reaction": params.reaction }, { new: true });
	// 			const membersDetails = await userDaoV1.find("users", { _id: { $in: messageId.members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, flagCode: 1, name: 1 });
	// 			messageId.membersDetails = membersDetails;
	// 			ack(messageId)
	// 			io.to(`${messageId.chatId}`).emit(`${messageId.chatId}`, {
	// 				eventType: SOCKET.LISTNER_TYPE.MESSAGE.REACTION,
	// 				data: messageId
	// 			});
	// 			return
	// 		} else {
	// 			reaction.push({
	// 				userId: tokenData.userId,
	// 				reaction: params.reaction
	// 			});
	// 			messageId = await baseDao.findOneAndUpdate("messages", { _id: params.messageId }, { $push: { reaction: reaction } }, { new: true });
	// 			const membersDetails = await userDaoV1.find("users", { _id: { $in: messageId.members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 			messageId.membersDetails = membersDetails;
	// 			ack(messageId)
	// 			io.to(`${messageId.chatId}`).emit(`${messageId.chatId}`, {
	// 				eventType: SOCKET.LISTNER_TYPE.MESSAGE.REACTION,
	// 				data: messageId
	// 			});
	// 			return
	// 		}
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
 * @function chatReaction
 * react to a message in a current room
 */
	async quotationStatus(io: any, socket: any, params: ChatRequest.QUOTATION_STATUS, ack: any, tokenData: TokenData) {
		try {
			if (!params.messageId || !params.status || !params.localMessageId || !params.chatId || !params.messageType || !params.senderId || !params.message) {
				ack(MESSAGES.ERROR.PARAMS_MISSING);
				return
			}

			// if(params.status != STATUS.ACCEPTED || params.status!= STATUS.REJECTED || params.status!= STATUS.BIDAGAIN){
			// 	return ack(MESSAGES.ERROR.INCORRECT_STATUS);
			// }					
			let messageId = await baseDao.findOne("messages", { _id: params.messageId });
			console.log("messageId", messageId);
			if (!messageId) {
				return ack(MESSAGES.ERROR.MESSAGE_NOT_FOUND);
			}

			let isDelivered = [], isRead = [], socket_user: any;
			const admins = await adminDaoV1.distinct("admins", "_id", { status: STATUS.UN_BLOCKED });
			if (tokenData.userType != USER_TYPE.USER) {
				socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + (messageId.members[0]).toString() + REDIS_KEY_PREFIX.SOCKET_ID);
				if (socket_user) {
					isDelivered.push(messageId.members[0]);
				}
				const roomSockets = io.sockets.adapter.rooms.get(params.chatId);
				if (roomSockets && roomSockets.has(socket_user)) {
					isRead.push(messageId.members[0]);
				}
			} else {
				for (let admin of admins) {
					let socket_admin = await redisClient.getValue(SERVER.APP_NAME + "_" + (admin).toString() + REDIS_KEY_PREFIX.ADMIN_SOCKET_ID);
					if (socket_admin) {
						isDelivered.push(admin);
						break;
					}
				}
				for (let admin of admins) {
					let socket_admin = await redisClient.getValue(SERVER.APP_NAME + "_" + (admin).toString() + REDIS_KEY_PREFIX.ADMIN_SOCKET_ID);
					const roomSockets = io.sockets.adapter.rooms.get(params.chatId);
					if (roomSockets && roomSockets.has(socket_admin)) {
						isRead.push(admin);
						break;
					}
				}

			}
			isRead.push(params.senderId);
			isDelivered.push(params.senderId);
			isRead = [... new Set(isRead)];
			isDelivered = [... new Set(isDelivered)];
			let data = {
				_id: params.localMessageId,
				type: CHAT_TYPE.ONE_TO_ONE,
				senderId: params.senderId,
				members: messageId.members,
				chatId: params.chatId,
				messageId: params.messageId,
				message: params.message,
				messageType: params.messageType,
				status: STATUS.ACTIVE,
				request: messageId.request,
				notes: messageId?.notes || "",
				estimatedDays: messageId?.estimatedDays || "",
				amount: messageId?.amount || 0,
				report: messageId.report,
				chatMode: messageId.chatMode,
				isRead: isRead,
				isDelivered: isDelivered,
				profilePicture: messageId?.profilePicture || "",
			}
			const message = await baseDao.save("messages", data);
			let updateStatus = await baseDao.findOneAndUpdate("messages", { _id: params.messageId }, { status: params.status }, { new: true });
			console.log("quotationStatus updateStatus", updateStatus);
			const Chat = await baseDao.findOneAndUpdate("chats", {
				_id: params.chatId
			}, {
				lastMsgId: message._id,
				lastMsgCreated: Date.now(),
				deletedBy: []
			}, { new: true });
			if (params.status == STATUS.ACCEPTED) await chatDaoV1.findOneAndUpdate("chats", { _id: params.chatId }, { $set: { status: STATUS.ACCEPTED } }, { new: true });
			if (params.status == STATUS.REJECTED) await chatDaoV1.findOneAndUpdate("chats", { _id: params.chatId }, { $set: { status: STATUS.REJECTED } }, { new: true });
			const membersDetails = await userDaoV1.find("users", { _id: { $in: messageId.members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
			message.membersDetails = membersDetails;
			ack(MESSAGES.SUCCESS.LIST(message));
			io.to(`${params.chatId}`).emit(`${params.chatId}`, {
				eventType: SOCKET.LISTNER_TYPE.SOCKET_SERVICE.ONE_TO_ONE_CHAT,
				data: message
			});

			for (let admin of admins) {
				let socket_admin = await redisClient.getValue(SERVER.APP_NAME + "_" + (admin).toString() + REDIS_KEY_PREFIX.ADMIN_SOCKET_ID);
				if (socket_admin) {
					const adminIdSocket = io.sockets.sockets.get(socket_admin);
					if (adminIdSocket) {
						this.inboxChat(io, adminIdSocket, PAGINATION_DEFAULT, ack, { userId: admin, userType: USER_TYPE.ADMIN });
					}
				}
			}

			const axiosParams = {
				"reqId": Chat.request.reqId,
				"status": params.status
			}
			if (params.status == STATUS.ACCEPTED)
				axiosParams.status = STATUS.APPROVED
			console.log("quotationStatus AcccessToken", tokenData);
			axiosService.putData({ "url": SERVER.USER_APP_URL + SERVER.REQUEST, "body": axiosParams, auth: `Bearer ${tokenData.accessToken}` });

			// send push to admin (accept/reject/bidagain)
			if (tokenData.userType == USER_TYPE.USER) {
				if (params.status == STATUS.REJECTED) {
					const notificationParams = {
						"type": "ESTIMATE_REQUEST_REJECTED_ADMIN",
						"userType": "ADMIN",
						// "receiverIds": [userId.toString()],
						"details": { "userName": tokenData.name, "requestId": Chat.request.reqId, "reqId": Chat.request.requestIdString.toString(), "chatId": Chat._id.toString() }
					}
					axiosService.post({ "url": SERVER.NOTIFICATION_APP_URL + SERVER.SEND_NOTFICATION, "body": notificationParams, auth: `Bearer ${tokenData.accessToken}` });
				} else if (params.status == STATUS.ACCEPTED) {
					const notificationParams = {
						"type": "QUOTATION_ACCEPTED",
						"userType": "ADMIN",
						// "receiverIds": [userId.toString()],
						"details": { "userName": tokenData.name, "requestId": Chat.request.reqId, "reqId": Chat.request.requestIdString.toString(), "chatId": Chat._id.toString() }
					}
					axiosService.post({ "url": SERVER.NOTIFICATION_APP_URL + SERVER.SEND_NOTFICATION, "body": notificationParams, auth: `Bearer ${tokenData.accessToken}` });
				}
				else if (params.status == STATUS.BIDAGAIN) {
					const notificationParams = {
						"type": "NEW_BID_REQUEST",
						"userType": "ADMIN",
						// "receiverIds": [userId.toString()],
						"details": { "userName": tokenData.name, "requestId": Chat.request.reqId, "reqId": Chat.request.requestIdString.toString(), "chatId": Chat._id.toString() }
					}
					axiosService.post({ "url": SERVER.NOTIFICATION_APP_URL + SERVER.SEND_NOTFICATION, "body": notificationParams, auth: `Bearer ${tokenData.accessToken}` });
				}
			}
			return
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function RepliedToMessage
	 * replied to a message in a current room
	 */
	async RepliedToMessage(io: any, socket: any, params: ChatRequest.REPLIED, ack: any, tokenData: TokenData) {
		try {
			if (!params.messageId || !params.chatId || !params.contactUserId || !params.messageType || !params.senderId || !params.localMessageId) {
				ack(MESSAGES.ERROR.PARAMS_MISSING)
				return
			}
			const messageId = await baseDao.find("messages", { _id: params.messageId }, {});
			if (!messageId) {
				ack(MESSAGES.ERROR.MESSAGE_NOT_FOUND)
			}
			const contactUserId = await userDaoV1.findUserById(params.contactUserId);
			if (!contactUserId) {
				ack(MESSAGES.ERROR.USER_NOT_FOUND)
			}
			let isOnline = false;
			let deletedBy = [], isDelivered = [], isRead = [], members = [], blockedMessage = false;
			const isBlocked = await this.checkUserBlockedStatus(params.contactUserId, tokenData.userId)
			// const isBlocked = await userDaoV1.findOne("users", { _id: params.contactUserId, blocked: { $in: [toObjectId(tokenData.userId)] } });
			const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + (params.contactUserId).toString() + REDIS_KEY_PREFIX.SOCKET_ID);
			if (isBlocked) {
				deletedBy.push(toObjectId(params.contactUserId));
				blockedMessage = true
			} else if (socket_user) {
				isOnline = true;
				if (!isBlocked) {
					isDelivered.push(params.contactUserId);
				}
				const scoketIds = await io.in(socket_user).fetchSockets();
				for (const socket of scoketIds) {
					if (socket?.rooms?.has(`${params.chatId}`)) isRead.push(params.contactUserId);
				}
			}
			isRead.push(params.senderId);
			isDelivered.push(params.senderId);
			members.push(tokenData.userId, params.contactUserId);
			let data: any = {
				_id: params.localMessageId,
				type: CHAT_TYPE.ONE_TO_ONE,
				senderId: params.senderId,
				members: members,
				chatId: params.chatId,
				message: params.message,
				mediaUrl: params.mediaUrl,
				messageType: params.messageType,
				isRead: isRead,
				isDelivered: isDelivered,
				thumbnailUrl: params.thumbnailUrl ? params.thumbnailUrl : null,
				location: params.location,
				size: params.size ? params.size : null,
				transcribe: params.transcribe ? params.transcribe : null,
				status: params.status,
				deletedBy: deletedBy,
				messageId: messageId[0]._id,
				blockedMessage: blockedMessage,
				imageRatio: params.imageRatio,
				localUrl: params.localUrl,
				contact: params.contact
			}
			let translatedInfo: any = {}
			if (SERVER.IS_TRANSLATION_ENABLE) {
				// translatedInfo = params.languageCode ? await translateMessage(params.languageCode, params.message, params.chatId, tokenData) : await autoTranslateMessage(params.message, params.chatId)
				// data.translatedMessages = translatedInfo.encryptedMessages;
				// data.langCodes = translatedInfo.langCodes;
				// data.userLang = translatedInfo.userLang;
			}
			const message = await baseDao.save("messages", data);
			if (SERVER.IS_TRANSLATION_ENABLE) {
				data.translatedMessages = translatedInfo.translatedMessages;
			}
			await baseDao.findOneAndUpdate("chats", {
				_id: params.chatId
			}, {
				lastMsgId: message._id,
				lastMsgCreated: Date.now(),
				deletedBy: []
			}, { new: true });
			const membersDetails = await userDaoV1.find("users", { _id: { $in: members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
			message.membersDetails = membersDetails;
			message.messageIdDetails = messageId;
			ack(message);
			const isSenderArchive = await this.checkChatArchiveStatus(tokenData.userId, params.chatId);
			const isReceiverArchive = await this.checkChatArchiveStatus(params.contactUserId, params.chatId);
			if (isBlocked) {
				socket.emit(`${params.chatId}`, {
					eventType: SOCKET.LISTNER_TYPE.MESSAGE.REPLIED,
					data: message
				});
				if (isSenderArchive) {
					// this.inboxArchive(io, socket, PAGINATION_DEFAULT, ack, { userId: tokenData.userId });
					this.refreshArchiveChatBox(io, socket, params, ack, { userId: tokenData.userId });
				} else {
					this.inboxChat(io, socket, PAGINATION_DEFAULT, ack, { userId: tokenData.userId });
					this.refreshChatBox(io, socket, params, ack, { userId: tokenData.userId });
				}
			} else {
				io.to(`${params.chatId}`).emit(`${params.chatId}`, {
					eventType: SOCKET.LISTNER_TYPE.MESSAGE.REPLIED,
					data: message
				});
				if (isSenderArchive) {
					// this.inboxArchive(io, socket, PAGINATION_DEFAULT, ack, { userId: tokenData.userId });
					this.refreshArchiveChatBox(io, socket, params, ack, { userId: tokenData.userId });
				} else {
					this.inboxChat(io, socket, PAGINATION_DEFAULT, ack, { userId: tokenData.userId });
					this.refreshChatBox(io, socket, params, ack, { userId: tokenData.userId });
				}
				let IsNotificationMuted = await this.checkforChatNotification(params.contactUserId, params.chatId);
				const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;// io.sockets.sockets.get(socket_user);
				const sender = await userDaoV1.findUserById(params.senderId);
				let notification_message = messageTypeInChat(params.messageType) != MESSAGE_TYPE.TEXT ? messageTypeInChat(params.messageType) : data.translatedMessages[`${contactUserId.languageCode}`] ? data.translatedMessages[`${contactUserId.languageCode}`] : params.message;
				console.log('***************************notification_message***************************', notification_message)
				if (contactUserIdSocket) {
					if (isReceiverArchive) {
						// this.inboxArchive(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: params.contactUserId });
						this.refreshArchiveChatBox(io, contactUserIdSocket, params, ack, { userId: params.contactUserId });
					} else {
						if (socket_user) {
							let roomParams = {
								chatId: params.chatId,
								socketId: socket_user
							};
							let IsNotification = await this.checkUserRoomInSocket(io, roomParams);
							if (!IsNotification) //TODO:notification service
							{
								let notificationData: ChatRequest.CHAT_NOTIFICATION = {
									type: NOTIFICATION_TYPE.CHAT_NOTIFICATION,
									title: sender?.name,
									message: data.translatedMessages[`${contactUserId.languageCode}`] ? data.translatedMessages[`${contactUserId.languageCode}`] : params.message,
									body: data.translatedMessages[`${contactUserId.languageCode}`] ? data.translatedMessages[`${contactUserId.languageCode}`] : params.message,
									details: {
										chatId: params.chatId,
										senderId: params.senderId,
										receiverId: params.contactUserId,
										receiverIdName: contactUserId?.name,
										messageType: params.messageType,
										profilePicture: sender?.profilePicture,
										countryCode: sender.countryCode,
										mobileNo: sender.mobileNo,
										fullMobileNo: sender?.fullMobileNo,
										type: CHAT_TYPE.ONE_TO_ONE,
										senderName: sender?.name,
										flagCode: sender?.flagCode,
										membersDetails: message.membersDetails ? message.membersDetails : {}
									}
								}
								console.log('***********notificationData*************', notificationData)
								if (!IsNotificationMuted) await this.sendChatNotification(contactUserIdSocket, notificationData);
							}
						}
						this.inboxChat(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: params.contactUserId });
						this.refreshChatBox(io, contactUserIdSocket, params, ack, { userId: params.contactUserId });
					}
				} else {
					let notificationDataDetails: ChatRequest.CHAT_NOTIFICATION = {
						type: NOTIFICATION_TYPE.CHAT_NOTIFICATION,
						title: sender?.name,
						message: notification_message,
						body: notification_message,
						details: {
							chatId: params.chatId,
							senderId: params.senderId,
							receiverId: params.contactUserId,
							receiverIdName: contactUserId?.name,
							messageType: params.messageType,
							profilePicture: sender?.profilePicture,
							countryCode: sender?.countryCode,
							mobileNo: sender?.mobileNo,
							fullMobileNo: sender?.fullMobileNo,
							type: CHAT_TYPE.ONE_TO_ONE,
							senderName: sender?.name,
							flagCode: sender?.flagCode,
							membersDetails: message.membersDetails ? message.membersDetails : {}
						}
					}

					let contact = await userDaoV1.findOne("contacts", { userId: notificationDataDetails.details.receiverId, contactUserId: notificationDataDetails.details.senderId }, { name: 1 });
					notificationDataDetails.title = contact?.name || notificationDataDetails.details.fullMobileNo;
					notificationDataDetails.details.senderName = contact?.name || notificationDataDetails.details.fullMobileNo;
					consolelog(`************Push notification details****************`, notificationDataDetails, true);
					const isSubscribedUser = await this.checkUserSubscription(notificationDataDetails.details.receiverId);
					if (isSubscribedUser.isSubscribed || isSubscribedUser?.expiryTime < Date.now()) {
						if (!IsNotificationMuted) await sendNotification(notificationDataDetails, socket.accessToken);
					}
				}
			}
			return true;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function leftRoom
	 * remove a user from existing room when he left a particular chat
	*/
	async leftRoom(io: any, socket: any, params: ChatRequest.REPLIED, ack: any, tokenData: TokenData) {
		try {
			if (!params.chatId) {
				ack(MESSAGES.ERROR.PARAMS_MISSING)
				return
			}
			const chatId = await baseDao.findOne("chats", { _id: params.chatId });
			if (!chatId) {
				ack(MESSAGES.ERROR.CHAT_NOT_FOUND)
			}
			socket.leave(`${params.chatId}`);
			ack(chatId);
			return true;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function chatList
	 */
	async chatList(params: ListingRequest, tokenData: TokenData) {
		try {
			const data = await chatDaoV1.chatList(params, tokenData);
			return MESSAGES.SUCCESS.LIST({ data });
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function refreshCuurentInboxChat
	 * refresh current background chat box list when someone message 
	*/
	async refreshChatBox(io: any, socket: any, params: ChatRequest.chatBox, ack: any, tokenData: TokenData, accessData: boolean = false) {
		try {
			consolelog(`${tokenData.userId} refreshChatBox emit timer`, Date.now(), true);
			const userId = tokenData.userId;
			const data: any = await chatDaoV1.chatBox(params, userId,);
			const unread_messages = await baseDao.aggregate("messages", [{
				$match: {
					chatId: toObjectId(params.chatId), members: toObjectId(tokenData.userId), "isRead": { $nin: [toObjectId(tokenData.userId)] }, deletedBy: { $nin: [toObjectId(userId)] }
				}
			}, {
				$group: {
					_id: "$chatId",
					countId: { $sum: 1 }
				}
			}]);
			if (data) {
				delete data.pageNo; delete data.totalPage; delete data.total;
			}
			const blockedMembers = await userDaoV1.findOne("users", { _id: tokenData.userId });
			const members = await chatDaoV1.distinct("chats", "overallMembers", { members: tokenData.userId, _id: params.chatId });
			// const contacts = await userDaoV1.find("contacts", { userId: tokenData.userId, contactUserId: { $in: members } }, { contactUserId: 1, name: 1 });
			if (unread_messages?.length && data.data?.length) {
				data.data.forEach((list: any) => {
					unread_messages.forEach((unread: any) => {
						if (list._id.toString() === unread._id.toString()) {
							list.unread_messages = unread.countId;
						}
					})
				})
			}
			if (data.data?.length) {
				for (const element of data.data) {
					for (const user of element.users) {
						if (blockedMembers?.blocked.length) {
							for (let block of blockedMembers.blocked) {
								if (block.toString() == user._id.toString()) {
									user.status = STATUS.BLOCKED
								}
							}
						}
					}
					for (const user of element.overAllMembersDetails) {
						if (blockedMembers?.blocked.length) {
							for (let block of blockedMembers.blocked) {
								if (block.toString() == user._id.toString()) {
									user.status = STATUS.BLOCKED
								}
							}
						}
					}
				}
			}
			const archive_count = await chatDaoV1.countDocuments("chats", {
				$or: [{
					"members": userId
				}, {
					"exitedBy": userId
				}],
				deletedBy: { $nin: [toObjectId(userId)] },
				acrhivedBy: toObjectId(userId),
				lastMsgId: { $exists: true },
				status: STATUS.ACTIVE,
				type: { $in: [CHAT_TYPE.ONE_TO_ONE, CHAT_TYPE.GROUP, CHAT_TYPE.COMMUNITY] }
			});
			data.archive_count = archive_count || 0
			data.status = STATUS.ACTIVE //chat status for not archived
			data.chat_type = STATUS.ACTIVE
			const notify_read = await baseDao.updateMany("messages", { members: toObjectId(tokenData.userId), deletedBy: { $nin: [toObjectId(tokenData.userId)] }, isDelivered: { $nin: [toObjectId(tokenData.userId)] } }, { $addToSet: { isDelivered: toObjectId(tokenData.userId) } }, {});
			if (notify_read?.modifiedCount > 0) {
				socket.broadcast.emit(SOCKET.LISTNER_TYPE.MESSAGE.READ, {
					userId: tokenData.userId
				})
			}
			socket.emit(SOCKET.LISTNER_TYPE.CHAT.REFRESH.INBOX_CHAT, MESSAGES.SUCCESS.LIST(data));
			consolelog(`${tokenData.userId} refreshChatBox delivered timer`, Date.now(), true);
			return
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function refreshCuurentInboxChat
	 * refresh current background chat box list when someone message 
	*/
	async refreshArchiveChatBox(io: any, socket: any, params: ChatRequest.chatBox, ack: any, tokenData: TokenData, accessData: boolean = false) {
		try {
			consolelog(`${tokenData.userId} refreshArchiveChatBox emit timer`, Date.now(), true);
			const userId = tokenData.userId;
			const data: any = await chatDaoV1.archiveChatBox(params, userId,);
			const unread_messages = await baseDao.aggregate("messages", [{
				$match: {
					chatId: toObjectId(params.chatId), members: toObjectId(tokenData.userId), "isRead": { $nin: [toObjectId(tokenData.userId)] }, deletedBy: { $nin: [toObjectId(userId)] }
				}
			}, {
				$group: {
					_id: "$chatId",
					countId: { $sum: 1 }
				}
			}]);
			if (data) {
				delete data.pageNo; delete data.totalPage; delete data.total;
			}
			const blockedMembers = await userDaoV1.findOne("users", { _id: tokenData.userId });
			const members = await chatDaoV1.distinct("chats", "overallMembers", { members: tokenData.userId, _id: params.chatId });
			// const contacts = await userDaoV1.find("contacts", { userId: tokenData.userId, contactUserId: { $in: members } }, { contactUserId: 1, name: 1 });
			if (unread_messages?.length && data.data?.length) {
				data.data.forEach((list: any) => {
					unread_messages.forEach((unread: any) => {
						if (list._id.toString() === unread._id.toString()) {
							list.unread_messages = unread.countId;
						}
					})
				})
			}
			if (data.data?.length) {
				for (const element of data.data) {
					for (const user of element.users) {
						if (blockedMembers?.blocked.length) {
							for (let block of blockedMembers.blocked) {
								if (block.toString() == user._id.toString()) {
									user.status = STATUS.BLOCKED
								}
							}
						}
					}
					for (const user of element.overAllMembersDetails) {
						if (blockedMembers?.blocked.length) {
							for (let block of blockedMembers.blocked) {
								if (block.toString() == user._id.toString()) {
									user.status = STATUS.BLOCKED
								}
							}
						}
					}
				}
			}
			const archive_count = await chatDaoV1.countDocuments("chats", {
				$or: [{
					"members": userId
				}, {
					"exitedBy": userId
				}],
				deletedBy: { $nin: [toObjectId(userId)] },
				acrhivedBy: toObjectId(userId),
				lastMsgId: { $exists: true },
				status: STATUS.ACTIVE,
				type: { $in: [CHAT_TYPE.ONE_TO_ONE, CHAT_TYPE.GROUP, CHAT_TYPE.COMMUNITY] }
			});
			data.archive_count = archive_count || 0
			data.status = STATUS.ARCHIVED //chat status archived
			data.chat_type = STATUS.ACTIVE
			const notify_read = await baseDao.updateMany("messages", { members: toObjectId(tokenData.userId), deletedBy: { $nin: [toObjectId(tokenData.userId)] }, isDelivered: { $nin: [toObjectId(tokenData.userId)] } }, { $addToSet: { isDelivered: toObjectId(tokenData.userId) } }, {});
			if (notify_read?.modifiedCount > 0) {
				socket.broadcast.emit(SOCKET.LISTNER_TYPE.MESSAGE.READ, {
					userId: tokenData.userId
				})
			}
			socket.emit(SOCKET.LISTNER_TYPE.CHAT.REFRESH.ARCHIVE_CHAT, MESSAGES.SUCCESS.LIST(data));
			consolelog(`${tokenData.userId} refreshChatBox delivered timer`, Date.now(), true);
			return;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function inboxChat
	 * get chat listing in home section for current users who he has chatted so far
	*/
	async inboxChat(io: any, socket: any, params: ListingRequest, ack: any, tokenData: TokenData, accessData: boolean = false) {
		try {
			consolelog(`${tokenData.userId} inboxChat emit timer`, Date.now(), true);
			params.pageNo = PAGINATION_DEFAULT.pageNo;
			params.limit = params.limit ? params.limit : PAGINATION_DEFAULT.limit;
			const userId = tokenData.userId;
			const data: any = await chatDaoV1.chatList(params, tokenData);
			let unreadMessages;
			if (tokenData.userType == USER_TYPE.USER) {
				unreadMessages = await baseDao.aggregate("messages", [{
					$match: {
						members: toObjectId(tokenData.userId), "isRead": { $nin: [toObjectId(tokenData.userId)] }, deletedBy: { $nin: [toObjectId(userId)] }
					}
				}, {
					$group: {
						_id: "$chatId",
						countId: { $sum: 1 }
					}
				}]);
			} else {
				unreadMessages = await baseDao.aggregate("messages", [{
					$match: {
						"isRead": { $nin: [toObjectId(tokenData.userId)] }, deletedBy: { $nin: [toObjectId(userId)] }
					}
				}, {
					$group: {
						_id: "$chatId",
						countId: { $sum: 1 }
					}
				}]);
			}

			console.log("unreadMessages", unreadMessages);
			if (data) {
				delete data.pageNo; delete data.totalPage; delete data.total;
			}
			const blockedMembers = await userDaoV1.findOne("users", { _id: tokenData.userId });
			const members = await chatDaoV1.distinct("chats", "overallMembers", { members: tokenData.userId });
			// const contacts= await userDaoV1.find("contacts", { userId: tokenData.userId, contactUserId: {$in:members} }, { contactUserId:1,name: 1 });
			if (unreadMessages?.length && data.data?.length) {
				data.data.forEach((list: any) => {
					unreadMessages.forEach((unread: any) => {
						if (list._id.toString() === unread._id.toString()) {
							list.unreadMessages = unread.countId;
						}
					})
				})
			}
			// if (data.data?.length) {
			// 	for (const element of data.data) {
			// 		for (const user of element.users) {
			// 			if (blockedMembers?.blocked.length) {
			// 				for (let block of blockedMembers.blocked) {
			// 					if (block.toString() == user._id.toString()) {
			// 						user.status = STATUS.BLOCKED
			// 					}
			// 				}
			// 			}
			// 		}
			// 		for (const user of element.overAllMembersDetails) {
			// 			if (blockedMembers?.blocked.length) {
			// 				for (let block of blockedMembers.blocked) {
			// 					if (block.toString() == user._id.toString()) {
			// 						user.status = STATUS.BLOCKED
			// 					}
			// 				}
			// 			}
			// 		}
			// 	}
			// }
			// const archive_count = await chatDaoV1.countDocuments("chats", {
			// 	$or: [{
			// 		"members": userId
			// 	}, {
			// 		"exitedBy": userId
			// 	}],
			// 	deletedBy: { $nin: [toObjectId(userId)] },
			// 	acrhivedBy: toObjectId(userId),
			// 	lastMsgId: { $exists: true },
			// 	status: STATUS.ACTIVE,
			// 	type: { $in: [CHAT_TYPE.ONE_TO_ONE, CHAT_TYPE.GROUP, CHAT_TYPE.COMMUNITY] }
			// });
			data.archive_count = 0
			// const msg_rqst_count = await baseDao.countDocuments("message_requests", {
			// 	status: { $eq: STATUS.PENDING },
			// 	$or: [
			// 		{ receiverId: { $eq: toObjectId(tokenData.userId) } },
			// 		{ senderId: { $eq: toObjectId(tokenData.userId) } }
			// 	]
			// })
			// data.msg_rqst_count = msg_rqst_count || 0
			// data.status = params.status || STATUS.ACTIVE //chat status archived
			// data.chat_type = params.type || STATUS.ACTIVE //chat broadcast case
			// const notify_read = await baseDao.updateMany("messages", { members: toObjectId(tokenData.userId), deletedBy: { $nin: [toObjectId(tokenData.userId)] }, isDelivered: { $nin: [toObjectId(tokenData.userId)] } }, { $addToSet: { isDelivered: toObjectId(tokenData.userId) } }, {});
			// if (notify_read?.modifiedCount > 0) {
			// 	socket.broadcast.emit(SOCKET.LISTNER_TYPE.MESSAGE.READ, {
			// 		userId: tokenData.userId
			// 	})
			// }
			socket.emit(SOCKET.LISTNER_TYPE.CHAT.LISTING, MESSAGES.SUCCESS.LIST(data));
			consolelog(`${tokenData.userId} inboxChat delivered timer`, Date.now(), true);
			if (accessData) {
				return
			}
			return ack(MESSAGES.SUCCESS.LIST(data))
		} catch (error) {
			console.log('Inbox Chat', error, "**");
			throw error;
		}
	}

	/**
 * @function inboxArchive
 * get chat listing in archive section for current users who he has chatted
*/
	// async inboxArchive(io: any, socket: any, params: ListingRequest, ack: any, tokenData: TokenData, accessData: boolean = false) {
	// 	try {
	// 		consolelog(`${tokenData.userId} inboxArchive emit timer`, Date.now(), true);
	// 		params.pageNo = PAGINATION_DEFAULT.pageNo;
	// 		params.limit = params.limit ? params.limit : PAGINATION_DEFAULT.limit;
	// 		const userId = tokenData.userId;
	// 		const data: any = await chatDaoV1.archiveChatList(params, userId,);
	// 		const unread_messages = await baseDao.aggregate("messages", [{
	// 			$match: {
	// 				members: toObjectId(tokenData.userId), "isRead": { $nin: [toObjectId(tokenData.userId)] }, deletedBy: { $nin: [toObjectId(userId)] }
	// 			}
	// 		}, {
	// 			$group: {
	// 				_id: "$chatId",
	// 				countId: { $sum: 1 }
	// 			}
	// 		}]);
	// 		if (data) {
	// 			delete data.pageNo; delete data.totalPage; delete data.total;
	// 		}
	// 		const blockedMembers = await userDaoV1.findOne("users", { _id: tokenData.userId });
	// 		const members = await chatDaoV1.distinct("chats", "overallMembers", { members: tokenData.userId });
	// 		// const contacts= await userDaoV1.find("contacts", { userId: tokenData.userId, contactUserId: {$in:members} }, { contactUserId:1,name: 1 });
	// 		if (unread_messages?.length && data.data?.length) {
	// 			data.data.forEach((list: any) => {
	// 				unread_messages.forEach((unread: any) => {
	// 					if (list._id.toString() === unread._id.toString()) {
	// 						list.unread_messages = unread.countId;
	// 					}
	// 				})
	// 			})
	// 		}
	// 		if (data.data?.length) {
	// 			for (const element of data.data) {
	// 				for (const user of element.users) {
	// 					if (blockedMembers?.blocked.length) {
	// 						for (let block of blockedMembers.blocked) {
	// 							if (block.toString() == user._id.toString()) {
	// 								user.status = STATUS.BLOCKED
	// 							}
	// 						}
	// 					}
	// 				}
	// 				for (const user of element.overAllMembersDetails) {
	// 					if (blockedMembers?.blocked.length) {
	// 						for (let block of blockedMembers.blocked) {
	// 							if (block.toString() == user._id.toString()) {
	// 								user.status = STATUS.BLOCKED
	// 							}
	// 						}
	// 					}
	// 				}
	// 			}
	// 		}
	// 		data.archive_count = 0
	// 		data.status = STATUS.ARCHIVED //chat status archived
	// 		const notify_read = await baseDao.updateMany("messages", { members: toObjectId(tokenData.userId), deletedBy: { $nin: [toObjectId(tokenData.userId)] }, isDelivered: { $nin: [toObjectId(tokenData.userId)] } }, { $addToSet: { isDelivered: toObjectId(tokenData.userId) } }, {});
	// 		if (notify_read?.modifiedCount > 0) {
	// 			socket.broadcast.emit(SOCKET.LISTNER_TYPE.MESSAGE.READ, {
	// 				userId: tokenData.userId
	// 			})
	// 		}
	// 		if (params.accessData) {
	// 			return data;
	// 		}
	// 		socket.emit(SOCKET.LISTNER_TYPE.CHAT.ARCHIVE_LIST, MESSAGES.SUCCESS.LIST(data));
	// 		consolelog(`${tokenData.userId} inboxArchive delivered timer`, Date.now(), true);
	// 		return ack(MESSAGES.SUCCESS.LIST(data))
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function updateDeliveredStatus
	 * update delivered message status when user comes online to other users
	*/
	async updateDeliveredStatus(socket: any, userId: string) {
		try {
			const notify_read = await baseDao.updateMany("messages", { members: { $in: [toObjectId(userId)] }, deletedBy: { $nin: [toObjectId(userId)] }, isDelivered: { $nin: [toObjectId(userId)] } }, { $addToSet: { isDelivered: toObjectId(userId) } }, {});
			// const notify_read_broadcast=await baseDao.updateMany("broadcast_messages", {members: {$in:[toObjectId(userId)]},deletedBy: { $nin: [toObjectId(userId)] }, isDelivered: { $nin: [toObjectId(userId)] } }, { $addToSet: { isDelivered: toObjectId(userId) } }, {});
			console.log('notify_read userId', notify_read, userId)
			if (notify_read?.nModified > 0) {
				socket.broadcast.emit(SOCKET.LISTNER_TYPE.MESSAGE.READ, {
					userId: userId
				})
			}
			socket.broadcast.emit(SOCKET.LISTNER_TYPE.MESSAGE.READ, {
				userId: userId
			})
			return
		} catch (error) {
			throw error
		}
	}

	/**
	 * @function liveTracking
	 * send live texting and audio recording events to user whom is chatting
	*/
	async liveTracking(io: any, socket: any, params: ChatRequest.Tracking, ack: any, tokenData: TokenData) {
		try {
			if (!params.chatId) {
				ack(MESSAGES.ERROR.PARAMS_MISSING)
				return
			}
			if (!params.isText) params.isText = false;
			const isChatExist = await chatDaoV1.findChatById(params.chatId);
			if (!isChatExist) {
				ack(MESSAGES.ERROR.CHAT_NOT_FOUND)
				return
			}
			const user = await userDaoV1.findUserById(tokenData.userId, { profilePicture: 1, name: 1, mobileNo: 1, countryCode: 1, about: 1, status: 1, flagCode: 1 })
			let contactUserId: string;
			if (isChatExist.members?.length) {
				isChatExist.members.forEach((id) => {
					if (id.toString() !== tokenData.userId.toString()) contactUserId = id;
				})
			}
			const isBlocked = await this.checkUserBlockedStatus(contactUserId, tokenData.userId)
			// const isBlocked = await userDaoV1.findOne("users", { _id: contactUserId, blocked: { $in: [toObjectId(tokenData.userId)] } });
			console.log('************isBlocked******************', isBlocked)
			if (isBlocked) return
			consolelog('__live_tracking contactUserId', contactUserId, false);
			const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + (contactUserId).toString() + REDIS_KEY_PREFIX.SOCKET_ID);
			consolelog('__live_tracking contactUserId in cache', contactUserId, false);
			const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;//io.sockets.sockets.get(socket_user);
			consolelog('__live_tracking contactUserId in scoket adapter', contactUserId, false);
			if (contactUserIdSocket) contactUserIdSocket.emit(SOCKET.LISTNER_TYPE.CHAT.TRACKING, {
				chatId: params.chatId,
				isText: params.isText,
				user: user
			});
			return
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function blockedUser
	 * block a user and update blocked list of existing users
	*/
	// async blockedUser(io: any, socket: any, params: ChatRequest.Blocked, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.contactUserId) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		const step1 = await userDaoV1.findUserById(params.contactUserId)
	// 		if (!step1) {
	// 			ack(MESSAGES.ERROR.USER_NOT_FOUND)
	// 			return
	// 		}
	// 		let user;
	// 		if (params.blocked) {
	// 			user = await userDaoV1.findByIdAndUpdate("users", tokenData.userId, { $addToSet: { blocked: toObjectId(params.contactUserId) } }, { new: true })
	// 			await redisClient.storeValue(SERVER.APP_NAME + "_" + tokenData.userId + "_" + params.contactUserId + REDIS_KEY_PREFIX.BLOCKED, Date.now());
	// 		} else {
	// 			user = await userDaoV1.findByIdAndUpdate("users", tokenData.userId, { $pull: { blocked: toObjectId(params.contactUserId) } }, { new: true })
	// 			await redisClient.deleteKey(SERVER.APP_NAME + "_" + tokenData.userId + "_" + params.contactUserId + REDIS_KEY_PREFIX.BLOCKED);
	// 		}
	// 		ack(MESSAGES.SUCCESS.DETAILS(user));
	// 		let members = [];
	// 		members.push(tokenData.userId, params.contactUserId);
	// 		const isExist = await chatDaoV1.isChatExists(members);
	// 		if (params.blocked) {
	// 			if (isExist) await chatDaoV1.findByIdAndUpdate("chats", isExist._id, { lastBlockedMsgId: isExist.lastMsgId }, {})
	// 		}
	// 		let listing = {}
	// 		const isArchive = await chatDaoV1.findOne("chats", { members: { $all: members }, type: CHAT_TYPE.ONE_TO_ONE, acrhivedBy: tokenData.userId });
	// 		if (isArchive) {
	// 			listing = {
	// 				status: STATUS.ARCHIVED
	// 			}
	// 			this.inboxChat(io, socket, listing, ack, { userId: tokenData.userId });
	// 		} else {
	// 			this.inboxChat(io, socket, listing, ack, { userId: tokenData.userId });
	// 			// this.refreshChatBox(io,socket,{chatId: isExist._id},ack,{userId: tokenData.userId});
	// 		}
	// 		// let oneToOneData = await this.chatFormation(io, socket, {
	// 		// 	contactUserId: params.contactUserId,
	// 		// 	accessData: true
	// 		// }, ack, tokenData);
	// 		// socket.emit(`${isExist._id}`, {
	// 		// 	eventType: SOCKET.LISTNER.ONE_TO_ONE,
	// 		// 	oneToOneData: oneToOneData
	// 		// });
	// 		const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + params.contactUserId + REDIS_KEY_PREFIX.SOCKET_ID);
	// 		if (socket_user) {
	// 			const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;//io.sockets.sockets.get(socket_user);
	// 			const contactUserId = await userDaoV1.findUserById(tokenData.userId);
	// 			const isBlocked = await this.checkUserBlockedStatus(params.contactUserId, tokenData.userId)
	// 			const isReceiverBlocked = await this.checkUserBlockedStatus(tokenData.userId, params.contactUserId);
	// 			let oneToOneDataDetails = {
	// 				chatId: isExist._id,
	// 				isBlocked: isBlocked ? true : false,
	// 				lastSeen: contactUserId?.lastSeen || 0,
	// 				countryCode: contactUserId?.countryCode,
	// 				mobileNo: contactUserId?.mobileNo,
	// 				language: contactUserId?.language,
	// 				profilePicture: contactUserId?.profilePicture,
	// 				flagCode: contactUserId?.flagCode,
	// 				name: contactUserId?.name,
	// 				isReceiverBlocked: isReceiverBlocked ? true : false,
	// 				isOnline: false
	// 			}
	// 			contactUserIdSocket.emit(`${isExist._id}`, {
	// 				eventType: SOCKET.LISTNER.ONE_TO_ONE,
	// 				oneToOneData: oneToOneDataDetails
	// 			});
	// 		}
	// 		return
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function checkUserOnlineStatus
	 * check for a user if its online or not
	*/
	async checkUserOnlineStatus(userId: string) {
		try {
			const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + userId + REDIS_KEY_PREFIX.SOCKET_ID);
			return socket_user
		} catch (error) {
			throw error;
		}
	}

	/**
 * @function checkUserOfflineOverallStatus
 * check for a user if its offline privacy on or not if yes both user will get offline status
*/
	async checkUserOfflineOverallStatus(userId: string, contactUserId: string) {
		try {
			consolelog(`${userId} ******************checkUserOfflineOverallStatus****************`, contactUserId, true);
			let userOfflineStatus = await redisClient.getValue(SERVER.APP_NAME + "_" + userId + REDIS_KEY_PREFIX.OFFLINE);
			let contactUserIdOfflineStatus = await redisClient.getValue(SERVER.APP_NAME + "_" + contactUserId + REDIS_KEY_PREFIX.OFFLINE);
			if (userOfflineStatus || contactUserIdOfflineStatus) {
				return true;
			}
			return false;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function checkUserOfflineOverallStatus
	 * check for a user if its offline privacy on or not if yes both user will get offline status
	*/
	async checkChatArchiveStatus(userId: string, chatId: string) {
		try {
			consolelog(`${userId} *****************checkChatArchiveStatus****************`, chatId, true);
			let archiveStatus = await redisClient.getValue(SERVER.APP_NAME + "_" + userId + "_" + chatId + REDIS_KEY_PREFIX.ARCHIVE);
			if (archiveStatus) {
				return true;
			}
			return false;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function checkUserBlockedStatus
	 * check for a user if contact user is blocked or not
	*/
	async checkUserBlockedStatus(userId: string, contactUserId: string) {
		try {
			consolelog(`${userId} *****************checkUserBlockedStatus****************`, contactUserId, true);
			let blockedStatus = await redisClient.getValue(SERVER.APP_NAME + "_" + userId + "_" + contactUserId + REDIS_KEY_PREFIX.BLOCKED);
			if (blockedStatus) {
				return true;
			}
			return false;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function findSocketForUser
	 * find socket of a user if its present
	*/
	async findSocketForUser(io: any, socket_user: string) {
		try {
			const contactUserIdSocket = io.sockets.sockets.get(socket_user);
			return contactUserIdSocket
		} catch (error) {
			throw error;
		}
	}

	/**
 * @function sendSocketEvents
 * emit socket events to a user
*/
	async sendSocketEvents(socket: any, eventName: string, data: any) {
		try {
			return socket.emit(eventName, data);
		} catch (error) {
			throw error;
		}
	}




	/**
	 * @function reportUser
	 * report a user from for chats
	*/
	// async reportUser(io: any, socket: any, params: ChatRequest.REPORT, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.contactUserId || !params.reason) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		const step1 = await userDaoV1.findUserById(params.contactUserId)
	// 		if (!step1) {
	// 			ack(MESSAGES.ERROR.USER_NOT_FOUND)
	// 			return
	// 		}
	// 		let members = [];
	// 		members.push(tokenData.userId, params.contactUserId);
	// 		let isExist = await chatDaoV1.isChatExists(members);
	// 		let data = {
	// 			type: CHAT_REPORT_TYPE.USER,
	// 			reportedBy: tokenData.userId,
	// 			reportedUser: params.contactUserId,
	// 			reason: params.reason,
	// 			chatId: isExist._id,
	// 			chatType: CHAT_TYPE.ONE_TO_ONE
	// 		}
	// 		const report = await baseDao.save("chat_report", data);
	// 		return ack(MESSAGES.SUCCESS.DETAILS(report));
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function reportMessage
	 * report a message in a chat room
	*/
	// async reportMessage(io: any, socket: any, params: ChatRequest.MESSAGE, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.messageId) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		const messageId = await baseDao.findOne("messages", { _id: params.messageId });
	// 		if (!messageId) {
	// 			ack(MESSAGES.ERROR.MESSAGE_NOT_FOUND)
	// 		}
	// 		let data = {
	// 			type: CHAT_REPORT_TYPE.MESSAGE,
	// 			reportedBy: tokenData.userId,
	// 			reportedUser: messageId.senderId,
	// 			chatId: messageId.chatId,
	// 			messageId: params.messageId,
	// 			chatType: messageId.type
	// 		}
	// 		const report = await baseDao.save("chat_report", data);
	// 		return ack(MESSAGES.SUCCESS.DETAILS(report));
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function acrhiveChat
	 * update a chat to a archive & unarchive with key params
	*/
	// async acrhiveChat(io: any, socket: any, params: ChatRequest.ARCHIVE, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.chatId) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		const isChatExist = await chatDaoV1.findChatById(params.chatId);
	// 		if (!isChatExist) {
	// 			ack(MESSAGES.ERROR.CHAT_NOT_FOUND)
	// 			return
	// 		}
	// 		let chat: any;
	// 		if (params.isArchive) {
	// 			chat = await chatDaoV1.findByIdAndUpdate("chats", params.chatId, { $addToSet: { acrhivedBy: toObjectId(tokenData.userId) } }, { new: true });
	// 			await redisClient.storeValue(SERVER.APP_NAME + "_" + tokenData.userId + "_" + params.chatId + REDIS_KEY_PREFIX.ARCHIVE, Date.now());
	// 		} else {
	// 			chat = await chatDaoV1.findByIdAndUpdate("chats", params.chatId, { $pull: { acrhivedBy: toObjectId(tokenData.userId) } }, { new: true });
	// 			await redisClient.deleteKey(SERVER.APP_NAME + "_" + tokenData.userId + "_" + params.chatId + REDIS_KEY_PREFIX.ARCHIVE);
	// 		}
	// 		ack(MESSAGES.SUCCESS.DETAILS(chat));
	// 		let listing = {}
	// 		if (!params.isArchive) {
	// 			listing = {
	// 				status: STATUS.ARCHIVED
	// 			}
	// 		}
	// 		if (params.isArchive) {
	// 			this.inboxChat(io, socket, listing, ack, { userId: tokenData.userId });
	// 		} else {
	// 			this.inboxArchive(io, socket, listing, ack, { userId: tokenData.userId });
	// 		}
	// 		return
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function setWallpaper
	 * set chat room wallpaper for particular user in a room and overall room
	*/
	// async setWallpaper(io: any, socket: any, params: ChatRequest.WALLPAPER, ack: any, tokenData: TokenData) {
	// 	try {
	// 		let chat: any;
	// 		if (!params.overall) params.overall = false;
	// 		if (params.chatId) {
	// 			await chatDaoV1.findByIdAndUpdate("chats", params.chatId, { $pull: { wallpaper: { userId: tokenData.userId } } }, { new: true })
	// 			chat = await chatDaoV1.findByIdAndUpdate("chats", params.chatId, { $push: { wallpaper: { userId: tokenData.userId, url: params.url } } }, { new: true });
	// 		} else {
	// 			await chatDaoV1.updateMany("chats", { members: { $in: tokenData.userId } }, { $pull: { wallpaper: { userId: tokenData.userId } } }, {})
	// 			chat = await chatDaoV1.updateMany("chats", { members: { $in: tokenData.userId } }, { $push: { wallpaper: { userId: tokenData.userId, url: params.url } } }, {});
	// 		}
	// 		return ack(MESSAGES.SUCCESS.DETAILS(chat));
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function setUserLanguage
	 * set user language for chat room
	*/
	async setUserLanguage(userIds: string[]) {
		try {
			let langCodes = [], userLang = [];
			const step1 = await baseDao.find("users", { _id: { $in: userIds } }, { _id: 1, languageCode: 1 })
			for (let i = 0; i < step1.length; i++) {
				userLang.push({
					userId: step1[i]._id,
					languageCode: step1[i].languageCode || LANGUAGE_CODE.EN
				})
				langCodes.push(step1[i].languageCode || LANGUAGE_CODE.EN)
			}
			langCodes = [...new Set(langCodes)];
			return { langCodes, userLang }
		} catch (error) {
			throw error;
		}
	}

	// /**
	//  * @function createGroup
	//  * create a group for coming users in params
	//  * created group user joined the room and default admin of group
	//  * notify other members for group creation in chat list
	// */
	// async createGroup(io: any, socket: any, params: ChatRequest.CREATE_GROUP, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.contactUserIds) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		let admins = [];
	// 		admins.push(tokenData.userId);
	// 		params.contactUserIds.push(tokenData.userId);

	// 		const user = await baseDao.findOne("users", {
	// 			_id: toObjectId(tokenData.userId)
	// 		},
	// 			{ isSubscribed: 1 }
	// 		);

	// 		let subscriptionConfig = await baseDao.findOne("subscription_configs", { name: SUBSCRIPTION_CONFIG.DEFAULT })
	// 		if (!user?.isSubscribed) {
	// 			subscriptionConfig = await baseDao.findOne("subscription_configs", { name: SUBSCRIPTION_CONFIG.FREE })
	// 		}
	// 		let endTime
	// 		if (params.isScheduled) {
	// 			const scheduledCallLimit = subscriptionConfig ? subscriptionConfig.scheduledCallLimitInSeconds : DEFAULT_CONFIG.scheduledCallLimitInSeconds
	// 			endTime = params.endTime || new Date(new Date(params.startTime).getTime() + Number(scheduledCallLimit) * 1000)
	// 		}
	// 		let data: any = {
	// 			type: CHAT_TYPE.GROUP,
	// 			members: params.contactUserIds,
	// 			overallMembers: params.contactUserIds,
	// 			createdBy: tokenData.userId,
	// 			name: params.name,
	// 			description: params.description,
	// 			groupProfilePicture: params.groupProfilePicture,
	// 			admins: admins,
	// 			isScheduled: params.isScheduled,
	// 			startTime: params.startTime,
	// 			endTime: endTime
	// 		}
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			const chatUserInfo = await this.setUserLanguage(params.contactUserIds)
	// 			data.userLang = chatUserInfo.userLang;
	// 			data.langCodes = chatUserInfo.langCodes;
	// 		}
	// 		let group = await chatDaoV1.save("chats", data);
	// 		socket.join(`${group._id}`);
	// 		/*save header msg */
	// 		let details: any = {}, taggedUser = [];
	// 		details.languageCode = LANGUAGE_CODE.EN;
	// 		details.message = CHAT_HEADERS.GROUP.CREATE(tokenData.userId, params.name);
	// 		taggedUser.push(tokenData.userId)
	// 		let isRead = [], isDelivered = [];
	// 		isRead.push(tokenData.userId);
	// 		isDelivered.push(tokenData.userId);
	// 		let save: any = {
	// 			type: CHAT_TYPE.GROUP,
	// 			senderId: tokenData.userId,
	// 			members: group.members,
	// 			chatId: group._id,
	// 			message: details.message,
	// 			mediaUrl: null,
	// 			// messageType: MESSAGE_TYPE.HEADING,
	// 			isRead: isRead,
	// 			isDelivered: isDelivered,
	// 			thumbnailUrl: details.thumbnailUrl ? details.thumbnailUrl : null,
	// 			location: null,
	// 			size: details.size ? details.size : null,
	// 			transcribe: details.transcribe ? details.transcribe : null,
	// 			status: STATUS.ACTIVE,
	// 			taggedUser: taggedUser,
	// 			contact: null,
	// 		}
	// 		let translatedInfo: any = {}
	// 		// if (SERVER.IS_TRANSLATION_ENABLE) {
	// 		// 	translatedInfo = await translateMessage(details.languageCode, details.message, group._id, tokenData, false)
	// 		// 	save.translatedMessages = translatedInfo.encryptedMessages;
	// 		// 	save.langCodes = translatedInfo.langCodes;
	// 		// 	save.userLang = translatedInfo.userLang;
	// 		// }
	// 		const header_messages = await baseDao.save("messages", save);
	// 		// if (SERVER.IS_TRANSLATION_ENABLE) {
	// 		// 	data.translatedMessages = translatedInfo.translatedMessages;
	// 		// }
	// 		/*end of saving header msg*/
	// 		group = await baseDao.findOneAndUpdate("chats", {
	// 			_id: group._id
	// 		}, {
	// 			lastMsgId: header_messages._id,
	// 			lastMsgCreated: Date.now()
	// 		}, { new: true });
	// 		delete group.overallMembers;
	// 		const membersDetails = await userDaoV1.find("users", { _id: { $in: group.members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 		group.membersDetails = membersDetails;
	// 		ack(MESSAGES.SUCCESS.DETAILS(group));
	// 		this.inboxChat(io, socket, {}, ack, { userId: tokenData.userId });
	// 		// this.refreshChatBox(io,socket,{chatId: group._id},ack,{userId: tokenData.userId});
	// 		const sender = await userDaoV1.findUserById(tokenData.userId);
	// 		let message = CHAT_HEADERS.GROUP.ADD_NOTIFY(tokenData.userId);

	// 		if (params.isScheduled) {
	// 			message = CHAT_HEADERS.GROUP.ADD_NOTIFY_SCHEDULED(+new Date(params.startTime));
	// 			console.log(`Start Time: ${new Date(params.startTime).getTime()}, current time: ${new Date().getTime()}`)
	// 		}

	// 		// if (SERVER.IS_TRANSLATION_ENABLE) {
	// 		// 	const translatedInfo = await translateMessage(details.languageCode, message, group._id, tokenData, false)
	// 		// 	save.translatedMessages = translatedInfo.translatedMessages;
	// 		// 	save.langCodes = translatedInfo.langCodes;
	// 		// 	save.userLang = translatedInfo.userLang;
	// 		// }

	// 		for (let user of params.contactUserIds) {
	// 			let IsNotificationMuted = await this.checkforChatNotification(user, group._id);
	// 			const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + user + REDIS_KEY_PREFIX.SOCKET_ID);
	// 			if (socket_user) {
	// 				const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;//io.sockets.sockets.get(socket_user);
	// 				if (contactUserIdSocket) {
	// 					if (user.toString() !== tokenData.userId.toString()) {
	// 						await this.triggerGroupNotification(true, params, socket_user, sender, user, io, group, save, socket, contactUserIdSocket, IsNotificationMuted, params.isScheduled)
	// 					}
	// 					this.inboxChat(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: user });
	// 					// this.refreshChatBox(io,contactUserIdSocket,{chatId: group._id},ack,{userId: user});
	// 				}
	// 			} else {
	// 				if (user.toString() !== tokenData.userId.toString()) {
	// 					await this.triggerGroupNotification(false, params, socket_user, sender, user, io, group, save, socket, {}, IsNotificationMuted, params.isScheduled)
	// 				}
	// 			}
	// 		}
	// 		return
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }


	async triggerGroupNotification(online: boolean, params: any, socket_user: any, sender: any, user: any, io: any, group: any, data: any, socket: any, contactUserIdSocket: any, IsNotificationMuted: boolean, scheduledCallNotification?: boolean) {
		try {
			let scheduledTimeNotification
			if (group.isScheduled) {
				scheduledTimeNotification = `[UNIXTIME]${+new Date(group.startTime)}[/UNIXTIME]`
			}

			if (online) {
				let roomParams: ChatRequest.SOKCET_ROOM = {
					chatId: group._id,
					socketId: socket_user
				};
				let IsNotification = await this.checkUserRoomInSocket(io, roomParams);

				if (!IsNotification) //TODO:notification service
				{
					let contact = await userDaoV1.findOne("contacts", { userId: user, contactUserId: socket.userId }, { name: 1 });
					let senderName = contact?.name || sender?.name;
					const contactUserId = await userDaoV1.findUserById(user);

					let message = (data.translatedMessages[`${contactUserId.languageCode}`] ? senderName + " " + data.translatedMessages[`${contactUserId.languageCode}`] : senderName + "" + params.message).trim();

					if (scheduledCallNotification && params.isScheduled && scheduledTimeNotification) {
						message += ` ${scheduledTimeNotification}`
					}

					let notificationData: ChatRequest.CHAT_NOTIFICATION = {
						type: NOTIFICATION_TYPE.CHAT_NOTIFICATION,
						title: senderName,
						subtitle: group?.name,
						message: message,
						body: message,
						details: {
							chatId: group._id,
							senderId: socket.userId,
							receiverId: user.toString(),
							receiverIdName: contactUserId?.name,
							messageType: MESSAGE_TYPE.TEXT,
							profilePicture: group?.groupProfilePicture,
							countryCode: sender.countryCode,
							mobileNo: sender.mobileNo,
							fullMobileNo: sender?.fullMobileNo,
							type: CHAT_TYPE.GROUP,
							senderName: group?.name,
							flagCode: sender?.flagCode,
							membersDetails: group.membersDetails ? group.membersDetails : {},
							startTime: group.startTime ? group.startTime : null,
							endTime: group.endTime ? group.endTime : null,
							isScheduled: group.isScheduled ? group.isScheduled : null,
						}
					}
					console.log('********** sendGroupMessage notificationData*************', notificationData);
					if (!IsNotificationMuted) await this.sendSocketEvents(contactUserIdSocket, SOCKET.LISTNER_TYPE.NOTIFY.NOTIFICATION, notificationData)
				}
			} else {
				let contact = await userDaoV1.findOne("contacts", { userId: user, contactUserId: socket.userId }, { name: 1 });
				let senderName = contact?.name || sender?.fullMobileNo
				const contactUserId = await userDaoV1.findUserById(user);
				let message = (data.translatedMessages[`${contactUserId.languageCode}`] ? senderName + " " + data.translatedMessages[`${contactUserId.languageCode}`] : senderName + "" + params.message).trim();

				if (scheduledCallNotification && params.isScheduled && scheduledTimeNotification) {
					message += ` ${scheduledTimeNotification}`
				}

				let notificationData: ChatRequest.CHAT_NOTIFICATION = {
					type: NOTIFICATION_TYPE.CHAT_NOTIFICATION,
					title: senderName,
					subtitle: group?.name,
					message: message,
					body: message,
					details: {
						chatId: group?._id,
						senderId: socket.userId,
						receiverId: user.toString(),
						receiverIdName: contactUserId?.name,
						messageType: MESSAGE_TYPE.TEXT,
						profilePicture: group?.groupProfilePicture,
						countryCode: sender.countryCode,
						mobileNo: sender.mobileNo,
						fullMobileNo: sender?.fullMobileNo,
						type: CHAT_TYPE.GROUP,
						senderName: group?.name,
						flagCode: sender?.flagCode,
						membersDetails: group.membersDetails ? group.membersDetails : {},
						startTime: group.startTime ? group.startTime : null,
						endTime: group.endTime ? group.endTime : null,
						isScheduled: group.isScheduled ? group.isScheduled : null,
					}
				}
				console.log('********** sendGroupMessage push notificationData*************', notificationData);
				const isSubscribedUser = await this.checkUserSubscription(notificationData.details.receiverId);
				if (isSubscribedUser.isSubscribed || isSubscribedUser?.expiryTime < Date.now()) {
					if (!IsNotificationMuted) await sendNotification(notificationData, socket.accessToken);
				}
			}
		} catch (error) {
			throw error
		}
	}

	async triggerCommunityNotification(online: boolean, params: any, socket_user: any, sender: any, user: any, io: any, group: any, data: any, socket: any, contactUserIdSocket: any, IsNotificationMuted: boolean, scheduledCallNotification?: boolean) {
		try {
			let scheduledTimeNotification
			if (group.isScheduled) {
				scheduledTimeNotification = `[UNIXTIME]${+new Date(group.startTime)}[/UNIXTIME]`
			}

			if (online) {
				let roomParams: ChatRequest.SOKCET_ROOM = {
					chatId: group._id,
					socketId: socket_user
				};
				let IsNotification = await this.checkUserRoomInSocket(io, roomParams);

				if (!IsNotification) //TODO:notification service
				{
					let contact = await userDaoV1.findOne("contacts", { userId: user, contactUserId: socket.userId }, { name: 1 });
					let senderName = contact?.name || sender?.name;
					const contactUserId = await userDaoV1.findUserById(user);

					let message = (data.translatedMessages[`${contactUserId.languageCode}`] ? senderName + " " + data.translatedMessages[`${contactUserId.languageCode}`] : senderName + "" + params.message).trim();

					if (scheduledCallNotification && params.isScheduled && scheduledTimeNotification) {
						message += ` ${scheduledTimeNotification}`
					}

					let notificationData: ChatRequest.CHAT_NOTIFICATION = {
						type: NOTIFICATION_TYPE.CHAT_NOTIFICATION,
						title: senderName,
						subtitle: group?.name,
						message: message,
						body: message,
						details: {
							chatId: group._id,
							senderId: socket.userId,
							receiverId: user.toString(),
							receiverIdName: contactUserId?.name,
							messageType: MESSAGE_TYPE.TEXT,
							profilePicture: group?.groupProfilePicture,
							countryCode: sender.countryCode,
							mobileNo: sender.mobileNo,
							fullMobileNo: sender?.fullMobileNo,
							type: CHAT_TYPE.COMMUNITY,
							senderName: group?.name,
							flagCode: sender?.flagCode,
							membersDetails: group.membersDetails ? group.membersDetails : {},
							startTime: group.startTime ? group.startTime : null,
							endTime: group.endTime ? group.endTime : null,
							isScheduled: group.isScheduled ? group.isScheduled : null,
						}
					}
					console.log('********** sendGroupMessage notificationData*************', notificationData);
					if (!IsNotificationMuted) await this.sendSocketEvents(contactUserIdSocket, SOCKET.LISTNER_TYPE.NOTIFY.NOTIFICATION, notificationData)
				}
			} else {
				let contact = await userDaoV1.findOne("contacts", { userId: user, contactUserId: socket.userId }, { name: 1 });
				let senderName = contact?.name || sender?.fullMobileNo
				const contactUserId = await userDaoV1.findUserById(user);
				let message = (data.translatedMessages[`${contactUserId.languageCode}`] ? senderName + " " + data.translatedMessages[`${contactUserId.languageCode}`] : senderName + "" + params.message).trim();

				if (scheduledCallNotification && params.isScheduled && scheduledTimeNotification) {
					message += ` ${scheduledTimeNotification}`
				}

				let notificationData: ChatRequest.CHAT_NOTIFICATION = {
					type: NOTIFICATION_TYPE.CHAT_NOTIFICATION,
					title: senderName,
					subtitle: group?.name,
					message: message,
					body: message,
					details: {
						chatId: group?._id,
						senderId: socket.userId,
						receiverId: user.toString(),
						receiverIdName: contactUserId?.name,
						messageType: MESSAGE_TYPE.TEXT,
						profilePicture: group?.groupProfilePicture,
						countryCode: sender.countryCode,
						mobileNo: sender.mobileNo,
						fullMobileNo: sender?.fullMobileNo,
						type: CHAT_TYPE.COMMUNITY,
						senderName: group?.name,
						flagCode: sender?.flagCode,
						membersDetails: group.membersDetails ? group.membersDetails : {},
						startTime: group.startTime ? group.startTime : null,
						endTime: group.endTime ? group.endTime : null,
						isScheduled: group.isScheduled ? group.isScheduled : null,
					}
				}
				console.log('********** sendCommunityMessage push notificationData*************', notificationData);
				const isSubscribedUser = await this.checkUserSubscription(notificationData.details.receiverId);
				if (isSubscribedUser.isSubscribed || isSubscribedUser?.expiryTime < Date.now()) {
					if (!IsNotificationMuted) await sendNotification(notificationData, socket.accessToken);
				}
			}
		} catch (error) {
			throw error
		}
	}

	// /**
	//  * @function createGroup
	//  * edit name, description, groupProfilePicture with groupId
	//  * edit a group for new coming users in params
	// */
	// async editGroup(io: any, socket: any, params: ChatRequest.EDIT_GROUP, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.groupId) {
	// 			return ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 		}
	// 		let group, members = [];
	// 		group = await chatDaoV1.findOne("chats", { _id: params.groupId, type: CHAT_TYPE.GROUP, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!group) return ack(MESSAGES.ERROR.GROUP_NOT_FOUND);
	// 		const user = await baseDao.findOne("users", {
	// 			_id: toObjectId(tokenData.userId)
	// 		},
	// 			{ isSubscribed: 1 }
	// 		);

	// 		let subscriptionConfig = await baseDao.findOne("subscription_configs", { name: SUBSCRIPTION_CONFIG.DEFAULT })
	// 		if (!user?.isSubscribed) {
	// 			subscriptionConfig = await baseDao.findOne("subscription_configs", { name: SUBSCRIPTION_CONFIG.FREE })
	// 		}
	// 		let endTime
	// 		if (params.isScheduled) {
	// 			const scheduledCallLimit = subscriptionConfig ? subscriptionConfig.scheduledCallLimitInSeconds : DEFAULT_CONFIG.scheduledCallLimitInSeconds
	// 			endTime = params.endTime || new Date(new Date(params.startTime).getTime() + Number(scheduledCallLimit) * 1000)
	// 		}
	// 		let data: any = {
	// 			name: params.name ? params.name : group.name,
	// 			description: params.description ? params.description : group.description,
	// 			groupProfilePicture: params.groupProfilePicture != "" ? params.groupProfilePicture : "",
	// 		}

	// 		if (params.isScheduled) {
	// 			data = {
	// 				...data,
	// 				startTime: params.startTime,
	// 				endTime: endTime
	// 			}
	// 		}

	// 		if (params.name && params.name !== group.name) {
	// 			await this.updateHeaderForGroup(io, params, group, tokenData, CHAT_MODE_TYPE.NAME, socket, ack)
	// 		}
	// 		if (params.description && params.description !== group.description) {
	// 			await this.updateHeaderForGroup(io, params, group, tokenData, CHAT_MODE_TYPE.DESCRIPTION, socket, ack)
	// 		}
	// 		if (params.groupProfilePicture && params.groupProfilePicture !== group.groupProfilePicture) {
	// 			await this.updateHeaderForGroup(io, params, group, tokenData, CHAT_MODE_TYPE.ICON, socket, ack)
	// 		}
	// 		if (params.groupProfilePicture == "" && params.groupProfilePicture !== group.groupProfilePicture) {
	// 			await this.updateHeaderForGroup(io, params, group, tokenData, CHAT_MODE_TYPE.REMOVE_ICON, socket, ack)
	// 		}
	// 		// call reschedule
	// 		if (params.isScheduled) {
	// 			const updated_group_members = await chatDaoV1.findOne("chats", { _id: params.groupId });
	// 			let isRead = [], isDelivered = [];
	// 			isRead.push(tokenData.userId);
	// 			isDelivered.push(tokenData.userId);
	// 			let details: any = {}, taggedUser: any = [];
	// 			details.languageCode = LANGUAGE_CODE.EN;
	// 			details.message = CHAT_HEADERS.GROUP.UPDATE_NOTIFY_SCHEDULED(+new Date(params.startTime));
	// 			let save: any = {
	// 				type: CHAT_TYPE.GROUP,
	// 				senderId: tokenData.userId,
	// 				members: updated_group_members.members,
	// 				chatId: group._id,
	// 				message: details.message,
	// 				mediaUrl: null,
	// 				// messageType: MESSAGE_TYPE.HEADING,
	// 				isRead: isRead,
	// 				isDelivered: isDelivered,
	// 				thumbnailUrl: details.thumbnailUrl ? details.thumbnailUrl : null,
	// 				location: null,
	// 				size: details.size ? details.size : null,
	// 				transcribe: details.transcribe ? details.transcribe : null,
	// 				status: STATUS.ACTIVE,
	// 				taggedUser: taggedUser,
	// 				contact: null
	// 			}

	// 			// if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			// 	const translatedInfo = await translateMessage(details.languageCode, details.message, group._id, tokenData, false)
	// 			// 	save.translatedMessages = translatedInfo.translatedMessages;
	// 			// 	save.langCodes = translatedInfo.langCodes;
	// 			// 	save.userLang = translatedInfo.userLang;
	// 			// }


	// 			if (params.startTime !== group.startTime) {

	// 				console.log(`Start Time: ${new Date(params.startTime).getTime()}, current time: ${new Date().getTime()}`)
	// 				await this.updateHeaderForGroup(io, params, group, tokenData, CHAT_MODE_TYPE.UPDATE_SCHEDULED_CALL_START_TIME, socket, ack)
	// 			}
	// 			if (params.endTime !== group.endTime) {
	// 				await this.updateHeaderForGroup(io, params, group, tokenData, CHAT_MODE_TYPE.UPDATE_SCHEDULED_CALL_END_TIME, socket, ack)
	// 			}

	// 			const sender = await userDaoV1.findUserById(tokenData.userId);
	// 			for (let user of updated_group_members.members) {
	// 				let IsNotificationMuted = await this.checkforChatNotification(user, group._id);
	// 				const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + user + REDIS_KEY_PREFIX.SOCKET_ID);
	// 				if (socket_user) {
	// 					const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;// io.sockets.sockets.get(socket_user);
	// 					if (contactUserIdSocket) {
	// 						if (user.toString() !== tokenData.userId.toString()) {
	// 							await this.triggerGroupNotification(true, params, socket_user, sender, user, io, group, save, socket, contactUserIdSocket, IsNotificationMuted, params.isScheduled)
	// 						}
	// 						this.inboxChat(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: user });
	// 						// this.refreshChatBox(io,contactUserIdSocket,{chatId: group._id},ack,{userId: user});
	// 					}
	// 				} else {
	// 					if (user.toString() !== tokenData.userId.toString()) {
	// 						await this.triggerGroupNotification(false, params, socket_user, sender, user, io, group, save, socket, {}, IsNotificationMuted, params.isScheduled)
	// 					}
	// 				}
	// 			}
	// 		}

	// 		group = await chatDaoV1.findOneAndUpdate("chats", { _id: params.groupId }, data, { new: true });
	// 		if (params.contactUserIds?.length) {
	// 			const isAdmin = await chatDaoV1.findOne("chats", { _id: params.groupId, admins: { $in: [tokenData.userId] } });
	// 			// if (!isAdmin) return ack(MESSAGES.ERROR.UNAUTHORIZE_ADMIN_MEMBERS);
	// 			const updated_group_members = await chatDaoV1.findOneAndUpdate("chats", { _id: params.groupId }, { $addToSet: { members: params.contactUserIds, overallMembers: params.contactUserIds } }, { new: true });
	// 			/* save header message */
	// 			for (let i = 0; i < group.members.length; i++) {
	// 				members.push(group.members[i].toString())
	// 			}
	// 			console.log('members', members)
	// 			let addedMembers = diffBw2Arrays(params.contactUserIds, members);
	// 			console.log('editGroup addedMembers list', addedMembers)
	// 			// if(SERVER.IS_TRANSLATION_ENABLE){
	// 			// 	const toUpdate:any={}
	// 			// 	const chatUserInfo = await this.setUserLanguage(addedMembers)
	// 			// 	toUpdate["$addToSet"]={
	// 			// 		userLang :chatUserInfo.userLang,
	// 			// 		langCodes : chatUserInfo.langCodes
	// 			// 	}
	// 			// 	await chatDaoV1.findOneAndUpdate("chats",{_id:params.groupId},toUpdate)
	// 			// }
	// 			let details: any = {}, taggedUser: any = [];
	// 			details.languageCode = LANGUAGE_CODE.EN;
	// 			taggedUser.push(...addedMembers, tokenData.userId);
	// 			let contactUserIds = addedMembers.map(i => ' @' + i)
	// 			console.log('********editGroup contactUserIds ********', contactUserIds);
	// 			details.message = CHAT_HEADERS.GROUP.ADD(tokenData.userId, contactUserIds.join(" ,"));
	// 			let isRead = [], isDelivered = [];
	// 			isRead.push(tokenData.userId);
	// 			isDelivered.push(tokenData.userId);
	// 			let save: any = {
	// 				type: CHAT_TYPE.GROUP,
	// 				senderId: tokenData.userId,
	// 				members: updated_group_members.members,
	// 				chatId: group._id,
	// 				message: details.message,
	// 				mediaUrl: null,
	// 				// messageType: MESSAGE_TYPE.HEADING,
	// 				isRead: isRead,
	// 				isDelivered: isDelivered,
	// 				thumbnailUrl: details.thumbnailUrl ? details.thumbnailUrl : null,
	// 				location: null,
	// 				size: details.size ? details.size : null,
	// 				transcribe: details.transcribe ? details.transcribe : null,
	// 				status: STATUS.ACTIVE,
	// 				taggedUser: taggedUser,
	// 				contact: null
	// 			}
	// 			let translatedInfo: any = {}
	// 			if (SERVER.IS_TRANSLATION_ENABLE) {
	// 				// const translatedInfo = await translateMessage(details.languageCode, details.message, group._id, tokenData, false)
	// 				// save.translatedMessages = translatedInfo.encryptedMessages;
	// 				// save.langCodes = translatedInfo.langCodes;
	// 				// save.userLang = translatedInfo.userLang;
	// 			}
	// 			const header_messages = await baseDao.save("messages", save);
	// 			if (SERVER.IS_TRANSLATION_ENABLE) {
	// 				save.translatedMessages = translatedInfo.translatedMessages;
	// 			}
	// 			/*end of saving header msg*/
	// 			group = await baseDao.findOneAndUpdate("chats", {
	// 				_id: group._id
	// 			}, {
	// 				lastMsgId: header_messages._id,
	// 				lastMsgCreated: Date.now(),
	// 				$pull: { deletedBy: { $in: addedMembers }, exitedBy: { $in: addedMembers } }
	// 			}, { new: true });
	// 			const membersDetails = await userDaoV1.find("users", { _id: { $in: group.members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 			header_messages.membersDetails = membersDetails;
	// 			ack(MESSAGES.SUCCESS.DETAILS(updated_group_members));
	// 			io.to(`${params.groupId}`).emit(`${params.groupId}`, {
	// 				eventType: SOCKET.LISTNER_TYPE.GROUP.MESSAGES,
	// 				data: header_messages
	// 			});
	// 			group.membersDetails = membersDetails;
	// 			io.to(`${params.groupId}`).emit(`${params.groupId}`, {
	// 				eventType: SOCKET.LISTNER_TYPE.GROUP.GROUP_INFO,
	// 				groupDetails: group
	// 			});
	// 			/*NOTIFY USERS*/
	// 			let message = CHAT_HEADERS.GROUP.ADD_NOTIFY(tokenData.userId);
	// 			const sender = await userDaoV1.findUserById(tokenData.userId);
	// 			if (SERVER.IS_TRANSLATION_ENABLE) {
	// 				// const translatedInfo = await translateMessage(details.languageCode, message, group._id, tokenData, false)
	// 				// save.translatedMessages = translatedInfo.translatedMessages;
	// 				// save.langCodes = translatedInfo.langCodes;
	// 				// save.userLang = translatedInfo.userLang;
	// 			}

	// 			for (let user of addedMembers) {
	// 				let IsNotificationMuted = await this.checkforChatNotification(user, group._id);
	// 				const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + user + REDIS_KEY_PREFIX.SOCKET_ID);
	// 				if (socket_user) {
	// 					const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;// io.sockets.sockets.get(socket_user);
	// 					if (contactUserIdSocket) {
	// 						if (user.toString() !== tokenData.userId.toString()) {
	// 							await this.triggerGroupNotification(true, params, socket_user, sender, user, io, group, save, socket, contactUserIdSocket, IsNotificationMuted)
	// 						}
	// 						this.inboxChat(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: user });
	// 						// this.refreshChatBox(io,contactUserIdSocket,{chatId: group._id},ack,{userId: user});
	// 					}
	// 				} else {
	// 					if (user.toString() !== tokenData.userId.toString()) {
	// 						await this.triggerGroupNotification(false, params, socket_user, sender, user, io, group, save, socket, {}, IsNotificationMuted)
	// 					}
	// 				}
	// 			}
	// 			/*END NOTIFY USERS*/
	// 			this.refreshGroupChatInboxList(params.groupId, tokenData.userId, updated_group_members.members, io, socket, ack);
	// 			return
	// 		}
	// 		const membersDetails = await userDaoV1.find("users", { _id: { $in: group.members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 		group.membersDetails = membersDetails;
	// 		ack(MESSAGES.SUCCESS.DETAILS(group));
	// 		io.to(`${params.groupId}`).emit(`${params.groupId}`, {
	// 			eventType: SOCKET.LISTNER_TYPE.GROUP.GROUP_INFO,
	// 			groupDetails: group
	// 		});
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }


	async updateHeaderForGroup(io: any, params, group, tokenData: TokenData, mode, socket: any, ack: any) {
		try {
			let details: any = {}, taggedUser = [];
			details.languageCode = LANGUAGE_CODE.EN;
			if (mode == CHAT_MODE_TYPE.NAME) {
				details.message = CHAT_HEADERS.GROUP.UPDATE.NAME(tokenData.userId, params.name);
			} else if (mode == CHAT_MODE_TYPE.DESCRIPTION) {
				details.message = CHAT_HEADERS.GROUP.UPDATE.DESCRIPTION(tokenData.userId);
			} else if (mode == CHAT_MODE_TYPE.ICON) {
				details.message = CHAT_HEADERS.GROUP.UPDATE.ICON(tokenData.userId);
			} else if (mode == CHAT_MODE_TYPE.UPDATE_SCHEDULED_CALL_START_TIME || mode == CHAT_MODE_TYPE.UPDATE_SCHEDULED_CALL_END_TIME) {
				details.message = CHAT_HEADERS.GROUP.UPDATE.UPDATE_SCHEDULED_TIME(tokenData.userId);
			} else {
				details.message = CHAT_HEADERS.GROUP.UPDATE.REMOVE_ICON(tokenData.userId);
			}
			taggedUser.push(tokenData.userId);
			let isRead = [], isDelivered = [];
			isRead.push(tokenData.userId);
			isDelivered.push(tokenData.userId);
			let save: any = {
				type: CHAT_TYPE.GROUP,
				senderId: tokenData.userId,
				members: group.members,
				chatId: group._id,
				message: details.message,
				mediaUrl: null,
				// messageType: MESSAGE_TYPE.HEADING,
				isRead: isRead,
				isDelivered: isDelivered,
				thumbnailUrl: details.thumbnailUrl ? details.thumbnailUrl : null,
				location: null,
				size: details.size ? details.size : null,
				transcribe: details.transcribe ? details.transcribe : null,
				status: STATUS.ACTIVE,
				taggedUser: taggedUser,
				contact: null
			}
			let translatedInfo: any = {}
			if (SERVER.IS_TRANSLATION_ENABLE) {
				// const translatedInfo = await translateMessage(details.languageCode, details.message, group._id, tokenData, false)
				// save.translatedMessages = translatedInfo.encryptedMessages;
				// save.langCodes = translatedInfo.langCodes;
				// save.userLang = translatedInfo.userLang;
			}
			const header_messages = await baseDao.save("messages", save);
			if (SERVER.IS_TRANSLATION_ENABLE) {
				save.translatedMessages = translatedInfo.translatedMessages;
			}
			/*end of saving header msg*/
			group = await baseDao.findOneAndUpdate("chats", {
				_id: group._id
			}, {
				lastMsgId: header_messages._id,
				lastMsgCreated: Date.now()
			}, { new: true });
			const membersDetails = await userDaoV1.find("users", { _id: { $in: group.members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
			header_messages.membersDetails = membersDetails;
			io.to(`${params.groupId}`).emit(`${params.groupId}`, {
				eventType: SOCKET.LISTNER_TYPE.GROUP.MESSAGES,
				data: header_messages
			});
			this.refreshGroupChatInboxList(params.groupId, tokenData.userId, group.members, io, socket, ack);
		} catch (error) {
			throw error
		}
	}

	/**
	 * @function viewGroupDetails
	 * view group details along with media details
	*/
	async viewGroupDetails(params: ChatRequest.Id, tokenData: TokenData) {
		try {
			if (!params.groupId) {
				return MESSAGES.ERROR.PARAMS_MISSING
			}
			let group = await chatDaoV1.findOne("chats", { _id: params.groupId, type: CHAT_TYPE.GROUP, deletedBy: { $nin: [tokenData.userId] } }, { type: 1, members: 1, overallMembers: 1, status: 1, admins: 1, createdBy: 1, name: 1, description: 1, groupProfilePicture: 1, created: 1, totalMembers: { $cond: { if: { $isArray: "$members" }, then: { $size: "$members" }, else: 0 } }, });
			if (!group) return MESSAGES.ERROR.GROUP_NOT_FOUND;
			const membersDetails = await userDaoV1.find("users", { _id: { $in: group.members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1, isAdmin: { $literal: false } });
			group.membersDetails = membersDetails;
			const overAllMembersDetails = await userDaoV1.find("users", { _id: { $in: group.overallMembers } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1, isAdmin: { $literal: false } });
			group.overAllMembersDetails = overAllMembersDetails;
			for (let user of group.membersDetails) {
				for (let admin of group.admins) {
					if (admin.toString() == user._id.toString()) {
						user.isAdmin = true;
						break;
					}
				}
			}
			delete group.members;
			delete group.admins;
			const step2 = await chatDaoV1.mediaList(params, tokenData.userId);
			let param: any = {};
			param.chatId = params.groupId;
			param.deletedBy = { $nin: [toObjectId(tokenData.userId)] };
			param.status = { $in: [STATUS.ACTIVE, STATUS.FORWARDED, STATUS.REPLIED] };
			param.messageType = { $in: [MESSAGE_TYPE.IMAGE] };
			const step3 = await chatDaoV1.countDocuments("messages", param);
			let data = {
				groupDetails: group,
				mediaDetails: step2,
				totalMediaTypes: step3
			}
			return MESSAGES.SUCCESS.LIST({ data: data });
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function exitGroup
	 * exit from a group
	 * if only admin left from the group then assign new random admin to existing group
	*/
	// async exitGroup(io: any, socket: any, params: ChatRequest.Id, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.groupId) {
	// 			return ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 		}
	// 		let group = await chatDaoV1.findOne("chats", { _id: params.groupId, type: CHAT_TYPE.GROUP, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!group) return ack(MESSAGES.ERROR.GROUP_NOT_FOUND);
	// 		const groupUser = await chatDaoV1.findOne("chats", { _id: params.groupId, members: { $in: tokenData.userId } });
	// 		if (!groupUser) return ack(MESSAGES.ERROR.USER_NOT_FOUND);
	// 		const members = group.members;
	// 		const leaveGroup = await chatDaoV1.findOneAndUpdate("chats", { _id: params.groupId }, { $addToSet: { deletedBy: tokenData.userId }, $pull: { members: tokenData.userId, admins: tokenData.userId }, $push: { exitedBy: tokenData.userId } }, { new: true });
	// 		if (!leaveGroup?.admins?.length) {
	// 			let admin = leaveGroup?.members[0];
	// 			await chatDaoV1.findOneAndUpdate("chats", { _id: params.groupId }, { $push: { admins: admin } }, { new: true });
	// 		}
	// 		/*save header message*/
	// 		let details: any = {}, taggedUser = [];
	// 		details.languageCode = LANGUAGE_CODE.EN;
	// 		details.message = CHAT_HEADERS.GROUP.LEFT(tokenData.userId);
	// 		taggedUser.push(tokenData.userId)
	// 		let isRead = [], isDelivered = [];
	// 		isRead.push(tokenData.userId);
	// 		isDelivered.push(tokenData.userId);
	// 		let save: any = {
	// 			type: CHAT_TYPE.GROUP,
	// 			senderId: tokenData.userId,
	// 			members: members,
	// 			chatId: group._id,
	// 			message: details.message,
	// 			mediaUrl: null,
	// 			// messageType: MESSAGE_TYPE.HEADING,
	// 			isRead: isRead,
	// 			isDelivered: isDelivered,
	// 			thumbnailUrl: details.thumbnailUrl ? details.thumbnailUrl : null,
	// 			location: null,
	// 			size: details.size ? details.size : null,
	// 			transcribe: details.transcribe ? details.transcribe : null,
	// 			status: STATUS.ACTIVE,
	// 			taggedUser: taggedUser,
	// 			contact: null
	// 		}
	// 		let translatedInfo: any = {}
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			// const translatedInfo = await translateMessage(details.languageCode, details.message, group._id, tokenData, false)
	// 			// save.translatedMessages = translatedInfo.encryptedMessages;
	// 			// save.langCodes = translatedInfo.langCodes;
	// 			// save.userLang = translatedInfo.userLang;
	// 		}
	// 		const header_messages = await baseDao.save("messages", save);
	// 		// if (SERVER.IS_TRANSLATION_ENABLE) {
	// 		// 	save.translatedMessages = translatedInfo.translatedMessages;
	// 		// }
	// 		/*end of saving header msg*/
	// 		group = await baseDao.findOneAndUpdate("chats", {
	// 			_id: group._id
	// 		}, {
	// 			lastMsgId: header_messages._id,
	// 			lastMsgCreated: Date.now()
	// 		}, { new: true });
	// 		const membersDetails = await userDaoV1.find("users", { _id: { $in: members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 		header_messages.membersDetails = membersDetails;
	// 		/*after exited members details*/
	// 		let removedMembersDetails = await userDaoV1.find("users", { _id: { $in: group.members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 		group.membersDetails = removedMembersDetails;
	// 		ack(MESSAGES.SUCCESS.DEFAULT);
	// 		io.to(`${params.groupId}`).emit(`${params.groupId}`, {
	// 			eventType: SOCKET.LISTNER_TYPE.GROUP.MESSAGES,
	// 			data: header_messages
	// 		});
	// 		io.to(`${params.groupId}`).emit(`${params.groupId}`, {
	// 			eventType: SOCKET.LISTNER_TYPE.GROUP.GROUP_INFO,
	// 			groupDetails: group
	// 		});


	// 		const sender = await userDaoV1.findUserById(tokenData.userId);
	// 		for (let user of members) {
	// 			let IsNotificationMuted = await this.checkforChatNotification(user, group._id);
	// 			const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + user + REDIS_KEY_PREFIX.SOCKET_ID);
	// 			if (socket_user) {
	// 				const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;// io.sockets.sockets.get(socket_user);
	// 				if (contactUserIdSocket) {
	// 					if (user.toString() !== tokenData.userId.toString()) {
	// 						await this.triggerGroupNotification(true, params, socket_user, sender, user, io, group, save, socket, contactUserIdSocket, IsNotificationMuted)
	// 					}
	// 					this.inboxChat(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: user });
	// 					// this.refreshChatBox(io,contactUserIdSocket,{chatId: group._id},ack,{userId: user});
	// 				}
	// 			} else {
	// 				if (user.toString() !== tokenData.userId.toString()) {
	// 					await this.triggerGroupNotification(false, params, socket_user, sender, user, io, group, save, socket, {}, IsNotificationMuted)
	// 				}
	// 			}
	// 		}
	// 		/*END NOTIFY USERS*/
	// 		this.refreshGroupChatInboxList(params.groupId, tokenData.userId, group.members, io, socket, ack);
	// 		return

	// 		return
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function deleteGroup
	 * delete user from a group only after he exited from a group
	*/
	// async deleteGroup(io: any, socket: any, params: ChatRequest.Id, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.groupId) {
	// 			return ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 		}
	// 		const group = await chatDaoV1.findOne("chats", { _id: params.groupId, type: { $in: [CHAT_TYPE.GROUP, CHAT_TYPE.COMMUNITY] }, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!group) return ack(MESSAGES.ERROR.GROUP_NOT_FOUND);
	// 		const groupUser = await chatDaoV1.findOne("chats", { _id: params.groupId, members: { $in: tokenData.userId } });
	// 		// if (groupUser) return ack(MESSAGES.ERROR.MEMEBERS_ALREADY_EXIST);
	// 		const deleteGroup = await chatDaoV1.findOneAndUpdate("chats", { _id: params.groupId }, { $addToSet: { deletedBy: tokenData.userId }, $pull: { exitedBy: tokenData.userId } }, { new: true });
	// 		ack(MESSAGES.SUCCESS.DEFAULT);
	// 		await baseDao.updateMany("messages", { chatId: params.groupId }, { $addToSet: { deletedBy: tokenData.userId } }, {})
	// 		return
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function removeGroupMember
	 * remove user from a group only by admins
	*/
	// async removeGroupMember(io: any, socket: any, params: ChatRequest.Id, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.groupId) {
	// 			return ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 		}
	// 		let group = await chatDaoV1.findOne("chats", { _id: params.groupId, type: CHAT_TYPE.GROUP, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!group) return ack(MESSAGES.ERROR.GROUP_NOT_FOUND);
	// 		const groupUser = await chatDaoV1.findOne("chats", { _id: params.groupId, members: { $in: params.contactUserId } });
	// 		if (!groupUser) return ack(MESSAGES.ERROR.USER_NOT_FOUND);
	// 		const isAdmin = await chatDaoV1.findOne("chats", { _id: params.groupId, admins: { $in: tokenData.userId } });
	// 		if (!isAdmin) return ack(MESSAGES.ERROR.UNAUTHORIZE_ADMIN);
	// 		const removeGroupMember = await chatDaoV1.findOneAndUpdate("chats", { _id: params.groupId }, { $pull: { members: params.contactUserId, admins: params.contactUserId }, $addToSet: { exitedBy: params.contactUserId } }, { new: true });
	// 		/*save header message*/
	// 		let details: any = {}, taggedUser = [];
	// 		details.languageCode = LANGUAGE_CODE.EN;
	// 		details.message = CHAT_HEADERS.GROUP.REMOVE(tokenData.userId, params.contactUserId);
	// 		taggedUser.push(tokenData.userId, params.contactUserId)
	// 		let isRead = [], isDelivered = [];
	// 		isRead.push(tokenData.userId);
	// 		isDelivered.push(tokenData.userId);
	// 		let save: any = {
	// 			type: CHAT_TYPE.GROUP,
	// 			senderId: tokenData.userId,
	// 			members: group.members,
	// 			chatId: group._id,
	// 			message: details.message,
	// 			mediaUrl: null,
	// 			// messageType: MESSAGE_TYPE.HEADING,
	// 			isRead: isRead,
	// 			isDelivered: isDelivered,
	// 			thumbnailUrl: details.thumbnailUrl ? details.thumbnailUrl : null,
	// 			location: null,
	// 			size: details.size ? details.size : null,
	// 			transcribe: details.transcribe ? details.transcribe : null,
	// 			status: STATUS.ACTIVE,
	// 			contact: null
	// 		}
	// 		let translatedInfo: any = {}
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			// const translatedInfo = await translateMessage(details.languageCode, details.message, group._id, tokenData, false)
	// 			// save.translatedMessages = translatedInfo.encryptedMessages;
	// 			// save.langCodes = translatedInfo.langCodes;
	// 			// save.userLang = translatedInfo.userLang;
	// 		}
	// 		const header_messages = await baseDao.save("messages", save);
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			save.translatedMessages = translatedInfo.translatedMessages;
	// 		}
	// 		/*end of saving header msg*/
	// 		group = await baseDao.findOneAndUpdate("chats", {
	// 			_id: group._id
	// 		}, {
	// 			lastMsgId: header_messages._id,
	// 			lastMsgCreated: Date.now()
	// 		}, { new: true });
	// 		let membersDetails = await userDaoV1.find("users", { _id: { $in: save.members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 		header_messages.membersDetails = membersDetails; //save full members details
	// 		/*remove current removed members details*/
	// 		let removedMembersDetails = await userDaoV1.find("users", { _id: { $in: removeGroupMember.members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 		group.membersDetails = removedMembersDetails;
	// 		await this.notifyRemovedUser(io, {
	// 			userId: params.contactUserId,
	// 			groupId: params.groupId
	// 		});
	// 		/** */
	// 		ack(MESSAGES.SUCCESS.DEFAULT);
	// 		io.to(`${params.groupId}`).emit(`${params.groupId}`, {
	// 			eventType: SOCKET.LISTNER_TYPE.GROUP.MESSAGES,
	// 			data: header_messages
	// 		});
	// 		io.to(`${params.groupId}`).emit(`${params.groupId}`, {
	// 			eventType: SOCKET.LISTNER_TYPE.GROUP.GROUP_INFO,
	// 			groupDetails: group
	// 		});
	// 		this.refreshGroupChatInboxList(params.groupId, tokenData.userId, save.members, io, socket, ack);
	// 		return
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function notifyRemovedUser
	 * notify user when removed from group
	*/
	async notifyRemovedUser(io, data) {
		try {
			const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + data.userId + REDIS_KEY_PREFIX.SOCKET_ID);
			if (socket_user) {
				const contactUserIdSocket = io.sockets.sockets.get(socket_user);
				if (contactUserIdSocket) contactUserIdSocket.emit(SOCKET.LISTNER_TYPE.NOTIFY.REMOVED_FROM_GROUP, {
					userId: data.userId,
					groupId: data.groupId
				})
			}
			return
		} catch (error) {
			throw error
		}
	}

	/**
	 * @function makeGroupAdmin
	 * assign admin role in a group by an admin
	*/
	// async makeGroupAdmin(io: any, socket: any, params: ChatRequest.Id, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.groupId) {
	// 			return ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 		}
	// 		const group = await chatDaoV1.findOne("chats", { _id: params.groupId, type: CHAT_TYPE.GROUP, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!group) return ack(MESSAGES.ERROR.GROUP_NOT_FOUND);
	// 		const groupUser = await chatDaoV1.findOne("chats", { _id: params.groupId, members: { $in: params.contactUserId } });
	// 		if (!groupUser) return ack(MESSAGES.ERROR.USER_NOT_FOUND);
	// 		const isAdmin = await chatDaoV1.findOne("chats", { _id: params.groupId, admins: { $in: tokenData.userId } });
	// 		if (!isAdmin) return ack(MESSAGES.ERROR.UNAUTHORIZE_ADMIN);
	// 		const makeGroupAdmin = await chatDaoV1.findOneAndUpdate("chats", { _id: params.groupId }, { $addToSet: { admins: params.contactUserId } }, { new: true });
	// 		const membersDetails = await userDaoV1.find("users", { _id: { $in: makeGroupAdmin.members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 		makeGroupAdmin.membersDetails = membersDetails;
	// 		ack(MESSAGES.SUCCESS.DEFAULT);
	// 		/*save header message*/
	// 		let details: any = {}, taggedUser = [];
	// 		details.languageCode = LANGUAGE_CODE.EN;
	// 		details.message = CHAT_HEADERS.GROUP.UPDATE.ADMIN(params.contactUserId);
	// 		taggedUser.push(tokenData.userId)
	// 		let isRead = [], isDelivered = [], deletedBy = [];
	// 		isRead.push(tokenData.userId);
	// 		isDelivered.push(tokenData.userId);
	// 		deletedBy = group.members.filter(x => x.toString() !== params.contactUserId.toString());
	// 		let save: any = {
	// 			type: CHAT_TYPE.GROUP,
	// 			senderId: tokenData.userId,
	// 			members: group.members,
	// 			chatId: group._id,
	// 			message: details.message,
	// 			mediaUrl: null,
	// 			// messageType: MESSAGE_TYPE.HEADING,
	// 			isRead: isRead,
	// 			isDelivered: isDelivered,
	// 			deletedBy: deletedBy,
	// 			thumbnailUrl: details.thumbnailUrl ? details.thumbnailUrl : null,
	// 			location: null,
	// 			size: details.size ? details.size : null,
	// 			transcribe: details.transcribe ? details.transcribe : null,
	// 			status: STATUS.ACTIVE,
	// 			contact: null
	// 		}
	// 		let translatedInfo: any = {}
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			// translatedInfo = await translateMessage(details.languageCode, details.message, group._id, tokenData, false)
	// 			// save.translatedMessages = translatedInfo.encryptedMessages;
	// 			// save.langCodes = translatedInfo.langCodes;
	// 			// save.userLang = translatedInfo.userLang;
	// 		}
	// 		const header_messages = await baseDao.save("messages", save);
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			save.translatedMessages = translatedInfo.translatedMessages;
	// 		}
	// 		/*end of saving header msg*/
	// 		header_messages.membersDetails = membersDetails;
	// 		const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + params.contactUserId + REDIS_KEY_PREFIX.SOCKET_ID);
	// 		if (socket_user) {
	// 			const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;//io.sockets.sockets.get(socket_user);
	// 			if (contactUserIdSocket) {
	// 				contactUserIdSocket.emit(`${params.groupId}`, {
	// 					eventType: SOCKET.LISTNER_TYPE.GROUP.MESSAGES,
	// 					data: header_messages
	// 				});
	// 				const isSenderArchive = await this.checkChatArchiveStatus(params.contactUserId, params.groupId);
	// 				if (isSenderArchive) {
	// 					this.inboxArchive(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: params.contactUserId });
	// 				} else {
	// 					this.inboxChat(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: params.contactUserId });
	// 				}
	// 			}
	// 		}
	// 		io.to(`${params.groupId}`).emit(`${params.groupId}`, {
	// 			eventType: SOCKET.LISTNER_TYPE.GROUP.GROUP_INFO,
	// 			groupDetails: makeGroupAdmin
	// 		});
	// 		return
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
//  * @function removeGroupAdmin
//  * remove admin role in a group by an admin
// */
	// 	async removeGroupAdmin(io: any, socket: any, params: ChatRequest.Id, ack: any, tokenData: TokenData) {
	// 		try {
	// 			if (!params.groupId) {
	// 				return ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			}
	// 			const group = await chatDaoV1.findOne("chats", { _id: params.groupId, type: CHAT_TYPE.GROUP, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 			if (!group) return ack(MESSAGES.ERROR.GROUP_NOT_FOUND);
	// 			const groupUser = await chatDaoV1.findOne("chats", { _id: params.groupId, members: { $in: params.contactUserId } });
	// 			if (!groupUser) return ack(MESSAGES.ERROR.USER_NOT_FOUND);
	// 			const isAdmin = await chatDaoV1.findOne("chats", { _id: params.groupId, admins: { $in: tokenData.userId } });
	// 			if (!isAdmin) return ack(MESSAGES.ERROR.UNAUTHORIZE_ADMIN);
	// 			const removeGroupAdmin = await chatDaoV1.findOneAndUpdate("chats", { _id: params.groupId }, { $pull: { admins: params.contactUserId } }, { new: true });
	// 			ack(MESSAGES.SUCCESS.DEFAULT);
	// 			const membersDetails = await userDaoV1.find("users", { _id: { $in: removeGroupAdmin.members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 			removeGroupAdmin.membersDetails = membersDetails
	// 			ack(MESSAGES.SUCCESS.DEFAULT);
	// 			/*save header message*/
	// 			let details: any = {}, taggedUser = [];
	// 			details.languageCode = LANGUAGE_CODE.EN;
	// 			details.message = CHAT_HEADERS.GROUP.UPDATE.REVOKE_ADMIN(params.contactUserId);
	// 			taggedUser.push(tokenData.userId)
	// 			let isRead = [], isDelivered = [], deletedBy = [];
	// 			isRead.push(tokenData.userId);
	// 			isDelivered.push(tokenData.userId);
	// 			deletedBy = group.members.filter(x => x.toString() !== params.contactUserId.toString());
	// 			let save: any = {
	// 				type: CHAT_TYPE.GROUP,
	// 				senderId: tokenData.userId,
	// 				members: group.members,
	// 				chatId: group._id,
	// 				message: details.message,
	// 				mediaUrl: null,
	// 				messageType: MESSAGE_TYPE.HEADING,
	// 				isRead: isRead,
	// 				isDelivered: isDelivered,
	// 				deletedBy: deletedBy,
	// 				thumbnailUrl: details.thumbnailUrl ? details.thumbnailUrl : null,
	// 				location: null,
	// 				size: details.size ? details.size : null,
	// 				transcribe: details.transcribe ? details.transcribe : null,
	// 				status: STATUS.ACTIVE,
	// 				contact: null
	// 			}
	// 			let translatedInfo: any = {}
	// 			if (SERVER.IS_TRANSLATION_ENABLE) {
	// 				// translatedInfo = await translateMessage(details.languageCode, details.message, group._id, tokenData, false)
	// 				// save.translatedMessages = translatedInfo.encryptedMessages;
	// 				// save.langCodes = translatedInfo.langCodes;
	// 				// save.userLang = translatedInfo.userLang;
	// 			}
	// 			const header_messages = await baseDao.save("messages", save);
	// 			if (SERVER.IS_TRANSLATION_ENABLE) {
	// 				save.translatedMessages = translatedInfo.translatedMessages;
	// 			}
	// 			/*end of saving header msg*/
	// 			header_messages.membersDetails = membersDetails;
	// 			ack(MESSAGES.SUCCESS.DEFAULT);
	// 			const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + params.contactUserId + REDIS_KEY_PREFIX.SOCKET_ID);
	// 			if (socket_user) {
	// 				const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;//io.sockets.sockets.get(socket_user);
	// 				if (contactUserIdSocket) {
	// 					contactUserIdSocket.emit(`${params.groupId}`, {
	// 						eventType: SOCKET.LISTNER_TYPE.GROUP.MESSAGES,
	// 						data: header_messages
	// 					});
	// 					const isSenderArchive = await this.checkChatArchiveStatus(params.contactUserId, params.groupId);
	// 					if (isSenderArchive) {
	// 						this.inboxArchive(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: params.contactUserId });
	// 					} else {
	// 						this.inboxChat(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: params.contactUserId });
	// 					}
	// 				}
	// 			}
	// 			io.to(`${params.groupId}`).emit(`${params.groupId}`, {
	// 				eventType: SOCKET.LISTNER_TYPE.GROUP.GROUP_INFO,
	// 				groupDetails: removeGroupAdmin
	// 			});
	// 			return
	// 		} catch (error) {
	// 			throw error;
	// 		}
	// 	}

	// 	/**
	//  * @function joinGroupChat
	//  * enter in a group chat and allow socket to join a chat-room @:grouId
	// */
	// 	async joinGroupChat(io: any, socket: any, params: ChatRequest.Id, ack: any, tokenData: TokenData) {
	// 		try {
	// 			if (!params.groupId) {
	// 				return ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			}
	// 			const group = await chatDaoV1.findOne("chats", { _id: params.groupId, type: CHAT_TYPE.GROUP, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 			if (!group) return ack(MESSAGES.ERROR.GROUP_NOT_FOUND);
	// 			const groupUser = await chatDaoV1.findOne("chats", { _id: params.groupId, overallMembers: { $in: tokenData.userId } });
	// 			if (!groupUser) return ack(MESSAGES.ERROR.USER_NOT_FOUND);
	// 			let data = {
	// 				chatId: group?._id,
	// 				groupProfilePicture: group?.groupProfilePicture,
	// 				name: group?.name,
	// 				description: group?.description,
	// 				chatType: group?.type,
	// 				mutedBy: group?.mutedBy,
	// 				status: group?.status,
	// 			}
	// 			if (!group.langCodes?.length && SERVER.IS_TRANSLATION_ENABLE) {
	// 				const toUpdate: any = {}
	// 				const chatUserInfo = await this.setUserLanguage(group?.members)
	// 				toUpdate["$addToSet"] = {
	// 					userLang: chatUserInfo.userLang,
	// 					langCodes: chatUserInfo.langCodes
	// 				}
	// 				await chatDaoV1.findOneAndUpdate("chats", { _id: group._id }, toUpdate)
	// 			}
	// 			ack(MESSAGES.SUCCESS.CHAT_FORMATION(data));
	// 			socket.join(`${group._id}`);
	// 			socket.emit(SOCKET.LISTNER_TYPE.GROUP.JOIN, MESSAGES.SUCCESS.CHAT_FORMATION(data));
	// 		} catch (error) {
	// 			throw error;
	// 		}
	// 	}

	/**
	 * @function reportGroupChat
	 * report a group by chat-room @:grouId
	*/
	// async reportGroupChat(io: any, socket: any, params: ChatRequest.Id, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.groupId) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		const group = await chatDaoV1.findOne("chats", { _id: params.groupId, type: CHAT_TYPE.GROUP, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!group) return ack(MESSAGES.ERROR.GROUP_NOT_FOUND);
	// 		let data = {
	// 			type: CHAT_REPORT_TYPE.GROUP,
	// 			reportedBy: tokenData.userId,
	// 			chatId: group._id,
	// 			reason: params.reason,
	// 			chatType: CHAT_TYPE.GROUP
	// 		}
	// 		const report = await baseDao.save("chat_report", data);
	// 		await baseDao.updateOne("chats", { _id: params.groupId }, { $inc: { reportCount: 1 }, $set: { reportedDate: Date.now() } }, {});
	// 		return ack(MESSAGES.SUCCESS.DETAILS(report));
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function muteChat
	 * mute/unmute chat by chatId
	 */
	// async muteChat(io: any, socket: any, params: ChatRequest.muteChat, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.chatId) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		let chat = await chatDaoV1.findOne("chats", { _id: params.chatId, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!chat) return ack(MESSAGES.ERROR.CHAT_NOT_FOUND);
	// 		if (params.isMute) {
	// 			await baseDao.findOneAndUpdate("chats", {
	// 				_id: params.chatId
	// 			}, {
	// 				$addToSet: { mutedBy: tokenData.userId }
	// 			}, {});
	// 			await redisClient.storeValue(SERVER.APP_NAME + "_" + tokenData.userId + "_" + params.chatId + REDIS_KEY_PREFIX.MUTE_CHAT, Date.now());
	// 		} else {
	// 			await baseDao.findOneAndUpdate("chats", {
	// 				_id: params.chatId
	// 			}, {
	// 				$pull: { mutedBy: tokenData.userId }
	// 			}, {});
	// 			await redisClient.deleteKey(SERVER.APP_NAME + "_" + tokenData.userId + "_" + params.chatId + REDIS_KEY_PREFIX.MUTE_CHAT);
	// 		}
	// 		ack(MESSAGES.SUCCESS.DEFAULT);
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function readAllChat
	 * marked chat readall with chatId
	*/
	async markedReadAllChat(io: any, socket: any, params: ChatRequest.markedReadAll, ack: any, tokenData: TokenData) {
		try {
			if (!params.chatId) {
				ack(MESSAGES.ERROR.PARAMS_MISSING)
				return
			}
			let chat = await chatDaoV1.findOne("chats", { _id: params.chatId, deletedBy: { $nin: [tokenData.userId] } }, {});
			if (!chat) return ack(MESSAGES.ERROR.CHAT_NOT_FOUND);
			const isSenderArchive = await this.checkChatArchiveStatus(tokenData.userId, params.chatId);
			await baseDao.updateMany("messages", { chatId: params.chatId, isRead: { $nin: [toObjectId(tokenData.userId)] } }, { $addToSet: { isRead: toObjectId(tokenData.userId) } }, {});
			ack(MESSAGES.SUCCESS.DEFAULT);
			if (isSenderArchive) {
				// this.inboxArchive(io, socket, PAGINATION_DEFAULT, ack, { userId: tokenData.userId });
			} else {
				this.inboxChat(io, socket, PAGINATION_DEFAULT, ack, { userId: tokenData.userId });
			}
			return
		} catch (error) {
			throw error;
		}
	}

	/** 
	 * @function checkforChatNotification
	 * check whether a user allows for notification for chat or not
	*/
	async checkforChatNotification(userId: string, chatId: string) {
		try {
			consolelog(`${userId} *************checkforChatNotification invoked***************`, chatId, true);
			let chat_notification = await redisClient.getValue(SERVER.APP_NAME + "_" + userId + "_" + chatId + REDIS_KEY_PREFIX.MUTE_CHAT);
			let push_notification = await redisClient.getValue(SERVER.APP_NAME + "_" + userId + REDIS_KEY_PREFIX.MUTE_CHAT);
			if (chat_notification || push_notification) {
				return true;
			}
			return false;
		} catch (error) {
			throw error
		}
	}

	// /** 
	//  * @function sendGroupMessage
	//  * send messages in a group with respective groupId-->chatId
	// */
	// async sendGroupMessage(io: any, socket: any, params: ChatRequest.GROUP_MESSAGE, ack: any, tokenData: TokenData) {
	// 	try {
	// 		consolelog(`${params.chatId} sendGroupMessage emit timer`, Date.now(), true);
	// 		if (!params.chatId || !params.messageType || !params.senderId || !params.localMessageId) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		if (params.messageType == MESSAGE_TYPE.TEXT && !params.message) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		const group = await chatDaoV1.findOne("chats", { _id: params.chatId, members: tokenData.userId, type: CHAT_TYPE.GROUP, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!group) return ack(MESSAGES.ERROR.GROUP_NOT_FOUND);
	// 		let deletedBy = [], isDelivered = [], isRead = [];
	// 		if (group?.deletedBy && group?.exitedBy) {
	// 			deletedBy = group.deletedBy.concat(group.exitedBy)
	// 		}
	// 		// isRead.push(params.senderId);
	// 		// isDelivered.push(params.senderId);
	// 		for (let memb of group.members) {
	// 			const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + memb.toString() + REDIS_KEY_PREFIX.SOCKET_ID);
	// 			if (socket_user) {
	// 				isDelivered.push(memb);
	// 				const scoketIds = await io.in(socket_user).fetchSockets();
	// 				for (const socket of scoketIds) {
	// 					if (socket?.rooms?.has(`${params.chatId}`)) isRead.push(memb);
	// 				}
	// 			}
	// 		}
	// 		let members = [];
	// 		members = group.members;
	// 		let data: any = {
	// 			_id: params.localMessageId,
	// 			type: CHAT_TYPE.GROUP,
	// 			senderId: params.senderId,
	// 			members: members,
	// 			chatId: params.chatId,
	// 			message: params.message,
	// 			mediaUrl: params.mediaUrl,
	// 			messageType: params.messageType,
	// 			isRead: isRead,
	// 			isDelivered: isDelivered,
	// 			thumbnailUrl: params.thumbnailUrl ? params.thumbnailUrl : null,
	// 			location: params.location,
	// 			size: params.size ? params.size : null,
	// 			transcribe: params.transcribe ? params.transcribe : null,
	// 			status: params.status,
	// 			deletedBy: deletedBy,
	// 			taggedUser: params.taggedUser,
	// 			imageRatio: params.imageRatio,
	// 			localUrl: params.localUrl,
	// 			contact: params.contact
	// 		}
	// 		let translatedInfo: any = {}
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			// translatedInfo = params.languageCode ? await translateMessage(params.languageCode, params.message, params.chatId, tokenData) : await autoTranslateMessage(params.message, params.chatId)
	// 			// data.translatedMessages = translatedInfo.encryptedMessages;
	// 			// data.langCodes = translatedInfo.langCodes;
	// 			// data.userLang = translatedInfo.userLang;
	// 		}
	// 		const message = await baseDao.save("messages", data);
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			data.translatedMessages = translatedInfo.translatedMessages;
	// 		}
	// 		let membersDetails = await userDaoV1.find("users", { _id: { $in: members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 		message.membersDetails = membersDetails;
	// 		ack(message);
	// 		io.to(`${params.chatId}`).emit(`${params.chatId}`, {
	// 			eventType: SOCKET.LISTNER_TYPE.GROUP.MESSAGES,
	// 			data: message
	// 		});
	// 		consolelog(`${params.chatId},sendGroupMessage delivered timer`, Date.now(), true);
	// 		await baseDao.findOneAndUpdate("chats", {
	// 			_id: params.chatId
	// 		}, {
	// 			lastMsgId: message._id,
	// 			lastMsgCreated: Date.now()
	// 		}, {});
	// 		const isSenderArchive = await this.checkChatArchiveStatus(tokenData.userId, params.chatId);
	// 		// const isSenderArchive = await chatDaoV1.findOne("chats", { _id: params.chatId, type: CHAT_TYPE.GROUP, acrhivedBy: { $in: [tokenData.userId] } });
	// 		if (isSenderArchive) {
	// 			// this.inboxArchive(io, socket, PAGINATION_DEFAULT, ack, { userId: tokenData.userId });
	// 			this.refreshArchiveChatBox(io, socket, params, ack, { userId: tokenData.userId });
	// 		} else {
	// 			// this.inboxChat(io, socket, PAGINATION_DEFAULT, ack, { userId: tokenData.userId });
	// 			this.refreshChatBox(io, socket, params, ack, { userId: tokenData.userId });
	// 		}
	// 		const sender = await userDaoV1.findUserById(params.senderId);
	// 		for (let user of members) {
	// 			if (params.senderId.toString() !== user.toString()) {
	// 				consolelog(`-------${params.chatId},sendGroupMessage userId`, user, true);
	// 				let IsNotificationMuted = await this.checkforChatNotification(user, group._id);
	// 				const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + user + REDIS_KEY_PREFIX.SOCKET_ID);
	// 				if (socket_user) {
	// 					const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;//io.sockets.sockets.get(socket_user);
	// 					if (contactUserIdSocket) {
	// 						const isReceiverArchive = await chatDaoV1.findOne("chats", { _id: params.chatId, type: CHAT_TYPE.GROUP, acrhivedBy: { $in: [user] } });
	// 						if (isReceiverArchive) {
	// 							// this.inboxArchive(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: user });
	// 							this.refreshArchiveChatBox(io, contactUserIdSocket, params, ack, { userId: user });
	// 						} else {
	// 							if (socket_user) {
	// 								let roomParams = {
	// 									chatId: params.chatId,
	// 									socketId: socket_user
	// 								};
	// 								let IsNotification = await this.checkUserRoomInSocket(io, roomParams);
	// 								if (!IsNotification) //TODO:notification service
	// 								{
	// 									const contactUserId = await userDaoV1.findUserById(user);
	// 									let notificationData: ChatRequest.CHAT_NOTIFICATION = {
	// 										type: NOTIFICATION_TYPE.CHAT_NOTIFICATION,
	// 										title: sender?.name,
	// 										subtitle: group?.name,
	// 										message: data.translatedMessages[`${contactUserId.languageCode}`] ? data.translatedMessages[`${contactUserId.languageCode}`] : params.message,
	// 										body: data.translatedMessages[`${contactUserId.languageCode}`] ? data.translatedMessages[`${contactUserId.languageCode}`] : params.message,
	// 										details: {
	// 											chatId: params.chatId,
	// 											senderId: params.senderId,
	// 											receiverId: user.toString(),
	// 											receiverIdName: contactUserId?.name,
	// 											messageType: params.messageType,
	// 											profilePicture: group?.groupProfilePicture,
	// 											countryCode: sender.countryCode,
	// 											mobileNo: sender.mobileNo,
	// 											fullMobileNo: sender?.fullMobileNo,
	// 											type: CHAT_TYPE.GROUP,
	// 											senderName: group?.name,
	// 											flagCode: sender?.flagCode,
	// 											membersDetails: message.membersDetails ? message.membersDetails : {}
	// 										}
	// 									}
	// 									console.log('********** sendGroupMessage notificationData*************', notificationData)
	// 									if (!IsNotificationMuted) await this.sendChatNotification(contactUserIdSocket, notificationData);

	// 								}
	// 							}
	// 							// this.inboxChat(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: user });
	// 							this.refreshChatBox(io, contactUserIdSocket, params, ack, { userId: user });
	// 						}
	// 					}
	// 				} else {
	// 					const contactUserId = await userDaoV1.findUserById(user);
	// 					let notification_message = messageTypeInChat(params.messageType) != MESSAGE_TYPE.TEXT ? messageTypeInChat(params.messageType) : data.translatedMessages[`${contactUserId.languageCode}`] ? data.translatedMessages[`${contactUserId.languageCode}`] : params.message;
	// 					console.log('***************************notification_message***************************', notification_message)
	// 					let notificationData: ChatRequest.CHAT_NOTIFICATION = {
	// 						type: NOTIFICATION_TYPE.CHAT_NOTIFICATION,
	// 						title: sender?.name,
	// 						subtitle: group?.name,
	// 						message: notification_message,
	// 						body: notification_message,
	// 						details: {
	// 							chatId: params.chatId,
	// 							senderId: params.senderId,
	// 							receiverId: user.toString(),
	// 							receiverIdName: contactUserId?.name,
	// 							messageType: params.messageType,
	// 							profilePicture: group?.groupProfilePicture,
	// 							countryCode: sender.countryCode,
	// 							mobileNo: sender.mobileNo,
	// 							fullMobileNo: sender?.fullMobileNo,
	// 							type: CHAT_TYPE.GROUP,
	// 							senderName: group?.name,
	// 							flagCode: sender?.flagCode,
	// 							membersDetails: message.membersDetails ? message.membersDetails : {}
	// 						}
	// 					}
	// 					let contact = await userDaoV1.findOne("contacts", { userId: notificationData.details.receiverId, contactUserId: notificationData.details.senderId }, { name: 1 });
	// 					notificationData.title = contact?.name || sender.fullMobileNo;
	// 					console.log('********** sendGroupMessage push notificationData*************', notificationData);
	// 					const isSubscribedUser = await this.checkUserSubscription(notificationData.details.receiverId);
	// 					if (isSubscribedUser.isSubscribed || isSubscribedUser?.expiryTime < Date.now()) {
	// 						if (!IsNotificationMuted) await sendNotification(notificationData, socket.accessToken);
	// 					}
	// 				}
	// 			}
	// 		}
	// 		return true;
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	async refreshGroupChatInboxList(chatId: string, userId: string, members: Array<string>, io: any, socket: any, ack: any) {
		try {
			const isSenderArchive = await this.checkChatArchiveStatus(userId, chatId);
			// const isSenderArchive = await chatDaoV1.findOne("chats", { _id: chatId, type: CHAT_TYPE.GROUP, acrhivedBy: userId });
			if (isSenderArchive) {
				// this.inboxArchive(io, socket, PAGINATION_DEFAULT, ack, { userId: userId }, true);
				// this.refreshArchiveChatBox(io, socket, {chatId: chatId}, ack, { userId: userId },true);
			} else {
				this.inboxChat(io, socket, PAGINATION_DEFAULT, ack, { userId: userId }, true);
				// this.refreshChatBox(io,socket,{chatId:chatId},ack,{userId: userId}, true);
			}
			for (let user of members) {
				const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + user + REDIS_KEY_PREFIX.SOCKET_ID);
				if (socket_user) {
					const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;//io.sockets.sockets.get(socket_user);
					if (contactUserIdSocket) {
						const isReceiverArchive = await chatDaoV1.findOne("chats", { _id: chatId, type: CHAT_TYPE.GROUP, acrhivedBy: user });
						if (isReceiverArchive) {
							// this.inboxArchive(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: user }, true);
							// this.refreshArchiveChatBox(io, contactUserIdSocket, {chatId: chatId}, ack, { userId: user },true);
						} else {
							this.inboxChat(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: user }, true);
							// this.refreshChatBox(io,contactUserIdSocket,{chatId:chatId},ack,{userId: user}, true);
						}
					}
				}
			}
		} catch (error) {
			throw error
		}
	}

	/**
//  * @function RepliedToGroupMessage
//  * replied to a message in a current group
//  */
	// 	async RepliedToGroupMessage(io: any, socket: any, params: ChatRequest.REPLIED, ack: any, tokenData: TokenData) {
	// 		try {
	// 			if (!params.messageId || !params.chatId || !params.messageType || !params.senderId || !params.localMessageId) {
	// 				ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 				return
	// 			}
	// 			const group = await chatDaoV1.findOne("chats", { _id: params.chatId, type: CHAT_TYPE.GROUP, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 			if (!group) return ack(MESSAGES.ERROR.GROUP_NOT_FOUND);
	// 			const groupUser = await chatDaoV1.findOne("chats", { _id: params.chatId, members: { $in: tokenData.userId } });
	// 			if (!groupUser) return ack(MESSAGES.ERROR.USER_NOT_FOUND);
	// 			const messageId = await baseDao.find("messages", { _id: params.messageId }, {});
	// 			if (!messageId) {
	// 				ack(MESSAGES.ERROR.MESSAGE_NOT_FOUND)
	// 			}
	// 			let deletedBy = [], members = [], isRead = [], isDelivered = [];
	// 			if (group?.deletedBy && group?.exitedBy) {
	// 				deletedBy = group.deletedBy.concat(group.exitedBy)
	// 			}
	// 			// isRead.push(params.senderId);
	// 			// isDelivered.push(params.senderId);
	// 			for (let memb of group.members) {
	// 				const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + (memb).toString() + REDIS_KEY_PREFIX.SOCKET_ID);
	// 				if (socket_user) {
	// 					isDelivered.push(memb);
	// 					const scoketIds = await io.in(socket_user).fetchSockets();
	// 					for (const socket of scoketIds) {
	// 						if (socket?.rooms?.has(`${params.chatId}`)) isRead.push(memb);
	// 					}
	// 				}
	// 			}
	// 			members = group.members;
	// 			let data: any = {
	// 				_id: params.localMessageId,
	// 				messageId: messageId[0]._id,
	// 				type: CHAT_TYPE.GROUP,
	// 				senderId: params.senderId,
	// 				members: members,
	// 				chatId: params.chatId,
	// 				message: params.message,
	// 				mediaUrl: params.mediaUrl,
	// 				messageType: params.messageType,
	// 				isRead: isRead,
	// 				isDelivered: isDelivered,
	// 				thumbnailUrl: params.thumbnailUrl ? params.thumbnailUrl : null,
	// 				location: params.location,
	// 				size: params.size ? params.size : null,
	// 				transcribe: params.transcribe ? params.transcribe : null,
	// 				status: params.status,
	// 				deletedBy: deletedBy,
	// 				taggedUser: params.taggedUser,
	// 				imageRatio: params.imageRatio,
	// 				localUrl: params.localUrl,
	// 				contact: params.contact
	// 			}
	// 			let translatedInfo: any = {}
	// 			if (SERVER.IS_TRANSLATION_ENABLE) {
	// 				// translatedInfo = params.languageCode ? await translateMessage(params.languageCode, params.message, params.chatId, tokenData) : await autoTranslateMessage(params.message, params.chatId)
	// 				// data.translatedMessages = translatedInfo.encryptedMessages;
	// 				// data.langCodes = translatedInfo.langCodes;
	// 				// data.userLang = translatedInfo.userLang;
	// 			}
	// 			const message = await baseDao.save("messages", data);
	// 			if (SERVER.IS_TRANSLATION_ENABLE) {
	// 				data.translatedMessages = translatedInfo.translatedMessages;
	// 			}
	// 			await baseDao.findOneAndUpdate("chats", {
	// 				_id: params.chatId
	// 			}, {
	// 				lastMsgId: message._id,
	// 				lastMsgCreated: Date.now()
	// 			}, { new: true });
	// 			const membersDetails = await userDaoV1.find("users", { _id: { $in: members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 			message.membersDetails = membersDetails;
	// 			message.messageIdDetails = messageId;
	// 			const isSenderArchive = await this.checkChatArchiveStatus(tokenData.userId, params.chatId);
	// 			// const isSenderArchive = await chatDaoV1.findOne("chats", { _id: params.chatId, type: CHAT_TYPE.GROUP, acrhivedBy: { $in: [tokenData.userId] } });
	// 			ack(message);
	// 			io.to(`${params.chatId}`).emit(`${params.chatId}`, {
	// 				eventType: SOCKET.LISTNER_TYPE.GROUP.REPLIED,
	// 				data: message
	// 			});
	// 			if (isSenderArchive) {
	// 				this.inboxArchive(io, socket, PAGINATION_DEFAULT, ack, { userId: tokenData.userId });
	// 				this.refreshArchiveChatBox(io, socket, params, ack, { userId: tokenData.userId });
	// 			} else {
	// 				this.inboxChat(io, socket, PAGINATION_DEFAULT, ack, { userId: tokenData.userId });
	// 				this.refreshChatBox(io, socket, params, ack, { userId: tokenData.userId })

	// 			}
	// 			const sender = await userDaoV1.findUserById(params.senderId);
	// 			for (let user of members) {
	// 				if (params.senderId.toString() !== user.toString()) {
	// 					let IsNotificationMuted = await this.checkforChatNotification(user, group._id);
	// 					const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + user + REDIS_KEY_PREFIX.SOCKET_ID);
	// 					if (socket_user) {
	// 						const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;// io.sockets.sockets.get(socket_user);
	// 						if (contactUserIdSocket) {
	// 							const isReceiverArchive = await chatDaoV1.findOne("chats", { _id: params.chatId, type: CHAT_TYPE.GROUP, acrhivedBy: { $in: [user] } });
	// 							if (isReceiverArchive) {
	// 								this.inboxArchive(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: user });
	// 								this.refreshArchiveChatBox(io, contactUserIdSocket, params, ack, { userId: user });
	// 							} else {
	// 								if (socket_user) {
	// 									let roomParams = {
	// 										chatId: params.chatId,
	// 										socketId: socket_user
	// 									};
	// 									let IsNotification = await this.checkUserRoomInSocket(io, roomParams);
	// 									if (!IsNotification) //TODO:notification service
	// 									{
	// 										const contactUserId = await userDaoV1.findUserById(user);
	// 										let notificationData: ChatRequest.CHAT_NOTIFICATION = {
	// 											type: NOTIFICATION_TYPE.CHAT_NOTIFICATION,
	// 											title: sender?.name,
	// 											subtitle: group?.name,
	// 											message: data.translatedMessages[`${contactUserId.languageCode}`] ? data.translatedMessages[`${contactUserId.languageCode}`] : params.message,
	// 											body: data.translatedMessages[`${contactUserId.languageCode}`] ? data.translatedMessages[`${contactUserId.languageCode}`] : params.message,
	// 											details: {
	// 												chatId: params.chatId,
	// 												senderId: params.senderId,
	// 												receiverId: user,
	// 												receiverIdName: contactUserId?.name,
	// 												messageType: params.messageType,
	// 												profilePicture: group?.groupProfilePicture,
	// 												countryCode: sender.countryCode,
	// 												mobileNo: sender.mobileNo,
	// 												fullMobileNo: sender?.fullMobileNo,
	// 												type: CHAT_TYPE.GROUP,
	// 												senderName: group?.name,
	// 												flagCode: sender?.flagCode,
	// 												membersDetails: message.membersDetails ? message.membersDetails : {}
	// 											}
	// 										}
	// 										console.log('********** RepliedToGroupMessage notificationData*************', notificationData)
	// 										if (!IsNotificationMuted) await this.sendChatNotification(contactUserIdSocket, notificationData);
	// 									}
	// 								}
	// 								this.inboxChat(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: user });
	// 								this.refreshChatBox(io, contactUserIdSocket, params, ack, { userId: user });
	// 							}
	// 						}
	// 					} else {
	// 						const contactUserId = await userDaoV1.findUserById(user);
	// 						let notification_message = messageTypeInChat(params.messageType) != MESSAGE_TYPE.TEXT ? messageTypeInChat(params.messageType) : data.translatedMessages[`${contactUserId.languageCode}`] ? data.translatedMessages[`${contactUserId.languageCode}`] : params.message;
	// 						console.log('***************************notification_message***************************', notification_message)
	// 						let notificationData: ChatRequest.CHAT_NOTIFICATION = {
	// 							type: NOTIFICATION_TYPE.CHAT_NOTIFICATION,
	// 							title: sender?.name,
	// 							subtitle: group?.name,
	// 							message: notification_message,
	// 							body: notification_message,
	// 							details: {
	// 								chatId: params.chatId,
	// 								senderId: params.senderId,
	// 								receiverId: user.toString(),
	// 								receiverIdName: contactUserId?.name,
	// 								messageType: params.messageType,
	// 								profilePicture: group?.groupProfilePicture,
	// 								countryCode: sender.countryCode,
	// 								mobileNo: sender.mobileNo,
	// 								fullMobileNo: sender?.fullMobileNo,
	// 								type: CHAT_TYPE.GROUP,
	// 								senderName: group?.name,
	// 								flagCode: sender?.flagCode,
	// 								membersDetails: message.membersDetails ? message.membersDetails : {}
	// 							}
	// 						}
	// 						let contact = await userDaoV1.findOne("contacts", { userId: notificationData.details.receiverId, contactUserId: notificationData.details.senderId }, { name: 1 });
	// 						notificationData.title = contact?.name || sender.fullMobileNo;
	// 						console.log('********** RepliedToGroupMessage push notificationData*************', notificationData);
	// 						const isSubscribedUser = await this.checkUserSubscription(notificationData.details.receiverId);
	// 						if (isSubscribedUser.isSubscribed || isSubscribedUser?.expiryTime < Date.now()) {
	// 							if (!IsNotificationMuted) await sendNotification(notificationData, socket.accessToken);
	// 						}
	// 					}
	// 				}
	// 			}
	// 			return true;
	// 		} catch (error) {
	// 			throw error;
	// 		}
	// 	}

	/**
	 * @function createBroadcast
	 * create a braodcast list for coming users in params
	*/
	// async createBroadcast(io: any, socket: any, params: ChatRequest.CREATE_BROADCAST, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.contactUserIds) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		let broadCastRooms = await this.checkExistingUserRooms(params.contactUserIds, tokenData.userId);
	// 		let data: any = {
	// 			type: CHAT_TYPE.BROADCAST,
	// 			members: params.contactUserIds,
	// 			overallMembers: params.contactUserIds,
	// 			createdBy: tokenData.userId,
	// 			broadCastRooms: broadCastRooms,
	// 			lastMsgCreated: Date.now()
	// 		}
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			const chatUserInfo = await this.setUserLanguage([tokenData.userId, ...params.contactUserIds])
	// 			data.userLang = chatUserInfo.userLang;
	// 			data.langCodes = chatUserInfo.langCodes;
	// 		}
	// 		const broadcast = await chatDaoV1.save("chats", data);
	// 		const membersDetails = await userDaoV1.find("users", { _id: { $in: broadcast.members } }, { profilePicture: 1, name: 1, mobileNo: 1, countryCode: 1, about: 1, status: 1, flagCode: 1 });
	// 		broadcast.membersDetails = membersDetails;
	// 		let details: any = {}, taggedUser = [];
	// 		details.languageCode = LANGUAGE_CODE.EN;
	// 		details.message = CHAT_HEADERS.BROADCAST.CREATE(params.contactUserIds.length);
	// 		taggedUser = params.contactUserIds;
	// 		const userId = await userDaoV1.findUserById(tokenData.userId);
	// 		let isRead = [], isDelivered = [];
	// 		isRead.push(tokenData.userId);
	// 		isDelivered.push(tokenData.userId);
	// 		let save: any = {
	// 			type: CHAT_TYPE.BROADCAST,
	// 			senderId: tokenData.userId,
	// 			broadCastId: broadcast._id,
	// 			members: broadcast.members,
	// 			chatId: broadcast._id,
	// 			message: details.message,
	// 			mediaUrl: null,
	// 			messageType: MESSAGE_TYPE.HEADING,
	// 			isRead: isRead,
	// 			isDelivered: isDelivered,
	// 			thumbnailUrl: details.thumbnailUrl ? details.thumbnailUrl : null,
	// 			location: null,
	// 			size: details.size ? details.size : null,
	// 			transcribe: details.transcribe ? details.transcribe : null,
	// 			status: STATUS.ACTIVE,
	// 			taggedUser: taggedUser,
	// 			contact: null
	// 		}
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			// const translatedInfo = await broadcastTranslate(details.languageCode, userId.languageCode || details.languageCode, details.message, tokenData)
	// 			// save.translatedMessages = translatedInfo.encryptedMessages;
	// 			// save.langCodes = translatedInfo.langCodes;
	// 			// save.userLang = translatedInfo.userLang;
	// 		}
	// 		const broadcast_messages = await baseDao.save("broadcast_messages", save);
	// 		return ack(MESSAGES.SUCCESS.DETAILS(broadcast));
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function checkExistingUserRooms
	 * check whether user has formed a chat-room with coming contact userId
	*/
	async checkExistingUserRooms(contactUserIds: Array<string>, userId: string) {
		try {
			let broadCastRooms = [];
			let users = await userDaoV1.find("users", { _id: [...contactUserIds, userId] }, { _id: 1, language: 1, languageCode: 1 })
			let myData = users.find(user => String(user._id) === String(userId));
			for (let id of contactUserIds) {
				let room;
				let members = [];
				members.push(userId, id);
				room = await chatDaoV1.isChatExists(members);
				if (room) {
					broadCastRooms.push(room._id)
				} else {
					let userData = users.find(user => String(user._id) === String(id));
					if (!userData || !userData?.languageCode) continue;
					let data = {
						members: members,
						langCodes: userData.languageCode == myData.languageCode ? [myData.languageCode] : [myData.languageCode, userData.languageCode],
						userLang: [
							{
								userId: myData._id,
								languageCode: myData.languageCode
							},
							{
								userId: userData?._id,
								languageCode: userData?.languageCode
							},
						],
					}
					room = await chatDaoV1.save("chats", data);
					broadCastRooms.push(room._id);
				}
			}
			return broadCastRooms;
		} catch (error) {
			throw error
		}
	}

	/**
	 * @function joinBroadCast
	 * enter in a broadcast room for real update like add/remove headers
	*/
	// async joinBroadCast(io: any, socket: any, params: ChatRequest.VIEW_BROADCAST, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.broadCastId) {
	// 			return ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 		}
	// 		let broadcast = await chatDaoV1.findOne("chats", { _id: params.broadCastId, type: CHAT_TYPE.BROADCAST }, {});
	// 		if (!broadcast) return ack(MESSAGES.ERROR.BROADCAST_NOT_FOUND);
	// 		let data = {
	// 			chatId: broadcast?._id,
	// 			name: broadcast?.name,
	// 			chatType: broadcast?.type
	// 		}
	// 		if (!broadcast.langCodes?.length && SERVER.IS_TRANSLATION_ENABLE) {
	// 			const toUpdate: any = {}
	// 			const chatUserInfo = await this.setUserLanguage(broadcast?.members)
	// 			toUpdate["$addToSet"] = {
	// 				userLang: chatUserInfo.userLang,
	// 				langCodes: chatUserInfo.langCodes
	// 			}
	// 			await chatDaoV1.findOneAndUpdate("chats", { _id: broadcast._id }, toUpdate)
	// 		}
	// 		ack(MESSAGES.SUCCESS.CHAT_FORMATION(data));
	// 		socket.join(`${broadcast._id}`);
	// 		socket.emit(SOCKET.LISTNER_TYPE.BROADCAST.JOIN, MESSAGES.SUCCESS.CHAT_FORMATION(data));
	// 		return
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	// /**
	//  * @function viewBroadCast
	//  * view broadcast existing list of users details
	// */
	// async viewBroadCast(io: any, socket: any, params: ChatRequest.VIEW_BROADCAST, ack: any, tokenData: TokenData) {
	// 	try {
	// 		let broadcast;
	// 		if (!params.broadCastId) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		broadcast = await chatDaoV1.findOne("chats", { _id: params.broadCastId, type: CHAT_TYPE.BROADCAST }, {});
	// 		if (!broadcast) return ack(MESSAGES.ERROR.BROADCAST_NOT_FOUND);
	// 		const membersDetails = await userDaoV1.find("users", { _id: { $in: broadcast.members } }, { profilePicture: 1, name: 1, mobileNo: 1, countryCode: 1, about: 1, status: 1, flagCode: 1 })
	// 		broadcast.membersDetails = membersDetails;
	// 		return ack(MESSAGES.SUCCESS.DETAILS(broadcast));
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function editOrDeleteBroadcast
	 * delete a broadcast or edit broadcast existing list of users
	*/
	// async editOrDeleteBroadcast(io: any, socket: any, params: ChatRequest.EDIT_BROADCAST, ack: any, tokenData: TokenData) {
	// 	try {
	// 		let members = [];
	// 		if (!params.broadCastId) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		console.log('************editOrDeleteBroadcast**********', params)
	// 		let broadcast = await chatDaoV1.findOne("chats", { _id: params.broadCastId, type: CHAT_TYPE.BROADCAST }, {});
	// 		if (!broadcast) return ack(MESSAGES.ERROR.BROADCAST_NOT_FOUND);
	// 		if (params.isDelete) {
	// 			broadcast = await baseDao.findByIdAndUpdate("chats", params.broadCastId, { status: STATUS.DELETED }, { new: true });
	// 			return ack(MESSAGES.SUCCESS.BROADCAST_DELETED);
	// 		}
	// 		for (let i = 0; i < broadcast.members.length; i++) {
	// 			members.push(broadcast.members[i].toString())
	// 		}
	// 		let addedMembers = diffBw2Arrays(params.contactUserIds, members);
	// 		console.log('************editOrDeleteBroadcast**********addedMembers', addedMembers)
	// 		let removedMembers = diffBw2Arrays(members, params.contactUserIds);
	// 		console.log('************editOrDeleteBroadcast**********removedMembers', removedMembers)
	// 		let data = {
	// 			name: params.name ? params.name : broadcast.name,
	// 			members: params.contactUserIds ? params.contactUserIds : broadcast.members,
	// 			broadCastRooms: params.contactUserIds ? await this.checkExistingUserRooms(params.contactUserIds, tokenData.userId) : broadcast.broadCastRooms,
	// 			lastMsgCreated: Date.now()
	// 		}
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			const chatUserInfo = await this.setUserLanguage(addedMembers)
	// 			data["$addToSet"] = {
	// 				userLang: chatUserInfo.userLang,
	// 				langCodes: chatUserInfo.langCodes
	// 			}
	// 		}
	// 		let updated_broadcast = await baseDao.findOneAndUpdate("chats", { _id: params.broadCastId }, data, { new: true });
	// 		const membersDetails = await userDaoV1.find("users", { _id: { $in: updated_broadcast.members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 		updated_broadcast.membersDetails = membersDetails;
	// 		console.log('************editOrDeleteBroadcast**********updated_broadcast', updated_broadcast);
	// 		ack(MESSAGES.SUCCESS.DETAILS(updated_broadcast));
	// 		if (removedMembers.length) {
	// 			removedMembers.forEach((member) => {
	// 				this.setHeadersEventInBroadCast(tokenData, BROADCAST_MODE.REMOVED, member, broadcast, io)
	// 			})
	// 		}
	// 		if (addedMembers.length) {
	// 			addedMembers.forEach((member) => {
	// 				this.setHeadersEventInBroadCast(tokenData, BROADCAST_MODE.ADDED, member, updated_broadcast, io)
	// 			})
	// 		}
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	async setHeadersEventInBroadCast(tokenData: TokenData, mode, member, broadcast, io: any) {
		try {
			let details: any = {}, taggedUser = [];
			details.languageCode = LANGUAGE_CODE.EN;
			console.log(`*******member details in broadcast setHeadersEventInBroadCast*********`, member)
			if (mode == BROADCAST_MODE.REMOVED) {
				details.message = CHAT_HEADERS.BROADCAST.REMOVE(member);
			} else {
				details.message = CHAT_HEADERS.BROADCAST.ADD(member);
			}
			taggedUser.push(member);
			let isRead = [], isDelivered = [];
			isRead.push(tokenData.userId);
			isDelivered.push(tokenData.userId);
			let save: any = {
				type: CHAT_TYPE.BROADCAST,
				senderId: tokenData.userId,
				broadCastId: broadcast._id,
				members: broadcast.members,
				chatId: broadcast._id,
				message: details.message,
				mediaUrl: null,
				messageType: MESSAGE_TYPE.HEADING,
				isRead: isRead,
				isDelivered: isDelivered,
				thumbnailUrl: details.thumbnailUrl ? details.thumbnailUrl : null,
				location: null,
				size: details.size ? details.size : null,
				transcribe: details.transcribe ? details.transcribe : null,
				status: STATUS.ACTIVE,
				taggedUser: taggedUser,
				contact: null
			}
			let translatedInfo: any = {}
			if (SERVER.IS_TRANSLATION_ENABLE) {
				// translatedInfo = await translateMessage(details.languageCode, details.message, broadcast._id, tokenData, false)
				// save.translatedMessages = translatedInfo.encryptedMessages;
				// save.langCodes = translatedInfo.langCodes;
				// save.userLang = translatedInfo.userLang;
			}
			const broadcast_messages = await baseDao.save("broadcast_messages", save);
			if (SERVER.IS_TRANSLATION_ENABLE) {
				save.translatedMessages = translatedInfo.translatedMessages;
			}
			const membersDetails = await userDaoV1.find("users", { _id: { $in: broadcast.members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
			broadcast_messages.membersDetails = membersDetails;
			io.to(`${broadcast._id}`).emit(`${broadcast._id}`, {
				eventType: SOCKET.LISTNER_TYPE.BROADCAST.MESSAGES,
				data: broadcast_messages
			});
			return
		} catch (error) {
			throw error
		}
	}


	/**
	 * @function sendBroadcast
	 * send broadcast messages to list of users present in a list as one to one
	// */
	// async sendBroadcast(io: any, socket: any, params: ChatRequest.SEND_BROADCAST, ack: any, tokenData: TokenData) {
	// 	try {
	// 		let broadcast, blockedMessage = false;
	// 		if (!params.broadCastId) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		broadcast = await chatDaoV1.findOne("chats", { _id: params.broadCastId, type: CHAT_TYPE.BROADCAST }, {});
	// 		if (!broadcast) return ack(MESSAGES.ERROR.BROADCAST_NOT_FOUND);
	// 		// const broadcastRooms= await chatDaoV1.find("chats",{},{});
	// 		const broadcastRooms = await chatDaoV1.aggregate("chats", [{
	// 			$match: {
	// 				_id: { $in: broadcast.broadCastRooms }
	// 			}
	// 		},
	// 		{
	// 			"$lookup": {
	// 				from: "users",
	// 				let: {
	// 					userIds: '$members'
	// 				},
	// 				'pipeline': [{
	// 					$match: {
	// 						$expr: {
	// 							$in: ['$_id', '$$userIds']
	// 						}
	// 					},
	// 				},
	// 				{ "$project": { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, name: 1, status: 1, flagCode: 1 } }
	// 				],
	// 				as: "users"
	// 			}
	// 		}
	// 		]);
	// 		let isRead = [], isDelivered = [];
	// 		setTimeout(async () => {
	// 			if (broadcastRooms.length) {
	// 				for (let room of broadcastRooms) {
	// 					for (const user of room.users) {
	// 						if (user._id.toString() !== tokenData.userId.toString()) {
	// 							params.chatId = room._id;
	// 							params.contactUserId = user._id;
	// 							await this.sendBroadCastMessage(io, socket, params, ack, tokenData);
	// 						}
	// 					}
	// 				}
	// 				this.inboxChat(io, socket, PAGINATION_DEFAULT, ack, { userId: tokenData.userId });
	// 			}
	// 		}, 500);

	// 		//save broadcast seprate message 
	// 		isRead.push(params.senderId);
	// 		isDelivered.push(params.senderId);
	// 		let data: any = {
	// 			_id: params.localMessageId,
	// 			type: CHAT_TYPE.BROADCAST,
	// 			senderId: params.senderId,
	// 			broadCastId: params.broadCastId,
	// 			members: broadcast.members,
	// 			chatId: params.broadCastId,
	// 			message: params.message,
	// 			mediaUrl: params.mediaUrl,
	// 			messageType: params.messageType,
	// 			isRead: isRead,
	// 			isDelivered: isDelivered,
	// 			thumbnailUrl: params.thumbnailUrl ? params.thumbnailUrl : null,
	// 			location: params.location,
	// 			size: params.size ? params.size : null,
	// 			transcribe: params.transcribe ? params.transcribe : null,
	// 			status: params.status ? params.status : STATUS.ACTIVE,
	// 			blockedMessage: blockedMessage,
	// 			imageRatio: params.imageRatio,
	// 			localUrl: params.localUrl,
	// 			contact: params.contact
	// 		}
	// 		let translatedInfo: any = {}
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			// translatedInfo = params.languageCode ? await translateMessage(params.languageCode, params.message, params.broadCastId, tokenData) : await autoTranslateMessage(params.message, params.broadCastId)
	// 			// data.translatedMessages = translatedInfo.encryptedMessages;
	// 			// data.langCodes = translatedInfo.langCodes;
	// 			// data.userLang = translatedInfo.userLang;
	// 		}
	// 		const broadcast_messages = await baseDao.save("broadcast_messages", data);
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			data.translatedMessages = translatedInfo.translatedMessages;
	// 		}
	// 		await baseDao.findOneAndUpdate("chats", {
	// 			_id: params.broadCastId
	// 		}, {
	// 			lastMsgCreated: Date.now()
	// 		});
	// 		ack(broadcast_messages);
	// 		const membersDetails = await userDaoV1.find("users", { _id: { $in: broadcast.members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 		broadcast_messages.membersDetails = membersDetails;
	// 		io.to(`${broadcast._id}`).emit(`${broadcast._id}`, {
	// 			eventType: SOCKET.LISTNER_TYPE.BROADCAST.MESSAGES,
	// 			data: broadcast_messages
	// 		});
	// 		let listing = {
	// 			type: CHAT_TYPE.BROADCAST
	// 		}
	// 		this.inboxChat(io, socket, listing, ack, { userId: tokenData.userId });
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function sendBroadCastMessage
	 * send broadcast messages to list of users present in a list as one to one
	 */
	async sendBroadCastMessage(io: any, socket: any, params: ChatRequest.SEND_BROADCAST, ack: any, tokenData: TokenData) {
		try {
			if (!params.chatId || !params.contactUserId || !params.messageType || !params.senderId || !params.localMessageId) {
				ack(MESSAGES.ERROR.PARAMS_MISSING)
				return
			}
			const contactUserId = await userDaoV1.findUserById(params.contactUserId);
			if (!contactUserId) {
				ack(MESSAGES.ERROR.USER_NOT_FOUND)
			}
			const isBlocked = await this.checkUserBlockedStatus(tokenData.userId, params.contactUserId);
			// const isBlocked = await userDaoV1.findOne("users", { _id: tokenData.userId, blocked: { $in: [toObjectId(params.contactUserId)] } });
			let deletedBy = [], isDelivered = [], isRead = [];
			const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + (params.contactUserId).toString() + REDIS_KEY_PREFIX.SOCKET_ID);
			if (isBlocked) {
				return { success: false, data: {} };
				// send no messages to blocked user
			} else if (socket_user) {
				isDelivered.push(params.contactUserId);
				const scoketIds = await io.in(socket_user).fetchSockets();
				for (const socket of scoketIds) {
					if (socket?.rooms?.has(`${params.chatId}`)) isRead.push(params.contactUserId);
				}
			}
			let members = [];
			isDelivered.push(params.senderId)
			isRead.push(params.senderId)
			members.push(tokenData.userId, params.contactUserId);
			let data: any = {
				type: CHAT_TYPE.BROADCAST,
				senderId: params.senderId,
				broadCastId: params.broadCastId,
				members: members,
				chatId: params.chatId,
				message: params.message,
				mediaUrl: params.mediaUrl,
				messageType: params.messageType,
				isRead: isRead,
				isDelivered: isDelivered,
				thumbnailUrl: params.thumbnailUrl ? params.thumbnailUrl : null,
				location: params.location,
				size: params.size ? params.size : null,
				transcribe: params.transcribe ? params.transcribe : null,
				status: params.status ? params.status : STATUS.ACTIVE,
				deletedBy: deletedBy,
				imageRatio: params.imageRatio,
				localUrl: params.localUrl,
				contact: params.contact
			}
			let translatedInfo: any = {}
			if (SERVER.IS_TRANSLATION_ENABLE) {
				// translatedInfo = await translateMessageByUser(params.languageCode, params.message, params.contactUserId, tokenData)
				// data.translatedMessages = translatedInfo.encryptedMessages;
				// data.langCodes = translatedInfo.langCodes;
				// data.userLang = translatedInfo.userLang;
			}
			const message = await baseDao.save("messages", data);
			if (SERVER.IS_TRANSLATION_ENABLE) {
				data.translatedMessages = translatedInfo.translatedMessages;
			}
			await baseDao.findOneAndUpdate("chats", {
				_id: params.chatId
			}, {
				lastMsgId: message._id,
				lastMsgCreated: Date.now(),
				deletedBy: []
			}, { new: true });
			const membersDetails = await userDaoV1.find("users", { _id: { $in: members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });

			message.membersDetails = membersDetails;
			const isReceiverArchive = await chatDaoV1.findOne("chats", { _id: params.chatId, type: CHAT_TYPE.ONE_TO_ONE, acrhivedBy: { $in: [params.contactUserId] } });
			socket.to(`${params.chatId}`).emit(`${params.chatId}`, {
				eventType: SOCKET.LISTNER_TYPE.SOCKET_SERVICE.ONE_TO_ONE_CHAT,
				data: message
			});
			let IsNotificationMuted = await this.checkforChatNotification(params.contactUserId, params.chatId);
			const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;//io.sockets.sockets.get(socket_user);
			const sender = await userDaoV1.findUserById(params.senderId);
			let notification_message = messageTypeInChat(params.messageType) != MESSAGE_TYPE.TEXT ? messageTypeInChat(params.messageType) : data.translatedMessages[`${contactUserId.languageCode}`] ? data.translatedMessages[`${contactUserId.languageCode}`] : params.message;
			console.log('***************************notification_message***************************', notification_message)
			if (contactUserIdSocket) {
				if (isReceiverArchive) {
					// this.inboxArchive(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: params.contactUserId });
					this.refreshArchiveChatBox(io, contactUserIdSocket, params, ack, { userId: params.contactUserId });
				} else {
					let roomParams = {
						chatId: params.chatId,
						socketId: socket_user
					};
					let IsNotification = await this.checkUserRoomInSocket(io, roomParams);
					if (!IsNotification) {
						let notificationData: ChatRequest.CHAT_NOTIFICATION = {
							type: NOTIFICATION_TYPE.CHAT_NOTIFICATION,
							title: sender?.name,
							message: data.translatedMessages[`${contactUserId.languageCode}`] ? data.translatedMessages[`${contactUserId.languageCode}`] : params.message,
							body: data.translatedMessages[`${contactUserId.languageCode}`] ? data.translatedMessages[`${contactUserId.languageCode}`] : params.message,
							details: {
								chatId: params.chatId,
								senderId: params.senderId,
								receiverId: params.contactUserId,
								receiverIdName: contactUserId?.name,
								messageType: params.messageType,
								profilePicture: sender?.profilePicture,
								countryCode: sender.countryCode,
								mobileNo: sender.mobileNo,
								fullMobileNo: sender?.fullMobileNo,
								type: CHAT_TYPE.ONE_TO_ONE,
								senderName: sender?.name,
								flagCode: sender?.flagCode,
								membersDetails: message.membersDetails ? message.membersDetails : {}
							}
						}
						if (!IsNotificationMuted) await this.sendChatNotification(contactUserIdSocket, notificationData);
					}
					this.inboxChat(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: params.contactUserId });
					this.refreshChatBox(io, contactUserIdSocket, params, ack, { userId: params.contactUserId });
				}
			} else {
				let notificationData: ChatRequest.CHAT_NOTIFICATION = {
					type: NOTIFICATION_TYPE.CHAT_NOTIFICATION,
					title: sender?.name,
					message: notification_message,
					body: notification_message,
					details: {
						chatId: params.chatId,
						senderId: params.senderId,
						receiverId: params.contactUserId,
						receiverIdName: contactUserId?.name,
						messageType: params.messageType,
						profilePicture: sender?.profilePicture,
						countryCode: sender.countryCode,
						mobileNo: sender.mobileNo,
						fullMobileNo: sender?.fullMobileNo,
						type: CHAT_TYPE.ONE_TO_ONE,
						senderName: sender?.name,
						flagCode: sender?.flagCode,
						membersDetails: message.membersDetails ? message.membersDetails : {}
					}
				}
				let contact = await userDaoV1.findOne("contacts", { userId: notificationData.details.receiverId, contactUserId: notificationData.details.senderId }, { name: 1 });
				notificationData.title = contact?.name || notificationData.details.fullMobileNo;
				notificationData.details.senderName = contact?.name || notificationData.details.fullMobileNo;
				console.log('********** sendGroupMessage push notificationData*************', notificationData);
				const isSubscribedUser = await this.checkUserSubscription(notificationData.details.receiverId);
				if (isSubscribedUser.isSubscribed || isSubscribedUser?.expiryTime < Date.now()) {
					if (!IsNotificationMuted) await sendNotification(notificationData, socket.accessToken);
				}
			}
			return { success: true, data: { isDelivered: isDelivered, contactUserId: contactUserId, members: members } };
		} catch (error) {
			throw error;
		}
	}

	// 	/**
	//  * @function inboxBroadCast
	//  * get inbox messages for a chat of a user in a room
	//  */
	// 	async inboxBroadCast(io: any, socket: any, params: ChatRequest.BroadCastMessage, ack: any, tokenData: TokenData) {
	// 		try {
	// 			params.pageNo = PAGINATION_DEFAULT.pageNo;
	// 			if (!params.limit || !params.broadCastId) {
	// 				ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 				return
	// 			}
	// 			let lastMessageCreated = Date.now();
	// 			if (params.lastMsgId) {
	// 				const lastMessage = await baseDao.findOne("broadcast_messages", { _id: params.lastMsgId });
	// 				if (lastMessage) lastMessageCreated = lastMessage.created;
	// 			}
	// 			const userId = tokenData.userId;
	// 			params.lastMessageCreated = lastMessageCreated;
	// 			const chatId = await chatDaoV1.findChatById(params.broadCastId)
	// 			const data = await chatDaoV1.inboxBroadCastMessage(params, userId);
	// 			if (data) {
	// 				delete data.pageNo; delete data.totalPage; delete data.total;
	// 			}
	// 			const members = await baseDao.distinct("broadcast_messages", "members", { chatId: params.broadCastId });
	// 			console.log(`******** inboxBroadCast members in broadcast **********`, members);
	// 			const membersDetails = await userDaoV1.find("users", { _id: { $in: members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });

	// 			for (const element of data.data) {
	// 				for (const user of element.membersDetails) {
	// 					for (let memb of membersDetails) {
	// 						if (user._id.toString() == memb._id.toString()) {
	// 							user.name = memb.name ? memb.name : user.name
	// 						}
	// 					}
	// 				}
	// 			}
	// 			socket.emit(SOCKET.LISTNER_TYPE.BROADCAST.VIEW_MESSAGE, MESSAGES.SUCCESS.LIST(data))
	// 			ack(MESSAGES.SUCCESS.LIST(data));
	// 			return
	// 		} catch (error) {
	// 			throw error;
	// 		}
	// 	}

	/**
	 * @function updateUserLastSeen
	 * update user last seen when he disconnect his socket
	 */
	async updateUserLastSeen(params: ChatRequest.userId) {
		try {
			const user = await baseDao.findOneAndUpdate("users", {
				_id: params.userId
			}, { lastSeen: Date.now() });
			return
		} catch (error) {
			throw error;
		}
	}


	/**
	 * @function messageList
	 */
	async messageList(params: ChatRequest.MessageList, tokenData: TokenData) {
		try {
			const userId = tokenData.userId;
			const data = await chatDaoV1.messageList(params, tokenData);
			return MESSAGES.SUCCESS.LIST({ data });
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function inboxMessages
	 * get inbox messages for a chat of a user in a room
	 */
	async inboxMessages(io: any, socket: any, params: ChatRequest.MessageList, ack: any, tokenData: TokenData) {
		try {
			consolelog(`${params.chatId} inboxMessages emit timer`, Date.now(), true);
			params.pageNo = PAGINATION_DEFAULT.pageNo;
			if (!params.limit || !params.chatId) {
				ack(MESSAGES.ERROR.PARAMS_MISSING)
				return
			}
			let lastMessageCreated = Date.now();
			if (params.lastMsgId) {
				const lastMessage = await baseDao.findOne("messages", { _id: params.lastMsgId });
				if (lastMessage) lastMessageCreated = lastMessage.created;
			}
			const userId = tokenData.userId;
			params.lastMessageCreated = lastMessageCreated;
			await baseDao.updateMany("messages", { chatId: params.chatId, isDelivered: { $nin: [toObjectId(tokenData.userId)] } }, { $addToSet: { isDelivered: toObjectId(tokenData.userId) } }, {})
			await baseDao.updateMany("messages", { chatId: params.chatId, isRead: { $nin: [toObjectId(tokenData.userId)] } }, { $addToSet: { isRead: toObjectId(tokenData.userId) } }, {})
			const data = await chatDaoV1.messageList(params, tokenData);
			if (data) {
				delete data.pageNo; delete data.totalPage; delete data.total;
			}
			const members = await baseDao.distinct("messages", "members", { chatId: params.chatId });
			console.log(`******** inboxMessages members in messages **********`, members);
			const membersDetails = await userDaoV1.find("users", { _id: { $in: members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
			for (const element of data.data) {
				for (const user of element.membersDetails) {
					for (let memb of membersDetails) {
						if (user._id.toString() == memb._id.toString()) {
							user.name = memb.name ? memb.name : user.name
						}
					}
				}
			}

			socket.emit(SOCKET.LISTNER_TYPE.CHAT.MESSAGE, MESSAGES.SUCCESS.LIST(data))
			ack(MESSAGES.SUCCESS.LIST(data));
			socket.broadcast.to(`${params.chatId}`).emit(`${params.chatId}`, {
				eventType: SOCKET.LISTNER_TYPE.MESSAGE.READ,
				data: {
					chatId: params.chatId
				}
			});
			consolelog(`${params.chatId} inboxMessages delivered timer`, Date.now(), true);
			this.inboxChat(io, socket, PAGINATION_DEFAULT, ack, tokenData);
			this.unreadNotify(io, socket, {}, ack, tokenData);
			return
		} catch (error) {
			throw error;
		}
	}


	/**
	 * @function deleteChat
	 * delete chat for me and clear chat for me
	 */
	// async deleteChat(io: any, socket: any, params: ChatRequest.ChatId, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.chatId) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		const isChatExist = await chatDaoV1.findChatById(params.chatId);
	// 		if (!isChatExist) {
	// 			ack(SOCKET.LISTNER_TYPE.CHAT.DELETE, MESSAGES.ERROR.CHAT_NOT_FOUND)
	// 			return
	// 		}
	// 		let listing = {}
	// 		const isArchive = await chatDaoV1.findOne("chats", { _id: params.chatId, acrhivedBy: { $in: [tokenData.userId] } });
	// 		if (params.isClearChat) {
	// 			await chatDaoV1.deleteMessages(params, tokenData)
	// 			ack(MESSAGES.SUCCESS.DELETE_CHAT);
	// 			if (isArchive) {
	// 				listing = {
	// 					status: STATUS.ARCHIVED
	// 				}
	// 				this.inboxChat(io, socket, listing, ack, { userId: tokenData.userId });
	// 			} else {
	// 				this.inboxChat(io, socket, listing, ack, { userId: tokenData.userId });
	// 				// this.refreshChatBox(io, socket, params, ack, { userId: tokenData.userId });
	// 			}
	// 			return
	// 		}
	// 		await chatDaoV1.deleteChat(params, tokenData)
	// 		await chatDaoV1.deleteMessages(params, tokenData);
	// 		ack(MESSAGES.SUCCESS.DELETE_CHAT)
	// 		if (isArchive) {
	// 			listing = {
	// 				status: STATUS.ARCHIVED
	// 			}
	// 			this.inboxChat(io, socket, listing, ack, { userId: tokenData.userId });
	// 		} else {
	// 			this.inboxChat(io, socket, listing, ack, { userId: tokenData.userId });
	// 			// this.refreshChatBox(io, socket, params, ack, { userId: tokenData.userId });
	// 		}
	// 		return
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function lastActiveMsgInChat
	 * check last message for a user in a chat after deletion of message
	 */
	async lastActiveMsgInChatForUser(chatId: string, userId: string) {
		try {
			const messageDetail = await baseDao.findOne("messages", {
				chatId: chatId, deletedBy: { $nin: [toObjectId(userId)] }
			}, {}, {}, { created: -1 });
			return messageDetail
		} catch (error) {
			throw error
		}
	}

	/**
	 * @function updateLastMsgInChat
	 * check last message for a user in a chat after deletion of message if exists update otherwise push to lastMsgIdByUsers for that user
	 */
	async updateLastMsgInChatForUser(messageDetail: any, userId: string) {
		try {
			const update = await baseDao.findOneAndUpdate("chats", { _id: messageDetail.chatId, lastMsgIdByUsers: { $elemMatch: { userId: userId } } }, { "lastMsgIdByUsers.$.lastMsgId": [messageDetail] });
			if (!update && messageDetail) {
				await baseDao.findOneAndUpdate("chats", { _id: messageDetail.chatId }, {
					$push: {
						lastMsgIdByUsers: [{
							userId: userId,
							lastMsgId: [messageDetail]
						}]
					}
				});
			}
		} catch (error) {
			throw error
		}
	}


	/**
	 * @function deleteMessages
	 * delete a message for me and everyone in a chat
	 */
	// async deleteMessages(io: any, socket: any, params: ChatRequest.DeleteMessages, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.messageId.length) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		if (!params.isDeleteForEveryone) params.isDeleteForEveryone = false;
	// 		let messageId = await baseDao.findOne("messages", { _id: params.messageId }, {});
	// 		consolelog('__delete_message', messageId, false);
	// 		messageId = await chatDaoV1.deleteMessagesById(params, tokenData);
	// 		const membersDetails = await userDaoV1.find("users", { _id: { $in: messageId.members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });

	// 		messageId.membersDetails = membersDetails;
	// 		ack(MESSAGES.SUCCESS.DELETE_MESSAGE);
	// 		if (params.isDeleteForEveryone) { // send to everyone
	// 			io.to(`${messageId.chatId}`).emit(`${messageId.chatId}`, {
	// 				eventType: SOCKET.LISTNER_TYPE.MESSAGE.DELETE_MESSAGE,
	// 				data: messageId
	// 			});
	// 		} else { //send to only socket who deleted message
	// 			socket.emit(`${messageId.chatId}`, {
	// 				eventType: SOCKET.LISTNER_TYPE.MESSAGE.DELETE_MESSAGE,
	// 				data: messageId
	// 			});
	// 		}
	// 		/*refresh chat list for chatId members*/
	// 		for (let user of messageId.members) {
	// 			const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + user + REDIS_KEY_PREFIX.SOCKET_ID);
	// 			if (socket_user) {
	// 				const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;//io.sockets.sockets.get(socket_user);
	// 				if (contactUserIdSocket) {
	// 					const isReceiverArchive = await chatDaoV1.findOne("chats", { _id: messageId.chatId, acrhivedBy: { $in: [user] } });
	// 					if (isReceiverArchive) {
	// 						// this.inboxArchive(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: user });
	// 						// this.refreshArchiveChatBox(io, contactUserIdSocket, {chatId: messageId.chatId}, ack, { userId: user });
	// 					} else {
	// 						this.inboxChat(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: user });
	// 						// this.refreshChatBox(io, contactUserIdSocket, {chatId: messageId.chatId}, ack, { userId: user });
	// 					}
	// 				}
	// 			}
	// 		}
	// 		return
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function chatProfile
	 * get chat profile for a user with media details
	 */
	async chatProfile(params: ChatRequest.Id, tokenData: TokenData) {
		try {
			const step1 = await baseDao.findOne("users", {
				_id: toObjectId(params.contactUserId)
			},
				{ profilePicture: 1, name: 1, mobileNo: 1, countryCode: 1, about: 1, status: 1, flagCode: 1, isSubscribed: 1 }
			);
			const isBlocked = await this.checkUserBlockedStatus(tokenData.userId, params.contactUserId);
			// const isBlocked = await userDaoV1.findOne("users", { _id: tokenData.userId, blocked: { $in: [toObjectId(params.contactUserId)] } });
			step1.status = isBlocked ? STATUS.BLOCKED : STATUS.UN_BLOCKED;
			const contactName = await userDaoV1.findOne("contacts", { userId: tokenData.userId, contactUserId: params.contactUserId }, { name: 1 });
			step1.name = contactName?.name || step1.name;
			if (!step1) return Promise.reject(MESSAGES.ERROR.USER_NOT_FOUND);

			const currentUser = await baseDao.findOne("users", {
				_id: toObjectId(tokenData.userId)
			},
				{ profilePicture: 1, name: 1, mobileNo: 1, countryCode: 1, about: 1, status: 1, flagCode: 1, isSubscribed: 1 }
			);
			if (!currentUser) return Promise.reject(MESSAGES.ERROR.USER_NOT_FOUND);


			const step2 = await chatDaoV1.mediaList(params, tokenData.userId, currentUser?.isSubscribed);
			let param: any = {};
			param.members = { $all: [toObjectId(params.contactUserId), toObjectId(tokenData.userId)] }
			param.deletedBy = { $nin: [toObjectId(tokenData.userId)] }
			param.status = { $in: [STATUS.ACTIVE, STATUS.FORWARDED, STATUS.REPLIED] }
			param.messageType = { $in: [MESSAGE_TYPE.IMAGE] }
			const step3 = await chatDaoV1.countDocuments("messages", param);
			let data = {
				userDetails: step1,
				mediaDetails: step2,
				totalMediaTypes: step3
			}
			return MESSAGES.SUCCESS.LIST({ data: data });
		} catch (error) {
			throw error;
		}
	}


	/** 
	 * @function isParticipantSubscribed
	 * return false if ONE of the user not subscribed, return true if all the user is subscribed
	*/
	async isParticipantSubscribed(userIds: string[]) {
		const users = await baseDao.find("users", {
			"_id": {
				"$in": userIds
			}
		}, {})
		if (users) {
			const notSubscribed = users.some(function (el) {
				return el.isSubscribed !== true;
			});
			return notSubscribed ? false : true;
		}
		return false
	}

	// /** 
	//  * @function callInitiate
	//  * start call with respective chatId for both groups and personal call
	// */
	// async callInitiate(io: any, socket: any, params: ChatRequest.CallInitiate, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.chatId || !params.mode) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		const isUserExist = await userDaoV1.findUserById(tokenData.userId)
	// 		if (!isUserExist) return ack(MESSAGES.ERROR.USER_NOT_FOUND);
	// 		const group = await chatDaoV1.findOne("chats", { _id: params.chatId, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!group) return ack(MESSAGES.ERROR.CHAT_NOT_FOUND);
	// 		const groupUser: any = await chatDaoV1.findOne("chats", { _id: params.chatId, members: { $in: tokenData.userId } });
	// 		if (!groupUser) return ack(MESSAGES.ERROR.USER_NOT_FOUND);

	// 		let isDelivered = [], isRead = [], members = [];
	// 		isRead.push(params.userId);
	// 		isDelivered.push(params.userId);
	// 		members = group.members;
	// 		const isSubscribed = await this.isParticipantSubscribed(members)
	// 		const toReturn: any = {};
	// 		// const result: any = await imageUtil.createMeeting(tokenData);
	// 		// if (!result) return Promise.reject(MESSAGES.ERROR.SOMETHING_WENT_WRONG)
	// 		let callEndTime = null, callEndAlert = null;
	// 		// toReturn.Meeting = result.Meeting,
	// 		// 	toReturn.type = group.type,
	// 		// 	toReturn.mode = params.mode,
	// 		// 	toReturn.members = groupUser.members,
	// 		// 	toReturn.Attendee = result.Attendees[0];
	// 		toReturn.chatId = params.chatId;
	// 		if (!isSubscribed) {
	// 			const subscriptionConfig = await baseDao.findOne("subscription_configs", { name: SUBSCRIPTION_CONFIG.FREE })
	// 			const callLimitInSeconds = subscriptionConfig ? subscriptionConfig?.callLimitInSeconds : DEFAULT_CONFIG.callLimitInSeconds
	// 			const callLimitAlertInSeconds = subscriptionConfig ? subscriptionConfig?.callLimitAlertInSeconds : DEFAULT_CONFIG.callLimitAlertInSeconds
	// 			callEndTime = +new Date(Date.now() + Number(callLimitInSeconds) * 1000);
	// 			callEndAlert = +new Date(Date.now() + Number(callLimitInSeconds - callLimitAlertInSeconds) * 1000);
	// 		}
	// 		toReturn.callEndTime = callEndTime;
	// 		toReturn.callEndAlert = callEndAlert;
	// 		ack(toReturn);
	// 		// await redisClient.storeValue(SERVER.APP_NAME + "_" + params.chatId + REDIS_KEY_PREFIX.MEETING, result.Meeting);
	// 		let isBlocked: boolean = false;
	// 		if (group.type === CHAT_TYPE.ONE_TO_ONE) {
	// 			let toCheck = groupUser.members
	// 			toCheck = toCheck.filter((objectId) => objectId.toString() !== tokenData.userId.toString());
	// 			const isBlockedData = await userDaoV1.findOne("users", { _id: toCheck, blocked: { $in: [toObjectId(tokenData.userId)] } });
	// 			if (isBlockedData)
	// 				isBlocked = true;
	// 		}
	// 		if (!isBlocked) {
	// 			const toEmit: any = {};
	// 			toEmit.Meeting = "",
	// 				toEmit.type = group.type,
	// 				toEmit.mode = params.mode,
	// 				toEmit.chatId = params.chatId,
	// 				toEmit.userId = tokenData.userId,
	// 				toEmit.members = groupUser.members,
	// 				toEmit.eventType = SOCKET.LISTNER_TYPE.SOCKET_SERVICE.CALL_INITIATE;
	// 			toEmit.members = groupUser.members,
	// 				toEmit.callEndTime = callEndTime;
	// 			toEmit.callEndAlert = callEndAlert;
	// 			if (group.type == CHAT_TYPE.ONE_TO_ONE) {
	// 				const receiverId = groupUser.members[0].toString() == tokenData.userId.toString() ? groupUser.members[1] : groupUser.members[0]
	// 				const contactData = await userDaoV1.findOne("contacts", { contactUserId: tokenData.userId, userId: receiverId })
	// 				if (contactData) {
	// 					toEmit.name = contactData.name
	// 					toEmit.profilePicture = contactData.profilePicture
	// 					// toEmit.badgeFrame = await badgeDaoV1.getUserBadge(isUserExist.badgeFrameId)
	// 				}
	// 				toEmit.mobileNo = isUserExist.mobileNo
	// 				toEmit.countryCode = isUserExist.countryCode

	// 				const contactUserId = await userDaoV1.findUserById(receiverId);

	// 				const [isLanguageExist, isLanguageExistForReceiver] = await Promise.all([
	// 					baseDao.findOne("chat_languages", { userId: tokenData.userId, languageCode: contactUserId?.languageCode }),
	// 					baseDao.findOne("chat_languages", { userId: receiverId, languageCode: isUserExist?.languageCode })
	// 				])
	// 				if (!isLanguageExist && isUserExist?.languageCode !== contactUserId?.languageCode) {
	// 					// await badgeDaoV1.handleAchievementUpdate('talking_tounge', +1, tokenData.userId)
	// 					const params = {
	// 						userId: toObjectId(tokenData.userId),
	// 						languageCode: contactUserId.languageCode,
	// 						created: Date.now()
	// 					}
	// 					await baseDao.save("chat_languages", params);
	// 				}
	// 				if (!isLanguageExistForReceiver && isUserExist?.languageCode !== contactUserId?.languageCode) {
	// 					// await badgeDaoV1.handleAchievementUpdate('talking_tounge', +1, receiverId)
	// 					const params = {
	// 						userId: toObjectId(receiverId),
	// 						languageCode: isUserExist?.languageCode,
	// 						created: Date.now()
	// 					}
	// 					await baseDao.save("chat_languages", params);
	// 				}

	// 			}
	// 			else {
	// 				toEmit.name = groupUser.name
	// 			}
	// 			for (let element of groupUser.members) {
	// 				if (element.toString() !== tokenData.userId.toString()) {
	// 					// const isSubscribedUser = await this.checkUserSubscription(element.toString())
	// 					// if (isSubscribedUser.isSubscribed || isSubscribedUser?.expiryTime < Date.now()) {
	// 					// const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + (element).toString()+REDIS_KEY_PREFIX.SOCKET_ID);
	// 					// const contactUserIdSocket = io.sockets.sockets.get((socket_user));
	// 					// if (contactUserIdSocket) contactUserIdSocket.emit(SOCKET.LISTNER_TYPE.SOCKET_SERVICE.CALL_INITIATE, toEmit);
	// 					// else{
	// 					toEmit.receiverId = element;
	// 					let notificationData = {
	// 						type: NOTIFICATION_TYPE.CALL_NOTIFICATION,
	// 						title: toEmit.name || `${toEmit.countryCode} ${toEmit.mobileNo}`,
	// 						message: params.mode,
	// 						body: params.mode,
	// 						details: { ...toEmit, isCall: true }
	// 					}
	// 					await sendNotification(notificationData, socket.accessToken);

	// 					// }
	// 					// }
	// 				}
	// 			}
	// 		}
	// 		return true;
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	// /** 
	//  * @function callDecline
	//  * decline call with respective to chatId
	// */
	// async callDecline(io: any, socket: any, params: ChatRequest.CallDecline, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.chatId) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		const isUserExist = await userDaoV1.findUserById(tokenData.userId)
	// 		if (!isUserExist) return ack(MESSAGES.ERROR.USER_NOT_FOUND);
	// 		const group = await chatDaoV1.findOne("chats", { _id: params.chatId, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!group) return ack(MESSAGES.ERROR.CHAT_NOT_FOUND);
	// 		const groupUser: any = await chatDaoV1.findOne("chats", { _id: params.chatId, members: { $in: tokenData.userId } });
	// 		if (!groupUser) return ack(MESSAGES.ERROR.USER_NOT_FOUND);

	// 		let members = [];
	// 		members = group.members;
	// 		const toEmit: any = {};
	// 		toEmit.type = group.type;
	// 		toEmit.eventType = SOCKET.LISTNER_TYPE.SOCKET_SERVICE.CALL_DECLINE;
	// 		toEmit.userId = tokenData.userId;
	// 		toEmit.chatId = params.chatId;

	// 		ack(toEmit);
	// 		for (let element of groupUser.members) {
	// 			if (element.toString() !== tokenData.userId.toString()) {
	// 				const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + (element).toString() + REDIS_KEY_PREFIX.SOCKET_ID);
	// 				const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;//io.sockets.sockets.get((socket_user));
	// 				if (contactUserIdSocket) contactUserIdSocket.emit(SOCKET.LISTNER_TYPE.SOCKET_SERVICE.CALL_DECLINE, toEmit);
	// 				else {
	// 					toEmit.receiverId = element;
	// 					let notificationData = {
	// 						type: NOTIFICATION_TYPE.DECLINE_NOTIFICATION,
	// 						title: isUserExist.name,
	// 						message: "Call Ended",
	// 						body: "Call Ended",
	// 						details: { ...toEmit, isCall: true }
	// 					}
	// 					await sendNotification(notificationData, socket.accessToken);
	// 				}
	// 			}
	// 		}

	// 		return true;
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	// /** 
	//  * @function videoCallRequest
	//  * send video call request to every second user
	// */
	// async videoCallRequest(io: any, socket: any, params: ChatRequest.VideoCallRequest, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.chatId) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		const isUserExist = await userDaoV1.findUserById(tokenData.userId)
	// 		if (!isUserExist) return ack(MESSAGES.ERROR.USER_NOT_FOUND);
	// 		const group = await chatDaoV1.findOne("chats", { _id: params.chatId, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!group) return ack(MESSAGES.ERROR.CHAT_NOT_FOUND);
	// 		const groupUser: any = await chatDaoV1.findOne("chats", { _id: params.chatId, members: { $in: tokenData.userId } });
	// 		if (!groupUser) return ack(MESSAGES.ERROR.USER_NOT_FOUND);

	// 		let members = [];
	// 		members = group.members;
	// 		const toEmit: any = {};
	// 		toEmit.type = group.type;
	// 		toEmit.eventType = SOCKET.LISTNER_TYPE.SOCKET_SERVICE.VIDEO_CALL_REQUEST;
	// 		toEmit.userId = tokenData.userId;
	// 		toEmit.chatId = params.chatId;

	// 		ack(toEmit);
	// 		for (let element of groupUser.members) {
	// 			if (element.toString() !== tokenData.userId.toString()) {
	// 				const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + (element).toString() + REDIS_KEY_PREFIX.SOCKET_ID);
	// 				const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;//io.sockets.sockets.get((socket_user));
	// 				if (contactUserIdSocket) contactUserIdSocket.emit(SOCKET.LISTNER_TYPE.SOCKET_SERVICE.VIDEO_CALL_REQUEST, toEmit);
	// 				else {
	// 					consolelog(`************Push notification for video call request****************`, element, true);
	// 				}
	// 			}
	// 		}

	// 		return true;
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	// /** 
	//  * @function videoCallStatus
	//  * accept/reject video call status
	// */
	// async videoCallStatus(io: any, socket: any, params: ChatRequest.VideoCallStatus, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.chatId || params.isAccept === undefined) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		const isUserExist = await userDaoV1.findUserById(tokenData.userId)
	// 		if (!isUserExist) return ack(MESSAGES.ERROR.USER_NOT_FOUND);
	// 		const group = await chatDaoV1.findOne("chats", { _id: params.chatId, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!group) return ack(MESSAGES.ERROR.CHAT_NOT_FOUND);
	// 		const groupUser: any = await chatDaoV1.findOne("chats", { _id: params.chatId, members: { $in: tokenData.userId } });
	// 		if (!groupUser) return ack(MESSAGES.ERROR.USER_NOT_FOUND);

	// 		let members = [];
	// 		members = group.members;
	// 		const toEmit: any = {};
	// 		toEmit.type = group.type;
	// 		toEmit.eventType = SOCKET.LISTNER_TYPE.SOCKET_SERVICE.VIDEO_CALL_STATUS;
	// 		toEmit.userId = tokenData.userId;
	// 		toEmit.isAccept = params.isAccept;
	// 		toEmit.chatId = params.chatId;

	// 		ack(toEmit);
	// 		for (let element of groupUser.members) {
	// 			if (element.toString() !== tokenData.userId.toString()) {
	// 				const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + (element).toString() + REDIS_KEY_PREFIX.SOCKET_ID);
	// 				const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;//io.sockets.sockets.get((socket_user));
	// 				if (contactUserIdSocket) contactUserIdSocket.emit(SOCKET.LISTNER_TYPE.SOCKET_SERVICE.VIDEO_CALL_STATUS, toEmit);
	// 				else {
	// 					consolelog(`************Push notification for video call status****************`, element, true);
	// 				}
	// 			}
	// 		}

	// 		return true;
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	// /** 
	//  * @function callAccept
	//  * receive call
	// */
	// async callAccept(io: any, socket: any, params: ChatRequest.CallAccept, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.chatId) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		const isUserExist = await userDaoV1.findUserById(tokenData.userId)
	// 		if (!isUserExist) return ack(MESSAGES.ERROR.USER_NOT_FOUND);
	// 		const group = await chatDaoV1.findOne("chats", { _id: params.chatId, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!group) return ack(MESSAGES.ERROR.CHAT_NOT_FOUND);
	// 		const toEmit: any = {};
	// 		toEmit.type = group.type;
	// 		toEmit.eventType = SOCKET.LISTNER_TYPE.SOCKET_SERVICE.CALL_ACCEPT;
	// 		toEmit.userId = tokenData.userId;
	// 		toEmit.chatId = params.chatId;

	// 		ack(toEmit);
	// 		return true;
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }



	// /** 
	//  * @function transcriptionMessage
	//  * receive transcription from source language and distributed it to other parties
	// */
	// async transcriptionMessage(io: any, socket: any, params: ChatRequest.TranscriptionRequest, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.chatId || !params.sourceLanguageCode || !params.transcript) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		const isUserExist = await userDaoV1.findUserById(tokenData.userId)
	// 		if (!isUserExist) return ack(MESSAGES.ERROR.USER_NOT_FOUND);
	// 		const chat = await chatDaoV1.findOne("chats", { _id: params.chatId, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!chat) return ack(MESSAGES.ERROR.CHAT_NOT_FOUND);

	// 		const toEmit: any = {};
	// 		toEmit.type = chat.type;
	// 		toEmit.eventType = SOCKET.LISTNER_TYPE.TRANSCRIPTION.MESSAGE;
	// 		toEmit.userId = tokenData.userId;
	// 		toEmit.chatId = params.chatId;
	// 		toEmit.transcript = params.transcript;
	// 		toEmit.sourceLanguageCode = params.sourceLanguageCode;
	// 		ack(toEmit);
	// 		//broadcast to all the user in the call
	// 		toEmit.eventType = SOCKET.LISTNER_TYPE.TRANSCRIPTION.ON_MESSAGE;
	// 		for (let element of chat.members) {
	// 			if (element.toString() !== tokenData.userId.toString()) {
	// 				const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + (element).toString() + REDIS_KEY_PREFIX.SOCKET_ID);
	// 				const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;//io.sockets.sockets.get((socket_user));
	// 				if (contactUserIdSocket) contactUserIdSocket.emit(SOCKET.LISTNER_TYPE.TRANSCRIPTION.ON_MESSAGE, toEmit);

	// 			}
	// 		}
	// 		await baseDao.insert("call_transcripts", {
	// 			chatId: params.chatId,
	// 			userId: tokenData.userId,
	// 			transcript: params.transcript,
	// 			sourceLanguageCode: params.sourceLanguageCode
	// 		}, {})
	// 		return true;
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	// /** 
	//  * @function transcriptVoiceOverConfig
	//  * receive transcriptVoiceOverConfig and distributed it to other parties
	// */
	// async transcriptVoiceOverConfig(io: any, socket: any, params: ChatRequest.VoiceOverConfigRequest, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.chatId) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		const isUserExist = await userDaoV1.findUserById(tokenData.userId)
	// 		if (!isUserExist) return ack(MESSAGES.ERROR.USER_NOT_FOUND);
	// 		const chat = await chatDaoV1.findOne("chats", { _id: params.chatId, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!chat) return ack(MESSAGES.ERROR.CHAT_NOT_FOUND);

	// 		const toEmit: any = {};
	// 		toEmit.type = chat.type;
	// 		toEmit.eventType = SOCKET.LISTNER_TYPE.TRANSCRIPTION.VOICE_OVER_CONFIG;
	// 		toEmit.userId = tokenData.userId;
	// 		toEmit.chatId = params.chatId;
	// 		toEmit.active = params.active;
	// 		ack(toEmit);
	// 		//broadcast to all the user in the call
	// 		toEmit.eventType = SOCKET.LISTNER_TYPE.TRANSCRIPTION.ON_VOICE_OVER_CONFIG;
	// 		for (let element of chat.members) {
	// 			if (element.toString() !== tokenData.userId.toString()) {
	// 				const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + (element).toString() + REDIS_KEY_PREFIX.SOCKET_ID);
	// 				const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;//io.sockets.sockets.get((socket_user));
	// 				if (contactUserIdSocket) contactUserIdSocket.emit(SOCKET.LISTNER_TYPE.TRANSCRIPTION.ON_VOICE_OVER_CONFIG, toEmit);

	// 			}
	// 		}
	// 		return true;
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	// /** 
	//  * @function callEnd
	//  * end call
	//  * delete meeting details after call ends
	// */
	// async callEnd(io: any, socket: any, params: ChatRequest.CallEnd, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.chatId && !params.meetingId) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		const isUserExist = await userDaoV1.findUserById(tokenData.userId)
	// 		if (!isUserExist) return ack(MESSAGES.ERROR.USER_NOT_FOUND);
	// 		const chat = await chatDaoV1.findOne("chats", { _id: params.chatId, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!chat) return ack(MESSAGES.ERROR.CHAT_NOT_FOUND);

	// 		const toEmit: any = {};
	// 		toEmit.type = chat.type;
	// 		toEmit.eventType = SOCKET.LISTNER_TYPE.SOCKET_SERVICE.CALL_END;
	// 		toEmit.userId = tokenData.userId;
	// 		toEmit.chatId = params.chatId;
	// 		ack(toEmit);
	// 		for (let element of chat.members) {
	// 			if (element.toString() !== tokenData.userId.toString()) {
	// 				const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + (element).toString() + REDIS_KEY_PREFIX.SOCKET_ID);
	// 				const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;//io.sockets.sockets.get((socket_user));
	// 				if (contactUserIdSocket) contactUserIdSocket.emit(SOCKET.LISTNER_TYPE.SOCKET_SERVICE.CALL_END, toEmit);
	// 				else {
	// 					toEmit.receiverId = element;
	// 					let notificationData = {
	// 						type: NOTIFICATION_TYPE.DECLINE_NOTIFICATION,
	// 						title: toEmit.name || `${toEmit.countryCode} ${toEmit.mobileNo}`,
	// 						message: "call end",
	// 						body: "call end",
	// 						details: { ...toEmit, isCall: true }
	// 					}
	// 					await sendNotification(notificationData, socket.accessToken);
	// 				}
	// 			}
	// 		}
	// 		// await imageUtil.deleteMeeting(params.meetingId);
	// 		await redisClient.deleteKey(SERVER.APP_NAME + "_" + params.chatId + REDIS_KEY_PREFIX.MEETING);
	// 		return true;
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	// /** 
	//  * @function removeAttendees
	//  * remove attendees from a meetingId wihtin chat call
	// */
	// async removeAttendees(io: any, socket: any, params: ChatRequest.removeAttendees, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.chatId && !params.meetingId && !params.attendeeId) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		const chat = await chatDaoV1.findOne("chats", { _id: params.chatId, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!chat) return ack(MESSAGES.ERROR.CHAT_NOT_FOUND);
	// 		// await imageUtil.deleteAttendees(params.attendeeId, params.meetingId);
	// 		console.log("removeAttendees successfully")
	// 		return ack(MESSAGES.SUCCESS.DELETE_MEETING);
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }


	async sendChatNotification(socket: any, data: ChatRequest.CHAT_NOTIFICATION) {
		try {
			consolelog(`${data.details.receiverId}---sendChatNotification invoked chatId--->`, data.details.chatId, true)
			let contact = await userDaoV1.findOne("contacts", { userId: data.details.receiverId, contactUserId: data.details.senderId }, { name: 1 });
			data.title = contact?.name || data.details.fullMobileNo;
			if (data.details.type == CHAT_TYPE.ONE_TO_ONE) {
				data.details.senderName = contact?.name || data.details.fullMobileNo;
			}
			console.log('**********contact***********', contact, data);
			//check for subscription for a receiver user
			const isSubscribedUser = await this.checkUserSubscription(data.details.receiverId);
			if (isSubscribedUser.isSubscribed || isSubscribedUser?.expiryTime < Date.now()) {
				await this.sendSocketEvents(socket, SOCKET.LISTNER_TYPE.NOTIFY.NOTIFICATION, data);
			}
			return true;
		} catch (error) {
			throw error;
		}
	}

	// /** 
	//  * @function currentCallStatus
	//  * get current call status with params chatId for a user
	// */
	// async currentCallStatus(io: any, socket: any, params: ChatRequest.UserCallStatus, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.chatId) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		const isUserExist = await userDaoV1.findUserById(tokenData.userId)
	// 		if (!isUserExist) return ack(MESSAGES.ERROR.USER_NOT_FOUND);
	// 		const chat = await chatDaoV1.findOne("chats", { _id: params.chatId, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!chat) return ack(MESSAGES.ERROR.CHAT_NOT_FOUND);
	// 		const groupUser: any = await chatDaoV1.findOne("chats", { _id: params.chatId, members: tokenData.userId });
	// 		if (!groupUser) return ack(MESSAGES.ERROR.USER_NOT_FOUND);
	// 		let isCallOngoing = await redisClient.getValue(SERVER.APP_NAME + "_" + params.chatId + REDIS_KEY_PREFIX.MEETING);
	// 		consolelog(`isCallOngoing`, isCallOngoing, true);
	// 		const toEmit: any = {};
	// 		toEmit.type = chat.type;
	// 		toEmit.userId = tokenData.userId;
	// 		toEmit.chatId = params.chatId;
	// 		toEmit.isCallOngoing = isCallOngoing ? true : false
	// 		ack(toEmit);
	// 		return true;
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	// /** 
	//  * @function userCallStatus
	//  * user call status is user is busy on another call
	// */
	// async userCallStatus(io: any, socket: any, params: ChatRequest.UserCallStatus, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.chatId) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		const isUserExist = await userDaoV1.findUserById(tokenData.userId)
	// 		if (!isUserExist) return ack(MESSAGES.ERROR.USER_NOT_FOUND);
	// 		const group = await chatDaoV1.findOne("chats", { _id: params.chatId, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!group) return ack(MESSAGES.ERROR.CHAT_NOT_FOUND);
	// 		const groupUser: any = await chatDaoV1.findOne("chats", { _id: params.chatId, members: { $in: tokenData.userId } });
	// 		if (!groupUser) return ack(MESSAGES.ERROR.USER_NOT_FOUND);
	// 		let members = [];
	// 		members = group.members;
	// 		const toEmit: any = {};
	// 		toEmit.type = group.type;
	// 		toEmit.userId = tokenData.userId;
	// 		toEmit.chatId = params.chatId;
	// 		toEmit.eventType = SOCKET.LISTNER_TYPE.SOCKET_SERVICE.USER_CALL_STATUS;

	// 		ack(toEmit);
	// 		for (let element of groupUser.members) {
	// 			if (element.toString() !== tokenData.userId.toString()) {
	// 				const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + (element).toString() + REDIS_KEY_PREFIX.SOCKET_ID);
	// 				const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;//io.sockets.sockets.get((socket_user));
	// 				if (contactUserIdSocket) contactUserIdSocket.emit(SOCKET.LISTNER_TYPE.SOCKET_SERVICE.USER_CALL_STATUS, toEmit);
	// 				else {
	// 					consolelog(`************Push notification for user call status****************`, element, true);
	// 				}
	// 			}
	// 		}
	// 		return true;
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	// /**
	//  * @function checkSubscription
	//  * check subscription of a existing user
	// */
	// async checkSubscription(io: any, socket: any, params, ack: any, tokenData: TokenData) {
	// 	try {
	// 		consolelog(`************checkSubscription***************`, tokenData.userId, true);
	// 		let subscription: any = await redisClient.getValue(SERVER.APP_NAME + "_" + tokenData.userId + REDIS_KEY_PREFIX.SUBSCRIBED);
	// 		if (!subscription) {
	// 			subscription = await userDaoV1.findOne("users", { _id: tokenData.userId, isSubscribed: true }, {});
	// 		}
	// 		else {
	// 			subscription = JSON.parse(subscription);
	// 		}
	// 		consolelog(`${tokenData.userId}************checkSubscription***************`, subscription ? true : false, true);
	// 		let data = {
	// 			userId: tokenData.userId,
	// 			isSubscribed: true, // subscription ? true : false,
	// 			expiryTime: subscription?.expiryDate ? subscription?.expiryDate : subscription?.subscriptionExpiryDate
	// 		}
	// 		if (params.accessData) {
	// 			return data;
	// 		}
	// 		ack(data);
	// 		socket.emit(SOCKET.LISTNER_TYPE.USER.SUBSCRIPTION, data);
	// 		return;
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function checkUserSubscription
	 * check subscription of a existing user
	*/
	async checkUserSubscription(userId: string) {
		try {
			consolelog(`************checkSubscription***************`, userId, true);
			let subscription: any = await redisClient.getValue(SERVER.APP_NAME + "_" + userId + REDIS_KEY_PREFIX.SUBSCRIBED);
			if (!subscription) {
				subscription = await userDaoV1.findOne("users", { _id: userId, isSubscribed: true }, {});
			}
			else {
				subscription = JSON.parse(subscription);
			}
			consolelog(`${userId}************checkSubscription***************`, subscription ? true : false, true);
			let data = {
				userId: userId,
				isSubscribed: true, // subscription ? true : false,
				expiryTime: subscription?.expiryDate ? subscription?.expiryDate : subscription?.subscriptionExpiryDate
			}
			return data;

		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function subscriptionExpired
	 * subscription expired event
	*/
	async subscriptionExpired(params: ChatRequest.userId) {
		try {
			consolelog(`************subscriptionExpired params***************`, params, true);
			if (params.userId) {
				let socket_user = await this.checkUserOnlineStatus(params.userId);
				consolelog(`************socket_user subscription expired***************`, socket_user, true);
				if (socket_user) {
					const contactUserIdSocket = await SocketIO.io.in(socket_user).fetchSockets()[0];
					if (contactUserIdSocket) {
						let data = {
							userId: params.userId,
							isSubscribed: true // false
						}
						consolelog(`************socket_user subscription emit user***************`, data, true);
						contactUserIdSocket.emit(SOCKET.LISTNER_TYPE.USER.SUBSCRIPTION, data);
					}
				}
			}
			return
		} catch (error) {
			throw error;
		}
	}
	/**
	 * @function userSetting
	 * userSetting for real offline events
	*/
	async userSetting(params: ChatRequest.userProfile, tokenData: TokenData) {
		try {
			consolelog(`************userSetting params***************`, params, true);
			consolelog(`************userSetting params***************`, tokenData, true);
			let isOnline = true;
			const userId = tokenData?.userId;
			if (userId) {
				let isOnline = params.offlineStatus ? false : true;
				let socket_user = await this.checkUserOnlineStatus(userId);
				consolelog(`************socket_user userSetting***************`, socket_user, true);
				if (socket_user) {
					const blokcedUsers = await userDaoV1.findUserById(userId);
					let offline_status = await this.checkUserOfflineOverallStatus(userId, userId);
					if (offline_status) isOnline = false;
					SocketIO.io.emit(SOCKET.LISTNER_TYPE.USER.USER_STATUS, {
						userId: userId,
						isOnline: isOnline,
						lastSeen: Date.now(),
						blocked: blokcedUsers?.blocked
					});
				}
			}
			return
		} catch (error) {
			throw error;
		}
	}
	/**
	 * @function userNotificationCount
	 * notificationCount for lang chat and lang social
	*/
	async userNotificationCount(io: any, socket: any, params: ChatRequest.UserCallStatus, ack: any, tokenData: TokenData) {
		try {
			const toEmit: any = {};
			toEmit.unReadChatMessages = 0;
			toEmit.unReadLangSocial = 0;
			toEmit.eventType = SOCKET.LISTNER_TYPE.SOCKET_SERVICE.HOME_NOTIFICATION_COUNT;
			const [unReadLangChat, unReadLangSocial] = await Promise.all([
				baseDao.count("messages", {
					members: toObjectId(tokenData.userId), "isRead": { $nin: [toObjectId(tokenData.userId)] }, deletedBy: { $nin: [toObjectId(tokenData.userId)] }
				}),
				baseDao.findOne("users", { _id: tokenData.userId }, { notificationCount: 1 })
			])
			if (unReadLangChat) {
				toEmit.unReadChatMessages = unReadLangChat;
			}
			if (unReadLangSocial) {
				toEmit.unReadLangSocial = unReadLangSocial.notificationCount;
			}
			ack(toEmit);
			return
		} catch (error) {
			throw error;
		}
	}

	async deleteUserHandling(tokenData: TokenData) {
		try {
			const userId = tokenData.userId;
			console.log('userId', userId)
			let keys: any = await redisClient.getKeys(`*${SERVER.APP_NAME}_${userId}*`);
			console.info("Before [deleteUserHandling] redis keys for deletion ****************************", keys)
			const [deleteChat, removeGroups, deleteMessages, deleteOtherContacts, deleteContacts] = await Promise.all([
				await chatDaoV1.updateMany("chats", {
					deletedBy: { $nin: [toObjectId(userId)] },
					"$or": [{
						"members": userId
					}, {
						"exitedBy": userId
					}]
				}, { $addToSet: { deletedBy: userId }, $pull: { exitedBy: userId, admins: userId } }, {}),
				await chatDaoV1.updateMany("chats", {
					type: { $in: [CHAT_TYPE.GROUP, CHAT_TYPE.BROADCAST, CHAT_TYPE.COMMUNITY] },
					"$or": [{
						"members": userId
					}, {
						"exitedBy": userId
					}]
				}, { $pull: { members: userId } }, {}),
				await baseDao.updateMany("messages", {
					deletedBy: { $nin: [toObjectId(userId)] },
					"members": userId
				}, { $addToSet: { deletedBy: userId } }, {}),
				userDaoV1.updateMany("contacts", { contactUserId: tokenData.userId }, { isAppUser: false }, {}),
				userDaoV1.deleteMany("contacts", { userId: tokenData.userId }),
				await redisClient.deleteKey(keys)
			]);
			consolelog(`deleteUserHandling deleteChat`, deleteChat, true);
			consolelog(`deleteUserHandling deleteMessages`, deleteMessages, true);
			keys = await redisClient.getKeys(`*${SERVER.APP_NAME}_${userId}*`);
			console.info("After [deleteUserHandling] redis keys for deletion", keys);
			const group_admins = await chatDaoV1.find("chats", { type: CHAT_TYPE.GROUP, admins: [] }, {});
			if (group_admins?.length) {
				for (let i = 0; i < group_admins.length; i++) {
					let admin = group_admins[i].members[0];
					await chatDaoV1.findOneAndUpdate("chats", { _id: group_admins[i]._id }, { $push: { admins: admin } }, {});
				}
			}
		} catch (error) {
			throw error;
		}
	}

	async messageWeightageMapping() {
		try {
			const time = Date.now() - 20 * 24 * 60 * 60 * 1000;
			const messages = await baseDao.find('messages', { created: { $gte: time }, status: STATUS.ACTIVE, type: CHAT_TYPE.ONE_TO_ONE }, {});
			console.log('posts', messages.length);
			messages.forEach(async (item) => {
				const weightage = WEIGHTAGE_SCORE.FRESHNESS - moment().diff(moment(item.created), "days");
				const score = WEIGHTAGE_SCORE.MESSAGE;
				const followingKey = `following:${item.senderId}`;
				const contactUserId = item.members[0].toString() == item.senderId.toString() ? item.members[1].toString() : item.members[0].toString();
				// await redisClient.incrementSortedSetScore(followingKey, score, contactUserId.toString());
				// const key= `${JOB_SCHEDULER_TYPE.USER_MESSAGE_INTERACTIONS}.${item.senderId}_${contactUserId}.${item._id}`;
				// if(checkClusterNode(key)==REDIS_CLUSTER_CONFIG.NODE_1) {
				// 	await redisClusterNodeOne.redisWeightageManagementWithTime(key,JOB_SCHEDULER_TYPE.USER_MESSAGE_INTERACTIONS,{
				// 		userIds: `${item.senderId}_${contactUserId}`,
				// 		messageId: item._id
				// 	},weightage);	
				// }else {
				// 	await redisClusterNodeTwo.redisWeightageManagementWithTime(key,JOB_SCHEDULER_TYPE.USER_MESSAGE_INTERACTIONS,{
				// 		userIds: `${item.senderId}_${contactUserId}`,
				// 		messageId: item._id
				// 	},weightage);	
				// }

			});
			return MESSAGES.SUCCESS.DEFAULT;
		} catch (error) {
			console.log('error', error)
		}
	}

	// /**
	//  * @function createCommunity
	//  * create a community group for coming users in params
	//  * created group user joined the room and default admin of group
	//  * notify other members for group creation in chat list
	// */
	// async createCommunity(io: any, socket: any, params: ChatRequest.CREATE_GROUP, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.communityId) {
	// 			return ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 		}

	// 		// const isCommunityGroupExist=await baseDao.findOne("communities",{_id:params.communityId},{_id:1,userId:1,name:1,description:1,mediaUrl:1,isGroupCreated:1,groupId:1});
	// 		// if(!isCommunityGroupExist) return ack(MESSAGES.ERROR.COMMUNITY_NOT_FOUND)
	// 		// else if(isCommunityGroupExist.isGroupCreated) return ack(MESSAGES.ERROR.GROUP_ALREADY_EXIST)

	// 		// params.contactUserIds=await baseDao.distinct("community_users","userId",{communityId:params.communityId,status:STATUS.ACTIVE})
	// 		let admins = [];
	// 		admins.push(tokenData.userId);
	// 		// params.contactUserIds.push(tokenData.userId);
	// 		let data: any = {
	// 			type: CHAT_TYPE.COMMUNITY,
	// 			members: params.contactUserIds,
	// 			overallMembers: params.contactUserIds,
	// 			createdBy: tokenData.userId,
	// 			name: params.name,
	// 			description: params.description,
	// 			groupProfilePicture: params.groupProfilePicture,
	// 			admins: admins
	// 		}
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			const chatUserInfo = await this.setUserLanguage(params.contactUserIds)
	// 			data.userLang = chatUserInfo.userLang;
	// 			data.langCodes = chatUserInfo.langCodes;
	// 		}
	// 		let group = await chatDaoV1.save("chats", data);
	// 		// baseDao.findOneAndUpdate("communities",{_id:params.communityId},{isGroupCreated:true,groupId:group._id})
	// 		socket.join(`${group._id}`);
	// 		/*save header msg */
	// 		let details: any = {}, taggedUser = [];
	// 		details.languageCode = LANGUAGE_CODE.EN;
	// 		details.message = CHAT_HEADERS.GROUP.CREATE(tokenData.userId, params.name);
	// 		taggedUser.push(tokenData.userId)
	// 		let isRead = [], isDelivered = [];
	// 		isRead.push(tokenData.userId);
	// 		isDelivered.push(tokenData.userId);
	// 		let save: any = {
	// 			type: CHAT_TYPE.COMMUNITY,
	// 			senderId: tokenData.userId,
	// 			members: group.members,
	// 			chatId: group._id,
	// 			message: details.message,
	// 			mediaUrl: null,
	// 			messageType: MESSAGE_TYPE.HEADING,
	// 			isRead: isRead,
	// 			isDelivered: isDelivered,
	// 			thumbnailUrl: details.thumbnailUrl ? details.thumbnailUrl : null,
	// 			location: null,
	// 			size: details.size ? details.size : null,
	// 			transcribe: details.transcribe ? details.transcribe : null,
	// 			status: STATUS.ACTIVE,
	// 			taggedUser: taggedUser,
	// 		}
	// 		let translatedInfo: any = {}
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			// translatedInfo = await translateMessage(details.languageCode, details.message, group._id, tokenData, false)
	// 			// save.translatedMessages = translatedInfo.encryptedMessages;
	// 			// save.langCodes = translatedInfo.langCodes;
	// 			// save.userLang = translatedInfo.userLang;
	// 		}
	// 		const header_messages = await baseDao.save("messages", save);
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			data.translatedMessages = translatedInfo.translatedMessages;
	// 		}
	// 		/*end of saving header msg*/
	// 		group = await baseDao.findOneAndUpdate("chats", {
	// 			_id: group._id
	// 		}, {
	// 			lastMsgId: header_messages._id,
	// 			lastMsgCreated: Date.now()
	// 		}, { new: true });
	// 		delete group.overallMembers;
	// 		const membersDetails = await userDaoV1.find("users", { _id: { $in: group.members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 		group.membersDetails = membersDetails;
	// 		ack(MESSAGES.SUCCESS.DETAILS(group));
	// 		this.inboxChat(io, socket, {}, ack, { userId: tokenData.userId });
	// 		// this.refreshChatBox(io,socket,{chatId: group._id},ack,{userId: tokenData.userId});
	// 		const sender = await userDaoV1.findUserById(tokenData.userId);
	// 		let message = CHAT_HEADERS.GROUP.ADD_NOTIFY(tokenData.userId);
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			// const translatedInfo = await translateMessage(details.languageCode, message, group._id, tokenData, false)
	// 			// save.translatedMessages = translatedInfo.translatedMessages;
	// 			// save.langCodes = translatedInfo.langCodes;
	// 			// save.userLang = translatedInfo.userLang;
	// 		}
	// 		for (let user of params.contactUserIds) {
	// 			let IsNotificationMuted = await this.checkforChatNotification(user, group._id);
	// 			const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + user + REDIS_KEY_PREFIX.SOCKET_ID);
	// 			if (socket_user) {
	// 				const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;//io.sockets.sockets.get(socket_user);
	// 				if (contactUserIdSocket) {
	// 					if (user.toString() !== tokenData.userId.toString()) {
	// 						await this.triggerCommunityNotification(true, params, socket_user, sender, user, io, group, save, socket, contactUserIdSocket, IsNotificationMuted)
	// 					}
	// 					this.inboxChat(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: user });
	// 					// this.refreshChatBox(io,contactUserIdSocket,{chatId: group._id},ack,{userId: user});
	// 				}
	// 			} else {
	// 				if (user.toString() !== tokenData.userId.toString()) {
	// 					await this.triggerCommunityNotification(false, params, socket_user, sender, user, io, group, save, socket, {}, IsNotificationMuted)
	// 				}
	// 			}
	// 		}
	// 		return
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	// /**
	//  * @function editCommunity
	//  * edit a group for new coming users in params
	// */
	// async editCommunity(io: any, socket: any, params: ChatRequest.EDIT_GROUP, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.groupId) {
	// 			return ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 		}
	// 		let group, members = [];
	// 		group = await chatDaoV1.findOne("chats", { _id: params.groupId, type: CHAT_TYPE.COMMUNITY, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!group) return ack(MESSAGES.ERROR.GROUP_NOT_FOUND);
	// 		let data = {
	// 			name: params.name ? params.name : group.name,
	// 			description: params.description ? params.description : group.description,
	// 			groupProfilePicture: params.groupProfilePicture != "" ? params.groupProfilePicture : ""
	// 		}
	// 		if (params.name && params.name !== group.name) {
	// 			await this.updateHeaderForGroup(io, params, group, tokenData, CHAT_MODE_TYPE.NAME, socket, ack)
	// 		}
	// 		if (params.description && params.description !== group.description) {
	// 			await this.updateHeaderForGroup(io, params, group, tokenData, CHAT_MODE_TYPE.DESCRIPTION, socket, ack)
	// 		}
	// 		if (params.groupProfilePicture && params.groupProfilePicture !== group.groupProfilePicture) {
	// 			await this.updateHeaderForGroup(io, params, group, tokenData, CHAT_MODE_TYPE.ICON, socket, ack)
	// 		}
	// 		if (params.groupProfilePicture == "" && params.groupProfilePicture !== group.groupProfilePicture) {
	// 			await this.updateHeaderForGroup(io, params, group, tokenData, CHAT_MODE_TYPE.REMOVE_ICON, socket, ack)
	// 		}
	// 		group = await chatDaoV1.findOneAndUpdate("chats", { _id: params.groupId }, data, { new: true });

	// 		if (params.contactUserIds?.length) {
	// 			const isAdmin = await chatDaoV1.findOne("chats", { _id: params.groupId, admins: { $in: [tokenData.userId] } });
	// 			// if (!isAdmin) return ack(MESSAGES.ERROR.UNAUTHORIZE_ADMIN_MEMBERS);
	// 			const updated_group_members = await chatDaoV1.findOneAndUpdate("chats", { _id: params.groupId }, { $addToSet: { members: params.contactUserIds, overallMembers: params.contactUserIds } }, { new: true });
	// 			/* save header message */
	// 			for (let i = 0; i < group.members.length; i++) {
	// 				members.push(group.members[i].toString())
	// 			}
	// 			let addedMembers = diffBw2Arrays(params.contactUserIds, members);
	// 			if (SERVER.IS_TRANSLATION_ENABLE) {
	// 				const toUpdate: any = {}
	// 				const chatUserInfo = await this.setUserLanguage(addedMembers)
	// 				toUpdate["$addToSet"] = {
	// 					userLang: chatUserInfo.userLang,
	// 					langCodes: chatUserInfo.langCodes
	// 				}
	// 				await chatDaoV1.findOneAndUpdate("chats", { _id: params.groupId }, toUpdate)
	// 			}
	// 			let details: any = {}, taggedUser: any = [];
	// 			details.languageCode = LANGUAGE_CODE.EN;
	// 			taggedUser.push(...addedMembers, tokenData.userId);
	// 			let contactUserIds = addedMembers.map(i => ' @' + i)
	// 			console.log('********editGroup contactUserIds ********', contactUserIds);
	// 			details.message = CHAT_HEADERS.GROUP.ADD(tokenData.userId, contactUserIds.join(" ,"));
	// 			let isRead = [], isDelivered = [];
	// 			isRead.push(tokenData.userId);
	// 			isDelivered.push(tokenData.userId);
	// 			let save: any = {
	// 				type: CHAT_TYPE.COMMUNITY,
	// 				senderId: tokenData.userId,
	// 				members: updated_group_members.members,
	// 				chatId: group._id,
	// 				message: details.message,
	// 				mediaUrl: null,
	// 				messageType: MESSAGE_TYPE.HEADING,
	// 				isRead: isRead,
	// 				isDelivered: isDelivered,
	// 				thumbnailUrl: details.thumbnailUrl ? details.thumbnailUrl : null,
	// 				location: null,
	// 				size: details.size ? details.size : null,
	// 				transcribe: details.transcribe ? details.transcribe : null,
	// 				status: STATUS.ACTIVE,
	// 				taggedUser: taggedUser
	// 			}
	// 			let translatedInfo: any = {}
	// 			if (SERVER.IS_TRANSLATION_ENABLE) {
	// 				// const translatedInfo = await translateMessage(details.languageCode, details.message, group._id, tokenData, false)
	// 				// save.translatedMessages = translatedInfo.encryptedMessages;
	// 				// save.langCodes = translatedInfo.langCodes;
	// 				// save.userLang = translatedInfo.userLang;
	// 			}
	// 			const header_messages = await baseDao.save("messages", save);
	// 			if (SERVER.IS_TRANSLATION_ENABLE) {
	// 				save.translatedMessages = translatedInfo.translatedMessages;
	// 			}
	// 			/*end of saving header msg*/
	// 			group = await baseDao.findOneAndUpdate("chats", {
	// 				_id: group._id
	// 			}, {
	// 				lastMsgId: header_messages._id,
	// 				lastMsgCreated: Date.now(),
	// 				$pull: { deletedBy: { $in: addedMembers }, exitedBy: { $in: addedMembers } }
	// 			}, { new: true });
	// 			const membersDetails = await userDaoV1.find("users", { _id: { $in: group.members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 			header_messages.membersDetails = membersDetails;
	// 			ack(MESSAGES.SUCCESS.DETAILS(updated_group_members));
	// 			io.to(`${params.groupId}`).emit(`${params.groupId}`, {
	// 				eventType: SOCKET.LISTNER_TYPE.GROUP.COMMUNITY_MESSAGES,
	// 				data: header_messages
	// 			});
	// 			group.membersDetails = membersDetails;
	// 			io.to(`${params.groupId}`).emit(`${params.groupId}`, {
	// 				eventType: SOCKET.LISTNER_TYPE.GROUP.COMMUNITY_INFO,
	// 				groupDetails: group
	// 			});
	// 			/*NOTIFY USERS*/
	// 			let message = CHAT_HEADERS.GROUP.ADD_NOTIFY(tokenData.userId);
	// 			const sender = await userDaoV1.findUserById(tokenData.userId);
	// 			if (SERVER.IS_TRANSLATION_ENABLE) {
	// 				// const translatedInfo = await translateMessage(details.languageCode, message, group._id, tokenData, false)
	// 				// save.translatedMessages = translatedInfo.translatedMessages;
	// 				// save.langCodes = translatedInfo.langCodes;
	// 				// save.userLang = translatedInfo.userLang;
	// 			}
	// 			for (let user of addedMembers) {
	// 				let IsNotificationMuted = await this.checkforChatNotification(user, group._id);
	// 				const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + user + REDIS_KEY_PREFIX.SOCKET_ID);
	// 				if (socket_user) {
	// 					const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;// io.sockets.sockets.get(socket_user);
	// 					if (contactUserIdSocket) {
	// 						if (user.toString() !== tokenData.userId.toString()) {
	// 							await this.triggerCommunityNotification(true, params, socket_user, sender, user, io, group, save, socket, contactUserIdSocket, IsNotificationMuted)
	// 						}
	// 						this.inboxChat(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: user });
	// 						// this.refreshChatBox(io,contactUserIdSocket,{chatId: group._id},ack,{userId: user});
	// 					}
	// 				} else {
	// 					if (user.toString() !== tokenData.userId.toString()) {
	// 						await this.triggerCommunityNotification(false, params, socket_user, sender, user, io, group, save, socket, {}, IsNotificationMuted)
	// 					}
	// 				}
	// 			}
	// 			/*END NOTIFY USERS*/
	// 			this.refreshGroupChatInboxList(params.groupId, tokenData.userId, updated_group_members.members, io, socket, ack);
	// 			return
	// 		}
	// 		const membersDetails = await userDaoV1.find("users", { _id: { $in: group.members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 		group.membersDetails = membersDetails;
	// 		ack(MESSAGES.SUCCESS.DETAILS(group));
	// 		io.to(`${params.groupId}`).emit(`${params.groupId}`, {
	// 			eventType: SOCKET.LISTNER_TYPE.GROUP.COMMUNITY_INFO,
	// 			groupDetails: group
	// 		});
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }
	/**
	 * @function joinCommunity
	 * join a group
	// */
	// async joinCommunity(io: any, socket: any, params: ChatRequest.JOIN_GROUP, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.groupId) {
	// 			return ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 		}
	// 		let group, members = [];
	// 		group = await chatDaoV1.findOne("chats", { _id: params.groupId, type: CHAT_TYPE.COMMUNITY }, {});
	// 		if (!group) return ack(MESSAGES.ERROR.GROUP_NOT_FOUND);
	// 		// if (params.contactUserIds?.length) {
	// 		const updated_group_members = await chatDaoV1.findOneAndUpdate("chats", { _id: params.groupId }, { $addToSet: { members: tokenData.userId, overallMembers: tokenData.userId } }, { new: true });

	// 		/* save header message */
	// 		for (let i = 0; i < group.members.length; i++) {
	// 			members.push(group.members[i].toString())
	// 		}
	// 		let addedMembers = diffBw2Arrays([tokenData.userId.toString()], members);
	// 		// if(!addedMembers?.length) return ack(MESSAGES.ERROR.ALREADY_JOINED)
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			const toUpdate: any = {}
	// 			const chatUserInfo = await this.setUserLanguage(addedMembers)
	// 			toUpdate["$addToSet"] = {
	// 				userLang: chatUserInfo.userLang,
	// 				langCodes: chatUserInfo.langCodes
	// 			}
	// 			await chatDaoV1.findOneAndUpdate("chats", { _id: params.groupId }, toUpdate)
	// 		}
	// 		let details: any = {}, taggedUser: any = [];
	// 		details.languageCode = LANGUAGE_CODE.EN;
	// 		taggedUser.push(tokenData.userId);
	// 		// let contactUserIds = addedMembers.map(i => ' @' + i)
	// 		// console.log('********editGroup contactUserIds ********', contactUserIds);
	// 		details.message = CHAT_HEADERS.GROUP.JOIN(tokenData.userId);
	// 		let isRead = [], isDelivered = [];
	// 		isRead.push(tokenData.userId);
	// 		isDelivered.push(tokenData.userId);
	// 		let save: any = {
	// 			type: CHAT_TYPE.COMMUNITY,
	// 			senderId: tokenData.userId,
	// 			members: updated_group_members.members,
	// 			chatId: group._id,
	// 			message: details.message,
	// 			mediaUrl: null,
	// 			messageType: MESSAGE_TYPE.HEADING,
	// 			isRead: isRead,
	// 			isDelivered: isDelivered,
	// 			thumbnailUrl: details.thumbnailUrl ? details.thumbnailUrl : null,
	// 			location: null,
	// 			size: details.size ? details.size : null,
	// 			transcribe: details.transcribe ? details.transcribe : null,
	// 			status: STATUS.ACTIVE,
	// 			taggedUser: taggedUser
	// 		}
	// 		let translatedInfo: any = {}
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			// const translatedInfo = await translateMessage(details.languageCode, details.message, group._id, tokenData, false)
	// 			// save.translatedMessages = translatedInfo.encryptedMessages;
	// 			// save.langCodes = translatedInfo.langCodes;
	// 			// save.userLang = translatedInfo.userLang;
	// 		}
	// 		const header_messages = await baseDao.save("messages", save);
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			save.translatedMessages = translatedInfo.translatedMessages;
	// 		}
	// 		/*end of saving header msg*/
	// 		group = await baseDao.findOneAndUpdate("chats", {
	// 			_id: group._id
	// 		}, {
	// 			lastMsgId: header_messages._id,
	// 			lastMsgCreated: Date.now(),
	// 			$pull: { deletedBy: { $in: addedMembers }, exitedBy: { $in: addedMembers } }
	// 		}, { new: true });
	// 		const membersDetails = await userDaoV1.find("users", { _id: { $in: group.members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 		header_messages.membersDetails = membersDetails;
	// 		ack(MESSAGES.SUCCESS.DETAILS(updated_group_members));
	// 		io.to(`${params.groupId}`).emit(`${params.groupId}`, {
	// 			eventType: SOCKET.LISTNER_TYPE.GROUP.COMMUNITY_MESSAGES,
	// 			data: header_messages
	// 		});
	// 		group.membersDetails = membersDetails;
	// 		io.to(`${params.groupId}`).emit(`${params.groupId}`, {
	// 			eventType: SOCKET.LISTNER_TYPE.GROUP.COMMUNITY_INFO,
	// 			groupDetails: group
	// 		});
	// 		/*NOTIFY USERS*/
	// 		let message = CHAT_HEADERS.GROUP.JOIN_NOTIFY(tokenData.userId);
	// 		const sender = await userDaoV1.findUserById(tokenData.userId);
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			// const translatedInfo = await translateMessage(details.languageCode, message, group._id, tokenData, false)
	// 			// save.translatedMessages = translatedInfo.translatedMessages;
	// 			// save.langCodes = translatedInfo.langCodes;
	// 			// save.userLang = translatedInfo.userLang;
	// 		}
	// 		for (let user of members) {
	// 			let IsNotificationMuted = await this.checkforChatNotification(user, group._id);
	// 			const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + user + REDIS_KEY_PREFIX.SOCKET_ID);
	// 			if (socket_user) {
	// 				const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;// io.sockets.sockets.get(socket_user);
	// 				if (contactUserIdSocket) {
	// 					if (user.toString() !== tokenData.userId.toString()) {
	// 						await this.triggerCommunityNotification(true, params, socket_user, sender, user, io, group, save, socket, contactUserIdSocket, IsNotificationMuted)
	// 					}
	// 					this.inboxChat(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: user });
	// 					// this.refreshChatBox(io,contactUserIdSocket,{chatId: group._id},ack,{userId: user});
	// 				}
	// 			} else {
	// 				if (user.toString() !== tokenData.userId.toString()) {
	// 					await this.triggerCommunityNotification(false, params, socket_user, sender, user, io, group, save, socket, {}, IsNotificationMuted)
	// 				}
	// 			}
	// 		}
	// 		/*END NOTIFY USERS*/
	// 		this.refreshGroupChatInboxList(params.groupId, tokenData.userId, updated_group_members.members, io, socket, ack);
	// 		return
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/** 
	//  * @function sendCommunityMessage
	//  * send messages in a community group with respective groupId-->chatId
	// */
	// async sendCommunityMessage(io: any, socket: any, params: ChatRequest.GROUP_MESSAGE, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.chatId || !params.messageType || !params.senderId || !params.localMessageId) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		if (params.messageType == MESSAGE_TYPE.TEXT && !params.message) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		const group = await chatDaoV1.findOne("chats", { _id: params.chatId, members: tokenData.userId, type: CHAT_TYPE.COMMUNITY, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!group) return ack(MESSAGES.ERROR.GROUP_NOT_FOUND);
	// 		// if(group?.status==STATUS.INACTIVE) return ack(MESSAGES.ERROR.COMMUNITY_BLOCKED)
	// 		let deletedBy = [], isDelivered = [], isRead = [];
	// 		if (group?.deletedBy && group?.exitedBy) {
	// 			deletedBy = group.deletedBy.concat(group.exitedBy)
	// 		}
	// 		// isRead.push(params.senderId);
	// 		// isDelivered.push(params.senderId);
	// 		for (let memb of group.members) {
	// 			const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + memb.toString() + REDIS_KEY_PREFIX.SOCKET_ID);
	// 			if (socket_user) {
	// 				isDelivered.push(memb);
	// 				const scoketIds = await io.in(socket_user).fetchSockets();
	// 				for (const socket of scoketIds) {
	// 					if (socket?.rooms?.has(`${params.chatId}`)) isRead.push(memb);
	// 				}
	// 			}
	// 		}
	// 		let members = [];
	// 		members = group.members;
	// 		let data: any = {
	// 			_id: params.localMessageId,
	// 			type: CHAT_TYPE.COMMUNITY,
	// 			senderId: params.senderId,
	// 			members: members,
	// 			chatId: params.chatId,
	// 			message: params.message,
	// 			mediaUrl: params.mediaUrl,
	// 			messageType: params.messageType,
	// 			isRead: isRead,
	// 			isDelivered: isDelivered,
	// 			thumbnailUrl: params.thumbnailUrl ? params.thumbnailUrl : null,
	// 			location: params.location,
	// 			size: params.size ? params.size : null,
	// 			transcribe: params.transcribe ? params.transcribe : null,
	// 			status: params.status,
	// 			deletedBy: deletedBy,
	// 			taggedUser: params.taggedUser,
	// 			imageRatio: params.imageRatio,
	// 			localUrl: params.localUrl
	// 		}
	// 		let translatedInfo: any = {}
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			// translatedInfo = params.languageCode ? await translateMessage(params.languageCode, params.message, params.chatId, tokenData) : await autoTranslateMessage(params.message, params.chatId)
	// 			// data.translatedMessages = translatedInfo.encryptedMessages;
	// 			// data.langCodes = translatedInfo.langCodes;
	// 			// data.userLang = translatedInfo.userLang;
	// 		}
	// 		const message = await baseDao.save("messages", data);
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			data.translatedMessages = translatedInfo.translatedMessages;
	// 		}
	// 		let membersDetails = await userDaoV1.find("users", { _id: { $in: members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 		message.membersDetails = membersDetails;
	// 		ack(message);
	// 		io.to(`${params.chatId}`).emit(`${params.chatId}`, {
	// 			eventType: SOCKET.LISTNER_TYPE.GROUP.COMMUNITY_MESSAGES,
	// 			data: message
	// 		});
	// 		consolelog(`${params.chatId},sendGroupMessage delivered timer`, Date.now(), true);
	// 		await baseDao.findOneAndUpdate("chats", {
	// 			_id: params.chatId
	// 		}, {
	// 			lastMsgId: message._id,
	// 			lastMsgCreated: Date.now()
	// 		}, {});
	// 		const isSenderArchive = await this.checkChatArchiveStatus(tokenData.userId, params.chatId);
	// 		// const isSenderArchive = await chatDaoV1.findOne("chats", { _id: params.chatId, type: CHAT_TYPE.GROUP, acrhivedBy: { $in: [tokenData.userId] } });
	// 		if (isSenderArchive) {
	// 			// this.inboxArchive(io, socket, PAGINATION_DEFAULT, ack, { userId: tokenData.userId });
	// 			this.refreshArchiveChatBox(io, socket, params, ack, { userId: tokenData.userId });
	// 		} else {
	// 			// this.inboxChat(io, socket, PAGINATION_DEFAULT, ack, { userId: tokenData.userId });
	// 			this.refreshChatBox(io, socket, params, ack, { userId: tokenData.userId });
	// 		}
	// 		const sender = await userDaoV1.findUserById(params.senderId);
	// 		for (let user of members) {
	// 			if (params.senderId.toString() !== user.toString()) {
	// 				consolelog(`-------${params.chatId},sendGroupMessage userId`, user, true);
	// 				let IsNotificationMuted = await this.checkforChatNotification(user, group._id);
	// 				const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + user + REDIS_KEY_PREFIX.SOCKET_ID);
	// 				if (socket_user) {
	// 					const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;//io.sockets.sockets.get(socket_user);
	// 					if (contactUserIdSocket) {
	// 						const isReceiverArchive = await chatDaoV1.findOne("chats", { _id: params.chatId, type: CHAT_TYPE.GROUP, acrhivedBy: { $in: [user] } });
	// 						if (isReceiverArchive) {
	// 							// this.inboxArchive(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: user });
	// 							this.refreshArchiveChatBox(io, contactUserIdSocket, params, ack, { userId: user });
	// 						} else {
	// 							if (socket_user) {
	// 								let roomParams = {
	// 									chatId: params.chatId,
	// 									socketId: socket_user
	// 								};
	// 								let IsNotification = await this.checkUserRoomInSocket(io, roomParams);
	// 								if (!IsNotification) //TODO:notification service
	// 								{
	// 									const contactUserId = await userDaoV1.findUserById(user);
	// 									let notificationData: ChatRequest.CHAT_NOTIFICATION = {
	// 										type: NOTIFICATION_TYPE.CHAT_NOTIFICATION,
	// 										title: sender?.name,
	// 										subtitle: group?.name,
	// 										message: data.translatedMessages[`${contactUserId.languageCode}`] ? data.translatedMessages[`${contactUserId.languageCode}`] : params.message,
	// 										body: data.translatedMessages[`${contactUserId.languageCode}`] ? data.translatedMessages[`${contactUserId.languageCode}`] : params.message,
	// 										details: {
	// 											chatId: params.chatId,
	// 											senderId: params.senderId,
	// 											receiverId: user.toString(),
	// 											receiverIdName: contactUserId?.name,
	// 											messageType: params.messageType,
	// 											profilePicture: group?.groupProfilePicture,
	// 											countryCode: sender.countryCode,
	// 											mobileNo: sender.mobileNo,
	// 											fullMobileNo: sender?.fullMobileNo,
	// 											type: CHAT_TYPE.COMMUNITY,
	// 											senderName: group?.name,
	// 											flagCode: sender?.flagCode,
	// 											membersDetails: message.membersDetails ? message.membersDetails : {}
	// 										}
	// 									}
	// 									console.log('********** sendGroupMessage notificationData*************', notificationData)
	// 									if (!IsNotificationMuted) await this.sendChatNotification(contactUserIdSocket, notificationData);

	// 								}
	// 							}
	// 							// this.inboxChat(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: user });
	// 							this.refreshChatBox(io, contactUserIdSocket, params, ack, { userId: user });
	// 						}
	// 					}
	// 				} else {
	// 					const contactUserId = await userDaoV1.findUserById(user);
	// 					let notification_message = messageTypeInChat(params.messageType) != MESSAGE_TYPE.TEXT ? messageTypeInChat(params.messageType) : data.translatedMessages[`${contactUserId.languageCode}`] ? data.translatedMessages[`${contactUserId.languageCode}`] : params.message;
	// 					console.log('***************************notification_message***************************', notification_message)
	// 					let notificationData: ChatRequest.CHAT_NOTIFICATION = {
	// 						type: NOTIFICATION_TYPE.CHAT_NOTIFICATION,
	// 						title: sender?.name,
	// 						subtitle: group?.name,
	// 						message: notification_message,
	// 						body: notification_message,
	// 						details: {
	// 							chatId: params.chatId,
	// 							senderId: params.senderId,
	// 							receiverId: user.toString(),
	// 							receiverIdName: contactUserId?.name,
	// 							messageType: params.messageType,
	// 							profilePicture: group?.groupProfilePicture,
	// 							countryCode: sender.countryCode,
	// 							mobileNo: sender.mobileNo,
	// 							fullMobileNo: sender?.fullMobileNo,
	// 							type: CHAT_TYPE.COMMUNITY,
	// 							senderName: group?.name,
	// 							flagCode: sender?.flagCode,
	// 							membersDetails: message.membersDetails ? message.membersDetails : {}
	// 						}
	// 					}
	// 					let contact = await userDaoV1.findOne("contacts", { userId: notificationData.details.receiverId, contactUserId: notificationData.details.senderId }, { name: 1 });
	// 					notificationData.title = contact?.name || sender.fullMobileNo;
	// 					const isSubscribedUser = await this.checkUserSubscription(notificationData.details.receiverId);
	// 					if (isSubscribedUser.isSubscribed || isSubscribedUser?.expiryTime < Date.now()) {
	// 						if (!IsNotificationMuted) await sendNotification(notificationData, socket.accessToken);
	// 					}
	// 				}
	// 			}
	// 		}
	// 		return true;
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	  * @function RepliedToCommunityMessage
	  * replied to a message in a current community group
	  */
	// async RepliedToCommunityMessage(io: any, socket: any, params: ChatRequest.REPLIED, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.messageId || !params.chatId || !params.messageType || !params.senderId || !params.localMessageId) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		const group = await chatDaoV1.findOne("chats", { _id: params.chatId, type: CHAT_TYPE.COMMUNITY, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!group) return ack(MESSAGES.ERROR.GROUP_NOT_FOUND);
	// 		const groupUser = await chatDaoV1.findOne("chats", { _id: params.chatId, members: { $in: tokenData.userId } });
	// 		if (!groupUser) return ack(MESSAGES.ERROR.USER_NOT_FOUND);
	// 		const messageId = await baseDao.find("messages", { _id: params.messageId }, {});
	// 		if (!messageId) {
	// 			ack(MESSAGES.ERROR.MESSAGE_NOT_FOUND)
	// 		}
	// 		let deletedBy = [], members = [], isRead = [], isDelivered = [];
	// 		if (group?.deletedBy && group?.exitedBy) {
	// 			deletedBy = group.deletedBy.concat(group.exitedBy)
	// 		}
	// 		// isRead.push(params.senderId);
	// 		// isDelivered.push(params.senderId);
	// 		for (let memb of group.members) {
	// 			const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + (memb).toString() + REDIS_KEY_PREFIX.SOCKET_ID);
	// 			if (socket_user) {
	// 				isDelivered.push(memb);
	// 				const scoketIds = await io.in(socket_user).fetchSockets();
	// 				for (const socket of scoketIds) {
	// 					if (socket?.rooms?.has(`${params.chatId}`)) isRead.push(memb);
	// 				}
	// 			}
	// 		}
	// 		members = group.members;
	// 		let data: any = {
	// 			_id: params.localMessageId,
	// 			messageId: messageId[0]._id,
	// 			type: CHAT_TYPE.COMMUNITY,
	// 			senderId: params.senderId,
	// 			members: members,
	// 			chatId: params.chatId,
	// 			message: params.message,
	// 			mediaUrl: params.mediaUrl,
	// 			messageType: params.messageType,
	// 			isRead: isRead,
	// 			isDelivered: isDelivered,
	// 			thumbnailUrl: params.thumbnailUrl ? params.thumbnailUrl : null,
	// 			location: params.location,
	// 			size: params.size ? params.size : null,
	// 			transcribe: params.transcribe ? params.transcribe : null,
	// 			status: params.status,
	// 			deletedBy: deletedBy,
	// 			taggedUser: params.taggedUser,
	// 			imageRatio: params.imageRatio,
	// 			localUrl: params.localUrl
	// 		}
	// 		let translatedInfo: any = {}
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			// translatedInfo = params.languageCode ? await translateMessage(params.languageCode, params.message, params.chatId, tokenData) : await autoTranslateMessage(params.message, params.chatId)
	// 			// data.translatedMessages = translatedInfo.encryptedMessages;
	// 			// data.langCodes = translatedInfo.langCodes;
	// 			// data.userLang = translatedInfo.userLang;
	// 		}
	// 		const message = await baseDao.save("messages", data);
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			data.translatedMessages = translatedInfo.translatedMessages;
	// 		}
	// 		await baseDao.findOneAndUpdate("chats", {
	// 			_id: params.chatId
	// 		}, {
	// 			lastMsgId: message._id,
	// 			lastMsgCreated: Date.now()
	// 		}, { new: true });
	// 		const membersDetails = await userDaoV1.find("users", { _id: { $in: members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 		message.membersDetails = membersDetails;
	// 		message.messageIdDetails = messageId;
	// 		const isSenderArchive = await this.checkChatArchiveStatus(tokenData.userId, params.chatId);
	// 		// const isSenderArchive = await chatDaoV1.findOne("chats", { _id: params.chatId, type: CHAT_TYPE.GROUP, acrhivedBy: { $in: [tokenData.userId] } });
	// 		ack(message);
	// 		io.to(`${params.chatId}`).emit(`${params.chatId}`, {
	// 			eventType: SOCKET.LISTNER_TYPE.GROUP.COMMUNITY_REPLIED,
	// 			data: message
	// 		});
	// 		if (isSenderArchive) {
	// 			this.inboxArchive(io, socket, PAGINATION_DEFAULT, ack, { userId: tokenData.userId });
	// 			this.refreshArchiveChatBox(io, socket, params, ack, { userId: tokenData.userId });
	// 		} else {
	// 			this.inboxChat(io, socket, PAGINATION_DEFAULT, ack, { userId: tokenData.userId });
	// 			this.refreshChatBox(io, socket, params, ack, { userId: tokenData.userId })

	// 		}
	// 		const sender = await userDaoV1.findUserById(params.senderId);
	// 		for (let user of members) {
	// 			if (params.senderId.toString() !== user.toString()) {
	// 				let IsNotificationMuted = await this.checkforChatNotification(user, group._id);
	// 				const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + user + REDIS_KEY_PREFIX.SOCKET_ID);
	// 				if (socket_user) {
	// 					const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;// io.sockets.sockets.get(socket_user);
	// 					if (contactUserIdSocket) {
	// 						const isReceiverArchive = await chatDaoV1.findOne("chats", { _id: params.chatId, type: CHAT_TYPE.GROUP, acrhivedBy: { $in: [user] } });
	// 						if (isReceiverArchive) {
	// 							this.inboxArchive(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: user });
	// 							this.refreshArchiveChatBox(io, contactUserIdSocket, params, ack, { userId: user });
	// 						} else {
	// 							if (socket_user) {
	// 								let roomParams = {
	// 									chatId: params.chatId,
	// 									socketId: socket_user
	// 								};
	// 								let IsNotification = await this.checkUserRoomInSocket(io, roomParams);
	// 								if (!IsNotification) //TODO:notification service
	// 								{
	// 									const contactUserId = await userDaoV1.findUserById(user);
	// 									let notificationData: ChatRequest.CHAT_NOTIFICATION = {
	// 										type: NOTIFICATION_TYPE.CHAT_NOTIFICATION,
	// 										title: sender?.name,
	// 										subtitle: group?.name,
	// 										message: data.translatedMessages[`${contactUserId.languageCode}`] ? data.translatedMessages[`${contactUserId.languageCode}`] : params.message,
	// 										body: data.translatedMessages[`${contactUserId.languageCode}`] ? data.translatedMessages[`${contactUserId.languageCode}`] : params.message,
	// 										details: {
	// 											chatId: params.chatId,
	// 											senderId: params.senderId,
	// 											receiverId: user,
	// 											receiverIdName: contactUserId?.name,
	// 											messageType: params.messageType,
	// 											profilePicture: group?.groupProfilePicture,
	// 											countryCode: sender.countryCode,
	// 											mobileNo: sender.mobileNo,
	// 											fullMobileNo: sender?.fullMobileNo,
	// 											type: CHAT_TYPE.COMMUNITY,
	// 											senderName: group?.name,
	// 											flagCode: sender?.flagCode,
	// 											membersDetails: message.membersDetails ? message.membersDetails : {}
	// 										}
	// 									}
	// 									console.log('********** RepliedToGroupMessage notificationData*************', notificationData)
	// 									if (!IsNotificationMuted) await this.sendChatNotification(contactUserIdSocket, notificationData);
	// 								}
	// 							}
	// 							this.inboxChat(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: user });
	// 							this.refreshChatBox(io, contactUserIdSocket, params, ack, { userId: user });
	// 						}
	// 					}
	// 				} else {
	// 					const contactUserId = await userDaoV1.findUserById(user);
	// 					let notification_message = messageTypeInChat(params.messageType) != MESSAGE_TYPE.TEXT ? messageTypeInChat(params.messageType) : data.translatedMessages[`${contactUserId.languageCode}`] ? data.translatedMessages[`${contactUserId.languageCode}`] : params.message;
	// 					console.log('***************************notification_message***************************', notification_message)
	// 					let notificationData: ChatRequest.CHAT_NOTIFICATION = {
	// 						type: NOTIFICATION_TYPE.CHAT_NOTIFICATION,
	// 						title: sender?.name,
	// 						subtitle: group?.name,
	// 						message: notification_message,
	// 						body: notification_message,
	// 						details: {
	// 							chatId: params.chatId,
	// 							senderId: params.senderId,
	// 							receiverId: user.toString(),
	// 							receiverIdName: contactUserId?.name,
	// 							messageType: params.messageType,
	// 							profilePicture: group?.groupProfilePicture,
	// 							countryCode: sender.countryCode,
	// 							mobileNo: sender.mobileNo,
	// 							fullMobileNo: sender?.fullMobileNo,
	// 							type: CHAT_TYPE.COMMUNITY,
	// 							senderName: group?.name,
	// 							flagCode: sender?.flagCode,
	// 							membersDetails: message.membersDetails ? message.membersDetails : {}
	// 						}
	// 					}
	// 					let contact = await userDaoV1.findOne("contacts", { userId: notificationData.details.receiverId, contactUserId: notificationData.details.senderId }, { name: 1 });
	// 					notificationData.title = contact?.name || sender.fullMobileNo;
	// 					console.log('********** RepliedToGroupMessage push notificationData*************', notificationData);
	// 					const isSubscribedUser = await this.checkUserSubscription(notificationData.details.receiverId);
	// 					if (isSubscribedUser.isSubscribed || isSubscribedUser?.expiryTime < Date.now()) {
	// 						if (!IsNotificationMuted) await sendNotification(notificationData, socket.accessToken);
	// 					}
	// 				}
	// 			}
	// 		}
	// 		return true;
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function exitCommunity
	 * exit from a community group
	 * if only admin left from the group then assign new random admin to existing group
	// */
	// async exitCommunity(io: any, socket: any, params: ChatRequest.Id, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.groupId) {
	// 			return ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 		}
	// 		let group = await chatDaoV1.findOne("chats", { _id: params.groupId, type: CHAT_TYPE.COMMUNITY, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		// if (!group) return ack(MESSAGES.ERROR.COMMUNITY_NOT_FOUND);
	// 		const groupUser = await chatDaoV1.findOne("chats", { _id: params.groupId, members: { $in: tokenData.userId } });
	// 		if (!groupUser) return ack(MESSAGES.ERROR.USER_NOT_FOUND);
	// 		if (groupUser.admins[0].toString() == tokenData.userId) {
	// 			// return ack(MESSAGES.ERROR.COMMUNITY_ADMIN_LEAVE)
	// 		}
	// 		await chatDaoV1.findOneAndUpdate("chats", { _id: params.groupId }, { $pull: { members: tokenData.userId, admins: tokenData.userId }, $push: { exitedBy: tokenData.userId } }, { new: true });
	// 		const members = group.members;
	// 		await chatDaoV1.findOneAndUpdate("chats", { _id: params.groupId }, { $pull: { members: tokenData.userId }, $push: { exitedBy: tokenData.userId } }, { new: true });

	// 		/*save header message*/
	// 		let details: any = {}, taggedUser = [];
	// 		details.languageCode = LANGUAGE_CODE.EN;
	// 		details.message = CHAT_HEADERS.GROUP.LEFT(tokenData.userId);
	// 		taggedUser.push(tokenData.userId)
	// 		let isRead = [], isDelivered = [];
	// 		isRead.push(tokenData.userId);
	// 		isDelivered.push(tokenData.userId);
	// 		let save: any = {
	// 			type: CHAT_TYPE.COMMUNITY,
	// 			senderId: tokenData.userId,
	// 			members: members,
	// 			chatId: group._id,
	// 			message: details.message,
	// 			mediaUrl: null,
	// 			messageType: MESSAGE_TYPE.HEADING,
	// 			isRead: isRead,
	// 			isDelivered: isDelivered,
	// 			thumbnailUrl: details.thumbnailUrl ? details.thumbnailUrl : null,
	// 			location: null,
	// 			size: details.size ? details.size : null,
	// 			transcribe: details.transcribe ? details.transcribe : null,
	// 			status: STATUS.ACTIVE,
	// 			taggedUser: taggedUser
	// 		}
	// 		let translatedInfo: any = {}
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			// const translatedInfo = await translateMessage(details.languageCode, details.message, group._id, tokenData, false)
	// 			// save.translatedMessages = translatedInfo.encryptedMessages;
	// 			// save.langCodes = translatedInfo.langCodes;
	// 			// save.userLang = translatedInfo.userLang;
	// 		}
	// 		const header_messages = await baseDao.save("messages", save);
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			save.translatedMessages = translatedInfo.translatedMessages;
	// 		}
	// 		/*end of saving header msg*/
	// 		group = await baseDao.findOneAndUpdate("chats", {
	// 			_id: group._id
	// 		}, {
	// 			lastMsgId: header_messages._id,
	// 			lastMsgCreated: Date.now()
	// 		}, { new: true });
	// 		const membersDetails = await userDaoV1.find("users", { _id: { $in: members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 		header_messages.membersDetails = membersDetails;
	// 		/*after exited members details*/
	// 		let removedMembersDetails = await userDaoV1.find("users", { _id: { $in: group.members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 		group.membersDetails = removedMembersDetails;
	// 		ack(MESSAGES.SUCCESS.DEFAULT);
	// 		io.to(`${params.groupId}`).emit(`${params.groupId}`, {
	// 			eventType: SOCKET.LISTNER_TYPE.GROUP.COMMUNITY_MESSAGES,
	// 			data: header_messages
	// 		});
	// 		io.to(`${params.groupId}`).emit(`${params.groupId}`, {
	// 			eventType: SOCKET.LISTNER_TYPE.GROUP.COMMUNITY_INFO,
	// 			groupDetails: group
	// 		});
	// 		const sender = await userDaoV1.findUserById(tokenData.userId);
	// 		for (let user of members) {
	// 			let IsNotificationMuted = await this.checkforChatNotification(user, group._id);
	// 			const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + user + REDIS_KEY_PREFIX.SOCKET_ID);
	// 			if (socket_user) {
	// 				const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;// io.sockets.sockets.get(socket_user);
	// 				if (contactUserIdSocket) {
	// 					if (user.toString() !== tokenData.userId.toString()) {
	// 						await this.triggerCommunityNotification(true, params, socket_user, sender, user, io, group, save, socket, contactUserIdSocket, IsNotificationMuted)
	// 					}
	// 					this.inboxChat(io, contactUserIdSocket, PAGINATION_DEFAULT, ack, { userId: user });
	// 					// this.refreshChatBox(io,contactUserIdSocket,{chatId: group._id},ack,{userId: user});
	// 				}
	// 			} else {
	// 				if (user.toString() !== tokenData.userId.toString()) {
	// 					await this.triggerCommunityNotification(false, params, socket_user, sender, user, io, group, save, socket, {}, IsNotificationMuted)
	// 				}
	// 			}
	// 		}
	// 		/*END NOTIFY USERS*/
	// 		this.refreshGroupChatInboxList(params.groupId, tokenData.userId, group.members, io, socket, ack);
	// 		return
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function reportCommunityChat
	 * report a community group by chat-room @:grouId
	*/
	// async reportCommunityChat(io: any, socket: any, params: ChatRequest.Id, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.groupId || !params.reason) {
	// 			ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 			return
	// 		}
	// 		const group = await chatDaoV1.findOne("chats", { _id: params.groupId, type: CHAT_TYPE.COMMUNITY, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!group) return ack(MESSAGES.ERROR.GROUP_NOT_FOUND);
	// 		let data = {
	// 			type: CHAT_REPORT_TYPE.GROUP,
	// 			reportedBy: tokenData.userId,
	// 			chatId: group._id,
	// 			reason: params.reason,
	// 			chatType: CHAT_TYPE.COMMUNITY
	// 		}
	// 		const report = await baseDao.save("chat_report", data);
	// 		await baseDao.updateOne("chats", { _id: params.groupId }, { $inc: { reportCount: 1 } }, {});
	// 		return ack(MESSAGES.SUCCESS.DETAILS(report));
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function joinCommunityChat
	 * enter in a group chat and allow socket to join a chat-room @:grouId
	*/
	// async joinCommunityChat(io: any, socket: any, params: ChatRequest.Id, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.groupId) {
	// 			return ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 		}
	// 		const group = await chatDaoV1.findOne("chats", { _id: params.groupId, type: CHAT_TYPE.COMMUNITY, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!group) return ack(MESSAGES.ERROR.GROUP_NOT_FOUND);
	// 		const groupUser = await chatDaoV1.findOne("chats", { _id: params.groupId, overallMembers: { $in: tokenData.userId } });
	// 		if (!groupUser) return ack(MESSAGES.ERROR.USER_NOT_FOUND);
	// 		let data = {
	// 			chatId: group?._id,
	// 			groupProfilePicture: group?.groupProfilePicture,
	// 			name: group?.name,
	// 			description: group?.description,
	// 			chatType: group?.type,
	// 			status: group?.status,
	// 			mutedBy: group?.mutedBy
	// 		}
	// 		if (!group.langCodes?.length && SERVER.IS_TRANSLATION_ENABLE) {
	// 			const toUpdate: any = {}
	// 			const chatUserInfo = await this.setUserLanguage(group?.members)
	// 			toUpdate["$addToSet"] = {
	// 				userLang: chatUserInfo.userLang,
	// 				langCodes: chatUserInfo.langCodes
	// 			}
	// 			await chatDaoV1.findOneAndUpdate("chats", { _id: group._id }, toUpdate)
	// 		}
	// 		ack(MESSAGES.SUCCESS.CHAT_FORMATION(data));
	// 		socket.join(`${group._id}`);
	// 		socket.emit(SOCKET.LISTNER_TYPE.GROUP.COMMUNITY_JOIN, MESSAGES.SUCCESS.CHAT_FORMATION(data));
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function deleteCommunityChat
	 * delete community group
	*/
	// async deleteCommunityChat(io: any, socket: any, params: ChatRequest.Id, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.groupId) {
	// 			return ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 		}
	// 		const group = await chatDaoV1.findOne("chats", { _id: params.groupId, type: CHAT_TYPE.COMMUNITY, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!group) return ack(MESSAGES.ERROR.GROUP_NOT_FOUND);

	// 		await chatDaoV1.findOneAndUpdate("chats", { _id: params.groupId }, { exitedBy: [], status: STATUS.DELETED }, { new: true });
	// 		ack(MESSAGES.SUCCESS.DEFAULT);
	// 		await Promise.all([
	// 			baseDao.updateMany("messages", { chatId: params.groupId }, { $addToSet: { deletedBy: group.members } }, {}),
	// 			// baseDao.findOneAndUpdate("communities",{groupId:params.groupId},{$unset:{groupId:1},$set:{isGroupCreated:false}}),
	// 		])
	// 		for (let element of group.members) {
	// 			if (element.toString() !== tokenData.userId.toString()) {
	// 				const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + (element).toString() + REDIS_KEY_PREFIX.SOCKET_ID);
	// 				const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;//io.sockets.sockets.get((socket_user));
	// 				if (contactUserIdSocket) contactUserIdSocket.emit(SOCKET.LISTNER_TYPE.GROUP.COMMUNITY_DELETE,
	// 					{
	// 						groupId: params.groupId,
	// 						chatId: group._id
	// 					});
	// 			}
	// 		}
	// 		return this.refreshGroupChatInboxList(params.groupId, tokenData.userId, group.members, io, socket, ack);
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }


	/**
	 * @function removeDeleteCommunity
	 * remove delete community chat from inbox listing
	*/
	// async removeDeleteCommunity(io: any, socket: any, params: ChatRequest.Id, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.groupId) {
	// 			return ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 		}
	// 		const group = await chatDaoV1.findOne("chats", { _id: params.groupId, type: CHAT_TYPE.COMMUNITY, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		if (!group) return ack(MESSAGES.ERROR.GROUP_NOT_FOUND);

	// 		await chatDaoV1.findOneAndUpdate("chats", { _id: params.groupId }, { $addToSet: { deletedBy: tokenData.userId } }, { new: true });
	// 		ack(MESSAGES.SUCCESS.DEFAULT);
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }
	/**
 * @function removeCommunityMember
 * remove user from a community group only by admins
*/
	// async removeCommunityMember(io: any, socket: any, params: ChatRequest.Id, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.groupId) {
	// 			return ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 		}
	// 		let group = await chatDaoV1.findOne("chats", { _id: params.groupId, type: CHAT_TYPE.COMMUNITY, deletedBy: { $nin: [tokenData.userId] } }, {});
	// 		// if (!group) return ack(MESSAGES.ERROR.COMMUNITY_NOT_FOUND);
	// 		const groupUser = await chatDaoV1.findOne("chats", { _id: params.groupId, members: { $in: params.contactUserId } });
	// 		if (!groupUser) return ack(MESSAGES.ERROR.USER_NOT_FOUND);
	// 		const isAdmin = await chatDaoV1.findOne("chats", { _id: params.groupId, admins: { $in: tokenData.userId } });
	// 		if (!isAdmin) return ack(MESSAGES.ERROR.UNAUTHORIZE_ADMIN);
	// 		const removeGroupMember = await chatDaoV1.findOneAndUpdate("chats", { _id: params.groupId }, { $pull: { members: params.contactUserId, admins: params.contactUserId }, $addToSet: { exitedBy: params.contactUserId } }, { new: true });
	// 		/*save header message*/
	// 		let details: any = {}, taggedUser = [];
	// 		details.languageCode = LANGUAGE_CODE.EN;
	// 		details.message = CHAT_HEADERS.GROUP.REMOVE(tokenData.userId, params.contactUserId);
	// 		taggedUser.push(tokenData.userId, params.contactUserId)
	// 		let isRead = [], isDelivered = [];
	// 		isRead.push(tokenData.userId);
	// 		isDelivered.push(tokenData.userId);
	// 		let save: any = {
	// 			type: CHAT_TYPE.COMMUNITY,
	// 			senderId: tokenData.userId,
	// 			members: group.members,
	// 			chatId: group._id,
	// 			message: details.message,
	// 			mediaUrl: null,
	// 			messageType: MESSAGE_TYPE.HEADING,
	// 			isRead: isRead,
	// 			isDelivered: isDelivered,
	// 			thumbnailUrl: details.thumbnailUrl ? details.thumbnailUrl : null,
	// 			location: null,
	// 			size: details.size ? details.size : null,
	// 			transcribe: details.transcribe ? details.transcribe : null,
	// 			status: STATUS.ACTIVE,
	// 			contact: null
	// 		}
	// 		let translatedInfo: any = {}
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			// const translatedInfo = await translateMessage(details.languageCode, details.message, group._id, tokenData, false)
	// 			// save.translatedMessages = translatedInfo.encryptedMessages;
	// 			// save.langCodes = translatedInfo.langCodes;
	// 			// save.userLang = translatedInfo.userLang;
	// 		}
	// 		const header_messages = await baseDao.save("messages", save);
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			save.translatedMessages = translatedInfo.translatedMessages;
	// 		}
	// 		/*end of saving header msg*/
	// 		group = await baseDao.findOneAndUpdate("chats", {
	// 			_id: group._id
	// 		}, {
	// 			lastMsgId: header_messages._id,
	// 			lastMsgCreated: Date.now()
	// 		}, { new: true });
	// 		let membersDetails = await userDaoV1.find("users", { _id: { $in: save.members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 		header_messages.membersDetails = membersDetails; //save full members details
	// 		/*remove current removed members details*/
	// 		let removedMembersDetails = await userDaoV1.find("users", { _id: { $in: removeGroupMember.members } }, { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1 });
	// 		group.membersDetails = removedMembersDetails;
	// 		await this.notifyRemovedUser(io, {
	// 			userId: params.contactUserId,
	// 			groupId: params.groupId
	// 		});
	// 		/** */
	// 		ack(MESSAGES.SUCCESS.DEFAULT);
	// 		io.to(`${params.groupId}`).emit(`${params.groupId}`, {
	// 			eventType: SOCKET.LISTNER_TYPE.GROUP.COMMUNITY_MESSAGES,
	// 			data: header_messages
	// 		});
	// 		io.to(`${params.groupId}`).emit(`${params.groupId}`, {
	// 			eventType: SOCKET.LISTNER_TYPE.GROUP.COMMUNITY_INFO,
	// 			groupDetails: group
	// 		});
	// 		this.refreshGroupChatInboxList(params.groupId, tokenData.userId, save.members, io, socket, ack);
	// 		return
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	async insertCallLog(params: ChatRequest.CallLog) {
		try {
			const callLog = await baseDao.insert("call_logs", {
				_id: params._id,
				chatId: params.chatId,
				callType: params.callType,
				callerId: params.callerId,
				receiverId: params.receiverId,
				mode: params.mode,
				status: params.status,
				created: params.created,
				startTime: params.startTime,
				endTime: params.endTime,
				meetingDetails: {
					meetingId: params.meetingDetails?.meetingId,
					externalMeetingId: params.meetingDetails?.externalMeetingId,
					mediaRegion: params.meetingDetails?.mediaRegion,
					mediaPlacement: {
						audioHostUrl: params.meetingDetails?.mediaPlacement?.audioHostUrl,
						audioFallbackUrl: params.meetingDetails?.mediaPlacement?.audioFallbackUrl,
						signalingUrl: params.meetingDetails?.mediaPlacement?.signalingUrl,
						turnControlUrl: params.meetingDetails?.mediaPlacement?.turnControlUrl,
						screenDataUrl: params.meetingDetails?.mediaPlacement?.screenDataUrl,
						screenViewingUrl: params.meetingDetails?.mediaPlacement?.screenViewingUrl,
						screenSharingUrl: params.meetingDetails?.mediaPlacement?.screenSharingUrl,
						eventIngestionUrl: params.meetingDetails?.mediaPlacement?.eventIngestionUrl,
					},
					tenantIds: params.meetingDetails?.tenantIds,
					meetingArn: params.meetingDetails?.meetingArn
				}
			}, {})
			return callLog
		} catch (error) {
			throw error
		}
	}

	/**
	 * @function storeCallLogs
	 * Store call logs
	 */
	async storeCallLogs(params: ChatRequest.StoreCallLogRequest, tokenData: TokenData) {
		try {
			const promises = params.callLogs.map(async (callLog) => {
				try {
					const data = await this.insertCallLog(callLog);
					return {
						...data?._doc,
						error: null,
						errorType: null,
						storeStatus: "SUCCESS"
					};
				} catch (error) {
					console.log(error.message)
					return {
						...callLog,
						error: error.message,
						errorType: error.code === 11000 ? 'DUPLICATE_KEY' : 'ERROR',
						storeStatus: "ERROR"
					};
				}
			});

			const results = await Promise.all(promises);

			await baseDao.updateOne("users", { '_id': tokenData.userId }, { 'isCallLogSynced': true }, {});

			return MESSAGES.SUCCESS.DETAILS({
				callLogs: results
			});
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function deleteCallLog
	 * Delete call log
	 */
	async deleteCallLog(query: { id: string }, tokenData: TokenData) {
		try {
			await baseDao.deleteOne("call_logs", { _id: toObjectId(query.id) })
			return MESSAGES.SUCCESS.DEFAULT;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function getCallLogs
	 * Get call logs
	 */
	async getCallLogs(query: ChatRequest.CallLogList, tokenData: TokenData) {
		try {
			const userId = tokenData.userId;
			const data = await chatDaoV1.callLogList(query, tokenData.userId);
			return MESSAGES.SUCCESS.LIST({ data });
		} catch (error) {
			throw error;
		}
	}

	/** @function messageRequestSent
	 * get message request sent list
	*/
	// async createMessageRequest(io: any, socket: any, params: ChatRequest.CreateMessageRequest, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.userId || !params.message) {
	// 			return ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 		}
	// 		const isChatExist=await chatDaoV1.isChatExists([params.userId,tokenData.userId])
	// 		if(isChatExist) return ack(MESSAGES.ERROR.CHAT_ALREADY_EXIST);
	// 		const step1= await chatDaoV1.isMessageRequestCreated(params,tokenData);
	// 		if(step1){
	// 			if(step1.status==STATUS.ACCEPTED) return ack(MESSAGES.ERROR.CHAT_ALREADY_EXIST)
	// 			else if(step1.senderId.toString()==tokenData.userId.toString()) return ack(MESSAGES.ERROR.MESSAGE_REQUEST_ALREADY_SENT)
	// 			return ack(MESSAGES.ERROR.MESSAGE_REQUEST_ALREADY_RECEIVED)
	// 		}
	// 		else{
	// 			const step2=await chatDaoV1.createMessageRequest(params,tokenData)

	// 			let userDetails:any={};
	// 			const [isSubscribedUser,isContactSaved]=await Promise.all([
	// 				this.checkUserSubscription(params.userId.toString()),
	// 				userDaoV1.isContactSaved(params.userId,tokenData.userId)
	// 			])
	// 			const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + (params.userId).toString() + REDIS_KEY_PREFIX.SOCKET_ID);
	// 			const contactUserIdSocket = socket_user ? socket.broadcast.to(socket_user) : undefined;//io.sockets.sockets.get((socket_user));
	// 			if (contactUserIdSocket) {
	// 				const msg_rqst_count= await baseDao.countDocuments("message_requests",{
	// 					status : { $eq: STATUS.PENDING },
	// 					receiverId : { $eq: toObjectId(params.userId) },
	// 				})
	// 				contactUserIdSocket.emit(SOCKET.LISTNER_TYPE.SOCKET_SERVICE.RECEIVED_REQUEST_COUNT, 
	// 				{
	// 					userId:tokenData.userId,
	// 					message:params.message,
	// 					msg_rqst_count:msg_rqst_count || 0
	// 				});
	// 			}
	// 			else if(isSubscribedUser.isSubscribed || isSubscribedUser?.expiryTime < Date.now()) {
	// 				if(!isContactSaved){
	// 					userDetails=await userDaoV1.findUserById(tokenData.userId)
	// 				}	
	// 				let notificationData = {
	// 					type: NOTIFICATION_TYPE.MESSAGE_REQUEST_NOTIFICATION,
	// 					title: isContactSaved?isContactSaved.name : `${userDetails.countryCode} ${userDetails.mobileNo}`,
	// 					receiverId: [params.userId],
	// 					details: {
	// 						message: params.message,
	// 						senderId: tokenData.userId,
	//           				type:NOTIFICATION_TYPE.MESSAGE_REQUEST_NOTIFICATION,
	// 					}
	// 				}
	// 				await OneToOneNotifications(notificationData, socket.accessToken);
	// 			}
	// 		}
	// 		return ack(MESSAGES.SUCCESS.DEFAULT);
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function messageRequestSent
	 * get message request sent list
	*/
	// async messageRequestSent(io: any, socket: any, params: ChatRequest.RequestList, ack: any, tokenData: TokenData) {
	// 	try {
	// 		const step1 = await chatDaoV1.messageRequestSent(params, tokenData.userId);
	// 		return ack(MESSAGES.SUCCESS.LIST(step1));
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }
	/**
	 * @function messageRequestReveived
	 * get message request received list
	*/
	// async messageRequestReveived(io: any, socket: any, params: ChatRequest.RequestList, ack: any, tokenData: TokenData) {
	// 	try {
	// 		const step1 = await chatDaoV1.messageRequestReceived(params, tokenData.userId);
	// 		return ack(MESSAGES.SUCCESS.LIST(step1));
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }
	/**
	 * @function messageRequestAccept
	 * accept message request
	*/
	// async messageRequestAccept(io: any, socket: any, params: ChatRequest.MessageRequestAccept, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.userId) {
	// 			return ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 		}
	// 		const match: any = {
	// 			status : { $eq: STATUS.PENDING },
	// 			senderId : { $eq: toObjectId(params.userId) },
	// 			receiverId : { $eq: toObjectId(tokenData.userId) },
	// 		};
	// 		const isRequestExist=await baseDao.findOne("message_requests",match)
	// 		if(!isRequestExist) return ack(MESSAGES.ERROR.MESSAGE_REQUEST_NOT_FOUND)
	// 		if(isRequestExist.status==STATUS.ACCEPTED) ack(MESSAGES.ERROR.MESSAGE_REQUEST_ALREADY_APPROVED)

	// 		// change status on message_request collection
	// 		const step1=await baseDao.findOneAndUpdate("message_requests",{_id:isRequestExist._id},{status:STATUS.ACCEPTED},{new:true});

	// 		// create one to one room
	// 		const contactUserId = await userDaoV1.findUserById(params.userId);
	// 		if (!contactUserId) {
	// 			ack(MESSAGES.ERROR.USER_NOT_FOUND)
	// 			return
	// 		}
	// 		const isBlocked = await this.checkUserBlockedStatus(tokenData.userId, params.userId);
	// 		const isReceiverBlocked = await this.checkUserBlockedStatus(params.userId, tokenData.userId);
	// 		let members = [];
	// 		members.push(tokenData.userId, params.userId);
	// 		let isExist = await chatDaoV1.isChatExists(members);
	// 		if (!isExist) {
	// 			const data: any = {
	// 				members: members,
	// 				overallMembers: members
	// 			}
	// 			if (SERVER.IS_TRANSLATION_ENABLE) {
	// 				const chatUserInfo = await this.setUserLanguage([params.userId, tokenData.userId])
	// 				data.userLang = chatUserInfo.userLang;
	// 				data.langCodes = chatUserInfo.langCodes;
	// 			}
	// 			isExist = await chatDaoV1.save("chats", data)
	// 		}
	// 		else if(!isExist.langCodes?.length && SERVER.IS_TRANSLATION_ENABLE){
	// 			const toUpdate:any={}
	// 			const chatUserInfo = await this.setUserLanguage(isExist?.members)
	// 			toUpdate["$addToSet"]={
	// 				userLang :chatUserInfo.userLang,
	// 				langCodes : chatUserInfo.langCodes
	// 			}
	// 			await chatDaoV1.findOneAndUpdate("chats",{_id:isExist._id},toUpdate)
	// 		}
	// 		if(!isExist._id) return ack(MESSAGES.ERROR.CHAT_NOT_FOUND);
	// 		let isOnline = false;
	// 		const socket_user = await redisClient.getValue(SERVER.APP_NAME + "_" + params.userId + REDIS_KEY_PREFIX.SOCKET_ID);
	// 		if (socket_user) isOnline = true;
	// 		let offline_status = await this.checkUserOfflineOverallStatus(tokenData.userId, params.userId);
	// 		if (offline_status) isOnline = false;
	// 		let data = {
	// 			chatId: isExist?._id,
	// 			lastSeen: contactUserId?.lastSeen || 0,
	// 			countryCode: contactUserId?.countryCode,
	// 			mobileNo: contactUserId?.mobileNo,
	// 			language: contactUserId?.language,
	// 			profilePicture: contactUserId?.profilePicture,
	// 			flagCode: contactUserId?.flagCode,
	// 			name: contactUserId?.name,
	// 			isBlocked: isBlocked ? true : false,
	// 			isReceiverBlocked: isReceiverBlocked ? true : false,
	// 			isOnline: isOnline,
	// 			chatType: isExist?.type,
	// 			mutedBy: isExist?.mutedBy
	// 		}
	// 		ack(MESSAGES.SUCCESS.CHAT_FORMATION(data));
	// 		socket.join(`${isExist._id}`);
	// 		socket.emit(SOCKET.LISTNER.ONE_TO_ONE, MESSAGES.SUCCESS.CHAT_FORMATION(data));


	// 		// save msg

	// 		let isDelivered = [], isRead = [], deletedBy = [], blockedMessage = false;
	// 		if (isBlocked) {
	// 			blockedMessage = true
	// 			deletedBy.push(toObjectId(params.userId))
	// 		} else if (socket_user) {
	// 			if (!isBlocked) {
	// 				isDelivered.push(params.userId);
	// 			}
	// 			const scoketIds = await io.in(socket_user).fetchSockets();
	// 			for (const socket of scoketIds) {
	// 				if (socket?.rooms?.has(`${isExist?._id}`)) isRead.push(params.userId);
	// 			}
	// 		}
	// 		members = [];
	// 		isRead.push(params.userId,tokenData.userId);
	// 		isDelivered.push(params.userId,tokenData.userId);
	// 		members.push(tokenData.userId, params.userId);
	// 		let msgData:any = {
	// 			type: CHAT_TYPE.ONE_TO_ONE,
	// 			senderId: params.userId,
	// 			members: members,
	// 			chatId: isExist?._id,
	// 			message: isRequestExist.message,
	// 			messageType: MESSAGE_TYPE.TEXT,
	// 			isRead: isRead,
	// 			isDelivered: isDelivered,
	// 			thumbnailUrl:  null,
	// 			size:  null,
	// 			transcribe: null,
	// 			status: STATUS.ACTIVE,
	// 			deletedBy: deletedBy,
	// 			blockedMessage: blockedMessage,
	// 			created:isRequestExist.created,
	// 		}
	// 		let translatedInfo: any = {}
	// 		if (SERVER.IS_TRANSLATION_ENABLE) {
	// 			// translatedInfo =await autoTranslateMessage(msgData.message, msgData.chatId)
	// 			// msgData.translatedMessages = translatedInfo.encryptedMessages;
	// 			// msgData.langCodes = translatedInfo.langCodes;
	// 			// msgData.userLang = translatedInfo.userLang;
	// 		}
	// 		const message = await baseDao.save("messages", msgData);
	// 		// if (SERVER.IS_TRANSLATION_ENABLE) {
	// 		// 	msgData.translatedMessages = translatedInfo.translatedMessages;
	// 		// }
	// 		const Chat = await baseDao.findOneAndUpdate("chats", {
	// 			_id: isExist._id
	// 		}, {
	// 			lastMsgId: message._id,
	// 			lastMsgCreated: isRequestExist.created,
	// 			deletedBy: []
	// 		}, { new: true });

	// 		return ack(MESSAGES.SUCCESS.DETAILS(Chat));
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function messageRequestReject
	 * reject message request
	*/
	// async messageRequestReject(io: any, socket: any, params: ChatRequest.MessageRequestAccept, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.userId) {
	// 			return ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 		}
	// 		const match: any = {
	// 			status : { $eq: STATUS.PENDING },
	// 			senderId : { $eq: toObjectId(params.userId) },
	// 			receiverId : { $eq: toObjectId(tokenData.userId) },
	// 		};
	// 		const isRequestExist=await baseDao.findOne("message_requests",match)
	// 		if(!isRequestExist) return ack(MESSAGES.ERROR.MESSAGE_REQUEST_NOT_FOUND)
	// 		await baseDao.findOneAndUpdate("message_requests",{_id:isRequestExist._id},{status:STATUS.REJECTED})
	// 		return ack(MESSAGES.SUCCESS.MESSAGE_REQUEST_REJECT);
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function ReceivedRequestCount
	 * pending message request count
	*/
	// async ReceivedRequestCount(io: any, socket: any, params: ChatRequest.MessageRequestAccept, ack: any, tokenData: TokenData) {
	// 	try {
	// 		const match: any = {
	// 			status: { $eq: STATUS.PENDING },
	// 			receiverId: { $eq: toObjectId(tokenData.userId) },
	// 		};
	// 		const rcvCount = await baseDao.countDocuments("message_requests", match)
	// 		return ack(MESSAGES.SUCCESS.DETAILS({ rcvCount }));
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/**
	 * @function RemoveMessageRequest
	 * delete message request
	*/
	// async RemoveMessageRequest(io: any, socket: any, params: ChatRequest.MessageRequestAccept, ack: any, tokenData: TokenData) {
	// 	try {
	// 		if (!params.userId) {
	// 			return ack(MESSAGES.ERROR.PARAMS_MISSING)
	// 		}
	// 		const match: any = {
	// 			status : { $eq: STATUS.PENDING },
	// 			receiverId : { $eq: toObjectId(params.userId) },
	// 			senderId : { $eq: toObjectId(tokenData.userId) },
	// 		};
	// 		const isRequestExist=await baseDao.findOne("message_requests",match)
	// 		if(!isRequestExist) return ack(MESSAGES.ERROR.MESSAGE_REQUEST_NOT_FOUND)
	// 		await baseDao.findOneAndUpdate("message_requests",{_id:isRequestExist._id},{status:STATUS.DELETED})
	// 		return ack(MESSAGES.SUCCESS.MESSAGE_REQUEST_DELETED);
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }
	/*
	* @function badgesScript
	 * script for adding badges for old users
	*/
	// async badgesScript() {
	// 	try {
	// 		const aggPipe = [];
	// 		aggPipe.push({
	// 			$match:{
	// 				status:{$in:[STATUS.UN_BLOCKED,STATUS.BLOCKED]}
	// 			}
	// 		})
	// 		aggPipe.push(
	// 			{
	// 				$lookup: {
	// 					from: "chats",
	// 					let: { userId: "$_id", languageCode: "$languageCode" },
	// 					pipeline: [
	// 						{
	// 							$match: {
	// 								$expr: {
	// 									$and: [
	// 										{ $eq: ["$type", CHAT_TYPE.ONE_TO_ONE] },
	// 										{ $in: ["$$userId", "$members"] }
	// 									]
	// 								}
	// 							}
	// 						},
	// 						{
	// 							$project: {
	// 								_id: 0,
	// 								userLang: 1
	// 							}
	// 						},
	// 						{
	// 							$unwind: "$userLang"
	// 						},
	// 						{
	// 							$group: {
	// 								_id: "$_id",
	// 								userLangs: { $push: "$userLang" }
	// 							}
	// 						},
	// 						{
	// 							$project: {
	// 								secondUserLang: {
	// 									$filter: {
	// 										input: "$userLangs",
	// 										as: "lang",
	// 										cond: {
	// 											$and: [
	// 												{ $ne: ["$$lang.userId", "$$userId"] },
	// 												{ $ne: ["$$lang.languageCode", "$$languageCode"] }
	// 											]
	// 										}
	// 									}
	// 								}
	// 							}
	// 						},
	// 						{
	// 							$unwind: "$secondUserLang"
	// 						},
	// 						{
	// 							$group: {
	// 								_id: null,
	// 								secondUsersLanguages: {
	// 									$addToSet: {
	// 										userId: "$secondUserLang.userId",
	// 										languageCode: "$secondUserLang.languageCode"
	// 									}
	// 								}
	// 							}
	// 						},
	// 						{
	// 							$unwind: "$secondUsersLanguages"
	// 						},
	// 						{
	// 							$match: {
	// 								"languageCode": { $ne: "$secondUsersLanguages.languageCode" }
	// 							}
	// 						},
	// 						{
	// 							$group: {
	// 								_id: null,
	// 								uniqueLanguageCodes: {
	// 									$addToSet: "$secondUsersLanguages.languageCode"
	// 								}
	// 							}
	// 						}
	// 					],
	// 					as: "chats"
	// 				}
	// 			}
	// 		);
	// 		aggPipe.push(
	// 			{
	// 				$match: {
	// 					"chats": { $ne: [] }
	// 				}
	// 			},
	// 		)
	// 		aggPipe.push({
	// 			$project:{
	// 				_id:1,
	// 				badges:{ $ifNull: ["$badges", []] },
	// 				uniqueLanguageCodes: { $ifNull: ["$chats.uniqueLanguageCodes", []] }
	// 			}
	// 		})
	// 		const data = await userDaoV1.aggregate("users", aggPipe);
	// 		// const chunkArray=splitArrayInToChunks(data,1);
	// 		const chunkArray=splitArrayInToChunks(data, SERVER.SCRIPT_CHUNK_SIZE);
	// 		for(let elm of chunkArray){
	// 			let toInsert=[];
	// 			const bulkOperations = await Promise.all(elm.map(async ({ _id, uniqueLanguageCodes }) => {
	// 				if (uniqueLanguageCodes.length > 0) {
	// 					// await badgeDaoV1.replaceAchievementValue('talking_tounge', uniqueLanguageCodes[0].length, _id)
	// 					for(let lang of uniqueLanguageCodes[0]){
	// 						toInsert.push(
	// 							{
	// 								userId: _id,
	// 								status: STATUS.UN_BLOCKED,
	// 								languageCode: lang,
	// 								created: Date.now()
	// 							}
	// 						)
	// 					}
	// 					return {
	// 						updateOne: {
	// 							filter: { _id },
	// 							// update: toUpdate
	// 						}
	// 					};
	// 				} else {
	// 					return null;
	// 				}
	// 			}).filter(operation => operation !== null)) // Remove null values from the array
	// 			if (bulkOperations.length > 0) {
	// 				await Promise.all([
	// 				// 	// baseDao.bulkWrite("users", bulkOperations),
	// 					baseDao.insertMany("chat_languages", toInsert, { ordered: false })
	// 				])
	// 			}
	// 			await new Promise(resolve => setTimeout(resolve, 2000));
	// 		}

	// 		return chunkArray;
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	// async getRedisExpiry(key:string){
	// 	return MESSAGES.SUCCESS.DETAILS(await redisClient.getTTL(key)) 
	// }

	
	async updateDetailsInChatModel(params: ChatRequest.UpdateRequest) {
		try {
			if (params.reqId) {
				await chatDaoV1.updateReqInChatModel(params);
				console.log("*********************Rqst-REFRESH_INBOX", params.reqId, "------", params.status);
				SocketIO.io.emit(SOCKET.LISTNER_TYPE.CHAT.REFRESH_INBOX, { jobId: params.reqId, status: params.status });
			}
			else if (params.jobId) {
				await chatDaoV1.updateJobStatus(params);
				console.log("*********************Job-REFRESH_INBOX", params.jobId, "------", params.status);
				SocketIO.io.emit(SOCKET.LISTNER_TYPE.CHAT.REFRESH_INBOX, { jobId: params.jobId, status: params.status });
			}
			else if (params.reportId) {
				await chatDaoV1.updateReportStatus(params)
			}

			return MESSAGES.SUCCESS.DEFAULT
		} catch (error) {
			throw error;
		}
	}

}

export const chatController = new ChatController();
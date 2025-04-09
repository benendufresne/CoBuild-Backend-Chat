"use strict";

import { BaseDao, baseDao } from "@modules/baseDao/BaseDao";
import { STATUS, MESSAGE_TYPE, CHAT_TYPE, CHAT_BOX_PAGINATION, LANGUAGE_CODE, REDIS_KEY_PREFIX, SUBSCRIPTION_CONFIG, DEFAULT_CONFIG, TOKEN_TYPE, NOTIFICATION_TYPE, USER_TYPE, CHAT_MODE, JOB_TYPE } from "@config/constant";
import { consolelog, escapeSpecialCharacter, toObjectId } from "@utils/appUtils";
import { SERVER } from "@config/environment";
// import { autoTranslateMessage, translateMessageByUser } from "@lib/googleUtil";
import { chatDaoV1 } from "..";
import { createToken, redisClient } from "@lib/index";
import { AnyLengthString } from "aws-sdk/clients/comprehendmedical";
import Axios from "axios";
import * as crypto from "crypto";

export class ChatDao extends BaseDao {

	/**
	 * @function isChatExists
	 * check one to one check existence b/w users on the basic of members ids
	 */
	async isChatExists(members: Array<string>) {
		try {
			const query: any = {
				members: { $all: members },
				type: CHAT_TYPE.ONE_TO_ONE,
			};
			return await this.findOne("chats", query);
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function findActiveGroup
	 * get active list of a group for a user if he is present in that group 
	 */
	async findActiveGroup(params: ChatRequest.VIEW_GROUP, userId: string) {
		try {
			const query: any = {
				_id: params.groupId,
				type: CHAT_TYPE.GROUP,
				deletedBy: { $nin: [userId] }
			};
			return await this.findOne("chats", query);
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function findChatById
	 * get chat details with a chat id
	 */
	async findChatById(_id: string) {
		try {
			const query: any = {
				_id: _id,
				status: STATUS.ACTIVE
			};
			return await this.findOne("chats", query);
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function archiveChatList
	 * get the list of all archive chat for a user
	 */
	async archiveChatList(params: ListingRequest, userId: string) {
		try {
			const aggPipe = [];
			const match: any = {};
			match.deletedBy = { $nin: [toObjectId(userId)] }
			match["$or"] = [{
				"members": toObjectId(userId)
			}, {
				"exitedBy": toObjectId(userId)
			}]
			match.acrhivedBy = { $in: [toObjectId(userId)] },
				match.lastMsgId = { $exists: true };//not allowed chat formatted room		
			match.type = { $in: [CHAT_TYPE.ONE_TO_ONE, CHAT_TYPE.GROUP, CHAT_TYPE.COMMUNITY] }
			if (Object.keys(match).length) aggPipe.push({ "$match": match });
			if (params.limit && params.pageNo) {
				const [skipStage, limitStage] = this.addSkipLimit(
					params.limit,
					params.pageNo,
				);
				aggPipe.push(skipStage, limitStage);
			}
			aggPipe.push({
				"$lookup": {
					from: "users",
					let: {
						userIds: '$members'
					},
					'pipeline': [{
						$match: {
							$expr: {
								$in: ['$_id', '$$userIds']
							}
						},
					},
					{
						$lookup: {
							from: "achievements_tiers",
							let: { badgeFrameId: "$badgeFrameId" },
							pipeline: [
								{
									$unwind: "$levels"
								},
								{
									$unwind: "$levels.badges"
								},
								{
									$match: { $expr: { $eq: ["$levels.badges._id", "$$badgeFrameId"] } }
								},
								{
									$project: {
										name: "$levels.badges.name",
										mediaUrl: "$levels.badges.mediaUrl",
										description: "$levels.badges.description",
										status: "$levels.badges.status",
										type: "$levels.badges.type",
										_id: "$levels.badges._id"
									}
								}
							],
							as: "badgeFrame"
						}
					},
					{
						$addFields: {
							badgeFrame: { $arrayElemAt: ["$badgeFrame", 0] }
						}
					},
					{ "$project": { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, name: 1, status: 1, flagCode: 1, about: 1, badgeFrame: 1, badgeFrameId: 1 } }
					],
					as: "users"
				}
			})
			aggPipe.push({
				"$lookup": {
					from: "users",
					let: {
						userIds: '$overallMembers'
					},
					'pipeline': [{
						$match: {
							$expr: {
								$in: ['$_id', '$$userIds']
							}
						},

					},
					{
						$lookup: {
							from: "achievements_tiers",
							let: { badgeFrameId: "$badgeFrameId" },
							pipeline: [
								{
									$unwind: "$levels"
								},
								{
									$unwind: "$levels.badges"
								},
								{
									$match: { $expr: { $eq: ["$levels.badges._id", "$$badgeFrameId"] } }
								},
								{
									$project: {
										name: "$levels.badges.name",
										mediaUrl: "$levels.badges.mediaUrl",
										description: "$levels.badges.description",
										status: "$levels.badges.status",
										type: "$levels.badges.type",
										_id: "$levels.badges._id"
									}
								}
							],
							as: "badgeFrame"
						}
					},
					{
						$addFields: {
							badgeFrame: { $arrayElemAt: ["$badgeFrame", 0] }
						}
					},
					{
						"$project": {
							profilePicture: 1,
							_id: 1,
							countryCode: 1,
							mobileNo: 1,
							language: 1,
							name: 1,
							status: 1,
							flagCode: 1,
							about: 1,
							badgeFrameId: 1,
							badgeFrame: 1
						}
					}
					],
					as: "overAllMembersDetails"
				}
			})
			aggPipe.push({
				"$lookup": {
					from: "messages",
					let: {
						chatId: "$_id", userId: toObjectId(userId)
					},
					'pipeline': [{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$$chatId", "$chatId"]
									},
									{
										$not: {
											$in: ["$$userId", "$deletedBy"]
										}
									}
								],
							}
						}
					},
					{
						$sort: {
							"created": -1
						}
					},
					{ $limit: 1 }
					],
					as: "last_message"
				}
			});
			aggPipe.push({
				"$lookup": {
					from: "messages",
					localField: 'last_message.messageId',
					foreignField: '_id',
					as: "messageIdDetails"
				}
			});
			aggPipe.push({
				$addFields: { "last_message.messageIdDetails": "$messageIdDetails" }
			});
			aggPipe.push({
				$addFields: { "unread_messages": 0 }
			})
			aggPipe.push({
				$addFields: {
					"lastMsgCreated": {
						"$cond": {
							"if": {
								"$ne": ["$last_message", []]
							},
							"then": "$last_message.created",
							"else": 0
						}
					}
				}
			});
			aggPipe.push({ "$unwind": "$lastMsgCreated" });
			const options = { collation: true };
			aggPipe.push({
				"$project": {
					_id: 1, type: 1, created: 1, exitedBy: 1, last_message: 1, users: 1, overAllMembersDetails: 1, unread_messages: 1, name: 1, lastMsgCreated: 1, lastMsgIdByUsers: 1, groupProfilePicture: 1, admins: 1, createdBy: 1, description: 1, mutedBy: 1
				}
			});
			let sort = {};
			(params.sortBy && params.sortOrder) ? sort = { [params.sortBy]: params.sortOrder } : sort = { lastMsgCreated: -1, created: -1 };
			aggPipe.push({ "$sort": sort });
			return await this.paginate("chats", aggPipe, params.limit, params.pageNo, options);
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function chatList
	 *  get the list of all inbox chat for a user
	 */
	async chatList(params: ListingRequest, tokenData: TokenData) {
		try {
			const aggPipe = [];
			const match: any = {};
			if (tokenData.userType == USER_TYPE.USER) {
				match.members = { $in: [toObjectId(tokenData.userId)] };
				match.status = { $in: [STATUS.ACTIVE, STATUS.REJECTED, STATUS.ACCEPTED,STATUS.COMPLETED, JOB_TYPE.CANCELED] };
			} else {
				match.status = { $in: [STATUS.ACTIVE, STATUS.REJECTED, STATUS.ACCEPTED,STATUS.COMPLETED, JOB_TYPE.CANCELED] };
				match.isChatDeletedByAdmin = false;
			}
			if (params.chatMode) {
				match.chatMode = params.chatMode;
			}
			if (params.searchKey) {
				params.searchKey = escapeSpecialCharacter(params.searchKey);
				if (tokenData.userType == USER_TYPE.USER) {
					match["$or"] = [
						{ "request.categoryName": { "$regex": params.searchKey, "$options": "i" } },
						// { "request.serviceType": { "$regex": params.searchKey, "$options": "i" } },
						// { "request.issueTypeName": { "$regex": params.searchKey, "$options": "i" } },
						// { "request.subIssueName": { "$regex": params.searchKey, "$options": "i" } },
						{ "report.type": { "$regex": params.searchKey, "$options": "i" } },
						{ "job.title": { "$regex": params.searchKey, "$options": "i" } },
					]
				} else {
					match["$or"] = [{ name: { "$regex": params.searchKey, "$options": "i" } }]
				}
			}
			if (Object.keys(match).length) aggPipe.push({ "$match": match });
			if (params.limit && params.pageNo) {
				const [skipStage, limitStage] = this.addSkipLimit(
					params.limit,
					params.pageNo,
				);
				aggPipe.push(skipStage, limitStage);
			}
			aggPipe.push({
				"$lookup": {
					from: "messages",
					let: {
						chatId: "$_id", userId: toObjectId(tokenData.userId)
					},
					'pipeline': [{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$$chatId", "$chatId"]
									},
									{
										$not: {
											$in: ["$$userId", "$deletedBy"]
										}
									}
								],
							}
						}
					},
					{
						$sort: {
							"created": -1
						}
					},
					{ $limit: 1 }
					],
					as: "lastMessage"
				}
			});
			aggPipe.push({
				"$lookup": {
					from: "messages",
					localField: 'lastMessage.messageId',
					foreignField: '_id',
					as: "messageIdDetails"
				}
			});
			aggPipe.push({
				$addFields: { "lastMessage.messageIdDetails": "$messageIdDetails" }
			});
			aggPipe.push({
				$addFields: {
					"lastMsgCreated": {
						"$cond": {
							"if": {
								"$ne": ["$lastMessage", []]
							},
							"then": "$lastMessage.created",
							"else": 0
						}
					}
				}
			});
			aggPipe.push({ "$unwind": "$lastMsgCreated" });
			aggPipe.push({
				$addFields: { "unreadMessages": 0 }
			});
			const options = { collation: true };
			aggPipe.push({
				"$project": {
					_id: 1, type: 1, created: 1, exitedBy: 1, lastMessage: 1, users: 1, overAllMembersDetails: 1, unreadMessages: 1, name: 1, lastMsgCreated: 1, lastMsgIdByUsers: 1, groupProfilePicture: 1, admins: 1, createdBy: 1, description: 1, mutedBy: 1, isScheduled: 1, startTime: 1, endTime: 1, inboxStatus: "$status", request: 1, report: 1, chatMode: 1, job: 1
				}
			});
			let sort = {};
			(params.sortBy && params.sortOrder) ? sort = { [params.sortBy]: params.sortOrder } : sort = { lastMsgCreated: -1 };
			aggPipe.push({ "$sort": sort });
			return await this.paginate("chats", aggPipe, params.limit, params.pageNo, options, true);
		} catch (error) {
			throw error;
		}
	}


	/**
	 * @function chatBox
	 * get current chatId details for chatList box
	 */
	async chatBox(params: ChatRequest.chatBox, userId: string) {
		try {
			const aggPipe = [];
			const match: any = {};
			match.status = { "$ne": STATUS.DELETED }
			match.lastMsgId = { $exists: true };
			match._id = toObjectId(params.chatId);
			match["$or"] = [{
				"members": toObjectId(userId)
			}, {
				"exitedBy": toObjectId(userId)
			}]

			match.type = { $in: [CHAT_TYPE.ONE_TO_ONE, CHAT_TYPE.GROUP, CHAT_TYPE.COMMUNITY] }
			match.deletedBy = { $nin: [toObjectId(userId)] }
			match.acrhivedBy = { $nin: [toObjectId(userId)] }
			if (Object.keys(match).length) aggPipe.push({ "$match": match });
			aggPipe.push({
				"$lookup": {
					from: "users",
					let: {
						userIds: '$members'
					},
					'pipeline': [{
						$match: {
							$expr: {
								$in: ['$_id', '$$userIds']
							}
						},
					},
					{
						$lookup: {
							from: "achievements_tiers",
							let: { badgeFrameId: "$badgeFrameId" },
							pipeline: [
								{
									$unwind: "$levels"
								},
								{
									$unwind: "$levels.badges"
								},
								{
									$match: { $expr: { $eq: ["$levels.badges._id", "$$badgeFrameId"] } }
								},
								{
									$project: {
										name: "$levels.badges.name",
										mediaUrl: "$levels.badges.mediaUrl",
										description: "$levels.badges.description",
										status: "$levels.badges.status",
										type: "$levels.badges.type",
										_id: "$levels.badges._id"
									}
								}
							],
							as: "badgeFrame"
						}
					},
					{
						$addFields: {
							badgeFrame: { $arrayElemAt: ["$badgeFrame", 0] }
						}
					},
					{ "$project": { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, name: 1, status: 1, flagCode: 1, about: 1, badgeFrameId: 1, badgeFrame: 1 } }
					],
					as: "users"
				}
			})
			aggPipe.push({
				"$lookup": {
					from: "users",
					let: {
						userIds: '$overallMembers'
					},
					'pipeline': [{
						$match: {
							$expr: {
								$in: ['$_id', '$$userIds']
							}
						},
					},
					{
						$lookup: {
							from: "achievements_tiers",
							let: { badgeFrameId: "$badgeFrameId" },
							pipeline: [
								{
									$unwind: "$levels"
								},
								{
									$unwind: "$levels.badges"
								},
								{
									$match: { $expr: { $eq: ["$levels.badges._id", "$$badgeFrameId"] } }
								},
								{
									$project: {
										name: "$levels.badges.name",
										mediaUrl: "$levels.badges.mediaUrl",
										description: "$levels.badges.description",
										status: "$levels.badges.status",
										type: "$levels.badges.type",
										_id: "$levels.badges._id"
									}
								}
							],
							as: "badgeFrame"
						}
					},
					{
						$addFields: {
							badgeFrame: { $arrayElemAt: ["$badgeFrame", 0] }
						}
					},
					{ "$project": { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, name: 1, status: 1, flagCode: 1, about: 1, badgeFrame: 1, badgeFrameId: 1 } }
					],
					as: "overAllMembersDetails"
				}
			})
			aggPipe.push({
				"$lookup": {
					from: "messages",
					let: {
						chatId: "$_id", userId: toObjectId(userId)
					},
					'pipeline': [{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$$chatId", "$chatId"]
									},
									{
										$not: {
											$in: ["$$userId", "$deletedBy"]
										}
									}
								],
							}
						}
					},
					{
						$sort: {
							"created": -1
						}
					},
					{ $limit: 1 }
					],
					as: "last_message"
				}
			});
			aggPipe.push({
				"$lookup": {
					from: "messages",
					localField: 'last_message.messageId',
					foreignField: '_id',
					as: "messageIdDetails"
				}
			});
			aggPipe.push({
				$addFields: { "last_message.messageIdDetails": "$messageIdDetails" }
			});
			aggPipe.push({
				$addFields: { "unread_messages": 0 }
			});
			const options = { collation: true };
			aggPipe.push({
				"$project": {
					_id: 1, type: 1, created: 1, exitedBy: 1, last_message: 1, users: 1, overAllMembersDetails: 1, unread_messages: 1, name: 1, lastMsgCreated: 1, lastMsgIdByUsers: 1, groupProfilePicture: 1, admins: 1, createdBy: 1, description: 1, mutedBy: 1
				}
			});
			return await this.paginate("chats", aggPipe, CHAT_BOX_PAGINATION.limit, CHAT_BOX_PAGINATION.pageNo, options);
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function archiveChatBox
	 * get current archive chatId details for archiveChatList box
	*/
	async archiveChatBox(params: ChatRequest.chatBox, userId: string) {
		try {
			const aggPipe = [];
			const match: any = {};
			match.status = { "$ne": STATUS.DELETED }
			match.lastMsgId = { $exists: true };
			match._id = toObjectId(params.chatId);
			match["$or"] = [{
				"members": toObjectId(userId)
			}, {
				"exitedBy": toObjectId(userId)
			}]
			match.type = { $in: [CHAT_TYPE.ONE_TO_ONE, CHAT_TYPE.GROUP, CHAT_TYPE.COMMUNITY] }
			match.deletedBy = { $nin: [toObjectId(userId)] }
			match.acrhivedBy = { $in: [toObjectId(userId)] }
			if (Object.keys(match).length) aggPipe.push({ "$match": match });
			aggPipe.push({
				"$lookup": {
					from: "users",
					let: {
						userIds: '$members'
					},
					'pipeline': [{
						$match: {
							$expr: {
								$in: ['$_id', '$$userIds']
							}
						},
					},
					{
						$lookup: {
							from: "achievements_tiers",
							let: { badgeFrameId: "$badgeFrameId" },
							pipeline: [
								{
									$unwind: "$levels"
								},
								{
									$unwind: "$levels.badges"
								},
								{
									$match: { $expr: { $eq: ["$levels.badges._id", "$$badgeFrameId"] } }
								},
								{
									$project: {
										name: "$levels.badges.name",
										mediaUrl: "$levels.badges.mediaUrl",
										description: "$levels.badges.description",
										status: "$levels.badges.status",
										type: "$levels.badges.type",
										_id: "$levels.badges._id"
									}
								}
							],
							as: "badgeFrame"
						}
					},
					{
						$addFields: {
							badgeFrame: { $arrayElemAt: ["$badgeFrame", 0] }
						}
					},
					{ "$project": { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, name: 1, status: 1, flagCode: 1, about: 1, badgeFrameId: 1, badgeFrame: 1 } }
					],
					as: "users"
				}
			})
			aggPipe.push({
				"$lookup": {
					from: "users",
					let: {
						userIds: '$overallMembers'
					},
					'pipeline': [{
						$match: {
							$expr: {
								$in: ['$_id', '$$userIds']
							}
						},
					},
					{
						$lookup: {
							from: "achievements_tiers",
							let: { badgeFrameId: "$badgeFrameId" },
							pipeline: [
								{
									$unwind: "$levels"
								},
								{
									$unwind: "$levels.badges"
								},
								{
									$match: { $expr: { $eq: ["$levels.badges._id", "$$badgeFrameId"] } }
								},
								{
									$project: {
										name: "$levels.badges.name",
										mediaUrl: "$levels.badges.mediaUrl",
										description: "$levels.badges.description",
										status: "$levels.badges.status",
										type: "$levels.badges.type",
										_id: "$levels.badges._id"
									}
								}
							],
							as: "badgeFrame"
						}
					},
					{
						$addFields: {
							badgeFrame: { $arrayElemAt: ["$badgeFrame", 0] }
						}
					},
					{ "$project": { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, name: 1, status: 1, flagCode: 1, about: 1, badgeFrame: 1, badgeFrameId: 1 } }
					],
					as: "overAllMembersDetails"
				}
			})
			aggPipe.push({
				"$lookup": {
					from: "messages",
					let: {
						chatId: "$_id", userId: toObjectId(userId)
					},
					'pipeline': [{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$$chatId", "$chatId"]
									},
									{
										$not: {
											$in: ["$$userId", "$deletedBy"]
										}
									}
								],
							}
						}
					},
					{
						$sort: {
							"created": -1
						}
					},
					{ $limit: 1 }
					],
					as: "last_message"
				}
			});
			aggPipe.push({
				"$lookup": {
					from: "messages",
					localField: 'last_message.messageId',
					foreignField: '_id',
					as: "messageIdDetails"
				}
			});
			aggPipe.push({
				$addFields: { "last_message.messageIdDetails": "$messageIdDetails" }
			});
			aggPipe.push({
				$addFields: { "unread_messages": 0 }
			});
			const options = { collation: true };
			aggPipe.push({
				"$project": {
					_id: 1, type: 1, created: 1, exitedBy: 1, last_message: 1, users: 1, overAllMembersDetails: 1, unread_messages: 1, name: 1, lastMsgCreated: 1, lastMsgIdByUsers: 1, groupProfilePicture: 1, admins: 1, createdBy: 1, description: 1, mutedBy: 1
				}
			});
			return await this.paginate("chats", aggPipe, CHAT_BOX_PAGINATION.limit, CHAT_BOX_PAGINATION.pageNo, options);
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function messageList
	 * get inbox message details with chatId for a user
	 */
	async messageList(params: ChatRequest.MessageList, tokenData: TokenData) {
		try {
			const aggPipe = [];
			const match: any = {};
			match.chatId = toObjectId(params.chatId);
			if (tokenData.userType == USER_TYPE.USER) {
				match.deletedBy = { $nin: [toObjectId(tokenData.userId)] };
				match.members = { $in: [toObjectId(tokenData.userId)] };
			}
			match.status = { $in: [STATUS.ACTIVE, STATUS.REJECTED, STATUS.ACCEPTED, STATUS.DELETED, STATUS.BIDAGAIN] };//deleted messages also seen at both end
			match.created = { $lt: params.lastMessageCreated };
			if (params.searchKey) {
				params.searchKey = escapeSpecialCharacter(params.searchKey);
				match.message = { "$regex": params.searchKey, "$options": "-i" };
			}
			if (Object.keys(match).length) aggPipe.push({ "$match": match });
			let sort = {};
			sort = { createdAt: -1 };
			aggPipe.push({ "$sort": sort });
			if (params.limit && params.pageNo) {
				const [skipStage, limitStage] = this.addSkipLimit(
					params.limit,
					params.pageNo,
				);
				aggPipe.push(skipStage, limitStage);
			}
			aggPipe.push({
				"$project": {
					_id: 1,
					type: 1,
					created: 1,
					members: 1,
					isRead: 1,
					isDelivered: 1,
					senderId: 1,
					message: 1,
					mediaUrl: 1,
					messageType: 1,
					reaction: 1,
					createdAt: 1,
					location: 1,
					userLang: 1,
					translatedMessages: 1,
					size: 1,
					thumbnailUrl: 1,
					transcribe: 1,
					status: 1,
					messageId: 1,
					taggedUser: 1,
					blockedMessage: 1,
					imageRatio: 1,
					localUrl: 1,
					chatId: 1,
					contact: 1,
					name: 1,
					profilePicture: 1,
					request: 1,
					notes: 1,
					estimatedDays: 1,
					amount: 1,
					report: 1,
					chatMode: 1,
					job: 1
				}
			});
			aggPipe.push({
				"$lookup": {
					from: "users",
					let: {
						userIds: '$members'
					},
					'pipeline': [{
						$match: {
							$expr: {
								$in: ['$_id', '$$userIds']
							}
						},
					},
					{ "$project": { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1, about: 1 } }
					],
					as: "membersDetails"
				}
			})
			aggPipe.push({
				"$lookup": {
					from: "messages",
					localField: 'messageId',
					foreignField: '_id',
					as: "messageIdDetails"
				}
			})
			const options = { collation: true };
			return await this.paginate("messages", aggPipe, params.limit, params.pageNo, options);
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function inboxBroadCastMessage
	 * get inbox broadcast message with chatId/broadcastId for a user 
	 */
	async inboxBroadCastMessage(params: ChatRequest.BroadCastMessage, userId: string) {
		try {
			const aggPipe = [];
			const match: any = {};
			match.broadCastId = toObjectId(params.broadCastId);
			match.deletedBy = { $nin: [toObjectId(userId)] }
			match.status = { $in: [STATUS.ACTIVE, STATUS.FORWARDED, STATUS.REPLIED, STATUS.DELETED] };//deleted messages also seen at both end
			match.created = { $lt: params.lastMessageCreated };
			if (params.searchKey) {
				params.searchKey = escapeSpecialCharacter(params.searchKey);
				match.message = { "$regex": params.searchKey, "$options": "-i" };
			}
			if (Object.keys(match).length) aggPipe.push({ "$match": match });
			let sort = {};
			sort = { createdAt: -1 };
			aggPipe.push({ "$sort": sort });
			if (params.limit && params.pageNo) {
				const [skipStage, limitStage] = this.addSkipLimit(
					params.limit,
					params.pageNo,
				);
				aggPipe.push(skipStage, limitStage);
			}
			aggPipe.push({
				"$project": {
					_id: 1,
					type: 1,
					created: 1,
					members: 1,
					isRead: 1,
					isDelivered: 1,
					senderId: 1,
					message: 1,
					mediaUrl: 1,
					messageType: 1,
					reaction: 1,
					createdAt: 1,
					location: 1,
					userLang: 1,
					translatedMessages: 1,
					size: 1,
					thumbnailUrl: 1,
					transcribe: 1,
					status: 1,
					blockedMessage: 1,
					imageRatio: 1,
					localUrl: 1,
					chatId: 1,
					broadCastId: 1
				}
			});
			aggPipe.push({
				"$lookup": {
					from: "users",
					let: {
						userIds: '$members'
					},
					'pipeline': [{
						$match: {
							$expr: {
								$in: ['$_id', '$$userIds']
							}
						},
					},
					{
						$lookup: {
							from: "achievements_tiers",
							let: { badgeFrameId: "$badgeFrameId" },
							pipeline: [
								{
									$unwind: "$levels"
								},
								{
									$unwind: "$levels.badges"
								},
								{
									$match: { $expr: { $eq: ["$levels.badges._id", "$$badgeFrameId"] } }
								},
								{
									$project: {
										name: "$levels.badges.name",
										mediaUrl: "$levels.badges.mediaUrl",
										description: "$levels.badges.description",
										status: "$levels.badges.status",
										type: "$levels.badges.type",
										_id: "$levels.badges._id"
									}
								}
							],
							as: "badgeFrame"
						}
					},
					{
						$addFields: {
							badgeFrame: { $arrayElemAt: ["$badgeFrame", 0] }
						}
					},
					{ "$project": { profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1, about: 1, badgeFrame: 1, badgeFrameId: 1 } }
					],
					as: "membersDetails"
				}
			})
			aggPipe.push({
				"$lookup": {
					from: "messages",
					localField: 'messageId',
					foreignField: '_id',
					as: "messageIdDetails"
				}
			})
			const options = { collation: true };
			return await this.paginate("broadcast_messages", aggPipe, params.limit, params.pageNo, options);
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function mediaList
	 * get media list for a chat
	 */
	async mediaList(params: ChatRequest.Id, userId: string, isSubscribed?: boolean) {
		try {
			const aggPipe = [];
			const match: any = {};
			if (params.groupId) {
				match.chatId = toObjectId(params.groupId)
			} else {
				match.members = { $all: [toObjectId(params.contactUserId), toObjectId(userId)] }
			}
			match.messageType = { $in: [params.type] }

			if (params.type == MESSAGE_TYPE.MEDIA) match.messageType = { $in: [MESSAGE_TYPE.IMAGE] }
			match.deletedBy = { $nin: [toObjectId(userId)] }
			match.status = { $in: [STATUS.ACTIVE, STATUS.FORWARDED, STATUS.REPLIED] }
			const oldDataQuery = { ...match };
			let mediaDayLimit = 0;
			if (!isSubscribed) {
				const subscriptionConfig = await this.findOne("subscription_configs", { name: SUBSCRIPTION_CONFIG.FREE })
				mediaDayLimit = subscriptionConfig ? subscriptionConfig?.mediaDayLimit : DEFAULT_CONFIG.mediaDayLimit
				match.createdAt = { "$gt": new Date(Date.now() - Number(mediaDayLimit) * 24 * 60 * 60 * 1000) }
			}
			if (Object.keys(match).length) aggPipe.push({ "$match": match });
			let sort = {};
			sort = { createdAt: -1 };
			aggPipe.push({ "$sort": sort });
			if (params.limit && params.pageNo) {
				const [skipStage, limitStage] = this.addSkipLimit(
					params.limit,
					params.pageNo,
				);
				aggPipe.push(skipStage, limitStage);
			}

			aggPipe.push({
				"$project": {
					_id: 1,
					type: 1,
					created: 1,
					members: 1,
					isRead: 1,
					isDelivered: 1,
					senderId: 1,
					message: 1,
					mediaUrl: 1,
					messageType: 1,
					reaction: 1,
					createdAt: 1,
					thumbnailUrl: 1,
					size: 1,
					transcribe: 1,
					location: 1,
					status: 1,
					blockedMessage: 1,
					chatId: 1,
					imageRatio: 1,
					localUrl: 1
				}
			});

			const options = { collation: true };
			const results = await this.paginate("messages", aggPipe, params.limit, params.pageNo, options, true);
			if (mediaDayLimit > 0) {
				oldDataQuery.createdAt = { "$lt": new Date(Date.now() - Number(mediaDayLimit) * 24 * 60 * 60 * 1000) }
			}
			let hasLimitedMedia = await this.count("messages", oldDataQuery)
			return {
				...results,
				hasLimitedMedia: mediaDayLimit > 0 ? hasLimitedMedia > 0 : false
			}
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function deleteChat
	 * delete a chat for a user from the chat-list with ChatId
	 */
	async deleteChat(params: ChatRequest.ChatId, tokenData: TokenData) {
		try {
			const update = {};
			update["$addToSet"] = { deletedBy: [tokenData.userId] };
			return await this.findOneAndUpdate("chats", { _id: params.chatId }, update);
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function deleteMessages
	 * clear all messages for a chat of a user with chatId but chat room will exits in chat list
	 */
	async deleteMessages(params: ChatRequest.ChatId, tokenData: TokenData) {
		try {
			const update = {};
			update["$addToSet"] = { deletedBy: [tokenData.userId] };
			return await this.updateMany("messages", { chatId: params.chatId }, update, {});
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function deleteMessagesById
	 * delete (for me / for everyone) a message from the chat room with messageId 
	 */
	async deleteMessagesById(params: ChatRequest.DeleteMessages, tokenData: TokenData) {
		try {
			const update: any = {};
			if (!params.isDeleteForEveryone) {
				update["$addToSet"] = { deletedBy: [tokenData.userId] };
			}
			const query: any = {}
			query._id = params.messageId
			if (params.isDeleteForEveryone) {
				update.status = STATUS.DELETED
			}
			return await this.findOneAndUpdate("messages", query, update, { new: true });
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function callLogList
	 * get call log list for a user
	 */
	async callLogList(params: ChatRequest.CallLogList, userId: string) {
		try {
			const aggPipe = [];
			const match: any = {
				"$match": {
					$or: [
						{
							"receiverId": toObjectId(userId)
						},
						{
							"callerId": toObjectId(userId)
						}
					]
				}
			};
			let sort = {};
			sort = { createdAt: -1 };
			aggPipe.push(match);
			aggPipe.push({ "$sort": sort });
			if (params.limit && params.pageNo) {
				const [skipStage, limitStage] = this.addSkipLimit(
					params.limit,
					params.pageNo,
				);
				aggPipe.push(skipStage, limitStage);
			}

			const userLookUpBase = {
				from: "users",
				'pipeline': [{
					$match: {
						$expr: {
							$eq: ["$_id", "$$userId"]
						}
					},
				},
				{
					$lookup: {
						from: "achievements_tiers",
						let: { badgeFrameId: "$badgeFrameId" },
						pipeline: [
							{
								$unwind: "$levels"
							},
							{
								$unwind: "$levels.badges"
							},
							{
								$match: { $expr: { $eq: ["$levels.badges._id", "$$badgeFrameId"] } }
							},
							{
								$project: {
									name: "$levels.badges.name",
									mediaUrl: "$levels.badges.mediaUrl",
									description: "$levels.badges.description",
									status: "$levels.badges.status",
									type: "$levels.badges.type",
									_id: "$levels.badges._id"
								}
							}
						],
						as: "badgeFrame"
					}
				},
				{
					$addFields: {
						badgeFrame: { $arrayElemAt: ["$badgeFrame", 0] }
					}
				},
				{
					"$project": {
						profilePicture: 1, _id: 1, countryCode: 1, mobileNo: 1, language: 1, status: 1, name: 1, flagCode: 1, about: 1, badgeFrame: 1, badgeFrameId: 1
					}
				}
				],
			}

			aggPipe.push({
				"$lookup": {
					...userLookUpBase,
					let: {
						userId: '$callerId'
					},
					as: "caller"
				}
			})

			aggPipe.push({
				"$lookup": {
					...userLookUpBase,
					let: {
						userId: '$receiverId'
					},
					as: "receiver"
				}
			})

			aggPipe.push({
				"$lookup": {
					from: "call_transcripts",
					let: {
						chatId: "$chatId",
						startTime: "$startTime",
						endTime: "$endTime"
					},
					pipeline: [
						{
							"$match": {
								$expr: {
									$and: [
										{ $eq: ["$chatId", "$$chatId"] },
										{ $gte: ["$createdAt", "$$startTime"] },
										{ $lte: ["$createdAt", "$$endTime"] }
									]
								}
							}
						},
						{
							"$project": {
								_id: 1
							}
						}
					],
					as: "transcripts"
				}
			});


			aggPipe.push({
				"$lookup": {
					from: "chats",
					let: {
						chatId: "$chatId",
					},
					pipeline: [
						{
							"$match": {
								$expr: {
									$and: [
										{ $eq: ["$_id", "$$chatId"] },
									]
								}
							}
						},
						{
							"$project": {
								_id: 1,
								name: 1,
								description: 1,
								groupProfilePicture: 1,
							}
						}
					],
					as: "chat"
				}
			});

			aggPipe.push({
				"$project": {
					_id: 1,
					chatId: 1,
					callerId: 1,
					receiverId: 1,
					callType: 1,
					mode: 1,
					status: 1,
					created: 1,
					localCreated: 1,
					meetingDetails: 1,
					startTime: 1,
					endTime: 1,
					transcriptAvailable: {
						$cond: { if: { $gt: [{ $size: "$transcripts" }, 0] }, then: true, else: false }
					},
					caller: { "$arrayElemAt": ["$caller", 0] },
					receiver: { "$arrayElemAt": ["$receiver", 0] },
					chat: { "$arrayElemAt": ["$chat", 0] },
				}
			});

			const options = { collation: true };
			return await this.paginate("call_logs", aggPipe, params.limit, params.pageNo, options);
		} catch (error) {
			throw error;
		}
	}


	/* * @function isMessageRequestCreated
	 * check is message request already sent or not
	 */
	async isMessageRequestCreated(params: ChatRequest.CreateMessageRequest, tokenData: TokenData) {
		try {
			const match: any = {
				status: [STATUS.PENDING, STATUS.ACCEPTED]
			};
			match["$or"] = [{
				senderId: tokenData.userId, receiverId: params.userId
			}, {
				receiverId: tokenData.userId, senderId: params.userId
			}]
			return await this.findOne("message_requests", match);
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @function createMessageRequest
	 * create message request for one to one chat
	 */
	async createMessageRequest(params: ChatRequest.CreateMessageRequest, tokenData: TokenData) {
		try {
			const data: any = {
				senderId: tokenData.userId,
				receiverId: params.userId,
				members: [tokenData.userId, params.userId],
				message: params.message
			}
			let translatedInfo: any = {}
			// if (SERVER.IS_TRANSLATION_ENABLE) {
			// 	translatedInfo = await translateMessageByUser("", params.message, params.userId, tokenData)
			// 	data.translatedMessages = translatedInfo.encryptedMessages;
			// 	data.langCodes = translatedInfo.langCodes;
			// 	data.userLang = translatedInfo.userLang;
			// }

			return await this.save("message_requests", data);
		} catch (error) {
			throw error;
		}
	}

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

	/**
	 * @function createMessageRequest
	 * create message request for one to one chat
	 */
	async createChatRoom(params: ChatRequest.CreateMessageRequest, tokenData: TokenData) {
		try {
			const data: any = {
				members: [tokenData.userId, params.userId],
				overallMembers: [tokenData.userId, params.userId],
				pendingBy: params.userId
			}
			if (SERVER.IS_TRANSLATION_ENABLE) {
				const chatUserInfo = await this.setUserLanguage([params.userId, tokenData.userId])
				data.userLang = chatUserInfo.userLang;
				data.langCodes = chatUserInfo.langCodes;
			}
			return await chatDaoV1.save("chats", data)
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
	 * @function messageRequestSent
	 * get message request sent list
	 */
	async messageRequestSent(params: ChatRequest.RequestList, userId: string) {
		try {
			const aggPipe = [];
			const match: any = {};
			match.status = { $eq: STATUS.PENDING }
			match.senderId = { $eq: toObjectId(userId) }
			aggPipe.push({ "$match": match });

			if (params.limit && params.pageNo) {
				const [skipStage, limitStage] = this.addSkipLimit(
					params.limit,
					params.pageNo,
				);
				aggPipe.push(skipStage, limitStage);
			}

			aggPipe.push({
				"$lookup": {
					from: "users",
					localField: 'receiverId',
					foreignField: '_id',
					as: "userDetails"
				}
			})
			aggPipe.push(
				{ "$unwind": { path: '$userDetails', preserveNullAndEmptyArrays: true } },
			)
			aggPipe.push({
				"$project": {
					senderId: 1,
					receiverId: 1,
					message: 1,
					translatedMessages: 1,
					userLang: 1,
					created: 1,
					"userDetails._id": 1,
					"userDetails.mobileNo": 1,
					"userDetails.countryCode": 1,
					"userDetails.name": 1,
					"userDetails.profilePicture": 1,
					"userDetails.flagCode": 1,
				}
			});
			return await this.dataPaginate("message_requests", aggPipe, params.limit, params.pageNo);
		} catch (error) {
			throw error;
		}
	}
	/**
	 * @function messageRequestReceived
	 * get message request sent list
	 */
	async messageRequestReceived(params: ChatRequest.RequestList, userId: string) {
		try {
			const aggPipe = [];
			const match: any = {};
			match.status = { $eq: STATUS.PENDING }
			match.receiverId = { $eq: toObjectId(userId) }
			aggPipe.push({ "$match": match });

			if (params.limit && params.pageNo) {
				const [skipStage, limitStage] = this.addSkipLimit(
					params.limit,
					params.pageNo,
				);
				aggPipe.push(skipStage, limitStage);
			}

			aggPipe.push({
				"$lookup": {
					from: "users",
					localField: 'senderId',
					foreignField: '_id',
					as: "userDetails"
				}
			})
			aggPipe.push(
				{ "$unwind": { path: '$userDetails', preserveNullAndEmptyArrays: true } },
			)

			aggPipe.push({
				"$project": {
					senderId: 1,
					receiverId: 1,
					message: 1,
					translatedMessages: 1,
					userLang: 1,
					created: 1,
					"userDetails._id": 1,
					"userDetails.mobileNo": 1,
					"userDetails.countryCode": 1,
					"userDetails.name": 1,
					"userDetails.profilePicture": 1,
					"userDetails.flagCode": 1,
				}
			});
			return await this.dataPaginate("message_requests", aggPipe, params.limit, params.pageNo);
		} catch (error) {
			throw error;
		}
	}


	/**
	 * Update message request in both chat and message model
	 * @param {Object} params - The object of request data
	 * @returns {Promise<void>}
	 */
	async updateReqInChatModel(params: any) {
		try {
			const dataToUpdate = { request: params }
			if (params['status'] == STATUS.DELETED) dataToUpdate['status'] = STATUS.DELETED
			delete dataToUpdate.request['status'];
			await this.updateMany("chats", { 'request.reqId': toObjectId(params.reqId) }, dataToUpdate, {})
			await this.updateMany("messages", { 'request.reqId': toObjectId(params.reqId) }, { request: params }, {})
		} catch (error) {
			throw error;
		}
	}

	/**
* @function updateJobsInChatModel
* update job object in chat model
*/
	async updateJobStatus(params) {
		try {
			const filter = { 'job.jobId': toObjectId(params.jobId) }
			const dataToUpdate = { 'job.status': params.status }
			if (params.status == JOB_TYPE.CANCELED || params.status == JOB_TYPE.COMPLETED || params.status == JOB_TYPE.DELETED) dataToUpdate['status'] = params.status
			await this.updateMany("chats", filter, dataToUpdate, {})
		} catch (error) {
			throw error;
		}
	}


	/**
* @function updateReportStatus
* update report object in chat model
*/
	async updateReportStatus(params) {
		try {
			const filter = { 'report.reportId': toObjectId(params.jobId) }
			const dataToUpdate = { 'report.status': params.status }
			await this.updateMany("chats", filter, dataToUpdate, {})
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Retrieves a job document from the database given a job id.
	 * @param {string} jobId - The id of the job to be retrieved.
	 * @returns {Promise<any>} - The job document if found, else null.
	 */
	async getJobDetailsById(jobId: string) {
		try {
			const filter = { _id: toObjectId(jobId), status: { $ne: STATUS.DELETED } }
			return await this.findOne("jobs", filter);
		} catch (error) {
			throw error;
		}
	}



	// async updateUserInChatModel(params: any) {
	// 	try {
	// 		return await this.updateMany("chats", { 'request.reqId': toObjectId(params.reqId) }, params, {})
	// 	} catch (error) {
	// 		throw error;
	// 	}
	// }

	/*@function assignBadge
	* @description this function assign the chat badge to user
	*/
	// async assignBadge(userId, languageCode){
	// 	try{
	// 		const params = {
	// 			userId: userId,
	// 			languageCode: languageCode,
	// 			created: Date.now()
	// 		}
	// 		await this.save("chat_languages", params);
	// 		let update:any = {
	// 		  $inc: { individualChatLanguageCount: 1 } 
	// 		}
	// 		const user = await this.findOne("users", {_id: toObjectId(userId)}, {individualChatLanguageCount: 1});
	// 		if (user?.individualChatLanguageCount == BADGE_LANGUAGE_COUNT.CHAT) {
	// 		  update.$push = {
	// 			badges: {
	// 			  $each: [
	// 			  {
	// 				badgeId: BADGE_TYPE.CHAT._id,
	// 				badgeIcon: BADGE_TYPE.CHAT.icon,
	// 				badgeName: BADGE_TYPE.CHAT.name,
	// 				badgeDetails: BADGE_TYPE.CHAT.description,
	// 				badgeAchievedDate: Date.now()
	// 			  }
	// 			  ]
	// 			}
	// 		  }
	// 		}
	// 		await this.updateOne("users", { _id: toObjectId(userId) }, update, {})
	// 	}
	// 	catch(error){
	// 		throw error;
	// 	}
	// }

	// async handleScheduledCallNotification(){
	// 	console.log(`--handle scheduled call notification--`);
	// 	const currentTime = new Date();
	// 	const currentMinutes = currentTime.getMinutes();
	// 	const chats = await this.find('chats', { 
	// 		startTime: {
	// 			 $gte: new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(), currentTime.getHours(), currentMinutes), 
	// 			$lt: new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(), currentTime.getHours(), currentMinutes + 1) 
	// 		},
	// 		isScheduled: true 
	// 	}, {})
	// 	chats?.forEach(async chat => {
	// 		const chatId = chat._id;
	// 		const lockKey = `lock:${chatId}`;
	// 		const expirationTime = 60; // Lock expires after 60 seconds
	// 		console.log(chatId)
	// 		redisClient.acquireLock(lockKey, expirationTime, async (err, acquired) => {
	// 			if (err) {
	// 				console.error('Error acquiring lock:', err);
	// 				return;
	// 			}
	// 			if (acquired) {
	// 				// Lock acquired, process the chat
	// 				console.log(`Processing scheduled call ${chatId}`);
	// 				if (chat) {
	// 					const salt = crypto.randomBytes(64).toString("hex");
	// 					const user = await baseDao.findOne("users", {"_id": toObjectId(chat?.createdBy)})
	// 					const loginHistory = await baseDao.findOne("login_histories", {
	// 						"userId._id": toObjectId(chat?.createdBy),
	// 						"isLogin": true 
	// 					})
	// 					const userToken = await createToken({
	// 						"userId": user?._id,
	// 						"deviceId": loginHistory?.deviceId || chatId,
	// 						"accessTokenKey": loginHistory?.salt || salt,
	// 						"type": TOKEN_TYPE.USER_LOGIN,
	// 						"userType": user?.userType || "USER"
	// 					})
	// 					const message = await baseDao.findOne("messages", {
	// 						_id: toObjectId(chat?.lastMsgId)
	// 					})
	// 					chat?.members?.forEach(async (member) => {
	// 						const sendNotificationData = {
	// 							type: NOTIFICATION_TYPE.SCHEDULED_CALL_NOTIFICATION,
	// 							receiverId: [member],
	// 							details: {
	// 								chatId: chatId,
	// 								name: chat?.name,
	// 								startTime: chat?.startTime,
	// 								endTime: chat?.endTime,
	// 								isScheduled: chat?.isScheduled,
	// 								senderId: message?.senderId,
	// 								type: NOTIFICATION_TYPE.SCHEDULED_CALL_NOTIFICATION,
	// 							}}
	// 						await this.sendNotification(sendNotificationData, userToken)
	// 					});
	// 				}
	// 				setTimeout(() => {
	// 					// Release the lock after processing
	// 					redisClient.releaseLock(lockKey, (err, released) => {
	// 						if (err) {
	// 							console.error('Error releasing lock:', err);
	// 							return;
	// 						}
	// 						if (released) {
	// 							console.log(`Lock released for chat ${chatId}`);
	// 						} else {
	// 							console.log(`Failed to release lock for chat ${chatId}`);
	// 						}
	// 					});
	// 				}, 5000); 
	// 			} else {
	// 				console.log(`Failed to acquire lock for chat ${chatId}`);
	// 			}
	// 		});
	// 	});
	// }

	// async sendNotification(params, accessToken) {
	// 	try{
	// 		const apiUrl = SERVER.NOTIFICATION_URL+'notification/send';
	// 		// Request payload
	// 		const requestData = {
	// 			...params
	// 		};
	// 		// Request headers
	// 		const headers = {
	// 			'accept': 'application/json',
	// 			'authorization': `bearer ${accessToken}`,
	// 			'platform': `1`,
	// 			'language': 'en',
	// 			'api_key': `${SERVER.API_KEY}`,
	// 			'Content-Type': 'application/json',
	// 		};
	// 		Axios.post(apiUrl, requestData, { headers })
	// 			.then()
	// 			.catch((error) => {
	// 				// Handle errors here
	// 				console.error('Error:', error.message);
	// 			});
	// 	}catch(error){
	// 		throw error;
	// 	}
	// }
}

export const chatDao = new ChatDao();
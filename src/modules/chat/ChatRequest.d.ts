declare namespace ChatRequest {

	export interface oneToOneChat {
		chatId: string;
	}

	export interface jobFormationChat {
		jobId: string;
	}

	export interface Id extends Pagination {
		contactUserId?: string;
		type?: string;
		groupId?: string;
		reason?: string;
	}

	export interface Text extends Pagination {
		searchKey: string;
	}
	export interface Add {
		contactUserId: string;
		accessData?: boolean
	}



	export interface Create {
		userId: string;
		accessData?: boolean
	}


	export interface Contact {
		name: string;
		mobileNo: string;
	}

	export interface ONE_TO_ONE_CHAT_MESSAGE {
		contactUserId?: string;
		senderId: string;
		chatId: string;
		message?: string;
		mediaUrl?: string;
		messageType: string;
		languageCode: string;
		localMessageId?: string;
		thumbnailUrl?: string;
		location?: {
			lat: Number,
			long: Number
		},
		size?: string;
		transcribe?: string;
		status?: string;
		imageRatio?: number
		localUrl?: string;
		contact?: Contact;
		notes?: string;
		estimatedDays?: string,
		amount?: number,
	}

	export interface FORWARD {
		contactUserId: string;
		senderId: string;
		message?: string;
		mediaUrl?: string;
		messageType: string;
		languageCode: string;
		localMessageId?: string;
		thumbnailUrl?: string;
		location?: {
			lat: Number,
			long: Number
		},
		size?: string;
		transcribe?: string;
		status?: string;
		imageRatio?: number;
		localUrl?: string;
		contact?: Contact
	}

	export interface INTERACTIONS {
		contactUserId: string;
		localMessageId?: string;
	}

	export interface SOKCET_ROOM {
		chatId: string;
		socketId?: string;
	}

	export interface CHAT_NOTIFICATION {
		type?: string;
		subtitle?: string,
		title: string;
		body: string;
		message: string;
		details: {
			chatId: string;
			senderId: string;
			receiverId: string;
			receiverIdName: string;
			messageType: string;
			profilePicture: string;
			countryCode: string;
			mobileNo: string;
			fullMobileNo?: string;
			type: string;
			senderName?: string;
			flagCode?: string;
			membersDetails?: object;
			isScheduled?: boolean;
			startTime?: Date;
			endTime?: Date;
		};
	}
	export interface GROUP_MESSAGE {
		senderId: string;
		chatId: string;
		message?: string;
		mediaUrl?: string;
		messageType: string;
		localMessageId?: string;
		thumbnailUrl?: string;
		location?: {
			lat: Number,
			long: Number
		},
		size?: string;
		status?: string;
		transcribe?: string;
		taggedUser?: Array<string>
		languageCode?: string;
		imageRatio?: number;
		localUrl?: string;
		contact?: Contact
	}

	export interface REPLIED {
		messageId: string;
		contactUserId?: string;
		senderId: string;
		chatId: string;
		message?: string;
		languageCode?: string;
		mediaUrl?: string;
		messageType: string;
		localMessageId?: string;
		thumbnailUrl?: string;
		location?: {
			lat: Number,
			long: Number
		},
		size?: string
		status?: string;
		transcribe?: string;
		taggedUser?: Array<string>
		imageRatio?: number;
		localUrl?: string;
		contact?: Contact
	}

	export interface CHAT_REACTION {
		messageId: string;
		reaction: string;
	}

	export interface QUOTATION_STATUS {
		messageId: string;
		status: string;
		localMessageId: string;
		chatId: string;
		senderId: string;
		messageType: string;
		message: string;
	}

	export interface MESSAGE {
		messageId: string;
	}

	export interface ARCHIVE {
		chatId: string;
		isArchive: boolean
	}

	export interface WALLPAPER {
		chatId?: string;
		url: string;
		overall: boolean
	}

	export interface CREATE_GROUP {
		contactUserIds: Array<string>;
		communityId?: string;
		name?: string;
		description?: string;
		groupProfilePicture?: string;
		isScheduled?: boolean;
		startTime?: Date;
		endTime?: Date;
	}

	export interface EDIT_GROUP {
		groupId: string;
		contactUserIds?: Array<string>;
		name?: string;
		description?: string;
		groupProfilePicture?: string;
		isScheduled?: boolean;
		startTime?: Date;
		endTime?: Date;
	}

	export interface VIEW_GROUP extends ListingRequest {
		groupId: string;
	}

	export interface JOIN_GROUP {
		groupId: string;
	}

	export interface CREATE_BROADCAST {
		contactUserIds: Array<string>;
	}

	export interface EDIT_BROADCAST {
		contactUserIds?: Array<string>;
		name?: string;
		broadCastId: string;
		isDelete: boolean
	}

	export interface VIEW_BROADCAST {
		broadCastId: string;
	}

	export interface SEND_BROADCAST extends ONE_TO_ONE_CHAT_MESSAGE {
		broadCastId: string;
		languageCode?: string;
	}

	export interface REPORT {
		contactUserId: string;
		reason: string;
	}

	export interface Delete extends Id {
		status: string;
	}

	export interface userId {
		userId: string;
	}

	export interface userProfile {
		offlineStatus: boolean;
	}
	export interface MessageList {
		chatId: string;
		pageNo: number;
		limit: number;
		searchKey?: string;
		lastMsgId?: string;
		lastMessageCreated?: number
	}

	export interface BroadCastMessage {
		broadCastId: string;
		pageNo: number;
		limit: number;
		searchKey?: string;
		lastMsgId?: string;
		lastMessageCreated?: number
	}

	export interface ChatId {
		chatId: string;
		isClearChat: boolean
	}

	export interface Blocked {
		contactUserId: string;
		blocked: boolean
	}

	export interface Tracking {
		chatId: string;
		isText: boolean
	}

	export interface DeleteMessages {
		messageId: string;
		isDeleteForEveryone?: boolean;
	}
	export interface TranslateMessages {
		message: string;
		sourceLanguageCode: string;
		targetLanguages: Array<string>;
	}
	export interface CallInitiate {
		userId?: string;
		chatId: string;
		mode: string;
	}
	export interface CallDecline {
		userId?: string;
		chatId: string;
	}
	export interface CallAccept {
		userId?: string;
		chatId: string;
	}
	export interface CallEnd {
		userId?: string;
		chatId: string;
		meetingId: string;
	}
	export interface removeAttendees {
		chatId: string;
		meetingId: string;
		attendeeId: string;
	}
	export interface VideoCallRequest extends CallDecline { }
	export interface VideoCallStatus {
		chatId: string;
		isAccept: boolean;
	}
	export interface UserCallStatus {
		chatId: string;
	}
	export interface muteChat {
		chatId: string;
		isMute: boolean
	}
	export interface markedReadAll {
		chatId: string;
	}
	export interface TranscriptionRequest {
		sourceLanguageCode: string;
		chatId: string;
		transcript: string;
	}
	export interface VoiceOverConfigRequest {
		chatId: string;
		active: boolean;
	}
	declare interface chatBox {
		chatId: string;
	}

	export interface CallLog {
		chatId: string;
		_id: string;
		callerId: string;
		receiverId: string;
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

	export interface StoreCallLogRequest {
		callLogs: [CallLog]
	}

	export interface CallLogList {
		pageNo: number;
		limit: number;
	}
	export interface CreateMessageRequest {
		userId: string;
		chatId?: string;
		message?: string
	}

	export interface RequestList {
		pageNo: number;
		limit: number;
	}
	export interface MessageRequestAccept {
		userId: string;
	}


	export interface CreateRequest {
		reqId: string;
		userId: string;
		requestIdString: string;
		userName?: string;
		userProfilePicture?: string;
		serviceType?: string;
		categoryName?: string;
		categoryId?: string;
		categoryIdString?: string;
		issueTypeName?: string;
		subIssueName?: string;
		accessData?: boolean;
		media?: string;
		mediaType?: string;
	}

	export interface CreateJob {
		jobId: string;
	}

	export interface UpdateRequest {
		reqId?: string;
		jobId?: string;
		reportId?: string;
		userId?: string;
		requestIdString?: string;
		userName?: string;
		userProfilePicture?: string;
		serviceType?: string;
		categoryName?: string;
		categoryId?: string;
		categoryIdString?: string;
		issueTypeName?: string;
		subIssueName?: string;
		accessData?: boolean;
		media?: string;
		mediaType?: string;
		status?: string;

	}

	export interface ReportDamage {
		reportId: string;
		userId: string;
		userName?: string;
		userProfilePicture?: string;
		type?: string;
		description?: string;
		location?: {
			coordinates: number[];
			address: string;
		};
		status?: string;
		media?: Array<{
			media: string;
			mediaType: string;
		}>;
	}


}
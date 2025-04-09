"use strict";

import {
  FIELD_REQUIRED as EN_FIELD_REQUIRED,
  SERVER_IS_IN_MAINTENANCE as EN_SERVER_IS_IN_MAINTENANCE,
  LINK_EXPIRED as EN_LINK_EXPIRED,
} from "../../locales/en.json";

const SWAGGER_DEFAULT_RESPONSE_MESSAGES = [
  { code: 200, message: "OK" },
  { code: 400, message: "Bad Request" },
  { code: 401, message: "Unauthorized" },
  { code: 404, message: "Data Not Found" },
  { code: 500, message: "Internal Server Error" },
];

const HTTP_STATUS_CODE = {
  OK: 200,
  CREATED: 201,
  UPDATED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENY_REQUIRED: 402,
  ACCESS_FORBIDDEN: 403,
  FAV_USER_NOT_FOUND: 403,
  URL_NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  UNREGISTERED: 410,
  PAYLOAD_TOO_LARGE: 413,
  CONCURRENT_LIMITED_EXCEEDED: 429,
  // TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SHUTDOWN: 503,
  EMAIL_NOT_VERIFIED: 430,
  MOBILE_NOT_VERIFIED: 431,
  FRIEND_REQUEST_ERR: 432,
};

const USER_TYPE = {
  ADMIN: "ADMIN",
  USER: "USER",
  SUB_ADMIN: "SUB_ADMIN"
};

const MAX_DAILY_POINTS = 25;

const DB_MODEL_REF = {
  ADMIN: "admins",
  LOGIN_HISTORY: "login_histories",
  USER: "users",
  CHATS: "chats",
  MESSAGES: "messages",
  BROADCAST_MESSAGES: "broadcast_messages",
  MESSAGES_REQUESTS: "message_requests",
  CHAT_REPORT: "chat_report",
  CHAT_LANGUAGES: "chat_languages",
  CALL_TRANSCRIPTS: "call_transcripts",
  CALL_LOGS: "call_logs",
  JOB: "jobs",
};
const CAL_TYPE = {
  GOOGLE: "GOOGLE",
  APPLE: "APPLE",
};

const CALL_MODE_TYPE = {
  AUDIO: "AUDIO",
  VIDEO: "VIDEO"
};

const CALL_TYPE = {
  PERSONAL: "PERSONAL",
  GROUP: "GROUP"
};

const CALL_STATUS = {
  MISSED: "MISSED",
  ONGOING: "ONGOING",
  END: "END",
};

const MODULES = {
  DASHBOARD: "Dashboard",
  USER_MANAGEMENT: "User Management",
  ROLE_MANAGEMENT: "Role Management",
  CASE_MANAGEMENT: "Case Management",
};

const MODULES_ID = {
  DASHBOARD: "1",
  USER_MANAGEMENT: "2",
  ROLE_MANAGEMENT: "3",
  CASE_MANAGEMENT: "4",
};

const DEVICE_TYPE = {
  ANDROID: "1",
  IOS: "2",
  WEB: "3",
  ALL: "4",
};

const SUB_TYPE = {
  ANDROID: "android",
  IOS: "ios",
};

const GENDER = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
};

const USER_PREFERENCE = {
  WELCOME_CALL: "WELCOME_CALL",
  IN_APP_MESSAGE: "IN_APP_MESSAGE",
  EMAIL_INTRO: "EMAIL_INTRO",
  TEXT_MESSAGE: "TEXT_MESSAGE",
};

const CATEGORIES_STAUS = {
  ADMIN: "ADMIN",
  USER: "USER",
};

const VISIBILITY = {
  ALL: "ALL",
  PRIVATE: "PRIVATE",
  SELECTED: "SELECTED",
};

const ENVIRONMENT = {
  PRODUCTION: "production",
  PREPROD: "preprod",
  QA: "qa",
  DEV: "dev",
  LOCAL: "local",
  STAGE: "staging",
};

const CHAT_TYPE = {
  ONE_TO_ONE: "ONE_TO_ONE",
  GROUP: "GROUP",
  COMMUNITY: "COMMUNITY",
  BROADCAST: "BROADCAST"
};

const REDIS_KEY_PREFIX = {
  SOCKET_ID: '_socketid',
  ADMIN_SOCKET_ID: '_adminsokcetid',
  MUTE_CHAT: '_mutechat',
  OFFLINE: '_offline',
  SUBSCRIBED: '_subscribed',
  ARCHIVE: '_archive',
  BLOCKED: "_blocked",
  MEETING: "_meeting"
}

const CHAT_MODE = {
  REQUEST: "REQUEST",
  REPORT: "REPORT",
  JOB: "JOB"
}

const STATUS = {
  BLOCKED: "BLOCKED",
  UN_BLOCKED: "UN_BLOCKED",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  ACTIVE: "ACTIVE",
  DELETED: "DELETED",
  UPCOMING: "UPCOMING",
  ONGOING: "ONGOING",
  ENDED: "ENDED",
  EXPIRED: "EXPIRED",
  INCOMPLETE: "INCOMPLETE",
  ACCEPTED: "ACCEPTED",
  DELETED_BY_ADMIN: "DELETED_BY_ADMIN",
  FORWARDED: "FORWARDED",
  REPLIED: "REPLIED",
  APPROVED: "APPROVED",
  ARCHIVED: "ARCHIVED",
  INACTIVE: "INACTIVE",
  REJECTED: "REJECTED",
  BIDAGAIN: "BIDAGAIN",
  CONFIRMED: {
    NUMBER: 1,
    TYPE: "CONFIRMED",
    DISPLAY_NAME: "Confirmed",
  },
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  PENDING: "PENDING",
  NOT_ATTENTED: {
    NUMBER: 5,
    TYPE: "NOT_ATTENTED",
    DISPLAY_NAME: "Not Attended",
  },
  OLD_COMPLETED: {
    NUMBER: 6,
    TYPE: "OLD_COMPLETE",
    DISPLAY_NAME: "Old complete",
  },
  // march 14 - natasha
  SEND: {
    NUMBER: 7,
    TYPE: "SEND",
    DISPLAY_NAME: "Send",
  },
  SCHEDULE: {
    NUMBER: 8,
    TYPE: "SCHEDULE",
    DISPLAY_NAME: "Schedule",
  },
  DRAFT: {
    NUMBER: 9,
    TYPE: "DRAFT",
    DISPLAY_NAME: "Draft",
  },
};

const NOTIFICATION_TYPE = {
  SHIFT_CREATE: "CREATE_SHIFT",
  GROUP_CREATE: "CREATE_GROUP",
  SHIFT_ACCEPT_BY_SUPPORTER: "SHIFT_ACCEPT_SUPPORTER",
  GROUP_ACCEPT_BY_SUPPORTER: "GROUP_ACCEPT_SUPPORTER",
  GROUP_ACCEPT_BY_ORG: "GROUP_ACCEPT_ORG",
  SHIFT_ACCEPT_BY_ORG: "SHIFT_ACCEPT_ORG",
  GROUP_ACTIVITY_STARTED: "GROUP_ACTIVITY_STARTED",
  SHIFT_ACTIVITY_STARTED: "SHIFT_ACTIVITY_STARTED",
  GROUP_ACTIVITY_FINISHED: "GROUP_ACTIVITY_FINISHED",
  SHIFT_ACTIVITY_FINISHED: "SHIFT_ACTIVITY_FINISHED",
  SUPPORTING_RATING: "SUPPORTING_RATING",
  SUPPORT_CHAT: "SUPPPORT_CHAT",
  SHIFT_ACTIVITY_FINISH_NOTIFICATION: "SHIFT_ACTIVITY_FINISH_NOTIFICATION",
  GROUP_ACTIVITY_FINISH_NOTIFICATION: "GROUP_ACTIVITY_FINISH_NOTIFICATION",

  GROUP_ACTIVITY_DECLINED_SINGLE: "GROUP_ACTIVITY_DECLINED_SINGLE",

  GROUP_ACTIVITY_DECLINED_MULTIPLE: "GROUP_ACTIVITY_DECLINED_MULTIPLE",
  GROUP_APPLY_FOR_WORK: "GROUP_APPLY_FOR_WORK",
  SHIFT_APPLY_FOR_WORK: "SHIFT_APPLY_FOR_WORK",
  FRIEND_REQUEST_SENT: "FRIEND_REQUEST_SENT",
  FRIEND_REQUEST_ACCEPT: "FRIEND_REQUEST_ACCEPT",
  FRIEND_REQUEST_DECLINED: "FRIEND_REQUEST_DECLINED",
  CANCELLED_SHIF: "CANCELLED_SHIF",
  MAKE_PUBLIC_SHIFT: "MAKE_PUBLIC_SHIFT",
  DECLINED_SHIFT: "DECLINED_SHIFT_REQUEST",
  PARTICIPANT_ONBOARD: "PARTICIPANT_ONBOARD",
  SUPPORTER_ONBOARD: "SUPPORTER_ONBOARD",
  INCIDENT_REPORT: "INCIDENT_REPORT",
  ADD_NOTES: "ADD_NOTE",
  NOTES_DECLINED: "NOTES_DECLINED",
  REPLACE_SUPPORTER: "REPLACE_SUPPORTER",
  BROADCAST_NOTIFICATION: "BROADCAST_NOTIFICATION",
  CHAT_NOTIFICATION: "CHAT_NOTIFICATION",
  CALL_NOTIFICATION: "CALL_NOTIFICATION",
  MESSAGE_REQUEST_NOTIFICATION: "MESSAGE_REQUEST_NOTIFICATION",
  EVENT: "1",
  DECLINE_NOTIFICATION: "DECLINE_NOTIFICATION",
  SCHEDULED_CALL_NOTIFICATION: "SCHEDULED_CALL_NOTIFICATION",
  ACHIEVEMENT_NOTIFICATION: "ACHIEVEMENT_NOTIFICATION",

};

const JOB_SCHEDULER_TYPE = {
  ACTIVITY_BOOKING: "activity_booking",
  START_GROUP_ACTIVITY: "start_group_activity",
  FINISH_GROUP_ACTIVITY: "finish_group_activity",
  EXPIRE_GROUP_ACTIVITY: "expire_group_activity",
  EXPIRE_SHIFT_ACTIVITY: "expire_shift_activity",
  EXPIRE_SHIFT_START_TIME: "expire_shift_activity_start_time",
  SHIFT_NOTIFICATION_INTERVAL: "shift_notification_interval",
  GROUP_NOTIFICATION_INTERVAL: "group_notification_interval",
  EXPIRE_GROUP_START_TIME: "expire_group_activity_start_time",
  AUTO_SESSION_EXPIRE: "auto_session_expire",
  TEMPORARY_ACCOUNT_BLOCKED: "temporary_account_blocked",
};

const VALIDATION_CRITERIA = {
  FIRST_NAME_MIN_LENGTH: 3,
  FIRST_NAME_MAX_LENGTH: 10,
  MIDDLE_NAME_MIN_LENGTH: 3,
  MIDDLE_NAME_MAX_LENGTH: 10,
  LAST_NAME_MIN_LENGTH: 3,
  LAST_NAME_MAX_LENGTH: 10,
  NAME_MIN_LENGTH: 3,
  COUNTRY_CODE_MIN_LENGTH: 1,
  COUNTRY_CODE_MAX_LENGTH: 4,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 16,
  LATITUDE_MIN_VALUE: -90,
  LATITUDE_MAX_VALUE: 90,
  LONGITUDE_MIN_VALUE: -180,
  LONGITUDE_MAX_VALUE: 180,
};
const SOCKET = {
  CHAT_FORMATION: {
    PARAMS_MISSING: "__params_missing",
    CHAT_FORMATION: "__chat_formation"
  },
  LISTNER: {
    DEFAULT: {
      CONNECTION: 'connection',
      RECONNECT: 'reconnect',
      DISCONECT: 'disconnect',
      DISCONNECTING: 'disconnecting'
    },
    SOCKET_SERVICE: "socket-service",
    ONE_TO_ONE: "__one_to_one",
    GROUP: "__group"
  },

  LISTNER_TYPE: {
    SOCKET_SERVICE: {
      ONE_TO_ONE_CHAT: "__one_to_one_chat_message",
      FORWARD: "__forward_message",
      LIVE_STREAMING: "live-streaming",
      GROUP: "__group_chat_message",
      CALL_INITIATE: "__call_initiate",
      CALL_DECLINE: "__call_decline",
      CALL_ACCEPT: "__call_accept",
      CALL_END: "__call_end",
      REMOVE_ATTENDEES: "__remove_attendees",
      VIDEO_CALL_REQUEST: "__video_call_request",
      VIDEO_CALL_STATUS: "__video_call_status",
      USER_CALL_STATUS: "__user_call_status",
      HOME_NOTIFICATION_COUNT: "__home_notification_count",
      CURRENT_CALL_STATUS: "__current_call_status",
      CREATE_MESSAGE_REQUEST: "__create_message_request",
      INBOX_REQUEST_SENT: "__inbox_request_sent",
      INBOX_REQUEST_RECEIVE: "__inbox_request_receive",
      MESSAGE_REQUEST_ACCEPT: "__message_request_accept",
      MESSAGE_REQUEST_REJECT: "__message_request_reject",
      DELETE_MESSAGE_REQUEST: "__delete_message_request",
      RECEIVED_REQUEST_COUNT: "___received_request_count",
      JOB_CHAT_FORMATION: "__job_chat_formation"
    },
    MESSAGE: {
      QUOTATION_STATUS: "__quotation_status",
      REACTION: "__chat_reaction",
      REPLIED: "__chat_replied",
      DELETE_MESSAGE: "__delete_message",
      REPORT: "__report_message",
      READ: "__chat_read_status",
    },
    USER: {
      USER_STATUS: "__user_status",
      LEFT_ROOM: "__chat_room_left",
      BLOCKED: "__user_blocked",
      REPORT: "__report_user",
      SUBSCRIPTION: "__subscription"
    },
    CHAT: {
      LISTING: "__inbox_chat",
      MESSAGE: "__inbox_message",
      DELETE: "__delete_chat",
      TRACKING: "__live_tracking",
      ARCHIVE: "__archive",
      WALLPAPER: "__wallpaper",
      ARCHIVE_LIST: "__inbox_archive",
      MUTE: "__chat_mute",
      READ_ALL: "__marked_read_all",
      REFRESH: {
        INBOX_CHAT: "__refresh_inbox_chat",
        ARCHIVE_CHAT: "__refresh_inbox_archive"
      },
      REJECT_REQUEST: "__reject_request",
      REFRESH_INBOX: "__refresh_inbox"
    },
    BROADCAST: {
      CREATE: "__create_broadcast",
      EDIT: "__edit_broadcast",
      DETAILS: "__view_broadcast",
      MESSAGES: "__send_broadcast",
      VIEW_MESSAGE: "__inbox_broadcast",
      JOIN: "__join_broadcast"
    },
    GROUP: {
      CREATE: "__create_group",
      EDIT: "__edit_group",
      DETAILS: "__view_group",
      MESSAGES: "__send_group_message",
      REPLIED: "__reply_group_message",
      EXIT: "__exit_group",
      DELETE: "__delete_group",
      REMOVE: "__remove_group_member",
      JOIN: "__join_group_chat",
      ADMIN: "__make_group_admin",
      REPORT: "__report_group",
      REMOVE_ADMIN: "__remove_from_admin",
      GROUP_INFO: "__group_details",

      COMMUNITY_INFO: "__community_details",
      CREATE_COMMUNITY: "__create_community",
      EDIT_COMMUNITY: "__edit_community",
      JOIN_COMMUNITY: "__join_community",
      COMMUNITY_MESSAGES: "__send_community_message",
      COMMUNITY_REPLIED: "__reply_community_message",
      COMMUNITY_EXIT: "__exit_community",
      COMMUNITY_JOIN: "__join_community_chat",
      COMMUNITY_REPORT: "__report_community",
      COMMUNITY_DELETE: "__delete_community",
      REMOVE_DELETE_COMMUNITY: "__remove_delete_community",
      REMOVE_COMMUNITY: "__remove_community_member",
    },
    NOTIFY: {
      REMOVED_FROM_GROUP: "__notify_removed_user",
      NOTIFICATION: "__chat_notification",
      DELIVERED: "__delivered",
      UNREAD_NOTIFY: "__unread_notify",
    },
    TRANSCRIPTION: {
      MESSAGE: "__transcription_message",
      ON_MESSAGE: "__transcription_on_message",
      VOICE_OVER_CONFIG: "__voice_over_config",
      ON_VOICE_OVER_CONFIG: "__on_voice_over_config",
    },
  },

  LISTNER_ACTION: {
    CHAT: {
      MESSAGE: "message",
      PIN: "pin",
      CHAT: "chat",
      MESSAGE_STATUS: "message-status",
      MESSAGE_STATUS_ACK: "message-status-ack",
      CHAT_STATUS: "chat-status",
      CHAT_STATUS_ACK: "chat-status-ack",
      PIN_ACK: "pin-ack"
    },
    LIVE_STREAMING: {
      JOIN_ROOM: "joinRoom",
      VIEW: "view",
      ADD_COMMENT: "addComment",
      LEAVE_ROOM: "leaveRoom",
      STOP_VIEW: "stopView"
    }
  },

  EMITTER: {
    DEFAULT: {
      CONNECTED: 'connected',
    },
    PING: "PING",
    CHAT: {
      MESSAGE: "message",
      MESSAGE_STATUS: "message-status",
      CHAT: "chat",
      PIN: "pin",
      CHAT_STATUS: "chat-status"
    },
    LIVE_STREAMING: {
      PINNED_COMMENT_INFO: "pinnedCommentInfo",
      ONLINE_USERS: "onlineUsers"
    },
    ERROR: {
      NETWORK_ERROR: 'network-error',
      SOCKET_ERROR: "socket-error",
      ACK_ERROR: "ack-error",
      INSUFFICIENT_INFO: "insufficient-info",
      AUTHORIZATION_ERROR: "authorization-error"
    }
  },
}

const VALIDATION_MESSAGE = {
  invalidId: {
    pattern: "Invalid Id.",
  },
  mobileNo: {
    pattern: "Please enter a valid 10-digit mobile number",
  },
  email: {
    pattern: "Please enter a valid email address",
  },
  password: {
    required: "Please enter password.",
    pattern: "Please enter a valid password.",
    // pattern: `Please enter a proper password with minimum ${VALIDATION_CRITERIA.PASSWORD_MIN_LENGTH} character, which can be alphanumeric with special character allowed.`,
    minlength: `Password must be between ${VALIDATION_CRITERIA.PASSWORD_MIN_LENGTH}-${VALIDATION_CRITERIA.PASSWORD_MAX_LENGTH} characters.`,
    // maxlength: `Please enter a proper password with minimum ${VALIDATION_CRITERIA.PASSWORD_MIN_LENGTH} character, which can be alphanumeric with special character allowed.`
    maxlength: `Password must be between ${VALIDATION_CRITERIA.PASSWORD_MIN_LENGTH}-${VALIDATION_CRITERIA.PASSWORD_MAX_LENGTH} characters.`,
  },
};

const MESSAGES = {
  ERROR: {
    UNAUTHORIZE_ADMIN: {
      "statusCode": HTTP_STATUS_CODE.BAD_REQUEST,
      "type": "UNAUTHORIZE_ADMIN"
    },
    BROADCAST_NOT_FOUND: {
      statusCode: HTTP_STATUS_CODE.URL_NOT_FOUND,
      type: "BROADCAST_NOT_FOUND"
    },
    UNAUTHORIZED_ACCESS: {
      statusCode: HTTP_STATUS_CODE.UNAUTHORIZED,
      type: "UNAUTHORIZED_ACCESS",
    },
    INTERNAL_SERVER_ERROR: {
      statusCode: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
      type: "INTERNAL_SERVER_ERROR",
    },
    BAD_TOKEN: {
      statusCode: HTTP_STATUS_CODE.UNAUTHORIZED,
      type: "BAD_TOKEN",
    },
    TOKEN_EXPIRED: {
      statusCode: HTTP_STATUS_CODE.UNAUTHORIZED,
      type: "TOKEN_EXPIRED",
    },
    PARAMS_MISSING: {
      "statusCode": HTTP_STATUS_CODE.BAD_REQUEST,
      "type": "PARAMS_MISSING"
    },
    INCORRECT_STATUS: {
      "statusCode": HTTP_STATUS_CODE.BAD_REQUEST,
      "type": "INCORRECT_STATUS"
    },
    GROUP_NOT_FOUND: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      type: "GROUP_NOT_FOUND"
    },
    CHAT_NOT_FOUND: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      type: "CHAT_NOT_FOUND"
    },
    MESSAGE_NOT_FOUND: {
      "statusCode": HTTP_STATUS_CODE.BAD_REQUEST,
      "type": "MESSAGE_NOT_FOUND"
    },
    TOKEN_GENERATE_ERROR: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      type: "TOKEN_GENERATE_ERROR",
    },
    BLOCKED: {
      statusCode: HTTP_STATUS_CODE.UNAUTHORIZED,
      type: "BLOCKED",
    },
    INCORRECT_PASSWORD: {
      statusCode: HTTP_STATUS_CODE.ACCESS_FORBIDDEN,
      type: "INCORRECT_PASSWORD",
    },
    ENTER_NEW_PASSWORD: {
      statusCode: HTTP_STATUS_CODE.ACCESS_FORBIDDEN,
      type: "ENTER_NEW_PASSWORD",
    },
    BLOCKED_MOBILE: {
      statusCode: HTTP_STATUS_CODE.UNAUTHORIZED,
      type: "BLOCKED_MOBILE",
    },
    SESSION_EXPIRED: {
      statusCode: HTTP_STATUS_CODE.UNAUTHORIZED,
      type: "SESSION_EXPIRED",
    },
    FAV_USER_NOT_FOUND: {
      statusCode: HTTP_STATUS_CODE.FAV_USER_NOT_FOUND,
      type: "FAV_NOT_FOUND",
    },
    JOB_NOT_FOUND: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      type: "JOB_NOT_FOUND",
    },
    ERROR: (value, code = HTTP_STATUS_CODE.BAD_REQUEST) => {
      return {
        statusCode: code,
        message: value,
        type: "ERROR",
      };
    },
    CHAT_MESSAGE_ERROR: (value, chatId, code = HTTP_STATUS_CODE.BAD_REQUEST) => {
      return {
        "statusCode": code,
        "message": value,
        "chatId": chatId,
        "type": "ERROR"
      };
    },
    FIELD_REQUIRED: (value, lang = "en") => {
      return {
        statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
        message: EN_FIELD_REQUIRED.replace(/{value}/g, value),
        type: "FIELD_REQUIRED",
      };
    },
    SOMETHING_WENT_WRONG: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      type: "SOMETHING_WENT_WRONG",
    },
    SERVER_IS_IN_MAINTENANCE: (lang = "en") => {
      return {
        statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
        message: EN_SERVER_IS_IN_MAINTENANCE,
        type: "SERVER_IS_IN_MAINTENANCE",
      };
    },
    LINK_EXPIRED: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      message: EN_LINK_EXPIRED,
      type: "LINK_EXPIRED",
    },
    EMAIL_NOT_REGISTERED: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      type: "EMAIL_NOT_REGISTERED",
    },
    MOBILE_NOT_REGISTERED: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      type: "MOBILE_NOT_REGISTERED",
    },
    EMAIL_ALREADY_EXIST: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      type: "EMAIL_ALREADY_EXIST",
    },
    EMAIL_NOT_VERIFIED: (code = HTTP_STATUS_CODE.BAD_REQUEST) => {
      return {
        statusCode: code,
        type: "EMAIL_NOT_VERIFIED",
      };
    },
    INVALID_OLD_PASSWORD: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      type: "INVALID_OLD_PASSWORD",
    },
    INVALID_REFRESH_TOKEN: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      type: "INVALID_REFRESH_TOKEN",
    },
    NEW_CONFIRM_PASSWORD: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      type: "NEW_CONFIRM_PASSWORD",
    },
    OTP_EXPIRED: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      type: "OTP_EXPIRED",
    },
    INVALID_OTP: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      type: "INVALID_OTP",
    },
    USER_NOT_FOUND: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      type: "USER_NOT_FOUND",
    },
    PROFILE_NOT_COMPLETED: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      type: "PROFILE_NOT_COMPLETED",
    },
    USER_DOES_NOT_EXIST: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      type: "USER_DOES_NOT_EXIST",
    },
    MOBILE_NO_NOT_VERIFIED: {
      statusCode: HTTP_STATUS_CODE.MOBILE_NOT_VERIFIED,
      type: "MOBILE_NO_NOT_VERIFIED",
    },
    MOBILE_NO_ALREADY_EXIST: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      type: "MOBILE_NO_ALREADY_EXIST",
    },
    NOTIFICATION_NOT_EXIT: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      type: "NOTIFICATION_NOT_EXIT",
    },
    LIMIT_EXCEEDS: {
      statusCode: HTTP_STATUS_CODE.ACCESS_FORBIDDEN,
      type: "LIMIT_EXCEEDS",
    },
    INVALID_ADMIN: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      type: "INVALID_ADMIN",
    },
    NOT_EXIST_HOLIDAY: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      type: "NOT_EXIST_HOLIDAY",
    },
    REINVITE_NOT_VALID: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      type: "REINVITE_NOT_VALID",
    },
    RESET_PASSWORD_INVALID: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      type: "RESET_PASSWORD_INVALID",
    },
    SELF_BLOCK: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      type: "SELF_BLOCK",
    },
    PASSWORD_NOT_MATCHED: {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      type: "PASSWORD_NOT_MATCHED",
    }
  },
  SUCCESS: {
    DEFAULT: {
      statusCode: HTTP_STATUS_CODE.OK,
      type: "DEFAULT",
    },
    CHAT_FORMATION: (data) => {
      return {
        "statusCode": HTTP_STATUS_CODE.OK,
        "type": "CHAT_FORMATION",
        ...data
      }

    },
    DELETE_CHAT: {
      "statusCode": HTTP_STATUS_CODE.OK,
      "type": "DELETE_CHAT"
    },
    DELETE_MESSAGE: {
      "statusCode": HTTP_STATUS_CODE.OK,
      "type": "DELETE_MESSAGE"
    },
    DELETE_MEETING: {
      "statusCode": HTTP_STATUS_CODE.OK,
      "type": "DELETE_MEETING"
    },
    BROADCAST_DELETED: {
      "statusCode": HTTP_STATUS_CODE.OK,
      "type": "BROADCAST_DELETED"
    },
    DETAILS: (data) => {
      return {
        statusCode: HTTP_STATUS_CODE.OK,
        type: "DEFAULT",
        data: data,
      };
    },
    LIST: (data) => {
      return {
        statusCode: HTTP_STATUS_CODE.OK,
        type: "DEFAULT",
        ...data,
      };
    },
    LIST_DATA: (data) => {
      return {
        statusCode: HTTP_STATUS_CODE.OK,
        type: "DEFAULT",
        data: data,
      };
    },
    SEND_OTP: {
      statusCode: HTTP_STATUS_CODE.OK,
      type: "SEND_OTP",
    },
    MAIL_SENT: {
      statusCode: HTTP_STATUS_CODE.OK,
      type: "MAIL_SENT",
    },
    VERIFY_OTP: (data) => {
      return {
        statusCode: HTTP_STATUS_CODE.OK,
        type: "VERIFY_OTP",
        data: data,
      };
    },
    RESET_PASSWORD: {
      statusCode: HTTP_STATUS_CODE.OK,
      type: "RESET_PASSWORD",
    },
    MAKE_PUBLIC_SHIFT: {
      statusCode: HTTP_STATUS_CODE.OK,
      type: "MAKE_PUBLIC_SHIFT",
    },
    CHANGE_PASSWORD: {
      statusCode: HTTP_STATUS_CODE.OK,
      type: "CHANGE_PASSWORD",
    },
    EDIT_PROFILE: (data) => {
      return {
        statusCode: HTTP_STATUS_CODE.OK,
        type: "EDIT_PROFILE",
        data: data,
      };
    },
    EDIT_PROFILE_PICTURE: {
      statusCode: HTTP_STATUS_CODE.OK,
      type: "EDIT_PROFILE_PICTURE",
    },
    PROFILE_SETTINGS: {
      statusCode: HTTP_STATUS_CODE.OK,
      type: "PROFILE_SETTINGS",
    },
    LOGOUT: {
      statusCode: HTTP_STATUS_CODE.OK,
      type: "LOGOUT",
    },
    DELETE_ACCOUNT: {
      statusCode: HTTP_STATUS_CODE.OK,
      type: "DELETE_ACCOUNT",
    },
    SIGNUP: (data) => {
      return {
        statusCode: HTTP_STATUS_CODE.OK,
        type: "SIGNUP",
        data: data,
      };
    },
    SIGNUP_VERIFICATION: (data) => {
      return {
        statusCode: HTTP_STATUS_CODE.OK,
        type: "SIGNUP_VERIFICATION",
        data: data,
      };
    },
    LOGIN: (data) => {
      return {
        statusCode: HTTP_STATUS_CODE.OK,
        type: "LOGIN",
        data: data,
      };
    },
    USER_LOGOUT: {
      statusCode: HTTP_STATUS_CODE.OK,
      type: "USER_LOGOUT",
    },
    BLOCK_USER: {
      statusCode: HTTP_STATUS_CODE.OK,
      type: "BLOCK_USER",
    },
    UNBLOCK_USER: {
      statusCode: HTTP_STATUS_CODE.OK,
      type: "UNBLOCK_USER",
    },
    EMAIL_UPLOAD: {
      statusCode: HTTP_STATUS_CODE.OK,
      type: "EMAIL_UPLOAD",
    },
    FORGOT_PASSWORD: {
      statusCode: HTTP_STATUS_CODE.OK,
      message: "Reset Password OTP has been sent.",
      type: "FORGOT_PASSWORD",
    },
    DELETE_CATEGORY: {
      statusCode: HTTP_STATUS_CODE.UPDATED,
      message: "Category has been deleted successfully.",
      type: "DELETE_CATEGORY",
    },
    UPDATE_USER: {
      statusCode: HTTP_STATUS_CODE.UPDATED,
      message: "User has been updated",
      type: "UPDATE_USER",
    },
    DELETE_USER: {
      statusCode: HTTP_STATUS_CODE.OK,
      message: "User has been deleted successfully.",
      type: "DELETE_USER",
    },

    TASK_REWARD: {
      statusCode: HTTP_STATUS_CODE.UPDATED,
      message: "Task reward points updated.",
      type: "TASK_REWARD",
    },
    GOAL_REWARD: {
      statusCode: HTTP_STATUS_CODE.UPDATED,
      message: "Goal reward points updated.",
      type: "GOAL_REWARD",
    },
    BUDGET_REWARD: {
      statusCode: HTTP_STATUS_CODE.OK,
      message: "Budget reward points updated.",
      type: "BUDGET_REWARD",
    },

    LISTING: (data) => {
      return {
        statusCode: HTTP_STATUS_CODE.OK,
        type: "DEFAULT",
        data: data,
      };
    },
    RESEND_REINVITE: {
      statusCode: HTTP_STATUS_CODE.UPDATED,
      type: "RESEND_REINVITE",
    },
  },
  SOCKET_ERROR: {
    E400: {
      MAX_MEMBER: {
        statusCode: 400,
        message: 'Max member in group call.',
        type: 'MAX_MEMBER'
      },
      FAILURE_ACKNOWLEDGEMENT: (data, listner?) => {
        let errMsg = "Some error occured, please contact admin";
        if (data) {
          if (typeof data === 'object' && data.hasOwnProperty('statusCode') && (data.hasOwnProperty('message') || data.hasOwnProperty('customMessage'))) {
            errMsg = data.message || data.customMessage
          }
        }
        return {
          statusCode: 400,
          message: errMsg,
          type: "FAILURE_ACKNOWLEDGEMENT",
          listner: listner,
          data: data,
        }
      },

      INFO_MISSING: (customMessage?: string) => {
        let errorMessage = customMessage ? customMessage : "Some required information is missing"
        return {
          statusCode: 400,
          message: errorMessage,
          type: "INFO_MISSING",
          data: {}
        }
      },

      NETWORK_ERROR: (data) => {
        let errMsg = "Some error occured, please contact admin";
        if (data) {
          if (typeof data === 'object' && (data.hasOwnProperty('message') || data.hasOwnProperty('err') || data.hasOwnProperty('errMsg') || data.hasOwnProperty('errmsg') || data.hasOwnProperty('value'))) {
            errMsg = data.message || data.err || data.errMsg || data.errmsg || data.value
          } else if (typeof data === 'string') {
            errMsg = data
          }
        }
        return {
          statusCode: 400,
          message: 'Socket Netwrok error',
          type: "NETWORK_ERROR",
          data: errMsg,
        }
      },
      SOCKET_ERROR: {
        statusCode: 400,
        message: 'Socket Implementation error',
        type: "SOCKET_ERROR",
        data: {},
      },
      CHAT_THREAD_BLOCK: {
        statusCode: 400,
        message: 'Chat thread block',
        type: "CHAT_THREAD_BLOCK",
      }
    },
    E401: {
      AUTHORIZATION_ERROR: {
        statusCode: 401,
        message: 'Error in authorization',
        type: "AUTHORIZATION_ERROR",
        data: {},
      },
    }
  },
  SOCKET_SUCCESS: {
    S200: {
      SUCCESS: (data) => {
        return {
          statusCode: 200,
          message: 'Action successfull',
          type: "SUCCESS",
          data: data,
        }
      },
      CHAT_SUCCESS: (data, type) => {
        return {
          statusCode: 200,
          message: 'Action successfull',
          type: "SUCCESS",
          chatType: type,
          data: data,
        }
      },
      LIVE_STREAMING_SUCCESS: (data, type, status) => {
        return {
          statusCode: 200,
          status: status,
          message: 'Action successfull',
          type: type,
          data: data,
        }
      },
      SUCCESS_ACKNOWLEDGEMENT: (data) => {
        return {
          statusCode: 200,
          message: 'Successfully acknowledged on server',
          type: "SUCCESS_ACKNOWLEDGEMENT",
          data: data,
        }
      },
      CUSTOM_SUCCESS_ACKNOWLEDGEMENT: (data, listner?) => {
        let successMsg = "Successfully acknowledged on server";
        if (data) {
          if (typeof data === 'object' && data.hasOwnProperty('statusCode') && (data.hasOwnProperty('message') || data.hasOwnProperty('customMessage'))) {
            successMsg = data.message || data.customMessage
          }
        }
        return {
          statusCode: 200,
          message: successMsg,
          type: "CUSTOM_SUCCESS_ACKNOWLEDGEMENT",
          listner: listner,
          data: data,
        }
      },
      CONNECTION_ESTABLISHED: {
        statusCode: 200,
        message: 'Connection Established',
        type: "CONNECTION_ESTABLISHED",
        data: {},
      },
      JOIN_REQUEST_ACCEPTED: {
        statusCode: 200,
        message: 'Request accepted successfully',
        type: "JOIN_REQUEST_ACCEPTED",
        data: {},
      },
      JOIN_REQUEST_DECLINED: {
        statusCode: 200,
        message: 'Request declined successfully',
        type: "JOIN_REQUEST_DECLINED",
        data: {},
      },
    }
  }
};

const THEME = {
  DARK: "DARK",
  LIGHT: "LIGHT",
};

const MIME_TYPE = {
  XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  CSV1: "application/vnd.ms-excel",
  CSV2: "text/csv",
  CSV3: "data:text/csv;charset=utf-8,%EF%BB%BF",
  XLS: "application/vnd.ms-excel",
};

const REGEX = {
  EMAIL: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*\.\w{2,}$/i, // NOSONAR
  URL: /^(https?|http|ftp|torrent|image|irc):\/\/(-\.)?([^\s\/?\.#-]+\.?)+(\/[^\s]*)?$/i, // NOSONAR
  SSN: /^(?!219-09-9999|078-05-1120)(?!666|000|9\d{2})\d{3}-(?!00)\d{2}-(?!0{4})\d{4}$/, // NOSONAR // US SSN
  ZIP_CODE: /^[0-9]{5}(?:-[0-9]{4})?$/, // NOSONAR
  PASSWORD:
    /(?=[^A-Z]*[A-Z])(?=[^a-z]*[a-z])(?=.*[@*%&])(?=[^0-9]*[0-9]).{8,16}/, // NOSONAR // Minimum 6 characters, At least 1 lowercase alphabetical character, At least 1 uppercase alphabetical character, At least 1 numeric character, At least one special character
  COUNTRY_CODE: /^\d{1,4}$/,
  MOBILE_NUMBER: /^\d{6,16}$/,
  STRING_REPLACE: /[-+ ()*_$#@!{}|\/^%`~=?,.<>:;'"]/g, // NOSONAR
  SEARCH: /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, // NOSONAR
  MONGO_ID: /^[a-f\d]{24}$/i,
};

const LANGUAGES = [
  {
    code: "en",
    id: 38,
    isSelected: false,
    name: "English",
  },
];

const TOKEN_TYPE = {
  USER_LOGIN: "USER_LOGIN", // login/signup
  ADMIN_LOGIN: "ADMIN_LOGIN",
  ADMIN_OTP_VERIFY: "ADMIN_OTP_VERIFY",
  FORGOT_PASSWORD: "FORGOT_PASSWORD",
};

const timeZones = ["Asia/Kolkata"];

const UPDATE_TYPE = {
  BLOCK_UNBLOCK: "BLOCK_UNBLOCK",
  APPROVED_DECLINED: "APPROVED_DECLINED",
  ABOUT_ME: "ABOUT_ME",
  EDIT_PROFILE: "EDIT_PROFILE",
  SET_PROFILE_PIC: "SET_PROFILE_PIC",
};

const fileUploadExts = [
  ".mp4",
  ".flv",
  ".mov",
  ".avi",
  ".wmv",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".svg",
  ".mp3",
  ".aac",
  ".aiff",
  ".m4a",
  ".ogg",
];

const ROLE_TITLES = {
  SUB_ADMIN: "Sub Admin",
};

const PERMISSION = {
  VIEW: "view",
  EDIT: "edit",
  ADD: "add",
  DELTETE: "delete",
};
const GEN_STATUS = {
  BLOCKED: "BLOCKED",
  UN_BLOCKED: "UN_BLOCKED",
  DELETED: "DELETED",
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
};

const REDIS_PREFIX = {
  OTP_ATTEMP: "_attemp",
  RESET_ATTEMP: "_reset",
  INVITE: "_invite",
};

const MAIL_TYPE = {
  VERIFY_EMAIL: "VERIFY_EMAIL",
};

const OTP_TYPE = {
  SIGNUP: "SIGNUP",
  FORGOT_PASSWORD: "FORGOT_PASSWORD",
}

const GOAL_CATEGORY = {
  HEALTH: "Health",
  CAREER: "Career",
  FINANCE: "Finance",
  SKILLS: "Skills",
  REALATIONSHIP: "Relationship",
  EDUCATIONAL: "Educational",
  OTHERS: "Others",
};

const GENERATOR = {
  STRING: "abcdefghijklmnopqrstuvwxyz",
  NUMBER: "0123456789",
  PUNCTUATION: "@%&*",
};

const TIME_TYPE = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

const MESSAGE_TYPE = {
  TEXT: "TEXT",
  IMAGE: "IMAGE",
  QUOTATION: "QUOTATION",
  REPLIED: "REPLIED",
  // AUDIO: "AUDIO",
  // DOCS: "DOCS",
  // VIDEO: "VIDEO",
  // VOICE: "VOICE",
  // LINK: "LINK",
  MEDIA: "MEDIA",
  // LOCATION: "LOCATION",
  HEADING: "HEADING",
  // STICKER: "STICKER",
  // CONTACT: "CONTACT",
};
const CHAT_REPORT_TYPE = {
  USER: "USER",
  MESSAGE: "MESSAGE",
  GROUP: "GROUP"
};

const PAGINATION_DEFAULT = {
  "pageNo": 0,
  "limit": 1000
}
const CHAT_BOX_PAGINATION = {
  "pageNo": 0,
  "limit": 1
}
const LANGUAGE_CODE = {
  Zh_TW: "Zh-TW",
  MNI_MTEI: "mni-Mtei",
  EN: "en"
};

const SUBSCRIPTION_CONFIG = {
  PREMIUM: "PREMIUM",
  FREE: "FREE",
  DEFAULT: "DEFAULT",
}

const DEFAULT_CONFIG = {
  mediaDayLimit: 7,
  scheduledCallLimitInSeconds: 1800,
  callLimitInSeconds: 600,
  callLimitAlertInSeconds: 60
}

const BROADCAST_MODE = {
  ADDED: "added",
  REMOVED: "removed"
};

const CHAT_HEADERS = {
  BROADCAST: {
    CREATE: (members: number) => {
      return `You Created a broadcast list with ${members} Recipients`
    },
    ADD: (userId: string) => {
      return `@${userId} added to this list`
    },
    REMOVE: (userId: string) => {
      return `@${userId} removed from this list`
    }
  },
  GROUP: {
    CREATE: (userId: string, name: string) => {
      return `@${userId} Created the group "${name}"`
    },
    UPDATE: {
      NAME: (userId: string, name: string) => {
        return `@${userId} changed the group name to "${name}"`
      },
      DESCRIPTION: (userId: string) => {
        return `@${userId} changed the group description`
      },
      ICON: (userId: string) => {
        return `@${userId} changed the group's icon`
      },
      REMOVE_ICON: (userId: string) => {
        return `@${userId} deleted this group's icon`
      },
      ADMIN: (userId: string) => {
        return `@${userId} are now an admin`
      },
      REVOKE_ADMIN: (userId: string) => {
        return `@${userId} are no longer an admin`
      },
      UPDATE_SCHEDULED_TIME: (userId: string) => {
        return `@${userId} update call schedule`
      },
    },
    LEFT: (userId: string) => {
      return `@${userId} left`
    },
    JOIN: (userId: string) => {
      return `@${userId} joined`
    },
    ADD: (userId: string, contactUserIds: string) => {
      return `@${userId} added${contactUserIds}`
    },
    REMOVE: (userId: string, contactUserId: string) => {
      return `@${userId} removed @${contactUserId}`
    },
    ADD_NOTIFY: (userId: string) => {
      return `addded you`
    },
    JOIN_NOTIFY: (userId: string) => {
      return `joined the community`
    },
    ADD_NOTIFY_SCHEDULED: (date: number) => {
      return `scheduled a call on `
    },
    UPDATE_NOTIFY_SCHEDULED: (date: number) => {
      return `updated scheduled call to `
    }
  }
}

const CHAT_MODE_TYPE = {
  NAME: "NAME",
  DESCRIPTION: "DESCRIPTION",
  ICON: "ICON",
  REMOVE_ICON: "REMOVE_ICON",
  UPDATE_SCHEDULED_CALL_START_TIME: "UPDATE SCHEDULED CALL START TIME",
  UPDATE_SCHEDULED_CALL_END_TIME: "UPDATE SCHEDULED CALL START TIME",
  REMOVE_DESCRIPTION: "REMOVE_DESCRIPTION",
  ADMIN: "ADMIN"
};

const WEIGHTAGE_SCORE = {
  INTEREST: 4,
  CONNECTION: 0,
  LIKE: 2,
  DISLIKE: -2,
  COMMENT: 1,
  DELETE_COMMENT: -1,
  MEDIA_TYPE_IMAGE: 1,
  MEDIA_TYPE_VIDEO: 1,
  MEDIA_TYPE_CAROUSEL: 1,
  FRESHNESS: 20,//20,
  EXPIRE_TIME: 21,//21
  TIMELINESS: -1,
  MESSAGE: 1,
  EXPIRED_MESSAGE: -(1 / 2)
}

const REDIS_CLUSTER_CONFIG = {
  SLOTS: 16384,
  NODE: 2,
  RANGE: 8191,
  NODE_1: "NODE_1",
  NODE_2: "NODE_2"
}

const NOTIFICATION_MESSAGE_TYPE = {
  IMAGE: "📷 Image",
  AUDIO: "🎙 Audio",
  DOCS: "📁 File",
  VIDEO: "🎬 Video",
  VOICE: "🎙 Voice Message",
  LOCATION: "📍 Location",
  STICKER: "🌝 Sticker",
  CONTACT: "📱 Contact",
};

const JOB_TYPE = {
  SCHEDULED: "SCHEDULED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELED",
  DELETED: "DELETED"
}

const JOB_PRIORITY = {
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW"
}

export {
  SWAGGER_DEFAULT_RESPONSE_MESSAGES,
  HTTP_STATUS_CODE,
  USER_TYPE,
  DB_MODEL_REF,
  DEVICE_TYPE,
  GENDER,
  STATUS,
  JOB_SCHEDULER_TYPE,
  VALIDATION_CRITERIA,
  VALIDATION_MESSAGE,
  MESSAGES,
  MIME_TYPE,
  REGEX,
  LANGUAGES,
  TOKEN_TYPE,
  timeZones,
  UPDATE_TYPE,
  fileUploadExts,
  CATEGORIES_STAUS,
  MODULES,
  MODULES_ID,
  ROLE_TITLES,
  PERMISSION,
  GEN_STATUS,
  THEME,
  SUB_TYPE,
  VISIBILITY,
  ENVIRONMENT,
  REDIS_PREFIX,
  MAIL_TYPE,
  GENERATOR,
  USER_PREFERENCE,
  MAX_DAILY_POINTS,
  TIME_TYPE,
  GOAL_CATEGORY,
  CAL_TYPE,
  OTP_TYPE,
  SOCKET,
  REDIS_KEY_PREFIX,
  CHAT_TYPE,
  MESSAGE_TYPE,
  CHAT_REPORT_TYPE,
  CALL_STATUS,
  CALL_MODE_TYPE,
  CALL_TYPE,
  CHAT_BOX_PAGINATION,
  PAGINATION_DEFAULT,
  LANGUAGE_CODE,
  SUBSCRIPTION_CONFIG,
  DEFAULT_CONFIG,
  NOTIFICATION_TYPE,
  BROADCAST_MODE,
  CHAT_HEADERS,
  CHAT_MODE_TYPE,
  WEIGHTAGE_SCORE,
  REDIS_CLUSTER_CONFIG,
  NOTIFICATION_MESSAGE_TYPE,
  CHAT_MODE,
  JOB_PRIORITY,
  JOB_TYPE
};

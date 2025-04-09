import { SERVER } from '@config/environment';
import { Server, createServer } from 'http'
import * as Constant from "@config/constant";
import { redisClient } from "@lib/redis/RedisClient";
import * as ChatHandler from '@modules/chat/v1/ChatController';
import * as utils from '@utils/appUtils'
import { _verifyUserTokenBySocket } from "@plugins/authToken";
import { userDaoV1 } from '@modules/user';
// import { chatControllerV1 } from '@modules/chat';
const socketIOPlugin = require('socket.io');
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { chatControllerV1 } from '@modules/chat';
import { adminDaoV1 } from '@modules/admin';
let CONF: any = { db: SERVER.REDIS.DB };
let pubClient: any;
// console.log("SERVER",SERVER.ENVIRONMENT);
let io: any;

export class SocketIO {
  public static io: any;
  constructor() { }
  private static _instance: SocketIO;

  public static Instance(server?: Server) {
    if (SERVER.ENVIRONMENT === Constant.ENVIRONMENT.PRODUCTION || SERVER.ENVIRONMENT === Constant.ENVIRONMENT.PREPROD) {
      CONF.tls = {};
      pubClient = createClient(SERVER.REDIS.PORT, SERVER.REDIS.HOST, CONF, { disable_resubscribing: true });
    } else {
      pubClient = createClient({ host: SERVER.REDIS.HOST, port: SERVER.REDIS.PORT });
    }
    const subClient = pubClient.duplicate();
    const adapter = createAdapter(pubClient, subClient);
    if (this._instance == undefined && server) {
      if (!server)
        throw Error('Server variable is required');
      const socket = createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('okay');
      }).listen(SERVER.SOCKET_PORT);
      io = socketIOPlugin(socket, { origins: '*:*' })
      io.adapter(adapter);
      this.io = io;
      this.openConnection();
      return this._instance = new this();
    }
    return this._instance;
  };
  

  static async openConnection() {
    this.io.on(Constant.SOCKET.LISTNER.DEFAULT.CONNECTION, async (client) => {
      utils.consolelog('socket_connection_id', client.id, true)
      let authorization = client.handshake.query.accessToken;
      let state = client.handshake.query.state;
      utils.consolelog(`${state} value *********authorization token *******`, authorization, true)
      if (authorization) {
        try {
          let response: any = await _verifyUserTokenBySocket({ accessToken: authorization });
          utils.consolelog('*********authorization response *******', response, true)
          if (response.hasOwnProperty('statusCode') && response['statusCode'] === 401) {
            utils.consolelog('*********authorization response hasOwnProperty *******', response, true)
            client.emit(Constant.SOCKET.EMITTER.ERROR.AUTHORIZATION_ERROR, Constant.MESSAGES.SOCKET_ERROR.E401.AUTHORIZATION_ERROR);
            client.disconnect();
            return Constant.MESSAGES.SOCKET_ERROR.E401.AUTHORIZATION_ERROR
          } else {
            response = response.credentials.tokenData;
            let deviceId = response['deviceId'];
            response['id'] = response['userId']
            response['_id'] = response['userId']
            response['accessToken'] = authorization;
            response['userData'] = response
            client.emit(Constant.SOCKET.EMITTER.DEFAULT.CONNECTED, Constant.MESSAGES.SOCKET_SUCCESS.S200.CONNECTION_ESTABLISHED);
            client['userId'] = response['id'];
            client['deviceId'] = deviceId;
            client['userData'] = response;
            client['accessToken'] = authorization;
            client['userType'] = response['userType'];
            console.log("***************************SERVER.APP_NAME************************************", SERVER.ENVIRONMENT, `${SERVER.ENVIRONMENT}ADMIN_ROOM`);
            if (client['userType'] == Constant.USER_TYPE.USER) {
              if (!state) await redisClient.storeValue(SERVER.APP_NAME + "_" + (response['id']).toString() + Constant.REDIS_KEY_PREFIX.SOCKET_ID, client.id);
            } else {
              client.join(`${SERVER.ENVIRONMENT}ADMIN_ROOM`);
              if (!state) await redisClient.storeValue(SERVER.APP_NAME + "_" + (response['id']).toString() + Constant.REDIS_KEY_PREFIX.ADMIN_SOCKET_ID, client.id);
            }
            if (client['userType'] == Constant.USER_TYPE.USER) {
              if (state) this.informUserStatus(client, false); else this.informUserStatus(client, true);
            } else {
              if (state) this.informAdminStatus(client, false); else this.informAdminStatus(client, true);
            }
            this.chatSocketEventsHandler(client)
            this.socketDisconectHandler(this.io, client)
            return {}
          }
        } catch (error) {
          if (error.hasOwnProperty('statusCode') && error['statusCode'] === 401) {
            utils.consolelog('**************error1*************', error, true)
            client.emit(Constant.SOCKET.EMITTER.ERROR.AUTHORIZATION_ERROR, Constant.MESSAGES.SOCKET_ERROR.E401.AUTHORIZATION_ERROR);
            client.disconnect();
            return Constant.MESSAGES.SOCKET_ERROR.E401.AUTHORIZATION_ERROR
          } else {
            utils.consolelog('**************error2*************', error, true)
            client.emit(Constant.SOCKET.EMITTER.ERROR.SOCKET_ERROR, Constant.MESSAGES.SOCKET_ERROR.E400.SOCKET_ERROR)
            client.disconnect();
            return Constant.MESSAGES.SOCKET_ERROR.E400.SOCKET_ERROR
          }
        }
      } else {
        utils.consolelog('**************error3*************', "", true)
        client.emit(Constant.SOCKET.EMITTER.ERROR.AUTHORIZATION_ERROR, Constant.MESSAGES.SOCKET_ERROR.E401.AUTHORIZATION_ERROR);
        client.disconnect();
        return Constant.MESSAGES.SOCKET_ERROR.E401.AUTHORIZATION_ERROR
      }
    })
  }

  static async chatSocketEventsHandler(client: any) {
    /**
      socket services events for one to one chat for authorized users with admins 
    */
    client.on(Constant.SOCKET.LISTNER.ONE_TO_ONE, async (data: any, ack) => {
      try {
        utils.consolelog('__one_to_one', data, false);
        await ChatHandler.chatController.chatFormation(this.io, client, data, ack, client['userData']);
      } catch (error) {
        this.socketErrorHandler(client, error)
      }
    });
    // client.on(Constant.SOCKET.LISTNER_TYPE.SOCKET_SERVICE.JOB_CHAT_FORMATION, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__job_chat_formation', data, false);
    //     return
    //     // await ChatHandler.chatController.jobChatFormation(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    client.on(Constant.SOCKET.LISTNER_TYPE.SOCKET_SERVICE.ONE_TO_ONE_CHAT, async (data: any, ack) => {
      try {
        utils.consolelog('__one_to_one_chat_message', data, false);
        await ChatHandler.chatController.oneToOneMessage(this.io, client, data, ack, client['userData']);
      } catch (error) {
        this.socketErrorHandler(client, error)
      }
    })
    client.on(Constant.SOCKET.LISTNER_TYPE.CHAT.REJECT_REQUEST, async (data: any, ack) => {
      try {
        utils.consolelog('__reject_request', data, false);
        await ChatHandler.chatController.rejectRequest(this.io, client, data, ack, client['userData']);
      } catch (error) {
        this.socketErrorHandler(client, error)
      }
    })
    client.on(Constant.SOCKET.LISTNER_TYPE.NOTIFY.UNREAD_NOTIFY, async (data: any, ack) => {
      try {
        utils.consolelog('__unread_notify', data, false);
        await ChatHandler.chatController.unreadNotify(this.io, client, data, ack, client['userData']);
      } catch (error) {
        this.socketErrorHandler(client, error)
      }
    })
    client.on(Constant.SOCKET.LISTNER_TYPE.MESSAGE.QUOTATION_STATUS, async (data: any, ack) => {
      try {
        utils.consolelog('__quotation_status', data, false);
        await ChatHandler.chatController.quotationStatus(this.io, client, data, ack, client['userData']);
      } catch (error) {
        this.socketErrorHandler(client, error)
      }
    })
    // client.on(Constant.SOCKET.LISTNER_TYPE.MESSAGE.REACTION, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__chat_reaction', data, false);
    //     await ChatHandler.chatController.chatReaction(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    client.on(Constant.SOCKET.LISTNER_TYPE.MESSAGE.REPLIED, async (data: any, ack) => {
      try {
        utils.consolelog('__chat_replied', data, false);
        await ChatHandler.chatController.RepliedToMessage(this.io, client, data, ack, client['userData']);
      } catch (error) {
        this.socketErrorHandler(client, error)
      }
    })
    client.on(Constant.SOCKET.LISTNER_TYPE.USER.LEFT_ROOM, async (data: any, ack) => {
      try {
        utils.consolelog('__chat_room_left', data, false);
        await ChatHandler.chatController.leftRoom(this.io, client, data, ack, client['userData']);
      } catch (error) {
        this.socketErrorHandler(client, error)
      }
    })
    client.on(Constant.SOCKET.LISTNER_TYPE.CHAT.LISTING, async (data: any, ack) => {
      try {
        utils.consolelog('__inbox_chat', data, false);
        await ChatHandler.chatController.inboxChat(this.io, client, data, ack, client['userData']);
      } catch (error) {
        this.socketErrorHandler(client, error)
      }
    })
    // client.on(Constant.SOCKET.LISTNER_TYPE.CHAT.ARCHIVE_LIST, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__inbox_archive', data, false);
    //     await ChatHandler.chatController.inboxArchive(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    client.on(Constant.SOCKET.LISTNER_TYPE.CHAT.MESSAGE, async (data: any, ack) => {
      try {
        utils.consolelog('__inbox_message', data, false);
        await ChatHandler.chatController.inboxMessages(this.io, client, data, ack, client['userData']);
      } catch (error) {
        this.socketErrorHandler(client, error)
      }
    })
    // client.on(Constant.SOCKET.LISTNER_TYPE.MESSAGE.DELETE_MESSAGE, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__delete_message', data, false);
    //     await ChatHandler.chatController.deleteMessages(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.CHAT.DELETE, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__delete_chat', data, false);
    //     await ChatHandler.chatController.deleteChat(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    client.on(Constant.SOCKET.LISTNER_TYPE.CHAT.TRACKING, async (data: any, ack) => {
      try {
        utils.consolelog('__live_tracking', data, false);
        await ChatHandler.chatController.liveTracking(this.io, client, data, ack, client['userData']);
      } catch (error) {
        this.socketErrorHandler(client, error)
      }
    })
    // client.on(Constant.SOCKET.LISTNER_TYPE.USER.BLOCKED, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__user_blocked', data, false);
    //     await ChatHandler.chatController.blockedUser(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.USER.REPORT, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__report_user', data, false);
    //     await ChatHandler.chatController.reportUser(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.MESSAGE.REPORT, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__report_message', data, false);
    //     await ChatHandler.chatController.reportMessage(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.CHAT.ARCHIVE, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__archive', data, false);
    //     await ChatHandler.chatController.acrhiveChat(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.CHAT.WALLPAPER, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__wallpaper', data, false);
    //     await ChatHandler.chatController.setWallpaper(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.BROADCAST.CREATE, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__create_broadcast', data, false);
    //     await ChatHandler.chatController.createBroadcast(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.BROADCAST.DETAILS, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__view_broadcast', data, false);
    //     await ChatHandler.chatController.viewBroadCast(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.BROADCAST.EDIT, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__edit_broadcast', data, false);
    //     await ChatHandler.chatController.editOrDeleteBroadcast(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.BROADCAST.MESSAGES, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__send_broadcast', data, false);
    //     await ChatHandler.chatController.sendBroadcast(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.BROADCAST.JOIN, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__join_broadcast', data, false);
    //     await ChatHandler.chatController.joinBroadCast(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.BROADCAST.VIEW_MESSAGE, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__inbox_broadcast', data, false);
    //     await ChatHandler.chatController.inboxBroadCast(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.GROUP.CREATE, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__create_group', data, false);
    //     await ChatHandler.chatController.createGroup(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.GROUP.EDIT, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__edit_group', data, false);
    //     await ChatHandler.chatController.editGroup(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.GROUP.MESSAGES, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__send_group_message', data, false);
    //     await ChatHandler.chatController.sendGroupMessage(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.GROUP.REPLIED, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__reply_group_message', data, false);
    //     await ChatHandler.chatController.RepliedToGroupMessage(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.GROUP.EXIT, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__exit_group', data, false);
    //     await ChatHandler.chatController.exitGroup(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.GROUP.DELETE, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__delete_group', data, false);
    //     await ChatHandler.chatController.deleteGroup(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.GROUP.REMOVE, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__remove_group_member', data, false);
    //     await ChatHandler.chatController.removeGroupMember(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.GROUP.ADMIN, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__make_group_admin', data, false);
    //     await ChatHandler.chatController.makeGroupAdmin(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.GROUP.REMOVE_ADMIN, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__remove_from_admin', data, false);
    //     await ChatHandler.chatController.removeGroupAdmin(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.GROUP.JOIN, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__join_group_chat', data, false);
    //     await ChatHandler.chatController.joinGroupChat(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.GROUP.REPORT, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__report_group', data, false);
    //     await ChatHandler.chatController.reportGroupChat(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.CHAT.MUTE, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__chat_mute', data, false);
    //     await ChatHandler.chatController.muteChat(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    client.on(Constant.SOCKET.LISTNER_TYPE.CHAT.READ_ALL, async (data: any, ack) => {
      try {
        utils.consolelog('__marked_read_all', data, false);
        await ChatHandler.chatController.markedReadAllChat(this.io, client, data, ack, client['userData']);
      } catch (error) {
        this.socketErrorHandler(client, error)
      }
    })
    // client.on(Constant.SOCKET.LISTNER_TYPE.USER.SUBSCRIPTION, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__subscription', data, false);
    //     await ChatHandler.chatController.checkSubscription(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.SOCKET_SERVICE.CALL_INITIATE, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__call_initiate', data, false);
    //     await ChatHandler.chatController.callInitiate(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.SOCKET_SERVICE.CALL_ACCEPT, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__call_accept', data, false);
    //     await ChatHandler.chatController.callAccept(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.SOCKET_SERVICE.CALL_END, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__call_end', data, false);
    //     await ChatHandler.chatController.callEnd(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.TRANSCRIPTION.MESSAGE, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__transcription_message', data, false);
    //     await ChatHandler.chatController.transcriptionMessage(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.TRANSCRIPTION.VOICE_OVER_CONFIG, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__transcript_voice_over_config', data, false);
    //     await ChatHandler.chatController.transcriptVoiceOverConfig(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.SOCKET_SERVICE.REMOVE_ATTENDEES, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__remove_attendees', data, false);
    //     await ChatHandler.chatController.removeAttendees(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // });
    // client.on(Constant.SOCKET.LISTNER_TYPE.SOCKET_SERVICE.CALL_DECLINE, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__call_decline', data, false);
    //     await ChatHandler.chatController.callDecline(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.SOCKET_SERVICE.VIDEO_CALL_REQUEST, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__video_call_request', data, false);
    //     await ChatHandler.chatController.videoCallRequest(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.SOCKET_SERVICE.VIDEO_CALL_STATUS, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__video_call_status', data, false);
    //     await ChatHandler.chatController.videoCallStatus(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.SOCKET_SERVICE.USER_CALL_STATUS, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__user_call_status', data, false);
    //     await ChatHandler.chatController.userCallStatus(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.SOCKET_SERVICE.CURRENT_CALL_STATUS, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__current_call_status', data, false);
    //     await ChatHandler.chatController.currentCallStatus(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    client.on(Constant.SOCKET.LISTNER_TYPE.SOCKET_SERVICE.HOME_NOTIFICATION_COUNT, async (data: any, ack) => {
      try {
        utils.consolelog('__home_notification_count', data, false);
        await ChatHandler.chatController.userNotificationCount(this.io, client, data, ack, client['userData']);
      } catch (error) {
        this.socketErrorHandler(client, error)
      }
    })
    client.on(Constant.SOCKET.LISTNER_TYPE.NOTIFY.DELIVERED, async (data: any, ack) => {
      try {
        utils.consolelog('__delivered', data, false);
        this.informUserStatus(client, false)
      } catch (error) {
        this.socketErrorHandler(client, error)
      }
    })

    // client.on(Constant.SOCKET.LISTNER_TYPE.GROUP.CREATE_COMMUNITY, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__create_community', data, false);
    //     await ChatHandler.chatController.createCommunity(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })

    // client.on(Constant.SOCKET.LISTNER_TYPE.GROUP.EDIT_COMMUNITY, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__edit_community', data, false);
    //     await ChatHandler.chatController.editCommunity(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.GROUP.JOIN_COMMUNITY, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__join_community', data, false);
    //     await ChatHandler.chatController.joinCommunity(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.GROUP.COMMUNITY_MESSAGES, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__send_community_message', data, false);
    //     await ChatHandler.chatController.sendCommunityMessage(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })

    // client.on(Constant.SOCKET.LISTNER_TYPE.GROUP.COMMUNITY_REPLIED, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__reply_community_message', data, false);
    //     await ChatHandler.chatController.RepliedToCommunityMessage(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.GROUP.COMMUNITY_EXIT, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__exit_community', data, false);
    //     await ChatHandler.chatController.exitCommunity(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.GROUP.COMMUNITY_JOIN, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__join_community_chat', data, false);
    //     await ChatHandler.chatController.joinCommunityChat(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.GROUP.COMMUNITY_REPORT, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__report_community', data, false);
    //     await ChatHandler.chatController.reportCommunityChat(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.GROUP.COMMUNITY_DELETE, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__delete_community', data, false);
    //     await ChatHandler.chatController.deleteCommunityChat(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.GROUP.REMOVE_DELETE_COMMUNITY, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__remove_delete_community', data, false);
    //     await ChatHandler.chatController.removeDeleteCommunity(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.GROUP.REMOVE_COMMUNITY, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__remove_community_member', data, false);
    //     await ChatHandler.chatController.removeCommunityMember(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.SOCKET_SERVICE.CREATE_MESSAGE_REQUEST, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__create_message_request', data, false);
    //     // await ChatHandler.chatController.createMessageRequest(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.SOCKET_SERVICE.INBOX_REQUEST_SENT, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__inbox_request_sent', data, false);
    //     await ChatHandler.chatController.messageRequestSent(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.SOCKET_SERVICE.INBOX_REQUEST_RECEIVE, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__inbox_request_receive', data, false);
    //     await ChatHandler.chatController.messageRequestReveived(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.SOCKET_SERVICE.MESSAGE_REQUEST_ACCEPT, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__message_request_accept', data, false);
    //     // await ChatHandler.chatController.messageRequestAccept(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.SOCKET_SERVICE.MESSAGE_REQUEST_REJECT, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__message_request_reject', data, false);
    //     // await ChatHandler.chatController.messageRequestReject(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.SOCKET_SERVICE.DELETE_MESSAGE_REQUEST, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('__delete_message_request', data, false);
    //     // await ChatHandler.chatController.RemoveMessageRequest(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })
    // client.on(Constant.SOCKET.LISTNER_TYPE.SOCKET_SERVICE.RECEIVED_REQUEST_COUNT, async (data: any, ack) => {
    //   try {
    //     utils.consolelog('___received_request_count', data, false);
    //     await ChatHandler.chatController.ReceivedRequestCount(this.io, client, data, ack, client['userData']);
    //   } catch (error) {
    //     this.socketErrorHandler(client, error)
    //   }
    // })

    return {}
  }

  static async socketErrorHandler(client: any, error: any) {
    utils.consolelog('socketErrorHandler', error, false)
    if (error.type == "INFO_MISSING") {
      client.emit(Constant.SOCKET.EMITTER.ERROR.INSUFFICIENT_INFO, error)
      return {}
    }
    else if (error.type == "INVALID_TOKEN") {
      client.emit(Constant.SOCKET.EMITTER.ERROR.AUTHORIZATION_ERROR, Constant.MESSAGES.SOCKET_ERROR.E401.AUTHORIZATION_ERROR);
      return {}
    }
    else {
      client.emit(Constant.SOCKET.EMITTER.ERROR.NETWORK_ERROR, Constant.MESSAGES.SOCKET_ERROR.E400.NETWORK_ERROR(error))
      return {}
    }
  }

  /**
   * @function socketDisconectHandler 
   * when socket going is to disconnect this function event "disconnect" will listen
   * before disconnect if want to make any update related to user, can be done in "disconnecting" event
   */
  static async socketDisconectHandler(io: any, client: any) {
    try {
      let self = this
      let userId = client['userId'].toString();
      let userType = client['userType'];
      let userData = client['userData'];
      client.on(Constant.SOCKET.LISTNER.DEFAULT.DISCONNECTING, async () => {
        utils.consolelog("socket disconnecting handler", client.rooms, true);

        // sending to rooms in which socket is preset
        let socketRoom = [...(client.rooms)];
        socketRoom.forEach((room) => {
          io.to(`${room}`).emit(Constant.SOCKET.LISTNER_TYPE.USER.USER_STATUS, {
            chatId: room,
            userId: userId,
            isOnline: false,
            lastSeen: Date.now()
          })
        })
        // sending to all user where he is not in room but others seeing his status 
        if (userType == Constant.USER_TYPE.USER) {
          this.informUserStatus(client, false);
        } else {
          this.informAdminStatus(client, false);
        }
        await redisClient.deleteKey(SERVER.APP_NAME + "_" + userId + Constant.REDIS_KEY_PREFIX.SOCKET_ID);
        await redisClient.deleteKey(SERVER.APP_NAME + "_" + userId + Constant.REDIS_KEY_PREFIX.ADMIN_SOCKET_ID);
        if (userType == Constant.USER_TYPE.USER) {
          await ChatHandler.chatController.updateUserLastSeen(userData);
        }
      });
      utils.consolelog("In disconnect handler", userId, true)
      client.on(Constant.SOCKET.LISTNER.DEFAULT.DISCONECT, function () {
        self.socketCheckOnDisconnect(io, client, userId, userData)
        return {}
      });
    } catch (error) {
      utils.consolelog('socketDisconectHandler', error, false)
      return Promise.reject(error)
    }
  }

  /**
   * @function informUserStatus 
   * Inform users for the current user is online/offline on the basis of connect and disconnect
   */
  static async informUserStatus(client: any, isOnline: boolean) {
    try {
      let userId = client['userId'].toString();
      const blokcedUsers = await userDaoV1.findUserById(userId);
      let offline_status = await chatControllerV1.checkUserOfflineOverallStatus(userId, userId);
      if (offline_status) isOnline = false;
      client.broadcast.emit(Constant.SOCKET.LISTNER_TYPE.USER.USER_STATUS, {
        userId: userId,
        isOnline: isOnline,
        lastSeen: Date.now(),
        blocked: blokcedUsers?.blocked
      });
      await chatControllerV1.updateDeliveredStatus(client, userId)
    } catch (error) {
      utils.consolelog('informUserStatus', error, false)
      return Promise.reject(error)
    }
  }

  static async informAdminStatus(client: any, isOnline: boolean) {
    try {
      let userId = client['userId'].toString();
      const blokcedUsers = await adminDaoV1.findAdminById(userId);
      let offline_status = await chatControllerV1.checkUserOfflineOverallStatus(userId, userId);
      if (offline_status) isOnline = false;
      client.broadcast.emit(Constant.SOCKET.LISTNER_TYPE.USER.USER_STATUS, {
        userId: userId,
        isOnline: isOnline,
        lastSeen: Date.now(),
        blocked: blokcedUsers?.blocked
      });
      await chatControllerV1.updateDeliveredStatus(client, userId)
    } catch (error) {
      utils.consolelog('informAdminStatus', error, false)
      return Promise.reject(error)
    }
  }

  static async socketCheckOnDisconnect(io: any, client: any, userId: string, userData: any) {
    try {
      let self = this
      let socketDisconnectTimer = setTimeout(() => {
        self.onSocketdisconnect(io, client, userId, userData)
      }, SERVER.SOCKET_DISCONNECT_TIMEOUT)

      client.emit(Constant.SOCKET.EMITTER.PING, 'PING', function (ack) {
        utils.consolelog("PING", [userId, ack], true)
        if (ack) {
          clearTimeout(socketDisconnectTimer);
          utils.consolelog('fake disconnect', 'Fake disconnect call', false)
          return {}
        } else {
          return {}
        }
      })
    } catch (error) {
      utils.consolelog('callCheckOnDisconnect', error, false)
      return Promise.reject(error)
    }
  }

  static onSocketdisconnect(io: any, client: any, userId: string, userData: any) {
    if (userId && userData && userData._id) {
      utils.consolelog('onSocketdisconnect', [client['userId'], client.id], true)
    }
    return {}
  }
}

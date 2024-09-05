/* types */
import type {
  ISocketAuth,
  ISocketUserJoined,
  ISocketJoinedUserItem,
  ISocketStatusCode,
  ISocketCall,
  ISocketAttendees,
  ISocketHangup,
  ISocketOnHangup,
  ISocketAnswer,
  ISocketOnAnswer,
  ISocketUserJoinedRoom,
  ISocketSendOffer,
  ISocketOnSendOffer,
  ISocketSendAnswer,
  ISocketOnSendAnswer,
  ISocketSendIceCandidate,
  ISocketOnSendIceCandidate,
} from "../types/socket";
import type { ISocketCustomData, IUserListItem } from "../types/users";
/* plugins */
import express from "express";
import { createServer, get } from "http";
import { Server, type Socket } from "socket.io";
// import { v4 as uuidv4 } from "uuid";

const port = 7000;
const app = express();
const httpServer = createServer(app);

httpServer.listen(port, () => {
  console.log(`server listening on port: ${port}`);
});

// #region socket.io
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});
io.on("connection", (socket: Socket) => {
  console.log(`socket ${socket.id} connected`);

  const authCode = socket.handshake.auth.authCode as string;
  console.log(`authCode:`, authCode);
  const acc = socket.handshake.auth.acc as string;
  console.log(`acc:`, acc);

  /**
   * 1. 預設加入以授權代碼為名的「room」
   * 2. 傳送有使用者連線的訊息
   */
  if (authCode && acc) {
    // 自訂義資料
    const customData = {
      authCode,
      acc,
      callStatus: {
        statusCode: 0,
        role: null,
        roomId: null,
        attendeeList: [],
      },
    } as ISocketCustomData;
    // 併入data中
    Object.assign(socket.data, customData);
    // 將使用者加入「大廳」(以授權代碼為名)
    socket.join(authCode);
    // 通知所有使用者
    broadcastRoomUsersMessage(authCode, "user-list", socket.id);
  }

  /**
   * 當使用者傳送狀態碼要更新
   */
  socket.on("status-code", (message: ISocketStatusCode) => {
    console.log("status-code socket: ", socket.id, " message: ", message);
    (socket.data as ISocketCustomData).callStatus.statusCode = message.code;
  });

  /**
   * 當發起通話時
   * @param {ISocketCall} message
   */
  socket.on("phone-call", (message: ISocketCall) => {
    console.log(`phone-call message: `, message);

    /**
     * self: 發起端
     * target: 接收端
     */
    const { self, target, roomId } = message;

    // 查找
    const targetClient = getClient(target.socketId);
    if (!targetClient) {
      /**
       * 找不到接收端client
       * 1. 須回應給發起端
       */
      return;
    }

    /**
     * 判斷接收端通話狀態
     * 1. 如果是閒置
     */
    switch ((targetClient.data as ISocketCustomData).callStatus.statusCode) {
      // 閒置
      case 0: {
        // 設定發起端的通話狀態碼
        (socket.data as ISocketCustomData).callStatus.statusCode = 1;
        /**
         * 設定接收端的通話狀態碼
         * 1. 這感覺要調整，因為接收端不一定有收到。
         */
        (targetClient.data as ISocketCustomData).callStatus.statusCode = 1;
        // 設定發起端房間號碼
        (socket.data as ISocketCustomData).callStatus.roomId = roomId as string;
        // 將發起端加入房間
        socket.join(roomId);
        // 通知接收端
        socket.to(target.socketId).emit("phone-call", {
          caller: message.self,
          roomId,
        });
        break;
      }
      /**
       * 1: 撥號中/待回應中
       * 2: 通話中
       */
      case 1:
      case 2: {
        // 通知發起端: 接收端是忙線
        io.to(self.socketId).emit("phone-busy", {
          target,
          statusCode: (targetClient.data as ISocketCustomData).callStatus
            .statusCode,
        });
        break;
      }
    }
  });

  /**
   * 當通知參與者時
   */
  socket.on("phone-attendees", (message: ISocketAttendees) => {
    /**
     * self: 發起端
     * target: 接收端
     */
    const { self, target, attendees } = message;

    // 查找
    const targetClient = getClient(target.socketId);
    if (!targetClient) {
      /**
       * 找不到接收端client
       * 1. 須回應給發起端
       */
      return;
    }

    // 通知接收端: 參與者列表
    socket.to(target.socketId).emit("phone-attendees", {
      caller: message.self,
      attendees,
    });
  });

  /**
   * 當掛斷電話時
   * @param {ISocketHangup} message
   */
  socket.on("phone-hangup", (message: ISocketHangup) => {
    console.log(`phone-hangup message: `, message);

    // 處理訊息
    const { self, target, roomId } = message;
    const emitMsg: ISocketOnHangup = {
      user: {
        ...self,
      },
    };

    /**
     * 判斷是否有房間號碼
     * 1. 如果有則對房間進行廣播，
     * 2.
     */
    if (roomId) {
      // 發送訊息給房間中(自己除外)的所有使用者
      socket.to(roomId).emit("phone-hangup", emitMsg);
      // 自己離開房間
      socket.leave(roomId);
    } else {
      if (target) {
        socket.to(target.socketId).emit("phone-hangup", emitMsg);
      }
    }

    // 更新自己的通知狀態碼
    (socket.data as ISocketCustomData).callStatus.statusCode = 0;
  });

  /**
   * 當有使用者接聽時
   * @param {ISocketAnswer} message
   */
  socket.on("phone-answer", (message: ISocketAnswer) => {
    console.log(`phone-answer message: `, message);
    const socketData = socket.data as ISocketCustomData;

    // 處理訊息
    const { self, target } = message;

    // 查找撥打方
    const caller = getClient(target.socketId);
    if (!caller) {
      // 接通前撥打方已經離線?
      return;
    }
    // 撥打方資料
    const callerData = caller.data as ISocketCustomData;
    // 取得房間號碼(撥打方)
    const roomId = callerData.callStatus.roomId as string;
    // 將撥打方的通話狀態碼改為通話中
    (caller.data as ISocketCustomData).callStatus.statusCode = 2;
    // 設定接聽方的房間號碼並加入房間
    socketData.callStatus.roomId = roomId;
    socket.join(roomId);
    // 將接聽方的通話狀態碼改為通話中
    socketData.callStatus.statusCode = 2;
    // 廣播通知房間中的所有人
    broadcastRoomUsersMessage(roomId, "phone-answer", socket.id);
  });

  /**
   * 當有使用者傳送 offer 時
   * @param {ISocketSendOffer} message
   */
  socket.on("offer", (message: ISocketSendOffer) => {
    const { self, target, roomId, localDescription } = message;
    console.log("offer", {
      self,
      target,
    });

    const emitMsg: ISocketOnSendOffer = {
      localDescription,
      user: self,
    };
    socket.to(target.socketId).emit("offer", emitMsg);
  });

  /**
   * 當有使用者傳送 answer 時
   * @param {ISocketSendAnswer} message
   */
  socket.on("answer", (message: ISocketSendAnswer) => {
    const { self, target, roomId, localDescription } = message;
    console.log("answer", {
      self,
      target,
    });

    const emitMsg: ISocketOnSendAnswer = {
      localDescription,
      user: self,
    };
    socket.to(target.socketId).emit("answer", emitMsg);
  });

  /**
   * 當有使用者傳送 ice candidate 時
   * @param {ISocketSendIceCandidate} message
   */
  socket.on("ice-candidate", (message: ISocketSendIceCandidate) => {
    const { self, target, roomId, ice } = message;
    console.log("ice-candidate", {
      self,
      target,
    });

    const emitMsg: ISocketOnSendIceCandidate = {
      ice,
      user: self,
    };
    socket.to(target.socketId).emit("ice-candidate", emitMsg);
  });

  /**
   * 當斷線時
   */
  socket.on("disconnect", (reason) => {
    console.log(`socket ${socket.id} disconnected due to ${reason}`);
    // deleteUser(socket.id);
    broadcastRoomUsersMessage(socket.data.authCode, "user-list", socket.id);
  });
});

/**
 * 對大廳廣播使用者列表資料
 * 1. 當有使用者加入/離開房間時
 * @param {string} roomId 房間id
 * @param {string} event 事件名稱
 * @param {string} currentSocketId 目前socket的id
 */
const broadcastRoomUsersMessage = (
  roomId: string,
  event: string,
  currentSocketId: string
) => {
  // 取得房間中的所有使用者
  const roomUserList = getRoomUsers(roomId);
  // 整理訊息資料
  const msgUserList = roomUserList.map((item) => {
    return {
      socketId: item.socketId,
      acc: item.acc,
    };
  });

  switch (event) {
    case "user-list": {
      const message: ISocketUserJoined = {
        userList: msgUserList,
      };
      // 進行訊息廣播
      io.in(roomId).emit(event, message);
      break;
    }
    case "phone-answer": {
      const message: ISocketUserJoinedRoom = {
        socketId: currentSocketId,
        userList: msgUserList,
      };
      // 進行訊息廣播
      io.in(roomId).emit(event, message);
      break;
    }
  }
};

/**
 * 取得client實例
 * @param {string} socketId
 * @returns
 */
const getClient = (socketId: string) => {
  return io.sockets.sockets.get(socketId) || null;
};

/**
 * 取得房間使用者列表
 * @param {string} roomId 房間名稱
 */
const getRoomUsers = (roomId: string): ISocketJoinedUserItem[] => {
  // 房間使用者列表
  const roomUserList: ISocketJoinedUserItem[] = [];

  // 取得特定房間中的socket id列表
  const roomSocketIdSet = io.sockets.adapter.rooms.get(roomId);
  if (roomSocketIdSet && roomSocketIdSet.size > 0) {
    ([...roomSocketIdSet] as string[]).forEach((socketId: string) => {
      // 透過socket id查詢目標實例
      const client = getClient(socketId);
      if (client) {
        roomUserList.push({
          socketId,
          acc: (client.data as ISocketCustomData).acc,
        });
      }
    });
  }
  return roomUserList;
};
// #endregion socket.io

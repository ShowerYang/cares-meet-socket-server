import { ICallStatus } from "./users";

/**
 * 驗證
 */
export interface ISocketAuth {
  authCode: string;
  acc: string;
}

// #region client端socket的訊息回傳
/**
 * 連線時
 */
export interface ISocketConncted {
  socketId: string;
}

/**
 * 使用者加入時: 以授權代碼為名的房間
 */
export interface ISocketUserJoined {
  userList: ISocketJoinedUserItem[];
}
export interface ISocketJoinedUserItem {
  socketId: string;
  acc: string;
}

/**
 * 更新狀態碼
 */
export interface ISocketStatusCode {
  code: number
}
// #endregion client端socket的訊息回傳

// #region 通話
export interface ISocketCommunicate {
  self: {
    socketId: string;
    acc: string;
  };
  target: {
    socketId: string;
    acc: string;
  };
}
/**
 * 撥打
 */
export interface ISocketCall extends ISocketCommunicate {
  roomId: string;
}
/**
 * 當被撥打時
 */
export interface ISocketOnCall {
  caller: {
    socketId: string;
    acc: string;
  };
  // roomId: string;
}

/**
 * 通知更新參與者列表
 */
export interface ISocketAttendees {
  self: {
    socketId: string
    acc: string
  }
  target: {
    socketId: string
    acc: string
  }
  attendees: ISocketJoinedUserItem[]
}
/**
 * 被通知更新參與者列表
 */
export interface ISocketOnAttendees {
  caller: {
    socketId: string
    acc: string
  }
  attendees: ISocketJoinedUserItem[]
}

/**
 * 掛斷
 */
export interface ISocketHangup {
  self: {
    socketId: string;
    acc: string;
  };
  target?: {
    socketId: string;
    acc: string;
  };
  roomId?: string; // 房間號碼
}
/**
 * 當有使用者掛斷電話時
 */
export interface ISocketOnHangup {
  user: {
    socketId: string;
    acc: string;
  };
}

/**
 * 接聽
 */
export interface ISocketAnswer extends ISocketCommunicate {
  roomId: string;
}
/**
 * 當有使用者接聽時
 */
export interface ISocketOnAnswer {
  users: {
    socketId: string;
    acc: string;
  }[];
}

/**
 * 當使用者加入房間時
 */
export interface ISocketUserJoinedRoom {
  socketId: string;
  userList: ISocketJoinedUserItem[];
}

/**
 * 傳送 offset SDP
 */
export interface ISocketSendOffer extends ISocketCommunicate {
  roomId: string;
  localDescription: any;
}
/**
 * 當被傳送 offer
 */
export interface ISocketOnSendOffer {
  localDescription: any;
  user: {
    socketId: string;
    acc: string;
  };
}

/**
 * 傳送 answer SDP
 */
export interface ISocketSendAnswer extends ISocketCommunicate {
  roomId: string
  localDescription: any
}
/**
 * 當被傳送 answer
 */
export interface ISocketOnSendAnswer {
  localDescription: any;
  user: {
    socketId: string;
    acc: string;
  };
}

/**
 * 傳送 ICE 候選位址
 */
export interface ISocketSendIceCandidate extends ISocketCommunicate {
  roomId: string;
  ice: {
    label: number;
    id: string;
    candidate: string;
  };
}
/**
 * 當被傳送 ICE 候選位址
 */
export interface ISocketOnSendIceCandidate {
  ice: {
    label: number;
    id: string;
    candidate: string;
  };
  user: {
    socketId: string;
    acc: string;
  };
}
// #endregion 通話

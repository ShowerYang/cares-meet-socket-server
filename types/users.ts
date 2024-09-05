// #region Socket Server
/**
 * 自訂義資料
 * 1. 儲存於socket.data
 */
export interface ISocketCustomData {
  authCode: string; // 授權代碼
  acc: string; // 帳號
  callStatus: ICallStatus; // 通話狀態
}
/**
 * 通話狀態
 */
export interface ICallStatus {
  /**
   * 狀態碼
   * 0: 閒置
   * 1: 撥號中/待回應中
   * 2: 通話中
   */
  statusCode: number;
  /**
   * 角色
   * caller: 通話發起端
   * receiver: 通話接收端
   */
  role: "caller" | "receiver" | null;
  roomId: string | null; // 房間號碼
  attendeeList: IAttendeeItem[]; // 參與人員列表
}
/**
 * 參與人員
 */
export interface IAttendeeItem {
  socketId: string;
  acc: string;
  name: string;
}
// #endregion Socket Server

// #region Client
/**
 * 使用者
 */
export interface IUserListItem {
  authCode: string;
  acc: string;
  name: string;
}

/**
 * 使用者資訊
 */
export interface IUserInfo extends IUserListItem {
  isConnected: boolean; // 是否socket連線
  socketId: string | null;
  callStatus: ICallStatus; // 通話狀態
}
// #endregion Client

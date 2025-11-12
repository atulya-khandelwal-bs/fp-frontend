import AgoraChat from "agora-chat";

export function createChatClient(appKey) {
  return new AgoraChat.connection({ appKey });
}




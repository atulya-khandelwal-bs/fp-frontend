import { useEffect, useRef } from "react";
import { createChatClient } from "../services/chatClient";

export function useChatClient(appKey, handlers) {
  const clientRef = useRef(null);

  useEffect(() => {
    clientRef.current = createChatClient(appKey);
    if (handlers) {
      clientRef.current.addEventHandler("app_handlers", handlers);
    }
    return () => {
      if (clientRef.current) {
        clientRef.current.removeEventHandler("app_handlers");
        clientRef.current.close();
      }
    };
  }, [appKey]);

  return clientRef;
}




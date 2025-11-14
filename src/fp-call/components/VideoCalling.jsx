import AgoraRTC, { AgoraRTCProvider } from "agora-rtc-react";
import { Basics } from "./Basics.jsx";
import VirtualBackgroundExtension from "agora-extension-virtual-background";
import { useEffect } from "react";

export const VideoCalling = ({
  userId,
  peerId,
  channel,
  isInitiator,
  onEndCall,
}) => {
  const client = AgoraRTC.createClient({
    mode: "rtc",
    codec: "vp8",
    // Disable analytics to prevent statscollector errors
    enableAudio: true,
    enableVideo: true,
  });
  const extension = new VirtualBackgroundExtension();

  if (!extension.checkCompatibility()) {
    // The current browser does not support the virtual background plugin, you can stop executing the subsequent logic
    console.error("Does not support Virtual Background!");
  }
  // Register plugin
  AgoraRTC.registerExtensions([extension]);

  // Suppress Agora analytics errors (they don't affect functionality)
  useEffect(() => {
    const originalError = console.error;
    const originalWarn = console.warn;

    // Filter function for Agora analytics errors
    const isAgoraAnalyticsError = (message) => {
      if (typeof message === "string") {
        return (
          message.includes("statscollector") ||
          message.includes("ERR_CONNECTION_RESET") ||
          message.includes("events/messages") ||
          message.includes("net::ERR_CONNECTION_RESET")
        );
      }
      return false;
    };

    const errorHandler = (message, ...args) => {
      // Filter out Agora analytics connection errors
      if (
        isAgoraAnalyticsError(message) ||
        (args.length > 0 &&
          typeof args[0] === "string" &&
          isAgoraAnalyticsError(args[0]))
      ) {
        // Silently ignore analytics errors
        return;
      }
      // Log other errors normally
      originalError(message, ...args);
    };

    const warnHandler = (message, ...args) => {
      // Filter out Agora analytics warnings
      if (
        isAgoraAnalyticsError(message) ||
        (args.length > 0 &&
          typeof args[0] === "string" &&
          isAgoraAnalyticsError(args[0]))
      ) {
        return;
      }
      originalWarn(message, ...args);
    };

    // Override console methods temporarily
    console.error = errorHandler;
    console.warn = warnHandler;

    // Handle unhandled promise rejections (network errors)
    const handleRejection = (event) => {
      const reason = event.reason?.message || event.reason?.toString() || "";
      if (isAgoraAnalyticsError(reason)) {
        event.preventDefault();
        return false;
      }
    };

    window.addEventListener("unhandledrejection", handleRejection);

    // Cleanup on unmount
    return () => {
      console.error = originalError;
      console.warn = originalWarn;
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return (
    <AgoraRTCProvider client={client}>
      <Basics
        client={client}
        userId={userId}
        peerId={peerId}
        channel={channel}
        isInitiator={isInitiator}
        onEndCall={onEndCall}
      />
    </AgoraRTCProvider>
  );
};

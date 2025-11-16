/**
 * Message event handlers for Agora Chat SDK
 * Handles incoming text messages, custom messages, and connection events
 */

import config from "../../common/config.js";

/**
 * Creates message event handlers for the chat client
 */
export function createMessageHandlers({
  userId,
  setIsLoggedIn,
  setIsLoggingIn,
  addLog,
  setConversations,
  generateNewToken,
  handleIncomingCall, // Function to handle incoming call notifications
  clientRef, // Can be a ref object or a getter function
}) {
  // Helper to get the actual client ref
  const getClientRef = () => {
    if (typeof clientRef === "function") {
      return clientRef();
    }
    return clientRef?.current || clientRef;
  };
  return {
    onConnected: () => {
      setIsLoggedIn(true);
      setIsLoggingIn(false);
      addLog(`User ${userId} connected`);
    },
    onDisconnected: () => {
      setIsLoggedIn(false);
      addLog("Disconnected");
    },
    onTextMessage: (msg) => {
      // Check if this is actually a custom message (Agora might deliver custom as text)
      if (msg.type === "custom") {
        // Handle as custom message
        let preview = "Attachment";
        let messageContent = "";

        try {
          // First check customExts (standard Agora Chat format)
          let paramsData = null;
          if (msg.customExts && typeof msg.customExts === "object") {
            paramsData = msg.customExts;
          } else if (
            msg["v2:customExts"] &&
            typeof msg["v2:customExts"] === "object"
          ) {
            paramsData = msg["v2:customExts"];
          } else if (msg.body && msg.body.customExts) {
            paramsData = msg.body.customExts;
          } else if (msg.body && msg.body["v2:customExts"]) {
            paramsData = msg.body["v2:customExts"];
          } else if (msg.params) {
            paramsData =
              typeof msg.params === "string"
                ? JSON.parse(msg.params)
                : msg.params;
          }

          if (paramsData && typeof paramsData === "object" && paramsData.type) {
            const t = String(paramsData.type).toLowerCase();
            if (t === "image") preview = "Photo";
            else if (t === "file")
              preview = paramsData.fileName
                ? `📎 ${paramsData.fileName}`
                : "File";
            else if (t === "audio") preview = "Audio";

            messageContent = JSON.stringify(paramsData);
          } else {
            messageContent = JSON.stringify(paramsData || {});
          }
        } catch {
          messageContent = JSON.stringify(
            msg.customExts || msg["v2:customExts"] || msg.params || {}
          );
        }

        addLog(`${msg.from}: ${messageContent}`);

        // Update conversation
        setConversations((prev) => {
          const existing = prev.find((c) => c.id === msg.from);
          if (existing) {
            return prev.map((conv) =>
              conv.id === msg.from
                ? {
                    ...conv,
                    lastMessage: preview,
                    timestamp: new Date(),
                    lastMessageFrom: msg.from,
                  }
                : conv
            );
          }
          return [
            {
              id: msg.from,
              name: msg.from,
              lastMessage: preview,
              timestamp: new Date(),
              avatar: config.defaults.avatar,
              replyCount: 0,
              lastSeen: "",
              lastMessageFrom: msg.from,
            },
            ...prev,
          ];
        });
        return; // Don't process as text message
      }

      // Regular text message handling
      // Derive a friendly preview for conversation list
      let preview = msg.msg || "";
      try {
        // Only try to parse if it looks like JSON
        if (typeof msg.msg === "string" && msg.msg.trim().startsWith("{")) {
          const obj = JSON.parse(msg.msg);
          if (obj && typeof obj === "object" && obj.type) {
            const t = String(obj.type).toLowerCase();
            if (t === "image") preview = "Photo";
            else if (t === "file")
              preview = obj.fileName ? `📎 ${obj.fileName}` : "File";
            else if (t === "audio") preview = "Audio";
            else if (t === "text") preview = obj.body ?? "";
            else if (t === "call") {
              // Handle call messages - generate preview based on callType
              const callType = obj.callType === "video" ? "Video" : "Voice";
              preview = `${callType} call`;
              // Handle incoming call notification if action is initiate
              if (obj.action === "initiate" && handleIncomingCall) {
                console.log("Incoming call detected in text message:", obj);
                if (obj.channel && obj.from) {
                  console.log("Calling handleIncomingCall with:", {
                    from: obj.from,
                    channel: obj.channel,
                    callId: obj.channel,
                  });
                  handleIncomingCall({
                    from: obj.from,
                    channel: obj.channel,
                    callId: obj.channel,
                  });
                } else {
                  console.warn("Call message missing channel or from:", obj);
                }
              }
            } else if (t === "meal_plan_updated") preview = "Meal plan updated";
            else if (t === "new_nutritionist" || t === "new_nutrionist")
              preview = "New nutritionist assigned";
            else if (t === "products") preview = "Products";
            // If we successfully parsed and generated a preview, use it
            // Otherwise, preview remains as the original msg.msg
          }
        }
      } catch {
        // If parsing fails, preview stays as msg.msg (plain text)
        // This is fine for regular text messages
      }

      addLog(`${msg.from}: ${msg.msg}`);

      // Update conversation when receiving a message
      setConversations((prev) => {
        const existing = prev.find((c) => c.id === msg.from);
        if (existing) {
          return prev.map((conv) =>
            conv.id === msg.from
              ? {
                  ...conv,
                  lastMessage: preview,
                  timestamp: new Date(),
                  lastMessageFrom: msg.from, // Customer sent the last message
                }
              : conv
          );
        }
        // Create new conversation if doesn't exist
        return [
          {
            id: msg.from,
            name: msg.from,
            lastMessage: preview,
            timestamp: new Date(),
            avatar: config.defaults.avatar,
            replyCount: 0,
            lastSeen: "",
            lastMessageFrom: msg.from, // Customer sent the last message
          },
          ...prev,
        ];
      });
    },
    onCustomMessage: (msg) => {
      // Handle custom messages (attachments)
      console.log("=== onCustomMessage called ===");
      console.log("Full msg object:", JSON.stringify(msg, null, 2));
      console.log("msg.type:", msg.type);
      console.log("msg.params:", msg.params);
      console.log("msg.params type:", typeof msg.params);
      console.log("msg.body:", msg.body);
      console.log("msg.ext:", msg.ext);
      console.log("msg.msg:", msg.msg);
      console.log("All msg keys:", Object.keys(msg));

      let preview = "Attachment";
      let messageContent = "";

      try {
        // Custom messages store data in v2:customExts or customExts
        let paramsData = null;

        // First priority: Check customExts at top level (standard Agora Chat format)
        if (msg.customExts && typeof msg.customExts === "object") {
          console.log("Trying msg.customExts:", msg.customExts);
          paramsData = msg.customExts;
          console.log("Extracted from customExts:", paramsData);
        }

        // Second priority: Check v2:customExts at top level (alternative format)
        if (
          (!paramsData || Object.keys(paramsData).length === 0) &&
          msg["v2:customExts"] &&
          typeof msg["v2:customExts"] === "object"
        ) {
          console.log("Trying msg['v2:customExts']:", msg["v2:customExts"]);
          paramsData = msg["v2:customExts"];
          console.log("Extracted from v2:customExts:", paramsData);
        }

        // Third priority: Check body.customExts
        if (
          (!paramsData || Object.keys(paramsData).length === 0) &&
          msg.body &&
          typeof msg.body === "object" &&
          msg.body.customExts
        ) {
          console.log("Trying msg.body.customExts:", msg.body.customExts);
          paramsData = msg.body.customExts;
          console.log("Extracted from body.customExts:", paramsData);
        }

        // Fourth priority: Check body.v2:customExts
        if (
          (!paramsData || Object.keys(paramsData).length === 0) &&
          msg.body &&
          typeof msg.body === "object" &&
          msg.body["v2:customExts"]
        ) {
          console.log(
            "Trying msg.body['v2:customExts']:",
            msg.body["v2:customExts"]
          );
          paramsData = msg.body["v2:customExts"];
          console.log("Extracted from body.v2:customExts:", paramsData);
        }

        // Fifth priority: Check bodies array for v2:customExts or customExts
        if (
          (!paramsData || Object.keys(paramsData).length === 0) &&
          msg.bodies &&
          Array.isArray(msg.bodies) &&
          msg.bodies.length > 0
        ) {
          console.log("Trying msg.bodies for v2:customExts:", msg.bodies);
          for (const bodyItem of msg.bodies) {
            if (
              bodyItem &&
              typeof bodyItem === "object" &&
              bodyItem["v2:customExts"]
            ) {
              paramsData = bodyItem["v2:customExts"];
              console.log("Extracted from bodies[].v2:customExts:", paramsData);
              break;
            }
            // Also check customExts array (without v2: prefix)
            if (
              bodyItem &&
              typeof bodyItem === "object" &&
              bodyItem.customExts &&
              Array.isArray(bodyItem.customExts) &&
              bodyItem.customExts.length > 0
            ) {
              const customExt = bodyItem.customExts[0];
              if (customExt && typeof customExt === "object" && customExt.url) {
                // Extract all properties from customExt
                paramsData = { ...customExt };
                console.log(
                  "Extracted from bodies[].customExts[0]:",
                  paramsData
                );
                break;
              }
            }
          }
        }

        // Sixth priority: Try params
        if (
          (!paramsData || Object.keys(paramsData).length === 0) &&
          msg.params !== undefined &&
          msg.params !== null
        ) {
          if (typeof msg.params === "string") {
            try {
              paramsData = JSON.parse(msg.params);
              console.log("Parsed params from string:", paramsData);
            } catch (parseError) {
              console.error(
                "Failed to parse params string:",
                parseError,
                msg.params
              );
              paramsData = msg.params;
            }
          } else if (typeof msg.params === "object") {
            paramsData = msg.params;
            console.log("Using params as object:", paramsData);
          }
        }

        // Seventh priority: Try ext - we're putting data there (both as ext.data and spread directly)
        if (
          !paramsData ||
          (typeof paramsData === "object" &&
            Object.keys(paramsData).length === 0)
        ) {
          console.log("paramsData is empty, trying ext properties...");
          if (msg.ext && typeof msg.ext === "object") {
            console.log("Trying msg.ext:", msg.ext);

            // Check if ext has the attachment properties directly (we spread them)
            if (
              msg.ext.type &&
              (msg.ext.type === "image" ||
                msg.ext.type === "file" ||
                msg.ext.type === "audio")
            ) {
              paramsData = {
                type: msg.ext.type,
                url: msg.ext.url,
                fileName: msg.ext.fileName,
                mimeType: msg.ext.mimeType,
                size: msg.ext.size,
                duration: msg.ext.duration,
                transcription: msg.ext.transcription,
              };
              console.log(
                "Extracted from ext properties directly:",
                paramsData
              );
            }

            // If still empty, try ext.data
            if (
              (!paramsData || Object.keys(paramsData).length === 0) &&
              msg.ext.data
            ) {
              try {
                paramsData =
                  typeof msg.ext.data === "string"
                    ? JSON.parse(msg.ext.data)
                    : msg.ext.data;
                console.log("Extracted from ext.data:", paramsData);
              } catch {}
            }

            // Last resort: use entire ext object if it has useful data
            if (
              (!paramsData || Object.keys(paramsData).length === 0) &&
              Object.keys(msg.ext).length > 0
            ) {
              // Filter out the 'data' key if it exists and is a string (already tried)
              const extCopy = { ...msg.ext };
              if (extCopy.data && typeof extCopy.data === "string") {
                delete extCopy.data;
              }
              if (Object.keys(extCopy).length > 0) {
                paramsData = extCopy;
                console.log("Using entire ext object (filtered):", paramsData);
              }
            }
          }

          // Try body
          if (
            (!paramsData || Object.keys(paramsData).length === 0) &&
            msg.body
          ) {
            console.log("Trying msg.body:", msg.body);
            try {
              paramsData =
                typeof msg.body === "string" ? JSON.parse(msg.body) : msg.body;
              console.log("Extracted from body:", paramsData);
            } catch {}
          }

          // Last resort: try msg.msg if it exists
          if (
            (!paramsData || Object.keys(paramsData).length === 0) &&
            msg.msg
          ) {
            console.log("Trying msg.msg:", msg.msg);
            try {
              paramsData =
                typeof msg.msg === "string" ? JSON.parse(msg.msg) : msg.msg;
              console.log("Extracted from msg.msg:", paramsData);
            } catch {}
          }
        }

        console.log("Final extracted paramsData:", paramsData);

        if (
          paramsData &&
          typeof paramsData === "object" &&
          Object.keys(paramsData).length > 0 &&
          paramsData.type
        ) {
          const t = String(paramsData.type).toLowerCase();
          if (t === "image") preview = "Photo";
          else if (t === "file")
            preview = paramsData.fileName
              ? `📎 ${paramsData.fileName}`
              : "File";
          else if (t === "audio") preview = "Audio";
          else if (t === "call") {
            // Handle call messages - generate preview based on callType
            const callType =
              paramsData.callType === "video" ? "Video" : "Voice";
            preview = `${callType} call`;
            // Handle incoming call notification if action is initiate
            if (paramsData.action === "initiate" && handleIncomingCall) {
              console.log(
                "Incoming call detected in custom message:",
                paramsData
              );
              if (paramsData.channel && paramsData.from) {
                handleIncomingCall({
                  from: paramsData.from,
                  channel: paramsData.channel,
                  callId: paramsData.channel,
                });
              }
            }
          } else if (t === "meal_plan_updated") preview = "Meal plan updated";
          else if (t === "new_nutritionist" || t === "new_nutrionist")
            preview = "New nutritionist assigned";
          else if (t === "products") preview = "Products";

          messageContent = JSON.stringify(paramsData);
        } else {
          // Log what we got for debugging
          console.warn("paramsData is not valid or empty:", paramsData);
          console.warn("Falling back to stringifying entire msg object");
          messageContent = JSON.stringify(msg);
        }
      } catch (error) {
        console.error("Error processing custom message:", error, msg);
        messageContent = JSON.stringify(msg.params || msg.body || msg || {});
      }

      console.log("Final messageContent to log:", messageContent);
      addLog(`${msg.from}: ${messageContent}`);

      // Update conversation when receiving a custom message
      setConversations((prev) => {
        const existing = prev.find((c) => c.id === msg.from);
        if (existing) {
          return prev.map((conv) =>
            conv.id === msg.from
              ? {
                  ...conv,
                  lastMessage: preview,
                  timestamp: new Date(),
                  lastMessageFrom: msg.from,
                }
              : conv
          );
        }
        // Create new conversation if doesn't exist
        return [
          {
            id: msg.from,
            name: msg.from,
            lastMessage: preview,
            timestamp: new Date(),
            avatar: config.defaults.avatar,
            replyCount: 0,
            lastSeen: "",
            lastMessageFrom: msg.from,
          },
          ...prev,
        ];
      });
    },
    onTokenWillExpire: async () => {
      addLog("Token will expire soon - renewing...");
      const newToken = await generateNewToken();
      const client = getClientRef();
      if (newToken && client) {
        try {
          // Renew the token using Agora Chat SDK
          await client.renewToken(newToken);
          addLog("Token renewed successfully");
        } catch (error) {
          addLog(`Token renewal failed: ${error.message || error}`);
          console.error("Error renewing token:", error);
        }
      }
    },
    onTokenExpired: async () => {
      addLog("Token expired - attempting to renew...");
      setIsLoggedIn(false);

      const newToken = await generateNewToken();
      const client = getClientRef();
      if (newToken && client && userId) {
        try {
          // Try to reconnect with the new token
          await client.open({ user: userId, accessToken: newToken });
          addLog("Reconnected with new token");
          setIsLoggedIn(true);
        } catch (error) {
          addLog(`Reconnection failed: ${error.message || error}`);
          console.error("Error reconnecting:", error);
          setIsLoggingIn(false);
        }
      } else {
        addLog(
          "Cannot reconnect: Token generation failed or client unavailable"
        );
        setIsLoggingIn(false);
      }
    },
    onError: (e) => {
      addLog(`Error: ${e.message}`);
      setIsLoggingIn(false);
    },
  };
}

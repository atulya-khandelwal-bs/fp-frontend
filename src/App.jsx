import { useEffect, useState, useRef } from "react";
import "./App.css";
import Header from "./components/Header.jsx";
import AuthForm from "./components/AuthForm.jsx";
import ConversationList from "./components/ConversationList.jsx";
import ChatInterface from "./components/ChatInterface.jsx";
import LogPanel from "./components/LogPanel.jsx";
import UserDetails from "./components/UserDetails.jsx";
import AgoraChat from "agora-chat";
import { useChatClient } from "./hooks/useChatClient.js";
import config from "./config.js";

function App() {
  const appKey = config.agora.appKey;
  const [userId, setUserId] = useState("");
  const [token, setToken] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [peerId, setPeerId] = useState("");
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState([]);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showChatOnMobile, setShowChatOnMobile] = useState(false);
  const [sortOrder, setSortOrder] = useState("newest"); // "newest" or "oldest"
  const [filterType, setFilterType] = useState("all"); // "all", "pending_customer", "pending_doctor"

  // 🔹 Global message ID tracker to prevent duplicates
  const isSendingRef = useRef(false);

  const addLog = (log) =>
    setLogs((prev) => {
      // Always add log entries, even if they're duplicates
      // This allows users to send the same message multiple times consecutively
      return [...prev, log];
    });

  // Helper function to generate a new token
  const generateNewToken = async () => {
    if (!userId) {
      addLog("Cannot renew token: No user ID");
      return null;
    }

    try {
      addLog(`Renewing chat token for ${userId}...`);
      const tokenResponse = await fetch(config.api.generateToken, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: userId,
          expireInSecs: config.token.expireInSecs,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Token generation failed: ${tokenResponse.status}`
        );
      }

      const tokenData = await tokenResponse.json();
      const newToken = tokenData.token;
      setToken(newToken);
      addLog(`Chat token renewed successfully`);
      return newToken;
    } catch (error) {
      addLog(`Token renewal failed: ${error.message}`);
      console.error("Token renewal error:", error);
      return null;
    }
  };

  const handlers = {
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
      let preview = msg.msg;
      try {
        const obj = JSON.parse(msg.msg);
        if (obj && typeof obj === "object" && obj.type) {
          const t = String(obj.type).toLowerCase();
          if (t === "image") preview = "Photo";
          else if (t === "file")
            preview = obj.fileName ? `📎 ${obj.fileName}` : "File";
          else if (t === "audio") preview = "Audio";
          else if (t === "text") preview = obj.body ?? "";
        }
      } catch {}

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
      if (newToken && clientRef.current) {
        try {
          // Renew the token using Agora Chat SDK
          await clientRef.current.renewToken(newToken);
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
      if (newToken && clientRef.current && userId) {
        try {
          // Try to reconnect with the new token
          await clientRef.current.open({ user: userId, accessToken: newToken });
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

  const clientRef = useChatClient(appKey, handlers);

  // Detect mobile view
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Reset mobile chat view when contact is deselected
  useEffect(() => {
    if (!selectedContact && showChatOnMobile) {
      setShowChatOnMobile(false);
    }
  }, [selectedContact, showChatOnMobile]);

  const handleLogin = async () => {
    if (!userId) {
      addLog("Enter user ID");
      return;
    }

    setIsLoggingIn(true);
    try {
      // Step 1: Register user (if not already registered)
      addLog(`Registering user ${userId}...`);
      try {
        const registerResponse = await fetch(config.api.registerUserEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: userId,
          }),
        });

        if (registerResponse.ok) {
          addLog(`User ${userId} registered successfully`);
        } else {
          // User might already be registered, continue anyway
          const errorData = await registerResponse.json().catch(() => ({}));
          if (
            registerResponse.status === 400 ||
            registerResponse.status === 409
          ) {
            addLog(`User ${userId} already exists, proceeding...`);
          } else {
            addLog(
              `Registration warning: ${
                errorData.error || registerResponse.status
              }`
            );
          }
        }
      } catch (registerError) {
        // If registration fails, still try to generate token (user might already exist)
        addLog(`Registration attempt completed (user may already exist)`);
      }

      // Step 2: Generate chat token
      addLog(`Generating chat token for ${userId}...`);
      const tokenResponse = await fetch(config.api.generateToken, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: userId,
          expireInSecs: config.token.expireInSecs,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Token generation failed: ${tokenResponse.status}`
        );
      }

      const tokenData = await tokenResponse.json();
      const generatedToken = tokenData.token;
      setToken(generatedToken);
      addLog(`Chat token generated successfully`);

      // Step 3: Automatically login with the generated token
      clientRef.current.open({ user: userId, accessToken: generatedToken });
    } catch (error) {
      addLog(`Error: ${error.message}`);
      console.error("Registration/Token generation/Login error:", error);
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    clientRef.current.close();
    setIsLoggedIn(false);
    setSelectedContact(null);
    setConversations([]);
    setPeerId("");
    setMessage("");
  };

  const handleSelectContact = (contact) => {
    setSelectedContact(contact);
    setPeerId(contact.id);

    // Update conversation in list or add if new (don't update timestamp on selection)
    setConversations((prev) => {
      const existing = prev.find((c) => c.id === contact.id);
      if (existing) {
        return prev.map((c) =>
          c.id === contact.id ? { ...c, ...contact } : c
        );
      }
      return [
        ...prev,
        {
          ...contact,
          lastMessage: "",
          timestamp: new Date(),
          avatar:
            contact.avatar ||
            "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face",
        },
      ];
    });
  };

  const handleAddConversation = (contact) => {
    const newConversation = {
      ...contact,
      lastMessage: "",
      timestamp: new Date(),
      avatar:
        contact.avatar ||
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face",
      replyCount: 0,
    };
    setConversations((prev) => [newConversation, ...prev]);
    // Optionally auto-select the new conversation
    // handleSelectContact(newConversation);
  };

  const handleSelectConversation = (conversation) => {
    handleSelectContact(conversation);
    // On mobile, show chat view when conversation is selected
    if (isMobileView) {
      setShowChatOnMobile(true);
    }
  };

  const handleBackToConversations = () => {
    setSelectedContact(null);
    setPeerId("");
    setMessage("");
    setShowChatOnMobile(false);
  };

  // Helper function to build customExts based on message payload
  const buildCustomExts = (payload) => {
    if (!payload || typeof payload !== "object" || !payload.type) {
      return null;
    }

    const type = String(payload.type).toLowerCase();

    switch (type) {
      case "image":
        return {
          type: "image",
          url: payload.url,
          height: payload.height,
          width: payload.width,
        };

      case "audio":
        // Convert duration to milliseconds if it appears to be in seconds (< 3600)
        let durationMs = payload.duration;
        if (typeof durationMs === "number" && durationMs < 3600) {
          durationMs = durationMs * 1000; // Convert seconds to milliseconds
        }
        return {
          type: "audio",
          url: payload.url,
          transcription: payload.transcription || "",
          duration: typeof durationMs === "number" ? durationMs : 0, // in milliseconds, default to 0 if not provided
        };

      case "file":
        return {
          type: "file",
          url: payload.url,
          fileName: payload.fileName || "",
          mimeType: payload.mimeType || "application/octet-stream",
          size: typeof payload.size === "number" ? payload.size : 0, // in bytes
        };

      case "meal_plan_updated":
        return {
          type: "meal_plan_updated",
        };

      case "new_nutritionist":
      case "new_nutrionist": // Handle typo variant
        return {
          type: "new_nutritionist",
          id: payload.id || "",
          name: payload.name || "",
          title: payload.title || "",
          profilePhoto: payload.profilePhoto || "",
        };

      case "products":
        return {
          type: "products",
          products: Array.isArray(payload.products) ? payload.products : [],
        };

      case "call":
        return {
          type: "call",
          callType: payload.callType || "voice", // "voice" or "video"
          duration: payload.duration, // in seconds
        };

      default:
        // For unknown types, return the payload as-is
        return payload;
    }
  };

  const handleSendMessage = async (messageOverride = null) => {
    // Prevent multiple simultaneous sends
    if (isSendingRef.current) {
      return;
    }

    if (!peerId) {
      addLog("No recipient selected");
      return;
    }

    // Use the override message if provided, otherwise use the message prop
    // This ensures we get the exact message value without race conditions
    const messageToSend = messageOverride !== null ? messageOverride : message;

    // Check if message is empty (for text messages)
    if (
      !messageToSend ||
      (typeof messageToSend === "string" && messageToSend.trim() === "")
    ) {
      addLog("Message cannot be empty");
      return;
    }

    // Clear message immediately to prevent duplicate sends
    setMessage("");

    // Mark as sending to prevent duplicate calls
    isSendingRef.current = true;

    try {
      // Verify connection before sending
      if (!clientRef.current || !clientRef.current.isOpened()) {
        addLog(`Send failed: Connection not established`);
        setMessage(messageToSend); // Restore message
        isSendingRef.current = false; // Reset flag on error
        return;
      }

      // Try to parse message as JSON to determine if it's a custom message
      let parsedPayload = null;
      let isCustomMessage = false;

      try {
        parsedPayload = JSON.parse(messageToSend);
        if (
          parsedPayload &&
          typeof parsedPayload === "object" &&
          parsedPayload.type
        ) {
          isCustomMessage = true;
        }
      } catch {
        // Not JSON, treat as plain text
        isCustomMessage = false;
      }

      let options = {};

      if (isCustomMessage) {
        // Build customExts based on message type
        const customExts = buildCustomExts(parsedPayload);

        if (!customExts) {
          addLog("Invalid custom message payload");
          setMessage(messageToSend); // Restore message
          isSendingRef.current = false; // Reset flag on error
          return;
        }

        // Custom message - all custom messages use type: "custom"
        options = {
          type: "custom",
          to: peerId,
          chatType: "singleChat",
          customEvent: "customEvent",
          customExts,
          ext: {},
        };
      } else {
        // Plain text message
        options = {
          chatType: "singleChat",
          type: "txt",
          to: peerId,
          msg: messageToSend,
        };
      }

      // Create and send message
      const msg = AgoraChat.message.create(options);
      await clientRef.current.send(msg);
      console.log("Message sent successfully", msg);

      // Generate preview for conversation list
      let preview = messageToSend;
      if (isCustomMessage && parsedPayload) {
        const t = String(parsedPayload.type).toLowerCase();
        if (t === "image") preview = "Photo";
        else if (t === "file")
          preview = parsedPayload.fileName
            ? `📎 ${parsedPayload.fileName}`
            : "File";
        else if (t === "audio") preview = "Audio";
        else if (t === "meal_plan_updated") preview = "Meal plan updated";
        else if (t === "new_nutritionist" || t === "new_nutrionist")
          preview = "New nutritionist assigned";
        else if (t === "products") preview = "Products";
        else if (t === "call")
          preview = `${
            parsedPayload.callType === "video" ? "Video" : "Voice"
          } call`;
      }

      addLog(`You → ${peerId}: ${messageToSend}`);

      // Update conversation with last message
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === peerId
            ? {
                ...conv,
                lastMessage: preview,
                timestamp: new Date(),
                lastMessageFrom: userId, // Current user sent the last message
              }
            : conv
        )
      );

      // Force a small delay to ensure state update propagates
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Reset the flag after successful send
      isSendingRef.current = false;
    } catch (sendError) {
      console.error("Error sending message:", sendError);
      addLog(
        `Send failed: ${sendError.message || sendError.code || sendError}`
      );
      setMessage(messageToSend); // Restore message on error
      isSendingRef.current = false; // Reset flag on error
    }
  };

  return (
    <div className="app-container">
      {!isLoggedIn ? (
        <>
          <Header />
          <div className="container">
            <AuthForm
              userId={userId}
              setUserId={setUserId}
              onLogin={handleLogin}
              isLoggingIn={isLoggingIn}
            />
            <LogPanel logs={logs} />
          </div>
        </>
      ) : (
        <div className="main-layout">
          {/* Conversation List - show on desktop always, on mobile only when not showing chat */}
          <div
            className={`conversation-panel ${
              isMobileView && showChatOnMobile ? "mobile-hidden" : ""
            }`}
          >
            <ConversationList
              conversations={conversations}
              selectedConversation={selectedContact}
              onSelectConversation={handleSelectConversation}
              userId={userId}
              onAddConversation={handleAddConversation}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              filterType={filterType}
              onFilterTypeChange={setFilterType}
            />
          </div>
          {/* Chat Panel - show on desktop always, on mobile only when showing chat */}
          <div
            className={`chat-panel ${
              isMobileView && !showChatOnMobile ? "mobile-hidden" : ""
            }`}
          >
            {selectedContact ? (
              <ChatInterface
                userId={userId}
                peerId={peerId}
                setPeerId={setPeerId}
                message={message}
                setMessage={setMessage}
                onSend={handleSendMessage}
                onLogout={handleLogout}
                logs={logs}
                selectedContact={selectedContact}
                chatClient={clientRef.current}
                onBackToConversations={
                  isMobileView ? handleBackToConversations : null
                }
              />
            ) : (
              <div className="no-conversation-selected">
                <div className="empty-state">
                  <h2>Welcome, {userId}!</h2>
                  <p>Select a conversation from the list to start chatting</p>
                  <p className="hint">
                    Or add a new conversation using the + icon
                  </p>
                </div>
              </div>
            )}
          </div>
          {/* User Details Panel */}
          <div className="user-details-panel-wrapper">
            <UserDetails selectedContact={selectedContact} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

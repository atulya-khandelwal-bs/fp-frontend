import { useEffect, useState, useRef } from "react";
import "./ChatApp.css";
import Header from "./components/Header.jsx";
import AuthForm from "./components/AuthForm.jsx";
import ConversationList from "./components/ConversationList.jsx";
import ChatInterface from "./components/ChatInterface.jsx";
import LogPanel from "./components/LogPanel.jsx";
import UserDetails from "./components/UserDetails.jsx";
import CallApp from "../fp-call/CallApp.jsx";
// import CallNotification from "./components/CallNotification.jsx";
import AgoraChat from "agora-chat";
import { useChatClient } from "./hooks/useChatClient.js";
import config from "../common/config.js";
import { buildCustomExts } from "./utils/buildCustomExts.js";
import { createMessageHandlers } from "./utils/messageHandlers.js";

// Cookie utility functions
const getCookie = (name) => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

const deleteCookie = (name) => {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
};

function ChatApp() {
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
  const [filterType, setFilterType] = useState("all"); // "all", "pending_customer", "pending_doctor", "first_response", "no_messages"
  const [coachInfo, setCoachInfo] = useState({ name: "", profilePhoto: "" }); // Store coach name and profile photo

  // Call state management
  const [activeCall, setActiveCall] = useState(null); // { userId, peerId, channel, isInitiator, callType }
  const [incomingCall, setIncomingCall] = useState(null); // { from, channel, callId, callType }

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

  // Create a ref to store clientRef for handlers
  const clientRefForHandlers = useRef(null);

  // Handle incoming call - defined early so it can be used in handlers
  const handleIncomingCall = (callData) => {
    setIncomingCall(callData);
  };

  // Create handlers - they will use clientRefForHandlers.current
  const handlers = createMessageHandlers({
    userId,
    setIsLoggedIn,
    setIsLoggingIn,
    addLog,
    setConversations,
    generateNewToken,
    handleIncomingCall,
    get clientRef() {
      return clientRefForHandlers;
    },
  });

  const clientRef = useChatClient(appKey, handlers);

  // Update the ref that handlers use
  useEffect(() => {
    clientRefForHandlers.current = clientRef.current;
  }, [clientRef]);

  // Check for saved userId in cookies on mount
  useEffect(() => {
    const savedUserId = getCookie("loggedInUserId");
    if (savedUserId) {
      setUserId(savedUserId);
    }
  }, []);

  // Fetch coach info when userId is set
  useEffect(() => {
    const fetchCoachInfo = async () => {
      if (!userId) {
        setCoachInfo({ name: "", profilePhoto: "" });
        return;
      }

      try {
        const response = await fetch(config.api.fetchCoaches);

        if (response.ok) {
          const data = await response.json();
          const coach = data.coaches?.find(
            (c) => String(c.coachId) === String(userId)
          );
          if (coach) {
            setCoachInfo({
              name: coach.coachName || "",
              profilePhoto: coach.coachPhoto || "",
            });
          }
        }
      } catch (error) {
        console.error("Error fetching coach info:", error);
      }
    };

    fetchCoachInfo();
  }, [userId]);

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

  // Map filter type to API format
  const getApiFilter = (filterType) => {
    const filterMap = {
      all: "all",
      first_response: "first_response",
      pending_customer: "pending_from_customer",
      pending_doctor: "pending_from_nutritionist",
      no_messages: "no_messages",
    };
    return filterMap[filterType] || "all";
  };

  // Map sort order to API format
  const getApiSort = (sortOrder) => {
    return sortOrder === "newest" ? "desc" : "asc";
  };

  // Fetch conversations from API when user logs in or filter/sort changes
  useEffect(() => {
    const fetchConversations = async () => {
      if (!isLoggedIn || !userId) {
        return;
      }

      try {
        const apiFilter = getApiFilter(filterType);
        const apiSort = getApiSort(sortOrder);

        addLog(
          `Fetching conversations for coach ${userId} (filter: ${apiFilter}, sort: ${apiSort})...`
        );

        const url = new URL(config.api.fetchConversations);
        url.searchParams.append("coachId", userId);
        url.searchParams.append("filter", apiFilter);
        url.searchParams.append("sort", apiSort);
        url.searchParams.append("page", "1");
        url.searchParams.append("limit", "20");

        const response = await fetch(url.toString());

        if (!response.ok) {
          throw new Error(`Failed to fetch conversations: ${response.status}`);
        }

        const data = await response.json();
        const apiConversations = data.conversations || [];

        // Helper function to generate preview from lastMessage (could be string or object)
        const generatePreviewFromLastMessage = (lastMsg) => {
          if (!lastMsg) return null;

          let parsed = null;

          // If it's already a string, try to parse it as JSON
          if (typeof lastMsg === "string") {
            // Check if it looks like JSON (starts with { or [)
            if (
              lastMsg.trim().startsWith("{") ||
              lastMsg.trim().startsWith("[")
            ) {
              try {
                parsed = JSON.parse(lastMsg);
              } catch {
                // Not valid JSON, return as-is
                return lastMsg;
              }
            } else {
              // Plain text string, return as-is
              return lastMsg;
            }
          } else if (typeof lastMsg === "object") {
            // Already an object
            parsed = lastMsg;
          } else {
            // Other type, convert to string
            return String(lastMsg);
          }

          // Now process the parsed object
          if (parsed && typeof parsed === "object" && parsed.type) {
            const t = String(parsed.type).toLowerCase();
            if (t === "image") return "Photo";
            if (t === "file")
              return parsed.fileName ? `📎 ${parsed.fileName}` : "File";
            if (t === "audio") return "Audio";
            if (t === "meal_plan_updated") return "Meal plan updated";
            if (t === "new_nutritionist" || t === "new_nutrionist")
              return "New nutritionist assigned";
            if (t === "products") return "Products";
            if (t === "call")
              return `${parsed.callType === "video" ? "Video" : "Audio"} call`;
            if (t === "text") {
              // API uses "message" field for text messages
              return parsed.message || parsed.body || "";
            }
          }

          // If object has body or message, use it
          if (parsed && typeof parsed === "object") {
            if (parsed.body) return parsed.body;
            if (parsed.message) return parsed.message;
          }

          // If we parsed from string but it's not a recognized format, return original string
          if (typeof lastMsg === "string") {
            return lastMsg;
          }

          // Otherwise stringify the object
          return JSON.stringify(parsed || lastMsg);
        };

        // Map API response to app conversation format
        const mappedConversations = apiConversations.map((conv) => {
          // Generate preview from lastMessage (handles both string and object formats)
          const lastMessage = generatePreviewFromLastMessage(conv.lastMessage);

          return {
            id: String(conv.userId), // Use userId as Agora ID (string)
            name: conv.userName || `User ${conv.userId}`,
            avatar: conv.userPhoto || config.defaults.avatar,
            lastMessage: lastMessage,
            timestamp: conv.lastMessageTime
              ? new Date(conv.lastMessageTime)
              : null,
            lastMessageFrom: conv.lastMessageSender
              ? String(conv.lastMessageSender)
              : null,
            // Store additional API data for reference
            conversationId: conv.conversationId,
            messageCount: conv.messageCount || 0,
            unreadCount: conv.unreadCount || 0,
            filterState: conv.filterState,
          };
        });

        setConversations(mappedConversations);
        addLog(`Loaded ${mappedConversations.length} conversation(s) from API`);
      } catch (error) {
        addLog(`Error fetching conversations: ${error.message}`);
        console.error("Error fetching conversations:", error);
        // Set empty array on error to prevent retry loop
        setConversations([]);
      }
    };

    fetchConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, userId, filterType, sortOrder]);

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
    setUserId("");
    // Clear cookie on logout
    deleteCookie("loggedInUserId");
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

  // Handle call initiation (video or audio)
  const handleInitiateCall = async (callType = "video") => {
    if (!peerId || !userId) {
      addLog("Cannot initiate call: Missing user or peer ID");
      return;
    }

    // Generate channel name using format: fp_rtc_call_user_USER_ID
    // USER_ID is the user's ID (peerId), not the coach's ID
    const channel = `fp_rtc_call_user_${peerId}`;

    // Send a custom message to notify the other user
    const callMessage = JSON.stringify({
      type: "call",
      callType: callType, // "video" or "audio"
      channel: channel,
      from: userId,
      to: peerId,
      action: "initiate",
    });

    try {
      // Send call notification message
      await handleSendMessage(callMessage);

      // Ensure message is cleared after sending call message
      setMessage("");

      // Set active call state
      setActiveCall({
        userId,
        peerId,
        channel,
        isInitiator: true,
        callType: callType,
        localUserName: userId, // You can get actual name from user profile if available
        peerName: selectedContact?.name || peerId,
        peerAvatar: selectedContact?.avatar,
      });

      addLog(`Initiating ${callType} call with ${peerId}`);
    } catch (error) {
      console.error("Error initiating call:", error);
      addLog(`Failed to initiate call: ${error.message}`);
      // Clear message even on error
      setMessage("");
    }
  };

  // Handle accept call
  const handleAcceptCall = () => {
    if (!incomingCall) return;

    // Find the contact from conversations
    const contact = conversations.find((c) => c.id === incomingCall.from);

    setActiveCall({
      userId,
      peerId: incomingCall.from,
      channel: incomingCall.channel,
      isInitiator: false,
      callType: incomingCall.callType || "video", // Default to video if not specified
      localUserName: userId, // You can get actual name from user profile if available
      peerName: contact?.name || incomingCall.from,
      peerAvatar: contact?.avatar,
    });
    setIncomingCall(null);
  };

  // Handle reject call
  const handleRejectCall = () => {
    setIncomingCall(null);
  };

  // Handle end call
  const handleEndCall = async (callInfo = null) => {
    // If call info is provided and both users were connected, send call end message
    if (
      callInfo &&
      callInfo.bothUsersConnected &&
      callInfo.duration > 0 &&
      activeCall
    ) {
      try {
        // Send call end message with duration
        const callEndMessage = JSON.stringify({
          type: "call",
          callType: activeCall.callType || "video",
          channel: activeCall.channel,
          from: userId,
          to: activeCall.peerId,
          action: "end",
          duration: callInfo.duration, // Duration in seconds
        });

        // Send the call end message
        await handleSendMessage(callEndMessage);

        addLog(`Call ended. Duration: ${callInfo.duration}s`);
      } catch (error) {
        console.error("Error sending call end message:", error);
        addLog(`Failed to send call end message: ${error.message}`);
      }
    }

    // Clear call state
    setActiveCall(null);
    setIncomingCall(null);
    // Clear any call message that might be in the input box
    setMessage("");
  };

  // Helper function to generate preview from a formatted message object
  const generatePreviewFromMessage = (formattedMsg) => {
    if (!formattedMsg) return "";

    // Handle different message types
    if (formattedMsg.messageType === "image") {
      return "Photo";
    } else if (formattedMsg.messageType === "file") {
      return formattedMsg.fileName ? `📎 ${formattedMsg.fileName}` : "File";
    } else if (formattedMsg.messageType === "audio") {
      return "Audio";
    } else if (formattedMsg.messageType === "call") {
      return `${formattedMsg.callType === "video" ? "Video" : "Audio"} call`;
    } else if (formattedMsg.messageType === "text") {
      // For text messages, try to parse if it's JSON (custom message)
      try {
        const parsed = JSON.parse(formattedMsg.content);
        if (parsed && typeof parsed === "object" && parsed.type) {
          const t = String(parsed.type).toLowerCase();
          if (t === "image") return "Photo";
          if (t === "file")
            return parsed.fileName ? `📎 ${parsed.fileName}` : "File";
          if (t === "audio") return "Audio";
          if (t === "meal_plan_updated") return "Meal plan updated";
          if (t === "new_nutritionist" || t === "new_nutrionist")
            return "New nutritionist assigned";
          if (t === "products") return "Products";
          if (t === "call")
            return `${parsed.callType === "video" ? "Video" : "Audio"} call`;
        }
      } catch {
        // Not JSON, use content as-is
      }
      return formattedMsg.content || "";
    }

    // Fallback
    return formattedMsg.content || "Message";
  };

  // Function to update conversation's last message from history
  const updateLastMessageFromHistory = (peerId, formattedMsg) => {
    if (!peerId || !formattedMsg) return;

    const preview = generatePreviewFromMessage(formattedMsg);
    const timestamp = formattedMsg.createdAt
      ? new Date(formattedMsg.createdAt)
      : new Date();
    const lastMessageFrom = formattedMsg.sender || formattedMsg.from || peerId;

    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.id !== peerId) return conv;

        // Only update if history message is more recent than existing last message
        // or if there's no existing last message
        const existingTimestamp = conv.timestamp
          ? new Date(conv.timestamp)
          : null;
        const shouldUpdate =
          !existingTimestamp ||
          timestamp.getTime() >= existingTimestamp.getTime();

        if (shouldUpdate) {
          return {
            ...conv,
            lastMessage: preview,
            timestamp: timestamp,
            lastMessageFrom: lastMessageFrom,
          };
        }
        return conv;
      })
    );
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

      // Prepare ext properties with sender info
      const extProperties = {
        senderName: coachInfo.name || userId,
        senderProfile: coachInfo.profilePhoto || config.defaults.avatar,
        isFromUser: false,
      };

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
          ext: extProperties,
        };
      } else {
        // Plain text message
        options = {
          chatType: "singleChat",
          type: "txt",
          to: peerId,
          msg: messageToSend,
          ext: extProperties,
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
            parsedPayload.callType === "video" ? "Video" : "Audio"
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

  // Show call interface if there's an active call
  if (activeCall) {
    return (
      <div className="app-container">
        <CallApp
          userId={activeCall.userId}
          peerId={activeCall.peerId}
          channel={activeCall.channel}
          isInitiator={activeCall.isInitiator}
          onEndCall={handleEndCall}
          isAudioCall={activeCall.callType === "audio"}
          localUserName={activeCall.localUserName}
          peerName={activeCall.peerName}
          peerAvatar={activeCall.peerAvatar}
        />
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Call Notification */}
      {/* {incomingCall && (
        <CallNotification
          from={incomingCall.from}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )} */}
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
                onInitiateCall={handleInitiateCall}
                onUpdateLastMessageFromHistory={updateLastMessageFromHistory}
                coachInfo={coachInfo}
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
            <UserDetails
              selectedContact={selectedContact}
              userId={userId}
              peerId={peerId}
              onSend={handleSendMessage}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatApp;

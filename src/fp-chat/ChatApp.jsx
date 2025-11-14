import { useEffect, useState, useRef } from "react";
import "./ChatApp.css";
import Header from "./components/Header.jsx";
import AuthForm from "./components/AuthForm.jsx";
import ConversationList from "./components/ConversationList.jsx";
import ChatInterface from "./components/ChatInterface.jsx";
import LogPanel from "./components/LogPanel.jsx";
import UserDetails from "./components/UserDetails.jsx";
import CallApp from "../fp-call/CallApp.jsx";
import CallNotification from "./components/CallNotification.jsx";
import AgoraChat from "agora-chat";
import { useChatClient } from "./hooks/useChatClient.js";
import config from "../common/config.js";
import { buildCustomExts } from "./utils/buildCustomExts.js";
import { createMessageHandlers } from "./utils/messageHandlers.js";

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
  const [filterType, setFilterType] = useState("all"); // "all", "pending_customer", "pending_doctor"

  // Call state management
  const [activeCall, setActiveCall] = useState(null); // { userId, peerId, channel, isInitiator }
  const [incomingCall, setIncomingCall] = useState(null); // { from, channel, callId }

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

  // Initialize sample data for testing when user logs in
  useEffect(() => {
    if (isLoggedIn && conversations.length === 0) {
      const sampleUsers = [
        {
          id: "1234567", // Agora ID
          name: "John Doe",
          contryCode: "+91",
          contactNo: "9123456789",
          fitpassId: "FP001",
          type: "Nutritionist",
          lastMessage: "Hello, I need help with my fitness plan",
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          avatar:
            "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face",
        },
        {
          id: "7654321", // Agora ID
          name: "Jane Smith",
          contryCode: "+91",
          contactNo: "9123456789",
          fitpassId: "FP002",
          type: "Customer",
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
          avatar:
            "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=40&h=40&fit=crop&crop=face",
        },
        {
          id: "123456", // Agora ID
          name: "Mike Johnson",
          contryCode: "+91",
          contactNo: "8696012345",
          fitpassId: "FP003",
          type: "Customer",
          timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          avatar:
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face",
        },
        {
          id: "1230045", // Agora ID
          name: "Sarah Williams",
          contryCode: "+91",
          contactNo: "1234567890",
          fitpassId: "FP004",
          type: "Nutritionist",
          timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
          avatar:
            "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face",
        },
        {
          id: "3210054", // Agora ID
          name: "David Brown",
          contryCode: "+91",
          contactNo: "9876543210",
          fitpassId: "FP005",
          type: "Customer",
          timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          avatar:
            "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=40&h=40&fit=crop&crop=face",
        },
      ];
      setConversations(sampleUsers);
      addLog("Sample test data loaded: 5 users");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, conversations.length, userId]);

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

  // Handle video call initiation
  const handleInitiateCall = async () => {
    if (!peerId || !userId) {
      addLog("Cannot initiate call: Missing user or peer ID");
      return;
    }

    // Generate a unique channel name for this call
    const channel = `call-${userId}-${peerId}-${Date.now()}`;

    // Send a custom message to notify the other user
    const callMessage = JSON.stringify({
      type: "call",
      callType: "video",
      channel: channel,
      from: userId,
      to: peerId,
      action: "initiate",
    });

    try {
      // Send call notification message
      await handleSendMessage(callMessage);

      // Set active call state
      setActiveCall({
        userId,
        peerId,
        channel,
        isInitiator: true,
        localUserName: userId, // You can get actual name from user profile if available
        peerName: selectedContact?.name || peerId,
        peerAvatar: selectedContact?.avatar,
      });

      addLog(`Initiating video call with ${peerId}`);
    } catch (error) {
      console.error("Error initiating call:", error);
      addLog(`Failed to initiate call: ${error.message}`);
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
  const handleEndCall = () => {
    setActiveCall(null);
    setIncomingCall(null);
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
      return `${formattedMsg.callType === "video" ? "Video" : "Voice"} call`;
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
            return `${parsed.callType === "video" ? "Video" : "Voice"} call`;
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
      {incomingCall && (
        <CallNotification
          from={incomingCall.from}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}
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

export default ChatApp;

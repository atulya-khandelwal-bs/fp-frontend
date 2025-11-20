import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { Smile, Video } from "lucide-react";
import "emoji-picker-element"; // Import once to register the <emoji-picker> tag
import config from "../../common/config.js";
import ChatHeader from "./ChatHeader";
import ChatTab from "./ChatTab";
import InfoTab from "./InfoTab";
import DescriptionTab from "./DescriptionTab";

export default function ChatInterface({
  userId,
  peerId,
  setPeerId,
  message,
  setMessage,
  onSend,
  onLogout,
  logs,
  selectedContact,
  chatClient,
  onBackToConversations,
  onInitiateCall,
  onUpdateLastMessageFromHistory,
  coachInfo = { name: "", profilePhoto: "" },
}) {
  const [activeTab, setActiveTab] = useState("Chat");
  const [messages, setMessages] = useState([]);
  const [showMediaPopup, setShowMediaPopup] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDemoMenu, setShowDemoMenu] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [showCameraCapture, setShowCameraCapture] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const [imageViewerUrl, setImageViewerUrl] = useState("");
  const [imageViewerAlt, setImageViewerAlt] = useState("");
  const chatAreaRef = useRef(null);
  const mediaPopupRef = useRef(null);
  const demoMenuRef = useRef(null);
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const audioStreamRef = useRef(null);
  const recordingStartTimeRef = useRef(null); // Track when recording started
  const recordingDurationRef = useRef(0); // Track duration in a ref for accurate reading
  const shouldSendRecordingRef = useRef(true);
  const [inputResetKey, setInputResetKey] = useState(0);
  const inputRef = useRef(null);
  const prevMessageRef = useRef("");
  const currentlyPlayingAudioRef = useRef(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const chatClientRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const buttonRef = useRef(null);
  const audioBtnRef = useRef(null);
  const fetchedPeersRef = useRef({
    fetchedPeers: new Set(), // Track which peers we've already fetched history for
    currentPeer: null, // Track the current peer to detect changes
  });
  const isLoadingHistoryRef = useRef(false);
  const skipAutoScrollRef = useRef(false);

  const toggleEmojiPicker = () => {
    setShowEmojiPicker((prev) => !prev);
  };

  // Helper: label for day headers (Today / Yesterday / formatted date)
  const formatDateLabel = (date) => {
    const now = new Date();
    const startOfDay = (d) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayMs = 24 * 60 * 60 * 1000;
    const diffDays = Math.floor(
      (startOfDay(now).getTime() - startOfDay(date).getTime()) / dayMs
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  // Currency formatter (INR by default to match the sample UI)
  const formatCurrency = (value, currency = "INR", locale = "en-IN") => {
    if (value == null || isNaN(value)) return "";
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      const prefix = currency === "INR" ? "₹" : "";
      return `${prefix}${Math.round(Number(value))}`;
    }
  };

  // Helper: detect and normalize backend system payloads
  const parseSystemPayload = (rawContent) => {
    try {
      const obj = JSON.parse(rawContent);
      if (!obj || typeof obj !== "object" || !obj.type) return null;
      const normalizedType = String(obj.type).toLowerCase();
      if (
        normalizedType === "meal_plan_updated" ||
        normalizedType === "mealplanupdated" ||
        normalizedType === "meal_plan_update"
      ) {
        return { kind: "meal_plan_updated", payload: obj };
      }
      if (
        normalizedType === "new_nutritionist" ||
        normalizedType === "newnutritionist" ||
        normalizedType === "new_nutritionist_assigned"
      ) {
        return { kind: "new_nutritionist", payload: obj };
      }
      return null;
    } catch {
      return null;
    }
  };

  // Detect draft attachment from the current input message (JSON with type and url)
  // Note: audio messages are not shown as draft attachments, they are sent immediately
  const parseDraftAttachment = (raw) => {
    if (!raw || typeof raw !== "string" || raw.trim() === "") return null;
    try {
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object" || !obj.type) return null;
      const t = String(obj.type).toLowerCase();
      // Show draft for image, file, and audio
      if ((t === "image" || t === "file" || t === "audio") && obj.url) {
        return {
          type: t,
          url: obj.url,
          fileName: obj.fileName || "attachment",
          mimeType:
            obj.mimeType ||
            (t === "image"
              ? "image/*"
              : t === "audio"
              ? "audio/*"
              : "application/octet-stream"),
          size: obj.size ?? null,
          duration: obj.duration ?? null,
          // Include duration for audio
        };
      }
    } catch {}
    return null;
  };

  const draftAttachment = parseDraftAttachment(message);

  const clearDraftAttachment = () => {
    try {
      const att = parseDraftAttachment(message);
      if (att && typeof att.url === "string" && att.url.startsWith("blob:")) {
        URL.revokeObjectURL(att.url);
      }
    } catch {}
    setSelectedMedia(null);
    setMessage("");
  };

  const getDraftCaption = () => {
    if (!draftAttachment) return "";
    // For audio, don't show caption in input - the preview handles it
    if (draftAttachment.type === "audio") {
      return "";
    }
    try {
      const obj = JSON.parse(message);
      return obj.caption || obj.body || "";
    } catch {
      return "";
    }
  };

  // Helper: label text for system payload cards
  const getSystemLabel = (system) => {
    if (!system) return "";
    switch (system.kind) {
      case "meal_plan_updated":
        return "Meal plan updated";
      case "new_nutritionist":
        return "New nutritionist assigned";
      default:
        return "System message";
    }
  };

  useEffect(() => {
    const chatArea = chatAreaRef.current;
    if (!chatArea) return;

    const handleScroll = () => {
      if (chatArea.scrollTop === 0 && !isFetchingHistory && hasMore) {
        fetchMoreMessages();
      }
    };

    chatArea.addEventListener("scroll", handleScroll);
    return () => chatArea.removeEventListener("scroll", handleScroll);
  }, [peerId, isFetchingHistory, hasMore, cursor]);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  };

  // Convert logs to message format
  useEffect(() => {
    if (!peerId) {
      setMessages([]);
      return;
    }

    // Create a simple hash function for log content
    const hashLog = (log) => {
      let hash = 0;
      for (let i = 0; i < log.length; i++) {
        const char = log.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return Math.abs(hash);
    };

    // Find the index of each log entry and create a unique identifier
    // Handle both old format (string) and new format (object with log and timestamp)
    const logEntries = logs.map((logEntry, logIndex) => {
      const log = typeof logEntry === "string" ? logEntry : logEntry.log;
      // For log entries that are strings, we can't determine the actual timestamp
      // They will be replaced by server messages when history is fetched
      // For now, use current time but this will be corrected when messages are fetched from server
      const timestamp =
        typeof logEntry === "string"
          ? new Date() // Will be replaced by server timestamp when history is fetched
          : logEntry.timestamp || new Date();
      return {
        log,
        timestamp,
        logIndex,
        logHash: hashLog(log), // Create hash of entire log for stable ID
      };
    });

    const filteredLogs = logEntries.filter((entry) => {
      const { log } = entry;
      // Filter messages for the current conversation
      if (log.includes("→")) {
        // Outgoing message: "You → peerId: message"
        const match = log.match(/You → ([^:]+):/);
        return match && match[1].trim() === peerId;
      } else if (log.includes(":")) {
        // Incoming message: "senderId: message"
        const parts = log.split(":");
        const senderId = parts[0].trim();
        // Only show messages from the current peer
        return senderId === peerId;
      }
      return false;
    });

    const newMessages = filteredLogs
      .map(({ log, logHash, logIndex, timestamp }) => {
        const isOutgoing = log.includes("→");
        const messageTime =
          timestamp instanceof Date ? timestamp : new Date(timestamp);
        // Create a unique timestamp to ensure consecutive duplicate messages have different IDs
        // Use logHash + logIndex for stable IDs that don't change across re-renders
        // This ensures the same log entry always gets the same ID
        const uniqueTimestamp = logHash + logIndex;

        if (isOutgoing) {
          // Parse "You → peerId: message"
          const match = log.match(/You → [^:]+: (.+)/);
          const content = match ? match[1].trim() : "";

          // Parse special message formats (IMAGE_DATA, FILE_DATA, or backend JSON)
          let messageContent = content;
          let messageType = "text";
          let imageData = null;
          let fileName = null;
          let fileSize = null;
          let imageUrl = null;
          let audioUrl = null;
          let audioDurationMs = null;
          let audioTranscription = null;
          let fileUrl = null;
          let fileMime = null;
          let fileSizeBytes = null;
          let products = null;
          let callType = null;
          let callDurationSeconds = null;
          let callChannel = null;
          let system = null;

          if (content.startsWith("IMAGE_DATA:")) {
            const imageParts = content.split(":");
            if (imageParts.length >= 3) {
              imageData = imageParts[1];
              fileName = imageParts.slice(2).join(":");
              messageType = "image";
              messageContent = fileName;
            }
          } else if (content.startsWith("FILE_DATA:")) {
            const fileParts = content.split(":");
            if (fileParts.length >= 4) {
              imageData = fileParts[1];
              fileName = fileParts[2];
              fileSize = fileParts[3];
              messageType = "file";
              messageContent = `📎 ${fileName} (${fileSize} KB)`;
            }
          } else {
            // Try backend JSON payloads → else system → else text
            try {
              const obj = JSON.parse(content);

              if (obj && typeof obj === "object" && obj.type) {
                const t = String(obj.type).toLowerCase();
                // skip system messages coming from logs to avoid duplicates
                // ---- IGNORE HEALTH COACH CHANGED MESSAGES ----
                if (t === "mealPlanUpdate" || t === "healthCoachChanged") {
                  return null; // <-- This ensures UI never displays it
                }

                switch (t) {
                  case "text":
                    messageType = "text";
                    messageContent = obj.body ?? "";
                    break;
                  case "image":
                    messageType = "image";
                    imageUrl = obj.url ?? null;
                    messageContent = obj.url ?? "Image";
                    fileName = obj.fileName ?? null;
                    break;
                  case "audio":
                    messageType = "audio";
                    audioUrl = obj.url ?? null;
                    audioDurationMs = obj.duration ?? null;
                    audioTranscription = obj.transcription ?? null;
                    messageContent = "Audio message";
                    break;
                  case "file":
                    messageType = "file";
                    fileUrl = obj.url ?? null;
                    fileMime = obj.mimeType ?? null;
                    fileSizeBytes = obj.size ?? null;
                    try {
                      const urlObj = new URL(obj.url);
                      fileName = decodeURIComponent(
                        urlObj.pathname.split("/").pop() || "file"
                      );
                    } catch {
                      fileName = obj.fileName || obj.url || "file";
                    }
                    messageContent = `📎 ${fileName}`;
                    break;
                  case "products":
                    messageType = "products";
                    products = Array.isArray(obj.products) ? obj.products : [];
                    messageContent = "Products";
                    break;
                  case "new_nutritionist":
                  case "new_nutrionist":
                    messageType = "system";
                    system = {
                      kind: "new_nutritionist",
                      id: obj.id || "",
                      name: obj.name || "",
                      title: obj.title || "",
                      profilePhoto: obj.profilePhoto || "",
                    };
                    messageContent = "New nutritionist assigned";
                    break;
                  case "meal_plan_updated":
                    messageType = "system";
                    system = { kind: "meal_plan_updated" };
                    messageContent = "Meal plan updated";
                    break;
                  case "call":
                    const isLatestCall =
                      logIndex ===
                      Math.max(...filteredLogs.map((f) => f.logIndex));

                    if (!isLatestCall) {
                      return null;
                    }
                    // Only show call messages if:
                    // It's an end action with duration > 0 (both users connected)
                    // Hide initiate messages - they will only appear after call ends with both users
                    // If only nutritionist or only client was in call, do NOT show the message
                    if (obj.action === "initiate") {
                      // Don't show initiate messages immediately
                      messageType = "hidden"; // Mark as hidden, will be filtered out
                      break;
                    }
                    if (
                      obj.action === "end" &&
                      (!obj.duration || obj.duration <= 0)
                    ) {
                      // Don't show call end message if no duration or duration <= 0
                      // This means only one user (nutritionist or client) was in the call
                      messageType = "hidden"; // Mark as hidden, will be filtered out
                      break;
                    }
                    messageType = "call";
                    callType = obj.callType || "video";
                    callDurationSeconds = obj.duration ?? null;
                    callChannel = obj.channel || null;
                    messageContent = `${
                      callType === "video" ? "Video" : "Audio"
                    } call`;
                    break;
                  default: {
                    const parsed = parseSystemPayload(content);
                    if (parsed) {
                      if (
                        parsed.kind === "new_nutritionist" &&
                        parsed.payload
                      ) {
                        // Extract nutritionist data from payload
                        system = {
                          kind: "new_nutritionist",
                          id: parsed.payload.id || "",
                          name: parsed.payload.name || "",
                          title: parsed.payload.title || "",
                          profilePhoto: parsed.payload.profilePhoto || "",
                        };
                      } else {
                        system = parsed;
                      }
                      messageType = "system";
                      messageContent = getSystemLabel(parsed);
                    }
                  }
                }
              }
            } catch {
              // not JSON -> keep as text
            }
          }

          // Filter out hidden call messages (only one user joined)
          if (messageType === "hidden") {
            return null;
          }

          const generatedId = `outgoing-${peerId}-${logHash}-${logIndex}-${uniqueTimestamp}`;

          // Console log for video call message ID from logs

          return {
            id: generatedId, // Include logIndex and timestamp to ensure unique IDs for consecutive duplicate messages
            sender: "You",
            content: messageContent,
            imageData,
            imageUrl,
            fileName,
            fileSize,
            messageType,
            system,
            audioUrl,
            audioDurationMs,
            audioTranscription,
            fileUrl,
            fileMime,
            fileSizeBytes,
            products,
            callType,
            callDurationSeconds,
            channel: callChannel,
            createdAt: messageTime,
            timestamp: messageTime.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            isIncoming: false, // Outgoing message - right side
            avatar: coachInfo?.profilePhoto || config.defaults.userAvatar,
            peerId, // Store peerId for conversation tracking
          };
        } else {
          // Parse "senderId: message"
          const parts = log.split(":");
          const sender = parts[0].trim();
          const content = parts.slice(1).join(":").trim();

          // Parse special message formats (IMAGE_DATA, FILE_DATA) or backend JSON payloads
          let messageContent = content;
          let messageType = "text";
          let imageData = null;
          let fileName = null;
          let fileSize = null;
          let imageUrl = null;
          let audioUrl = null;
          let audioDurationMs = null;
          let audioTranscription = null;
          let fileUrl = null;
          let fileMime = null;
          let fileSizeBytes = null;
          let products = null;
          let callType = null;
          let callDurationSeconds = null;
          let callChannel = null;
          let system = null;

          if (content.startsWith("IMAGE_DATA:")) {
            const imageParts = content.split(":");
            if (imageParts.length >= 3) {
              imageData = imageParts[1];
              fileName = imageParts.slice(2).join(":");
              messageType = "image";
              messageContent = fileName;
            }
          } else if (content.startsWith("FILE_DATA:")) {
            const fileParts = content.split(":");
            if (fileParts.length >= 4) {
              imageData = fileParts[1];
              fileName = fileParts[2];
              fileSize = fileParts[3];
              messageType = "file";
              messageContent = `📎 ${fileName} (${fileSize} KB)`;
            }
          } else {
            // Try backend JSON payloads → else system → else text
            try {
              const obj = JSON.parse(content);

              if (obj && typeof obj === "object" && obj.type) {
                const t = String(obj.type).toLowerCase();
                // skip system messages coming from logs to avoid duplicates
                // ---- IGNORE HEALTH COACH CHANGED MESSAGES ----
                if (t === "mealPlanUpdate" || t === "healthCoachChanged") {
                  return null; // <-- This ensures UI never displays it
                }

                switch (t) {
                  case "text":
                    messageType = "text";
                    messageContent = obj.body ?? "";
                    break;
                  case "image":
                    messageType = "image";
                    imageUrl = obj.url ?? null;
                    messageContent = obj.url ?? "Image";
                    break;
                  case "audio":
                    messageType = "audio";
                    audioUrl = obj.url ?? null;
                    audioDurationMs = obj.duration ?? null;
                    audioTranscription = obj.transcription ?? null;
                    messageContent = "Audio message";
                    break;
                  case "file":
                    messageType = "file";
                    fileUrl = obj.url ?? null;
                    fileMime = obj.mimeType ?? null;
                    fileSizeBytes = obj.size ?? null;
                    try {
                      const urlObj = new URL(obj.url);
                      fileName = decodeURIComponent(
                        urlObj.pathname.split("/").pop() || "file"
                      );
                    } catch {
                      fileName = obj.url ?? "file";
                    }
                    messageContent = `📎 ${fileName}`;
                    break;
                  case "products":
                    messageType = "products";
                    products = Array.isArray(obj.products) ? obj.products : [];
                    messageContent = "Products";
                    break;
                  case "call":
                    const isLatestCall =
                      logIndex ===
                      Math.max(...filteredLogs.map((f) => f.logIndex));

                    if (!isLatestCall) {
                      return null;
                    }
                    // Only show call messages if:
                    // It's an end action with duration > 0 (both users connected)
                    // Hide initiate messages - they will only appear after call ends with both users
                    // If only nutritionist or only client was in call, do NOT show the message
                    if (obj.action === "initiate") {
                      // Don't show initiate messages immediately
                      messageType = "hidden"; // Mark as hidden, will be filtered out
                      break;
                    }
                    if (
                      obj.action === "end" &&
                      (!obj.duration || obj.duration <= 0)
                    ) {
                      // Don't show call end message if no duration or duration <= 0
                      // This means only one user (nutritionist or client) was in the call
                      messageType = "hidden"; // Mark as hidden, will be filtered out
                      break;
                    }
                    messageType = "call";
                    callType = obj.callType || "video";
                    callDurationSeconds = obj.duration ?? null;
                    callChannel = obj.channel || null;
                    messageContent = `${
                      callType === "video" ? "Video" : "Audio"
                    } call`;
                    break;
                  default: {
                    const parsed = parseSystemPayload(content);
                    if (parsed) {
                      if (
                        parsed.kind === "new_nutritionist" &&
                        parsed.payload
                      ) {
                        // Extract nutritionist data from payload
                        system = {
                          kind: "new_nutritionist",
                          id: parsed.payload.id || "",
                          name: parsed.payload.name || "",
                          title: parsed.payload.title || "",
                          profilePhoto: parsed.payload.profilePhoto || "",
                        };
                      } else {
                        system = parsed;
                      }
                      messageType = "system";
                      messageContent = getSystemLabel(parsed);
                    }
                  }
                }
              }
            } catch {
              // not JSON -> keep as text
            }
          }

          // Filter out hidden call messages (only one user joined)
          if (messageType === "hidden") {
            return null;
          }

          const generatedId = `incoming-${peerId}-${logHash}-${logIndex}-${uniqueTimestamp}`;

          // Console log for video call message ID from logs

          return {
            id: generatedId, // Include logIndex and timestamp to ensure unique IDs for consecutive duplicate messages
            sender,
            content: messageContent,
            imageData,
            imageUrl,
            fileName,
            fileSize,
            messageType,
            system,
            audioUrl,
            audioDurationMs,
            audioTranscription,
            fileUrl,
            fileMime,
            fileSizeBytes,
            products,
            callType,
            callDurationSeconds,
            channel: callChannel,
            createdAt: messageTime,
            timestamp: messageTime.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            isIncoming: true, // Incoming message - left side
            avatar: selectedContact?.avatar || config.defaults.avatar,
            peerId, // Store peerId for conversation tracking
          };
        }
      })
      .filter((msg) => msg !== null); // Filter out null messages (hidden call messages)

    // Only show messages for the current conversation (peerId)
    setMessages((prev) => {
      // If peerId changed, reset messages for the new conversation

      const currentPeerMessages = prev.filter((msg) => msg.peerId === peerId);

      // Create a set of existing message IDs to prevent duplicates
      const existingIds = new Set(currentPeerMessages.map((msg) => msg.id));

      // Helper function to create matching key (same as in server fetch)
      const normalizeContent = (content) => {
        if (!content) return "";
        try {
          const parsed = JSON.parse(content);
          return JSON.stringify(parsed);
        } catch {
          return String(content).trim();
        }
      };

      const createMatchKey = (msg) => {
        const normalizedContent = normalizeContent(msg.content);
        const timeWindow = Math.floor(
          new Date(msg.createdAt).getTime() / 300000
        ); // 5-minute window

        // For custom messages, include messageType and identifying fields in the key
        if (msg.messageType && msg.messageType !== "text") {
          let customKey = "";

          // Try to extract from message fields first
          if (msg.messageType === "image" && msg.imageUrl) {
            customKey = msg.imageUrl;
          } else if (msg.messageType === "audio" && msg.audioUrl) {
            customKey = msg.audioUrl;
          } else if (msg.messageType === "file" && msg.fileUrl) {
            customKey = msg.fileUrl;
          } else if (msg.messageType === "call") {
            // For call messages, use content-based matching (not ID) so log and server messages match
            // Extract action and duration from message object or content
            let callAction = msg.callAction || "";
            let callDuration =
              msg.callDurationSeconds != null
                ? String(msg.callDurationSeconds)
                : "";
            let callType = msg.callType || "video";
            let callChannel = msg.channel || "";

            // If fields not on message object, try to extract from content
            if (
              (!callAction || !callChannel) &&
              typeof msg.content === "string"
            ) {
              try {
                const contentObj = JSON.parse(msg.content);
                if (contentObj && typeof contentObj === "object") {
                  if (contentObj.action) callAction = contentObj.action;
                  if (contentObj.duration != null)
                    callDuration = String(contentObj.duration);
                  if (contentObj.callType) callType = contentObj.callType;
                  if (contentObj.channel) callChannel = contentObj.channel;
                }
              } catch {}
            }

            // Use content-based key with timestamp in 2-second window to match log/server messages
            // This allows log and server messages of the same call to match
            // But different calls (different durations or times > 2s apart) won't match
            const timestampSeconds = Math.floor(
              new Date(msg.createdAt).getTime() / 2000
            );
            customKey = `${callType}-${callChannel}-${callAction}-${callDuration}-${timestampSeconds}`;
          } else if (msg.messageType === "products" && msg.products) {
            // For products, use the first product ID
            customKey = msg.products[0]?.id || "";
          }

          // If customKey is still empty, try to extract from content JSON
          if (!customKey && typeof msg.content === "string") {
            try {
              const contentObj = JSON.parse(msg.content);
              if (contentObj && typeof contentObj === "object") {
                if (msg.messageType === "image" && contentObj.url) {
                  customKey = contentObj.url;
                } else if (msg.messageType === "audio" && contentObj.url) {
                  customKey = contentObj.url;
                } else if (msg.messageType === "file" && contentObj.url) {
                  customKey = contentObj.url;
                } else if (msg.messageType === "call") {
                  // For call messages from content, use content-based matching
                  const callAction = contentObj.action || "";
                  const callDuration =
                    contentObj.duration != null
                      ? String(contentObj.duration)
                      : "";
                  const callType = contentObj.callType || "video";
                  const callChannel = contentObj.channel || "";
                  // Use content-based key with 2-second timestamp window
                  const timestampSeconds = Math.floor(
                    new Date(msg.createdAt).getTime() / 2000
                  );
                  customKey = `${callType}-${callChannel}-${callAction}-${callDuration}-${timestampSeconds}`;
                } else if (msg.messageType === "products") {
                  // Handle both array and stringified products formats
                  let productsArray = [];
                  if (Array.isArray(contentObj.products)) {
                    productsArray = contentObj.products;
                  } else if (typeof contentObj.products === "string") {
                    try {
                      const parsed = JSON.parse(contentObj.products);
                      productsArray = Array.isArray(parsed) ? parsed : [];
                    } catch {
                      productsArray = [];
                    }
                  }
                  // Use the first product ID as the key
                  customKey = productsArray[0]?.id || "";
                }
              }
            } catch {
              // Not JSON, ignore
            }
          }

          if (customKey) {
            // For call messages, don't use timeWindow since customKey already includes timestamp
            // Use only messageType, customKey, and sender
            if (msg.messageType === "call") {
              return `${msg.messageType}-${customKey}-${msg.sender}`;
            }
            return `${msg.messageType}-${customKey}-${msg.sender}-${timeWindow}`;
          }

          // For system messages (meal_plan_updated, new_nutritionist, etc.), use timestamp to allow duplicates
          if (msg.messageType === "system" && msg.system) {
            // Use a more granular timestamp (1-second window) to allow multiple system messages
            const timestampSeconds = Math.floor(
              new Date(msg.createdAt).getTime() / 1000
            );
            const systemKind = msg.system.kind || "";
            return `${msg.messageType}-${systemKind}-${msg.sender}-${timestampSeconds}`;
          }
        }

        // Fallback to content-based matching for text and other messages
        return `${normalizedContent}-${msg.sender}-${timeWindow}`;
      };

      // Create a map of existing messages by their match key
      const existingMessagesByKey = new Map();
      currentPeerMessages.forEach((msg) => {
        const key = createMatchKey(msg);
        if (!existingMessagesByKey.has(key)) {
          existingMessagesByKey.set(key, msg);
        }
      });

      // Filter out messages that match existing messages by content/key (not just ID)
      // This prevents duplicates when server messages already exist
      const uniqueNewMessages = newMessages.filter((msg) => {
        // First check by ID (for exact duplicates)
        if (existingIds.has(msg.id)) {
          return false;
        }
        // Then check by content/key (to match with server messages that have different IDs)
        const key = createMatchKey(msg);
        const existingMsg = existingMessagesByKey.get(key);
        if (existingMsg) {
          // If a match key exists, prefer server messages over log messages
          // Server messages have IDs that don't start with "outgoing-" or "incoming-"
          const isExistingServerMsg =
            !existingMsg.id.startsWith("outgoing-") &&
            !existingMsg.id.startsWith("incoming-");
          const isNewLogMsg =
            msg.id.startsWith("outgoing-") || msg.id.startsWith("incoming-");
          const isNewServerMsg =
            !msg.id.startsWith("outgoing-") && !msg.id.startsWith("incoming-");

          // If existing is server and new is log, filter out the new log message
          if (isExistingServerMsg && isNewLogMsg) {
            return false;
          }
          // If existing is log and new is server, keep the server message
          // The log message will be replaced in the merge step below
          if (!isExistingServerMsg && isNewServerMsg) {
            return true; // Keep server message, log message will be removed in merge
          }
          // If both are log messages, filter out the new one (keep the first)
          if (!isExistingServerMsg && isNewLogMsg) {
            return false;
          }
          // If both are server messages with same key, filter out the new one
          if (isExistingServerMsg && isNewServerMsg) {
            return false;
          }
        }
        return true;
      });

      // If no new unique messages, return existing state
      if (uniqueNewMessages.length === 0) {
        return prev;
      }

      // If no existing messages for this peer, return new messages
      if (currentPeerMessages.length === 0) {
        return uniqueNewMessages;
      }

      // Merge: keep existing messages for this peer + add new unique ones
      // First, collect all server messages and their match keys
      const allMessagesTemp = [
        ...currentPeerMessages,
        ...uniqueNewMessages,
      ].filter((msg) => msg !== null && msg.createdAt); // Filter out null messages and messages without createdAt

      const serverMessageKeys = new Set();
      allMessagesTemp.forEach((msg) => {
        const isServerMsg =
          !msg.id.startsWith("outgoing-") && !msg.id.startsWith("incoming-");
        if (isServerMsg) {
          const key = createMatchKey(msg);
          serverMessageKeys.add(key);
        }
      });

      // Sort by logIndex to maintain chronological order
      const allMessages = allMessagesTemp
        .filter((msg, index, self) => {
          // Remove duplicates by ID (first check)
          const idIndex = self.findIndex((m) => m.id === msg.id);
          if (idIndex !== index) {
            return false;
          }
          // Also check by match key to catch any remaining duplicates
          const key = createMatchKey(msg);
          const isLogMsg =
            msg.id.startsWith("outgoing-") || msg.id.startsWith("incoming-");

          // If this is a log message and we have a server message with the same key, filter it out
          if (isLogMsg && serverMessageKeys.has(key)) {
            return false;
          }

          // Remove other duplicates by match key (keep first occurrence)
          const keyIndex = self.findIndex((m) => createMatchKey(m) === key);
          if (keyIndex !== index) {
            return false;
          }

          return true;
        })
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      // Return merged messages along with messages from other peers
      const otherPeerMessages = prev.filter((msg) => msg.peerId !== peerId);
      return [...otherPeerMessages, ...allMessages];
    });
  }, [logs, peerId, selectedContact]);

  // Sync chatClient prop to ref
  useEffect(() => {
    chatClientRef.current = chatClient;
  }, [chatClient]);

  // Fetch last 20 messages whenever peer changes (only once per peer)
  useEffect(() => {
    if (!peerId) return;

    // Get the current peer from the ref to detect changes
    const currentFetchedPeer = fetchedPeersRef.current.currentPeer;

    // If peerId changed, reset the fetched set for the new peer
    if (currentFetchedPeer !== peerId) {
      fetchedPeersRef.current.fetchedPeers = new Set();
      fetchedPeersRef.current.currentPeer = peerId;
      // Reset cursor and hasMore when peer changes
      setCursor(null);
      setHasMore(true);
    }

    // Check if we've already fetched history for this peer
    if (fetchedPeersRef.current.fetchedPeers.has(peerId)) {
      return;
    }

    // Fetch messages from API
    const checkAndFetch = async () => {
      try {
        await fetchInitialMessages();
        // Mark this peer as fetched
        fetchedPeersRef.current.fetchedPeers.add(peerId);
      } catch (err) {
        console.error("Error while fetching:", err);
      }
    };

    checkAndFetch();
  }, [peerId]);

  // Filter messages to only show current conversation when displaying

  const currentConversationMessages = messages.filter(
    (msg) => msg.peerId === peerId
  );

  // Auto-scroll when messages change
  useEffect(() => {
    // 🧠 Prevent auto-scroll during history loading
    if (isLoadingHistoryRef.current || skipAutoScrollRef.current) return;

    const chatArea = chatAreaRef.current;
    if (!chatArea) return;

    // Only scroll if the user is near the bottom
    const isNearBottom =
      chatArea.scrollHeight - chatArea.scrollTop - chatArea.clientHeight < 100;

    if (isNearBottom) {
      setTimeout(() => scrollToBottom(), 50);
    }
  }, [currentConversationMessages]);

  // Reset input key when peer changes to ensure clean state
  useEffect(() => {
    setInputResetKey(0);
  }, [peerId]);

  // Set up non-passive touch event listener for audio button
  useEffect(() => {
    const audioBtn = audioBtnRef.current;
    if (!audioBtn) return;

    const handleTouchStart = (e) => {
      if (!isRecording && selectedContact) {
        e.preventDefault();
        startAudioRecording();
      }
    };

    // Add event listener with { passive: false } to allow preventDefault
    audioBtn.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });

    return () => {
      audioBtn.removeEventListener("touchstart", handleTouchStart);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, selectedContact]); // startAudioRecording is stable, no need to include

  // Watch for message clearing after send to reset input
  useEffect(() => {
    // Detect when message transitions from non-empty to empty (after sending)
    // This ensures the input remounts AFTER the message is cleared
    const prevMessage = prevMessageRef.current;
    const currentMessage = message || "";

    // If message was non-empty and is now empty, and we have a peer, reset input
    const prevIsEmpty =
      typeof prevMessage === "string" ? prevMessage.trim() : prevMessage;
    const currentIsEmpty =
      typeof currentMessage === "string"
        ? currentMessage.trim()
        : currentMessage;
    if (prevIsEmpty && !currentIsEmpty && peerId) {
      // Message was cleared after send, increment key to remount input
      setInputResetKey((prev) => prev + 1);
    }

    // Update ref for next comparison
    prevMessageRef.current = currentMessage;
  }, [message, peerId]);

  // Restore focus to input after it remounts (when reset key changes)
  useEffect(() => {
    if (inputRef.current && selectedContact) {
      // Small delay to ensure input is fully mounted
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [inputResetKey, selectedContact]);

  const isSendingRef = useRef(false);

  const handleSendMessage = () => {
    // Prevent multiple simultaneous sends
    if (isSendingRef.current) {
      return;
    }

    // Capture the exact message value to send BEFORE any state changes
    const currentMessage = draftAttachment ? getDraftCaption() : message;
    const hasMessage =
      typeof currentMessage === "string"
        ? currentMessage.trim()
        : currentMessage;

    if (!hasMessage && !draftAttachment) {
      return;
    }

    // For draft attachments, we need to send the full JSON payload, not just the caption
    const messageToSend = draftAttachment ? message : currentMessage;

    // Mark as sending immediately to prevent any other sends
    isSendingRef.current = true;

    // Clear the message state immediately to prevent it from being read again
    if (draftAttachment) {
      clearDraftAttachment();
    } else {
      setMessage("");
    }

    // Call onSend with the message value directly to avoid race conditions
    // The parent will use this value instead of reading from the message prop
    onSend(messageToSend);

    // Reset the flag after a delay to allow the send to complete
    setTimeout(() => {
      isSendingRef.current = false;
    }, 500);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  // Demo message samples for testing
  const sendDemoMessage = (type) => {
    if (!peerId) return;

    let demoPayload = {};

    switch (type) {
      case "image":
        demoPayload = {
          type: "image",
          url: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800&h=600&fit=crop",
          fileName: "demo-image.jpg",
          width: 800,
          height: 600,
        };
        break;

      case "audio":
        demoPayload = {
          type: "audio",
          url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
          duration: 30, // seconds
          transcription: "This is a demo audio transcription",
        };
        break;

      case "file":
        demoPayload = {
          type: "file",
          url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
          fileName: "demo-document.pdf",
          mimeType: "application/pdf",
          size: 102400, // bytes
        };
        break;

      case "call":
        demoPayload = {
          type: "call",
          callType: "video",
          channel: `demo-call-${Date.now()}`,
          from: userId,
          to: peerId,
          action: "initiate",
          duration: 0, // Duration in seconds (0 for initiate, actual duration when call ends)
        };
        break;

      case "meal_plan_updated":
        demoPayload = {
          type: "meal_plan_updated",
        };
        break;

      case "new_nutritionist":
        demoPayload = {
          type: "new_nutritionist",
          id: "NUT001",
          name: "Dr. Jane Smith",
          title: "Senior Nutritionist",
          profilePhoto:
            "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face",
        };
        break;

      case "products":
        demoPayload = {
          type: "products",
          products: [
            {
              id: "PROD001",
              name: "Hello Healthy Coffee (South Indian)",
              price: 579,
              originalPrice: 999,
              image:
                "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&h=400&fit=crop",
            },
          ],
        };
        break;

      default:
        return;
    }

    setShowDemoMenu(false);
    setMessage(JSON.stringify(demoPayload));
    // Auto-send after a small delay
    setTimeout(() => {
      onSend(JSON.stringify(demoPayload));
    }, 100);
  };

  // Close media popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        mediaPopupRef.current &&
        !mediaPopupRef.current.contains(event.target) &&
        !event.target.closest(".icon-btn")
      ) {
        setShowMediaPopup(false);
      }
      if (
        demoMenuRef.current &&
        !demoMenuRef.current.contains(event.target) &&
        !event.target.closest(".demo-btn")
      ) {
        setShowDemoMenu(false);
      }
    };

    if (showMediaPopup || showDemoMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showMediaPopup, showDemoMenu]);

  // 👉 Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target) &&
        !buttonRef.current.contains(event.target)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("click", handleClickOutside, true);
    return () =>
      document.removeEventListener("click", handleClickOutside, true);
  }, []);

  // Handle emoji selection and make navigation bar scrollable
  useEffect(() => {
    if (!showEmojiPicker) return;

    let pickerElement = null;
    let handleEmojiSelect = null;

    const setupEmojiPicker = () => {
      // emojiPickerRef points to the container, so we need to find the emoji-picker element
      pickerElement =
        emojiPickerRef.current?.querySelector("emoji-picker") ||
        document.querySelector("emoji-picker.emoji-picker-element");
      if (!pickerElement) return;

      // Add event listener for emoji selection
      // emoji-picker-element fires different events, try multiple
      handleEmojiSelect = (event) => {
        // Try different event structures
        const emoji =
          event.detail?.unicode ||
          event.detail?.emoji ||
          event.detail?.emoji?.unicode ||
          event.detail ||
          event.emoji ||
          event.unicode;

        if (emoji && typeof emoji === "string") {
          setMessage((prev) => prev + emoji);
        }
      };

      // Try multiple event names that emoji-picker-element might use
      pickerElement.addEventListener("emoji-click", handleEmojiSelect);
      pickerElement.addEventListener("emojiClick", handleEmojiSelect);
      pickerElement.addEventListener("change", handleEmojiSelect);

      // Try to access shadow DOM for navigation styling
      const shadowRoot = pickerElement.shadowRoot;
      if (shadowRoot) {
        // Common selectors for navigation in emoji-picker-element
        const navSelectors = [
          "nav",
          ".nav",
          '[part="nav"]',
          ".category-nav",
          ".epr-category-nav",
          ".category-buttons",
          'div[role="tablist"]',
          ".tabs",
        ];

        for (const selector of navSelectors) {
          const navElement = shadowRoot.querySelector(selector);
          if (navElement) {
            navElement.style.overflowX = "auto";
            navElement.style.overflowY = "hidden";
            navElement.style.whiteSpace = "nowrap";
            navElement.style.display = "flex";
            navElement.style.scrollbarWidth = "thin";
            navElement.style.webkitOverflowScrolling = "touch";
            break; // Found and styled, exit
          }
        }

        // Also try to find any horizontal scrollable container
        const allDivs = shadowRoot.querySelectorAll("div");
        allDivs.forEach((div) => {
          const computedStyle = window.getComputedStyle(div);
          if (
            computedStyle.display === "flex" &&
            computedStyle.flexDirection === "row" &&
            div.children.length > 5 // Likely the nav bar with multiple category buttons
          ) {
            div.style.overflowX = "auto";
            div.style.overflowY = "hidden";
            div.style.whiteSpace = "nowrap";
          }
        });
      }
    };

    // Wait for the component to render
    const timeoutId = setTimeout(setupEmojiPicker, 100);

    return () => {
      clearTimeout(timeoutId);
      // Cleanup event listeners
      if (pickerElement && handleEmojiSelect) {
        pickerElement.removeEventListener("emoji-click", handleEmojiSelect);
        pickerElement.removeEventListener("emojiClick", handleEmojiSelect);
        pickerElement.removeEventListener("change", handleEmojiSelect);
      }
    };
  }, [showEmojiPicker]);

  // Handle Escape key to close image viewer
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && imageViewerUrl) {
        closeImageViewer();
      }
      // Also cancel recording on Escape
      if (e.key === "Escape" && isRecording) {
        cancelAudioRecording();
      }
    };

    if (imageViewerUrl || isRecording) {
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [imageViewerUrl, isRecording]);

  // Cleanup effect for recording
  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (isRecording) {
        shouldSendRecordingRef.current = false;
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
        }
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop());
        }
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
        }
      }
    };
  }, [isRecording]);

  const handleMediaSelect = (type) => {
    setShowMediaPopup(false);

    if (type === "photos") {
      // Open photo gallery picker (without capture attribute)
      photoInputRef.current?.click();
    } else if (type === "file") {
      // Open file picker
      fileInputRef.current?.click();
    } else if (type === "camera") {
      // Try in-app camera capture (works on desktop + mobile)
      setShowCameraCapture(true);
      startCamera();
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedMedia(file);
      // You can preview the file here or send it directly
      handleSendMedia(file);
    }
    // Reset input to allow selecting the same file again
    event.target.value = "";
  };

  const handlePhotoSelect = (event) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedMedia(file);
      handleSendMedia(file);
    }
    event.target.value = "";
  };

  const handleSendMedia = async (file) => {
    if (!peerId || !file) return;

    try {
      setUploadProgress(0);

      // 🧹 Clean filename
      const safeFileName = file.name
        .replace(/\s+/g, "_")
        .replace(/[^\w.-]/g, "_");
      const objectKey = `uploads/${
        peerId || "user"
      }/${Date.now()}-${safeFileName}`;

      // 1️⃣ Request pre-signed URL
      const { data } = await axios.post(config.api.generatePresignUrl, {
        objectKey,
        expiresInMinutes: config.upload.expiresInMinutes,
      });

      const { url: uploadUrl, fileUrl } = data;

      // 2️⃣ Upload to S3
      await axios.put(uploadUrl, file, {
        headers: { "Content-Type": file.type },
        onUploadProgress: (event) => {
          const percent = Math.round((event.loaded * 100) / event.total);
          setUploadProgress(percent);
        },
      });

      const getImageDimensions = (url) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ width: img.width, height: img.height });
          img.onerror = () => resolve({ width: 1280, height: 720 });
          img.src = url;
        });
      };

      // 3️⃣ Build chat message
      let payload;

      if (file.type.startsWith("image/")) {
        const dims = await getImageDimensions(fileUrl);

        payload = {
          type: "image",
          url: fileUrl,
          fileName: safeFileName,
          mimeType: file.type,
          size: file.size,
          width: dims.width,
          height: dims.height,
        };
      } else {
        payload = {
          type: "file",
          url: fileUrl,
          fileName: safeFileName,
          mimeType: file.type,
          size: file.size,
        };
      }

      setMessage(JSON.stringify(payload));

      // 4️⃣ Send
      setTimeout(() => handleSendMessage(), 100);
    } catch (error) {
      console.error("❌ Upload failed:", error);
      alert("Error uploading file. Please try again.");
    } finally {
      setTimeout(() => setUploadProgress(null), 1000);
    }
  };

  // Camera: start/stop and capture
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        // Fallback to native file input capture if getUserMedia unavailable
        cameraInputRef.current?.click();
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (e) {
      console.error("Camera error:", e);
      // Fallback to file input if permission denied or not available
      cameraInputRef.current?.click();
      setShowCameraCapture(false);
    }
  };

  const stopCamera = () => {
    try {
      const stream = mediaStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    } catch {}
  };

  const closeCamera = () => {
    stopCamera();
    setShowCameraCapture(false);
  };

  const capturePhoto = async () => {
    try {
      const video = videoRef.current;
      if (!video) return;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, width, height);
      canvas.toBlob(
        async (blob) => {
          if (!blob) return;
          const file = new File([blob], "camera-photo.jpg", {
            type: blob.type || "image/jpeg",
          });
          await handleSendMedia(file);
          closeCamera();
        },
        "image/jpeg",
        0.92
      );
    } catch (e) {
      console.error("Capture error:", e);
    }
  };

  // Helper function to convert audio blob to WAV format
  const convertToWAV = async (audioBlob) => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const sampleRate = audioBuffer.sampleRate;
      const numChannels = audioBuffer.numberOfChannels;
      const samples = audioBuffer.getChannelData(0); // Get first channel

      // Create WAV file buffer
      const buffer = new ArrayBuffer(44 + samples.length * 2);
      const view = new DataView(buffer);

      // WAV header
      const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };

      writeString(0, "RIFF");
      view.setUint32(4, 36 + samples.length * 2, true);
      writeString(8, "WAVE");
      writeString(12, "fmt ");
      view.setUint32(16, 16, true); // fmt chunk size
      view.setUint16(20, 1, true); // audio format (1 = PCM)
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
      view.setUint16(32, numChannels * 2, true); // block align
      view.setUint16(34, 16, true); // bits per sample
      writeString(36, "data");
      view.setUint32(40, samples.length * 2, true);

      // Convert float samples to 16-bit PCM
      let offset = 44;
      for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }

      audioContext.close();
      return new Blob([buffer], { type: "audio/wav" });
    } catch (error) {
      console.error("Error converting to WAV:", error);
      // Fallback: return original blob if conversion fails
      return audioBlob;
    }
  };

  // Audio recording functions
  const startAudioRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert("Audio recording is not supported in your browser");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/ogg")
          ? "audio/ogg"
          : "audio/mp4",
      });

      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks first
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop());
          audioStreamRef.current = null;
        }

        // Calculate actual duration from start time (more accurate than state)
        const actualDuration = recordingStartTimeRef.current
          ? Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)
          : recordingDurationRef.current || recordingDuration;

        // Only send if shouldSendRecordingRef is true (not cancelled)
        if (
          shouldSendRecordingRef.current &&
          audioChunksRef.current.length > 0
        ) {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: mediaRecorder.mimeType || "audio/webm",
          });
          // Convert to WAV format
          const wavBlob = await convertToWAV(audioBlob);
          await handleSendAudio(wavBlob, actualDuration);
        }

        // Clear recording state
        setIsRecording(false);
        setRecordingDuration(0);
        recordingStartTimeRef.current = null;
        recordingDurationRef.current = 0;
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        // Reset flag for next recording
        shouldSendRecordingRef.current = true;
      };

      shouldSendRecordingRef.current = true;

      // Clear any existing timer before starting a new one
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingStartTimeRef.current = Date.now(); // Record start time
      recordingDurationRef.current = 0; // Reset ref

      // Start timer - calculate duration from start time to avoid double increments
      recordingTimerRef.current = setInterval(() => {
        if (recordingStartTimeRef.current) {
          const elapsed = Math.floor(
            (Date.now() - recordingStartTimeRef.current) / 1000
          );
          recordingDurationRef.current = elapsed;
          setRecordingDuration(elapsed);
        }
      }, 1000);
    } catch (error) {
      console.error("Error starting audio recording:", error);
      alert(
        "Failed to start audio recording. Please check microphone permissions."
      );
      setIsRecording(false);
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelAudioRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Set flag to prevent sending
      shouldSendRecordingRef.current = false;
      // Clear chunks without sending
      audioChunksRef.current = [];
      // Stop the recorder (this will trigger onstop but won't send due to flag)
      mediaRecorderRef.current.stop();
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const handleSendAudio = async (audioBlob, durationOverride = null) => {
    if (!peerId || !audioBlob) return;

    // Use provided duration or fall back to state
    const durationToUse =
      durationOverride !== null ? durationOverride : recordingDuration;

    try {
      setUploadProgress(0);

      // Determine file extension based on MIME type (WAV format)
      const extension = "wav";

      // Create a File object from the blob for consistent handling
      const fileName = `audio-recording-${Date.now()}.${extension}`;
      const audioFile = new File([audioBlob], fileName, {
        type: audioBlob.type,
      });

      // Clean filename for S3
      const safeFileName = fileName
        .replace(/\s+/g, "_")
        .replace(/[^\w.-]/g, "_");
      const objectKey = `uploads/${
        peerId || "user"
      }/${Date.now()}-${safeFileName}`;

      // 1️⃣ Request pre-signed URL
      const { data } = await axios.post(config.api.generatePresignUrl, {
        objectKey,
        expiresInMinutes: config.upload.expiresInMinutes,
      });

      const { url: uploadUrl, fileUrl } = data;

      // 2️⃣ Upload to S3
      await axios.put(uploadUrl, audioFile, {
        headers: { "Content-Type": audioBlob.type },
        onUploadProgress: (event) => {
          const percent = Math.round((event.loaded * 100) / event.total);
          setUploadProgress(percent);
        },
      });

      // 3️⃣ Build chat message with S3 URL
      const payload = {
        type: "audio",
        url: fileUrl, // Use S3 URL instead of blob URL
        fileName: safeFileName,
        mimeType: audioBlob.type,
        size: audioBlob.size,
        duration: durationToUse, // Duration in seconds (will be converted to ms in App.jsx)
      };

      // Set message and send
      setMessage(JSON.stringify(payload));

      // Send after a brief delay to ensure state is set
      setTimeout(() => {
        handleSendMessage();
      }, 100);
    } catch (error) {
      console.error("Error uploading audio:", error);
      alert("Error uploading audio. Please try again.");
      setMessage(""); // Clear on error
    } finally {
      setTimeout(() => setUploadProgress(null), 1000);
    }
  };

  // Image viewer helpers
  const openImageViewer = (url, alt) => {
    if (!url) return;
    setImageViewerUrl(url);
    setImageViewerAlt(alt || "Image");
    // Optional: lock background scroll if desired
    document.body.style.overflow = "hidden";
  };

  const closeImageViewer = () => {
    setImageViewerUrl("");
    setImageViewerAlt("");
    document.body.style.overflow = "";
  };

  // Helper function to extract custom message data from Agora Chat message
  const extractCustomMessageData = (msg) => {
    let paramsData = null;

    // Try customExts at top level
    if (msg.customExts && typeof msg.customExts === "object") {
      paramsData = msg.customExts;
    }
    // Try v2:customExts at top level
    else if (msg["v2:customExts"] && typeof msg["v2:customExts"] === "object") {
      paramsData = msg["v2:customExts"];
    }
    // Try body.customExts
    else if (msg.body && typeof msg.body === "object" && msg.body.customExts) {
      paramsData = msg.body.customExts;
    }
    // Try body.v2:customExts
    else if (
      msg.body &&
      typeof msg.body === "object" &&
      msg.body["v2:customExts"]
    ) {
      paramsData = msg.body["v2:customExts"];
    }
    // Try ext properties directly
    else if (msg.ext && typeof msg.ext === "object") {
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
      } else if (msg.ext.data) {
        try {
          paramsData =
            typeof msg.ext.data === "string"
              ? JSON.parse(msg.ext.data)
              : msg.ext.data;
        } catch {}
      }
    }

    return paramsData;
  };

  // Helper function to format a message from Agora Chat SDK
  const formatMessage = (msg) => {
    // Check if this is a backend API message format (has keys like body, chat_type, conversation_id, etc.)
    if (
      msg &&
      typeof msg === "object" &&
      !msg.id &&
      !msg.from &&
      !msg.time &&
      (msg.body !== undefined ||
        msg.chat_type !== undefined ||
        msg.conversation_id !== undefined ||
        msg.message_id !== undefined)
    ) {
      // This is a backend API message format - convert it to Agora format
      const backendMsg = msg;
      // Ensure body is a string
      let bodyContent = backendMsg.body || "";
      if (typeof bodyContent !== "string") {
        if (bodyContent && typeof bodyContent === "object") {
          bodyContent = JSON.stringify(bodyContent);
        } else {
          bodyContent = String(bodyContent);
        }
      }
      const agoraMsg = {
        id: backendMsg.message_id || `backend-${Date.now()}-${Math.random()}`,
        from: backendMsg.from_user || backendMsg.sender_name || userId,
        to: backendMsg.to_user || peerId,
        time: backendMsg.created_at_ms || backendMsg.created_at || Date.now(),
        type: backendMsg.message_type === "text" ? "txt" : "custom",
        msg: bodyContent,
        msgContent: bodyContent,
        data: bodyContent,
      };
      msg = agoraMsg;
    }

    // Ensure msg has required properties
    if (!msg || typeof msg !== "object") {
      console.warn("Invalid message format:", msg);
      return {
        id: `invalid-${Date.now()}`,
        sender: "Unknown",
        content: typeof msg === "string" ? msg : JSON.stringify(msg || {}),
        createdAt: new Date(),
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isIncoming: true,
        peerId,
        avatar: config.defaults.avatar,
        messageType: "text",
      };
    }

    // Determine avatar: use sender_photo from API if available, otherwise use defaults
    let messageAvatar = null;
    if (msg.sender_photo) {
      // Use sender_photo from API message (for both incoming and outgoing)
      messageAvatar = msg.sender_photo;
    } else if (msg.from === userId) {
      // Outgoing message from current user - use coach's profile photo
      messageAvatar = coachInfo?.profilePhoto || config.defaults.userAvatar;
    } else {
      // Incoming message - use selectedContact avatar or default
      messageAvatar = selectedContact?.avatar || config.defaults.avatar;
    }

    const baseMessage = {
      id: msg.id || `msg-${Date.now()}-${Math.random()}`,
      sender: msg.from === userId ? "You" : msg.from || "Unknown",
      createdAt: new Date(msg.time || msg.createdAt || Date.now()),
      timestamp: new Date(
        msg.time || msg.createdAt || Date.now()
      ).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      isIncoming: msg.from !== userId,
      peerId,
      avatar: messageAvatar,
    };

    // Handle custom messages
    if (msg.type === "custom") {
      const customData = extractCustomMessageData(msg);

      if (customData && customData.type) {
        const type = String(customData.type).toLowerCase();

        // Filter out unwanted message types (healthCoachChanged, mealPlanUpdate)
        if (
          type === "healthcoachchanged" ||
          type === "mealplanupdate" ||
          type === "healthcoachchangedate" ||
          type === "mealplanupdate" ||
          type === "healthCoachChanged" ||
          type === "mealPlanUpdate"
        ) {
          return null; // Don't show these messages on UI
        }

        const content = JSON.stringify(customData);

        if (type === "image") {
          return {
            ...baseMessage,
            content,
            messageType: "image",
            imageUrl: customData.url,
            fileName: customData.fileName,
          };
        } else if (type === "audio") {
          // Convert duration to milliseconds if it appears to be in seconds (< 3600)
          let durationMs = customData.duration;
          if (typeof durationMs === "number" && durationMs < 3600) {
            durationMs = durationMs * 1000; // Convert seconds to milliseconds
          }
          return {
            ...baseMessage,
            content,
            messageType: "audio",
            audioUrl: customData.url,
            audioDurationMs: durationMs,
            audioTranscription: customData.transcription,
            fileName: customData.fileName,
          };
        } else if (type === "file") {
          return {
            ...baseMessage,
            content,
            messageType: "file",
            fileUrl: customData.url,
            fileName: customData.fileName,
            fileMime: customData.mimeType,
            fileSizeBytes: customData.size,
          };
        } else if (type === "call") {
          // Only show call messages in chat if:
          // It's an end action with duration > 0 (both users connected)
          // Hide initiate messages - they will only appear after call ends with both users
          // If only nutritionist or only client was in call, do NOT show the message
          if (customData.action === "initiate") {
            // Don't show initiate messages immediately
            return null;
          }
          if (
            customData.action === "end" &&
            (!customData.duration || customData.duration <= 0)
          ) {
            // Don't show call end message if no duration or duration <= 0
            // This means only one user (nutritionist or client) was in the call
            return null;
          }

          // Console log for video call message ID from Agora/formatMessage

          return {
            ...baseMessage,
            content,
            messageType: "call",
            callType: customData.callType || "video",
            channel: customData.channel,
            callAction: customData.action,
            callDurationSeconds: customData.duration || null,
          };
        } else if (type === "products") {
          // Handle case where products might be a stringified JSON string
          let productsArray = [];
          if (Array.isArray(customData.products)) {
            productsArray = customData.products;
          } else if (typeof customData.products === "string") {
            try {
              const parsed = JSON.parse(customData.products);
              productsArray = Array.isArray(parsed) ? parsed : [];
            } catch {
              productsArray = [];
            }
          }

          // Filter out products messages with 0 products
          if (productsArray.length === 0) {
            return null; // Don't show products messages with no products
          }

          return {
            ...baseMessage,
            content,
            messageType: "products",
            products: productsArray,
          };
        } else if (type === "meal_plan_updated") {
          return {
            ...baseMessage,
            content: "Meal plan updated",
            messageType: "system",
            system: { kind: "meal_plan_updated" },
          };
        } else if (type === "new_nutritionist" || type === "new_nutrionist") {
          return {
            ...baseMessage,
            content,
            messageType: "system",
            system: {
              kind: "new_nutritionist",
              id: customData.id || "",
              name: customData.name || "",
              title: customData.title || "",
              profilePhoto: customData.profilePhoto || "",
            },
          };
        }
      }

      // Fallback for custom messages without valid data
      let fallbackContent = msg.msg || msg.msgContent || msg.data || "";
      // Ensure content is always a string
      if (typeof fallbackContent !== "string") {
        if (fallbackContent && typeof fallbackContent === "object") {
          // If it's an object, try to extract body or stringify it
          fallbackContent =
            fallbackContent.body || JSON.stringify(fallbackContent);
        } else {
          fallbackContent = String(fallbackContent);
        }
      }
      return {
        ...baseMessage,
        content: fallbackContent,
        messageType: "custom",
      };
    }

    // Handle text messages - check if it's JSON with a type field
    let textContent = msg.msg || msg.msgContent || msg.data || "";
    // Ensure textContent is always a string
    if (typeof textContent !== "string") {
      if (textContent && typeof textContent === "object") {
        // If it's an object, try to extract body or stringify it
        textContent = textContent.body || JSON.stringify(textContent);
      } else {
        textContent = String(textContent);
      }
    }
    try {
      const parsed = JSON.parse(textContent);
      if (parsed && typeof parsed === "object" && parsed.type) {
        const type = String(parsed.type).toLowerCase();
        if (type === "products") {
          // Handle case where products might be a stringified JSON string
          let productsArray = [];
          if (Array.isArray(parsed.products)) {
            productsArray = parsed.products;
          } else if (typeof parsed.products === "string") {
            try {
              const parsedProducts = JSON.parse(parsed.products);
              productsArray = Array.isArray(parsedProducts)
                ? parsedProducts
                : [];
            } catch {
              productsArray = [];
            }
          }

          // Filter out products messages with 0 products
          if (productsArray.length === 0) {
            return null; // Don't show products messages with no products
          }

          return {
            ...baseMessage,
            content: textContent,
            messageType: "products",
            products: productsArray,
          };
        }

        // Filter out unwanted message types (healthCoachChanged, mealPlanUpdate)
        if (
          type === "healthcoachchanged" ||
          type === "mealplanupdate" ||
          type === "mealplanupdated" ||
          type === "healthCoachChanged" ||
          type === "mealPlanUpdate"
        ) {
          return null; // Don't show these messages on UI
        }

        if (type === "products") {
          return {
            ...baseMessage,
            content: textContent,
            messageType: "products",
            products: Array.isArray(parsed.products) ? parsed.products : [],
          };
        } else if (type === "meal_plan_updated") {
          return {
            ...baseMessage,
            content: "Meal plan updated",
            messageType: "system",
            system: { kind: "meal_plan_updated" },
          };
        } else if (type === "new_nutritionist" || type === "new_nutrionist") {
          return {
            ...baseMessage,
            content: textContent,
            messageType: "system",
            system: {
              kind: "new_nutritionist",
              id: parsed.id || "",
              name: parsed.name || "",
              title: parsed.title || "",
              profilePhoto: parsed.profilePhoto || "",
            },
          };
        }
      }
    } catch {
      // Not JSON, treat as regular text
    }

    // Regular text message
    return {
      ...baseMessage,
      content: textContent,
      messageType: "text",
    };
  };

  // Helper function to convert API message format to formatMessage format
  const convertApiMessageToFormat = (apiMsg) => {
    // Convert API response message to format expected by formatMessage
    // The API returns: { message_id, conversation_id, from_user, to_user, sender_name, sender_photo, message_type, body, created_at, created_at_ms }
    // formatMessage expects: { id, from, to, time, type, msg, msgContent, data, body, chat_type, conversation_id, message_id, ... }

    // Check if body has a type field to determine if it's a custom message
    let bodyObj = apiMsg.body;

    // Handle case where body is a string (parse it first)
    if (typeof bodyObj === "string") {
      try {
        bodyObj = JSON.parse(bodyObj);
      } catch {
        // If parsing fails, treat as plain text
        bodyObj = bodyObj;
      }
    }

    // 🟢 FIX: Handle nested payloads such as {"data":"{...}","type":"mealPlanUpdate"}
    if (
      bodyObj &&
      typeof bodyObj === "object" &&
      bodyObj.data &&
      typeof bodyObj.data === "string"
    ) {
      try {
        const nested = JSON.parse(bodyObj.data);
        if (nested && typeof nested === "object") {
          // Use the nested object, but preserve the outer type if nested doesn't have one
          bodyObj = {
            ...nested,
            type: nested.type || bodyObj.type, // Prefer nested type, fallback to outer type
          };
        }
      } catch {
        // If parsing fails, keep bodyObj as is
      }
    }

    // Filter out unwanted message types (healthCoachChanged, mealPlanUpdate)
    if (bodyObj && typeof bodyObj === "object" && bodyObj.type) {
      const type = String(bodyObj.type).toLowerCase();
      if (
        type === "healthcoachchanged" ||
        type === "mealplanupdate" ||
        type === "mealplanupdated" ||
        type === "healthCoachChanged" ||
        type === "mealPlanUpdate"
      ) {
        // Return null to filter out these messages - they should not appear on UI
        return null;
      }
    }

    // 🟢 NORMALIZE products messages: Convert stringified products to array format
    // This ensures both formats (array and stringified) become the same before formatMessage
    if (
      bodyObj &&
      typeof bodyObj === "object" &&
      bodyObj.type === "products" &&
      bodyObj.products
    ) {
      if (typeof bodyObj.products === "string") {
        try {
          const parsed = JSON.parse(bodyObj.products);
          if (Array.isArray(parsed)) {
            bodyObj.products = parsed; // Replace string with array
          }
        } catch {
          // If parsing fails, keep as is
        }
      }
    }

    const isTextMessage =
      bodyObj && typeof bodyObj === "object" && bodyObj.type === "text";
    const isCustomMessage =
      bodyObj &&
      typeof bodyObj === "object" &&
      bodyObj.type &&
      bodyObj.type !== "text";

    // Convert body object to string if it's an object
    let bodyContent = bodyObj;
    if (bodyContent && typeof bodyContent === "object") {
      // For text messages, extract just the message field
      if (isTextMessage && bodyObj.message !== undefined) {
        bodyContent = String(bodyObj.message);
      } else {
        // For custom messages, stringify the entire object
        bodyContent = JSON.stringify(bodyContent);
      }
    } else if (bodyContent === null || bodyContent === undefined) {
      bodyContent = "";
    } else {
      bodyContent = String(bodyContent);
    }

    const apiMessageId =
      apiMsg.message_id || `api-${Date.now()}-${Math.random()}`;

    return {
      id: apiMessageId,
      from: String(apiMsg.from_user || ""),
      to: String(apiMsg.to_user || ""),
      time:
        apiMsg.created_at_ms ||
        new Date(apiMsg.created_at || Date.now()).getTime(),
      // Determine type: if body has a type field and it's not "text", treat as custom
      type: isCustomMessage ? "custom" : "txt",
      msg: bodyContent,
      msgContent: bodyContent,
      data: bodyContent,
      // Include backend API fields for formatMessage to detect backend format
      body: bodyContent,
      chat_type: apiMsg.chat_type,
      conversation_id: apiMsg.conversation_id,
      message_id: apiMsg.message_id,
      from_user: apiMsg.from_user,
      to_user: apiMsg.to_user,
      sender_name: apiMsg.sender_name,
      sender_photo: apiMsg.sender_photo,
      message_type: apiMsg.message_type,
      created_at: apiMsg.created_at,
      created_at_ms: apiMsg.created_at_ms,
      // For custom messages, also include the body object in ext.data so extractCustomMessageData can find it
      ...(isCustomMessage && bodyObj ? { ext: { data: bodyObj } } : {}),
    };
  };

  // 🔹 Fetch latest 20 messages from server
  const fetchInitialMessages = async () => {
    if (!peerId) {
      console.warn("peerId missing, skipping fetch");
      return;
    }

    try {
      // Build URL with query parameters
      // Format conversationId as "user_{peerId}" as required by the API
      const conversationId = peerId.startsWith("user_")
        ? peerId
        : `user_${peerId}`;
      const url = new URL(config.api.fetchMessages);
      url.searchParams.append("conversationId", conversationId);
      url.searchParams.append("limit", String(config.chat.pageSize || 20));

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }

      const res = await response.json();

      // Set cursor for pagination (nextCursor is the timestamp of the last message)
      if (res.nextCursor) {
        setCursor(res.nextCursor);
        setHasMore(true);
      } else {
        setHasMore(false);
      }

      const oldMessages = res?.messages || [];

      // Convert API messages to format expected by formatMessage
      const convertedMessages = oldMessages
        .map((msg) => convertApiMessageToFormat(msg))
        .filter((msg) => msg !== null); // Filter out null messages (healthCoachChanged, mealPlanUpdate, etc.)
      const formatted = convertedMessages
        .map((msg) => formatMessage(msg))
        .filter((msg) => msg !== null); // Filter out null messages (hidden call initiate messages, etc.)

      // 🟢 DEDUPLICATE products messages: Filter out duplicates based on product IDs
      // This prevents the same products message from appearing twice (array vs stringified format)
      const seenProductKeys = new Set();
      const deduplicatedFormatted = formatted.filter((msg) => {
        if (msg.messageType === "products" && msg.products) {
          // Extract first product ID for deduplication key
          let firstProductId = "";
          if (Array.isArray(msg.products)) {
            firstProductId = msg.products[0]?.id || "";
          } else if (typeof msg.products === "string") {
            try {
              const parsed = JSON.parse(msg.products);
              if (Array.isArray(parsed) && parsed[0]?.id) {
                firstProductId = parsed[0].id;
              }
            } catch {
              // Ignore parse errors
            }
          }

          if (firstProductId) {
            const key = `products-${firstProductId}-${msg.sender}`;
            if (seenProductKeys.has(key)) {
              return false; // Filter out duplicate
            }
            seenProductKeys.add(key);
          }
        }
        return true; // Keep all non-products messages and products without ID
      });

      // Find the most recent message from history to update last message
      if (deduplicatedFormatted.length > 0 && onUpdateLastMessageFromHistory) {
        // Sort by timestamp descending to get the most recent
        const sortedFormatted = [...deduplicatedFormatted].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        const mostRecentMessage = sortedFormatted[0];
        if (mostRecentMessage) {
          // Update the conversation's last message
          onUpdateLastMessageFromHistory(peerId, mostRecentMessage);
        }
      }

      // Merge with existing messages instead of replacing
      setMessages((prev) => {
        // Get existing messages for this peer
        const existingMessages = prev.filter((msg) => msg.peerId === peerId);

        // Create a set of existing message IDs to avoid duplicates
        const existingIds = new Set(existingMessages.map((msg) => msg.id));

        // Filter out fetched messages that already exist by ID
        const newFetchedMessages = deduplicatedFormatted
          .reverse()
          .filter((msg) => !existingIds.has(msg.id));

        // If there are no existing messages for this peer, just return the fetched ones
        if (existingMessages.length === 0) {
          return newFetchedMessages;
        }

        // For messages from logs (with generated IDs), try to match with server messages
        // This ensures we use server timestamps instead of log timestamps
        // Match by normalizing content (remove whitespace, handle JSON differences) and sender
        const normalizeContent = (content) => {
          if (!content) return "";
          try {
            // Try to parse as JSON and re-stringify to normalize
            const parsed = JSON.parse(content);
            return JSON.stringify(parsed);
          } catch {
            // Not JSON, return trimmed content
            return String(content).trim();
          }
        };

        // Create a matching key for custom messages using messageType and identifying fields
        const createMatchKey = (msg) => {
          const normalizedContent = normalizeContent(msg.content);
          const timeWindow = Math.floor(
            new Date(msg.createdAt).getTime() / 300000
          ); // 5-minute window

          // For custom messages, include messageType and identifying fields in the key
          if (msg.messageType && msg.messageType !== "text") {
            let customKey = "";

            // Try to extract from message fields first
            if (msg.messageType === "image" && msg.imageUrl) {
              customKey = msg.imageUrl;
            } else if (msg.messageType === "audio" && msg.audioUrl) {
              customKey = msg.audioUrl;
            } else if (msg.messageType === "file" && msg.fileUrl) {
              customKey = msg.fileUrl;
            } else if (msg.messageType === "call") {
              // For call messages, use content-based matching (not ID) so log and server messages match
              // Extract action and duration from message object or content
              let callAction = msg.callAction || "";
              let callDuration =
                msg.callDurationSeconds != null
                  ? String(msg.callDurationSeconds)
                  : "";
              let callType = msg.callType || "video";
              let callChannel = msg.channel || "";

              // If fields not on message object, try to extract from content
              if (
                !callAction ||
                !callChannel ||
                typeof msg.content === "string"
              ) {
                try {
                  const contentObj = JSON.parse(msg.content);
                  if (contentObj && typeof contentObj === "object") {
                    if (contentObj.action) callAction = contentObj.action;
                    if (contentObj.duration != null)
                      callDuration = String(contentObj.duration);
                    if (contentObj.callType) callType = contentObj.callType;
                    if (contentObj.channel) callChannel = contentObj.channel;
                  }
                } catch {}
              }

              // Use content-based key with timestamp in 2-second window to match log/server messages
              // This allows log and server messages of the same call to match
              // But different calls (different durations or times > 2s apart) won't match
              const timestampSeconds = Math.floor(
                new Date(msg.createdAt).getTime() / 2000
              );
              customKey = `${callType}-${callChannel}-${callAction}-${callDuration}-${timestampSeconds}`;
            } else if (msg.messageType === "products") {
              // For products, extract products array (handle both array and stringified formats)

              let productsArray = [];
              if (Array.isArray(msg.products)) {
                productsArray = msg.products;
              } else if (typeof msg.products === "string") {
                try {
                  const parsed = JSON.parse(msg.products);
                  productsArray = Array.isArray(parsed) ? parsed : [];
                } catch {
                  productsArray = [];
                }
              }
              // Use the first product ID as the key
              customKey = productsArray[0]?.id || "";
            }

            // If customKey is still empty, try to extract from content JSON
            if (!customKey && typeof msg.content === "string") {
              try {
                const contentObj = JSON.parse(msg.content);
                if (contentObj && typeof contentObj === "object") {
                  if (msg.messageType === "image" && contentObj.url) {
                    customKey = contentObj.url;
                  } else if (msg.messageType === "audio" && contentObj.url) {
                    customKey = contentObj.url;
                  } else if (msg.messageType === "file" && contentObj.url) {
                    customKey = contentObj.url;
                  } else if (msg.messageType === "call") {
                    // For call messages from content, use content-based matching
                    const callAction = contentObj.action || "";
                    const callDuration =
                      contentObj.duration != null
                        ? String(contentObj.duration)
                        : "";
                    const callType = contentObj.callType || "video";
                    const callChannel = contentObj.channel || "";
                    // Use content-based key with 2-second timestamp window
                    const timestampSeconds = Math.floor(
                      new Date(msg.createdAt).getTime() / 2000
                    );
                    customKey = `${callType}-${callChannel}-${callAction}-${callDuration}-${timestampSeconds}`;
                  } else if (msg.messageType === "products") {
                    // Handle both array and stringified products formats
                    let productsArray = [];
                    if (Array.isArray(contentObj.products)) {
                      productsArray = contentObj.products;
                    } else if (typeof contentObj.products === "string") {
                      try {
                        const parsed = JSON.parse(contentObj.products);
                        productsArray = Array.isArray(parsed) ? parsed : [];
                      } catch {
                        productsArray = [];
                      }
                    }
                    // Use the first product ID as the key
                    customKey = productsArray[0]?.id || "";
                  }
                }
              } catch {
                // Not JSON, ignore
              }
            }

            if (customKey) {
              // For call messages, don't use timeWindow since customKey already includes timestamp
              // Use only messageType, customKey, and sender
              if (msg.messageType === "call") {
                return `${msg.messageType}-${customKey}-${msg.sender}`;
              }
              return `${msg.messageType}-${customKey}-${msg.sender}-${timeWindow}`;
            }

            // For system messages (meal_plan_updated, new_nutritionist, etc.), use timestamp to allow duplicates
            if (msg.messageType === "system" && msg.system) {
              // Use a more granular timestamp (1-second window) to allow multiple system messages
              const timestampSeconds = Math.floor(
                new Date(msg.createdAt).getTime() / 1000
              );
              const systemKind = msg.system.kind || "";
              return `${msg.messageType}-${systemKind}-${msg.sender}-${timestampSeconds}`;
            }
          }

          // Fallback to content-based matching for text and other messages
          return `${normalizedContent}-${msg.sender}-${timeWindow}`;
        };

        const serverMessagesByKey = new Map();
        newFetchedMessages.forEach((msg) => {
          const key = createMatchKey(msg);
          if (!serverMessagesByKey.has(key)) {
            serverMessagesByKey.set(key, msg);
          }
        });

        // Track which server messages have been matched
        const matchedServerMessageIds = new Set();

        // Replace log messages with server messages if they match
        const updatedExistingMessages = existingMessages.map((logMsg) => {
          // Only try to match messages from logs (have generated IDs)
          if (
            logMsg.id.startsWith("outgoing-") ||
            logMsg.id.startsWith("incoming-")
          ) {
            const key = createMatchKey(logMsg);
            const serverMsg = serverMessagesByKey.get(key);
            if (serverMsg) {
              // Mark this server message as matched
              matchedServerMessageIds.add(serverMsg.id);
              // Use server message (has correct timestamp) instead of log message
              return serverMsg;
            }
          }
          return logMsg;
        });

        // Remove matched server messages from newFetchedMessages to prevent duplicates
        const unmatchedFetchedMessages = newFetchedMessages.filter(
          (msg) => !matchedServerMessageIds.has(msg.id)
        );

        // Merge: keep updated existing messages + add only unmatched fetched ones
        // First, collect all server messages and their match keys
        const allMessagesTemp = [
          ...updatedExistingMessages,
          ...unmatchedFetchedMessages,
        ].filter((msg) => msg !== null && msg.createdAt); // Filter out null messages and messages without createdAt

        const serverMessageKeys = new Set();
        allMessagesTemp.forEach((msg) => {
          const isServerMsg =
            !msg.id.startsWith("outgoing-") && !msg.id.startsWith("incoming-");
          if (isServerMsg) {
            const key = createMatchKey(msg);
            serverMessageKeys.add(key);
          }
        });

        // Combine and sort by timestamp to maintain chronological order
        const allMessages = allMessagesTemp
          .filter((msg, index, self) => {
            // Remove duplicates by ID (first check)
            const idIndex = self.findIndex((m) => m.id === msg.id);
            if (idIndex !== index) {
              return false;
            }
            // Also check by match key to catch any remaining duplicates
            const key = createMatchKey(msg);
            const isLogMsg =
              msg.id.startsWith("outgoing-") || msg.id.startsWith("incoming-");

            // If this is a log message and we have a server message with the same key, filter it out
            if (isLogMsg && serverMessageKeys.has(key)) {
              return false;
            }

            // Remove other duplicates by match key (keep first occurrence)
            const keyIndex = self.findIndex((m) => createMatchKey(m) === key);
            if (keyIndex !== index) {
              return false;
            }

            return true;
          })
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        // Return merged messages along with messages from other peers
        const otherPeerMessages = prev.filter((msg) => msg.peerId !== peerId);
        return [...otherPeerMessages, ...allMessages];
      });
    } catch (err) {
      console.error("Error fetching initial messages:", err);
    }
  };

  const fetchMoreMessages = async () => {
    if (!peerId || isFetchingHistory || !hasMore) return;

    try {
      setIsFetchingHistory(true);

      const chatArea = chatAreaRef.current;
      const prevScrollHeight = chatArea?.scrollHeight || 0;
      const prevScrollTop = chatArea?.scrollTop || 0;

      // Build URL with query parameters
      // Format conversationId as "user_{peerId}" as required by the API
      const conversationId = peerId.startsWith("user_")
        ? peerId
        : `user_${peerId}`;
      const url = new URL(config.api.fetchMessages);
      url.searchParams.append("conversationId", conversationId);
      url.searchParams.append("limit", "20");

      // Add cursor if available (for pagination)
      if (cursor) {
        url.searchParams.append("cursor", String(cursor));
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Failed to fetch more messages: ${response.status}`);
      }

      const res = await response.json();

      const newMessages = res?.messages || [];
      if (newMessages.length === 0) {
        setHasMore(false);
        setIsFetchingHistory(false);
        return;
      }

      // Set cursor for next pagination
      if (res.nextCursor) {
        setCursor(res.nextCursor);
        setHasMore(true);
      } else {
        setHasMore(false);
      }

      // Convert API messages to format expected by formatMessage
      const convertedMessages = newMessages
        .map((msg) => convertApiMessageToFormat(msg))
        .filter((msg) => msg !== null); // Filter out null messages (healthCoachChanged, mealPlanUpdate, etc.)
      const formatted = convertedMessages
        .map((msg) => formatMessage(msg))
        .filter((msg) => msg !== null); // Filter out null messages (hidden call initiate messages, etc.)

      // 🟢 DEDUPLICATE products messages: Filter out duplicates based on product IDs
      // This prevents the same products message from appearing twice (array vs stringified format)
      const seenProductKeys = new Set();
      const deduplicatedFormatted = formatted.filter((msg) => {
        if (msg.messageType === "products" && msg.products) {
          // Extract first product ID for deduplication key
          let firstProductId = "";
          if (Array.isArray(msg.products)) {
            firstProductId = msg.products[0]?.id || "";
          } else if (typeof msg.products === "string") {
            try {
              const parsed = JSON.parse(msg.products);
              if (Array.isArray(parsed) && parsed[0]?.id) {
                firstProductId = parsed[0].id;
              }
            } catch {
              // Ignore parse errors
            }
          }

          if (firstProductId) {
            const key = `products-${firstProductId}-${msg.sender}`;
            if (seenProductKeys.has(key)) {
              return false; // Filter out duplicate
            }
            seenProductKeys.add(key);
          }
        }
        return true; // Keep all non-products messages and products without ID
      });

      // 🟡 Prevent scroll-to-bottom behavior
      isLoadingHistoryRef.current = true;
      skipAutoScrollRef.current = true;

      setMessages((prev) => {
        const existing = prev.filter((msg) => msg.peerId === peerId);
        const existingIds = new Set(existing.map((m) => m.id));

        // Use the same matching logic as initial fetch
        const normalizeContent = (content) => {
          if (!content) return "";
          try {
            const parsed = JSON.parse(content);
            return JSON.stringify(parsed);
          } catch {
            return String(content).trim();
          }
        };

        const createMatchKey = (msg) => {
          const normalizedContent = normalizeContent(msg.content);
          const timeWindow = Math.floor(
            new Date(msg.createdAt).getTime() / 300000
          );

          if (msg.messageType && msg.messageType !== "text") {
            let customKey = "";

            // Try to extract from message fields first
            if (msg.messageType === "image" && msg.imageUrl) {
              customKey = msg.imageUrl;
            } else if (msg.messageType === "audio" && msg.audioUrl) {
              customKey = msg.audioUrl;
            } else if (msg.messageType === "file" && msg.fileUrl) {
              customKey = msg.fileUrl;
            } else if (msg.messageType === "call") {
              // For call messages, use content-based matching (not ID) so log and server messages match
              // Extract action and duration from message object or content
              let callAction = msg.callAction || "";
              let callDuration =
                msg.callDurationSeconds != null
                  ? String(msg.callDurationSeconds)
                  : "";
              let callType = msg.callType || "video";
              let callChannel = msg.channel || "";

              // If fields not on message object, try to extract from content
              if (
                !callAction ||
                !callChannel ||
                typeof msg.content === "string"
              ) {
                try {
                  const contentObj = JSON.parse(msg.content);
                  if (contentObj && typeof contentObj === "object") {
                    if (contentObj.action) callAction = contentObj.action;
                    if (contentObj.duration != null)
                      callDuration = String(contentObj.duration);
                    if (contentObj.callType) callType = contentObj.callType;
                    if (contentObj.channel) callChannel = contentObj.channel;
                  }
                } catch {}
              }

              // Use content-based key with timestamp in 2-second window to match log/server messages
              // This allows log and server messages of the same call to match
              // But different calls (different durations or times > 2s apart) won't match
              const timestampSeconds = Math.floor(
                new Date(msg.createdAt).getTime() / 2000
              );
              customKey = `${callType}-${callChannel}-${callAction}-${callDuration}-${timestampSeconds}`;
            } else if (msg.messageType === "products" && msg.products) {
              customKey = msg.products[0]?.id || "";
            }

            // If customKey is still empty, try to extract from content JSON
            if (!customKey && typeof msg.content === "string") {
              try {
                const contentObj = JSON.parse(msg.content);
                if (contentObj && typeof contentObj === "object") {
                  if (msg.messageType === "image" && contentObj.url) {
                    customKey = contentObj.url;
                  } else if (msg.messageType === "audio" && contentObj.url) {
                    customKey = contentObj.url;
                  } else if (msg.messageType === "file" && contentObj.url) {
                    customKey = contentObj.url;
                  } else if (msg.messageType === "call") {
                    // For call messages from content, use content-based matching
                    const callAction = contentObj.action || "";
                    const callDuration =
                      contentObj.duration != null
                        ? String(contentObj.duration)
                        : "";
                    const callType = contentObj.callType || "video";
                    const callChannel = contentObj.channel || "";
                    // Use content-based key with 2-second timestamp window
                    const timestampSeconds = Math.floor(
                      new Date(msg.createdAt).getTime() / 2000
                    );
                    customKey = `${callType}-${callChannel}-${callAction}-${callDuration}-${timestampSeconds}`;
                  } else if (msg.messageType === "products") {
                    // Handle both array and stringified products formats
                    let productsArray = [];
                    if (Array.isArray(contentObj.products)) {
                      productsArray = contentObj.products;
                    } else if (typeof contentObj.products === "string") {
                      try {
                        const parsed = JSON.parse(contentObj.products);
                        productsArray = Array.isArray(parsed) ? parsed : [];
                      } catch {
                        productsArray = [];
                      }
                    }
                    // Use the first product ID as the key
                    customKey = productsArray[0]?.id || "";
                  }
                }
              } catch {
                // Not JSON, ignore
              }
            }

            if (customKey) {
              // For call messages, don't use timeWindow since customKey already includes timestamp
              // Use only messageType, customKey, and sender
              if (msg.messageType === "call") {
                return `${msg.messageType}-${customKey}-${msg.sender}`;
              }
              return `${msg.messageType}-${customKey}-${msg.sender}-${timeWindow}`;
            }

            // For system messages (meal_plan_updated, new_nutritionist, etc.), use timestamp to allow duplicates
            if (msg.messageType === "system" && msg.system) {
              // Use a more granular timestamp (1-second window) to allow multiple system messages
              const timestampSeconds = Math.floor(
                new Date(msg.createdAt).getTime() / 1000
              );
              const systemKind = msg.system.kind || "";
              return `${msg.messageType}-${systemKind}-${msg.sender}-${timestampSeconds}`;
            }
          }

          return `${normalizedContent}-${msg.sender}-${timeWindow}`;
        };

        const existingMessagesByKey = new Map();
        existing.forEach((msg) => {
          const key = createMatchKey(msg);
          if (!existingMessagesByKey.has(key)) {
            existingMessagesByKey.set(key, msg);
          }
        });

        // Filter by both ID and content/key matching
        const unique = deduplicatedFormatted.reverse().filter((m) => {
          if (existingIds.has(m.id)) {
            return false;
          }
          const key = createMatchKey(m);
          return !existingMessagesByKey.has(key);
        });

        return [...unique, ...prev];
      });

      // 🧭 Maintain exact scroll position
      requestAnimationFrame(() => {
        const newScrollHeight = chatArea?.scrollHeight || 0;
        chatArea.scrollTop =
          newScrollHeight - (prevScrollHeight - prevScrollTop);
        // Delay resetting the flags until the next repaint
        setTimeout(() => {
          isLoadingHistoryRef.current = false;
          skipAutoScrollRef.current = false;
        }, 200);
      });
    } catch (err) {
      console.error("Error fetching more messages:", err);
      isLoadingHistoryRef.current = false;
      skipAutoScrollRef.current = false;
    } finally {
      setIsFetchingHistory(false);
    }
  };

  return (
    <div className="chat-interface">
      <ChatHeader
        selectedContact={selectedContact}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onBackToConversations={onBackToConversations}
        onInitiateCall={onInitiateCall}
      />

      {/* Chat Area */}
      <div className="chat-area" ref={chatAreaRef}>
        {isFetchingHistory && (
          <div
            style={{
              position: "sticky",
              top: 0,
              background: "white",
              zIndex: 10,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "8px",
              color: "#6b7280",
              fontSize: "0.85rem",
            }}
          >
            <div
              className="spinner"
              style={{
                width: "18px",
                height: "18px",
                border: "2px solid #d1d5db",
                borderTop: "2px solid #2563eb",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                marginRight: "8px",
              }}
            ></div>
            Loading older messages...
          </div>
        )}

        {activeTab === "Chat" && (
          <ChatTab
            peerId={peerId}
            currentConversationMessages={currentConversationMessages}
            selectedContact={selectedContact}
            userId={userId}
            formatDateLabel={formatDateLabel}
            formatCurrency={formatCurrency}
            openImageViewer={openImageViewer}
            currentlyPlayingAudioRef={currentlyPlayingAudioRef}
          />
        )}
        {activeTab === "Info" && <InfoTab selectedContact={selectedContact} />}
        {activeTab === "Description" && (
          <DescriptionTab selectedContact={selectedContact} />
        )}
      </div>

      {/* Message Input */}
      <div className="message-input-area">
        {uploadProgress !== null && (
          <div
            style={{
              width: "100%",
              background: "#e5e7eb",
              borderRadius: 4,
              overflow: "hidden",
              marginBottom: 8,
              height: 8,
            }}
          >
            <div
              style={{
                width: `${uploadProgress}%`,
                height: "100%",
                background: "#2563eb",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        )}

        {draftAttachment && (
          <div
            className="attachment-preview"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 8px",
              marginBottom: 8,
              background: "#f3f4f6",
              borderRadius: 12,
              boxShadow: "inset 0 0 0 1px #e5e7eb",
            }}
          >
            {draftAttachment.type === "image" ? (
              <img
                src={draftAttachment.url}
                alt={draftAttachment.fileName}
                onClick={() =>
                  openImageViewer(draftAttachment.url, draftAttachment.fileName)
                }
                style={{
                  width: 48,
                  height: 48,
                  objectFit: "cover",
                  borderRadius: 8,
                  cursor: "zoom-in",
                  pointerEvents: "auto",
                  userSelect: "none",
                }}
              />
            ) : draftAttachment.type === "audio" ? (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  background:
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"
                    fill="currentColor"
                  />
                  <path
                    d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
                    fill="currentColor"
                  />
                </svg>
              </div>
            ) : (
              <div
                aria-hidden
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  background: "#fee2e2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#b91c1c",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                {draftAttachment.mimeType &&
                draftAttachment.mimeType.includes("pdf")
                  ? "PDF"
                  : "FILE"}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              {draftAttachment.type === "audio" ? (
                <>
                  <div
                    style={{
                      fontWeight: 600,
                      color: "#0f172a",
                      fontSize: 14,
                      marginBottom: 4,
                    }}
                  >
                    Audio
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 4,
                    }}
                  >
                    <audio
                      controls
                      src={draftAttachment.url}
                      style={{
                        height: 32,
                        minWidth: 200,
                        maxWidth: "100%",
                      }}
                      onPlay={(e) => {
                        // Pause other audio if playing
                        if (
                          currentlyPlayingAudioRef.current &&
                          currentlyPlayingAudioRef.current !== e.target
                        ) {
                          currentlyPlayingAudioRef.current.pause();
                        }
                        currentlyPlayingAudioRef.current = e.target;
                      }}
                      onEnded={(e) => {
                        if (currentlyPlayingAudioRef.current === e.target) {
                          currentlyPlayingAudioRef.current = null;
                        }
                      }}
                      onPause={(e) => {
                        if (currentlyPlayingAudioRef.current === e.target) {
                          currentlyPlayingAudioRef.current = null;
                        }
                      }}
                    />
                    <div
                      style={{
                        fontSize: 12,
                        color: "#6b7280",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {draftAttachment.duration != null
                        ? formatDuration(draftAttachment.duration)
                        : "Recording"}
                      {draftAttachment.size != null
                        ? ` • ${Math.round(draftAttachment.size / 1024)} KB`
                        : ""}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div
                    style={{
                      fontWeight: 600,
                      color: "#0f172a",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {draftAttachment.fileName}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {(draftAttachment.mimeType || "").toUpperCase()}
                    {draftAttachment.size != null
                      ? ` • ${Math.round(draftAttachment.size / 1024)} KB`
                      : ""}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={clearDraftAttachment}
              title="Remove"
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                background: "#e5e7eb",
                color: "#374151",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        )}
        <div className="input-container">
          <div className="input-wrapper">
            <div className="input-with-audio">
              <input
                ref={inputRef}
                type="text"
                key={`${peerId}-${inputResetKey}`} // Force remount when peer changes or after sending
                placeholder={
                  draftAttachment && draftAttachment.type === "audio"
                    ? "Add a caption (optional)"
                    : draftAttachment
                    ? "Add a caption (optional)"
                    : "Type a message"
                }
                value={
                  draftAttachment && draftAttachment.type !== "audio"
                    ? getDraftCaption()
                    : draftAttachment
                    ? ""
                    : typeof message === "string"
                    ? message
                    : ""
                }
                onChange={(e) => {
                  const text = e.target.value;
                  // Always call setMessage to ensure React detects the change
                  if (draftAttachment) {
                    try {
                      const obj = JSON.parse(message);
                      obj.caption = text;
                      setMessage(JSON.stringify(obj));
                    } catch {
                      setMessage(text);
                    }
                  } else {
                    // Force update by always setting the message, even if it's the same
                    // This ensures React's controlled input properly tracks changes
                    setMessage(text);
                  }
                }}
                onInput={(e) => {
                  // Additional safeguard: ensure input value is properly tracked
                  // This helps catch any edge cases where onChange might not fire
                  const text = e.target.value;
                  if (!draftAttachment && text !== message) {
                    setMessage(text);
                  }
                }}
                onKeyPress={handleKeyPress}
                className="message-input"
                disabled={!selectedContact}
                autoFocus
              />
              {!(typeof message === "string" ? message.trim() : message) &&
                !draftAttachment && (
                  <button
                    ref={audioBtnRef}
                    className="audio-btn"
                    disabled={!selectedContact || isRecording}
                    onClick={() => {
                      if (!isRecording) {
                        startAudioRecording();
                      }
                    }}
                    onMouseDown={(e) => {
                      if (!isRecording && selectedContact) {
                        e.preventDefault();
                        startAudioRecording();
                      }
                    }}
                    title="Hold to record audio"
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  </button>
                )}
            </div>
          </div>
          <div className="button-container">
            <button
              className="icon-btn attachment-btn"
              disabled={!selectedContact}
              onClick={() => setShowMediaPopup(!showMediaPopup)}
              title="Attach media"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.49" />
              </svg>
            </button>
            {/* <div
              style={{
                position: "relative",
              }}
            > */}
            {/* <button
                className="icon-btn demo-btn"
                disabled={!selectedContact}
                onClick={() => setShowDemoMenu(!showDemoMenu)}
                title="Test custom messages"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </button> */}
            {/* {showDemoMenu && (
                <div
                  ref={demoMenuRef}
                  className="demo-menu"
                  style={{
                    position: "absolute",
                    bottom: "100%",
                    right: 0,
                    marginBottom: "0.5rem",
                    background: "white",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                    padding: "0.5rem",
                    zIndex: 1000,
                    minWidth: "200px",
                    maxHeight: "400px",
                    overflowY: "auto",
                  }}
                >
                  <div
                    style={{
                      padding: "0.5rem",
                      fontWeight: "600",
                      fontSize: "0.875rem",
                      color: "#374151",
                      borderBottom: "1px solid #e5e7eb",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Test Custom Messages
                  </div>
                  <button
                    className="demo-menu-item"
                    onClick={() => sendDemoMessage("image")}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      textAlign: "left",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      borderRadius: "4px",
                      fontSize: "0.875rem",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = "#f3f4f6";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = "transparent";
                    }}
                  >
                    📷 Image
                  </button>
                  <button
                    className="demo-menu-item"
                    onClick={() => sendDemoMessage("audio")}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      textAlign: "left",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      borderRadius: "4px",
                      fontSize: "0.875rem",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = "#f3f4f6";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = "transparent";
                    }}
                  >
                    🎵 Audio
                  </button>
                  <button
                    className="demo-menu-item"
                    onClick={() => sendDemoMessage("file")}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      textAlign: "left",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      borderRadius: "4px",
                      fontSize: "0.875rem",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = "#f3f4f6";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = "transparent";
                    }}
                  >
                    📄 File
                  </button>
                  <button
                    className="demo-menu-item"
                    onClick={() => sendDemoMessage("call")}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      textAlign: "left",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      borderRadius: "4px",
                      fontSize: "0.875rem",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = "#f3f4f6";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = "transparent";
                    }}
                  >
                    📞 Video Call
                  </button>
                  <button
                    className="demo-menu-item"
                    onClick={() => sendDemoMessage("meal_plan_updated")}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      textAlign: "left",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      borderRadius: "4px",
                      fontSize: "0.875rem",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = "#f3f4f6";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = "transparent";
                    }}
                  >
                    🍽️ Meal Plan Updated
                  </button>
                  <button
                    className="demo-menu-item"
                    onClick={() => sendDemoMessage("new_nutritionist")}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      textAlign: "left",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      borderRadius: "4px",
                      fontSize: "0.875rem",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = "#f3f4f6";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = "transparent";
                    }}
                  >
                    👨‍⚕️ New Nutritionist
                  </button>
                  <button
                    className="demo-menu-item"
                    onClick={() => sendDemoMessage("products")}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      textAlign: "left",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      borderRadius: "4px",
                      fontSize: "0.875rem",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = "#f3f4f6";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = "transparent";
                    }}
                  >
                    🛍️ Products
                  </button>
                </div>
              )} */}
            {/* </div> */}
            <button
              title="Attach emoji"
              ref={buttonRef}
              className="emoji-button"
              onClick={toggleEmojiPicker}
            >
              <Smile />
            </button>
            <button
              className="send-button"
              onClick={handleSendMessage}
              disabled={
                !selectedContact ||
                (!draftAttachment &&
                  !(typeof message === "string" ? message.trim() : message))
              }
              title="Send message"
            >
              Send
            </button>

            {showEmojiPicker && (
              <div ref={emojiPickerRef} className="emoji-picker-container">
                <emoji-picker class="emoji-picker-element"></emoji-picker>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Media Upload Popup */}
      {showMediaPopup && (
        <div className="media-popup" ref={mediaPopupRef}>
          <div className="media-options">
            <button
              className="media-option"
              onClick={() => handleMediaSelect("photos")}
            >
              <div className="media-icon photos-icon">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
              <span className="media-label">Photos</span>
            </button>

            <button
              className="media-option"
              onClick={() => handleMediaSelect("camera")}
            >
              <div className="media-icon camera-icon">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              <span className="media-label">Camera</span>
            </button>

            <button
              className="media-option"
              onClick={() => handleMediaSelect("file")}
            >
              <div className="media-icon file-icon">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <span className="media-label">File</span>
            </button>
          </div>
        </div>
      )}

      {/* Audio Recording Overlay */}
      {isRecording && (
        <div
          className="audio-recording-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: "#111827",
              borderRadius: 16,
              padding: 24,
              width: "min(90vw, 320px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "#dc2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <div style={{ color: "white", fontSize: 24, fontWeight: 700 }}>
              {formatDuration(recordingDuration)}
            </div>
            <div
              style={{ color: "#9ca3af", fontSize: 14, textAlign: "center" }}
            >
              Recording audio message...
            </div>
            <div
              style={{
                display: "flex",
                gap: 12,
                width: "100%",
                marginTop: 8,
              }}
            >
              <button
                onClick={cancelAudioRecording}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "#6b7280",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                onClick={stopAudioRecording}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "#10b981",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M5 3h14v18H5V3z" />
                </svg>
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Capture Overlay */}
      {showCameraCapture && (
        <div
          className="camera-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: "#111827",
              borderRadius: 12,
              padding: 12,
              width: "min(90vw, 640px)",
            }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: "100%", borderRadius: 8, background: "black" }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 8,
                gap: 8,
              }}
            >
              <button
                onClick={closeCamera}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: "#6b7280",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={capturePhoto}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: "#10b981",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Capture
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Viewer */}
      {imageViewerUrl && (
        <div
          onClick={closeImageViewer}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
            cursor: "zoom-out",
          }}
        >
          <img
            src={imageViewerUrl}
            alt={imageViewerAlt || "Image"}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "95vw",
              maxHeight: "95vh",
              objectFit: "contain",
              borderRadius: 8,
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              cursor: "default",
            }}
          />
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={handleFileSelect}
        accept="*/*"
      />
      <input
        type="file"
        ref={photoInputRef}
        style={{ display: "none" }}
        onChange={handlePhotoSelect}
        accept="image/*"
      />
      <input
        type="file"
        ref={cameraInputRef}
        style={{ display: "none" }}
        onChange={handlePhotoSelect}
        accept="image/*"
        capture="environment"
      />
    </div>
  );
}

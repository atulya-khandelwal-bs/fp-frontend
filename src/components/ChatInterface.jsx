import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { Smile } from "lucide-react";
import "emoji-picker-element"; // Import once to register the <emoji-picker> tag
import config from "../config.js";

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
}) {
  const [activeTab, setActiveTab] = useState("Chat");
  const [messages, setMessages] = useState([]);
  const [showMediaPopup, setShowMediaPopup] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
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
          duration: obj.duration ?? null, // Include duration for audio
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

    const newMessages = filteredLogs.map(
      ({ log, logHash, logIndex, timestamp }) => {
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
                  default: {
                    const parsed = parseSystemPayload(content);
                    if (parsed) {
                      system = parsed;
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

          return {
            id: `outgoing-${peerId}-${logHash}-${logIndex}-${uniqueTimestamp}`, // Include logIndex and timestamp to ensure unique IDs for consecutive duplicate messages
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
            createdAt: messageTime,
            timestamp: messageTime.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            isIncoming: false, // Outgoing message - right side
            avatar: config.defaults.userAvatar,
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
                    messageType = "call";
                    callType = obj.callType || "voice";
                    callDurationSeconds = obj.duration ?? null;
                    messageContent = `${
                      callType === "video" ? "Video" : "Voice"
                    } call`;
                    break;
                  default: {
                    const parsed = parseSystemPayload(content);
                    if (parsed) {
                      system = parsed;
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

          return {
            id: `incoming-${peerId}-${logHash}-${logIndex}-${uniqueTimestamp}`, // Include logIndex and timestamp to ensure unique IDs for consecutive duplicate messages
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
      }
    );

    // Only show messages for the current conversation (peerId)
    setMessages((prev) => {
      // console.log("prev", prev);
      // If peerId changed, reset messages for the new conversation

      const currentPeerMessages = prev.filter((msg) => msg.peerId === peerId);

      // Create a set of existing message IDs to prevent duplicates
      const existingIds = new Set(currentPeerMessages.map((msg) => msg.id));

      // Only add messages that don't already exist (based on their unique ID)
      // This ensures even consecutive duplicate messages are shown
      const uniqueNewMessages = newMessages.filter(
        (msg) => !existingIds.has(msg.id)
      );

      // If no new unique messages, return existing state
      if (uniqueNewMessages.length === 0) {
        return prev;
      }

      // If no existing messages for this peer, return new messages
      if (currentPeerMessages.length === 0) {
        return uniqueNewMessages;
      }

      // Merge: keep existing messages for this peer + add new unique ones
      // Sort by logIndex to maintain chronological order
      const allMessages = [...currentPeerMessages, ...uniqueNewMessages];
      console.log("allMessages", allMessages);
      console.log("currentPeerMessages", currentPeerMessages);
      console.log("uniqueNewMessages", uniqueNewMessages);
      // Extract logIndex from message ID for sorting (it's the third part after splitting by '-')
      // allMessages.sort((a, b) => {
      //   const aIndex = parseInt(a.id.split("-")[3]) || 0;
      //   const bIndex = parseInt(b.id.split("-")[3]) || 0;
      //   return aIndex - bIndex;
      // });

      // console.log("allMessages", allMessages);
      return allMessages;
    });
  }, [logs, peerId, selectedContact]);

  // Sync chatClient prop to ref
  useEffect(() => {
    chatClientRef.current = chatClient;
    console.log(
      "chatClientRef updated:",
      !!chatClient,
      chatClient?.isOpened?.()
    );
  }, [chatClient]);

  // Fetch last 20 messages whenever peer changes (only once per peer)
  useEffect(() => {
    if (!peerId || !chatClient) return;

    // Get the current peer from the ref to detect changes
    const currentFetchedPeer = fetchedPeersRef.current.currentPeer;

    // If peerId changed, reset the fetched set for the new peer
    if (currentFetchedPeer !== peerId) {
      fetchedPeersRef.current.fetchedPeers = new Set();
      fetchedPeersRef.current.currentPeer = peerId;
    }

    // Check if we've already fetched history for this peer
    if (fetchedPeersRef.current.fetchedPeers.has(peerId)) {
      return;
    }

    // Wait until the chat client is connected
    const checkAndFetch = async () => {
      try {
        if (!chatClient.isOpened()) {
          console.log("Waiting for chat client to connect...");
          return;
        }
        await fetchInitialMessages();
        // Mark this peer as fetched
        fetchedPeersRef.current.fetchedPeers.add(peerId);
      } catch (err) {
        console.error("Error while fetching:", err);
      }
    };

    checkAndFetch();
  }, [peerId, chatClient]);

  // Filter messages to only show current conversation when displaying

  const currentConversationMessages = messages.filter(
    (msg) => msg.peerId === peerId
  );

  // console.log("currentConversationMessages", currentConversationMessages);

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
    };

    if (showMediaPopup) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showMediaPopup]);

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
        console.log("Emoji event:", event); // Debug log
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

      // 3️⃣ Build chat message
      const payload = file.type.startsWith("image/")
        ? {
            type: "image",
            url: fileUrl,
            fileName: safeFileName,
            mimeType: file.type,
            size: file.size,
          }
        : {
            type: "file",
            url: fileUrl,
            fileName: safeFileName,
            mimeType: file.type,
            size: file.size,
          };

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

        console.log("Recording stopped. Duration:", {
          fromState: recordingDuration,
          fromRef: recordingDurationRef.current,
          calculated: actualDuration,
        });

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
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingStartTimeRef.current = Date.now(); // Record start time
      recordingDurationRef.current = 0; // Reset ref

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        recordingDurationRef.current += 1;
        setRecordingDuration((prev) => prev + 1);
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

      console.log(
        "Sending audio message with duration:",
        durationToUse,
        "seconds"
      );

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
    console.log("Opening image viewer:", url); // Debug log
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
    const baseMessage = {
      id: msg.id,
      sender: msg.from === userId ? "You" : msg.from,
      createdAt: new Date(msg.time),
      timestamp: new Date(msg.time).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      isIncoming: msg.from !== userId,
      peerId,
      avatar:
        msg.from === userId
          ? config.defaults.userAvatar
          : selectedContact?.avatar,
    };

    // Handle custom messages
    if (msg.type === "custom") {
      const customData = extractCustomMessageData(msg);

      if (customData && customData.type) {
        const type = String(customData.type).toLowerCase();
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
        }
      }

      // Fallback for custom messages without valid data
      return {
        ...baseMessage,
        content: msg.msg || msg.msgContent || msg.data || JSON.stringify(msg),
        messageType: "custom",
      };
    }

    // Handle text messages
    return {
      ...baseMessage,
      content: msg.msg || msg.msgContent || msg.data || "",
      messageType: "text",
    };
  };

  // 🔹 Fetch latest 20 messages from server
  const fetchInitialMessages = async () => {
    if (!peerId || !chatClient || !chatClientRef.current) {
      console.warn("chatClient or peerId missing, skipping fetch");
      return;
    }

    if (!chatClient.isOpened()) {
      console.warn("chatClient not connected yet");
      return;
    }
    try {
      const client = chatClientRef.current;
      console.log("fetching initial messages");
      const res = await client.getHistoryMessages({
        targetId: peerId,
        chatType: "singleChat",
        pageSize: config.chat.pageSize,
        searchDirection: "up",
      });
      if (res.cursor) setCursor(res.cursor);
      setHasMore(true);

      console.log("res", res);
      console.log("messages count:", res?.messages?.length);

      const oldMessages = res?.messages || [];

      const formatted = oldMessages.map((msg) => formatMessage(msg));

      // Merge with existing messages instead of replacing
      setMessages((prev) => {
        // Get existing messages for this peer
        const existingMessages = prev.filter((msg) => msg.peerId === peerId);

        // Create a set of existing message IDs to avoid duplicates
        const existingIds = new Set(existingMessages.map((msg) => msg.id));

        // Filter out fetched messages that already exist by ID
        const newFetchedMessages = formatted
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

        const serverMessagesByContent = new Map();
        newFetchedMessages.forEach((msg) => {
          const normalizedContent = normalizeContent(msg.content);
          const timeWindow = Math.floor(
            new Date(msg.createdAt).getTime() / 300000
          ); // 5-minute window
          const key = `${normalizedContent}-${msg.sender}-${timeWindow}`;
          if (!serverMessagesByContent.has(key)) {
            serverMessagesByContent.set(key, msg);
          }
        });

        // Replace log messages with server messages if they match
        const updatedExistingMessages = existingMessages.map((logMsg) => {
          // Only try to match messages from logs (have generated IDs)
          if (
            logMsg.id.startsWith("outgoing-") ||
            logMsg.id.startsWith("incoming-")
          ) {
            const normalizedContent = normalizeContent(logMsg.content);
            const timeWindow = Math.floor(
              new Date(logMsg.createdAt).getTime() / 300000
            ); // 5-minute window
            const key = `${normalizedContent}-${logMsg.sender}-${timeWindow}`;
            const serverMsg = serverMessagesByContent.get(key);
            if (serverMsg) {
              // Use server message (has correct timestamp) instead of log message
              console.log("Replacing log message with server message:", {
                logId: logMsg.id,
                serverId: serverMsg.id,
                logTime: logMsg.createdAt,
                serverTime: serverMsg.createdAt,
              });
              return serverMsg;
            }
          }
          return logMsg;
        });

        // Merge: keep updated existing messages + add new fetched ones
        // Combine and sort by timestamp to maintain chronological order
        const allMessages = [...updatedExistingMessages, ...newFetchedMessages]
          .filter(
            (msg, index, self) =>
              // Remove duplicates by ID
              index === self.findIndex((m) => m.id === msg.id)
          )
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
    if (!peerId || !chatClientRef.current || isFetchingHistory || !hasMore)
      return;

    try {
      setIsFetchingHistory(true);
      const client = chatClientRef.current;

      const chatArea = chatAreaRef.current;
      const prevScrollHeight = chatArea?.scrollHeight || 0;
      const prevScrollTop = chatArea?.scrollTop || 0;

      console.log("fetchMoreMessages called with:", { cursor, peerId });

      const res = await client.getHistoryMessages({
        targetId: peerId,
        chatType: "singleChat",
        cursor: cursor || undefined,
        pageSize: 20,
        searchDirection: "up",
      });

      const newMessages = res?.messages || [];
      if (newMessages.length === 0) {
        setHasMore(false);
        return;
      }

      if (res.cursor) setCursor(res.cursor);

      const formatted = newMessages.map((msg) => formatMessage(msg));

      // 🟡 Prevent scroll-to-bottom behavior
      isLoadingHistoryRef.current = true;
      skipAutoScrollRef.current = true;

      setMessages((prev) => {
        const existing = prev.filter((msg) => msg.peerId === peerId);
        const existingIds = new Set(existing.map((m) => m.id));
        const unique = formatted
          .reverse()
          .filter((m) => !existingIds.has(m.id));
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
      {/* Header */}
      <div className="chat-header">
        {onBackToConversations && (
          <button
            className="back-btn"
            onClick={onBackToConversations}
            title="Back to conversations"
            style={{
              background: "none",
              border: "none",
              color: "var(--text)",
              cursor: "pointer",
              padding: "0.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: "0.5rem",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div className="contact-info">
          <h2>{selectedContact?.name || "Select a Contact"}</h2>
          <p>{selectedContact?.lastSeen || ""}</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="nav-tabs">
        <button
          className={`tab ${activeTab === "Chat" ? "active" : ""}`}
          onClick={() => setActiveTab("Chat")}
        >
          Chat
        </button>
        <button
          className={`tab ${activeTab === "Info" ? "active" : ""}`}
          onClick={() => setActiveTab("Info")}
        >
          Info
        </button>
        <button
          className={`tab ${activeTab === "Description" ? "active" : ""}`}
          onClick={() => setActiveTab("Description")}
        >
          Description
        </button>
      </div>

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
          <div className="messages-container">
            {!peerId || currentConversationMessages.length === 0 ? (
              <div className="empty-chat">
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              // Render messages with day separators like WhatsApp
              (() => {
                const items = [];
                let lastDayKey = null;

                currentConversationMessages.forEach((msg, index) => {
                  const createdAt = msg.createdAt
                    ? new Date(msg.createdAt)
                    : new Date();
                  const dayKey = `${createdAt.getFullYear()}-${createdAt.getMonth()}-${createdAt.getDate()}`;
                  if (dayKey !== lastDayKey) {
                    lastDayKey = dayKey;
                    items.push(
                      <div
                        key={`day-${dayKey}-${index}`}
                        className="day-separator"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          margin: "0.75rem 0",
                          color: "#6b7280",
                          fontSize: "0.75rem",
                        }}
                      >
                        <div
                          style={{ flex: 1, height: 1, background: "#e5e7eb" }}
                        />
                        <span>{formatDateLabel(createdAt)}</span>
                        <div
                          style={{ flex: 1, height: 1, background: "#e5e7eb" }}
                        />
                      </div>
                    );
                  }

                  if (msg.messageType === "system" && msg.system) {
                    items.push(
                      <div
                        key={msg.id}
                        className="system-card"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          margin: "0.5rem auto",
                          background: "#f3f4f6",
                          color: "#111827",
                          borderRadius: "9999px",
                          padding: "0.4rem 0.75rem",
                          width: "fit-content",
                          maxWidth: "90%",
                          boxShadow: "inset 0 0 0 1px #e5e7eb",
                        }}
                      >
                        <span aria-hidden style={{ color: "#059669" }}>
                          {msg.system.kind === "new_nutritionist" ? "👤" : "🍽️"}
                        </span>
                        <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                          {msg.content}
                        </span>
                        <span
                          aria-hidden
                          style={{ marginLeft: 4, color: "#9ca3af" }}
                        >
                          ›
                        </span>
                      </div>
                    );
                  } else {
                    items.push(
                      <div
                        key={msg.id}
                        className={`message-wrapper ${
                          msg.isIncoming ? "incoming" : "outgoing"
                        }`}
                      >
                        {/* Avatar before message for incoming */}
                        {msg.isIncoming && (
                          <div className="message-avatar">
                            <img src={msg.avatar} alt={msg.sender} />
                          </div>
                        )}
                        <div className="message-content">
                          {msg.label && !msg.isIncoming && (
                            <div className="message-label">{msg.label}</div>
                          )}
                          <div className="message-bubble">
                            {msg.messageType === "image" &&
                            (msg.imageData || msg.imageUrl) ? (
                              <img
                                src={msg.imageData || msg.imageUrl}
                                alt={msg.fileName || "Image"}
                                className="message-image"
                                style={{
                                  maxWidth: "100%",
                                  maxHeight: "300px",
                                  borderRadius: "0.5rem",
                                  display: "block",
                                  cursor: "zoom-in",
                                  pointerEvents: "auto",
                                  userSelect: "none",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  openImageViewer(
                                    msg.imageData || msg.imageUrl,
                                    msg.fileName
                                  );
                                }}
                                onTouchStart={(e) => {
                                  e.stopPropagation();
                                }}
                                onTouchEnd={(e) => {
                                  e.stopPropagation();
                                  // Use setTimeout to avoid passive event listener issue
                                  setTimeout(() => {
                                    openImageViewer(
                                      msg.imageData || msg.imageUrl,
                                      msg.fileName
                                    );
                                  }, 0);
                                }}
                              />
                            ) : msg.messageType === "audio" && msg.audioUrl ? (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.25rem",
                                }}
                              >
                                <audio
                                  controls
                                  src={msg.audioUrl}
                                  style={{ width: 240 }}
                                  onPlay={(e) => {
                                    // Pause the previously playing audio if any
                                    if (
                                      currentlyPlayingAudioRef.current &&
                                      currentlyPlayingAudioRef.current !==
                                        e.target
                                    ) {
                                      currentlyPlayingAudioRef.current.pause();
                                    }
                                    // Set the current audio as the playing one
                                    currentlyPlayingAudioRef.current = e.target;
                                  }}
                                  onEnded={(e) => {
                                    // Clear the reference when audio ends
                                    if (
                                      currentlyPlayingAudioRef.current ===
                                      e.target
                                    ) {
                                      currentlyPlayingAudioRef.current = null;
                                    }
                                  }}
                                  onPause={(e) => {
                                    // Clear the reference when audio is paused
                                    if (
                                      currentlyPlayingAudioRef.current ===
                                      e.target
                                    ) {
                                      currentlyPlayingAudioRef.current = null;
                                    }
                                  }}
                                />
                                <div
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "#6b7280",
                                  }}
                                >
                                  {msg.audioTranscription || ""}
                                </div>
                              </div>
                            ) : msg.messageType === "file" &&
                              (msg.fileUrl || msg.fileName) ? (
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "36px 1fr 28px",
                                  gap: 10,
                                  alignItems: "center",
                                  maxWidth: 380,
                                }}
                              >
                                <div
                                  aria-hidden
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 8,
                                    background: "#fee2e2", // light red
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#b91c1c",
                                    fontWeight: 700,
                                    fontSize: 12,
                                  }}
                                >
                                  {msg.fileMime && msg.fileMime.includes("pdf")
                                    ? "PDF"
                                    : "FILE"}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontWeight: 600,
                                      color: "#0f172a",
                                    }}
                                  >
                                    {msg.fileUrl ? (
                                      <a
                                        href={msg.fileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ color: "#2563eb" }}
                                        download={msg.fileName || undefined}
                                      >
                                        {msg.fileName || msg.fileUrl}
                                      </a>
                                    ) : (
                                      msg.fileName
                                    )}
                                  </div>
                                  <div
                                    style={{ fontSize: 12, color: "#6b7280" }}
                                  >
                                    {(msg.fileMime || "file").toUpperCase()}
                                    {msg.fileSizeBytes != null
                                      ? ` • ${Math.round(
                                          msg.fileSizeBytes / 1024
                                        )} KB`
                                      : msg.fileSize
                                      ? ` • ${msg.fileSize} KB`
                                      : ""}
                                  </div>
                                </div>
                                <a
                                  href={msg.fileUrl || undefined}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 14,
                                    background: "#064e3b",
                                    color: "white",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    textDecoration: "none",
                                  }}
                                  title="Download"
                                  download={msg.fileName || undefined}
                                >
                                  ⬇
                                </a>
                              </div>
                            ) : msg.messageType === "products" &&
                              Array.isArray(msg.products) ? (
                              <div
                                style={{
                                  display: "grid",
                                  gap: 8,
                                  maxWidth: 380,
                                }}
                              >
                                {msg.products.slice(0, 3).map((p) => (
                                  <div
                                    key={p.id}
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "84px 1fr 16px",
                                      gap: 12,
                                      alignItems: "center",
                                      background: "#F3F4F6",
                                      borderRadius: 16,
                                      padding: 10,
                                      boxShadow: "inset 0 0 0 1px #E5E7EB",
                                    }}
                                  >
                                    <img
                                      src={p.imageUrl}
                                      alt={p.title}
                                      style={{
                                        width: 84,
                                        height: 84,
                                        objectFit: "cover",
                                        borderRadius: 12,
                                      }}
                                    />
                                    <div style={{ minWidth: 0 }}>
                                      <div
                                        style={{
                                          fontWeight: 700,
                                          lineHeight: 1.2,
                                          color: "#0F172A",
                                          display: "-webkit-box",
                                          WebkitLineClamp: 2,
                                          WebkitBoxOrient: "vertical",
                                          overflow: "hidden",
                                        }}
                                      >
                                        {p.title}
                                      </div>
                                      {p.description && (
                                        <div
                                          style={{
                                            marginTop: 2,
                                            color: "#6B7280",
                                            fontSize: 12,
                                            display: "-webkit-box",
                                            WebkitLineClamp: 1,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                          }}
                                        >
                                          {p.description}
                                        </div>
                                      )}
                                      <div style={{ marginTop: 6 }}>
                                        <div
                                          style={{
                                            fontWeight: 700,
                                            color: "#0F172A",
                                          }}
                                        >
                                          {formatCurrency(
                                            p.currentPrice ??
                                              p.originalPrice ??
                                              0
                                          )}
                                        </div>
                                        {p.originalPrice != null && (
                                          <div
                                            style={{
                                              color: "#9CA3AF",
                                              fontSize: 12,
                                              textDecoration: "line-through",
                                            }}
                                          >
                                            {formatCurrency(p.originalPrice)}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div
                                      aria-hidden
                                      style={{ color: "#9CA3AF", fontSize: 18 }}
                                    >
                                      ›
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : msg.messageType === "call" ? (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <span aria-hidden>
                                  {msg.callType === "video" ? "📹" : "📞"}
                                </span>
                                <div style={{ fontWeight: 600 }}>
                                  {msg.callType === "video"
                                    ? "Video call"
                                    : "Voice call"}
                                </div>
                                {msg.callDurationSeconds != null && (
                                  <div
                                    style={{
                                      fontSize: "0.8rem",
                                      color: "#6b7280",
                                    }}
                                  >
                                    {`${Math.floor(
                                      msg.callDurationSeconds / 60
                                    )}:${String(
                                      msg.callDurationSeconds % 60
                                    ).padStart(2, "0")}`}
                                  </div>
                                )}
                              </div>
                            ) : (
                              (() => {
                                // Fallback: if content is JSON with media, render accordingly
                                try {
                                  if (
                                    typeof msg.content === "string" &&
                                    msg.content.trim().startsWith("{")
                                  ) {
                                    const obj = JSON.parse(msg.content);
                                    if (
                                      obj &&
                                      typeof obj === "object" &&
                                      obj.type
                                    ) {
                                      const t = String(obj.type).toLowerCase();
                                      if (t === "image" && obj.url) {
                                        return (
                                          <img
                                            src={obj.url}
                                            alt={obj.fileName || "Image"}
                                            className="message-image"
                                            style={{
                                              maxWidth: "100%",
                                              maxHeight: "300px",
                                              borderRadius: "0.5rem",
                                              display: "block",
                                              cursor: "zoom-in",
                                              pointerEvents: "auto",
                                              userSelect: "none",
                                            }}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              openImageViewer(
                                                obj.url,
                                                obj.fileName
                                              );
                                            }}
                                            onTouchStart={(e) => {
                                              e.stopPropagation();
                                            }}
                                            onTouchEnd={(e) => {
                                              e.stopPropagation();
                                              // Use setTimeout to avoid passive event listener issue
                                              setTimeout(() => {
                                                openImageViewer(
                                                  obj.url,
                                                  obj.fileName
                                                );
                                              }, 0);
                                            }}
                                          />
                                        );
                                      }
                                      if (t === "file" && obj.url) {
                                        return (
                                          <div
                                            style={{
                                              display: "grid",
                                              gridTemplateColumns:
                                                "36px 1fr 28px",
                                              gap: 10,
                                              alignItems: "center",
                                              maxWidth: 380,
                                            }}
                                          >
                                            <div
                                              aria-hidden
                                              style={{
                                                width: 36,
                                                height: 36,
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
                                              {obj.mimeType &&
                                              obj.mimeType.includes("pdf")
                                                ? "PDF"
                                                : "FILE"}
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                              <div
                                                style={{
                                                  fontWeight: 600,
                                                  color: "#0f172a",
                                                }}
                                              >
                                                <a
                                                  href={obj.url}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  style={{ color: "#2563eb" }}
                                                  download={
                                                    obj.fileName || undefined
                                                  }
                                                >
                                                  {obj.fileName || obj.url}
                                                </a>
                                              </div>
                                              <div
                                                style={{
                                                  fontSize: 12,
                                                  color: "#6b7280",
                                                }}
                                              >
                                                {(
                                                  obj.mimeType || "file"
                                                ).toUpperCase()}
                                                {obj.size != null
                                                  ? ` • ${Math.round(
                                                      obj.size / 1024
                                                    )} KB`
                                                  : ""}
                                              </div>
                                            </div>
                                            <a
                                              href={obj.url}
                                              target="_blank"
                                              rel="noreferrer"
                                              style={{
                                                width: 28,
                                                height: 28,
                                                borderRadius: 14,
                                                background: "#064e3b",
                                                color: "white",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                textDecoration: "none",
                                              }}
                                              title="Download"
                                              download={
                                                obj.fileName || undefined
                                              }
                                            >
                                              ⬇
                                            </a>
                                          </div>
                                        );
                                      }
                                    }
                                  }
                                } catch {}
                                return (
                                  <div className="message-text">
                                    {msg.content}
                                  </div>
                                );
                              })()
                            )}
                          </div>
                          <div className="message-time">{msg.timestamp}</div>
                        </div>
                        {/* Avatar after message for outgoing */}
                        {!msg.isIncoming && (
                          <div className="message-avatar">
                            <img src={msg.avatar} alt={msg.sender} />
                          </div>
                        )}
                      </div>
                    );
                  }
                });
                return items;
              })()
            )}
          </div>
        )}
        {activeTab === "Info" && (
          <div className="tab-content">
            <div className="info-content">
              <h3>Contact Information</h3>
              <div className="info-item">
                <strong>Name:</strong> {selectedContact?.name || "N/A"}
              </div>
              <div className="info-item">
                <strong>User ID:</strong> {selectedContact?.id || "N/A"}
              </div>
              <div className="info-item">
                <strong>Last Seen:</strong> {selectedContact?.lastSeen || "N/A"}
              </div>
              {selectedContact?.avatar && (
                <div className="info-item">
                  <strong>Avatar:</strong>
                  <img
                    src={selectedContact.avatar}
                    alt={selectedContact.name}
                    style={{
                      width: "100px",
                      height: "100px",
                      borderRadius: "50%",
                      marginTop: "0.5rem",
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === "Description" && (
          <div className="tab-content">
            <div className="description-content">
              <h3>Description</h3>
              <p>
                {selectedContact?.description ||
                  "No description available for this contact."}
              </p>
            </div>
          </div>
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
            {(typeof message === "string" ? message.trim() : message) ||
            draftAttachment ? (
              <button
                className="send-button"
                onClick={handleSendMessage}
                disabled={
                  !selectedContact ||
                  (!draftAttachment &&
                    !(typeof message === "string" ? message.trim() : message))
                }
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            ) : null}
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
            <button
              title="Attach emoji"
              ref={buttonRef}
              className="emoji-button"
              onClick={toggleEmojiPicker}
            >
              <Smile />
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
                <div className="media-icon-overlay">
                  <svg
                    width="14"
                    height="14"
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
                </div>
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

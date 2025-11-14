import { Video } from "lucide-react";

export default function ChatHeader({
  selectedContact,
  activeTab,
  onTabChange,
  onBackToConversations,
  onInitiateCall,
}) {
  return (
    <>
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
        <div className="contact-info" style={{ flex: 1 }}>
          <h2>{selectedContact?.name || "Select a Contact"}</h2>
          <p>{selectedContact?.lastSeen || ""}</p>
        </div>
        {selectedContact && onInitiateCall && (
          <button
            onClick={onInitiateCall}
            title="Start video call"
            style={{
              background: "none",
              border: "none",
              color: "var(--text)",
              cursor: "pointer",
              padding: "0.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Video size={24} />
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="nav-tabs">
        <button
          className={`tab ${activeTab === "Chat" ? "active" : ""}`}
          onClick={() => onTabChange("Chat")}
        >
          Chat
        </button>
        <button
          className={`tab ${activeTab === "Info" ? "active" : ""}`}
          onClick={() => onTabChange("Info")}
        >
          Info
        </button>
        <button
          className={`tab ${activeTab === "Description" ? "active" : ""}`}
          onClick={() => onTabChange("Description")}
        >
          Description
        </button>
      </div>
    </>
  );
}

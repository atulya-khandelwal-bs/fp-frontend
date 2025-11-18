import { Video, Phone } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export default function ChatHeader({
  selectedContact,
  activeTab,
  onTabChange,
  onBackToConversations,
  onInitiateCall,
}) {
  const [showCallMenu, setShowCallMenu] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowCallMenu(false);
      }
    };

    if (showCallMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showCallMenu]);

  const handleVideoCall = () => {
    if (onInitiateCall) {
      onInitiateCall("video");
    }
    setShowCallMenu(false);
  };

  const handleAudioCall = () => {
    if (onInitiateCall) {
      onInitiateCall("audio");
    }
    setShowCallMenu(false);
  };

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
          <div style={{ position: "relative" }} ref={menuRef}>
            <button
              onClick={() => setShowCallMenu(!showCallMenu)}
              title="Start call"
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
            {showCallMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: "0",
                  marginTop: "0.5rem",
                  background: "white",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                  padding: "0.5rem",
                  zIndex: 1000,
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                  minWidth: "150px",
                }}
              >
                <button
                  onClick={handleVideoCall}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.5rem",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    borderRadius: "4px",
                    color: "var(--text)",
                    textAlign: "left",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = "rgba(0, 0, 0, 0.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = "transparent";
                  }}
                >
                  <Video size={18} />
                  <span>Video Call</span>
                </button>
                <button
                  onClick={handleAudioCall}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.5rem",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    borderRadius: "4px",
                    color: "var(--text)",
                    textAlign: "left",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = "rgba(0, 0, 0, 0.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = "transparent";
                  }}
                >
                  <Phone size={18} />
                  <span>Audio Call</span>
                </button>
              </div>
            )}
          </div>
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

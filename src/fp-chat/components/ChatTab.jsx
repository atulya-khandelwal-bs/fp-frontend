import { Video } from "lucide-react";
import UserCheckIcon from "../assets/UserCheck.svg";
import SealCheckIcon from "../assets/SealCheck.svg";
import ForkKnifeIcon from "../assets/ForkKnife.svg";

export default function ChatTab({
  peerId,
  currentConversationMessages,
  selectedContact,
  userId,
  formatDateLabel,
  formatCurrency,
  openImageViewer,
  currentlyPlayingAudioRef,
}) {
  return (
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
                  <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                  <span>{formatDateLabel(createdAt)}</span>
                  <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                </div>
              );
            }

            if (msg.messageType === "system" && msg.system) {
              // Special handling for new_nutritionist
              if (msg.system.kind === "new_nutritionist") {
                items.push(
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      margin: "0.75rem 0",
                      width: "100%",
                    }}
                  >
                    {/* Horizontal line with centered notification bubble */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                        position: "relative",
                        margin: "0.5rem 0",
                      }}
                    >
                      {/* Left line */}
                      <div
                        style={{
                          flex: 1,
                          height: "1px",
                          background: "#E5E7EB",
                        }}
                      />
                      {/* Notification bubble */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          margin: "0 12px",
                          background: "white",
                          color: "#0A1F34",
                          borderRadius: "20px",
                          padding: "8px 16px",
                          width: "fit-content",
                          border: "1px solid #E7E9EB",
                          boxShadow: "0px 1px 2px 0px rgba(35, 37, 52, 0.06)",
                          position: "relative",
                          zIndex: 1,
                        }}
                      >
                        {/* UserCheck icon */}
                        <img
                          src={UserCheckIcon}
                          alt="User check"
                          style={{
                            width: "16px",
                            height: "16px",
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: "14px",
                            lineHeight: "1.2em",
                            color: "#0A1F34",
                          }}
                        >
                          New nutritionist assigned
                        </span>
                      </div>
                      {/* Right line */}
                      <div
                        style={{
                          flex: 1,
                          height: "1px",
                          background: "#E5E7EB",
                        }}
                      />
                    </div>

                    {/* Nutritionist card */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        background: "white",
                        borderRadius: "12px",
                        padding: "12px",
                        border: "1px solid #E7E9EB",
                        boxShadow: "0px 1px 2px 0px rgba(35, 37, 52, 0.06)",
                        cursor: "pointer",
                        width: "100%",
                      }}
                      onClick={() => {
                        // Handle card click - you can add navigation or modal here
                        console.log("Nutritionist clicked:", msg.system);
                      }}
                    >
                      {/* Profile photo */}
                      <div
                        style={{
                          width: "56px",
                          height: "56px",
                          borderRadius: "50%",
                          overflow: "hidden",
                          flexShrink: 0,
                          background: "#F3F4F6",
                          border: "1px solid #E7E9EB",
                        }}
                      >
                        {msg.system.profilePhoto ? (
                          <img
                            src={msg.system.profilePhoto}
                            alt={msg.system.name || "Nutritionist"}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                            onError={(e) => {
                              e.target.style.display = "none";
                              e.target.parentElement.style.display = "flex";
                              e.target.parentElement.style.alignItems =
                                "center";
                              e.target.parentElement.style.justifyContent =
                                "center";
                              e.target.parentElement.style.color = "#9CA3AF";
                              e.target.parentElement.style.fontSize = "20px";
                              e.target.parentElement.textContent = (msg.system
                                .name || "N")[0].toUpperCase();
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#9CA3AF",
                              fontSize: "20px",
                              fontWeight: 600,
                            }}
                          >
                            {(msg.system.name || "N")[0].toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Name and title */}
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: "16px",
                              lineHeight: "1.2em",
                              color: "#0A1F34",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {msg.system.name || "Nutritionist"}
                          </span>
                          {/* Verified badge */}
                          <img
                            src={SealCheckIcon}
                            alt="Verified"
                            style={{
                              width: "16px",
                              height: "16px",
                              flexShrink: 0,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: "14px",
                            lineHeight: "1.2em",
                            color: "#6C7985",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {msg.system.title || ""}
                        </span>
                      </div>

                      {/* Right arrow icon */}
                      <div
                        style={{
                          width: "20px",
                          height: "20px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          color: "#6C7985",
                        }}
                        aria-hidden="true"
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M7.5 5L12.5 10L7.5 15"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                );
              } else {
                // Other system messages (meal_plan_updated, etc.)
                items.push(
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      width: "100%",
                      position: "relative",
                      margin: "0.5rem 0",
                    }}
                  >
                    {/* Left line */}
                    <div
                      style={{
                        flex: 1,
                        height: "1px",
                        background: "#E5E7EB",
                      }}
                    />
                    {/* Message bubble */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                        margin: "0 12px",
                        background: "#f3f4f6",
                        color: "#111827",
                        borderRadius: "9999px",
                        padding: "0.4rem 0.75rem",
                        width: "fit-content",
                        boxShadow: "inset 0 0 0 1px #e5e7eb",
                        position: "relative",
                        zIndex: 1,
                      }}
                    >
                      <img
                        src={ForkKnifeIcon}
                        alt="Fork and knife"
                        style={{
                          width: "16px",
                          height: "16px",
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                        {typeof msg.content === "string"
                          ? msg.content
                          : typeof msg.content === "object"
                          ? msg.content.body || JSON.stringify(msg.content)
                          : String(msg.content || "")}
                      </span>
                      <span
                        aria-hidden
                        style={{ marginLeft: 4, color: "#9ca3af" }}
                      >
                        ›
                      </span>
                    </div>
                    {/* Right line */}
                    <div
                      style={{
                        flex: 1,
                        height: "1px",
                        background: "#E5E7EB",
                      }}
                    />
                  </div>
                );
              }
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
                      <div className="message-sender-name">
                        {msg.isIncoming
                          ? selectedContact?.name || msg.sender
                          : msg.sender || userId}
                      </div>
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
                                currentlyPlayingAudioRef.current !== e.target
                              ) {
                                currentlyPlayingAudioRef.current.pause();
                              }
                              // Set the current audio as the playing one
                              currentlyPlayingAudioRef.current = e.target;
                            }}
                            onEnded={(e) => {
                              // Clear the reference when audio ends
                              if (
                                currentlyPlayingAudioRef.current === e.target
                              ) {
                                currentlyPlayingAudioRef.current = null;
                              }
                            }}
                            onPause={(e) => {
                              // Clear the reference when audio is paused
                              if (
                                currentlyPlayingAudioRef.current === e.target
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
                            <div style={{ fontSize: 12, color: "#6b7280" }}>
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
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                            maxWidth: "100%",
                          }}
                        >
                          {/* Product count label */}
                          <div
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              lineHeight: "1.2em",
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                              color: "#6C7985",
                              marginBottom: "6px",
                            }}
                          >
                            {msg.products.length} product
                            {msg.products.length !== 1 ? "s" : ""}
                          </div>
                          {/* Horizontal scrollable product cards */}
                          <div
                            style={{
                              display: "flex",
                              gap: "6px",
                              overflowX: "auto",
                              overflowY: "hidden",
                              scrollbarWidth: "thin",
                              paddingBottom: "4px",
                            }}
                          >
                            {msg.products.map((p) => {
                              const productName =
                                p.name || p.title || "Product";
                              const productImage =
                                p.image || p.imageUrl || p.photoUrl || "";
                              const currentPrice =
                                p.price ||
                                p.currentPrice ||
                                p.originalPrice ||
                                0;
                              const originalPrice =
                                p.originalPrice &&
                                p.originalPrice !== currentPrice
                                  ? p.originalPrice
                                  : null;

                              return (
                                <div
                                  key={p.id}
                                  style={{
                                    width: "120px",
                                    height: "208px",
                                    background: "rgba(35, 37, 52, 0.08)",
                                    borderRadius: "10px",
                                    padding: "4px",
                                    boxShadow:
                                      "0px 2px 6px 0px rgba(35, 37, 52, 0.06)",
                                    display: "flex",
                                    flexDirection: "column",
                                    position: "relative",
                                    flexShrink: 0,
                                    cursor: "pointer",
                                  }}
                                  onClick={() => {
                                    // Handle product click - you can add navigation or modal here
                                    console.log("Product clicked:", p);
                                  }}
                                >
                                  {/* Product Image */}
                                  <div
                                    style={{
                                      width: "112px",
                                      height: "112px",
                                      borderRadius: "10px",
                                      overflow: "hidden",
                                      background: "#FFFFFF",
                                      border: "1px solid #E7E9EB",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    {productImage ? (
                                      <img
                                        src={productImage}
                                        alt={productName}
                                        style={{
                                          width: "100%",
                                          height: "100%",
                                          objectFit: "cover",
                                        }}
                                        onError={(e) => {
                                          e.target.style.display = "none";
                                        }}
                                      />
                                    ) : (
                                      <div
                                        style={{
                                          width: "100%",
                                          height: "100%",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          color: "#9CA3AF",
                                          fontSize: "12px",
                                        }}
                                      >
                                        No Image
                                      </div>
                                    )}
                                  </div>

                                  {/* Product Name */}
                                  <div
                                    style={{
                                      padding: "0 6px",
                                      marginTop: "auto",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: "14px",
                                        fontWeight: 600,
                                        lineHeight: "1.14em",
                                        color: "#0A1F34",
                                        display: "-webkit-box",
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: "vertical",
                                        overflow: "hidden",
                                        minHeight: "32px",
                                      }}
                                    >
                                      {productName}
                                    </div>
                                  </div>

                                  {/* Price Section */}
                                  <div
                                    style={{
                                      padding: "0 6px",
                                      marginBottom: "4px",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "2px",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: "14px",
                                        fontWeight: 700,
                                        lineHeight: "1em",
                                        letterSpacing: "0.014em",
                                        color: "#0A1F34",
                                      }}
                                    >
                                      {formatCurrency(currentPrice)}
                                    </div>
                                    {originalPrice && (
                                      <div
                                        style={{
                                          fontSize: "14px",
                                          fontWeight: 400,
                                          lineHeight: "1em",
                                          letterSpacing: "0.014em",
                                          color: "#6C7985",
                                          textDecoration: "line-through",
                                        }}
                                      >
                                        {formatCurrency(originalPrice)}
                                      </div>
                                    )}
                                  </div>

                                  {/* Right Arrow Icon */}
                                  <div
                                    style={{
                                      position: "absolute",
                                      bottom: "4px",
                                      right: "4px",
                                      width: "12px",
                                      height: "12px",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                    aria-hidden="true"
                                  >
                                    <svg
                                      width="12"
                                      height="12"
                                      viewBox="0 0 12 12"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        d="M4.5 2.25L7.5 6L4.5 9.75"
                                        stroke="#232534"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : msg.messageType === "call" ? (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <Video
                            size={18}
                            style={{
                              color: "#2563eb",
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontWeight: 600,
                              color: "var(--text)",
                            }}
                          >
                            {msg.callType === "video"
                              ? "Video call"
                              : "Voice call"}
                          </span>
                          {msg.callDurationSeconds != null && (
                            <span
                              style={{
                                fontSize: "0.8rem",
                                color: "#6b7280",
                                marginLeft: "0.25rem",
                              }}
                            >
                              {`${Math.floor(
                                msg.callDurationSeconds / 60
                              )}:${String(
                                msg.callDurationSeconds % 60
                              ).padStart(2, "0")}`}
                            </span>
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
                              if (obj && typeof obj === "object" && obj.type) {
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
                                        openImageViewer(obj.url, obj.fileName);
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
                                            download={obj.fileName || undefined}
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
                                        download={obj.fileName || undefined}
                                      >
                                        ⬇
                                      </a>
                                    </div>
                                  );
                                }
                                if (t === "call") {
                                  return (
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                      }}
                                    >
                                      <Video
                                        size={18}
                                        style={{
                                          color: "#2563eb",
                                          flexShrink: 0,
                                        }}
                                      />
                                      <span
                                        style={{
                                          fontWeight: 600,
                                          color: "var(--text)",
                                        }}
                                      >
                                        {obj.callType === "video"
                                          ? "Video call"
                                          : "Voice call"}
                                      </span>
                                      {obj.duration != null && (
                                        <span
                                          style={{
                                            fontSize: "0.8rem",
                                            color: "#6b7280",
                                            marginLeft: "0.25rem",
                                          }}
                                        >
                                          {`${Math.floor(
                                            obj.duration / 60
                                          )}:${String(
                                            obj.duration % 60
                                          ).padStart(2, "0")}`}
                                        </span>
                                      )}
                                    </div>
                                  );
                                }
                                if (
                                  (t === "new_nutritionist" ||
                                    t === "new_nutrionist") &&
                                  obj.name
                                ) {
                                  return (
                                    <div
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "12px",
                                        margin: "0.75rem 0",
                                        width: "100%",
                                      }}
                                    >
                                      {/* Horizontal line with centered notification bubble */}
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          width: "100%",
                                          position: "relative",
                                          margin: "0.5rem 0",
                                        }}
                                      >
                                        {/* Left line */}
                                        <div
                                          style={{
                                            flex: 1,
                                            height: "1px",
                                            background: "#E5E7EB",
                                          }}
                                        />
                                        {/* Notification bubble */}
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: "6px",
                                            margin: "0 12px",
                                            background: "white",
                                            color: "#0A1F34",
                                            borderRadius: "20px",
                                            padding: "8px 16px",
                                            width: "fit-content",
                                            border: "1px solid #E7E9EB",
                                            boxShadow:
                                              "0px 1px 2px 0px rgba(35, 37, 52, 0.06)",
                                            position: "relative",
                                            zIndex: 1,
                                          }}
                                        >
                                          {/* UserCheck icon */}
                                          <img
                                            src={UserCheckIcon}
                                            alt="User check"
                                            style={{
                                              width: "16px",
                                              height: "16px",
                                              flexShrink: 0,
                                            }}
                                          />
                                          <span
                                            style={{
                                              fontWeight: 600,
                                              fontSize: "14px",
                                              lineHeight: "1.2em",
                                              color: "#0A1F34",
                                            }}
                                          >
                                            New nutritionist assigned
                                          </span>
                                        </div>
                                        {/* Right line */}
                                        <div
                                          style={{
                                            flex: 1,
                                            height: "1px",
                                            background: "#E5E7EB",
                                          }}
                                        />
                                      </div>

                                      {/* Nutritionist card */}
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "12px",
                                          background: "white",
                                          borderRadius: "12px",
                                          padding: "12px",
                                          border: "1px solid #E7E9EB",
                                          boxShadow:
                                            "0px 1px 2px 0px rgba(35, 37, 52, 0.06)",
                                          cursor: "pointer",
                                          width: "100%",
                                        }}
                                        onClick={() => {
                                          console.log(
                                            "Nutritionist clicked:",
                                            obj
                                          );
                                        }}
                                      >
                                        {/* Profile photo */}
                                        <div
                                          style={{
                                            width: "56px",
                                            height: "56px",
                                            borderRadius: "50%",
                                            overflow: "hidden",
                                            flexShrink: 0,
                                            background: "#F3F4F6",
                                            border: "1px solid #E7E9EB",
                                          }}
                                        >
                                          {obj.profilePhoto ? (
                                            <img
                                              src={obj.profilePhoto}
                                              alt={obj.name || "Nutritionist"}
                                              style={{
                                                width: "100%",
                                                height: "100%",
                                                objectFit: "cover",
                                              }}
                                              onError={(e) => {
                                                e.target.style.display = "none";
                                                e.target.parentElement.style.display =
                                                  "flex";
                                                e.target.parentElement.style.alignItems =
                                                  "center";
                                                e.target.parentElement.style.justifyContent =
                                                  "center";
                                                e.target.parentElement.style.color =
                                                  "#9CA3AF";
                                                e.target.parentElement.style.fontSize =
                                                  "20px";
                                                e.target.parentElement.textContent =
                                                  (obj.name ||
                                                    "N")[0].toUpperCase();
                                              }}
                                            />
                                          ) : (
                                            <div
                                              style={{
                                                width: "100%",
                                                height: "100%",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                color: "#9CA3AF",
                                                fontSize: "20px",
                                                fontWeight: 600,
                                              }}
                                            >
                                              {(obj.name ||
                                                "N")[0].toUpperCase()}
                                            </div>
                                          )}
                                        </div>

                                        {/* Name and title */}
                                        <div
                                          style={{
                                            flex: 1,
                                            minWidth: 0,
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "4px",
                                          }}
                                        >
                                          <div
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: "6px",
                                            }}
                                          >
                                            <span
                                              style={{
                                                fontWeight: 700,
                                                fontSize: "16px",
                                                lineHeight: "1.2em",
                                                color: "#0A1F34",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                              }}
                                            >
                                              {obj.name || "Nutritionist"}
                                            </span>
                                            {/* Verified badge */}
                                            <img
                                              src={SealCheckIcon}
                                              alt="Verified"
                                              style={{
                                                width: "16px",
                                                height: "16px",
                                                flexShrink: 0,
                                              }}
                                            />
                                          </div>
                                          <span
                                            style={{
                                              fontSize: "14px",
                                              lineHeight: "1.2em",
                                              color: "#6C7985",
                                              overflow: "hidden",
                                              textOverflow: "ellipsis",
                                              whiteSpace: "nowrap",
                                            }}
                                          >
                                            {obj.title || ""}
                                          </span>
                                        </div>

                                        {/* Right arrow icon */}
                                        <div
                                          style={{
                                            width: "20px",
                                            height: "20px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            flexShrink: 0,
                                            color: "#6C7985",
                                          }}
                                          aria-hidden="true"
                                        >
                                          <svg
                                            width="20"
                                            height="20"
                                            viewBox="0 0 20 20"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                          >
                                            <path
                                              d="M7.5 5L12.5 10L7.5 15"
                                              stroke="currentColor"
                                              strokeWidth="1.5"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                            />
                                          </svg>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                              }
                            }
                          } catch {}
                          // Ensure content is always a string
                          const contentToRender =
                            typeof msg.content === "string"
                              ? msg.content
                              : typeof msg.content === "object"
                              ? msg.content.body || JSON.stringify(msg.content)
                              : String(msg.content || "");
                          return (
                            <div className="message-text">
                              {contentToRender}
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
  );
}

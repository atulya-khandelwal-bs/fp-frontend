/**
 * Helper function to build customExts based on message payload
 * Used when sending custom messages (images, files, audio, etc.)
 */
export function buildCustomExts(payload) {
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
        callType: payload.callType || "video", // "voice" or "video"
        channel: payload.channel || "",
        from: payload.from || "",
        to: payload.to || "",
        action: payload.action || "initiate", // "initiate", "accept", "reject", "end"
        duration: payload.duration, // in seconds (optional)
      };

    default:
      // For unknown types, return the payload as-is
      return payload;
  }
}

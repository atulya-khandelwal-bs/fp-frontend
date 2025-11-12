/**
 * Application Configuration
 *
 * For production, use environment variables to override these values.
 * Create a .env file in the root directory with:
 * VITE_AGORA_APP_KEY=your_app_key
 * VITE_CHAT_TOKEN_API_URL=your_chat_token_api_url
 * VITE_BACKEND_API_URL=your_backend_api_url
 */

const config = {
  // Agora Chat Configuration
  agora: {
    appKey: import.meta.env.VITE_AGORA_APP_KEY || "611360328#1609888",
  },

  // API Endpoints
  api: {
    // Backend API base URL
    backend:
      import.meta.env.VITE_BACKEND_API_URL ||
      "https://fitpass-backend-1073769052082.asia-south2.run.app",

    // Specific API endpoints (constructed from base URL)
    get generateToken() {
      return `${this.backend}/api/chat/generate-token`;
    },

    get generatePresignUrl() {
      return `${this.backend}/api/s3/generate-presign-url`;
    },

    get registerUserEndpoint() {
      return `${this.backend}/api/chat/register-user`;
    },
  },

  // Default Images/Avatars
  defaults: {
    avatar:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face",
    userAvatar:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face",
  },

  // Token Configuration
  token: {
    expireInSecs: 3600, // 1 hour
  },

  // S3 Upload Configuration
  upload: {
    expiresInMinutes: 15,
  },

  // Chat Configuration
  chat: {
    pageSize: 20, // Number of messages to fetch per page
  },
};

export default config;

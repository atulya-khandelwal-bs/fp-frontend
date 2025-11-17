/**
 * Application Configuration
 *
 * For production, use environment variables to override these values.
 * Create a .env file in the root directory with:
 *
 * Required:
 * - VITE_AGORA_APP_KEY=your_chat_app_key (for Agora Chat SDK)
 * - VITE_RTC_APP_ID=your_rtc_app_id (for Agora RTC SDK - separate from Chat App Key)
 * - VITE_BACKEND_API_URL=your_backend_api_url (base URL only, no routes)
 */

const config = {
  // Agora Chat Configuration
  agora: {
    // Chat App Key (for Agora Chat SDK)
    appKey: import.meta.env.VITE_AGORA_APP_KEY,

    // RTC App ID (for Agora RTC SDK - separate from Chat App Key)
    rtcAppId: import.meta.env.VITE_RTC_APP_ID,
  },

  // API Endpoints
  api: {
    // Backend API base URL
    backend: import.meta.env.VITE_BACKEND_API_URL,

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

    get fetchCoaches() {
      return `${this.backend}/api/fetch-coaches`;
    },

    get fetchConversations() {
      return `${this.backend}/api/fetch-conversations`;
    },

    get fetchMessages() {
      return `${this.backend}/api/chat/fetch-messages`;
    },

    get sendMealPlanUpdate() {
      return `${this.backend}/api/chat/send-mean-plan-update-message`;
    },

    get healthCoachChanged() {
      return `${this.backend}/api/chat/health-coach-changed-message`;
    },

    get sendProducts() {
      return `${this.backend}/api/chat/send-product-message`;
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

  // RTC Token API (constructed from backend base URL)
  rtcToken: {
    get apiUrl() {
      return `${config.api.backend}/api/rtc/generate-token`;
    },
  },
};

export default config;

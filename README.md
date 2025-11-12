# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Configuration

This application uses a centralized configuration file located at `src/config.js`. All API endpoints, credentials, and default values are managed through this file.

### Environment Variables

For production deployments, you can override configuration values using environment variables. Create a `.env` file in the root directory with the following variables:

```env
# Agora Chat Configuration
VITE_AGORA_APP_KEY=your_app_key_here

# API Endpoints
VITE_CHAT_TOKEN_API_URL=https://your-chat-token-api-url.com
VITE_BACKEND_API_URL=https://your-backend-api-url.com
```

**Note:** All environment variables must be prefixed with `VITE_` to be accessible in Vite applications.

### Configuration Structure

The config file (`src/config.js`) contains:

- **Agora Chat**: App key for Agora Chat service
- **API Endpoints**: All backend API URLs
- **Defaults**: Default avatar images and other default values
- **Token Configuration**: Token expiration settings
- **Upload Configuration**: S3 upload settings
- **Chat Configuration**: Chat-related settings like page size

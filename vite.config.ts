import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: [
      "destined-wallaby-tops.ngrok-free.app",
      "localhost",
      "127.0.0.1",
      ".ngrok-free.app", // 允许所有ngrok免费域名
      ".ngrok.io", // 允许所有ngrok域名
    ],
    // 添加代理配置，将API请求转发到后端
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

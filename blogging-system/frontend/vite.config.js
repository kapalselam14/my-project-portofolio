import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        // ws: true, // only needed for WebSocket
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Forward all headers from original request
            Object.keys(req.headers).forEach((key) => {
              proxyReq.setHeader(key, req.headers[key]);
            });
          });
        }
      }}
    }
  });

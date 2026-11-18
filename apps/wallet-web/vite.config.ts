import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Campus Credential Wallet",
        short_name: "CampusCred",
        description: "Decentralized identity wallet for campus credentials",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    }),
  ],
  server: { port: 5173, host: true },
});

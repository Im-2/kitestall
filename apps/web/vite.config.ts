import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const api = "http://localhost:8787";
export default defineConfig({ plugins: [react()], server: { proxy: { "/shops": api, "/api": api, "/owner": api, "/receipts": api, "/verify": api, "/.well-known": api, "/llms.txt": api } } });

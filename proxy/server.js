const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");


//ChatGPT hat kleinen Proxy gebaut, der kann erstmal ignoriert werden. bitte erstmal drin lassen


const app = express();

// Backend (Quart) weiterleiten
app.use("/api", createProxyMiddleware({
  target: "http://localhost:5050", // Quart-Server
  changeOrigin: true,
  logLevel: "debug",               // zeigt, welche Requests weitergeleitet werden
}));

// Frontend (React Vite) weiterleiten
app.use("/", createProxyMiddleware({
  target: "http://localhost:5173", // Vite-Dev-Server
  changeOrigin: true,
  ws: true,                        // WebSocket für HMR
  logLevel: "debug",
}));

// Proxy-Port (z. B. 5051)
const PORT = 5051;
app.listen(PORT, () => console.log(`Proxy läuft auf http://localhost:${PORT}`));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const ngrok = require("ngrok");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Backend (Quart) weiterleiten
app.use("/api", createProxyMiddleware({
  target: "http://localhost:5050",
  changeOrigin: true,
  logLevel: "debug",
}));

// Frontend (Vite Dev Server)
app.use("/", createProxyMiddleware({
  target: "http://localhost:5173",
  changeOrigin: true,
  ws: true,
  logLevel: "debug",
}));

const PORT = 5051;
app.listen(PORT, async () => {
  console.log(`Proxy läuft lokal auf http://localhost:${PORT}`);

  try {
    const url = await ngrok.connect({
      authtoken: process.env.NGROK_AUTHTOKEN, // Token aus den Env Vars
      addr: PORT,
    });
    console.log(`Öffentliche URL: ${url}`);
  } catch (err) {
    console.error("ngrok Fehler:", err);
  }
});

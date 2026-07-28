// Electron drag-and-drop: accept OS file drops (runs before React mounts)
document.addEventListener("dragenter", (e) => { e.preventDefault(); });
document.addEventListener("dragover", (e) => { e.preventDefault(); });

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.js";
import { AuthProvider } from "./auth.js";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("App root element was not found");

createRoot(rootElement).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);

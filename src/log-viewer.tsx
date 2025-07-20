import React from "react";
import ReactDOM from "react-dom/client";
import { LogViewerPage } from "./components/logs/LogViewerPage";
import "./lib/i18n";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LogViewerPage />
  </React.StrictMode>
);
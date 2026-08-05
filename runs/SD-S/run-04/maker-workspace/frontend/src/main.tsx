import React from "react";
import { createRoot } from "react-dom/client";
import { Collection } from "./pages/Collection";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div className="app">
      <h1>Bookmarks</h1>
      <Collection />
    </div>
  </React.StrictMode>,
);

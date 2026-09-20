import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { cloudFormLogoUrl } from "@/components/logo";
import { App } from "./app";
import "./styles.css";

const icon = document.createElement("link");
icon.rel = "icon";
icon.type = "image/svg+xml";
icon.href = cloudFormLogoUrl;
document.head.appendChild(icon);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

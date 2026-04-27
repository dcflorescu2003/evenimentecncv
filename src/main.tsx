import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Capacitor } from "@capacitor/core";

// Inițializare StatusBar pentru native (iOS/Android).
// Pe Android: sistemul rezervă spațiu pentru status bar, conținutul nu se mai suprapune.
// Pe iOS: doar setăm stilul; safe-area-ul îl gestionează CSS-ul.
if (Capacitor.isNativePlatform()) {
  import("@capacitor/status-bar").then(({ StatusBar, Style }) => {
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
    StatusBar.setStyle({ style: Style.Default }).catch(() => {});
    if (Capacitor.getPlatform() === "android") {
      StatusBar.setBackgroundColor({ color: "#ffffff" }).catch(() => {});
    }
  }).catch((err) => console.warn("StatusBar init failed:", err));
}

createRoot(document.getElementById("root")!).render(<App />);

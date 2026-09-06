import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";

// Capacitor 8 / Android 16 folosește obligatoriu afișarea edge-to-edge.
// SystemBars furnizează variabilele CSS corecte pentru zonele sigure native.
if (Capacitor.isNativePlatform()) {
  SystemBars.setStyle({ style: SystemBarsStyle.Dark }).catch((err) =>
    console.warn("SystemBars init failed:", err),
  );
}

createRoot(document.getElementById("root")!).render(<App />);

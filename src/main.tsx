import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { initializeSupabase } from "./lib/supabase";
import "./index.css";
import "./ego-motion.css";

void initializeSupabase().finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});

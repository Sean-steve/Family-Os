import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import {finishLiveCallback} from "./live/auth";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Family OS root element missing");
void finishLiveCallback().finally(()=>createRoot(root).render(<React.StrictMode><App /></React.StrictMode>));

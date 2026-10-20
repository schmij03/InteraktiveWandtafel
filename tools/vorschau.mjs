#!/usr/bin/env node
// Zeigt die Website lokal im Browser: http://localhost:8080
import { serverStarten } from "./server.mjs";

const PORT = parseInt(process.env.PORT || process.argv[2] || "8080", 10);
await serverStarten(PORT);
console.log(`Vorschau: http://localhost:${PORT}  (beenden mit Ctrl+C)`);

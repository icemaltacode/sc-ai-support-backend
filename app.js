import express from "express";
import cors from "cors";
import { loadFactsheet } from "./utils/pdf.js";
import chatRouter from "./routes/chat.js";
import suggestionRouter from "./routes/suggestions.js";


await loadFactsheet();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/chat", chatRouter);
app.use("/suggestions", suggestionRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
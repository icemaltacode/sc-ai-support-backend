import express from "express";
import { openai } from "../openai/index.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "Invalid or missing messages array" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        ...messages,
        {
          role: "system",
          content: "Based on the above conversation, suggest 2–3 helpful and natural follow-up questions the user might ask next. Respond with a plain JSON array of short questions only, no extra text."
        }
      ],
      temperature: 0.7,
    });

    // Extract JSON array from response text
    const raw = completion.choices[0]?.message?.content?.trim() || "[]";
    let suggestions = [];

    try {
      suggestions = JSON.parse(raw);
    } catch {
      // fallback: try to extract array manually if not valid JSON
      suggestions = raw
        .split("\n")
        .filter(line => line.trim().startsWith("-"))
        .map(line => line.replace(/^[-*]\s*/, "").trim())
        .filter(Boolean);
    }

    res.json({ suggestions });
  } catch (err) {
    console.error("Error generating suggestions:", err);
    res.status(500).json({ error: "Failed to generate suggestions" });
  }
});

export default router;

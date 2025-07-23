import express from "express";
import { openai } from "../openai/index.js";
import { lookupProductInfo } from "../utils/lookup.js";

const router = express.Router();

router.post("/", async (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages array is required" });
      return;
    }

    const systemPrompt = `
You are RoboHelper, a friendly and knowledgeable customer service assistant for RoboClean — a company that sells advanced robotic vacuum cleaners and mops.

You help customers understand which model suits their needs, troubleshoot common issues, and explain features clearly.

Here are the four current models:

1. **RoboClean Mini** — Compact, quiet, ideal for small apartments. Vacuum only.
2. **RoboClean Pro** — Larger dustbin, better suction, supports scheduled cleaning via mobile app.
3. **RoboClean Duo** — Vacuum + Mop combo, intelligent floor detection (switches mode automatically).
4. **RoboClean Ultra** — Premium model with LiDAR mapping, room-specific cleaning, voice assistant integration, and self-emptying base.

You do *not* make up additional products or features. If asked something outside your knowledge, respond helpfully and offer to forward the query to a human.
`;

    const initialResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
      tools: [
        {
          type: "function",
          function: {
            name: "lookupProductInfo",
            description: "Searches RoboClean product documentation",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "What the user wants to know",
                },
              },
              required: ["query"],
            },
          },
        },
      ],
      tool_choice: "auto",
    });

    let assistantMsg = "";
    let toolCallChunksMap = new Map();
    let currentToolCallId = null;

    for await (const chunk of initialResponse) {
      const delta = chunk.choices?.[0]?.delta;

      if (delta?.content) {
        assistantMsg += delta.content;
        res.write(`data: ${JSON.stringify({ text: delta.content })}\n\n`);
      }

      if (delta?.tool_calls) {
        for (const call of delta.tool_calls) {
          if (call.id) currentToolCallId = call.id;
          const id = currentToolCallId;
          if (!toolCallChunksMap.has(id)) {
            toolCallChunksMap.set(id, {
              id,
              type: call.type,
              function: {
                name: call.function?.name || "",
                arguments: "",
              },
            });
          }
          const stored = toolCallChunksMap.get(id);
          stored.function.arguments += call.function?.arguments || "";
        }
      }
    }

    const toolCall = toolCallChunksMap.values().next().value;
    if (toolCall) {
      if (!toolCall.function.arguments.trim()) {
        res.end();
        return;
      }

      let parsedArgs;
      try {
        parsedArgs = JSON.parse(toolCall.function.arguments);
      } catch (err) {
        console.error(
          "Failed to parse tool call arguments:",
          toolCall.function.arguments
        );
        res.write(
          `data: ${JSON.stringify({
            text: "Sorry, I had trouble understanding the request. Please try rephrasing your question.",
          })}\n\n`
        );
        res.end();
        return;
      }

      const toolResult = await lookupProductInfo(parsedArgs.query);

      if (!toolCall?.function?.name) {
        console.error("Missing function name in tool call.");
        res.write(
          `data: ${JSON.stringify({
            text: "Sorry, something went wrong while retrieving the information.",
          })}\n\n`
        );
        res.end();
        return;
      }

      const followupResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
          {
            role: "function",
            name: toolCall.function.name,
            content: toolResult,
          },
        ],
        stream: true,
      });

      for await (const chunk of followupResponse) {
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      res.end();
      return;
    }

    // No tool call: just finish
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
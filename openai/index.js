import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
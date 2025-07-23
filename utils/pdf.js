import fs from "fs/promises";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

export let factsheetText = "";

export async function loadFactsheet() {
  try {
    const buffer = await fs.readFile("./roboclean_factsheet.pdf");
    const data = await pdfParse(buffer);
    factsheetText = data.text;
  } catch (error) {
    console.error("Failed to load factsheet:", error);
  }
}
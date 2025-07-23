import { factsheetText } from "./pdf.js";

function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  let i;
  for (i = 0; i <= b.length; i++) matrix[i] = [i];
  let j;
  for (j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (i = 1; i <= b.length; i++) {
    for (j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export async function lookupProductInfo(query) {
  const lines = factsheetText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const queryWords = query.toLowerCase().split(/\s+/);
  const targetKeywords = queryWords;

  const candidates = lines.filter((line) => {
    const l = line.toLowerCase();
    // At least one word from the query
    return queryWords.some((qw) => l.includes(qw));
  });

  if (candidates.length) {
    return candidates.join("\n");
  }

  const keywordLines = lines.filter((line) =>
    queryWords.every((qw) => line.toLowerCase().includes(qw))
  );
  if (keywordLines.length) return keywordLines.join("\n");

  let bestLine = null;
  let bestScore = Infinity;
  for (const line of lines) {
    const score = levenshtein(
      query.toLowerCase().replace(/\s+/g, " ").trim(),
      line.toLowerCase().replace(/\s+/g, " ").trim()
    );
    if (score < bestScore) {
      bestScore = score;
      bestLine = line;
    }
  }
  if (bestScore < 20) {
    const idx = lines.indexOf(bestLine);
    const context = lines.slice(
      Math.max(idx - 1, 0),
      Math.min(idx + 2, lines.length)
    );
    return context.join("\n");
  }

  return `Sorry, I couldn't find anything relevant to "${query}".`;
}

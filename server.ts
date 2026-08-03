import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());

// Translate using DeepL API
async function translateWithDeepL(
  text: string,
  targetLang: string,
  sourceLang?: string,
  glossaryId?: string,
  formality?: string
): Promise<string> {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPL_API_KEY is not defined in environment variables");
  }

  const isFreeAccount = apiKey.endsWith(":fx");
  const url = isFreeAccount
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";

  // DeepL target language normalizations
  let dlTarget = targetLang.toUpperCase();
  if (dlTarget === "EN") dlTarget = "EN-US";
  if (dlTarget.startsWith("ZH")) dlTarget = "ZH"; // DeepL only supports "ZH" for Chinese target

  // DeepL source language normalizations
  let dlSource = sourceLang ? sourceLang.toUpperCase() : undefined;
  if (dlSource && dlSource.startsWith("ZH")) dlSource = "ZH";

  const bodyData: any = {
    text: [text],
    target_lang: dlTarget,
    tag_handling: "html",
  };

  if (dlSource) {
    bodyData.source_lang = dlSource;
  }

  if (glossaryId && glossaryId.trim() !== "") {
    if (!dlSource) {
      throw new Error("Để áp dụng Glossary, bạn phải chọn một ngôn ngữ nguồn cụ thể thay vì chọn 'Tự động phát hiện' (DeepL API constraint).");
    }
    bodyData.glossary_id = glossaryId.trim();
  }

  // DeepL only supports formality for specific target languages
  // e.g., DE, FR, IT, ES, NL, PL, PT-BR, PT-PT, RU, JA
  const supportsFormality = ["DE", "FR", "IT", "ES", "NL", "PL", "PT", "RU", "JA"].some(lang => dlTarget.startsWith(lang));
  if (formality && formality !== "default" && supportsFormality) {
    bodyData.formality = formality;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyData),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeepL API Error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  if (data.translations && data.translations[0]) {
    return data.translations[0].text;
  }
  throw new Error("Invalid response structure from DeepL API");
}

// Helper to escape HTML characters
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Cache for glossary entries to avoid repeated DeepL API calls
const glossaryCache = new Map<string, { entries: Record<string, { source: string; target: string }>; fetchedAt: number }>();
const GLOSSARY_CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache TTL

// Fetch real glossary entries from DeepL API
async function fetchDeepLGlossaryEntries(glossaryId: string): Promise<Record<string, { source: string; target: string }>> {
  const now = Date.now();
  const cached = glossaryCache.get(glossaryId);
  if (cached && now - cached.fetchedAt < GLOSSARY_CACHE_TTL) {
    console.log(`[Cache] Serving glossary entries from memory cache for ID: ${glossaryId}`);
    return cached.entries;
  }

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) return {};

  const isFreeAccount = apiKey.endsWith(":fx");
  const url = isFreeAccount
    ? `https://api-free.deepl.com/v2/glossaries/${glossaryId}/entries`
    : `https://api.deepl.com/v2/glossaries/${glossaryId}/entries`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch DeepL glossary entries: ${response.status}`);
      return {};
    }

    const tsvText = await response.text();
    const entries: Record<string, { source: string; target: string }> = {};
    const lines = tsvText.split(/\r?\n/);
    for (const line of lines) {
      const parts = line.split("\t");
      if (parts.length >= 2) {
        const source = parts[0].trim();
        const target = parts[1].trim();
        if (source && target) {
          // Key by target so we can search the translated text for this target word
          entries[target] = { source, target };
        }
      }
    }

    glossaryCache.set(glossaryId, { entries, fetchedAt: now });
    console.log(`[Cache] Fetched and cached ${Object.keys(entries).length} glossary entries for ID: ${glossaryId}`);
    return entries;
  } catch (err) {
    console.error("Error fetching DeepL glossary entries:", err);
    return {};
  }
}

// Highlight exact glossary terms in translated HTML
function highlightGlossaryInHtml(html: string, glossaryEntries: Record<string, { source: string; target: string }>): string {
  const sortedTargets = Object.keys(glossaryEntries).sort((a, b) => b.length - a.length);
  if (sortedTargets.length === 0) return html;

  const parts = html.split(/(<[^>]+>)/g);
  for (let i = 0; i < parts.length; i++) {
    // Only process text nodes, not tags (even indices are text nodes)
    if (i % 2 === 0 && parts[i]) {
      let text = parts[i];
      const replacements: string[] = [];

      // Loop to identify matches and substitute with safe placeholders
      for (let idx = 0; idx < sortedTargets.length; idx++) {
        const targetWord = sortedTargets[idx];
        if (!targetWord) continue;
        const info = glossaryEntries[targetWord];

        const escapedWord = targetWord.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const isLatin = /^[A-Za-z0-9]/.test(targetWord);
        const regex = isLatin 
          ? new RegExp(`\\b${escapedWord}\\b`, 'gi')
          : new RegExp(escapedWord, 'g');

        text = text.replace(regex, (matched) => {
          const placeholder = `__GLOSSARY_PLACEHOLDER_${replacements.length}__`;
          const spanHtml = `<span class="applied-glossary" data-info="Bạn đã đặt <strong>'${escapeHtml(info.source)}'</strong> được dịch là <strong>'${escapeHtml(info.target)}'</strong>.">${matched}</span>`;
          replacements.push(spanHtml);
          return placeholder;
        });
      }

      // Restore each placeholder with its final HTML representation
      for (let rIdx = 0; rIdx < replacements.length; rIdx++) {
        text = text.replace(`__GLOSSARY_PLACEHOLDER_${rIdx}__`, replacements[rIdx]);
      }

      parts[i] = text;
    }
  }
  return parts.join("");
}

// Apply custom style rules and word/phrase replacements locally
function applyCustomStyleRules(html: string, styleRules: string): string {
  if (!styleRules || styleRules.trim() === "") return html;

  const lines = styleRules.split("\n");
  const parsedRules: { source: string; target: string }[] = [];

  for (let line of lines) {
    line = line.trim();
    // Strip leading list bullet chars like -, *, + or numbers like 1., 2.
    line = line.replace(/^[\s\-\*\+\d\.]+\s*/, "");
    if (!line) continue;

    // Split on delimiters: ->, =>, =:, ===, ==, =, or :
    const match = line.match(/^(.*?)(?:\s*(?:->|=>|=:|:|===|==|=)\s*)(.*)$/);
    if (match) {
      let source = match[1].trim();
      let target = match[2].trim();

      // Strip outer quotes if any
      source = source.replace(/^['"](.*)['"]$/, "$1");
      target = target.replace(/^['"](.*)['"]$/, "$1");

      if (source && target) {
        parsedRules.push({ source, target });
      }
    }
  }

  if (parsedRules.length === 0) return html;

  // Sort rules by source length descending to prevent shorter substrings matching before longer ones
  parsedRules.sort((a, b) => b.source.length - a.source.length);

  const parts = html.split(/(<[^>]+>)/g);
  for (let i = 0; i < parts.length; i++) {
    // Only process text nodes, not tags (even indices are text nodes)
    if (i % 2 === 0 && parts[i]) {
      let text = parts[i];
      const replacements: string[] = [];

      for (let idx = 0; idx < parsedRules.length; idx++) {
        const rule = parsedRules[idx];
        const escapedSource = rule.source.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        const isLatin = /^[A-Za-z0-9]/.test(rule.source);
        const regex = isLatin
          ? new RegExp(`\\b${escapedSource}\\b`, "gi")
          : new RegExp(escapedSource, "g");

        text = text.replace(regex, (matched) => {
          const placeholder = `__STYLERULE_PLACEHOLDER_${replacements.length}__`;
          const spanHtml = `<span class="applied-style-rule" data-info="Đã áp dụng quy tắc phong cách: Thay thế <strong>'${escapeHtml(rule.source)}'</strong> bằng <strong>'${escapeHtml(rule.target)}'</strong>.">${escapeHtml(rule.target)}</span>`;
          replacements.push(spanHtml);
          return placeholder;
        });
      }

      for (let rIdx = 0; rIdx < replacements.length; rIdx++) {
        text = text.replace(`__STYLERULE_PLACEHOLDER_${rIdx}__`, replacements[rIdx]);
      }

      parts[i] = text;
    }
  }
  return parts.join("");
}

// Cache for translation requests to avoid repeated DeepL translation API calls
const translationCache = new Map<string, { translatedText: string; provider: string; cachedAt: number }>();
const MAX_CACHE_SIZE = 1000;
const TRANSLATION_CACHE_TTL = 30 * 60 * 1000; // 30 minutes cache TTL

// Translation Endpoint
app.post("/api/translate", async (req, res) => {
  try {
    const { text, sourceLang, targetLang, glossaryId, formality, styleRules } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "Nội dung dịch không được bỏ trống." });
    }

    const hasDeepLKey = !!process.env.DEEPL_API_KEY;
    if (!hasDeepLKey) {
      return res.status(400).json({ error: "Chưa cấu hình DEEPL_API_KEY trong tệp .env." });
    }

    // Generate unique cache key
    const cacheKey = JSON.stringify({
      text: text.trim(),
      sourceLang,
      targetLang,
      glossaryId: glossaryId || "",
      formality: formality || "default",
      styleRules: styleRules || "",
    });

    const now = Date.now();
    const cached = translationCache.get(cacheKey);
    if (cached && now - cached.cachedAt < TRANSLATION_CACHE_TTL) {
      console.log("[Cache] Serving translation from memory cache (Instant 0ms)");
      return res.json({
        translatedText: cached.translatedText,
        provider: cached.provider,
        cached: true,
      });
    }

    // Always translate with DeepL as requested
    let translatedText = await translateWithDeepL(text, targetLang, sourceLang, glossaryId, formality);
    const provider = "DeepL";

    // Apply custom style rules and highlights locally (without Gemini)
    if (styleRules && styleRules.trim() !== "") {
      console.log("[Server] Applying local custom style rules...");
      translatedText = applyCustomStyleRules(translatedText, styleRules);
    }

    // Highlight glossaries exactly based on fetched entries from DeepL API
    if (glossaryId && glossaryId.trim() !== "") {
      console.log("[Server] Fetching DeepL glossary entries for exact tagging...");
      const glossaryEntries = await fetchDeepLGlossaryEntries(glossaryId);
      console.log("[Server] Found glossary entries:", Object.keys(glossaryEntries).length);
      translatedText = highlightGlossaryInHtml(translatedText, glossaryEntries);
    }

    // Save to cache with size bounding
    if (translationCache.size >= MAX_CACHE_SIZE) {
      console.log("[Cache] Translation cache full, clearing entries to release memory.");
      translationCache.clear();
    }
    translationCache.set(cacheKey, { translatedText, provider, cachedAt: now });

    return res.json({ translatedText, provider });
  } catch (error: any) {
    console.error("Translation API Error:", error);
    return res.status(500).json({ error: error.message || "Lỗi xử lý dịch thuật." });
  }
});

// Configuration Info Endpoint
app.get("/api/config", (req, res) => {
  res.json({
    hasDeepLKey: !!process.env.DEEPL_API_KEY,
    hasGeminiKey: false,
  });
});

async function startServer() {
  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs/promises";

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());

interface GlossaryMetadata {
  glossary_id: string;
  name: string;
  ready: boolean;
  source_lang: string;
  target_lang: string;
}

const glossaryMetadataCache = new Map<string, GlossaryMetadata | null>();

async function fetchDeepLGlossaryMetadata(glossaryId: string): Promise<GlossaryMetadata | null> {
  const cached = glossaryMetadataCache.get(glossaryId);
  if (cached !== undefined) return cached;

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) return null;

  const isFreeAccount = apiKey.endsWith(":fx");
  const url = isFreeAccount
    ? `https://api-free.deepl.com/v2/glossaries/${glossaryId}`
    : `https://api.deepl.com/v2/glossaries/${glossaryId}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.warn(`[DeepL] Glossary metadata lookup failed for ID ${glossaryId}: status ${response.status}`);
      glossaryMetadataCache.set(glossaryId, null);
      return null;
    }

    const data: GlossaryMetadata = await response.json();
    glossaryMetadataCache.set(glossaryId, data);
    return data;
  } catch (err) {
    console.error("Error fetching DeepL glossary metadata:", err);
    return null;
  }
}

interface DeepLTranslationResult {
  text: string;
  glossaryApplied: boolean;
  glossaryWarning?: string;
}

// Translate using DeepL API
async function translateWithDeepL(
  text: string,
  targetLang: string,
  sourceLang?: string,
  glossaryId?: string,
  formality?: string
): Promise<DeepLTranslationResult> {
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

  let glossaryApplied = false;
  let glossaryWarning: string | undefined = undefined;

  if (glossaryId && glossaryId.trim() !== "") {
    if (!dlSource) {
      glossaryApplied = false;
      glossaryWarning = "Glossary không thể áp dụng khi chọn ngôn ngữ nguồn 'Tự động phát hiện'. Hệ thống đã tự động dịch thường không áp dụng Glossary.";
    } else {
      // Check glossary language pair match before sending to DeepL
      const meta = await fetchDeepLGlossaryMetadata(glossaryId.trim());
      if (meta) {
        const metaSource = meta.source_lang.toUpperCase();
        const metaTarget = meta.target_lang.toUpperCase();
        
        const compareLangs = (langA: string, langB: string) => {
          const shortA = langA.split("-")[0];
          const shortB = langB.split("-")[0];
          return shortA === shortB;
        };

        if (!compareLangs(metaSource, dlSource) || !compareLangs(metaTarget, dlTarget)) {
          glossaryApplied = false;
          glossaryWarning = `Glossary ID hiện tại cấu hình cho cặp ngôn ngữ ${metaSource} -> ${metaTarget}, không tương thích với cặp ngôn ngữ bản dịch hiện tại (${dlSource} -> ${dlTarget}). Hệ thống đã tự động bỏ qua Glossary này để hoàn thành bản dịch thành công.`;
        } else {
          bodyData.glossary_id = glossaryId.trim();
          glossaryApplied = true;
        }
      } else {
        console.warn(`[DeepL] Could not verify glossary metadata for ID ${glossaryId}. Proceeding anyway.`);
        bodyData.glossary_id = glossaryId.trim();
        glossaryApplied = true;
      }
    }
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
    return {
      text: data.translations[0].text,
      glossaryApplied,
      glossaryWarning
    };
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
const translationCache = new Map<string, { 
  translatedText: string; 
  provider: string; 
  cachedAt: number;
  glossaryApplied?: boolean;
  glossaryWarning?: string;
}>();
const MAX_CACHE_SIZE = 1000;
const TRANSLATION_CACHE_TTL = 30 * 60 * 1000; // 30 minutes cache TTL

// API Traffic metrics tracking model
interface ApiMetricEntry {
  id: string;
  timestamp: number;
  sourceLang: string;
  targetLang: string;
  charCount: number;
  latencyMs: number;
  status: "success" | "error";
  errorMsg?: string;
  cacheHit: boolean;
  textSnippet: string;
}

const apiMetrics = {
  totalRequests: 0,
  totalChars: 0,
  successfulRequests: 0,
  failedRequests: 0,
  cacheHits: 0,
  cacheHitChars: 0,
  totalLatencyMs: 0,
  recentRequests: [] as ApiMetricEntry[],
};

function addMetricEntry(entry: Omit<ApiMetricEntry, "id">) {
  const newEntry: ApiMetricEntry = {
    id: Math.random().toString(36).substring(2, 11),
    ...entry,
  };
  apiMetrics.recentRequests = [newEntry, ...apiMetrics.recentRequests].slice(0, 100); // Keep last 100 requests
  
  apiMetrics.totalRequests++;
  if (entry.status === "success") {
    apiMetrics.successfulRequests++;
    if (entry.cacheHit) {
      apiMetrics.cacheHits++;
      apiMetrics.cacheHitChars += entry.charCount;
    } else {
      apiMetrics.totalChars += entry.charCount;
      apiMetrics.totalLatencyMs += entry.latencyMs;
    }
  } else {
    apiMetrics.failedRequests++;
    apiMetrics.totalLatencyMs += entry.latencyMs;
  }
}

function resetMetrics() {
  apiMetrics.totalRequests = 0;
  apiMetrics.totalChars = 0;
  apiMetrics.successfulRequests = 0;
  apiMetrics.failedRequests = 0;
  apiMetrics.cacheHits = 0;
  apiMetrics.cacheHitChars = 0;
  apiMetrics.totalLatencyMs = 0;
  apiMetrics.recentRequests = [];
}

// Translation Endpoint
app.post("/api/translate", async (req, res) => {
  const startTime = Date.now();
  const { text, sourceLang, targetLang, glossaryId, formality, styleRules } = req.body;
  const chars = text ? text.length : 0;
  const textSnippet = text ? (text.length > 50 ? text.substring(0, 50) + "..." : text) : "";

  try {
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
      
      addMetricEntry({
        timestamp: now,
        sourceLang: sourceLang || "auto",
        targetLang,
        charCount: chars,
        latencyMs: 0,
        status: "success",
        cacheHit: true,
        textSnippet,
      });

      return res.json({
        translatedText: cached.translatedText,
        provider: cached.provider,
        cached: true,
        glossaryApplied: cached.glossaryApplied,
        glossaryWarning: cached.glossaryWarning,
      });
    }

    // Always translate with DeepL as requested
    const result = await translateWithDeepL(text, targetLang, sourceLang, glossaryId, formality);
    let translatedText = result.text;
    const provider = "DeepL";

    // Apply custom style rules and highlights locally (without Gemini)
    if (styleRules && styleRules.trim() !== "") {
      console.log("[Server] Applying local custom style rules...");
      translatedText = applyCustomStyleRules(translatedText, styleRules);
    }

    // Highlight glossaries exactly based on fetched entries from DeepL API
    // Only if glossary was actually applied successfully
    if (glossaryId && glossaryId.trim() !== "" && result.glossaryApplied) {
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
    translationCache.set(cacheKey, { 
      translatedText, 
      provider, 
      cachedAt: now,
      glossaryApplied: result.glossaryApplied,
      glossaryWarning: result.glossaryWarning
    });

    const latency = Date.now() - startTime;
    addMetricEntry({
      timestamp: now,
      sourceLang: sourceLang || "auto",
      targetLang,
      charCount: chars,
      latencyMs: latency,
      status: "success",
      cacheHit: false,
      textSnippet,
    });

    return res.json({ 
      translatedText, 
      provider,
      glossaryApplied: result.glossaryApplied,
      glossaryWarning: result.glossaryWarning
    });
  } catch (error: any) {
    console.error("Translation API Error:", error);
    const latency = Date.now() - startTime;
    addMetricEntry({
      timestamp: Date.now(),
      sourceLang: sourceLang || "auto",
      targetLang,
      charCount: chars,
      latencyMs: latency,
      status: "error",
      errorMsg: error.message || "Lỗi xử lý dịch thuật.",
      cacheHit: false,
      textSnippet,
    });

    return res.status(500).json({ error: error.message || "Lỗi xử lý dịch thuật." });
  }
});

// Fetch real usage limits from DeepL API
async function fetchDeepLUsage(): Promise<{ character_count: number; character_limit: number } | null> {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) return null;

  const isFreeAccount = apiKey.endsWith(":fx");
  const url = isFreeAccount
    ? "https://api-free.deepl.com/v2/usage"
    : "https://api.deepl.com/v2/usage";

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.warn(`[DeepL] Usage API returned status ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (typeof data.character_count === "number" && typeof data.character_limit === "number") {
      return {
        character_count: data.character_count,
        character_limit: data.character_limit,
      };
    }
  } catch (err) {
    console.error("Error fetching DeepL Usage:", err);
  }
  return null;
}

// Traffic Metrics Endpoints
app.get("/api/metrics", async (req, res) => {
  const usage = await fetchDeepLUsage();
  if (usage) {
    res.json({
      ...apiMetrics,
      deeplUsage: usage,
    });
  } else {
    res.json(apiMetrics);
  }
});

app.post("/api/metrics/reset", (req, res) => {
  resetMetrics();
  res.json({ success: true, metrics: apiMetrics });
});

// Configuration Info Endpoint
app.get("/api/config", (req, res) => {
  res.json({
    hasDeepLKey: !!process.env.DEEPL_API_KEY,
    hasGeminiKey: false,
  });
});

// System Defaults Endpoints (with in-memory fallback for read-only serverless runtimes)
let inMemoryDefaults: any = null;

app.get("/api/defaults", async (req, res) => {
  if (inMemoryDefaults) {
    return res.json(inMemoryDefaults);
  }
  try {
    const filePath = path.join(process.cwd(), "defaults.json");
    const data = await fs.readFile(filePath, "utf-8");
    res.json(JSON.parse(data));
  } catch (err) {
    // If defaults.json doesn't exist, return empty/initial settings
    res.json({
      sourceText: "",
      sourceLangCode: "vi",
      targetLangCode: "zh-tw",
      glossaryId: "",
      formality: "default",
      styleRules: "",
      isAutoTranslate: true,
      isDark: false,
    });
  }
});

app.post("/api/defaults", async (req, res) => {
  inMemoryDefaults = req.body;
  try {
    const filePath = path.join(process.cwd(), "defaults.json");
    await fs.writeFile(filePath, JSON.stringify(req.body, null, 2), "utf-8");
    res.json({ success: true });
  } catch (err: any) {
    // Fail-safe check for read-only platforms like Vercel Serverless
    console.warn("Could not write defaults to disk (expected on read-only environments):", err.message);
    res.json({ success: true, warning: "Saved in-memory (read-only environment)" });
  }
});

async function startServer() {
  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
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

// Only start the listening server when not running in Vercel Serverless environments
if (!process.env.VERCEL) {
  startServer();
}

export default app;

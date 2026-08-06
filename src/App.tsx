import React, { useState, useEffect } from "react";
import {
  Languages,
  BookOpen,
  Info,
  ShieldAlert,
  HelpCircle,
  Clock,
  Settings,
  Star,
  Sparkles,
  ExternalLink,
  Activity,
  Sun,
  Moon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Analytics } from "@vercel/analytics/react";
import { SUPPORTED_LANGUAGES, getLanguageName } from "./data";
import { TranslationHistoryItem, ProviderType, ForcedProviderType } from "./types";
import TranslationWorkspace from "./components/TranslationWorkspace";
import HistorySidebar from "./components/HistorySidebar";
import TrafficAnalytics from "./components/TrafficAnalytics";

export default function App() {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem("deepl_theme");
    return stored ? stored === "dark" : false; // Default to light mode
  });

  useEffect(() => {
    localStorage.setItem("deepl_theme", isDark ? "dark" : "light");
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLangCode, setSourceLangCode] = useState("vi"); // Default: Vietnamese
  const [targetLangCode, setTargetLangCode] = useState("zh-tw"); // Default: Traditional Chinese (Tiếng Trung Phồn thể)
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [glossaryWarning, setGlossaryWarning] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderType | null>(null);
  const [isAutoTranslate, setIsAutoTranslate] = useState(true);

  // Advanced DeepL options state
  const [glossaryId, setGlossaryId] = useState(() => localStorage.getItem("deepl_glossary_id") || "");
  const [formality, setFormality] = useState(() => localStorage.getItem("deepl_formality") || "default");
  const [styleRules, setStyleRules] = useState(() => localStorage.getItem("deepl_style_rules") || "");
  
  const [history, setHistory] = useState<TranslationHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false); // Default to collapsed
  const [showAnalytics, setShowAnalytics] = useState(() => {
    const val = localStorage.getItem("deepl_show_analytics");
    return val !== null ? val === "true" : false; // Default to false to keep it collapsed
  });
  const [serverConfig, setServerConfig] = useState<{ hasDeepLKey: boolean; hasGeminiKey: boolean }>({
    hasDeepLKey: false,
    hasGeminiKey: false,
  });

  // Persist advanced settings when they change
  useEffect(() => {
    localStorage.setItem("deepl_glossary_id", glossaryId);
  }, [glossaryId]);

  useEffect(() => {
    localStorage.setItem("deepl_formality", formality);
  }, [formality]);

  useEffect(() => {
    localStorage.setItem("deepl_style_rules", styleRules);
  }, [styleRules]);

  useEffect(() => {
    localStorage.setItem("deepl_show_analytics", String(showAnalytics));
  }, [showAnalytics]);

  // Load history and defaults on mount
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem("deepl_translate_history");
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (err) {
      console.error("Failed to load translation history:", err);
    }

    // Fetch system defaults from the server
    fetch("/api/defaults")
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          if (data.sourceText !== undefined) setSourceText(data.sourceText);
          if (data.sourceLangCode !== undefined) setSourceLangCode(data.sourceLangCode);
          if (data.targetLangCode !== undefined) setTargetLangCode(data.targetLangCode);
          
          // Only fall back to server defaults if browser local storage has no config
          const localGlossaryId = localStorage.getItem("deepl_glossary_id");
          const localFormality = localStorage.getItem("deepl_formality");
          const localStyleRules = localStorage.getItem("deepl_style_rules");

          if (data.glossaryId !== undefined && (localGlossaryId === null || localGlossaryId === "")) {
            setGlossaryId(data.glossaryId);
          }
          if (data.formality !== undefined && (localFormality === null || localFormality === "" || localFormality === "default")) {
            setFormality(data.formality);
          }
          if (data.styleRules !== undefined && (localStyleRules === null || localStyleRules === "")) {
            setStyleRules(data.styleRules);
          }
          
          if (data.isAutoTranslate !== undefined) setIsAutoTranslate(data.isAutoTranslate);
          if (data.isDark !== undefined) setIsDark(data.isDark);
        }
      })
      .catch((err) => console.error("Failed to fetch defaults:", err));

    // Fetch server key configuration status
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        setServerConfig(data);
      })
      .catch((err) => console.error("Failed to fetch server config:", err));
  }, []);

  // Main translate runner
  const handleTranslate = async () => {
    const plain = sourceText.replace(/<[^>]*>/g, "").trim();
    if (!plain) {
      setTranslatedText("");
      setProvider(null);
      setGlossaryWarning(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setGlossaryWarning(null);

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sourceText,
          sourceLang: sourceLangCode === "auto" ? undefined : sourceLangCode,
          targetLang: targetLangCode,
          glossaryId,
          formality,
          styleRules,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Có lỗi xảy ra khi thực hiện dịch.");
      }

      const data = await response.json();
      setTranslatedText(data.translatedText);
      setProvider(data.provider);
      setGlossaryWarning(data.glossaryWarning || null);

      // Save record to history
      saveToHistory(sourceText, data.translatedText, sourceLangCode, targetLangCode);
    } catch (err: any) {
      console.error("Translation error:", err);
      setError(err.message || "Không thể kết nối với dịch vụ dịch thuật.");
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced translation hook
  useEffect(() => {
    if (!isAutoTranslate) return;

    const plain = sourceText.replace(/<[^>]*>/g, "").trim();
    if (!plain) {
      setTranslatedText("");
      setProvider(null);
      return;
    }

    const timer = setTimeout(() => {
      handleTranslate();
    }, 350); // 350ms optimized debounce gap

    return () => clearTimeout(timer);
  }, [sourceText, sourceLangCode, targetLangCode, isAutoTranslate, glossaryId, formality, styleRules]);

  const saveToHistory = (
    srcHtml: string,
    trHtml: string,
    srcCode: string,
    trCode: string
  ) => {
    const srcLabel = srcCode === "auto" ? "Tự động phát hiện" : getLanguageName(srcCode);
    const trLabel = getLanguageName(trCode);

    setHistory((prev) => {
      // Avoid duplication of identical consecutive source texts
      if (prev.length > 0) {
        const lastItem = prev[0];
        if (lastItem.sourceText.trim() === srcHtml.trim() && lastItem.targetLangCode === trCode) {
          return prev;
        }
      }

      const newItem: TranslationHistoryItem = {
        id: Date.now().toString(),
        sourceText: srcHtml,
        translatedText: trHtml,
        sourceLangCode: srcCode,
        targetLangCode: trCode,
        sourceLangName: srcLabel,
        targetLangName: trLabel,
        timestamp: Date.now(),
        isStarred: false,
      };

      const updated = [newItem, ...prev].slice(0, 50); // Keep max 50 items
      localStorage.setItem("deepl_translate_history", JSON.stringify(updated));
      return updated;
    });
  };

  const handleSelectItem = (item: TranslationHistoryItem) => {
    setSourceLangCode(item.sourceLangCode);
    setTargetLangCode(item.targetLangCode);
    setSourceText(item.sourceText);
    setTranslatedText(item.translatedText);
  };

  const handleDeleteItem = (id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      localStorage.setItem("deepl_translate_history", JSON.stringify(updated));
      return updated;
    });
  };

  const handleClearAllHistory = () => {
    setHistory([]);
    localStorage.removeItem("deepl_translate_history");
  };

  const handleToggleStar = (id: string) => {
    setHistory((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, isStarred: !item.isStarred } : item
      );
      localStorage.setItem("deepl_translate_history", JSON.stringify(updated));
      return updated;
    });
  };

  const handleSaveAsDefault = async () => {
    const response = await fetch("/api/defaults", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceText,
        sourceLangCode,
        targetLangCode,
        glossaryId,
        formality,
        styleRules,
        isAutoTranslate,
        isDark,
      }),
    });
    if (!response.ok) {
      throw new Error("Lỗi khi gửi yêu cầu lưu cấu hình.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans text-slate-800 dark:text-slate-100 selection:bg-indigo-100 dark:selection:bg-indigo-950 selection:text-indigo-900 dark:selection:text-indigo-200 transition-colors duration-200">
      {/* HEADER BAR */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-50 shrink-0 shadow-xs dark:shadow-md transition-all" id="main-header">
        <div className="max-w-[1440px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <div className="flex items-center space-x-10">
            <div className="flex items-center space-x-3 group">
              <div className="bg-indigo-600 p-2 rounded-xl text-white flex items-center justify-center shadow-md shadow-indigo-200 dark:shadow-indigo-950/50 group-hover:scale-105 transition-transform">
                <Languages className="h-5 w-5" />
              </div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-extrabold tracking-tight text-slate-800 dark:text-slate-100 select-none">
                  FormaTW <span className="font-medium text-indigo-600 dark:text-indigo-400">Dịch Thuật</span>
                </h1>
                <span className="text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 rounded text-indigo-600 dark:text-indigo-400 shadow-2xs">
                  DeepL API
                </span>
              </div>
            </div>

            {/* Decorative minimalist nav links mimicking genuine DeepL layout */}
            <nav className="hidden md:flex items-center space-x-6 text-xs font-bold text-slate-500 dark:text-slate-400 select-none">
              <span className="text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 pb-1 cursor-pointer pt-1">Dịch văn bản</span>
              <span className="hover:text-slate-800 dark:hover:text-slate-100 transition-colors cursor-pointer">Dịch tài liệu</span>
              <span className="hover:text-slate-800 dark:hover:text-slate-100 transition-colors cursor-pointer">DeepL Write</span>
              <span className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer font-medium text-slate-400 dark:text-slate-500">Từ điển</span>
            </nav>
          </div>

          <div className="flex items-center space-x-3.5">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                const newVal = !showAnalytics;
                setShowAnalytics(newVal);
                localStorage.setItem("deepl_show_analytics", String(newVal));
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                showAnalytics
                  ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900 shadow-2xs"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
              id="analytics-toggle-btn"
            >
              <Activity className="h-4 w-4" />
              <span>{showAnalytics ? "Ẩn phân tích" : "Phân tích API"}</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                showHistory
                  ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900 shadow-2xs"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
              id="sidebar-toggle-btn"
            >
              <Clock className="h-4 w-4" />
              <span>{showHistory ? "Ẩn lịch sử" : "Lịch sử"}</span>
            </motion.button>

            {/* Theme Toggle Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsDark(!isDark)}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-center shadow-xs"
              title={isDark ? "Chuyển sang Giao diện Sáng" : "Chuyển sang Giao diện Tối"}
              id="theme-toggle-btn"
            >
              {isDark ? (
                <Sun className="h-4 w-4 text-amber-500 fill-amber-500/10" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-600" />
              )}
            </motion.button>
          </div>
        </div>
      </header>

      {/* WORKSPACE & BODY CONTAINER */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto p-4 md:p-6 flex flex-col lg:flex-row gap-6">
        {/* LEFT COMPONENT: COLLAPSIBLE SIDEBAR FOR ANALYTICS */}
        <AnimatePresence mode="popLayout">
          {showAnalytics && (
            <motion.div
              initial={{ opacity: 0, x: -24, width: 0 }}
              animate={{ opacity: 1, x: 0, width: "auto" }}
              exit={{ opacity: 0, x: -24, width: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 140 }}
              className="w-full lg:w-[380px] lg:shrink-0 flex flex-col min-h-[400px] overflow-hidden"
            >
              <div className="w-full lg:w-[380px]">
                <TrafficAnalytics />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* RIGHT COMPONENT: TRANSLATION AREA */}
        <div className="flex-1 flex flex-col space-y-6 min-w-0">
          {/* Translation Workspace Core */}
          <TranslationWorkspace
            sourceText={sourceText}
            onChangeSourceText={setSourceText}
            translatedText={translatedText}
            sourceLangCode={sourceLangCode}
            onChangeSourceLang={setSourceLangCode}
            targetLangCode={targetLangCode}
            onChangeTargetLang={setTargetLangCode}
            isLoading={isLoading}
            provider={provider}
            onTranslate={handleTranslate}
            isAutoTranslate={isAutoTranslate}
            onToggleAutoTranslate={() => setIsAutoTranslate(!isAutoTranslate)}
            glossaryId={glossaryId}
            onChangeGlossaryId={setGlossaryId}
            formality={formality}
            onChangeFormality={setFormality}
            styleRules={styleRules}
            onChangeStyleRules={setStyleRules}
            onSaveAsDefault={handleSaveAsDefault}
          />

          {/* Translation Error alert */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/55 rounded-xl text-rose-800 dark:text-rose-300 flex items-start space-x-3 shadow-md"
                id="error-alert"
              >
                <ShieldAlert className="h-5 w-5 shrink-0 text-rose-500 mt-0.5" />
                <div className="flex-1 text-xs font-semibold">{error}</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Glossary Warning alert */}
          <AnimatePresence>
            {glossaryWarning && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl text-amber-800 dark:text-amber-300 flex items-start space-x-3 shadow-md"
                id="glossary-warning-alert"
              >
                <Info className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
                <div className="flex-1 text-xs font-semibold">{glossaryWarning}</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Translation History Dashboard at the bottom */}
          <AnimatePresence mode="popLayout">
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, y: 24, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: 24, height: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 140 }}
                className="w-full h-[450px] flex flex-col shrink-0 overflow-hidden"
              >
                <div className="w-full h-[450px]">
                  <HistorySidebar
                    history={history}
                    onSelectItem={handleSelectItem}
                    onDeleteItem={handleDeleteItem}
                    onClearAll={handleClearAllHistory}
                    onToggleStar={handleToggleStar}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* TECHNICAL CONFIG / INFO FOOTER */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs dark:shadow-xl flex flex-col space-y-3.5" id="config-panel">
            <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
              <Info className="h-4.5 w-4.5" />
              <span>Cấu hình & Trạng thái kết nối</span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Hệ thống kết nối trực tiếp với dịch vụ <strong>DeepL Translation API</strong> chuyên nghiệp. Tất cả định dạng văn bản gốc như in đậm, in nghiêng, gạch chân và danh sách sẽ được bảo toàn nguyên vẹn trong bản dịch cuối cùng nhờ bộ xử lý thẻ HTML XML thông minh.
            </p>

            <div className="grid grid-cols-1 gap-3 pt-1">
              {/* DeepL API Key indicator */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 rounded-lg text-xs">
                <div className="flex items-center space-x-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${serverConfig.hasDeepLKey ? "bg-emerald-500 animate-pulse" : "bg-amber-500 animate-pulse"}`}></div>
                  <span className="font-bold text-slate-600 dark:text-slate-300">DeepL API Key</span>
                </div>
                <span className={`font-semibold px-2 py-0.5 rounded ${serverConfig.hasDeepLKey ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50" : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50"}`}>
                  {serverConfig.hasDeepLKey ? "Đã kết nối" : "Chưa cấu hình"}
                </span>
              </div>
            </div>

            {!serverConfig.hasDeepLKey && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-100 dark:border-amber-900/30 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                <strong>💡 Hướng dẫn cấu hình:</strong> Để kích hoạt dịch vụ chính thức, vui lòng thêm khóa API bằng cách bổ sung dòng <code>DEEPL_API_KEY="Khoa_Cua_Ban"</code> vào file <code>.env</code> của bạn.
              </div>
            )}
          </div>
        </div>
      </main>
      <Analytics />
    </div>
  );
}

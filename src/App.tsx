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
} from "lucide-react";
import { SUPPORTED_LANGUAGES, getLanguageName } from "./data";
import { TranslationHistoryItem, ProviderType, ForcedProviderType } from "./types";
import TranslationWorkspace from "./components/TranslationWorkspace";
import HistorySidebar from "./components/HistorySidebar";

export default function App() {
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLangCode, setSourceLangCode] = useState("vi"); // Default: Vietnamese
  const [targetLangCode, setTargetLangCode] = useState("zh-tw"); // Default: Traditional Chinese (Tiếng Trung Phồn thể)
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderType | null>(null);
  const [isAutoTranslate, setIsAutoTranslate] = useState(true);

  // Advanced DeepL options state
  const [glossaryId, setGlossaryId] = useState(() => localStorage.getItem("deepl_glossary_id") || "");
  const [formality, setFormality] = useState(() => localStorage.getItem("deepl_formality") || "default");
  const [styleRules, setStyleRules] = useState(() => localStorage.getItem("deepl_style_rules") || "");
  
  const [history, setHistory] = useState<TranslationHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(true);
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

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem("deepl_translate_history");
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (err) {
      console.error("Failed to load translation history:", err);
    }

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
      return;
    }

    setIsLoading(true);
    setError(null);

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

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col font-sans text-slate-900">
      {/* HEADER BAR */}
      <header className="bg-[#0F2D52] text-white border-b border-[#1A3E68] shrink-0 shadow-sm" id="main-header">
        <div className="max-w-7xl mx-auto px-6 h-[60px] flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <div className="bg-indigo-500 p-1.5 rounded-lg text-white flex items-center justify-center">
                <Languages className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight select-none">
                DeepL <span className="font-light text-slate-300">Dịch Thuật</span>
              </h1>
            </div>

            {/* Decorative minimalist nav links mimicking genuine DeepL layout */}
            <nav className="hidden md:flex items-center space-x-6 text-sm font-semibold text-slate-300 select-none">
              <span className="text-white border-b-2 border-white pb-1 cursor-pointer pt-1">Dịch văn bản</span>
              <span className="hover:text-white transition-colors cursor-pointer">Dịch file (.docx, .pdf)</span>
              <span className="hover:text-white transition-colors cursor-pointer">DeepL Write</span>
              <span className="hover:text-white transition-colors cursor-pointer">Từ điển</span>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                showHistory
                  ? "bg-white/10 text-white border-white/20"
                  : "bg-transparent text-slate-300 border-slate-600 hover:bg-[#1A3E68]"
              }`}
              id="sidebar-toggle-btn"
            >
              <Clock className="h-4 w-4" />
              <span>{showHistory ? "Ẩn lịch sử" : "Lịch sử"}</span>
            </button>

            {/* Premium initials profile badge */}
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white uppercase shadow-sm select-none" title="son11032001@gmail.com">
              S
            </div>
          </div>
        </div>
      </header>

      {/* WORKSPACE & BODY CONTAINER */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 flex flex-col lg:flex-row gap-6">
        {/* LEFT COMPONENT: COLLAPSIBLE SIDEBAR */}
        {showHistory && (
          <div className="w-full lg:w-80 lg:shrink-0 flex flex-col h-[500px] lg:h-auto min-h-[400px]">
            <HistorySidebar
              history={history}
              onSelectItem={handleSelectItem}
              onDeleteItem={handleDeleteItem}
              onClearAll={handleClearAllHistory}
              onToggleStar={handleToggleStar}
            />
          </div>
        )}

        {/* RIGHT COMPONENT: TRANSLATION AREA */}
        <div className="flex-1 flex flex-col space-y-6">
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
          />

          {/* Translation Error alert */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start space-x-2.5 shadow-sm" id="error-alert">
              <ShieldAlert className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
              <div className="flex-1 text-sm font-semibold">{error}</div>
            </div>
          )}

          {/* TECHNICAL CONFIG / INFO FOOTER */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm flex flex-col space-y-3.5" id="config-panel">
            <div className="flex items-center space-x-2 text-[#0F2D52] font-bold text-sm">
              <Info className="h-4.5 w-4.5" />
              <span>Cấu hình & Trạng thái kết nối</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Hệ thống sử dụng dịch vụ <strong>DeepL API</strong> chuyên nghiệp để dịch thuật. Định dạng văn bản như chữ đậm, nghiêng, gạch chân và danh sách sẽ được bảo toàn nguyên vẹn nhờ khả năng xử lý thẻ HTML XML tự động.
            </p>

            <div className="grid grid-cols-1 gap-3 pt-1">
              {/* DeepL API Key indicator */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                <div className="flex items-center space-x-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${serverConfig.hasDeepLKey ? "bg-emerald-500" : "bg-amber-500"}`}></div>
                  <span className="font-bold text-slate-700">DeepL API Key</span>
                </div>
                <span className={`font-semibold px-2 py-0.5 rounded ${serverConfig.hasDeepLKey ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {serverConfig.hasDeepLKey ? "Đã cấu hình" : "Chưa cấu hình"}
                </span>
              </div>
            </div>

            {!serverConfig.hasDeepLKey && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
                <strong>💡 Lưu ý:</strong> Để sử dụng công cụ dịch thuật DeepL, bạn cần cấu hình khóa API bằng cách thêm dòng <code>DEEPL_API_KEY="Key_Cua_Ban"</code> vào file <code>.env</code> của dự án.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

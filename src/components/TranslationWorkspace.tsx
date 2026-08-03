import React, { useRef, useEffect, useState } from "react";
import {
  Volume2,
  Copy,
  Check,
  X,
  Languages,
  Sparkles,
  ArrowRightLeft,
  RotateCcw,
  Loader2,
  Zap,
  Settings,
  Sliders,
  BookOpen,
  Info,
  Save,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Language, ProviderType } from "../types";
import { SUPPORTED_LANGUAGES, speakText } from "../data";
import LanguageSelector from "./LanguageSelector";
import FormattingToolbar from "./FormattingToolbar";

interface TranslationWorkspaceProps {
  sourceText: string;
  onChangeSourceText: (text: string) => void;
  translatedText: string;
  sourceLangCode: string;
  onChangeSourceLang: (code: string) => void;
  targetLangCode: string;
  onChangeTargetLang: (code: string) => void;
  isLoading: boolean;
  provider: ProviderType | null;
  onTranslate: () => void;
  isAutoTranslate: boolean;
  onToggleAutoTranslate: () => void;
  glossaryId: string;
  onChangeGlossaryId: (id: string) => void;
  formality: string;
  onChangeFormality: (f: string) => void;
  styleRules: string;
  onChangeStyleRules: (rules: string) => void;
  onSaveAsDefault: () => Promise<void>;
}

export default function TranslationWorkspace({
  sourceText,
  onChangeSourceText,
  translatedText,
  sourceLangCode,
  onChangeSourceLang,
  targetLangCode,
  onChangeTargetLang,
  isLoading,
  provider,
  onTranslate,
  isAutoTranslate,
  onToggleAutoTranslate,
  glossaryId,
  onChangeGlossaryId,
  formality,
  onChangeFormality,
  styleRules,
  onChangeStyleRules,
  onSaveAsDefault,
}: TranslationWorkspaceProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const [isSavingDefault, setIsSavingDefault] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSaveDefaultClick = async () => {
    setIsSavingDefault(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      await onSaveAsDefault();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setSaveError(err.message || "Không thể lưu cấu hình mặc định lên hệ thống.");
      setTimeout(() => setSaveError(null), 4000);
    } finally {
      setIsSavingDefault(false);
    }
  };

  const [activeTooltip, setActiveTooltip] = useState<{
    text: string;
    x: number;
    y: number;
    visible: boolean;
  } | null>(null);

  // Calculate plain text character count while preserving line breaks from block-level elements and br tags
  const getPlainText = (html: string) => {
    if (!html) return "";
    try {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      
      // innerText matches the browser's visual layout rules, including correct newlines and list formatting
      const text = tempDiv.innerText || tempDiv.textContent || "";
      return text.trim();
    } catch (e) {
      // Fallback regex approach if document context is not available
      let text = html.replace(/<br\s*\/?>/gi, "\n");
      text = text.replace(/<\/div>/gi, "\n")
                 .replace(/<\/p>/gi, "\n\n")
                 .replace(/<\/h[1-6]>/gi, "\n\n")
                 .replace(/<\/li>/gi, "\n")
                 .replace(/<\/tr>/gi, "\n");
      text = text.replace(/<[^>]+>/g, "");
      
      const entities: Record<string, string> = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&#039;": "'",
        "&nbsp;": " "
      };
      text = text.replace(/&amp;|&lt;|&gt;|&quot;|&#039;|&nbsp;/g, (match) => entities[match] || match);
      text = text.replace(/\n{3,}/g, "\n\n");
      return text.trim();
    }
  };

  const plainSourceText = getPlainText(sourceText);
  const charCount = plainSourceText.length;

  // Sync contentEditable content only on external changes
  useEffect(() => {
    if (editorRef.current) {
      if (editorRef.current.innerHTML !== sourceText) {
        editorRef.current.innerHTML = sourceText;
      }
    }
  }, [sourceText]);

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      
      // Basic undo/redo tracking
      if (historyStack.length === 0 || historyStack[historyStack.length - 1] !== html) {
        setHistoryStack((prev) => [...prev.slice(-30), html]); // Cap at 30 undo steps
        setRedoStack([]);
      }
      
      onChangeSourceText(html);
    }
  };

  const handleFormat = (command: string, value: string = "") => {
    document.execCommand(command, false, value);
    handleInput();
  };

  const handleClearFormatting = () => {
    if (editorRef.current) {
      // Direct sanitization: strip styles and replace tags
      const plainText = editorRef.current.innerText || editorRef.current.textContent || "";
      editorRef.current.innerHTML = plainText;
      onChangeSourceText(plainText);
    }
  };

  const handleUndo = () => {
    if (historyStack.length > 1) {
      const current = historyStack[historyStack.length - 1];
      const previous = historyStack[historyStack.length - 2];
      setRedoStack((prev) => [current, ...prev]);
      setHistoryStack((prev) => prev.slice(0, -1));
      if (editorRef.current) {
        editorRef.current.innerHTML = previous;
        onChangeSourceText(previous);
      }
    }
  };

  const handleRedo = () => {
    if (redoStack.length > 0) {
      const next = redoStack[0];
      setRedoStack((prev) => prev.slice(1));
      setHistoryStack((prev) => [...prev, next]);
      if (editorRef.current) {
        editorRef.current.innerHTML = next;
        onChangeSourceText(next);
      }
    }
  };

  const handleClearAll = () => {
    if (editorRef.current) {
      editorRef.current.innerHTML = "";
    }
    onChangeSourceText("");
    setHistoryStack([]);
    setRedoStack([]);
  };

  const handleCopyTarget = async () => {
    try {
      const plainTranslated = getPlainText(translatedText);
      
      if (navigator.clipboard && window.ClipboardItem) {
        // Prepare HTML and Plain Text blobs so Word/Google Docs paste formatted content correctly
        const htmlBlob = new Blob([translatedText], { type: "text/html" });
        const textBlob = new Blob([plainTranslated], { type: "text/plain" });
        const clipboardItem = new ClipboardItem({
          "text/html": htmlBlob,
          "text/plain": textBlob,
        });
        await navigator.clipboard.write([clipboardItem]);
      } else {
        // Fallback for older browsers or restricted iframe sandboxes
        await navigator.clipboard.writeText(plainTranslated);
      }
      
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Advanced clipboard copy failed, using plain-text fallback:", err);
      try {
        const plainTranslated = getPlainText(translatedText);
        await navigator.clipboard.writeText(plainTranslated);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error("Fallback plain text copy failed:", fallbackErr);
      }
    }
  };

  const handleSwapLanguages = () => {
    if (sourceLangCode === "auto") {
      // Swapping when source is auto-detect: swap to target's current and source's original
      onChangeSourceLang(targetLangCode);
      onChangeTargetLang("vi"); // Default fallback
    } else {
      const temp = sourceLangCode;
      onChangeSourceLang(targetLangCode);
      onChangeTargetLang(temp);
    }
  };

  const speakSource = () => {
    speakText(sourceText, sourceLangCode === "auto" ? "vi" : sourceLangCode);
  };

  const speakTarget = () => {
    speakText(translatedText, targetLangCode);
  };

  const handleTargetMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const matchedEl = target.closest(".applied-style-rule, .applied-glossary") as HTMLElement | null;

    if (matchedEl) {
      const info = matchedEl.getAttribute("data-info") || "";
      if (info) {
        const workspaceEl = document.getElementById("translation-workspace");
        if (workspaceEl) {
          const rect = matchedEl.getBoundingClientRect();
          const workspaceRect = workspaceEl.getBoundingClientRect();
          setActiveTooltip({
            text: info,
            x: (rect.left - workspaceRect.left) + rect.width / 2,
            y: (rect.top - workspaceRect.top) - 8,
            visible: true,
          });
        }
      }
    } else {
      setActiveTooltip(null);
    }
  };

  const handleTargetMouseLeave = () => {
    setActiveTooltip(null);
  };

  return (
    <div className="flex flex-col space-y-4 w-full relative" id="translation-workspace">
      {/* Top Options Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 px-5 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs dark:shadow-xl">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 px-3 py-1 rounded-lg">
            DeepL Translator
          </span>
        </div>

        {/* Auto Translate Toggle and Advanced Settings button */}
        <div className="flex flex-wrap items-center gap-4 self-start sm:self-auto">
          {/* Advanced toggle button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              isAdvancedOpen
                ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/60 shadow-md"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
            title="Cấu hình nâng cao DeepL (Glossary, Style Rules)"
            id="btn-advanced-toggle"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Cấu hình DeepL API</span>
          </motion.button>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Dịch tự động khi gõ</span>
            <button
              type="button"
              onClick={onToggleAutoTranslate}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isAutoTranslate ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-800"
              }`}
              id="toggle-auto-translate"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  isAutoTranslate ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Advanced DeepL Configuration Panel */}
      <AnimatePresence mode="popLayout">
        {isAdvancedOpen && (
          <motion.div
            initial={{ opacity: 0, y: -16, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -16, height: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 150 }}
            className="bg-white dark:bg-slate-900 px-5 py-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs dark:shadow-xl flex flex-col space-y-4 overflow-hidden"
            id="advanced-deepl-panel"
          >
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Sliders className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Cấu hình nâng cao DeepL API (Văn phong & Thuật ngữ)</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Glossary ID field */}
              <div className="flex flex-col space-y-1.5">
                <label htmlFor="input-glossary-id" className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center space-x-1">
                  <BookOpen className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <span>Glossary ID (Tùy chọn)</span>
                </label>
                <input
                  type="text"
                  id="input-glossary-id"
                  value={glossaryId}
                  onChange={(e) => onChangeGlossaryId(e.target.value)}
                  placeholder="Ví dụ: 123e4567-e89b-12d3-a456-426614174000"
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal">
                  Để áp dụng Glossary, bạn <strong>phải chọn ngôn ngữ nguồn cụ thể</strong> (không chọn Tự động phát hiện) khớp với ngôn ngữ của Glossary đã đăng ký trên API của bạn.
                </p>
              </div>

              {/* Formality field */}
              <div className="flex flex-col space-y-1.5">
                <label htmlFor="select-formality" className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center space-x-1">
                  <Sliders className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <span>Độ trang trọng / Văn phong (Formality)</span>
                </label>
                <select
                  id="select-formality"
                  value={formality}
                  onChange={(e) => onChangeFormality(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                >
                  <option value="default" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Tự động / Mặc định (Default)</option>
                  <option value="more" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Trang trọng, lịch sự (Formal / More)</option>
                  <option value="less" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Thân mật, gần gũi (Informal / Less)</option>
                  <option value="prefer_more" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Ưu tiên trang trọng (Prefer More)</option>
                  <option value="prefer_less" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Ưu tiên thân mật (Prefer Less)</option>
                </select>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal">
                  Chỉ hỗ trợ cho một số ngôn ngữ đích nhất định như Nhật Bản (JA), Đức (DE), Pháp (FR), Tây Ban Nha (ES), Nga (RU), v.v. Không áp dụng cho tiếng Anh (EN) hay tiếng Trung (ZH).
                </p>
              </div>
            </div>

            {/* Style Rules field (full width) */}
            <div className="flex flex-col space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label htmlFor="input-style-rules" className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center space-x-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                <span>Quy tắc phong cách dịch thuật & Thay thế thuật ngữ tùy biến (Style Rules / Term Replacements)</span>
              </label>
              <textarea
                id="input-style-rules"
                rows={4}
                value={styleRules}
                onChange={(e) => onChangeStyleRules(e.target.value)}
                placeholder="Ví dụ:&#13;- dự án -> chiến dịch&#13;- hello -> xin kính chào quý khách&#13;- cá nhân hóa -> tối ưu hóa trải nghiệm"
                className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all leading-relaxed"
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal">
                Viết quy tắc thay thế từ hoặc cụm từ tùy chỉnh trên từng dòng bằng cú pháp <code>{"Từ gốc -> Từ mới"}</code>. Hệ thống sẽ tự động tinh chỉnh bản dịch DeepL và làm nổi bật các từ được thay đổi để bạn dễ dàng theo dõi.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-950/50 rounded-lg border border-slate-100 dark:border-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed flex flex-col space-y-2">
              <div className="flex items-start space-x-2">
                <Info className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400 shrink-0 mt-0.5" />
                <p>
                  <strong>💡 Giải thích kỹ thuật:</strong> DeepL API hoạt động độc lập với giao diện Web Translator của DeepL. Khi dịch qua API, DeepL chỉ áp dụng Glossary và Formality nếu các tham số <code>glossary_id</code> và <code>formality</code> được truyền trực tiếp trong payload của request API. Bản thiết lập trên giúp tự động chuyển tiếp các cấu hình này đến máy chủ dịch thuật DeepL.
                </p>
              </div>
            </div>

            {/* Save as system default settings option */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-col space-y-0.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Lưu làm cấu hình mặc định</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal max-w-lg">
                  Lưu văn bản nguồn, ngôn ngữ đã chọn, mã Glossary, văn phong và các quy tắc thay thế phong cách hiện tại thành cấu hình mặc định hệ thống. Người truy cập sau này (bằng link) sẽ nhìn thấy cấu hình này đầu tiên.
                </span>
              </div>
              
              <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
                {saveError && (
                  <span className="text-[10px] font-semibold text-rose-500">{saveError}</span>
                )}
                {saveSuccess && (
                  <span className="text-[10px] font-bold text-emerald-500 flex items-center space-x-1 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded border border-emerald-100 dark:border-emerald-900/50">
                    <Check className="h-3 w-3" />
                    <span>Đã lưu làm mặc định!</span>
                  </span>
                )}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={handleSaveDefaultClick}
                  disabled={isSavingDefault}
                  className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer"
                >
                  {isSavingDefault ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      <span>Lưu làm mặc định</span>
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Translator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT COLUMN: SOURCE */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs dark:shadow-xl flex flex-col focus-within:ring-2 focus-within:ring-indigo-100 dark:focus-within:ring-indigo-950 focus-within:border-indigo-500 transition-all overflow-hidden" id="source-panel">
          {/* Header language selector */}
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
            <LanguageSelector
              selectedLangCode={sourceLangCode}
              onSelect={onChangeSourceLang}
              languages={SUPPORTED_LANGUAGES}
              isSource={true}
              excludeCode={targetLangCode}
            />
            
            <button
              type="button"
              onClick={handleSwapLanguages}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 transition-all cursor-pointer"
              title="Đổi chiều ngôn ngữ"
              id="swap-languages-btn"
            >
              <ArrowRightLeft className="h-4 w-4" />
            </button>
          </div>

          {/* Editor and toolbar */}
          <div className="flex flex-col flex-1 relative">
            <FormattingToolbar
              onFormat={handleFormat}
              onClear={handleClearFormatting}
              onUndo={handleUndo}
              onRedo={handleRedo}
            />

            {/* Custom ContentEditable wrapper */}
            <div className="relative min-h-[220px] lg:min-h-[260px] flex flex-col p-4">
              {charCount === 0 && (
                <div className="absolute top-4 left-4 pointer-events-none text-slate-400 dark:text-slate-500 text-base leading-relaxed max-w-sm select-none">
                  Nhập văn bản cần dịch tại đây...<br />
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">
                    (In đậm, in nghiêng, gạch chân hoặc tạo danh sách để kiểm tra khả năng giữ định dạng)
                  </span>
                </div>
              )}
              
              <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                className="w-full flex-1 text-base text-slate-800 dark:text-slate-100 leading-relaxed outline-none focus:outline-none min-h-[200px]"
                id="source-editor"
                style={{ wordBreak: "break-word" }}
              />
            </div>
          </div>

          {/* Footer controls */}
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-slate-500 dark:text-slate-400">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={speakSource}
                disabled={charCount === 0}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                title="Đọc văn bản gốc"
                id="btn-speak-source"
              >
                <Volume2 className="h-4 w-4" />
              </button>
              {charCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/50 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                  title="Xóa toàn bộ nội dung"
                  id="btn-clear-source"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="text-xs font-semibold">
              <span className={charCount > 4000 ? "text-amber-500" : "text-slate-400 dark:text-slate-500"}>
                {charCount}
              </span>{" "}
              / 5000 ký tự
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: TARGET */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs dark:shadow-xl flex flex-col overflow-hidden" id="target-panel">
          {/* Header language selector */}
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
            <LanguageSelector
              selectedLangCode={targetLangCode}
              onSelect={onChangeTargetLang}
              languages={SUPPORTED_LANGUAGES}
              isSource={false}
              excludeCode={sourceLangCode === "auto" ? undefined : sourceLangCode}
            />

            {/* Translation Status Badge */}
            {provider && !isLoading && (
              <span className="flex items-center space-x-1.5 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/45 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 uppercase tracking-wider shadow-2xs">
                <Zap className="h-3 w-3 text-emerald-500 dark:text-emerald-400 fill-emerald-500 dark:fill-emerald-400 animate-pulse" />
                <span>Dịch bởi {provider}</span>
              </span>
            )}
          </div>

          {/* Translated Content View */}
          <div className="flex-1 min-h-[220px] lg:min-h-[260px] p-4 bg-white dark:bg-slate-900 relative">
            {isLoading ? (
              <div className="absolute inset-0 bg-white/70 dark:bg-slate-950/70 backdrop-blur-[2px] flex flex-col items-center justify-center z-10 transition-all duration-300">
                <Loader2 className="h-8 w-8 text-indigo-500 dark:text-indigo-400 animate-spin" />
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-2 tracking-wide">Đang biên dịch...</span>
              </div>
            ) : null}

            {translatedText ? (
              <div
                className="w-full h-full text-base text-slate-800 dark:text-slate-100 leading-relaxed overflow-y-auto whitespace-pre-wrap select-text markdown-body"
                id="target-output"
                onMouseOver={handleTargetMouseOver}
                onMouseOut={handleTargetMouseOver}
                onMouseLeave={handleTargetMouseLeave}
                dangerouslySetInnerHTML={{ __html: translatedText }}
              />
            ) : (
              <div className="text-slate-400 dark:text-slate-500 text-base leading-relaxed select-none">
                Bản dịch sẽ xuất hiện tại đây...
              </div>
            )}
          </div>

          {/* Footer controls */}
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-slate-500 dark:text-slate-400">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={speakTarget}
                disabled={!translatedText}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                title="Đọc văn bản dịch"
                id="btn-speak-target"
              >
                <Volume2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleCopyTarget}
                disabled={!translatedText}
                className={`p-1.5 rounded-lg transition-all flex items-center space-x-1 border disabled:pointer-events-none ${
                  copied
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/60 text-emerald-600 dark:text-emerald-400"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 border-transparent text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 disabled:opacity-40 cursor-pointer"
                }`}
                title="Sao chép bản dịch"
                id="btn-copy-target"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied && <span className="text-xs font-bold">Đã sao chép!</span>}
              </button>
            </div>

            {/* Manual Translate Button if Auto is off */}
            {!isAutoTranslate && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={onTranslate}
                disabled={charCount === 0 || isLoading}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs shadow-md shadow-indigo-100 dark:shadow-indigo-950/50 hover:shadow-indigo-800 hover:-translate-y-0.5 transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none disabled:transform-none"
                id="manual-translate-btn"
              >
                Dịch ngay
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {activeTooltip && activeTooltip.visible && (
        <div
          className="custom-tooltip-portal"
          style={{
            position: "absolute",
            left: `${activeTooltip.x}px`,
            top: `${activeTooltip.y}px`,
            transform: "translate(-50%, -100%)",
            pointerEvents: "none",
            zIndex: 9999,
          }}
          dangerouslySetInnerHTML={{ __html: activeTooltip.text }}
        />
      )}
    </div>
  );
}

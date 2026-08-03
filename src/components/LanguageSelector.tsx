import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Sparkles } from "lucide-react";
import { Language } from "../types";

interface LanguageSelectorProps {
  selectedLangCode: string;
  onSelect: (code: string) => void;
  languages: Language[];
  isSource?: boolean;
  excludeCode?: string;
}

export default function LanguageSelector({
  selectedLangCode,
  onSelect,
  languages,
  isSource = false,
  excludeCode,
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selectedLanguage = languages.find((l) => l.code === selectedLangCode);
  
  // Filtered languages based on search
  const filteredLanguages = languages.filter((lang) => {
    if (excludeCode && lang.code === excludeCode) return false;
    const searchLower = searchQuery.toLowerCase();
    return (
      lang.name.toLowerCase().includes(searchLower) ||
      lang.nativeName.toLowerCase().includes(searchLower) ||
      lang.code.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="relative inline-block text-left" ref={dropdownRef} id={`lang-selector-${isSource ? "source" : "target"}`}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearchQuery("");
        }}
        className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-xs dark:shadow-md transition-all duration-200 cursor-pointer select-none"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className="truncate">
          {isSource && selectedLangCode === "auto" ? (
            <span className="flex items-center space-x-1.5 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="h-4 w-4" />
              <span>Tự động phát hiện</span>
            </span>
          ) : (
            <span>
              {selectedLanguage ? `${selectedLanguage.name} (${selectedLanguage.nativeName})` : selectedLangCode}
            </span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-64 rounded-xl bg-white dark:bg-slate-900 shadow-xl dark:shadow-2xl border border-slate-200 dark:border-slate-800 z-50 origin-top-left focus:outline-none overflow-hidden">
          {/* Search Bar */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center space-x-1.5">
            <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0 ml-1.5" />
            <input
              type="text"
              placeholder="Tìm kiếm ngôn ngữ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm py-1 focus:outline-none text-slate-850 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              autoFocus
            />
          </div>

          {/* Languages list */}
          <div className="max-h-64 overflow-y-auto py-1 bg-white dark:bg-slate-900">
            {isSource && (
              <button
                type="button"
                onClick={() => {
                  onSelect("auto");
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors ${
                  selectedLangCode === "auto"
                    ? "bg-indigo-55 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Sparkles className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                <span className="truncate">Tự động phát hiện (Auto-detect)</span>
              </button>
            )}

            {filteredLanguages.map((lang) => {
              const isSelected = lang.code === selectedLangCode;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                     onSelect(lang.code);
                     setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors block truncate ${
                    isSelected
                      ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold border-l-2 border-indigo-500 pl-3.5"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{lang.name}</span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal shrink-0 ml-1">
                      {lang.nativeName}
                    </span>
                  </div>
                </button>
              );
            })}

            {filteredLanguages.length === 0 && (
              <div className="px-4 py-3 text-xs text-slate-500 text-center">
                Không tìm thấy kết quả
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

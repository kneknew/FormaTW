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
        className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-300/80 rounded-lg text-sm font-semibold text-slate-700 hover:text-slate-950 hover:bg-slate-50/50 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer select-none"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className="truncate">
          {isSource && selectedLangCode === "auto" ? (
            <span className="flex items-center space-x-1.5 text-indigo-600">
              <Sparkles className="h-4 w-4" />
              <span>Tự động phát hiện</span>
            </span>
          ) : (
            <span>
              {selectedLanguage ? `${selectedLanguage.name} (${selectedLanguage.nativeName})` : selectedLangCode}
            </span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-64 rounded-xl bg-white shadow-xl border border-slate-200 z-50 origin-top-left focus:outline-none overflow-hidden">
          {/* Search Bar */}
          <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center space-x-1.5">
            <Search className="h-4 w-4 text-slate-400 shrink-0 ml-1.5" />
            <input
              type="text"
              placeholder="Tìm kiếm ngôn ngữ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm py-1 focus:outline-none text-slate-700"
              autoFocus
            />
          </div>

          {/* Languages list */}
          <div className="max-h-64 overflow-y-auto py-1">
            {isSource && (
              <button
                type="button"
                onClick={() => {
                  onSelect("auto");
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-2 hover:bg-indigo-50/50 transition-colors ${
                  selectedLangCode === "auto"
                    ? "bg-indigo-50 text-indigo-700 font-semibold"
                    : "text-slate-700 hover:text-slate-900"
                }`}
              >
                <Sparkles className="h-4 w-4 shrink-0 text-indigo-500" />
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
                      ? "bg-indigo-50 text-indigo-700 font-semibold border-l-2 border-indigo-600 pl-3.5"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{lang.name}</span>
                    <span className="text-[11px] text-slate-400 font-normal shrink-0 ml-1">
                      {lang.nativeName}
                    </span>
                  </div>
                </button>
              );
            })}

            {filteredLanguages.length === 0 && (
              <div className="px-4 py-3 text-xs text-slate-400 text-center">
                Không tìm thấy kết quả
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

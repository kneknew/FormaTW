import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  History,
  Star,
  Search,
  Trash2,
  X,
  Languages,
  Clock,
  ArrowRight,
} from "lucide-react";
import { TranslationHistoryItem } from "../types";

interface HistorySidebarProps {
  history: TranslationHistoryItem[];
  onSelectItem: (item: TranslationHistoryItem) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
  onToggleStar: (id: string) => void;
}

export default function HistorySidebar({
  history,
  onSelectItem,
  onDeleteItem,
  onClearAll,
  onToggleStar,
}: HistorySidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyStarred, setShowOnlyStarred] = useState(false);

  // Filtered list
  const filteredHistory = history.filter((item) => {
    const textMatch =
      item.sourceText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.translatedText.toLowerCase().includes(searchQuery.toLowerCase());
    const starMatch = !showOnlyStarred || item.isStarred;
    return textMatch && starMatch;
  });

  // Strip HTML tags for preview snippet
  const stripHtml = (html: string) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || doc.body.innerText || "";
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }) + " " + d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs dark:shadow-xl overflow-hidden" id="history-panel">
      {/* Sidebar Header */}
      <div className="p-5 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <History className="h-4.5 w-4.5 text-indigo-500 dark:text-indigo-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Lịch sử dịch thuật</h2>
        </div>
        <span className="text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
          {history.length}
        </span>
      </div>

      {/* Control Actions & Search */}
      <div className="p-3 border-b border-slate-200/50 dark:border-slate-800/50 flex flex-col space-y-2 bg-slate-50/50 dark:bg-slate-950/30">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Tìm trong lịch sử..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-950 text-sm pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-all"
            id="history-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-xs pt-1">
          <button
            type="button"
            onClick={() => {
              setShowOnlyStarred(!showOnlyStarred);
            }}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-md border transition-all cursor-pointer font-medium ${
              showOnlyStarred
                ? "bg-amber-50 dark:bg-amber-950/45 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 shadow-md"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
            id="toggle-starred-filter"
          >
            <Star className={`h-3.5 w-3.5 ${showOnlyStarred ? "fill-amber-400 text-amber-500" : ""}`} />
            <span>Mục đã lưu</span>
          </button>

          {history.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử dịch không?")) {
                  onClearAll();
                }
              }}
              className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-semibold flex items-center space-x-1 cursor-pointer hover:underline py-1"
              id="clear-all-history"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Xóa tất cả</span>
            </button>
          )}
        </div>
      </div>

      {/* History Items List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-2 space-y-1">
        <AnimatePresence initial={false}>
          {filteredHistory.map((item) => {
            const plainSource = stripHtml(item.sourceText);
            const plainTarget = stripHtml(item.translatedText);
            
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.2 }}
                className="group relative p-3.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all duration-200 flex flex-col space-y-1 text-left cursor-pointer mb-2"
                onClick={() => onSelectItem(item)}
                id={`history-item-${item.id}`}
              >
                {/* Languages Pair & Date */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                  <div className="flex items-center space-x-1.5 font-medium text-slate-600 dark:text-slate-400">
                    <span>{item.sourceLangName}</span>
                    <ArrowRight className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                    <span>{item.targetLangName}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-slate-400 dark:text-slate-500">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(item.timestamp)}</span>
                  </div>
                </div>

                {/* Plain Snippets */}
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-1 break-all">
                  {plainSource}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 break-all pt-0.5 border-t border-dashed border-slate-100 dark:border-slate-800">
                  {plainTarget}
                </p>

                {/* Star & Delete Actions */}
                <div className="flex items-center justify-end space-x-1.5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity pt-1 self-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation(); // Avoid triggering loading item
                      onToggleStar(item.id);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent hover:border-slate-200 dark:hover:border-slate-850 shadow-none hover:shadow-sm"
                    title={item.isStarred ? "Bỏ lưu trữ" : "Lưu trữ bản dịch"}
                    id={`btn-star-${item.id}`}
                  >
                    <Star
                      className={`h-4 w-4 ${
                        item.isStarred ? "fill-amber-400 text-amber-400" : ""
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteItem(item.id);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent hover:border-slate-200 dark:hover:border-slate-850 shadow-none hover:shadow-sm"
                    title="Xóa bản ghi"
                    id={`btn-delete-${item.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredHistory.length === 0 && (
          <div className="py-12 px-4 text-center">
            <Languages className="h-8 w-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Chưa có lịch sử dịch nào</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {showOnlyStarred
                ? "Không tìm thấy bản dịch nào đã lưu"
                : "Các bản dịch của bạn sẽ xuất hiện tại đây"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

import React from "react";
import { Bold, Italic, Underline, List, Trash2, Undo, Redo, RefreshCw } from "lucide-react";

interface FormattingToolbarProps {
  onFormat: (command: string, value?: string) => void;
  onClear: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

export default function FormattingToolbar({
  onFormat,
  onClear,
  onUndo,
  onRedo,
}: FormattingToolbarProps) {
  const tools = [
    {
      id: "bold",
      icon: Bold,
      label: "In đậm",
      command: "bold",
    },
    {
      id: "italic",
      icon: Italic,
      label: "In nghiêng",
      command: "italic",
    },
    {
      id: "underline",
      icon: Underline,
      label: "Gạch chân",
      command: "underline",
    },
    {
      id: "list",
      icon: List,
      label: "Danh sách",
      command: "insertUnorderedList",
    },
  ];

  return (
    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 rounded-t-xl">
      <div className="flex items-center space-x-1.5">
        {tools.map((tool) => {
          const IconComponent = tool.icon;
          return (
            <button
              key={tool.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // Keep focus in editable div
                onFormat(tool.command);
              }}
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-all duration-150 cursor-pointer"
              title={tool.label}
              id={`btn-format-${tool.id}`}
            >
              <IconComponent className="h-4 w-4" />
            </button>
          );
        })}

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onClear();
          }}
          className="px-2.5 py-1 bg-amber-50/65 dark:bg-amber-950/25 border border-amber-200/70 dark:border-amber-900/45 text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200 hover:bg-amber-100/90 dark:hover:bg-amber-950/55 rounded-lg transition-all duration-150 flex items-center space-x-1 font-semibold text-xs cursor-pointer shadow-2xs"
          title="Xóa định dạng"
          id="btn-format-clear"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Bỏ định dạng</span>
        </button>
      </div>

      <div className="flex items-center space-x-2">
        {onUndo && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onUndo();
            }}
            className="px-2.5 py-1 bg-indigo-50/65 dark:bg-indigo-950/25 border border-indigo-200/70 dark:border-indigo-900/45 text-indigo-700 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200 hover:bg-indigo-100/90 dark:hover:bg-indigo-950/55 rounded-lg transition-all duration-150 flex items-center space-x-1 font-semibold text-xs cursor-pointer shadow-2xs"
            title="Hoàn tác (Ctrl+Z)"
            id="btn-format-undo"
          >
            <Undo className="h-3.5 w-3.5" />
            <span>Hoàn tác</span>
          </button>
        )}
        {onRedo && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onRedo();
            }}
            className="px-2.5 py-1 bg-indigo-50/65 dark:bg-indigo-950/25 border border-indigo-200/70 dark:border-indigo-900/45 text-indigo-700 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200 hover:bg-indigo-100/90 dark:hover:bg-indigo-950/55 rounded-lg transition-all duration-150 flex items-center space-x-1 font-semibold text-xs cursor-pointer shadow-2xs"
            title="Làm lại"
            id="btn-format-redo"
          >
            <Redo className="h-3.5 w-3.5" />
            <span>Làm lại</span>
          </button>
        )}
      </div>
    </div>
  );
}

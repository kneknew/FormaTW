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
    <div className="flex items-center justify-between border-b border-[#F3F4F6] bg-[#F9FAFB] px-4 py-2.5 rounded-t-xl">
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
              className="p-1.5 text-[#4B5563] hover:text-[#0F2D52] hover:bg-[#F3F4F6] rounded transition-all duration-150 cursor-pointer"
              title={tool.label}
              id={`btn-format-${tool.id}`}
            >
              <IconComponent className="h-4 w-4" />
            </button>
          );
        })}

        <div className="h-4 w-px bg-slate-200 mx-1"></div>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onClear();
          }}
          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-[#F3F4F6] rounded transition-all duration-150 flex items-center space-x-1 cursor-pointer"
          title="Xóa định dạng"
          id="btn-format-clear"
        >
          <Trash2 className="h-4 w-4" />
          <span className="text-xs font-semibold">Bỏ định dạng</span>
        </button>
      </div>

      <div className="flex items-center space-x-1">
        {onUndo && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onUndo();
            }}
            className="p-1.5 text-[#4B5563] hover:text-[#0F2D52] hover:bg-[#F3F4F6] rounded transition-all duration-150 cursor-pointer"
            title="Hoàn tác (Ctrl+Z)"
            id="btn-format-undo"
          >
            <Undo className="h-4 w-4" />
          </button>
        )}
        {onRedo && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onRedo();
            }}
            className="p-1.5 text-[#4B5563] hover:text-[#0F2D52] hover:bg-[#F3F4F6] rounded transition-all duration-150 cursor-pointer"
            title="Làm lại"
            id="btn-format-redo"
          >
            <Redo className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

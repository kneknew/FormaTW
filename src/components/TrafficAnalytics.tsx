import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Activity,
  Clock,
  Zap,
  AlertTriangle,
  RotateCw,
  Trash2,
  TrendingUp,
  FileText,
  CheckCircle,
  BarChart2,
  Filter,
  Globe,
  ArrowRight,
  Server,
  HardDrive,
  AlertCircle,
  Check,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

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

interface ApiMetrics {
  totalRequests: number;
  totalChars: number;
  successfulRequests: number;
  failedRequests: number;
  cacheHits: number;
  cacheHitChars: number;
  totalLatencyMs: number;
  recentRequests: ApiMetricEntry[];
  deeplUsage?: {
    character_count: number;
    character_limit: number;
  };
}

type LogFilter = "all" | "hit" | "miss" | "error";

export default function TrafficAnalytics() {
  const [metrics, setMetrics] = useState<ApiMetrics | null>(null);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ApiMetricEntry | null>(null);
  const [logFilter, setLogFilter] = useState<LogFilter>("all");
  const [hoveredPoint, setHoveredPoint] = useState<ApiMetricEntry | null>(null);

  const fetchMetrics = useCallback(async (showIndicator = false) => {
    if (showIndicator) setIsLoading(true);
    try {
      const response = await fetch("/api/metrics");
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error("Failed to fetch API metrics:", err);
    } finally {
      if (showIndicator) setIsLoading(false);
    }
  }, []);

  const handleResetMetrics = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lưu lượng phân tích hiện tại?")) return;
    setIsLoading(true);
    try {
      const response = await fetch("/api/metrics/reset", { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics);
        setSelectedRequest(null);
        setHoveredPoint(null);
      }
    } catch (err) {
      console.error("Failed to reset API metrics:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Poll metrics every 3 seconds if Auto-Refresh is active
  useEffect(() => {
    fetchMetrics(true);

    let intervalId: NodeJS.Timeout | null = null;
    if (isAutoRefresh) {
      intervalId = setInterval(() => {
        fetchMetrics(false);
      }, 3000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAutoRefresh, fetchMetrics]);

  // Loading Placeholder
  if (!metrics) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 shadow-xs dark:shadow-xl flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center space-y-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-full border-2 border-indigo-100 dark:border-indigo-950/40 border-t-indigo-600 dark:border-t-indigo-400 animate-spin" />
            <Activity className="h-4 w-4 text-indigo-600 dark:text-indigo-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold tracking-wide">Đang đồng bộ phân tích API...</p>
        </div>
      </div>
    );
  }

  // Statistics calculation
  const totalRequests = metrics.totalRequests;
  const cacheHitRate = totalRequests > 0 ? (metrics.cacheHits / totalRequests) * 100 : 0;
  const avgLatency =
    metrics.successfulRequests - metrics.cacheHits > 0
      ? metrics.totalLatencyMs / (metrics.successfulRequests - metrics.cacheHits)
      : 0;
  const errorRate = totalRequests > 0 ? (metrics.failedRequests / totalRequests) * 100 : 0;

  // Resource Limit
  const isRealUsage = !!metrics.deeplUsage;
  const limitMax = metrics.deeplUsage ? metrics.deeplUsage.character_limit : 500000;
  const currentChars = metrics.deeplUsage ? metrics.deeplUsage.character_count : metrics.totalChars;
  const limitPercentage = Math.min((currentChars / limitMax) * 100, 100);

  // Filter logs
  const filteredRequests = metrics.recentRequests.filter((req) => {
    if (logFilter === "hit") return req.cacheHit;
    if (logFilter === "miss") return !req.cacheHit && req.status === "success";
    if (logFilter === "error") return req.status === "error";
    return true;
  });

  // Top Language Pairs calculation
  const topLanguagePairs = (() => {
    const counts: { [key: string]: { count: number; source: string; target: string } } = {};
    metrics.recentRequests.forEach((req) => {
      const key = `${req.sourceLang.toUpperCase()} ➔ ${req.targetLang.toUpperCase()}`;
      if (!counts[key]) {
        counts[key] = { count: 0, source: req.sourceLang, target: req.targetLang };
      }
      counts[key].count += 1;
    });

    return Object.entries(counts)
      .map(([pair, info]) => ({ pair, ...info }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  })();

  const maxLanguageCount = topLanguagePairs.length > 0 ? topLanguagePairs[0].count : 1;

  // Successful non-cached requests chronologically for graph
  const successfulRequestsChronological = [...metrics.recentRequests]
    .filter((r) => r.status === "success" && !r.cacheHit)
    .slice(0, 15)
    .reverse();

  const maxChartLatency = Math.max(...successfulRequestsChronological.map((r) => r.latencyMs), 1200);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs dark:shadow-xl flex flex-col overflow-hidden" id="traffic-analytics-panel">
      {/* PANEL HEADER */}
      <div className="px-5 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-indigo-550/10 dark:bg-indigo-400/10 rounded-lg text-indigo-650 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Phân Tích Lưu Lượng API</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-bold flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-550"></span>
              </span>
              <span>Đồng bộ và giám sát hiệu năng thực tế</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          {/* Live indicator toggle */}
          <button
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            className={`px-2 py-1 rounded-md text-[9px] font-extrabold transition-all duration-200 border cursor-pointer flex items-center space-x-1 ${
              isAutoRefresh
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60 shadow-2xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
            }`}
            title={isAutoRefresh ? "Tạm dừng tự động cập nhật" : "Bật tự động cập nhật"}
          >
            <span className={`h-1 w-1 rounded-full ${isAutoRefresh ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
            <span>{isAutoRefresh ? "LIVE" : "DỪNG"}</span>
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => fetchMetrics(true)}
            disabled={isLoading}
            className="p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-md text-slate-500 dark:text-slate-300 transition-colors disabled:opacity-50 cursor-pointer"
            title="Đồng bộ dữ liệu mới nhất"
          >
            <RotateCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          {/* Clear Logs */}
          <button
            onClick={handleResetMetrics}
            className="p-1.5 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-slate-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-900 text-rose-550 dark:text-rose-400 rounded-md transition-colors cursor-pointer"
            title="Xóa toàn bộ thống kê"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="p-4 flex flex-col space-y-4">
        {/* STATS HIGHLIGHT GRID */}
        <div className="grid grid-cols-2 gap-3">
          {/* Card 1: Requests */}
          <div className="p-3 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-xl flex flex-col justify-between hover:border-slate-200 dark:hover:border-slate-800 transition-all duration-150 group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Yêu cầu</span>
              <div className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
                <Server className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline space-x-1">
                <span className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{totalRequests}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold">gọi</span>
              </div>
              <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-1">
                <span>Thành công:</span>
                <span className="text-emerald-600 dark:text-emerald-400">{metrics.successfulRequests}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Characters */}
          <div className="p-3 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-xl flex flex-col justify-between hover:border-slate-200 dark:hover:border-slate-800 transition-all duration-150 group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Ký tự thật</span>
              <div className="p-1 rounded-md bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
                <FileText className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline space-x-0.5">
                <span className="text-xl font-black text-slate-850 dark:text-slate-100 tracking-tight">{metrics.totalChars.toLocaleString()}</span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">ký tự</span>
              </div>
              <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-1">
                <span>Ước tính:</span>
                <span className="text-slate-500 dark:text-slate-400">DeepL Standard</span>
              </div>
            </div>
          </div>

          {/* Card 3: Cache Hit Rate */}
          <div className="p-3 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-xl flex flex-col justify-between hover:border-slate-200 dark:hover:border-slate-800 transition-all duration-150 group relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Tỷ lệ Cache</span>
              <div className="p-1 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
                <Zap className="h-3.5 w-3.5 fill-amber-500/20" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline space-x-1">
                <span className="text-2xl font-black text-amber-650 dark:text-amber-450 tracking-tight">{cacheHitRate.toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-1">
                <span>Tiết kiệm:</span>
                <span className="text-amber-600 dark:text-amber-400 font-black">+{metrics.cacheHitChars.toLocaleString()} ký tự</span>
              </div>
            </div>
          </div>

          {/* Card 4: Response Speed */}
          <div className="p-3 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-xl flex flex-col justify-between hover:border-slate-200 dark:hover:border-slate-800 transition-all duration-150 group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Phản hồi API</span>
              <div className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
                <Clock className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline space-x-0.5">
                <span className="text-2xl font-black text-emerald-650 dark:text-emerald-450 tracking-tight">
                  {avgLatency > 0 ? `${Math.round(avgLatency)}` : "0"}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">ms</span>
              </div>
              <div className="flex items-center justify-between text-[9px] mt-1">
                <span className="text-slate-400 dark:text-slate-500 font-bold">Trạng thái:</span>
                <span className={`font-black ${avgLatency > 1000 ? "text-amber-500" : "text-emerald-500"}`}>
                  {avgLatency === 0 ? "Ưu việt" : avgLatency < 500 ? "Rất nhanh" : "Ổn định"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RESOURCE LIMITS & LANGUAGE POPULARITY ROW */}
        <div className="grid grid-cols-1 gap-3">
          {/* DeepL Character Limit Status */}
          <div className="p-3.5 bg-slate-50/30 dark:bg-slate-950/30 border border-slate-150 dark:border-slate-850 rounded-xl flex flex-col justify-between space-y-3">
            <div>
              <div className="flex justify-between items-center text-[10px] font-extrabold uppercase tracking-wider">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <HardDrive className="h-3 w-3 text-slate-400" />
                  Hạn ngạch DeepL API
                </span>
                <span className="text-slate-700 dark:text-slate-200">
                  {currentChars.toLocaleString()} / {limitMax.toLocaleString()}
                </span>
              </div>
              
              {/* Progress bar container */}
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 mt-2 overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    limitPercentage > 85
                      ? "bg-rose-500"
                      : limitPercentage > 50
                      ? "bg-amber-500"
                      : "bg-indigo-600 dark:bg-indigo-500"
                  }`}
                  style={{ width: `${limitPercentage}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-bold">
              <span>Còn lại: {(limitMax - currentChars).toLocaleString()} ký tự</span>
              <span>{limitPercentage.toFixed(2)}%</span>
            </div>
          </div>

          {/* Top Translation Language Pairs */}
          <div className="p-3.5 bg-slate-50/30 dark:bg-slate-950/30 border border-slate-150 dark:border-slate-850 rounded-xl flex flex-col space-y-2">
            <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Globe className="h-3 w-3 text-slate-400" />
              Cặp ngôn ngữ dịch nhiều nhất
            </span>

            {topLanguagePairs.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-2">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Chưa có bản ghi thống kê ngôn ngữ</span>
              </div>
            ) : (
              <div className="space-y-1.5 flex-1 justify-center flex flex-col">
                {topLanguagePairs.map((item, idx) => {
                  const widthPercentage = (item.count / maxLanguageCount) * 100;
                  return (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 dark:text-slate-350">
                        <span className="flex items-center gap-1 uppercase font-black text-slate-700 dark:text-slate-100">
                          {item.source} <ArrowRight className="h-2 w-2" /> {item.target}
                        </span>
                        <span>{item.count} lần dịch</span>
                      </div>
                      <div className="w-full bg-slate-150 dark:bg-slate-850 rounded-full h-1">
                        <div
                          className="bg-indigo-500 dark:bg-indigo-400 h-1 rounded-full transition-all duration-300"
                          style={{ width: `${widthPercentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* LATENCY INTERACTIVE SVG CHART */}
        <div className="p-3.5 border border-slate-150 dark:border-slate-850 bg-slate-50/20 dark:bg-slate-950/10 rounded-xl flex flex-col space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center space-x-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Biểu đồ thời gian xử lý API ({successfulRequestsChronological.length} cuộc gọi gần nhất)</span>
            </span>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              Bỏ qua Cache Hits (0ms)
            </span>
          </div>

          {successfulRequestsChronological.length < 2 ? (
            <div className="h-32 bg-slate-50/40 dark:bg-slate-950/30 rounded-xl flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800">
              <BarChart2 className="h-5 w-5 text-slate-300 dark:text-slate-700 mb-1.5" />
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold max-w-xs text-center px-4 leading-normal">
                Chưa đủ các lượt gọi API thật để vẽ đồ thị thời gian phản hồi. Vui lòng tiến hành dịch một văn bản mới!
              </p>
            </div>
          ) : (
            <div className="relative h-36 w-full flex flex-col justify-end pt-4">
              {/* Tooltip Overlay */}
              {hoveredPoint && (
                <div className="absolute top-0 right-2 bg-slate-800 dark:bg-slate-950 text-white p-2 rounded-lg text-[9px] border border-slate-700 dark:border-slate-800 shadow-lg z-10 max-w-[200px] leading-relaxed font-semibold">
                  <p className="text-indigo-300 font-bold text-[10px] border-b border-slate-700 pb-1 mb-1">
                    Thời gian: {new Date(hoveredPoint.timestamp).toLocaleTimeString()}
                  </p>
                  <p>• Độ trễ: <strong className="text-amber-300 font-black">{hoveredPoint.latencyMs}ms</strong></p>
                  <p>• Độ dài: <strong>{hoveredPoint.charCount} ký tự</strong></p>
                  <p className="truncate text-slate-300">• Nội dung: <span className="italic">"{hoveredPoint.textSnippet}"</span></p>
                </div>
              )}

              {/* Y-Axis Label Scale left side */}
              <div className="absolute left-0 bottom-4 top-2 w-8 flex flex-col justify-between text-[8px] font-bold text-slate-400 dark:text-slate-600 text-right pr-1 pointer-events-none border-r border-slate-100 dark:border-slate-850">
                <span>{maxChartLatency}ms</span>
                <span>{Math.round(maxChartLatency / 2)}ms</span>
                <span>0ms</span>
              </div>

              {/* SVG Main Area */}
              <div className="pl-9 pr-2 h-24 relative">
                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                  {/* Dotted Grid lines */}
                  <line x1="0%" y1="0%" x2="100%" y2="0%" stroke="currentColor" className="text-slate-100 dark:text-slate-850" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="0%" y1="50%" x2="100%" y2="50%" stroke="currentColor" className="text-slate-100 dark:text-slate-850" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="0%" y1="100%" x2="100%" y2="100%" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="1" />

                  {/* Gradient Area Fill under the line */}
                  <polygon
                    fill="url(#latency-glow-gradient)"
                    points={`0,100 ${successfulRequestsChronological
                      .map((req, idx) => {
                        const x = (idx / (successfulRequestsChronological.length - 1)) * 100;
                        const y = 100 - (req.latencyMs / maxChartLatency) * 100;
                        return `${x}%,${y}%`;
                      })
                      .join(" ")} 100%,100`}
                    className="w-full h-full"
                  />

                  {/* Polyline Path */}
                  <polyline
                    fill="none"
                    stroke="#4F46E5"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={successfulRequestsChronological
                      .map((req, idx) => {
                        const x = (idx / (successfulRequestsChronological.length - 1)) * 100;
                        const y = 100 - (req.latencyMs / maxChartLatency) * 100;
                        return `${x}%,${y}%`;
                      })
                      .join(" ")}
                    className="w-full h-full"
                  />

                  {/* Gradient definition */}
                  <defs>
                    <linearGradient id="latency-glow-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Data Points hover circle markers */}
                  {successfulRequestsChronological.map((req, idx) => {
                    const x = `${(idx / (successfulRequestsChronological.length - 1)) * 100}%`;
                    const y = `${100 - (req.latencyMs / maxChartLatency) * 100}%`;
                    const isHovered = hoveredPoint?.id === req.id;
                    return (
                      <g
                        key={req.id}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredPoint(req)}
                        onMouseLeave={() => setHoveredPoint(null)}
                        onClick={() => setSelectedRequest(req)}
                      >
                        {/* Interactive hotspot larger circle */}
                        <circle cx={x} cy={y} r="10" fill="transparent" />
                        
                        {/* Visual marker */}
                        <circle
                          cx={x}
                          cy={y}
                          r={isHovered ? "5" : "3.5"}
                          fill={isHovered ? "#6366F1" : "#4F46E5"}
                          stroke="white"
                          strokeWidth={isHovered ? "2" : "1.5"}
                          className="transition-all duration-150"
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* X-Axis scale */}
              <div className="pl-9 pr-2 flex justify-between text-[8px] text-slate-400 dark:text-slate-500 font-bold mt-1.5 pt-1.5 border-t border-slate-150 dark:border-slate-850">
                <span>{new Date(successfulRequestsChronological[0].timestamp).toLocaleTimeString()}</span>
                <span>Diễn biến phản hồi (X-tuyến tính theo chuỗi gọi)</span>
                <span>{new Date(successfulRequestsChronological[successfulRequestsChronological.length - 1].timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* LOG FILTER TABS & TRANSACTION LOGGER */}
        <div className="flex flex-col space-y-2">
          {/* Header & Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 pt-1">
            <span className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center space-x-1.5">
              <Filter className="h-3.5 w-3.5 text-indigo-550" />
              <span>Nhật ký giao dịch gần đây (Last 10 transactions)</span>
            </span>

            {/* Filter Pill List */}
            <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200/50 dark:border-slate-800/80">
              {(["all", "miss", "hit", "error"] as const).map((filter) => {
                const label =
                  filter === "all"
                    ? "Tất cả"
                    : filter === "miss"
                    ? "API Thực"
                    : filter === "hit"
                    ? "Cache Hit"
                    : "Lỗi";
                const isSelected = logFilter === filter;
                return (
                  <button
                    key={filter}
                    onClick={() => {
                      setLogFilter(filter);
                      setSelectedRequest(null);
                    }}
                    className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold cursor-pointer transition-all ${
                      isSelected
                        ? "bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 shadow-2xs"
                        : "text-slate-400 dark:text-slate-500 hover:text-slate-650 dark:hover:text-slate-350"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Transactions list */}
          {filteredRequests.length === 0 ? (
            <div className="p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center bg-slate-50/20 dark:bg-slate-950/10">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">Không tìm thấy bản ghi tương thích bộ lọc này</p>
            </div>
          ) : (
            <div className="border border-slate-200/70 dark:border-slate-850/80 rounded-xl overflow-hidden bg-white dark:bg-slate-950 shadow-3xs max-h-[220px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-150 dark:border-slate-850 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                    <th className="px-3 py-2 text-center">Thời gian</th>
                    <th className="px-3 py-2">Cặp ngôn ngữ</th>
                    <th className="px-2 py-2 text-center">Ký tự</th>
                    <th className="px-2 py-2 text-center">Phản hồi</th>
                    <th className="px-3 py-2 text-center">Hành vi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-semibold text-[11px]">
                  {filteredRequests.slice(0, 10).map((req) => (
                    <tr
                      key={req.id}
                      onClick={() => setSelectedRequest(selectedRequest?.id === req.id ? null : req)}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors cursor-pointer ${
                        selectedRequest?.id === req.id ? "bg-indigo-50/50 dark:bg-indigo-950/20" : ""
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center text-slate-400 dark:text-slate-500 whitespace-nowrap text-[10px]">
                        {new Date(req.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="px-3 py-2.5 uppercase text-slate-700 dark:text-slate-200 font-black tracking-wide whitespace-nowrap">
                        {req.sourceLang} ➔ {req.targetLang}
                      </td>
                      <td className="px-2 py-2.5 text-center text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {req.charCount}
                      </td>
                      <td className="px-2 py-2.5 text-center whitespace-nowrap text-slate-700 dark:text-slate-350 font-bold">
                        {req.cacheHit ? "0ms" : `${req.latencyMs}ms`}
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {req.status === "success" ? (
                          <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 px-2 py-0.5 rounded-full">
                            <Check className="h-2.5 w-2.5" />
                            <span>OK</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/30 px-2 py-0.5 rounded-full">
                            <AlertCircle className="h-2.5 w-2.5 animate-pulse" />
                            <span>LỖI</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* REQUEST INSPECTOR */}
          <AnimatePresence>
            {selectedRequest && (
              <motion.div
                initial={{ opacity: 0, height: 0, scale: 0.98 }}
                animate={{ opacity: 1, height: "auto", scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="p-3.5 bg-slate-50/80 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col space-y-3 text-xs overflow-hidden"
              >
                <div className="flex justify-between items-center border-b border-slate-250/50 dark:border-slate-800/80 pb-2">
                  <span className="font-extrabold text-slate-850 dark:text-slate-100 flex items-center space-x-1.5">
                    <span className="text-xs font-black uppercase text-indigo-650 dark:text-indigo-400">Chi tiết giao dịch</span>
                    <span className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      #{selectedRequest.id.substring(0, 8)}
                    </span>
                  </span>
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-black uppercase tracking-wider cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-0.5">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-bold block text-[8px] uppercase tracking-wider">Thời gian:</span>
                    <span className="text-slate-700 dark:text-slate-200 font-bold mt-0.5 block">
                      {new Date(selectedRequest.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-bold block text-[8px] uppercase tracking-wider">Cặp ngôn ngữ:</span>
                    <span className="text-indigo-650 dark:text-indigo-400 font-extrabold uppercase mt-0.5 block">
                      {selectedRequest.sourceLang} ➔ {selectedRequest.targetLang}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-bold block text-[8px] uppercase tracking-wider">Độ dài:</span>
                    <span className="text-slate-700 dark:text-slate-200 font-bold mt-0.5 block">
                      {selectedRequest.charCount} ký tự
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-bold block text-[8px] uppercase tracking-wider">Trạng thái xử lý:</span>
                    <span className="text-slate-700 dark:text-slate-200 font-bold mt-0.5 block">
                      {selectedRequest.cacheHit ? "0ms (Bộ nhớ đệm)" : `${selectedRequest.latencyMs}ms (DeepL API)`}
                    </span>
                  </div>
                </div>

                <div className="pt-0.5">
                  <span className="text-slate-400 dark:text-slate-500 font-bold block text-[8px] uppercase tracking-wider">Trích xuất văn bản nguồn:</span>
                  <p className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-2.5 rounded-lg text-slate-600 dark:text-slate-350 leading-relaxed max-h-20 overflow-y-auto italic mt-1 font-medium select-text break-words">
                    {selectedRequest.textSnippet}
                  </p>
                </div>

                {selectedRequest.status === "error" && selectedRequest.errorMsg && (
                  <div className="p-2 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 text-rose-700 dark:text-rose-350 rounded-lg text-[10px] leading-relaxed font-semibold flex items-start gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-rose-650 dark:text-rose-450">API Error:</strong> {selectedRequest.errorMsg}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

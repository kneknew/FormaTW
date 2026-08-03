import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Clock,
  Zap,
  AlertTriangle,
  RotateCw,
  Trash2,
  TrendingUp,
  FileText,
  HelpCircle,
  CheckCircle,
  BarChart2,
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

export default function TrafficAnalytics() {
  const [metrics, setMetrics] = useState<ApiMetrics | null>(null);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ApiMetricEntry | null>(null);

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

  if (!metrics) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs dark:shadow-xl flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center space-y-3">
          <RotateCw className="h-6 w-6 text-indigo-600 dark:text-indigo-400 animate-spin" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold tracking-wide">Đang tải dữ liệu lưu lượng...</p>
        </div>
      </div>
    );
  }

  // Calculate high-level stats
  const totalRequests = metrics.totalRequests;
  const cacheHitRate = totalRequests > 0 ? (metrics.cacheHits / totalRequests) * 100 : 0;
  const avgLatency =
    metrics.successfulRequests - metrics.cacheHits > 0
      ? metrics.totalLatencyMs / (metrics.successfulRequests - metrics.cacheHits)
      : 0;
  const errorRate = totalRequests > 0 ? (metrics.failedRequests / totalRequests) * 100 : 0;

  // DeepL Free Tier Limit Tracking (Real-time usage vs local cache)
  const isRealUsage = !!metrics.deeplUsage;
  const limitMax = metrics.deeplUsage ? metrics.deeplUsage.character_limit : 500000;
  const currentChars = metrics.deeplUsage ? metrics.deeplUsage.character_count : metrics.totalChars;
  const limitPercentage = Math.min((currentChars / limitMax) * 100, 100);

  // Generate SVG Chart Data for Latency Trend (last 15 successful requests, chronological order)
  const successfulRequestsChronological = [...metrics.recentRequests]
    .filter((r) => r.status === "success" && !r.cacheHit)
    .slice(0, 15)
    .reverse();

  const maxChartLatency = Math.max(...successfulRequestsChronological.map((r) => r.latencyMs), 1500);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs dark:shadow-xl flex flex-col overflow-hidden" id="traffic-analytics-panel">
      {/* HEADER SECTION */}
      <div className="px-5 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/60">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">Phân tích API & Cache</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Giám sát hiệu năng thời gian thực</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Auto Refresh Toggle */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer flex items-center space-x-1.5 ${
              isAutoRefresh
                ? "bg-emerald-50 dark:bg-emerald-950/45 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 shadow-md"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <div className={`h-1.5 w-1.5 rounded-full ${isAutoRefresh ? "bg-emerald-550 dark:bg-emerald-400 animate-ping" : "bg-slate-400 dark:bg-slate-500"}`}></div>
            <span>{isAutoRefresh ? "LIVE" : "DỪNG"}</span>
          </motion.button>

          {/* Refresh Action */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => fetchMetrics(true)}
            disabled={isLoading}
            className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-300 transition-colors cursor-pointer disabled:opacity-40"
            title="Tải lại ngay"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </motion.button>

          {/* Reset Metrics */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleResetMetrics}
            className="p-1.5 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-950 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg transition-colors cursor-pointer"
            title="Đặt lại thống kê"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </motion.button>
        </div>
      </div>

      <div className="p-5 flex flex-col space-y-6">
        {/* STATS BENTO GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Stats Box 1: Total Requests */}
          <div className="p-4 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-xl flex flex-col justify-between transition-all duration-200 hover:bg-slate-100/50 dark:hover:bg-slate-950/60">
            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
              <Activity className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
              <span>Tổng yêu cầu</span>
            </span>
            <div className="mt-2.5 flex items-baseline space-x-1">
              <span className="text-2xl font-extrabold text-slate-850 dark:text-slate-100 tracking-tight">{totalRequests}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">lần</span>
            </div>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mt-1">Gồm cả cache hits</p>
          </div>

          {/* Stats Box 2: Total Chars */}
          <div className="p-4 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-xl flex flex-col justify-between transition-all duration-200 hover:bg-slate-100/50 dark:hover:bg-slate-950/60">
            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
              <FileText className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
              <span>Ký tự đã dịch</span>
            </span>
            <div className="mt-2.5 flex items-baseline space-x-1">
              <span className="text-2xl font-extrabold text-slate-850 dark:text-slate-100 tracking-tight">{metrics.totalChars.toLocaleString()}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">chữ</span>
            </div>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mt-1">Không tính từ cache</p>
          </div>

          {/* Stats Box 3: Cache Hit Rate */}
          <div className="p-4 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-xl flex flex-col justify-between transition-all duration-200 hover:bg-slate-100/50 dark:hover:bg-slate-950/60">
            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
              <span>Tỷ lệ Cache Hit</span>
            </span>
            <div className="mt-2.5 flex items-baseline space-x-1">
              <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 tracking-tight">{cacheHitRate.toFixed(1)}%</span>
            </div>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mt-1">
              Tiết kiệm <strong className="text-slate-700 dark:text-slate-300">{metrics.cacheHitChars.toLocaleString()}</strong> ký tự
            </p>
          </div>

          {/* Stats Box 4: Average Latency */}
          <div className="p-4 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-xl flex flex-col justify-between transition-all duration-200 hover:bg-slate-100/50 dark:hover:bg-slate-950/60">
            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
              <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Phản hồi TB</span>
            </span>
            <div className="mt-2.5 flex items-baseline space-x-1">
              <span className="text-2xl font-extrabold text-slate-850 dark:text-slate-100 tracking-tight">
                {avgLatency > 0 ? `${Math.round(avgLatency)}` : "0"}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">ms</span>
            </div>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mt-1">Chỉ tính cuộc gọi API thực</p>
          </div>
        </div>

        {/* DEEPL CHARACTERS LIMIT METRIC TRACKER */}
        <div className="p-4.5 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl border border-slate-150 dark:border-slate-850 flex flex-col space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
            <span className="font-bold text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-1.5">
              <span>{isRealUsage ? "Định mức ký tự thực tế từ DeepL API Key" : "Định mức ký tự tài khoản DeepL Free (Ước lượng)"}</span>
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                {isRealUsage ? "Đồng bộ từ tài khoản" : "Mặc định 500k ký tự/tháng"}
              </span>
            </span>
            <span className="font-extrabold text-slate-700 dark:text-slate-200 whitespace-nowrap">
              {currentChars.toLocaleString()} / {limitMax.toLocaleString()} ({limitPercentage.toFixed(2)}%)
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                limitPercentage > 85 ? "bg-rose-500" : limitPercentage > 50 ? "bg-amber-500" : "bg-indigo-600"
              }`}
              style={{ width: `${limitPercentage}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-none">
            <span>Đã sử dụng</span>
            <span>Còn lại: {(limitMax - currentChars).toLocaleString()} ký tự</span>
          </div>
        </div>

        {/* LATENCY CHART & VISUAL TREND */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Visual SVG Sparkline Trend */}
          <div className="p-4 border border-slate-150 dark:border-slate-850 bg-slate-55/40 dark:bg-slate-950/20 rounded-xl flex flex-col space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                <span>Biểu đồ phản hồi API (Last 15 requests)</span>
              </span>
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Bỏ qua cache hits (0ms)</span>
            </div>

            {successfulRequestsChronological.length < 2 ? (
              <div className="h-36 bg-slate-50/55 dark:bg-slate-950/50 rounded-lg flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-850">
                <div className="text-center p-4">
                  <BarChart2 className="h-5 w-5 text-slate-400 dark:text-slate-600 mx-auto mb-1.5" />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Chưa đủ dữ liệu cuộc gọi API thực tế để vẽ biểu đồ.</p>
                </div>
              </div>
            ) : (
              <div className="relative h-36 w-full flex flex-col justify-end pt-2">
                {/* SVG Graph */}
                <svg className="w-full h-24 overflow-visible" preserveAspectRatio="none">
                  {/* Grid Lines */}
                  <line x1="0%" y1="0%" x2="100%" y2="0%" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="1" />
                  <line x1="0%" y1="50%" x2="100%" y2="50%" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="1" />
                  <line x1="0%" y1="100%" x2="100%" y2="100%" stroke="currentColor" className="text-slate-200 dark:text-slate-900" strokeWidth="1" />

                  {/* Polyline */}
                  <polyline
                    fill="none"
                    stroke="#818CF8"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={successfulRequestsChronological
                      .map((req, idx) => {
                        const x = (idx / (successfulRequestsChronological.length - 1)) * 100;
                        const y = 100 - (req.latencyMs / maxChartLatency) * 100;
                        return `${x}%,${y}%`;
                      })
                      .join(" ")}
                  />

                  {/* Glowing Area under line */}
                  <polygon
                    fill="url(#latency-gradient)"
                    opacity="0.08"
                    points={`0%,100% ${successfulRequestsChronological
                      .map((req, idx) => {
                        const x = (idx / (successfulRequestsChronological.length - 1)) * 100;
                        const y = 100 - (req.latencyMs / maxChartLatency) * 100;
                        return `${x}%,${y}%`;
                      })
                      .join(" ")} 100%,100%`}
                  />

                  {/* Definitions for Gradient */}
                  <defs>
                    <linearGradient id="latency-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818CF8" />
                      <stop offset="100%" stopColor="#818CF8" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Interactive circles */}
                  {successfulRequestsChronological.map((req, idx) => {
                    const x = `${(idx / (successfulRequestsChronological.length - 1)) * 100}%`;
                    const y = `${100 - (req.latencyMs / maxChartLatency) * 100}%`;
                    return (
                      <g key={req.id} className="group cursor-pointer">
                        <circle
                          cx={x}
                          cy={y}
                          r="4"
                          fill="#818CF8"
                          className="stroke-white dark:stroke-slate-950 transition-transform group-hover:scale-150"
                          strokeWidth="1.5"
                        />
                        <title>{`Thời gian: ${new Date(req.timestamp).toLocaleTimeString() || ""}\nĐộ trễ: ${req.latencyMs}ms\nKý tự: ${req.charCount}`}</title>
                      </g>
                    );
                  })}
                </svg>

                {/* X-Axis labels */}
                <div className="flex justify-between text-[8px] text-slate-400 dark:text-slate-500 font-bold mt-2 pt-1 border-t border-slate-150 dark:border-slate-850">
                  <span>{new Date(successfulRequestsChronological[0].timestamp).toLocaleTimeString()}</span>
                  <span>Diễn biến phản hồi (Y-max: {maxChartLatency}ms)</span>
                  <span>{new Date(successfulRequestsChronological[successfulRequestsChronological.length - 1].timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Metrics Explanation & Summary */}
          <div className="p-4 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-xl flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center space-x-1.5 mb-2">
                <CheckCircle className="h-4 w-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
                <span>Tổng quan Hiệu năng Hệ thống</span>
              </h4>
              <div className="space-y-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                <p>
                  ⚡ <strong>Bộ nhớ đệm thông minh (Cache):</strong> Hoạt động ngay tức khắc. Khi dịch lại văn bản trùng lặp, hệ thống phản hồi trong vòng <strong>0ms</strong> (không gọi API DeepL, tiết kiệm tối đa hạn ngạch API).
                </p>
                <p>
                  🎯 <strong>Căn chỉnh tự động:</strong> Quy tắc phong cách dịch thuật cá nhân hóa và highlight thuật ngữ được biên dịch cục bộ, không làm tăng thêm độ trễ API.
                </p>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-155 dark:border-slate-850 text-[10px] text-slate-400 dark:text-slate-500 flex justify-between items-center">
              <span>Trạng thái Cache hiện tại:</span>
              <span className="font-extrabold text-[9px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/45 border border-emerald-100 dark:border-emerald-900/50 px-1.5 py-0.5 rounded-full tracking-wide">ONLINE</span>
            </div>
          </div>
        </div>

        {/* RECENT REQUESTS TABLE */}
        <div className="flex flex-col space-y-2.5">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center space-x-1.5">
            <Activity className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
            <span>Nhật ký giao dịch API thời gian thực (Last 10 transactions)</span>
          </span>

          {metrics.recentRequests.length === 0 ? (
            <div className="p-8 border border-dashed border-slate-200 dark:border-slate-850 rounded-xl text-center bg-slate-50/50 dark:bg-slate-950/30">
              <p className="text-xs text-slate-400 dark:text-slate-500 font-bold leading-normal">Chưa có giao dịch API nào được ghi nhận. Hãy tiến hành dịch thuật để xem thống kê!</p>
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-850 rounded-xl overflow-hidden shadow-xs dark:shadow-md bg-white dark:bg-slate-950">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-850 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-3">Thời gian</th>
                      <th className="px-4 py-3">Ngôn ngữ</th>
                      <th className="px-3 py-3 text-center">Ký tự</th>
                      <th className="px-3 py-3 text-center">Thời gian phản hồi</th>
                      <th className="px-4 py-3">Nguồn</th>
                      <th className="px-3 py-3 text-center">Bộ nhớ đệm</th>
                      <th className="px-4 py-3 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-medium">
                    {metrics.recentRequests.slice(0, 10).map((req) => (
                      <tr
                        key={req.id}
                        onClick={() => setSelectedRequest(req)}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors cursor-pointer ${
                          selectedRequest?.id === req.id ? "bg-indigo-50/60 dark:bg-indigo-950/30 hover:bg-indigo-55/80 dark:hover:bg-indigo-950/40" : ""
                        }`}
                      >
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap text-[11px]">
                          {new Date(req.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-2.5 uppercase text-slate-700 dark:text-slate-200 font-extrabold text-[11px] whitespace-nowrap">
                          {req.sourceLang} → {req.targetLang}
                        </td>
                        <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {req.charCount}
                        </td>
                        <td className="px-3 py-2.5 text-center text-slate-700 dark:text-slate-300 whitespace-nowrap font-bold">
                          {req.cacheHit ? "0ms" : `${req.latencyMs}ms`}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 max-w-[120px] truncate">
                          {req.textSnippet}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          {req.cacheHit ? (
                            <span className="inline-flex items-center space-x-1 text-[9px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/45 border border-amber-100 dark:border-amber-900/50 px-2 py-0.5 rounded-full">
                              <Zap className="h-2.5 w-2.5 fill-amber-500 text-amber-500 animate-pulse" />
                              <span>HIT</span>
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-extrabold px-2 py-0.5 border border-slate-200 dark:border-slate-850 rounded-full bg-slate-50 dark:bg-slate-950/40">
                              MISS
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center whitespace-nowrap">
                          {req.status === "success" ? (
                            <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/45 border border-emerald-100 dark:border-emerald-900/50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                              OK
                            </span>
                          ) : (
                            <span className="text-[9px] font-extrabold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/45 border border-rose-100 dark:border-rose-900/50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                              ERR
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* REQUEST INSPECTOR DETAILS */}
          <AnimatePresence>
            {selectedRequest && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: 15 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: 15 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="p-4.5 bg-slate-50/55 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-850 rounded-xl flex flex-col space-y-3.5 text-xs overflow-hidden"
              >
                <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-850 pb-2.5">
                  <span className="font-extrabold text-slate-700 dark:text-slate-200 flex items-center space-x-2">
                    <span className="text-xs uppercase tracking-wide text-indigo-600 dark:text-indigo-400">Chi tiết giao dịch API</span>
                    <span className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">#{selectedRequest.id.substring(0, 8)}</span>
                  </span>
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-extrabold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-extrabold block text-[9px] uppercase tracking-wider">Thời gian:</span>
                    <span className="text-slate-700 dark:text-slate-200 font-bold mt-0.5 block">{new Date(selectedRequest.timestamp).toLocaleTimeString()} ({new Date(selectedRequest.timestamp).toLocaleDateString()})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-extrabold block text-[9px] uppercase tracking-wider">Cặp ngôn ngữ:</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-extrabold uppercase mt-0.5 block">{selectedRequest.sourceLang} → {selectedRequest.targetLang}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-extrabold block text-[9px] uppercase tracking-wider">Độ dài văn bản:</span>
                    <span className="text-slate-700 dark:text-slate-200 font-bold mt-0.5 block">{selectedRequest.charCount} ký tự</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-extrabold block text-[9px] uppercase tracking-wider">Thời gian xử lý:</span>
                    <span className="text-slate-700 dark:text-slate-200 font-bold mt-0.5 block">{selectedRequest.cacheHit ? "0ms (Bộ nhớ đệm)" : `${selectedRequest.latencyMs}ms`}</span>
                  </div>
                </div>
                <div className="pt-1">
                  <span className="text-slate-400 dark:text-slate-500 font-extrabold block text-[9px] uppercase tracking-wider">Văn bản nguồn dịch thuật:</span>
                  <p className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-850 p-3 rounded-xl text-slate-600 dark:text-slate-300 leading-relaxed max-h-24 overflow-y-auto italic text-[11px] mt-1.5 break-words font-medium shadow-3xs">
                    {selectedRequest.textSnippet}
                  </p>
                </div>
                {selectedRequest.status === "error" && selectedRequest.errorMsg && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-xl text-[11px] leading-relaxed font-medium">
                    <strong className="text-rose-600 dark:text-rose-400">⚠️ Thông báo lỗi API:</strong> {selectedRequest.errorMsg}
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

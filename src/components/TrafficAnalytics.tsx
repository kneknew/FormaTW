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
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center space-y-3">
          <RotateCw className="h-6 w-6 text-[#312E81] animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Đang tải dữ liệu phân tích lưu lượng...</p>
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
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm flex flex-col overflow-hidden" id="traffic-analytics-panel">
      {/* HEADER SECTION */}
      <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 bg-[#312E81]/10 rounded-lg text-[#312E81]">
            <Activity className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Phân tích Lưu lượng API & Cache</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Giám sát và đo lường thời gian thực (Real-time)</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all cursor-pointer flex items-center space-x-1 ${
              isAutoRefresh
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
            }`}
          >
            <div className={`h-1.5 w-1.5 rounded-full ${isAutoRefresh ? "bg-emerald-500 animate-ping" : "bg-slate-400"}`}></div>
            <span>{isAutoRefresh ? "Tự động tải" : "Dừng tự động"}</span>
          </button>

          {/* Refresh Action */}
          <button
            onClick={() => fetchMetrics(true)}
            disabled={isLoading}
            className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-md text-slate-600 transition-colors cursor-pointer"
            title="Tải lại ngay"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          {/* Reset Metrics */}
          <button
            onClick={handleResetMetrics}
            className="p-1.5 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-md transition-colors cursor-pointer"
            title="Đặt lại thống kê"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="p-5 flex flex-col space-y-6">
        {/* STATS BENTO GRID */}
        <div className="grid grid-cols-2 gap-3">
          {/* Stats Box 1: Total Requests */}
          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-lg flex flex-col space-y-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
              <Activity className="h-3 w-3 text-indigo-500 shrink-0" />
              <span>Tổng yêu cầu</span>
            </span>
            <div className="flex items-baseline space-x-1">
              <span className="text-xl font-bold text-slate-800">{totalRequests}</span>
              <span className="text-[10px] text-slate-400">lần</span>
            </div>
            <p className="text-[9px] text-slate-400">Gồm cả cache hits</p>
          </div>

          {/* Stats Box 2: Total Chars */}
          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-lg flex flex-col space-y-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
              <FileText className="h-3 w-3 text-blue-500 shrink-0" />
              <span>Ký tự đã dịch</span>
            </span>
            <div className="flex items-baseline space-x-1">
              <span className="text-xl font-bold text-slate-800">{metrics.totalChars.toLocaleString()}</span>
              <span className="text-[10px] text-slate-400">chữ</span>
            </div>
            <p className="text-[9px] text-slate-400">Không tính từ cache</p>
          </div>

          {/* Stats Box 3: Cache Hit Rate */}
          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-lg flex flex-col space-y-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
              <Zap className="h-3 w-3 text-amber-500 shrink-0" />
              <span>Tỷ lệ Cache Hit</span>
            </span>
            <div className="flex items-baseline space-x-1">
              <span className="text-xl font-bold text-amber-600">{cacheHitRate.toFixed(1)}%</span>
            </div>
            <p className="text-[9px] text-slate-400">
              Tiết kiệm <strong className="text-slate-600">{metrics.cacheHitChars.toLocaleString()}</strong> ký tự
            </p>
          </div>

          {/* Stats Box 4: Average Latency */}
          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-lg flex flex-col space-y-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
              <Clock className="h-3 w-3 text-emerald-500 shrink-0" />
              <span>Phản hồi TB</span>
            </span>
            <div className="flex items-baseline space-x-1">
              <span className="text-xl font-bold text-slate-800">
                {avgLatency > 0 ? `${Math.round(avgLatency)}` : "0"}
              </span>
              <span className="text-[10px] text-slate-400">ms</span>
            </div>
            <p className="text-[9px] text-slate-400">Chỉ tính cuộc gọi API thực</p>
          </div>

          {/* Stats Box 5: Error Rate */}
          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-lg flex flex-col space-y-1.5 col-span-2 md:col-span-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
              <AlertTriangle className="h-3 w-3 text-rose-500 shrink-0" />
              <span>Tỷ lệ lỗi API</span>
            </span>
            <div className="flex items-baseline space-x-1">
              <span className={`text-xl font-bold ${metrics.failedRequests > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {errorRate.toFixed(1)}%
              </span>
            </div>
            <p className="text-[9px] text-slate-400">
              Thất bại: <strong className="text-slate-600">{metrics.failedRequests}</strong> lần
            </p>
          </div>
        </div>

        {/* DEEPL CHARACTERS LIMIT METRIC TRACKER */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100/80 flex flex-col space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-700 flex items-center space-x-1.5">
              <span>{isRealUsage ? "Định mức ký tự thực tế từ DeepL API Key" : "Định mức ký tự tài khoản DeepL Free (Ước lượng)"}</span>
              <span className="text-[10px] font-normal text-slate-400">
                {isRealUsage ? "(Đồng bộ từ tài khoản của bạn)" : "(Mặc định 500,000 ký tự/tháng)"}
              </span>
            </span>
            <span className="font-bold text-slate-800">
              {currentChars.toLocaleString()} / {limitMax.toLocaleString()} ({limitPercentage.toFixed(2)}%)
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                limitPercentage > 85 ? "bg-rose-500" : limitPercentage > 50 ? "bg-amber-500" : "bg-blue-600"
              }`}
              style={{ width: `${limitPercentage}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 leading-none">
            <span>Đã sử dụng</span>
            <span>Còn lại: {(limitMax - currentChars).toLocaleString()} ký tự</span>
          </div>
        </div>

        {/* LATENCY CHART & VISUAL TREND */}
        <div className="flex flex-col gap-4">
          {/* Visual SVG Sparkline Trend */}
          <div className="p-4 border border-slate-200/70 rounded-xl flex flex-col space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
                <span>Biểu đồ thời gian phản hồi API thực tế (Last 15 requests)</span>
              </span>
              <span className="text-[10px] font-medium text-slate-400">Bỏ qua cache hits (0ms)</span>
            </div>

            {successfulRequestsChronological.length < 2 ? (
              <div className="h-36 bg-slate-50 rounded-lg flex items-center justify-center border border-dashed border-slate-200">
                <div className="text-center p-4">
                  <BarChart2 className="h-5 w-5 text-slate-300 mx-auto mb-1.5" />
                  <p className="text-[10px] text-slate-400 font-medium">Chưa đủ dữ liệu cuộc gọi API thực tế để vẽ biểu đồ.</p>
                </div>
              </div>
            ) : (
              <div className="relative h-36 w-full flex flex-col justify-end pt-2">
                {/* SVG Graph */}
                <svg className="w-full h-24 overflow-visible" preserveAspectRatio="none">
                  {/* Grid Lines */}
                  <line x1="0%" y1="0%" x2="100%" y2="0%" stroke="#F1F5F9" strokeWidth="1" />
                  <line x1="0%" y1="50%" x2="100%" y2="50%" stroke="#F1F5F9" strokeWidth="1" />
                  <line x1="0%" y1="100%" x2="100%" y2="100%" stroke="#E2E8F0" strokeWidth="1" />

                  {/* Polyline */}
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
                  />

                  {/* Glowing Area under line */}
                  <polygon
                    fill="url(#latency-gradient)"
                    opacity="0.12"
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
                      <stop offset="0%" stopColor="#4F46E5" />
                      <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
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
                          r="4.5"
                          fill="#4F46E5"
                          stroke="#FFFFFF"
                          strokeWidth="1.5"
                          className="transition-transform group-hover:scale-150"
                        />
                        <title>{`Thời gian: ${new Date(req.timestamp).toLocaleTimeString() || ""}\nĐộ trễ: ${req.latencyMs}ms\nKý tự: ${req.charCount}`}</title>
                      </g>
                    );
                  })}
                </svg>

                {/* X-Axis labels */}
                <div className="flex justify-between text-[8px] text-slate-400 font-bold mt-2 pt-1 border-t border-slate-100">
                  <span>{new Date(successfulRequestsChronological[0].timestamp).toLocaleTimeString()}</span>
                  <span>Diễn biến phản hồi (Y-max: {maxChartLatency}ms)</span>
                  <span>{new Date(successfulRequestsChronological[successfulRequestsChronological.length - 1].timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Metrics Explanation & Summary */}
          <div className="p-4 bg-[#F9FAFB] border border-slate-200/50 rounded-xl flex flex-col justify-between">
            <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5 mb-2">
              <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Tổng quan Hiệu năng Hệ thống</span>
            </h4>
            <div className="space-y-2.5 text-[11px] text-slate-600 leading-relaxed">
              <p>
                ⚡ <strong>Bộ nhớ đệm thông minh (Cache):</strong> Hoạt động ngay tức khắc. Khi dịch lại văn bản trùng lặp, hệ thống phản hồi trong vòng <strong>0ms</strong> (không gọi API DeepL, giúp tiết kiệm băng thông và chi phí tối đa).
              </p>
              <p>
                🎯 <strong>Căn chỉnh tự động:</strong> Quy tắc phong cách dịch thuật cá nhân hóa và highlight thuật ngữ được biên dịch cục bộ, không làm tăng thêm độ trễ API.
              </p>
            </div>
            <div className="mt-3.5 pt-3 border-t border-slate-200/70 text-[10px] text-slate-400 flex justify-between items-center">
              <span>Trạng thái Cache hiện tại:</span>
              <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">ONLINE</span>
            </div>
          </div>
        </div>

        {/* RECENT REQUESTS TABLE */}
        <div className="flex flex-col space-y-2.5">
          <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
            <Activity className="h-3.5 w-3.5 text-indigo-500" />
            <span>Nhật ký giao dịch API thời gian thực (Last 10 transactions)</span>
          </span>

          {metrics.recentRequests.length === 0 ? (
            <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center">
              <p className="text-xs text-slate-400 font-semibold leading-normal">Chưa có giao dịch API nào được ghi nhận. Hãy tiến hành dịch thuật để xem thống kê!</p>
            </div>
          ) : (
            <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-3">Thời gian</th>
                      <th className="px-4 py-3">Ngôn ngữ</th>
                      <th className="px-3 py-3 text-center">Ký tự</th>
                      <th className="px-3 py-3 text-center">Thời gian phản hồi</th>
                      <th className="px-4 py-3">Nguồn</th>
                      <th className="px-3 py-3 text-center">Bộ nhớ đệm</th>
                      <th className="px-4 py-3 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {metrics.recentRequests.slice(0, 10).map((req) => (
                      <tr
                        key={req.id}
                        onClick={() => setSelectedRequest(req)}
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                          selectedRequest?.id === req.id ? "bg-indigo-50/45 hover:bg-indigo-50/60" : ""
                        }`}
                      >
                        <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap text-[11px]">
                          {new Date(req.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-2.5 uppercase text-slate-700 font-bold text-[11px] whitespace-nowrap">
                          {req.sourceLang} → {req.targetLang}
                        </td>
                        <td className="px-3 py-2.5 text-center text-slate-600 whitespace-nowrap">
                          {req.charCount}
                        </td>
                        <td className="px-3 py-2.5 text-center text-slate-600 whitespace-nowrap font-bold">
                          {req.cacheHit ? "0ms" : `${req.latencyMs}ms`}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 max-w-[120px] truncate">
                          {req.textSnippet}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          {req.cacheHit ? (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                              <Zap className="h-2.5 w-2.5" />
                              <span>HIT</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold px-2 py-0.5 border border-slate-200 rounded-full">
                              MISS
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center whitespace-nowrap">
                          {req.status === "success" ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                              Thành công
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full">
                              Lỗi
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
          {selectedRequest && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col space-y-2 text-xs">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                  <span>Chi tiết yêu cầu API</span>
                  <span className="text-[10px] font-mono text-slate-400">#{selectedRequest.id}</span>
                </span>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="text-[10px] text-slate-400 hover:text-slate-600 font-bold"
                >
                  Đóng
                </button>
              </div>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 pt-1">
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Thời gian:</span>
                  <span className="text-slate-700 font-semibold">{new Date(selectedRequest.timestamp).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Cặp ngôn ngữ:</span>
                  <span className="text-slate-700 font-semibold uppercase">{selectedRequest.sourceLang} → {selectedRequest.targetLang}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Độ dài văn bản:</span>
                  <span className="text-slate-700 font-semibold">{selectedRequest.charCount} ký tự</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Thời gian xử lý:</span>
                  <span className="text-slate-700 font-semibold">{selectedRequest.cacheHit ? "0ms (Bộ nhớ đệm)" : `${selectedRequest.latencyMs}ms`}</span>
                </div>
              </div>
              <div className="pt-2">
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Văn bản nguồn dịch thuật:</span>
                <p className="bg-white border border-slate-150 p-2.5 rounded-lg text-slate-700 leading-relaxed max-h-24 overflow-y-auto italic text-[11px] mt-1 break-words">
                  {selectedRequest.textSnippet}
                </p>
              </div>
              {selectedRequest.status === "error" && selectedRequest.errorMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-[11px] leading-relaxed">
                  <strong>⚠️ Thông báo lỗi API:</strong> {selectedRequest.errorMsg}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

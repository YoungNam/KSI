"use client";

import React, { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { WatchlistSection } from "@/components/watchlist-section";
import { FileText, Play, RefreshCw, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  fetchLatestReport,
  fetchReportList,
  fetchBriefingStatus,
  runBriefing,
  type LatestReport,
  type ReportListItem,
} from "@/lib/api";
import { formatDateKo } from "@/lib/utils";

/** 리포트 타입 정의 */
type ReportType = "morning" | "open" | "close" | "evening";

/** KST 시간 기준 브리핑 타입 자동 결정 */
function getReportTypeByTime(): ReportType {
  // KST = UTC+9
  const now = new Date();
  const kstHour = (now.getUTCHours() + 9) % 24;
  if (kstHour < 9) return "morning";
  if (kstHour < 16) return "open";
  if (kstHour < 21) return "close";
  return "evening";
}

/** 리포트 탭 메타데이터 */
const reportTabs: {
  value: ReportType;
  label: string;
  emoji: string;
  description: string;
}[] = [
  {
    value: "morning",
    label: "모닝",
    emoji: "07:00",
    description: "장 전 모닝 브리핑",
  },
  {
    value: "open",
    label: "장초반",
    emoji: "09:10",
    description: "장 초반 업데이트",
  },
  {
    value: "close",
    label: "장마감",
    emoji: "16:10",
    description: "장 마감 리포트",
  },
  {
    value: "evening",
    label: "이브닝",
    emoji: "21:00",
    description: "이브닝 브리핑",
  },
];

/** 리포트 타입 한국어 레이블 */
const reportTypeLabel: Record<string, string> = {
  morning: "모닝",
  open: "장초반",
  close: "장마감",
  evening: "이브닝",
};

/** 단일 리포트 뷰어 컴포넌트 */
function ReportViewer({
  reportType,
  onTabChange,
}: {
  reportType: ReportType;
  onTabChange?: (tab: ReportType) => void;
}) {
  const [report, setReport] = useState<LatestReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  /** 리포트 로드 — 404는 빈 상태로 처리 */
  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLatestReport(reportType);
      setReport(data);
    } catch (err) {
      if (err instanceof Error && err.message.includes("404")) {
        setReport(null);
      } else {
        setError(
          err instanceof Error ? err.message : "리포트를 불러오지 못했습니다."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [reportType]);

  useEffect(() => {
    loadReport();
    // 언마운트 시 폴링 인터벌 정리
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadReport]);

  /** 브리핑 즉시 실행 — 상태 폴링으로 완료/실패 감지 */
  async function handleRunBriefing() {
    // 이미 폴링 중이면 중단
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setPolling(false);
    }

    setRunning(true);
    setRunMessage(null);
    try {
      // 시간 기반으로 브리핑 타입 자동 결정
      const autoType = getReportTypeByTime();
      const result = await runBriefing(autoType);
      // 해당 타입 탭으로 자동 전환
      if (onTabChange && autoType !== reportType) {
        onTabChange(autoType);
      }
      setRunMessage("브리핑 실행 중...");

      // 실행 전 파일 수정 시각 기억 (날짜 대신 mtime으로 비교)
      const prevMtime = report?.file_mtime ?? null;
      setPolling(true);

      const MAX_ATTEMPTS = 36; // 최대 3분 (5초 × 36)
      let attempt = 0;

      intervalRef.current = setInterval(async () => {
        attempt++;
        try {
          // 1) 태스크 실행 상태 확인
          const { status } = await fetchBriefingStatus(reportType);

          if (status.startsWith("failed")) {
            // 실패 시 즉시 중단
            setRunMessage(`브리핑 실패: ${status.replace("failed: ", "")}`);
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            setPolling(false);
            return;
          }

          if (status === "done") {
            // 완료 → 새 파일 가져오기
            const latest = await fetchLatestReport(reportType);
            if (latest.file_mtime !== prevMtime) {
              setReport(latest);
              setRunMessage("새 브리핑이 생성됐습니다.");
            } else {
              setRunMessage("브리핑 완료 (내용 변경 없음)");
            }
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            setPolling(false);
            return;
          }

          // status === "running" | "idle" → 계속 대기
          setRunMessage(`브리핑 실행 중... (${attempt * 5}초 경과)`);
        } catch {
          // 일시적 네트워크 오류 — 계속 대기
        }

        if (attempt >= MAX_ATTEMPTS) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setPolling(false);
          setRunMessage("브리핑 실행 시간 초과 — 새로고침 후 확인하세요.");
        }
      }, 5000);

      void result; // 응답 메시지는 폴링으로 대체
    } catch (err) {
      setRunMessage(
        err instanceof Error ? err.message : "브리핑 실행 요청에 실패했습니다."
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 액션 버튼 영역 */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={loadReport}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          새로고침
        </Button>
        <Button
          size="sm"
          onClick={handleRunBriefing}
          disabled={running}
          className="gap-2"
        >
          <Play className="w-4 h-4" />
          {running ? "실행 중..." : `${reportTypeLabel[getReportTypeByTime()] ?? ""} 브리핑 즉시 실행`}
        </Button>
      </div>

      {/* 실행 메시지 */}
      {runMessage && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary flex items-center gap-2">
          {polling && (
            <span className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
          )}
          {runMessage}
          {polling && (
            <span className="text-xs text-primary/70 ml-auto">새 리포트 감지 중...</span>
          )}
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* 로딩 상태 */}
      {loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-muted-foreground">리포트 로딩 중...</p>
          </CardContent>
        </Card>
      )}

      {/* 리포트 콘텐츠 */}
      {!loading && report && (
        <Card>
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold text-foreground">
                  {reportTypeLabel[report.report_type] ?? report.report_type} 브리핑
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {formatDateKo(report.report_date)}
                  </span>
                </div>
              </div>
              <Badge variant="secondary" className="flex-shrink-0">
                {report.report_type}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {/* Markdown 렌더링 */}
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {report.content}
              </ReactMarkdown>
            </div>
            {/* 파일 경로 표시 */}
            {report.file_path && (
              <div className="mt-4 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground font-mono">
                  {report.file_path}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 리포트 없음 */}
      {!loading && !report && !error && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              아직 생성된 리포트가 없습니다.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              &quot;브리핑 즉시 실행&quot; 버튼으로 리포트를 생성할 수 있습니다.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** 리포트 목록 사이드패널 */
function ReportListPanel() {
  const [list, setList] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReportList()
      .then((data) => setList(data.reports))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3 border-b border-border">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          리포트 목록
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3 px-2">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-12 bg-secondary rounded animate-pulse"
              />
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            리포트 없음
          </p>
        ) : (
          <div className="space-y-1">
            {list.map((item) => (
              <div
                key={item.filename}
                className="flex flex-col px-3 py-2 rounded-md hover:bg-secondary transition-colors"
              >
                <div className="flex items-center justify-between">
                  <Badge
                    variant="secondary"
                    className="text-xs px-1.5 py-0"
                  >
                    {reportTypeLabel[item.type] ?? item.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {item.size_kb.toFixed(1)}KB
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {item.date}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 브리핑 리포트 페이지
 * - 탭: 모닝 / 장초반 / 장마감 / 이브닝
 * - 각 탭에서 최신 리포트 조회 및 Markdown 렌더링
 * - 사이드패널: 전체 리포트 목록
 */
export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportType>("morning");

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">브리핑 리포트</h1>
        <p className="text-sm text-muted-foreground mt-1">
          일 4회 자동 생성 브리핑 (07:00 / 09:10 / 16:10 / 21:00)
        </p>
      </div>

      {/* 관심종목 현황 */}
      <WatchlistSection />

      {/* 메인 레이아웃: 탭 콘텐츠 + 사이드패널 */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* 좌측: 리포트 탭 뷰어 */}
        <div className="flex-1 min-w-0">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as ReportType)}
          >
            <TabsList className="mb-4 flex-wrap gap-1">
              {reportTabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  <span className="mr-1.5 text-muted-foreground text-xs">
                    {tab.emoji}
                  </span>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {reportTabs.map((tab) => (
              <TabsContent key={tab.value} value={tab.value}>
                <ReportViewer reportType={tab.value} onTabChange={setActiveTab} />
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* 우측: 리포트 목록 사이드패널 */}
        <div className="lg:w-56 flex-shrink-0">
          <ReportListPanel />
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock,
  DollarSign,
  Inbox,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildCumulativeSeries,
  MiniSparkline,
} from "@/components/dashboard/mini-sparkline";
import {
  FilterPills,
  PageHeader,
} from "@/components/dashboard/page-header";
import { UploadHero } from "@/components/dashboard/upload-hero";
import { parseJsonResponse } from "@/lib/api-client";
import type {
  DashboardAnalytics,
  ExpenseRecord,
  ProjectRecord,
  TimesheetImportRecord,
} from "@/lib/types";

const ExecutiveCharts = dynamic(
  () =>
    import("@/components/dashboard/executive-charts").then(
      (mod) => mod.ExecutiveCharts,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="dashboard-panel h-80 animate-pulse bg-secondary/20" />
        <div className="dashboard-panel h-80 animate-pulse bg-secondary/20" />
        <div className="dashboard-panel h-80 animate-pulse bg-secondary/20 lg:col-span-2" />
      </div>
    ),
  },
);

type ExpenseFilter = "all" | "pending_approval" | "approved" | "failed";

const statusConfig = {
  pending_approval: {
    label: "Pending",
    icon: Clock,
    className: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    className: "border-success/20 bg-success/10 text-success",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    className: "border-destructive/20 bg-destructive/10 text-destructive",
  },
};

const typeLabels = {
  overhead: "Overhead",
  project_direct: "Project Direct",
  unknown: "Unknown",
};

function formatCurrency(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type StatCardProps = {
  label: string;
  value: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
  isLoading?: boolean;
  highlight?: boolean;
  footer?: ReactNode;
};

function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  isLoading,
  highlight,
  footer,
}: StatCardProps) {
  return (
    <div
      className={`dashboard-stat-card flex flex-col gap-3 ${highlight ? "dashboard-stat-card-accent" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="dashboard-stat-label">{label}</p>
          {isLoading ? (
            <Skeleton className="h-9 w-28" />
          ) : (
            <p
              className={`dashboard-stat-value ${highlight ? "text-primary" : ""}`}
            >
              {value}
            </p>
          )}
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Icon className="size-4 shrink-0 text-muted-foreground/70" />
      </div>
      {footer}
    </div>
  );
}

export default function DashboardPage() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [pendingTimesheets, setPendingTimesheets] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expenseFilter, setExpenseFilter] = useState<ExpenseFilter>("all");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        const [expensesRes, projectsRes, analyticsRes, importsRes] =
          await Promise.all([
          fetch("/api/expenses"),
          fetch("/api/projects"),
          fetch("/api/analytics"),
          fetch("/api/timesheet-imports"),
        ]);

        const expensesPayload = await parseJsonResponse<{
          expenses?: ExpenseRecord[];
          error?: string;
        }>(expensesRes);
        const projectsPayload = await parseJsonResponse<{
          projects?: ProjectRecord[];
          error?: string;
        }>(projectsRes);
        const analyticsPayload = await parseJsonResponse<{
          analytics?: DashboardAnalytics;
          error?: string;
        }>(analyticsRes);
        const importsPayload = await parseJsonResponse<{
          imports?: TimesheetImportRecord[];
          error?: string;
        }>(importsRes);

        if (!expensesRes.ok) {
          throw new Error(expensesPayload.error ?? "Failed to load expenses");
        }
        if (!projectsRes.ok) {
          throw new Error(projectsPayload.error ?? "Failed to load projects");
        }

        if (!cancelled) {
          setExpenses(expensesPayload.expenses ?? []);
          setProjects(projectsPayload.projects ?? []);
          setAnalytics(
            analyticsRes.ok ? (analyticsPayload.analytics ?? null) : null,
          );
          setPendingTimesheets(
            importsRes.ok
              ? (importsPayload.imports ?? []).filter(
                  (item) => item.status === "pending_approval",
                ).length
              : 0,
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load dashboard data",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const approvedExpenses = expenses.filter((e) => e.status === "approved");
  const pendingCount = expenses.filter(
    (e) => e.status === "pending_approval",
  ).length;
  const reviewQueueCount = pendingCount + pendingTimesheets;

  const totalOverhead = approvedExpenses
    .filter((e) => e.expense_type === "overhead")
    .reduce((sum, e) => sum + (e.total_amount ?? 0), 0);

  const totalDirect = approvedExpenses
    .filter((e) => e.expense_type === "project_direct")
    .reduce((sum, e) => sum + (e.total_amount ?? 0), 0);

  const activeProjects = projects.filter((p) => p.status === "active");

  const overheadSeries = useMemo(() => {
    const amounts = approvedExpenses
      .filter((e) => e.expense_type === "overhead")
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
      .map((e) => e.total_amount ?? 0);

    return buildCumulativeSeries(amounts);
  }, [approvedExpenses]);

  const filteredExpenses = useMemo(() => {
    if (expenseFilter === "all") return expenses;
    return expenses.filter((expense) => expense.status === expenseFilter);
  }, [expenses, expenseFilter]);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-7 px-8 py-8">
      <PageHeader
        title="Dashboard"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Overview" },
        ]}
        action={
          reviewQueueCount > 0 ? (
            <Link href="/dashboard/triage">
              <Button size="lg" className="rounded-lg px-5">
                Review Queue
                <span className="ml-2 flex size-5 items-center justify-center rounded-full bg-primary-foreground/20 text-xs font-semibold">
                  {reviewQueueCount}
                </span>
              </Button>
            </Link>
          ) : null
        }
      />

      <section>
        <p className="dashboard-section-title mb-4">Financial snapshot</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Approved Overhead"
            value={`$${formatCurrency(totalOverhead)}`}
            subtitle={`${approvedExpenses.filter((e) => e.expense_type === "overhead").length} approved · OpEx`}
            icon={TrendingUp}
            isLoading={isLoading}
          />
          <StatCard
            label="Project Expenses"
            value={`$${formatCurrency(totalDirect)}`}
            subtitle={`${approvedExpenses.filter((e) => e.expense_type === "project_direct").length} approved · COGS`}
            icon={DollarSign}
            isLoading={isLoading}
          />
          <StatCard
            label="Active Projects"
            value={String(activeProjects.length)}
            subtitle={`${projects.length} total in workspace`}
            icon={Briefcase}
            isLoading={isLoading}
          />
          <StatCard
            label="Pending Review"
            value={String(reviewQueueCount)}
            subtitle={
              reviewQueueCount === 0
                ? "Inbox is clear"
                : `${pendingCount} expenses · ${pendingTimesheets} timesheets`
            }
            icon={Inbox}
            highlight={reviewQueueCount > 0}
            isLoading={isLoading}
            footer={
              reviewQueueCount > 0 ? (
                <Link href="/dashboard/triage" className="block pt-1">
                  <Button size="sm" className="w-full rounded-lg">
                    Review inbox
                    <ArrowRight className="ml-1.5 size-3.5" />
                  </Button>
                </Link>
              ) : null
            }
          />
        </div>

        {!isLoading && overheadSeries.length > 0 ? (
          <div className="dashboard-panel mt-4">
            <div className="dashboard-panel-body">
              <p className="mb-3 text-sm text-muted-foreground">
                Overhead trend · cumulative OpEx
              </p>
              <MiniSparkline values={overheadSeries} stroke="#3cc295" />
            </div>
          </div>
        ) : null}
      </section>

      <UploadHero
        pendingCount={reviewQueueCount}
        onUploaded={() => setRefreshKey((prev) => prev + 1)}
      />

      <ExecutiveCharts analytics={analytics} isLoading={isLoading} />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="dashboard-panel lg:col-span-2">
          <div className="dashboard-panel-header">
            <h2 className="text-base font-semibold">Active Projects</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select a project to view its ledger
            </p>
          </div>
          <div className="dashboard-panel-body space-y-2">
            {isLoading ? (
              <>
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </>
            ) : activeProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <Briefcase className="size-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">
                  No active projects
                </p>
                <p className="max-w-[200px] text-xs text-muted-foreground">
                  Projects appear here once created in your workspace.
                </p>
              </div>
            ) : (
              activeProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/dashboard/projects/${project.id}`}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3.5 transition-colors hover:bg-secondary/60"
                >
                  <div className="min-w-0 pr-3">
                    <p className="truncate text-sm font-medium text-foreground">
                      {project.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Budget ${project.fixed_budget.toLocaleString()}
                    </p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="dashboard-panel lg:col-span-3">
          <div className="dashboard-panel-header flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">Recent Expenses</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                All processed invoices and receipts
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <FilterPills
                value={expenseFilter}
                onChange={setExpenseFilter}
                options={[
                  { label: "All", value: "all" },
                  { label: "Pending", value: "pending_approval" },
                  { label: "Approved", value: "approved" },
                  { label: "Failed", value: "failed" },
                ]}
              />
              <Link href="/dashboard/triage">
                <Button variant="ghost" size="sm" className="rounded-lg">
                  Triage Inbox
                </Button>
              </Link>
            </div>
          </div>
          <div className="px-2 pb-2">
            {isLoading ? (
              <div className="space-y-3 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center gap-2 p-10 text-sm text-destructive">
                <AlertCircle className="size-4" />
                {error}
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
                <Inbox className="size-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">
                  No expenses yet
                </p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Upload a receipt, invoice, or timesheet above to get started.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Vendor</TableHead>
                    <TableHead className="text-muted-foreground">Type</TableHead>
                    <TableHead className="text-muted-foreground">Category</TableHead>
                    <TableHead className="text-muted-foreground">Project</TableHead>
                    <TableHead className="text-muted-foreground">Total</TableHead>
                    <TableHead className="text-right text-muted-foreground">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.slice(0, 8).map((expense) => {
                    const status =
                      statusConfig[expense.status] ??
                      statusConfig.pending_approval;
                    const StatusIcon = status.icon;

                    return (
                      <TableRow key={expense.id} className="dashboard-table-row">
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">
                              {expense.vendor_name ? (
                                <Link
                                  href={`/dashboard/vendors?vendor=${encodeURIComponent(expense.vendor_name)}`}
                                  className="hover:underline"
                                >
                                  {expense.vendor_name}
                                </Link>
                              ) : (
                                expense.file_name || "Unknown"
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(expense.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {typeLabels[expense.expense_type]}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {expense.category}
                        </TableCell>
                        <TableCell className="text-sm">
                          {expense.project ? (
                            <Link
                              href={`/dashboard/projects/${expense.project.id}`}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {expense.project.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {expense.total_amount != null
                            ? `$${formatCurrency(expense.total_amount)}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={`gap-1 rounded-full ${status.className}`}
                          >
                            <StatusIcon className="size-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

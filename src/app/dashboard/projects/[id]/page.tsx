"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Clock3,
  DollarSign,
  Receipt,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/page-header";
import { parseJsonResponse } from "@/lib/api-client";
import {
  formatCurrency,
  marginHealthClass,
} from "@/lib/project-pl";
import type {
  ExpenseRecord,
  ProjectActivityItem,
  ProjectPnLSummary,
  ProjectRecord,
  RevenueEntryRecord,
  TimeEntryRecord,
} from "@/lib/types";

const billingLabels = {
  fixed: "Fixed Fee",
  hourly: "Hourly",
  retainer: "Retainer",
};

const activityIcons = {
  time: Users,
  expense: Receipt,
  revenue: DollarSign,
  timesheet_import: Sparkles,
};

export default function ProjectLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [project, setProject] = useState<
    (ProjectRecord & { client?: { name: string } | null }) | null
  >(null);
  const [pnl, setPnl] = useState<ProjectPnLSummary | null>(null);
  const [activity, setActivity] = useState<ProjectActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProjectDetails() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/projects/${id}`);
        const payload = await parseJsonResponse<{
          project?: ProjectRecord & { client?: { name: string } | null };
          expenses?: ExpenseRecord[];
          time_entries?: TimeEntryRecord[];
          revenue_entries?: RevenueEntryRecord[];
          pnl?: ProjectPnLSummary;
          activity?: ProjectActivityItem[];
          error?: string;
        }>(response);

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load project details");
        }

        if (!cancelled) {
          setProject(payload.project ?? null);
          setPnl(payload.pnl ?? null);
          setActivity(payload.activity ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load project ledger",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadProjectDetails();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-8 py-8">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !project || !pnl) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-16 text-center">
        <AlertCircle className="size-10 text-destructive" />
        <p className="max-w-md text-sm text-muted-foreground">
          {error ?? "The project you are looking for does not exist."}
        </p>
        <Link href="/dashboard/projects">
          <Button variant="outline" className="rounded-xl">
            <ArrowLeft className="mr-2 size-4" />
            Back to Projects
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-8 py-8">
      <PageHeader
        title={project.name}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Projects", href: "/dashboard/projects" },
          { label: project.name },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Client: {project.client?.name ?? "Internal"}</span>
        <Badge variant="outline" className="rounded-full capitalize">
          {project.status}
        </Badge>
        <Badge variant="outline" className="rounded-full">
          {billingLabels[project.billing_type ?? "fixed"]}
        </Badge>
        <Badge variant="outline" className="rounded-full">
          Target {Number(project.target_margin_percent ?? 40).toFixed(0)}% margin
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PnLCard
          label="Gross Revenue"
          value={`$${formatCurrency(pnl.grossRevenue)}`}
          hint="Collected payments only"
          valueClassName="text-foreground"
        />
        <PnLCard
          label="Total Expenses (COGS)"
          value={`-$${formatCurrency(pnl.totalExpenses)}`}
          hint="Approved project-direct receipts"
          valueClassName="text-destructive"
        />
        <PnLCard
          label="Labor Cost"
          value={`-$${formatCurrency(pnl.laborCost)}`}
          hint="Hours × internal hourly cost"
          valueClassName="text-destructive"
        />
        <PnLCard
          label="Net Profit Margin"
          value={`${pnl.netProfitMarginPercent.toFixed(1)}%`}
          hint={`Net profit $${formatCurrency(pnl.netProfit)}`}
          valueClassName={marginHealthClass(pnl.marginHealth)}
        />
      </div>

      <div className="dashboard-panel">
        <div className="dashboard-panel-header">
          <h2 className="text-base font-semibold">Profit & Loss Breakdown</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            True margin = Revenue − (COGS + Internal Labor)
          </p>
        </div>
        <div className="dashboard-panel-body space-y-3 text-sm">
          <PnLRow label="Gross Revenue" value={pnl.grossRevenue} positive />
          <PnLRow label="Minus COGS (Expenses)" value={-pnl.totalExpenses} />
          <PnLRow label="Minus Labor (Team Time)" value={-pnl.laborCost} />
          <div className="border-t border-border pt-3">
            <PnLRow
              label="Net Profit"
              value={pnl.netProfit}
              positive={pnl.netProfit >= 0}
              bold
            />
          </div>
        </div>
      </div>

      <div className="dashboard-panel">
        <div className="dashboard-panel-header">
          <h2 className="text-base font-semibold">Recent Activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Time logged, receipts scanned, and payments received for this project.
          </p>
        </div>
        <div className="dashboard-panel-body">
          {activity.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No activity yet. Log time, upload receipts, or record revenue to
              populate this feed.
            </p>
          ) : (
            <div className="space-y-3">
              {activity.slice(0, 12).map((item) => {
                const Icon = activityIcons[item.type];
                const amountPrefix =
                  item.type === "revenue"
                    ? "+"
                    : item.type === "expense" ||
                        item.type === "time" ||
                        item.type === "timesheet_import"
                      ? "-"
                      : "";

                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-secondary">
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.subtitle} ·{" "}
                          {new Date(item.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-semibold ${
                          item.type === "revenue"
                            ? "text-success"
                            : "text-destructive"
                        }`}
                      >
                        {amountPrefix}${formatCurrency(item.amount)}
                      </p>
                      <p className="text-[11px] capitalize text-muted-foreground">
                        {item.type === "timesheet_import"
                          ? "AI import"
                          : item.type}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard/team">
          <Button variant="outline" className="rounded-xl">
            <Clock3 className="mr-2 size-4" />
            Log Time
          </Button>
        </Link>
        <Link href="/dashboard/revenue">
          <Button variant="outline" className="rounded-xl">
            <DollarSign className="mr-2 size-4" />
            Log Revenue
          </Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="ghost" className="rounded-xl">
            Upload Receipt
          </Button>
        </Link>
      </div>
    </div>
  );
}

function PnLCard({
  label,
  value,
  hint,
  valueClassName,
}: {
  label: string;
  value: string;
  hint: string;
  valueClassName?: string;
}) {
  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel-body space-y-2">
        <p className="dashboard-stat-label">{label}</p>
        <p className={`text-3xl font-semibold tracking-tight ${valueClassName ?? ""}`}>
          {value}
        </p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

function PnLRow({
  label,
  value,
  positive,
  bold,
}: {
  label: string;
  value: number;
  positive?: boolean;
  bold?: boolean;
}) {
  const prefix = value >= 0 ? "" : "-";
  const display = Math.abs(value);

  return (
    <div className={`flex items-center justify-between ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          positive === undefined
            ? "text-foreground"
            : positive
              ? "text-success"
              : "text-destructive"
        }
      >
        {prefix}${formatCurrency(display)}
      </span>
    </div>
  );
}

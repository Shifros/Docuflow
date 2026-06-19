"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { ChartContainer } from "@/components/dashboard/chart-container";
import type { DashboardAnalytics } from "@/lib/types";
import { formatCurrency } from "@/lib/project-pl";

const CATEGORY_COLORS = ["#3cc295", "#03624c", "#00e891", "#7a968d"];

const OPEX_COGS_COLORS = ["#03624c", "#3cc295"];

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "#011514",
    border: "1px solid #0f1f1c",
    borderRadius: "8px",
    color: "#F1F7F6",
  },
  labelStyle: { color: "#7a968d" },
  itemStyle: { color: "#F1F7F6" },
};

function ChartEmptyState({
  icon: Icon,
  message,
}: {
  icon: typeof PieChartIcon;
  message: string;
}) {
  return (
    <div className="dashboard-empty-state">
      <div className="flex size-12 items-center justify-center rounded-lg bg-secondary ring-1 ring-border">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <p className="max-w-[220px] text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

type ExecutiveChartsProps = {
  analytics: DashboardAnalytics | null;
  isLoading: boolean;
};

export function ExecutiveCharts({ analytics, isLoading }: ExecutiveChartsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (isLoading || !mounted) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="dashboard-panel h-80 animate-pulse bg-secondary/20" />
        <div className="dashboard-panel h-80 animate-pulse bg-secondary/20" />
        <div className="dashboard-panel h-80 animate-pulse bg-secondary/20 lg:col-span-2" />
      </div>
    );
  }

  if (!analytics) return null;

  const hasCategoryData = analytics.category_breakdown.length > 0;
  const hasTypeSplitData = analytics.expense_type_split.length > 0;
  const hasCashflowData = analytics.cashflow_months.some(
    (month) => month.revenue > 0 || month.costs > 0,
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="dashboard-panel">
        <div className="dashboard-panel-header">
          <h2 className="text-lg font-semibold">Where is the money going?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Current month spend by category (approved expenses)
          </p>
        </div>
        <div className="dashboard-panel-body h-72 min-w-0">
          {hasCategoryData ? (
            <ChartContainer>
              <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.category_breakdown}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {analytics.category_breakdown.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value) => [`$${formatCurrency(Number(value))}`, "Spend"]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <ChartEmptyState
              icon={PieChartIcon}
              message="No approved expenses this month yet"
            />
          )}
        </div>
      </div>

      <div className="dashboard-panel">
        <div className="dashboard-panel-header">
          <h2 className="text-lg font-semibold">OpEx vs COGS</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Overhead vs project-direct spend this month
          </p>
        </div>
        <div className="dashboard-panel-body h-72 min-w-0">
          {hasTypeSplitData ? (
            <ChartContainer>
              <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.expense_type_split}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                >
                  {analytics.expense_type_split.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={OPEX_COGS_COLORS[index % OPEX_COGS_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value) => [`$${formatCurrency(Number(value))}`, "Spend"]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <ChartEmptyState
              icon={PieChartIcon}
              message="No approved expenses this month yet"
            />
          )}
        </div>
      </div>

      <div className="dashboard-panel lg:col-span-2">
        <div className="dashboard-panel-header">
          <h2 className="text-lg font-semibold">Cashflow (Last 6 Months)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Collected revenue vs total costs (expenses + labor)
          </p>
        </div>
        <div className="dashboard-panel-body h-72 min-w-0">
          {hasCashflowData ? (
            <ChartContainer>
              <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.cashflow_months}>
                <XAxis dataKey="month" stroke="#7a968d" fontSize={13} />
                <YAxis
                  stroke="#7a968d"
                  fontSize={13}
                  tickFormatter={(value) => `$${Number(value) / 1000}k`}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value, name) => [
                    `$${formatCurrency(Number(value))}`,
                    name === "revenue" ? "Revenue" : "Costs",
                  ]}
                />
                <Legend />
                <Bar
                  dataKey="revenue"
                  stackId="cashflow"
                  fill="#3cc295"
                  name="Revenue"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="costs"
                  stackId="cashflow"
                  fill="#f87171"
                  name="Costs"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <ChartEmptyState
              icon={BarChart3}
              message="Log revenue, expenses, or time to see cashflow trends"
            />
          )}
        </div>
      </div>
    </div>
  );
}

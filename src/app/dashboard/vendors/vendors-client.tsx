"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer } from "@/components/dashboard/chart-container";
import { PageHeader } from "@/components/dashboard/page-header";
import { parseJsonResponse } from "@/lib/api-client";
import { formatCurrency } from "@/lib/project-pl";
import { getVendorDetail } from "@/lib/vendors";
import type { VendorSummary } from "@/lib/types";

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "#011514",
    border: "1px solid #0f1f1c",
    borderRadius: "12px",
    color: "#F1F7F6",
  },
  labelStyle: { color: "#7a968d" },
  itemStyle: { color: "#F1F7F6" },
};

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

type VendorsPageClientProps = {
  initialVendor?: string;
};

export function VendorsPageClient({ initialVendor }: VendorsPageClientProps) {
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<VendorSummary | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadVendors() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/vendors");
        const payload = await parseJsonResponse<{
          vendors?: VendorSummary[];
          error?: string;
        }>(response);

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load vendors");
        }

        if (!cancelled) {
          setVendors(payload.vendors ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load vendor data",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadVendors();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initialVendor || vendors.length === 0) return;

    const match = getVendorDetail(vendors, initialVendor);
    if (match) {
      setSelectedVendor(match);
    }
  }, [initialVendor, vendors]);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-8 py-8">
      <PageHeader
        title="Vendor Tracker"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Vendors" },
        ]}
      />

      <div className="dashboard-panel">
        <div className="dashboard-panel-header">
          <h2 className="text-base font-semibold">Historical Vendor Spend</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track recurring vendors and catch price hikes before they compound
          </p>
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
          ) : vendors.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              No approved vendor expenses yet. Upload receipts to start tracking.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Vendor</TableHead>
                  <TableHead className="text-muted-foreground">
                    Total Spend
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Avg / Month
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Last Paid
                  </TableHead>
                  <TableHead className="text-right text-muted-foreground">
                    Trend
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((vendor) => (
                  <TableRow
                    key={vendor.vendor_name}
                    className="dashboard-table-row cursor-pointer"
                    onClick={() => setSelectedVendor(vendor)}
                  >
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">
                          {vendor.vendor_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {vendor.invoice_count}{" "}
                          {vendor.invoice_count === 1 ? "invoice" : "invoices"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      ${formatCurrency(vendor.total_spend)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      ${formatCurrency(vendor.average_monthly_spend)}
                    </TableCell>
                    <TableCell className="text-sm">
                      ${formatCurrency(vendor.last_paid_amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {vendor.price_increased ? (
                        <Badge
                          variant="outline"
                          className="gap-1 rounded-full border-destructive/30 bg-destructive/10 text-destructive"
                        >
                          <ArrowUp className="size-3" />
                          Price Increased
                          {vendor.increase_percent != null
                            ? ` (+${vendor.increase_percent.toFixed(0)}%)`
                            : ""}
                        </Badge>
                      ) : vendor.previous_paid_amount != null &&
                        vendor.last_paid_amount < vendor.previous_paid_amount ? (
                        <Badge
                          variant="outline"
                          className="gap-1 rounded-full border-success/30 bg-success/10 text-success"
                        >
                          <ArrowDown className="size-3" />
                          Decreased
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1 rounded-full border-border text-muted-foreground"
                        >
                          <TrendingUp className="size-3" />
                          Stable
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog
        open={selectedVendor != null}
        onOpenChange={(open) => {
          if (!open) setSelectedVendor(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedVendor?.vendor_name}</DialogTitle>
            <DialogDescription>
              Invoice amounts over the last 12 months
            </DialogDescription>
          </DialogHeader>
          {selectedVendor && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="mt-1 text-sm font-semibold">
                    ${formatCurrency(selectedVendor.total_spend)}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Avg / Month</p>
                  <p className="mt-1 text-sm font-semibold">
                    ${formatCurrency(selectedVendor.average_monthly_spend)}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Last Paid</p>
                  <p className="mt-1 text-sm font-semibold">
                    ${formatCurrency(selectedVendor.last_paid_amount)}
                  </p>
                </div>
              </div>
              <ChartContainer className="h-56">
                {selectedVendor.monthly_amounts.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={selectedVendor.monthly_amounts.map((point) => ({
                        ...point,
                        label: formatMonthLabel(point.month),
                      }))}
                    >
                      <XAxis dataKey="label" stroke="#7ECDB5" fontSize={12} />
                      <YAxis
                        stroke="#7ECDB5"
                        fontSize={12}
                        tickFormatter={(value) => `$${Number(value)}`}
                      />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value) => [
                          `$${formatCurrency(Number(value))}`,
                          "Amount",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="amount"
                        stroke="#00E891"
                        strokeWidth={2}
                        dot={{ fill: "#00E891", r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No monthly data available
                  </p>
                )}
              </ChartContainer>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

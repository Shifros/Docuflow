"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/dashboard/page-header";
import { parseJsonResponse } from "@/lib/api-client";
import {
  formatCurrency,
  sumExpectedRevenue,
  sumPaidRevenue,
} from "@/lib/project-pl";
import type { ProjectRecord, RevenueEntryRecord } from "@/lib/types";

const selectClassName =
  "h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

export default function RevenuePage() {
  const [entries, setEntries] = useState<RevenueEntryRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    project_id: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    status: "expected" as RevenueEntryRecord["status"],
    type: "one_off" as RevenueEntryRecord["type"],
  });

  async function loadData() {
    setIsLoading(true);
    try {
      const [revenueRes, projectsRes] = await Promise.all([
        fetch("/api/revenue"),
        fetch("/api/projects"),
      ]);

      const revenuePayload = await parseJsonResponse<{
        revenue_entries?: RevenueEntryRecord[];
        error?: string;
      }>(revenueRes);
      const projectsPayload = await parseJsonResponse<{
        projects?: ProjectRecord[];
        error?: string;
      }>(projectsRes);

      if (!revenueRes.ok) {
        throw new Error(revenuePayload.error ?? "Failed to load revenue");
      }
      if (!projectsRes.ok) {
        throw new Error(projectsPayload.error ?? "Failed to load projects");
      }

      setEntries(revenuePayload.revenue_entries ?? []);
      setProjects(projectsPayload.projects ?? []);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load revenue data",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const expectedTotal = useMemo(() => sumExpectedRevenue(entries), [entries]);
  const collectedTotal = useMemo(() => sumPaidRevenue(entries), [entries]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!form.project_id || !form.amount || !form.date) {
      toast.error("Project, amount, and date are required");
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedProject = projects.find((p) => p.id === form.project_id);

      const response = await fetch("/api/revenue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: form.project_id,
          client_id: selectedProject?.client_id ?? null,
          amount: parseFloat(form.amount),
          date: form.date,
          status: form.status,
          type: form.type,
        }),
      });

      const payload = await parseJsonResponse<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to log revenue");
      }

      toast.success("Revenue entry logged");
      setForm((current) => ({
        ...current,
        amount: "",
      }));
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log revenue");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMarkPaid(entryId: string) {
    setMarkingId(entryId);
    try {
      const response = await fetch(`/api/revenue/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      });
      const payload = await parseJsonResponse<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to mark as paid");
      }
      toast.success("Payment marked as collected");
      await loadData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to mark as paid",
      );
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-8 py-8">
      <PageHeader
        title="Revenue"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Revenue" },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="dashboard-panel">
          <div className="dashboard-panel-body space-y-2">
            <p className="dashboard-stat-label">Expected Income</p>
            {isLoading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <p className="dashboard-stat-value">
                ${formatCurrency(expectedTotal)}
              </p>
            )}
          </div>
        </div>
        <div className="dashboard-panel">
          <div className="dashboard-panel-body space-y-2">
            <p className="dashboard-stat-label">Collected Income</p>
            {isLoading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <p className="dashboard-stat-value text-success">
                ${formatCurrency(collectedTotal)}
              </p>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="dashboard-panel">
        <div className="dashboard-panel-header">
          <h2 className="text-base font-semibold">Log Revenue</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track one-off project payments and monthly retainers against projects.
          </p>
        </div>
        <div className="dashboard-panel-body grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Project</label>
            <select
              value={form.project_id}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  project_id: e.target.value,
                }))
              }
              className={selectClassName}
            >
              <option value="">Select project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Amount</label>
            <Input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) =>
                setForm((current) => ({ ...current, amount: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Date</label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) =>
                setForm((current) => ({ ...current, date: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Status</label>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  status: e.target.value as RevenueEntryRecord["status"],
                }))
              }
              className={selectClassName}
            >
              <option value="expected">Expected</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Type</label>
            <select
              value={form.type}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  type: e.target.value as RevenueEntryRecord["type"],
                }))
              }
              className={selectClassName}
            >
              <option value="one_off">One-off</option>
              <option value="retainer_monthly">Retainer (Monthly)</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full rounded-xl" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Plus className="mr-2 size-4" />
              )}
              Log Revenue
            </Button>
          </div>
        </div>
      </form>

      <div className="dashboard-panel">
        <div className="dashboard-panel-header">
          <h2 className="text-base font-semibold">Revenue Entries</h2>
        </div>
        <div className="px-2 pb-2">
          {isLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : entries.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No revenue entries yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Project</TableHead>
                  <TableHead className="text-muted-foreground">Amount</TableHead>
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground">Type</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-right text-muted-foreground">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id} className="dashboard-table-row">
                    <TableCell className="font-medium">
                      {entry.project?.name ?? "—"}
                    </TableCell>
                    <TableCell>${formatCurrency(entry.amount)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(entry.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {entry.type === "retainer_monthly" ? "Retainer" : "One-off"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          entry.status === "paid"
                            ? "border-success/20 bg-success/10 text-success"
                            : "border-amber-500/20 bg-amber-500/10 text-amber-400"
                        }
                      >
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.status === "expected" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg"
                          disabled={markingId === entry.id}
                          onClick={() => handleMarkPaid(entry.id)}
                        >
                          {markingId === entry.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            "Mark Paid"
                          )}
                        </Button>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}

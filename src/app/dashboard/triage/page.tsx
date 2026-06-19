"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
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
import { PageHeader } from "@/components/dashboard/page-header";
import { TimesheetTriagePanel } from "@/components/dashboard/timesheet-triage-panel";
import { parseJsonResponse } from "@/lib/api-client";
import type { ExpenseRecord, ProjectRecord } from "@/lib/types";

type EditedFields = {
  expense_type: "overhead" | "project_direct" | "unknown";
  category: string;
  project_id: string | null;
  vendor_name: string;
  total_amount: number;
};

const selectClassName =
  "h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50";

const inputClassName =
  "h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

type TriageTab = "expenses" | "timesheets";

export default function TriageInboxPage() {
  const [activeTab, setActiveTab] = useState<TriageTab>("expenses");
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [isApprovingAll, setIsApprovingAll] = useState(false);
  const [editedFields, setEditedFields] = useState<Record<string, EditedFields>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        const [expensesRes, projectsRes] = await Promise.all([
          fetch("/api/expenses"),
          fetch("/api/projects"),
        ]);

        const expensesPayload = await parseJsonResponse<{
          expenses?: ExpenseRecord[];
          error?: string;
        }>(expensesRes);
        const projectsPayload = await parseJsonResponse<{
          projects?: ProjectRecord[];
          error?: string;
        }>(projectsRes);

        if (!expensesRes.ok) {
          throw new Error(expensesPayload.error ?? "Failed to load expenses");
        }
        if (!projectsRes.ok) {
          throw new Error(projectsPayload.error ?? "Failed to load projects");
        }

        if (!cancelled) {
          const pendingExpenses = (expensesPayload.expenses ?? []).filter(
            (e) => e.status === "pending_approval",
          );
          setExpenses(pendingExpenses);
          setProjects(projectsPayload.projects ?? []);

          const initialEdits: Record<string, EditedFields> = {};
          pendingExpenses.forEach((e) => {
            initialEdits[e.id] = {
              expense_type: e.expense_type,
              category: e.category,
              project_id: e.project_id,
              vendor_name: e.vendor_name ?? "",
              total_amount: e.total_amount ?? 0,
            };
          });
          setEditedFields(initialEdits);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load triage data",
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

  function handleFieldChange(
    expenseId: string,
    field: keyof EditedFields,
    value: string | number | null,
  ) {
    setEditedFields((prev) => {
      const current = prev[expenseId];
      if (!current) return prev;

      const updated = { ...current, [field]: value };
      if (field === "expense_type" && value !== "project_direct") {
        updated.project_id = null;
      }

      return { ...prev, [expenseId]: updated };
    });
  }

  async function approveExpense(expenseId: string, edits: EditedFields) {
    const response = await fetch(`/api/expenses/${expenseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "approved",
        expense_type: edits.expense_type,
        category: edits.category,
        project_id: edits.project_id,
        vendor_name: edits.vendor_name || null,
        total_amount: edits.total_amount || null,
      }),
    });

    const payload = await parseJsonResponse<{ error?: string }>(response);
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to approve expense");
    }
  }

  async function handleApprove(expenseId: string) {
    const edits = editedFields[expenseId];
    if (!edits) return;

    if (edits.expense_type === "project_direct" && !edits.project_id) {
      toast.error("Please select a project for project-direct expenses");
      return;
    }

    setActioningId(expenseId);

    try {
      await approveExpense(expenseId, edits);
      toast.success("Expense approved and routed successfully");
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to approve expense",
      );
    } finally {
      setActioningId(null);
    }
  }

  async function handleApproveAll() {
    if (expenses.length === 0 || isApprovingAll) return;

    const approvable = expenses.filter((expense) => editedFields[expense.id]);

    const needsProject = approvable.filter((expense) => {
      const edits = editedFields[expense.id];
      return edits.expense_type === "project_direct" && !edits.project_id;
    });

    if (needsProject.length > 0) {
      toast.error(
        `${needsProject.length} expense${needsProject.length === 1 ? "" : "s"} need a project assigned before bulk approve`,
      );
      return;
    }

    if (
      !confirm(
        `Approve all ${approvable.length} pending expense${approvable.length === 1 ? "" : "s"}?`,
      )
    ) {
      return;
    }

    setIsApprovingAll(true);

    const results = await Promise.allSettled(
      approvable.map((expense) =>
        approveExpense(expense.id, editedFields[expense.id]),
      ),
    );

    const approved = results.filter((result) => result.status === "fulfilled").length;
    const failed = results.length - approved;

    setIsApprovingAll(false);

    if (failed === 0) {
      toast.success(
        `Approved ${approved} expense${approved === 1 ? "" : "s"} successfully`,
      );
    } else {
      toast.warning(
        `Approved ${approved}, ${failed} failed — review remaining items`,
      );
    }

    setRefreshKey((prev) => prev + 1);
  }

  async function handleDelete(expenseId: string) {
    if (!confirm("Are you sure you want to delete this pending expense?")) {
      return;
    }

    setActioningId(expenseId);

    try {
      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: "DELETE",
      });

      const payload = await parseJsonResponse<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to delete expense");
      }

      toast.success("Expense deleted successfully");
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete expense",
      );
    } finally {
      setActioningId(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-8 py-8">
      <PageHeader
        title="Triage Inbox"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Triage Inbox" },
        ]}
        action={
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl"
            onClick={() => setRefreshKey((prev) => prev + 1)}
            disabled={isLoading}
          >
            <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        }
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("expenses")}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "expenses"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          Expenses
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("timesheets")}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "timesheets"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          Timesheets
        </button>
      </div>

      {activeTab === "timesheets" ? (
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h2 className="text-base font-semibold">Timesheet Review</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review AI-parsed rows, map unmatched entries, then import hours.
            </p>
          </div>
          <TimesheetTriagePanel
            refreshKey={refreshKey}
            onUpdated={() => setRefreshKey((prev) => prev + 1)}
          />
        </div>
      ) : (
      <div className="dashboard-panel">
        <div className="dashboard-panel-header flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Pending Approvals</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review AI classifications, adjust routing, and approve expenses.
            </p>
          </div>
          {!isLoading && !error && expenses.length > 0 ? (
            <Button
              className="shrink-0 rounded-xl"
              disabled={isApprovingAll || actioningId != null}
              onClick={() => void handleApproveAll()}
            >
              {isApprovingAll ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Approving…
                </>
              ) : (
                <>
                  <Check className="mr-2 size-4" />
                  Approve All ({expenses.length})
                </>
              )}
            </Button>
          ) : null}
        </div>
        <div className="px-2 pb-2">
          {isLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-destructive">
              <AlertCircle className="size-4" />
              {error}
            </div>
          ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <p className="text-sm font-medium">Inbox cleared</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                There are no pending expenses to triage. Upload receipts from the
                dashboard to route them here.
              </p>
              <Link href="/dashboard">
                <Button variant="outline" className="rounded-xl">
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Vendor</TableHead>
                    <TableHead className="text-muted-foreground">Amount</TableHead>
                    <TableHead className="text-muted-foreground">Type</TableHead>
                    <TableHead className="text-muted-foreground">Category</TableHead>
                    <TableHead className="text-muted-foreground">Project</TableHead>
                    <TableHead className="text-right text-muted-foreground">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => {
                    const edits = editedFields[expense.id];
                    if (!edits) return null;

                    const isActioning =
                      isApprovingAll || actioningId === expense.id;

                    return (
                      <TableRow key={expense.id} className="dashboard-table-row">
                        <TableCell className="min-w-[180px]">
                          <input
                            type="text"
                            value={edits.vendor_name}
                            onChange={(e) =>
                              handleFieldChange(
                                expense.id,
                                "vendor_name",
                                e.target.value,
                              )
                            }
                            className={inputClassName}
                            placeholder="Vendor name"
                          />
                          <p className="mt-1 text-xs text-muted-foreground">
                            {expense.file_name} ·{" "}
                            {new Date(expense.created_at).toLocaleDateString()}
                          </p>
                        </TableCell>
                        <TableCell className="min-w-[120px]">
                          <input
                            type="number"
                            step="0.01"
                            value={edits.total_amount || ""}
                            onChange={(e) =>
                              handleFieldChange(
                                expense.id,
                                "total_amount",
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className={inputClassName}
                            placeholder="0.00"
                          />
                        </TableCell>
                        <TableCell className="min-w-[150px]">
                          <select
                            value={edits.expense_type}
                            onChange={(e) =>
                              handleFieldChange(
                                expense.id,
                                "expense_type",
                                e.target.value,
                              )
                            }
                            className={selectClassName}
                          >
                            <option value="overhead">Overhead (OpEx)</option>
                            <option value="project_direct">
                              Project Direct (COGS)
                            </option>
                            <option value="unknown">Unknown</option>
                          </select>
                        </TableCell>
                        <TableCell className="min-w-[130px]">
                          <select
                            value={edits.category}
                            onChange={(e) =>
                              handleFieldChange(
                                expense.id,
                                "category",
                                e.target.value,
                              )
                            }
                            className={selectClassName}
                          >
                            <option value="Software">Software</option>
                            <option value="Contractor">Contractor</option>
                            <option value="Payroll">Payroll</option>
                            <option value="Hosting">Hosting</option>
                            <option value="Misc">Misc</option>
                          </select>
                        </TableCell>
                        <TableCell className="min-w-[200px]">
                          <select
                            value={edits.project_id || ""}
                            disabled={edits.expense_type !== "project_direct"}
                            onChange={(e) =>
                              handleFieldChange(
                                expense.id,
                                "project_id",
                                e.target.value || null,
                              )
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
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              className="rounded-lg"
                              disabled={isActioning}
                              onClick={() => handleApprove(expense.id)}
                            >
                              {isActioning ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="mr-1 size-4" />
                                  Approve
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isActioning}
                              onClick={() => handleDelete(expense.id)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

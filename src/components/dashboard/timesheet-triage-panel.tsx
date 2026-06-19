"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
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
import { parseJsonResponse } from "@/lib/api-client";
import { countMatchedRows, countTotalHours } from "@/lib/timesheet-imports";
import type {
  ProjectRecord,
  TeamMemberRecord,
  TimesheetImportData,
  TimesheetImportRecord,
} from "@/lib/types";

const selectClassName =
  "h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

type TimesheetTriagePanelProps = {
  refreshKey: number;
  onUpdated?: () => void;
};

export function TimesheetTriagePanel({
  refreshKey,
  onUpdated,
}: TimesheetTriagePanelProps) {
  const [imports, setImports] = useState<TimesheetImportRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [editedRows, setEditedRows] = useState<
    Record<string, TimesheetImportData>
  >({});

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        const [importsRes, projectsRes, teamRes] = await Promise.all([
          fetch("/api/timesheet-imports"),
          fetch("/api/projects"),
          fetch("/api/team-members"),
        ]);

        const importsPayload = await parseJsonResponse<{
          imports?: TimesheetImportRecord[];
          error?: string;
        }>(importsRes);
        const projectsPayload = await parseJsonResponse<{
          projects?: ProjectRecord[];
          error?: string;
        }>(projectsRes);
        const teamPayload = await parseJsonResponse<{
          team_members?: TeamMemberRecord[];
          error?: string;
        }>(teamRes);

        if (!importsRes.ok) {
          throw new Error(importsPayload.error ?? "Failed to load timesheets");
        }
        if (!projectsRes.ok) {
          throw new Error(projectsPayload.error ?? "Failed to load projects");
        }
        if (!teamRes.ok) {
          throw new Error(teamPayload.error ?? "Failed to load team");
        }

        if (!cancelled) {
          const pending = (importsPayload.imports ?? []).filter(
            (item) => item.status === "pending_approval",
          );
          setImports(pending);
          setProjects(projectsPayload.projects ?? []);
          setTeamMembers(teamPayload.team_members ?? []);

          const initialEdits: Record<string, TimesheetImportData> = {};
          pending.forEach((item) => {
            initialEdits[item.id] = item.extracted_data;
          });
          setEditedRows(initialEdits);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load timesheet triage",
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

  function updateRow(
    importId: string,
    rowIndex: number,
    field: "team_member_id" | "project_id",
    value: string,
  ) {
    setEditedRows((prev) => {
      const current = prev[importId];
      if (!current) return prev;

      const rows = [...current.rows];
      rows[rowIndex] = {
        ...rows[rowIndex],
        [field]: value || null,
      };

      return {
        ...prev,
        [importId]: { ...current, rows },
      };
    });
  }

  async function approveImport(importId: string) {
    const extractedData = editedRows[importId];
    if (!extractedData) return;

    const counts = countMatchedRows(extractedData);
    if (counts.matched === 0) {
      toast.error("Map at least one row to a team member and project");
      return;
    }

    setActioningId(importId);

    try {
      const response = await fetch(`/api/timesheet-imports/${importId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extracted_data: extractedData }),
      });

      const payload = await parseJsonResponse<{
        message?: string;
        error?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to approve timesheet");
      }

      toast.success(payload.message ?? "Timesheet imported");
      onUpdated?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to approve timesheet",
      );
    } finally {
      setActioningId(null);
    }
  }

  async function rejectImport(importId: string) {
    setActioningId(importId);

    try {
      const response = await fetch(`/api/timesheet-imports/${importId}`, {
        method: "DELETE",
      });

      const payload = await parseJsonResponse<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to reject timesheet");
      }

      toast.success("Timesheet import discarded");
      onUpdated?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to reject timesheet",
      );
    } finally {
      setActioningId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 p-10 text-sm text-destructive">
        <AlertCircle className="size-4" />
        {error}
      </div>
    );
  }

  if (imports.length === 0) {
    return (
      <p className="p-10 text-center text-sm text-muted-foreground">
        No timesheets awaiting review. Upload or paste a timesheet from the
        dashboard to queue it here.
      </p>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {imports.map((item) => {
        const data = editedRows[item.id] ?? item.extracted_data;
        const counts = countMatchedRows(data);
        const totalHours = countTotalHours(data);
        const isActioning = actioningId === item.id;

        return (
          <div
            key={item.id}
            className="overflow-hidden rounded-2xl border border-border bg-background/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-4 py-4">
              <div>
                <p className="text-sm font-medium">
                  {item.file_name ?? "Timesheet import"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.rows.length} rows · {totalHours}h total ·{" "}
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {counts.unmatched > 0 ? (
                  <Badge
                    variant="outline"
                    className="rounded-full border-amber-500/30 bg-amber-500/10 text-amber-400"
                  >
                    {counts.unmatched} unmatched
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="rounded-full border-success/30 bg-success/10 text-success"
                  >
                    All rows matched
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg"
                  disabled={isActioning}
                  onClick={() => void rejectImport(item.id)}
                >
                  {isActioning ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  className="rounded-lg"
                  disabled={isActioning || counts.matched === 0}
                  onClick={() => void approveImport(item.id)}
                >
                  {isActioning ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 size-4" />
                  )}
                  Import {counts.matched} row{counts.matched === 1 ? "" : "s"}
                </Button>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Name</TableHead>
                  <TableHead className="text-muted-foreground">Hours</TableHead>
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground">
                    Team Member
                  </TableHead>
                  <TableHead className="text-muted-foreground">Project</TableHead>
                  <TableHead className="text-right text-muted-foreground">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row, rowIndex) => {
                  const isMatched = Boolean(
                    row.team_member_id && row.project_id,
                  );

                  return (
                    <TableRow key={`${item.id}-${rowIndex}`} className="dashboard-table-row">
                      <TableCell className="text-sm font-medium">
                        {row.team_member_name}
                      </TableCell>
                      <TableCell className="text-sm">{row.hours}h</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.date ?? data.default_date ?? "—"}
                      </TableCell>
                      <TableCell>
                        <select
                          className={selectClassName}
                          value={row.team_member_id ?? ""}
                          onChange={(event) =>
                            updateRow(
                              item.id,
                              rowIndex,
                              "team_member_id",
                              event.target.value,
                            )
                          }
                        >
                          <option value="">Select member…</option>
                          {teamMembers.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.name}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <select
                          className={selectClassName}
                          value={row.project_id ?? ""}
                          onChange={(event) =>
                            updateRow(
                              item.id,
                              rowIndex,
                              "project_id",
                              event.target.value,
                            )
                          }
                        >
                          <option value="">Select project…</option>
                          {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={`rounded-full ${
                            isMatched
                              ? "border-success/30 bg-success/10 text-success"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {isMatched ? "Ready" : "Needs mapping"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        );
      })}
    </div>
  );
}

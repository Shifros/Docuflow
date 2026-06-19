"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
import { PageHeader } from "@/components/dashboard/page-header";
import { parseJsonResponse } from "@/lib/api-client";
import { formatCurrency } from "@/lib/project-pl";
import type { ProjectRecord } from "@/lib/types";

const billingLabels = {
  fixed: "Fixed Fee",
  hourly: "Hourly",
  retainer: "Retainer",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProjects() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/projects");
        const payload = await parseJsonResponse<{
          projects?: ProjectRecord[];
          error?: string;
        }>(response);

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load projects");
        }

        setProjects(payload.projects ?? []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load projects",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadProjects();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-8 py-8">
      <PageHeader
        title="Projects & Retainers"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Projects & Retainers" },
        ]}
      />

      <div className="dashboard-panel">
        <div className="dashboard-panel-header">
          <h2 className="text-base font-semibold">All Projects</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Open a project ledger to view true margin, labor burn, and revenue.
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
            <p className="p-8 text-center text-sm text-destructive">{error}</p>
          ) : projects.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No projects found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Project</TableHead>
                  <TableHead className="text-muted-foreground">Client</TableHead>
                  <TableHead className="text-muted-foreground">Billing</TableHead>
                  <TableHead className="text-muted-foreground">Budget</TableHead>
                  <TableHead className="text-muted-foreground">Target Margin</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-right text-muted-foreground">
                    Ledger
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id} className="dashboard-table-row">
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {(project as ProjectRecord & { client?: { name: string } })
                        .client?.name ?? "Internal"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-full capitalize">
                        {billingLabels[project.billing_type ?? "fixed"]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      ${formatCurrency(Number(project.fixed_budget))}
                    </TableCell>
                    <TableCell>
                      {Number(project.target_margin_percent ?? 40).toFixed(0)}%
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-full capitalize">
                        {project.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/dashboard/projects/${project.id}`}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        Open
                        <ArrowRight className="size-3.5" />
                      </Link>
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

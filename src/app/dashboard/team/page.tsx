"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
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
import { FilterPills, PageHeader } from "@/components/dashboard/page-header";
import { parseJsonResponse } from "@/lib/api-client";
import { formatCurrency } from "@/lib/project-pl";
import type { ProjectRecord, TeamMemberRecord } from "@/lib/types";

type TeamTab = "directory" | "logger";

const selectClassName =
  "h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

export default function TeamPage() {
  const [tab, setTab] = useState<TeamTab>("directory");
  const [teamMembers, setTeamMembers] = useState<TeamMemberRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isSubmittingTime, setIsSubmittingTime] = useState(false);

  const [newMember, setNewMember] = useState({
    name: "",
    role: "employee" as TeamMemberRecord["role"],
    hourly_cost: "",
  });

  const [timeForm, setTimeForm] = useState({
    project_id: "",
    team_member_id: "",
    hours: "",
    date: new Date().toISOString().slice(0, 10),
    description: "",
  });

  async function loadData() {
    setIsLoading(true);
    try {
      const [teamRes, projectsRes] = await Promise.all([
        fetch("/api/team-members"),
        fetch("/api/projects"),
      ]);

      const teamPayload = await parseJsonResponse<{
        team_members?: TeamMemberRecord[];
        error?: string;
      }>(teamRes);
      const projectsPayload = await parseJsonResponse<{
        projects?: ProjectRecord[];
        error?: string;
      }>(projectsRes);

      if (!teamRes.ok) {
        throw new Error(teamPayload.error ?? "Failed to load team members");
      }
      if (!projectsRes.ok) {
        throw new Error(projectsPayload.error ?? "Failed to load projects");
      }

      setTeamMembers(teamPayload.team_members ?? []);
      setProjects(
        (projectsPayload.projects ?? []).filter((p) => p.status === "active"),
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load team data",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleSaveHourlyCost(member: TeamMemberRecord, value: string) {
    const hourlyCost = parseFloat(value);
    if (Number.isNaN(hourlyCost) || hourlyCost < 0) {
      toast.error("Enter a valid hourly cost");
      return;
    }

    setSavingId(member.id);
    try {
      const response = await fetch(`/api/team-members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hourly_cost: hourlyCost }),
      });
      const payload = await parseJsonResponse<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update hourly cost");
      }
      toast.success("Hourly cost updated");
      await loadData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update hourly cost",
      );
    } finally {
      setSavingId(null);
    }
  }

  async function handleAddMember(event: React.FormEvent) {
    event.preventDefault();
    if (!newMember.name.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      const response = await fetch("/api/team-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMember.name.trim(),
          role: newMember.role,
          hourly_cost: parseFloat(newMember.hourly_cost) || 0,
        }),
      });
      const payload = await parseJsonResponse<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to add team member");
      }

      toast.success("Team member added");
      setNewMember({ name: "", role: "employee", hourly_cost: "" });
      await loadData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add team member",
      );
    }
  }

  async function handleLogTime(event: React.FormEvent) {
    event.preventDefault();

    if (!timeForm.project_id || !timeForm.team_member_id || !timeForm.hours) {
      toast.error("Project, team member, and hours are required");
      return;
    }

    setIsSubmittingTime(true);
    try {
      const response = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: timeForm.project_id,
          team_member_id: timeForm.team_member_id,
          hours: parseFloat(timeForm.hours),
          date: timeForm.date,
          description: timeForm.description || null,
        }),
      });
      const payload = await parseJsonResponse<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to log time");
      }

      toast.success("Time logged successfully");
      setTimeForm((current) => ({
        ...current,
        hours: "",
        description: "",
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log time");
    } finally {
      setIsSubmittingTime(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-8 py-8">
      <PageHeader
        title="Team & Time"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Team & Time" },
        ]}
        filters={
          <FilterPills
            value={tab}
            onChange={setTab}
            options={[
              { label: "Team Directory", value: "directory" },
              { label: "Time Logger", value: "logger" },
            ]}
          />
        }
      />

      {tab === "directory" ? (
        <div className="space-y-6">
          <div className="dashboard-panel">
            <div className="dashboard-panel-header">
              <h2 className="text-base font-semibold">Team Directory</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Set internal hourly costs used to calculate labor burn on projects.
              </p>
            </div>
            <div className="px-2 pb-2">
              {isLoading ? (
                <div className="space-y-3 p-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60 hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Name</TableHead>
                      <TableHead className="text-muted-foreground">Role</TableHead>
                      <TableHead className="text-muted-foreground">
                        Hourly Cost
                      </TableHead>
                      <TableHead className="text-right text-muted-foreground">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map((member) => (
                      <TeamMemberRow
                        key={member.id}
                        member={member}
                        isSaving={savingId === member.id}
                        onSave={handleSaveHourlyCost}
                      />
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          <form onSubmit={handleAddMember} className="dashboard-panel">
            <div className="dashboard-panel-header">
              <h2 className="text-base font-semibold">Add Team Member</h2>
            </div>
            <div className="dashboard-panel-body grid gap-4 md:grid-cols-4">
              <Input
                placeholder="Name"
                value={newMember.name}
                onChange={(e) =>
                  setNewMember((current) => ({
                    ...current,
                    name: e.target.value,
                  }))
                }
              />
              <select
                value={newMember.role}
                onChange={(e) =>
                  setNewMember((current) => ({
                    ...current,
                    role: e.target.value as TeamMemberRecord["role"],
                  }))
                }
                className={selectClassName}
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="employee">Employee</option>
              </select>
              <Input
                type="number"
                step="0.01"
                placeholder="Hourly cost"
                value={newMember.hourly_cost}
                onChange={(e) =>
                  setNewMember((current) => ({
                    ...current,
                    hourly_cost: e.target.value,
                  }))
                }
              />
              <Button type="submit" className="rounded-xl">
                <Plus className="mr-2 size-4" />
                Add Member
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <form onSubmit={handleLogTime} className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h2 className="text-base font-semibold">Time Logger</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Log hours against an active project to track the silent labor bleed.
            </p>
          </div>
          <div className="dashboard-panel-body grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Project</label>
              <select
                value={timeForm.project_id}
                onChange={(e) =>
                  setTimeForm((current) => ({
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
              <label className="text-sm text-muted-foreground">Team Member</label>
              <select
                value={timeForm.team_member_id}
                onChange={(e) =>
                  setTimeForm((current) => ({
                    ...current,
                    team_member_id: e.target.value,
                  }))
                }
                className={selectClassName}
              >
                <option value="">Select team member</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Hours</label>
              <Input
                type="number"
                step="0.25"
                min="0.25"
                value={timeForm.hours}
                onChange={(e) =>
                  setTimeForm((current) => ({
                    ...current,
                    hours: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Date</label>
              <Input
                type="date"
                value={timeForm.date}
                onChange={(e) =>
                  setTimeForm((current) => ({
                    ...current,
                    date: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-muted-foreground">Description</label>
              <Input
                placeholder="What did you work on?"
                value={timeForm.description}
                onChange={(e) =>
                  setTimeForm((current) => ({
                    ...current,
                    description: e.target.value,
                  }))
                }
              />
            </div>
            <div className="md:col-span-2">
              <Button
                type="submit"
                className="rounded-xl"
                disabled={isSubmittingTime}
              >
                {isSubmittingTime ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Log Time
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

function TeamMemberRow({
  member,
  isSaving,
  onSave,
}: {
  member: TeamMemberRecord;
  isSaving: boolean;
  onSave: (member: TeamMemberRecord, value: string) => void;
}) {
  const [hourlyCost, setHourlyCost] = useState(String(member.hourly_cost));

  useEffect(() => {
    setHourlyCost(String(member.hourly_cost));
  }, [member.hourly_cost]);

  return (
    <TableRow className="dashboard-table-row">
      <TableCell className="font-medium">{member.name}</TableCell>
      <TableCell className="capitalize text-muted-foreground">
        {member.role}
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          value={hourlyCost}
          onChange={(e) => setHourlyCost(e.target.value)}
          className="max-w-[140px]"
        />
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="sm"
          variant="outline"
          className="rounded-lg"
          disabled={isSaving}
          onClick={() => onSave(member, hourlyCost)}
        >
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

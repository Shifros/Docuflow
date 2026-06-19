import type {
  TimesheetImportData,
  TimesheetImportRow,
  TimesheetLine,
} from "@/lib/types";

export function buildTimesheetImportData({
  entries,
  defaultDate,
  projects,
  teamMembers,
  matchByName,
}: {
  entries: TimesheetLine[];
  defaultDate: string | null;
  projects: { id: string; name: string }[];
  teamMembers: { id: string; name: string }[];
  matchByName: (
    name: string,
    items: { id: string; name: string }[],
  ) => { id: string; name: string } | null;
}): TimesheetImportData {
  const rows: TimesheetImportRow[] = entries.map((entry) => {
    const member = matchByName(entry.team_member_name, teamMembers);
    const project = entry.suggested_project_name
      ? matchByName(entry.suggested_project_name, projects)
      : null;

    return {
      team_member_name: entry.team_member_name,
      hours: entry.hours,
      date: entry.date,
      description: entry.description,
      suggested_project_name: entry.suggested_project_name,
      team_member_id: member?.id ?? null,
      project_id: project?.id ?? null,
    };
  });

  return {
    default_date: defaultDate,
    rows,
  };
}

export function countMatchedRows(data: TimesheetImportData) {
  const matched = data.rows.filter(
    (row) => row.team_member_id && row.project_id,
  ).length;
  return {
    matched,
    unmatched: data.rows.length - matched,
    total: data.rows.length,
  };
}

export function countTotalHours(data: TimesheetImportData) {
  return data.rows.reduce((sum, row) => sum + row.hours, 0);
}

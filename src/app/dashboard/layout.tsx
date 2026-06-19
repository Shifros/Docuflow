"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { parseJsonResponse } from "@/lib/api-client";
import type { ExpenseRecord, TimesheetImportRecord } from "@/lib/types";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    async function fetchPendingCount() {
      try {
        const [expensesRes, importsRes] = await Promise.all([
          fetch("/api/expenses"),
          fetch("/api/timesheet-imports"),
        ]);
        const expensesPayload = await parseJsonResponse<{
          expenses?: ExpenseRecord[];
        }>(expensesRes);
        const importsPayload = await parseJsonResponse<{
          imports?: TimesheetImportRecord[];
        }>(importsRes);

        let total = 0;

        if (expensesRes.ok && expensesPayload.expenses) {
          total += expensesPayload.expenses.filter(
            (expense) => expense.status === "pending_approval",
          ).length;
        }

        if (importsRes.ok && importsPayload.imports) {
          total += importsPayload.imports.filter(
            (item) => item.status === "pending_approval",
          ).length;
        }

        setPendingCount(total);
      } catch {
        // ignore polling errors
      }
    }

    void fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 10000);
    return () => clearInterval(interval);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar pendingCount={pendingCount} />
      <main className="min-h-screen flex-1 overflow-auto bg-background">
        {children}
      </main>
    </div>
  );
}

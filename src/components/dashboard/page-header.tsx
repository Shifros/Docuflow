"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type PageHeaderProps = {
  title: string;
  breadcrumbs: BreadcrumbItem[];
  action?: React.ReactNode;
  filters?: React.ReactNode;
};

export function PageHeader({
  title,
  breadcrumbs,
  action,
  filters,
}: PageHeaderProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <Home className="size-3.5" />
            {breadcrumbs.map((item, index) => (
              <span
                key={`${item.label}-${index}`}
                className="flex items-center gap-1.5"
              >
                <ChevronRight className="size-3.5 opacity-40" />
                {item.href ? (
                  <Link
                    href={item.href}
                    className="transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{item.label}</span>
                )}
              </span>
            ))}
          </nav>
          <h1 className="text-[1.875rem] font-semibold tracking-tight text-foreground sm:text-[2.125rem]">
            {title}
          </h1>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {filters ? <div>{filters}</div> : null}
    </div>
  );
}

export function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`dashboard-filter-pill ${
              isActive
                ? "dashboard-filter-pill-active"
                : "dashboard-filter-pill-inactive"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

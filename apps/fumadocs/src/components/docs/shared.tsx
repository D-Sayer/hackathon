import { cn } from "@hackathon/ui/lib/utils";
import { ExternalLink, Info } from "lucide-react";
import type { ReactNode } from "react";

type PropRow = {
  prop: string;
  type: string;
  defaultValue?: string;
  description: string;
};

function DemoFrame({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="my-6 overflow-hidden border border-border text-card-foreground rounded-md">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div
        className={cn("flex flex-wrap items-center gap-3 px-4 py-5", className)}
      >
        {children}
      </div>
    </div>
  );
}

function PropsTable({ rows }: { rows: PropRow[] }) {
  return (
    <div className="my-6 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="border-b border-border px-4 py-3 font-medium">
              Prop
            </th>
            <th className="border-b border-border px-4 py-3 font-medium">
              Type
            </th>
            <th className="border-b border-border px-4 py-3 font-medium">
              Default
            </th>
            <th className="border-b border-border px-4 py-3 font-medium">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.prop} className="align-top">
              <td className="border-b border-border px-4 py-3 font-mono text-xs">
                {row.prop}
              </td>
              <td className="border-b border-border px-4 py-3 font-mono text-xs">
                {row.type}
              </td>
              <td className="border-b border-border px-4 py-3 font-mono text-xs">
                {row.defaultValue ?? "-"}
              </td>
              <td className="border-b border-border px-4 py-3 text-muted-foreground">
                {row.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TwoColumnTable({
  leftLabel,
  rightLabel,
  rows,
}: {
  leftLabel: string;
  rightLabel: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="border-b border-border px-4 py-3 font-medium">
              {leftLabel}
            </th>
            <th className="border-b border-border px-4 py-3 font-medium">
              {rightLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([left, right]) => (
            <tr key={left}>
              <td className="border-b border-border px-4 py-3 font-mono text-xs">
                {left}
              </td>
              <td className="border-b border-border px-4 py-3 text-muted-foreground">
                {right}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Guidance({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="my-6 border border-border bg-muted/30 px-4 py-4">
      <div className="flex items-center gap-2">
        <Info className="size-4 text-muted-foreground" />
        <p className="text-sm font-medium">{title}</p>
      </div>
      <div className="mt-2 text-sm leading-6 text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

function ComponentGrid() {
  return (
    <div className="my-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <LinkCard
        href="/docs/button"
        eyebrow="Component"
        title="Button"
        description="Variants, sizing, icons, states, and accessibility rules for action controls."
      />
      <LinkCard
        href="/docs/card"
        eyebrow="Component"
        title="Card"
        description="Composition, slot anatomy, sizing, and layout patterns for grouped content."
      />
      <LinkCard
        href="/docs/input"
        eyebrow="Component"
        title="Input"
        description="Single-line text entry with shared validation and focus styling."
      />
      <LinkCard
        href="/docs/dropdown-menu"
        eyebrow="Component"
        title="Dropdown Menu"
        description="Compact action menus, nested submenus, and stateful menu items."
      />
    </div>
  );
}

function LinkCard({
  href,
  eyebrow,
  title,
  description,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <a
      href={href}
      className="group block border border-border bg-card p-5 text-card-foreground transition-colors hover:bg-muted/30"
    >
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
        {eyebrow}
      </p>
      <div className="mt-3 flex items-center justify-between gap-4">
        <p className="text-lg font-medium">{title}</p>
        <ExternalLink className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </a>
  );
}

export { ComponentGrid, DemoFrame, Guidance, PropsTable, TwoColumnTable };
export type { PropRow };

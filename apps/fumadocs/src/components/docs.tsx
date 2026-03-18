import { Button } from "@hackathon/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@hackathon/ui/components/card";
import { cn } from "@hackathon/ui/lib/utils";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Info,
  Plus,
  Settings2,
  Sparkles,
  Star,
} from "lucide-react";
import type { ReactNode } from "react";

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
    <div className="my-6 overflow-hidden border border-border bg-card text-card-foreground">
      <div className="border-b border-border bg-muted/40 px-4 py-3">
        <p className="text-sm font-medium">{title}</p>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className={cn("flex flex-wrap items-center gap-3 px-4 py-5", className)}>{children}</div>
    </div>
  );
}

function PropsTable({
  rows,
}: {
  rows: Array<{
    prop: string;
    type: string;
    defaultValue?: string;
    description: string;
  }>;
}) {
  return (
    <div className="my-6 overflow-x-auto border border-border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="border-b border-border px-4 py-3 font-medium">Prop</th>
            <th className="border-b border-border px-4 py-3 font-medium">Type</th>
            <th className="border-b border-border px-4 py-3 font-medium">Default</th>
            <th className="border-b border-border px-4 py-3 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.prop} className="align-top">
              <td className="border-b border-border px-4 py-3 font-mono text-xs">{row.prop}</td>
              <td className="border-b border-border px-4 py-3 font-mono text-xs">{row.type}</td>
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

function Guidance({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="my-6 border border-border bg-muted/30 px-4 py-4">
      <div className="flex items-center gap-2">
        <Info className="size-4 text-muted-foreground" />
        <p className="text-sm font-medium">{title}</p>
      </div>
      <div className="mt-2 text-sm leading-6 text-muted-foreground">{children}</div>
    </div>
  );
}

function ButtonVariantDemo() {
  return (
    <DemoFrame
      title="Variants"
      description="Every visual treatment currently supported by the shared button API."
    >
      <Button>Default</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link Button</Button>
    </DemoFrame>
  );
}

function ButtonSizeDemo() {
  return (
    <DemoFrame
      title="Sizes"
      description="Sizes scale height, spacing, and inline icon treatment without changing the API surface."
    >
      <Button size="xs">Extra Small</Button>
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
    </DemoFrame>
  );
}

function ButtonIconDemo() {
  return (
    <DemoFrame
      title="Icons"
      description="Use icon sizes for chrome-heavy controls and pair inline icons with readable labels."
    >
      <Button size="icon" aria-label="Copy invite link">
        <Copy />
      </Button>
      <Button size="icon-sm" variant="outline" aria-label="Add item">
        <Plus />
      </Button>
      <Button size="icon-xs" variant="ghost" aria-label="Open settings">
        <Settings2 />
      </Button>
      <Button size="icon-lg" variant="secondary" aria-label="Open notifications">
        <Bell />
      </Button>
      <Button data-icon="inline-start">
        <Sparkles />
        Generate draft
      </Button>
      <Button variant="outline" data-icon="inline-end">
        Continue
        <ArrowRight />
      </Button>
    </DemoFrame>
  );
}

function ButtonStateDemo() {
  return (
    <DemoFrame
      title="States"
      description="Disabled buttons preserve layout while clearly dropping interaction affordance."
    >
      <Button disabled>Disabled default</Button>
      <Button variant="outline" disabled>
        Disabled outline
      </Button>
      <Button variant="destructive" disabled>
        Disabled destructive
      </Button>
    </DemoFrame>
  );
}

function CardStructureDemo() {
  return (
    <DemoFrame
      title="Structured card"
      description="The recommended composition uses header, content, and optional footer slots."
      className="items-stretch"
    >
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Quarterly rollout</CardTitle>
          <CardDescription>
            Track launch readiness across docs, QA, and implementation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Check className="size-4 text-foreground" />
              Component specs approved
            </div>
            <div className="flex items-center gap-2">
              <Check className="size-4 text-foreground" />
              Figma handoff complete
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-foreground" />
              Release date: March 29
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-between">
          <span className="text-xs text-muted-foreground">Updated 2 hours ago</span>
          <Button size="sm">Open plan</Button>
        </CardFooter>
      </Card>
    </DemoFrame>
  );
}

function CardSizeDemo() {
  return (
    <DemoFrame
      title="Sizes"
      description="The small size compresses spacing while keeping the same composition model."
      className="items-stretch"
    >
      <Card className="max-w-sm">
        <CardHeader>
          <CardTitle>Default card</CardTitle>
          <CardDescription>Best for richer content and multi-line descriptions.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          A comfortable default for dashboards, lists, and editorial surfaces.
        </CardContent>
      </Card>
      <Card size="sm" className="max-w-sm">
        <CardHeader>
          <CardTitle>Small card</CardTitle>
          <CardDescription>Designed for tighter list and utility layouts.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Use when density matters more than spacious presentation.
        </CardContent>
      </Card>
    </DemoFrame>
  );
}

function CardActionDemo() {
  return (
    <DemoFrame
      title="Actions in the header"
      description="`CardAction` aligns utility controls without affecting title and description flow."
      className="items-stretch"
    >
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>New contributors</CardTitle>
          <CardDescription>Review pending onboarding tasks before granting access.</CardDescription>
          <CardAction>
            <Button size="sm" variant="outline">
              Review
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Three people need workspace access and one still needs legal approval.</p>
            <div className="flex items-center gap-2 text-foreground">
              <Star className="size-4" />
              Priority queue active
            </div>
          </div>
        </CardContent>
      </Card>
    </DemoFrame>
  );
}

function CardMediaDemo() {
  return (
    <DemoFrame
      title="Media and footer"
      description="Cards can include top media, then transition into content and persistent footer actions."
      className="items-stretch"
    >
      <Card className="max-w-md">
        <div className="h-40 w-full bg-[linear-gradient(135deg,rgba(0,0,0,0.92),rgba(0,0,0,0.6)),radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_40%)]" />
        <CardHeader>
          <CardTitle>Release notes</CardTitle>
          <CardDescription>
            Summaries, changelogs, and launch-ready assets in a single container.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Combine a visual lead-in with supporting content when you need editorial emphasis.
        </CardContent>
        <CardFooter className="justify-between">
          <Button size="sm" variant="ghost">
            Preview
          </Button>
          <Button size="sm" data-icon="inline-end">
            Read more
            <ChevronRight />
          </Button>
        </CardFooter>
      </Card>
    </DemoFrame>
  );
}

function ButtonApiTable() {
  return (
    <PropsTable
      rows={[
        {
          prop: "variant",
          type: '"default" | "outline" | "secondary" | "ghost" | "destructive" | "link"',
          defaultValue: '"default"',
          description: "Chooses the visual treatment for emphasis, affordance, and contrast.",
        },
        {
          prop: "size",
          type: '"default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"',
          defaultValue: '"default"',
          description: "Controls height, padding, and icon sizing for the button.",
        },
        {
          prop: "className",
          type: "string",
          defaultValue: "-",
          description: "Merged onto the base recipe for one-off layout or styling adjustments.",
        },
        {
          prop: "...props",
          type: "ButtonPrimitive.Props",
          defaultValue: "-",
          description: "Pass through standard button/primitive props such as `disabled`, `type`, and ARIA attributes.",
        },
      ]}
    />
  );
}

function CardApiTable() {
  return (
    <PropsTable
      rows={[
        {
          prop: "size",
          type: '"default" | "sm"',
          defaultValue: '"default"',
          description: "Changes card density and spacing tokens while preserving the same slot structure.",
        },
        {
          prop: "className",
          type: "string",
          defaultValue: "-",
          description: "Merged onto the root card container for layout or presentation changes.",
        },
        {
          prop: "...props",
          type: 'React.ComponentProps<"div">',
          defaultValue: "-",
          description: "Native `div` props for the root card container.",
        },
      ]}
    />
  );
}

function CardSlotsTable() {
  return (
    <div className="my-6 overflow-x-auto border border-border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="border-b border-border px-4 py-3 font-medium">Slot</th>
            <th className="border-b border-border px-4 py-3 font-medium">Purpose</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["CardHeader", "Introduces the card and sets up title, description, and optional actions."],
            ["CardTitle", "Primary heading for the card."],
            ["CardDescription", "Secondary supporting text under the title."],
            ["CardAction", "Right-aligned utility or contextual action area inside the header."],
            ["CardContent", "Main body content for text, lists, forms, or embedded layouts."],
            ["CardFooter", "Persistent bottom row for actions, status, or summary metadata."],
          ].map(([slot, purpose]) => (
            <tr key={slot}>
              <td className="border-b border-border px-4 py-3 font-mono text-xs">{slot}</td>
              <td className="border-b border-border px-4 py-3 text-muted-foreground">{purpose}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComponentGrid() {
  return (
    <div className="my-8 grid gap-4 md:grid-cols-2">
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
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p>
      <div className="mt-3 flex items-center justify-between gap-4">
        <p className="text-lg font-medium">{title}</p>
        <ExternalLink className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </a>
  );
}

export {
  ButtonApiTable,
  ButtonIconDemo,
  ButtonSizeDemo,
  ButtonStateDemo,
  ButtonVariantDemo,
  CardActionDemo,
  CardApiTable,
  CardMediaDemo,
  CardSizeDemo,
  CardSlotsTable,
  CardStructureDemo,
  ComponentGrid,
  Guidance,
};

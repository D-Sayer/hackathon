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
import { CalendarDays, Check, ChevronRight, Star } from "lucide-react";

import { DemoFrame, PropsTable, TwoColumnTable } from "@/components/docs/shared";

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

function CardApiTable() {
  return (
    <PropsTable
      rows={[
        {
          prop: "size",
          type: '"default" | "sm"',
          defaultValue: '"default"',
          description:
            "Changes card density and spacing tokens while preserving the same slot structure.",
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
    <TwoColumnTable
      leftLabel="Slot"
      rightLabel="Purpose"
      rows={[
        ["CardHeader", "Introduces the card and sets up title, description, and optional actions."],
        ["CardTitle", "Primary heading for the card."],
        ["CardDescription", "Secondary supporting text under the title."],
        ["CardAction", "Right-aligned utility or contextual action area inside the header."],
        ["CardContent", "Main body content for text, lists, forms, or embedded layouts."],
        ["CardFooter", "Persistent bottom row for actions, status, or summary metadata."],
      ]}
    />
  );
}

export {
  CardActionDemo,
  CardApiTable,
  CardMediaDemo,
  CardSizeDemo,
  CardSlotsTable,
  CardStructureDemo,
};

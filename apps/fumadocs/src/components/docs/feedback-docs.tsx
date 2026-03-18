import { Toaster } from "@hackathon/ui/components/sonner";
import { Button } from "@hackathon/ui/components/button";

import { DemoFrame, Guidance, PropsTable } from "@/components/docs/shared";

function ToasterDemo() {
  return (
    <DemoFrame
      title="Toast host"
      description="The toaster mounts the global toast surface once near the app root."
    >
      <Toaster position="top-right" />
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Button variant="outline" size="sm">
          Trigger from app code
        </Button>
        <span>Render one toaster and drive it with Sonner calls elsewhere.</span>
      </div>
    </DemoFrame>
  );
}

function ToasterUsageGuidance() {
  return (
    <Guidance title="Placement">
      Render <code>Toaster</code> once in the app shell so all routes share the
      same notification stack and theme settings.
    </Guidance>
  );
}

function ToasterApiTable() {
  return (
    <PropsTable
      rows={[
        {
          prop: "...props",
          type: "sonner.ToasterProps",
          defaultValue: "-",
          description: "All Sonner toaster props are forwarded through unchanged.",
        },
      ]}
    />
  );
}

export { ToasterApiTable, ToasterDemo, ToasterUsageGuidance };

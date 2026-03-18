import { Button } from "@hackathon/ui/components/button";
import { ArrowRight, Bell, Copy, Plus, Settings2, Sparkles } from "lucide-react";

import { DemoFrame, PropsTable } from "@/components/docs/shared";

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
          description:
            "Pass through standard button/primitive props such as `disabled`, `type`, and ARIA attributes.",
        },
      ]}
    />
  );
}

export {
  ButtonApiTable,
  ButtonIconDemo,
  ButtonSizeDemo,
  ButtonStateDemo,
  ButtonVariantDemo,
};

import { Badge } from "@hackathon/ui/components/badge";
import { Checkbox } from "@hackathon/ui/components/checkbox";
import { Input } from "@hackathon/ui/components/input";
import { Label } from "@hackathon/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@hackathon/ui/components/radio-group";
import { Separator } from "@hackathon/ui/components/separator";
import { Skeleton } from "@hackathon/ui/components/skeleton";
import { Slider } from "@hackathon/ui/components/slider";
import { Switch } from "@hackathon/ui/components/switch";
import { Textarea } from "@hackathon/ui/components/textarea";
import { Tag } from "lucide-react";

import { DemoFrame, PropsTable } from "@/components/docs/shared";

function BadgeVariantDemo() {
  return (
    <DemoFrame
      title="Badge variants"
      description="Badges are compact labels for status, counts, and short metadata."
    >
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="destructive">Alert</Badge>
      <Badge variant="ghost">Ghost</Badge>
      <Badge variant="link">Link</Badge>
    </DemoFrame>
  );
}

function BadgeApiTable() {
  return (
    <PropsTable
      rows={[
        {
          prop: "variant",
          type: '"default" | "secondary" | "destructive" | "outline" | "ghost" | "link"',
          defaultValue: '"default"',
          description: "Sets the badge color treatment and emphasis level.",
        },
        {
          prop: "render",
          type: "render prop",
          defaultValue: "-",
          description: "Swap the underlying element when the badge should act like a link or button.",
        },
        {
          prop: "...props",
          type: 'React.ComponentProps<"span">',
          defaultValue: "-",
          description: "Standard span props forwarded to the root badge element.",
        },
      ]}
    />
  );
}

function CheckboxStateDemo() {
  return (
    <DemoFrame
      title="Checkbox states"
      description="Use checkboxes when users may select one or many independent options."
      className="items-stretch"
    >
      <label className="flex items-center gap-3">
        <Checkbox defaultChecked />
        Checked
      </label>
      <label className="flex items-center gap-3">
        <Checkbox />
        Unchecked
      </label>
    </DemoFrame>
  );
}

function CheckboxApiTable() {
  return (
    <PropsTable
      rows={[
        {
          prop: "...props",
          type: "Base UI checkbox props",
          defaultValue: "-",
          description: "Forwarded to the underlying checkbox primitive.",
        },
      ]}
    />
  );
}

function InputDemo() {
  return (
    <DemoFrame
      title="Text input"
      description="Inputs are the default single-line text field for forms and search."
      className="items-stretch"
    >
      <Input className="max-w-sm" placeholder="Project name" />
      <Input className="max-w-sm" type="email" placeholder="team@example.com" />
      <Input className="max-w-sm" type="search" defaultValue="release notes" />
    </DemoFrame>
  );
}

function InputApiTable() {
  return (
    <PropsTable
      rows={[
        {
          prop: "type",
          type: "HTML input type",
          defaultValue: '"text"',
          description: "Passes through to the native input element.",
        },
        {
          prop: "...props",
          type: 'React.ComponentProps<"input">',
          defaultValue: "-",
          description: "Standard input props, including validation and ARIA attributes.",
        },
      ]}
    />
  );
}

function LabelDemo() {
  return (
    <DemoFrame
      title="Label pairing"
      description="Labels should describe the control that follows them."
      className="items-stretch"
    >
      <div className="flex items-center gap-3">
        <Label htmlFor="demo-name">Name</Label>
        <Input id="demo-name" className="max-w-xs" placeholder="Ada" />
      </div>
      <div className="flex items-center gap-3">
        <Checkbox id="demo-terms" />
        <Label htmlFor="demo-terms">Accept terms</Label>
      </div>
    </DemoFrame>
  );
}

function LabelApiTable() {
  return (
    <PropsTable
      rows={[
        {
          prop: "...props",
          type: 'React.ComponentProps<"label">',
          defaultValue: "-",
          description: "Standard label props forwarded to the root element.",
        },
      ]}
    />
  );
}

function SeparatorDemo() {
  return (
    <DemoFrame
      title="Separators"
      description="Separators divide adjacent sections without adding extra semantic weight."
      className="items-stretch"
    >
      <div className="w-full max-w-md space-y-3">
        <div className="flex items-center gap-3 text-sm">
          <span>Profile</span>
          <Separator className="flex-1" />
          <span>Billing</span>
          <Separator orientation="vertical" className="h-4" />
          <span>Security</span>
        </div>
        <Separator />
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Tag className="size-4" />
          Vertical and horizontal separators both use the same primitive.
        </div>
      </div>
    </DemoFrame>
  );
}

function SeparatorApiTable() {
  return (
    <PropsTable
      rows={[
        {
          prop: "orientation",
          type: '"horizontal" | "vertical"',
          defaultValue: '"horizontal"',
          description: "Chooses whether the separator draws a row or column rule.",
        },
        {
          prop: "...props",
          type: "Base UI separator props",
          defaultValue: "-",
          description: "Forwarded to the underlying separator primitive.",
        },
      ]}
    />
  );
}

function SkeletonDemo() {
  return (
    <DemoFrame
      title="Loading placeholders"
      description="Skeletons reserve space while content is still loading."
      className="items-stretch"
    >
      <div className="w-full max-w-md space-y-3">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    </DemoFrame>
  );
}

function SkeletonApiTable() {
  return (
    <PropsTable
      rows={[
        {
          prop: "...props",
          type: 'React.ComponentProps<"div">',
          defaultValue: "-",
          description: "Standard div props for the animated placeholder block.",
        },
      ]}
    />
  );
}

function SliderDemo() {
  return (
    <DemoFrame
      title="Range slider"
      description="The wrapper supports single-value and range-based sliders."
      className="items-stretch"
    >
      <div className="w-full max-w-md space-y-4">
        <Slider defaultValue={[35]} max={100} aria-label="Opacity" />
        <Slider defaultValue={[20, 80]} max={100} aria-label="Range" />
      </div>
    </DemoFrame>
  );
}

function SliderApiTable() {
  return (
    <PropsTable
      rows={[
        {
          prop: "min / max",
          type: "number",
          defaultValue: "0 / 100",
          description: "Bounds for the slider range.",
        },
        {
          prop: "value / defaultValue",
          type: "number[] | readonly number[]",
          defaultValue: "-",
          description: "Supports single-thumb and multi-thumb slider values.",
        },
        {
          prop: "...props",
          type: "Base UI slider props",
          defaultValue: "-",
          description: "Forwarded to the underlying slider primitive.",
        },
      ]}
    />
  );
}

function SwitchDemo() {
  return (
    <DemoFrame
      title="Switch sizes"
      description="Switches are ideal for binary settings that can be changed in place."
      className="items-stretch"
    >
      <label className="flex items-center gap-3">
        <Switch defaultChecked />
        Default
      </label>
      <label className="flex items-center gap-3">
        <Switch size="sm" />
        Small
      </label>
    </DemoFrame>
  );
}

function SwitchApiTable() {
  return (
    <PropsTable
      rows={[
        {
          prop: "size",
          type: '"default" | "sm"',
          defaultValue: '"default"',
          description: "Chooses the compact or default thumb and track size.",
        },
        {
          prop: "...props",
          type: "Base UI switch props",
          defaultValue: "-",
          description: "Forwarded to the underlying switch primitive.",
        },
      ]}
    />
  );
}

function TextareaDemo() {
  return (
    <DemoFrame
      title="Multiline input"
      description="Textareas are the right choice when users need a message, note, or explanation."
      className="items-stretch"
    >
      <Textarea className="max-w-lg" placeholder="Leave feedback" rows={4} />
      <Textarea className="max-w-lg" defaultValue="A longer response..." rows={4} />
    </DemoFrame>
  );
}

function TextareaApiTable() {
  return (
    <PropsTable
      rows={[
        {
          prop: "...props",
          type: 'React.ComponentProps<"textarea">',
          defaultValue: "-",
          description: "Standard textarea props forwarded to the native element.",
        },
      ]}
    />
  );
}

function RadioGroupDemo() {
  return (
    <DemoFrame
      title="Radio groups"
      description="Use radios for mutually exclusive choices."
      className="items-stretch"
    >
      <RadioGroup defaultValue="starter" className="max-w-sm">
        <label className="flex items-center gap-3">
          <RadioGroupItem value="starter" />
          Starter
        </label>
        <label className="flex items-center gap-3">
          <RadioGroupItem value="pro" />
          Pro
        </label>
        <label className="flex items-center gap-3">
          <RadioGroupItem value="team" />
          Team
        </label>
      </RadioGroup>
    </DemoFrame>
  );
}

function RadioGroupApiTable() {
  return (
    <PropsTable
      rows={[
        {
          prop: "...props",
          type: "Base UI radio group props",
          defaultValue: "-",
          description: "Forwarded to the underlying radio group primitive.",
        },
      ]}
    />
  );
}

export {
  BadgeApiTable,
  BadgeVariantDemo,
  CheckboxApiTable,
  CheckboxStateDemo,
  InputApiTable,
  InputDemo,
  LabelApiTable,
  LabelDemo,
  RadioGroupApiTable,
  RadioGroupDemo,
  SeparatorApiTable,
  SeparatorDemo,
  SkeletonApiTable,
  SkeletonDemo,
  SliderApiTable,
  SliderDemo,
  SwitchApiTable,
  SwitchDemo,
  TextareaApiTable,
  TextareaDemo,
};

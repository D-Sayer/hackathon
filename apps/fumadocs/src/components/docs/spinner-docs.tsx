import { Button } from "@hackathon/ui/components/button";
import { Spinner } from "@hackathon/ui/components/spinner";

import { DemoFrame, PropsTable } from "@/components/docs/shared";

function SpinnerBasicDemo() {
  return (
    <DemoFrame
      title="Default"
      description="A single spinner with default size and color, indicating an indeterminate loading state."
    >
      <Spinner />
    </DemoFrame>
  );
}

function SpinnerSizeDemo() {
  return (
    <DemoFrame
      title="Sizes"
      description="Override the default size-4 with any Tailwind size utility via className."
    >
      <Spinner className="size-3" aria-label="Loading extra small" />
      <Spinner className="size-4" aria-label="Loading small" />
      <Spinner className="size-6" aria-label="Loading medium" />
      <Spinner className="size-8" aria-label="Loading large" />
      <Spinner className="size-10" aria-label="Loading extra large" />
    </DemoFrame>
  );
}

function SpinnerColorDemo() {
  return (
    <DemoFrame
      title="Colors"
      description="The spinner inherits the current text color, so any text-color utility applies."
    >
      <Spinner aria-label="Loading default" />
      <Spinner className="text-primary" aria-label="Loading primary" />
      <Spinner className="text-destructive" aria-label="Loading destructive" />
      <Spinner className="text-muted-foreground" aria-label="Loading muted" />
    </DemoFrame>
  );
}

function SpinnerButtonDemo() {
  return (
    <DemoFrame
      title="Inside a button"
      description="Pair with a Button to communicate a pending async operation while preserving the call-to-action layout."
    >
      <Button disabled>
        <Spinner />
        Saving…
      </Button>
      <Button variant="outline" disabled>
        <Spinner />
        Loading
      </Button>
      <Button variant="secondary" disabled>
        <Spinner />
        Processing
      </Button>
    </DemoFrame>
  );
}

function SpinnerApiTable() {
  return (
    <PropsTable
      rows={[
        {
          prop: "className",
          type: "string",
          defaultValue: '"size-4 animate-spin"',
          description:
            "Merged onto the base icon classes. Use Tailwind size and text-color utilities to adjust appearance.",
        },
        {
          prop: "aria-label",
          type: "string",
          defaultValue: '"Loading"',
          description:
            "Accessible label for screen readers. Override when the context requires a more specific description.",
        },
        {
          prop: "...props",
          type: 'React.ComponentProps<"svg">',
          defaultValue: "-",
          description:
            "All standard SVG props are forwarded to the underlying icon element.",
        },
      ]}
    />
  );
}

export {
  SpinnerApiTable,
  SpinnerBasicDemo,
  SpinnerButtonDemo,
  SpinnerColorDemo,
  SpinnerSizeDemo,
};

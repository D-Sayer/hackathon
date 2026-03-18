import { Button } from "@hackathon/ui/components/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@hackathon/ui/components/alert-dialog";
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "@hackathon/ui/components/button-group";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@hackathon/ui/components/dropdown-menu";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "@hackathon/ui/components/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@hackathon/ui/components/input-group";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@hackathon/ui/components/item";
import { Copy, Link2, Mail, MoreHorizontal, Search, Trash2, Wrench } from "lucide-react";

import { DemoFrame, PropsTable, TwoColumnTable } from "@/components/docs/shared";

function AlertDialogDemo() {
  return (
    <DemoFrame
      title="Confirmation dialog"
      description="Alert dialogs pause the flow and make destructive choices explicit."
      className="items-stretch"
    >
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="outline" />}>
          Delete user
        </AlertDialogTrigger>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the account, access, and stored activity.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DemoFrame>
  );
}

function AlertDialogSlotsTable() {
  return (
    <TwoColumnTable
      leftLabel="Slot"
      rightLabel="Purpose"
      rows={[
        ["AlertDialog", "Root controller that manages open state and lifecycle."],
        ["AlertDialogTrigger", "Opens the dialog from any interactive element."],
        ["AlertDialogPortal", "Moves dialog content to the document layer."],
        ["AlertDialogOverlay", "Backdrops the modal surface and blocks the page."],
        ["AlertDialogContent", "Positions and animates the popup content."],
        ["AlertDialogHeader", "Top section for title, description, and media."],
        ["AlertDialogFooter", "Action row for cancel and confirm buttons."],
        ["AlertDialogTitle", "Accessible dialog heading."],
        ["AlertDialogDescription", "Supporting body copy and context."],
        ["AlertDialogAction", "Primary confirmation action."],
        ["AlertDialogCancel", "Cancel action wired to close the dialog."],
      ]}
    />
  );
}

function AlertDialogApiTable() {
  return (
    <PropsTable
      rows={[
        {
          prop: "size",
          type: '"default" | "sm"',
          defaultValue: '"default"',
          description: "Controls popup width and the responsive action layout.",
        },
        {
          prop: "...props",
          type: "Base UI alert dialog props",
          defaultValue: "-",
          description: "Forwarded to the underlying dialog primitive.",
        },
      ]}
    />
  );
}

function ButtonGroupDemo() {
  return (
    <DemoFrame
      title="Grouped controls"
      description="Button groups keep adjacent actions visually tied together."
      className="items-stretch"
    >
      <ButtonGroup>
        <Button variant="outline">Primary</Button>
        <Button variant="outline">Secondary</Button>
        <Button variant="outline">Tertiary</Button>
      </ButtonGroup>
      <ButtonGroup orientation="vertical">
        <Button variant="outline">Top</Button>
        <Button variant="outline">Middle</Button>
        <Button variant="outline">Bottom</Button>
      </ButtonGroup>
      <ButtonGroup>
        <ButtonGroupText>
          <Search className="size-4" />
          Search
        </ButtonGroupText>
        <ButtonGroupSeparator />
        <Button variant="outline">Run</Button>
      </ButtonGroup>
    </DemoFrame>
  );
}

function ButtonGroupApiTable() {
  return (
    <PropsTable
      rows={[
        {
          prop: "orientation",
          type: '"horizontal" | "vertical"',
          defaultValue: '"horizontal"',
          description: "Chooses whether the group stacks across a row or a column.",
        },
        {
          prop: "...props",
          type: 'React.ComponentProps<"div">',
          defaultValue: "-",
          description: "Native container props for the group wrapper.",
        },
      ]}
    />
  );
}

function DropdownMenuDemo() {
  return (
    <DemoFrame
      title="Menu surface"
      description="Dropdown menus collect related actions behind a single trigger."
      className="items-stretch"
    >
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" />}>
          Open menu
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Workspace</DropdownMenuLabel>
            <DropdownMenuItem>
              Rename
              <DropdownMenuShortcut>R</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuItem>
              Share
              <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>More actions</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Archive</DropdownMenuItem>
              <DropdownMenuItem>Move</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked>Show archived</DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value="owner">
            <DropdownMenuRadioItem value="owner">Owner</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="member">Member</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">
            Delete workspace
            <DropdownMenuShortcut>
              <Trash2 className="size-3.5" />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </DemoFrame>
  );
}

function DropdownMenuSlotsTable() {
  return (
    <TwoColumnTable
      leftLabel="Slot"
      rightLabel="Purpose"
      rows={[
        ["DropdownMenu", "Root controller for open state and menu placement."],
        ["DropdownMenuTrigger", "Button or control that opens the menu."],
        ["DropdownMenuContent", "Floating popup surface that holds the menu items."],
        ["DropdownMenuGroup", "Logical grouping for related menu items."],
        ["DropdownMenuLabel", "Non-interactive section label."],
        ["DropdownMenuItem", "Clickable action item, including destructive actions."],
        ["DropdownMenuCheckboxItem", "Menu item that toggles a checked state."],
        ["DropdownMenuRadioGroup", "Exclusive selection container."],
        ["DropdownMenuRadioItem", "Radio-style choice inside the menu."],
        ["DropdownMenuSub", "Root for nested submenus."],
        ["DropdownMenuSubTrigger", "Opens a nested submenu."],
        ["DropdownMenuSubContent", "Popup surface for a nested submenu."],
        ["DropdownMenuSeparator", "Visual divider between menu groups."],
        ["DropdownMenuShortcut", "Right-aligned keyboard shortcut or hint."],
      ]}
    />
  );
}

function DropdownMenuApiTable() {
  return (
    <PropsTable
      rows={[
        {
          prop: "...props",
          type: "Base UI menu props",
          defaultValue: "-",
          description: "Forwarded to the underlying menu primitives.",
        },
      ]}
    />
  );
}

function FieldDemo() {
  return (
    <DemoFrame
      title="Structured form field"
      description="Field groups keep labels, content, separators, and errors aligned."
      className="items-stretch"
    >
      <FieldSet className="max-w-lg">
        <FieldLegend>Profile settings</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel>
              <FieldTitle>Email notifications</FieldTitle>
            </FieldLabel>
            <FieldContent>
              <FieldDescription>
                We only use this address for account and product updates.
              </FieldDescription>
            </FieldContent>
          </Field>
          <FieldSeparator>Delivery</FieldSeparator>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="field-weekly">
              <input id="field-weekly" type="checkbox" />
              Weekly summary
            </FieldLabel>
            <FieldContent>
              <FieldDescription>Receive one digest email each week.</FieldDescription>
              <FieldError>Choose at least one delivery channel.</FieldError>
            </FieldContent>
          </Field>
        </FieldGroup>
      </FieldSet>
    </DemoFrame>
  );
}

function FieldSlotsTable() {
  return (
    <TwoColumnTable
      leftLabel="Slot"
      rightLabel="Purpose"
      rows={[
        ["FieldSet", "Semantic fieldset wrapper for related controls."],
        ["FieldLegend", "Section heading for a group of fields."],
        ["FieldGroup", "Stacks one or more fields with shared spacing."],
        ["Field", "Wrapper for a single label, control, and helper stack."],
        ["FieldContent", "Body area for the control and helper content."],
        ["FieldLabel", "Label wrapper that inherits disabled and state styling."],
        ["FieldTitle", "Headline text inside the label area."],
        ["FieldDescription", "Supporting copy under the title or control."],
        ["FieldSeparator", "Divider that can optionally carry centered text."],
        ["FieldError", "Error presentation for one or more validation messages."],
      ]}
    />
  );
}

function FieldApiTable() {
  return (
    <PropsTable
      rows={[
        {
          prop: "orientation",
          type: '"vertical" | "horizontal" | "responsive"',
          defaultValue: '"vertical"',
          description: "Controls how the label and content stack in the field wrapper.",
        },
        {
          prop: "...props",
          type: 'React.ComponentProps<"div">',
          defaultValue: "-",
          description: "Native container props for each field wrapper element.",
        },
      ]}
    />
  );
}

function InputGroupDemo() {
  return (
    <DemoFrame
      title="Mixed input group"
      description="Input groups keep leading and trailing controls visually connected."
      className="items-stretch"
    >
      <InputGroup className="max-w-lg">
        <InputGroupAddon>
          <Search className="size-4" />
        </InputGroupAddon>
        <InputGroupInput placeholder="Search projects" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton aria-label="Copy search link" variant="ghost" size="icon-sm">
            <Copy className="size-4" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <InputGroup className="max-w-lg">
        <InputGroupAddon align="block-start">
          <InputGroupText>
            <Mail className="size-4" />
            Email
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="alex@example.com" />
      </InputGroup>
      <InputGroup className="max-w-lg">
        <InputGroupTextarea rows={3} placeholder="Write a message" />
        <InputGroupAddon align="block-end">
          <InputGroupText>
            <Wrench className="size-4" />
            Formatting helper
          </InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </DemoFrame>
  );
}

function InputGroupSlotsTable() {
  return (
    <TwoColumnTable
      leftLabel="Slot"
      rightLabel="Purpose"
      rows={[
        ["InputGroup", "Root wrapper that aligns addons, inputs, and text."],
        ["InputGroupAddon", "Clickable or passive addon area at any edge."],
        ["InputGroupButton", "Button that inherits the group styling."],
        ["InputGroupText", "Non-interactive text or icon treatment."],
        ["InputGroupInput", "Shared input control with group chrome removed."],
        ["InputGroupTextarea", "Shared textarea control with matching group styling."],
      ]}
    />
  );
}

function InputGroupApiTable() {
  return (
    <PropsTable
      rows={[
        {
          prop: "InputGroupAddon align",
          type: '"inline-start" | "inline-end" | "block-start" | "block-end"',
          defaultValue: '"inline-start"',
          description: "Chooses where the addon sits around the grouped control.",
        },
        {
          prop: "InputGroupButton size",
          type: '"xs" | "sm" | "icon-xs" | "icon-sm"',
          defaultValue: '"xs"',
          description: "Controls button density when used inside an input group.",
        },
        {
          prop: "...props",
          type: "Native div, input, textarea, or button props",
          defaultValue: "-",
          description: "Forwarded to the underlying element or shared primitive.",
        },
      ]}
    />
  );
}

function ItemDemo() {
  return (
    <DemoFrame
      title="List item rows"
      description="Item is the shared pattern for rich rows in lists, menus, and dashboards."
      className="items-stretch"
    >
      <ItemGroup className="max-w-xl">
        <Item variant="outline">
          <ItemMedia variant="icon">
            <Link2 className="size-4" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>API gateway</ItemTitle>
            <ItemDescription>Connected to staging and production traffic.</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button variant="outline" size="sm">Open</Button>
          </ItemActions>
        </Item>
        <Item size="sm" variant="muted">
          <ItemContent>
            <ItemHeader>
              <ItemTitle>Release checklist</ItemTitle>
              <ItemActions>
                <Button variant="ghost" size="icon-sm" aria-label="More actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              </ItemActions>
            </ItemHeader>
            <ItemDescription>Three tasks remain before the launch window opens.</ItemDescription>
          </ItemContent>
        </Item>
        <ItemSeparator />
        <Item size="xs" variant="default">
          <ItemMedia variant="image">
            <div className="grid size-full place-items-center bg-muted text-xs font-medium">42</div>
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Audit log</ItemTitle>
            <ItemFooter>
              <span className="text-xs text-muted-foreground">Updated 12m ago</span>
              <Button variant="ghost" size="sm">Review</Button>
            </ItemFooter>
          </ItemContent>
        </Item>
      </ItemGroup>
    </DemoFrame>
  );
}

function ItemSlotsTable() {
  return (
    <TwoColumnTable
      leftLabel="Slot"
      rightLabel="Purpose"
      rows={[
        ["ItemGroup", "Vertical stack that spaces multiple item rows."],
        ["Item", "Root row wrapper for rich list content."],
        ["ItemMedia", "Leading media slot for icons or images."],
        ["ItemContent", "Flexible content column for the item body."],
        ["ItemTitle", "Primary title text for the item."],
        ["ItemDescription", "Supporting description below the title."],
        ["ItemActions", "Action cluster aligned with the item."],
        ["ItemHeader", "Full-width top row for title and actions."],
        ["ItemFooter", "Full-width bottom row for metadata and actions."],
        ["ItemSeparator", "Horizontal divider between item rows."],
      ]}
    />
  );
}

function ItemApiTable() {
  return (
    <PropsTable
      rows={[
        {
          prop: "variant",
          type: '"default" | "outline" | "muted"',
          defaultValue: '"default"',
          description: "Controls row chrome and background treatment.",
        },
        {
          prop: "size",
          type: '"default" | "sm" | "xs"',
          defaultValue: '"default"',
          description: "Changes padding and spacing density for the row.",
        },
        {
          prop: "...props",
          type: "Base render props or div props",
          defaultValue: "-",
          description: "Forwarded to the root item or rendered element.",
        },
      ]}
    />
  );
}

export {
  AlertDialogApiTable,
  AlertDialogDemo,
  AlertDialogSlotsTable,
  ButtonGroupApiTable,
  ButtonGroupDemo,
  DropdownMenuApiTable,
  DropdownMenuDemo,
  DropdownMenuSlotsTable,
  FieldApiTable,
  FieldDemo,
  FieldSlotsTable,
  InputGroupApiTable,
  InputGroupDemo,
  InputGroupSlotsTable,
  ItemApiTable,
  ItemDemo,
  ItemSlotsTable,
};

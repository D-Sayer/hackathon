import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

import {
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
} from "@/components/docs";

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
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
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}

import type { Route } from "./+types/_index";
import { Demo } from "@/components/demo";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "hackathon" },
    { name: "description", content: "hackathon is a web application" },
  ];
}

export default function Home() {
  return (
   <Demo/>
  );
}

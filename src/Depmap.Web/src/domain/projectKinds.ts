import type { ProjectKind } from "../api/types";

export const DEFAULT_KINDS: ProjectKind[] = ["library", "test", "web", "blazor", "service", "nuget-producing"];

export const KIND_LABELS: Record<ProjectKind, string> = {
  library: "Library Projects",
  test: "Test Projects",
  web: "Web Projects",
  blazor: "Blazor Projects",
  service: "Service Projects",
  "nuget-producing": "NuGet Producers",
};

export const KIND_NOTES: Record<ProjectKind, string> = {
  library: "General libraries and shared code.",
  test: "Projects classified as automated tests.",
  web: "ASP.NET web applications and APIs.",
  blazor: "Blazor WebAssembly applications.",
  service: "Hosted worker and service-style applications.",
  "nuget-producing": "Projects that publish internal packages.",
};

export const KIND_SHORT: Record<ProjectKind, string> = {
  library: "Library",
  test: "Test",
  web: "Web",
  blazor: "Blazor",
  service: "Service",
  "nuget-producing": "NuGet",
};

export const KIND_CLASS: Record<ProjectKind, string> = {
  library: "kind-library",
  test: "kind-test",
  web: "kind-web",
  blazor: "kind-blazor",
  service: "kind-service",
  "nuget-producing": "kind-nuget-producing",
};

export function effectiveProjectKinds(kinds?: ProjectKind[]): ProjectKind[] {
  return kinds && kinds.length > 0 ? kinds : ["library"];
}

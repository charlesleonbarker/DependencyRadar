import type { ProjectKind } from "../api/types";

export const DEFAULT_KINDS: ProjectKind[] = ["library", "test", "web", "blazor", "service", "nuget-producing"];

export const KIND_LABELS: Record<ProjectKind, string> = {
  library: "Microsoft.NET.Sdk projects",
  test: ".NET test projects",
  web: "Microsoft.NET.Sdk.Web projects",
  blazor: "Blazor WebAssembly projects",
  service: "Worker SDK or hosted-service projects",
  "nuget-producing": "Packable NuGet projects",
};

export const KIND_NOTES: Record<ProjectKind, string> = {
  library: "Projects using the base Microsoft.NET.Sdk.",
  test: "Projects marked as test projects.",
  web: "Projects using Microsoft.NET.Sdk.Web.",
  blazor: "Projects using a Blazor SDK or ASP.NET Core Components package.",
  service: "Projects using the Worker SDK or Microsoft.Extensions.Hosting.",
  "nuget-producing": "Packable projects with a NuGet package ID.",
};

export const KIND_SHORT: Record<ProjectKind, string> = {
  library: ".NET SDK",
  test: "Test",
  web: "Web SDK",
  blazor: "Blazor",
  service: "Worker",
  "nuget-producing": "Packable",
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

import type { Project } from "@plane-todo/core";
import { normalizeList } from "./normalize";

/**
 * Normalize whatever a projects fetch produced into a bare Project[]:
 * bare array passes through, the paginated { results } envelope is unwrapped,
 * anything else (undefined while loading, garbage) yields [].
 */
export function normalizeProjects(input: unknown): Project[] {
  return normalizeList<Project>(input);
}

/**
 * Projects the Today view spans: the configured default project only, else all
 * projects. Returns ids so query keys stay primitive. Defensive: any non-array
 * input (undefined while loading, or a paginated wrapper) yields [] rather
 * than throwing.
 */
export function selectTodayProjectIds(
  projects: Project[] | undefined,
  defaultProjectId?: string,
): string[] {
  if (defaultProjectId) return [defaultProjectId];
  const list = normalizeProjects(projects);
  return list.map((p) => p.id);
}

/**
 * The single active project for the All tab (cursor pagination is per-project):
 * the configured default, else the first project.
 */
export function selectActiveProjectId(
  projects: Project[] | undefined,
  defaultProjectId?: string,
): string | undefined {
  if (defaultProjectId) return defaultProjectId;
  return normalizeProjects(projects)[0]?.id;
}

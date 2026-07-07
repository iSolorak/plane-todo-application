import { createHash } from "node:crypto";
import type { ReminderRow } from "./db.js";

/** The minimal shape we need from a Plane issue (webhook data or API read). */
export interface IssueLike {
  id: string;
  name?: string;
  project_id?: string;
  /** Plane webhook payloads sometimes use `project` for the project id. */
  project?: string;
  target_date?: string | null;
}

export interface ReminderContext {
  baseUrl: string;
  workspaceSlug: string;
}

export function projectIdOf(issue: IssueLike): string | undefined {
  return issue.project_id ?? issue.project ?? undefined;
}

/** Build the Plane web UI URL for an issue. */
export function issueUrl(
  ctx: ReminderContext,
  projectId: string,
  issueId: string,
): string {
  return `${ctx.baseUrl}/${ctx.workspaceSlug}/projects/${projectId}/issues/${issueId}`;
}

/**
 * Build a reminders row from an issue-like object. Returns null if the issue is
 * missing the fields we require (id, project, target_date) — callers treat a
 * null as "nothing to store / delete instead".
 */
export function buildReminderRow(
  issue: IssueLike,
  ctx: ReminderContext,
  now: Date = new Date(),
): ReminderRow | null {
  const projectId = projectIdOf(issue);
  if (!issue.id || !projectId || !issue.target_date) return null;

  const name = issue.name ?? "(untitled)";
  const targetDate = issue.target_date;
  const dedupHash = createHash("sha256")
    .update(`${name}|${targetDate}|${projectId}`)
    .digest("hex");

  return {
    work_item_id: issue.id,
    project_id: projectId,
    name,
    target_date: targetDate,
    url: issueUrl(ctx, projectId, issue.id),
    dedup_hash: dedupHash,
    updated_at: now.toISOString(),
  };
}

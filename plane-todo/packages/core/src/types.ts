/**
 * Domain types mirroring the JSON shapes returned by the self-hosted Plane
 * REST API. Fields are kept permissive where Plane's payloads vary between
 * versions/deployments, but the commonly-present fields are typed explicitly.
 */

export type Priority = "urgent" | "high" | "medium" | "low" | "none";

/** A UUID string as used throughout Plane. */
export type ID = string;

/** ISO-8601 date string, e.g. "2026-07-07" (dates) or full timestamps. */
export type ISODate = string;

/** The lifecycle group a Plane state belongs to. */
export type StateGroup =
  | "backlog"
  | "unstarted"
  | "started"
  | "completed"
  | "cancelled"
  | "triage";

export interface State {
  id: ID;
  name: string;
  color: string;
  group: StateGroup;
  /** Order within the project's state list. */
  sequence: number;
  /** Whether this is the project's default state for its group. */
  default: boolean;
  project_id?: ID;
}

export interface Label {
  id: ID;
  name: string;
  color?: string;
  project_id?: ID;
  parent?: ID | null;
}

/** A workspace/project member that can be assigned to a work item. */
export interface Assignee {
  id: ID;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  avatar?: string | null;
}

export interface Project {
  id: ID;
  name: string;
  identifier?: string;
  description?: string | null;
  network?: number;
  workspace?: ID;
  created_at?: ISODate;
  updated_at?: ISODate;
}

/**
 * A Plane work item (issue). By default Plane returns related entities as ID
 * references; when the `expand` param is used they may be returned as nested
 * objects instead, hence the union types below.
 */
export interface WorkItem {
  id: ID;
  name: string;
  description_html: string | null;
  sequence_id: number;
  state: ID | State | null;
  priority: Priority;
  assignees: Array<ID | Assignee>;
  labels: Array<ID | Label>;
  start_date: ISODate | null;
  target_date: ISODate | null;
  project_id: ID;
  created_at: ISODate;
  updated_at: ISODate;
}

/** Payload accepted when creating a work item. `name` is the only required field. */
export interface CreateWorkItemInput {
  name: string;
  description_html?: string | null;
  state?: ID | null;
  priority?: Priority;
  assignees?: ID[];
  labels?: ID[];
  start_date?: ISODate | null;
  target_date?: ISODate | null;
  [key: string]: unknown;
}

/** Partial payload for PATCH updates. */
export type UpdateWorkItemInput = Partial<CreateWorkItemInput>;

/** Query params shared by list/detail endpoints for shaping the response. */
export interface FieldSelection {
  /** Comma-separated list (or array) of fields to include. */
  fields?: string | string[];
  /** Comma-separated list (or array) of relations to expand inline. */
  expand?: string | string[];
}

export interface ListWorkItemsParams extends FieldSelection {
  /** Page size for cursor pagination. */
  per_page?: number;
  /** e.g. "created_at" or "-created_at" (descending). */
  order_by?: string;
  /** Opaque cursor returned as `next_cursor` from a previous page. */
  cursor?: string;
  [key: string]: unknown;
}

/**
 * Normalized cursor-paginated result.
 *
 * Plane always returns `next_cursor`/`prev_cursor` (format
 * "per_page:page:is_prev"), so the cursor is never a reliable has-more signal.
 * Use `hasMore`/`hasPrev` (derived from Plane's `next_page_results` /
 * `prev_page_results` booleans) to decide whether to page.
 */
export interface Paginated<T> {
  results: T[];
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
  hasPrev: boolean;
  count: number;
  totalPages: number;
  totalResults: number;
}

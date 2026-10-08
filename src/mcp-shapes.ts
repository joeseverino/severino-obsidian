import { arrayOf, isBoolean, isNumber, isString, optional, shape, type Infer } from './guards.ts';

// Result shapes of the severino-vault-mcp commands the plugin consumes. Only
// the fields the plugin reads are checked; extra fields pass through.

const projectSpec = { slug: isString, open: isNumber };
export type ProjectOption = Infer<typeof projectSpec>;

export const isProjectsResult = shape({
  ok: isBoolean,
  projects: optional(arrayOf(shape(projectSpec))),
});

export const isBrief = shape({
  ok: isBoolean,
  vault_doc_count: optional(isNumber),
  docs_to_review: optional(
    shape({
      count: isNumber,
      docs: arrayOf(shape({ doc_id: isString, title: isString, obsidian_path: isString, age_days: isNumber })),
    }),
  ),
  inbox: optional(shape({ count: isNumber })),
  tasks: optional(shape({ open: isNumber, stale: isNumber })),
});

// task-add, promote-note and update-frontmatter.
export const isWriteResult = shape({
  ok: isBoolean,
  doc_id: optional(isString),
  relative_path: optional(isString),
  error: optional(isString),
});

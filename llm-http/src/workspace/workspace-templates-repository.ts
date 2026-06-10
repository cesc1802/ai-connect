export interface TemplateRow {
  id: string;
  slug: string;
  title: string | null;
  category: string | null;
  icon: string | null;
  authorName: string | null;
  uses: number;
  description: string | null;
  body: string | null;
}

export interface TemplateCreateInput {
  slug: string;
  title: string;
  category: string;
  icon: string;
  authorName: string;
  description: string;
  body: string | null;
}

export interface TemplateUpdateInput {
  title?: string | undefined;
  category?: string | undefined;
  icon?: string | undefined;
  description?: string | undefined;
  body?: string | null | undefined;
}

export interface WorkspaceTemplatesRepository {
  /** List all templates in the org library. */
  listLibrary(): Promise<TemplateRow[]>;
  /** Create a library template. */
  createTemplate(input: TemplateCreateInput): Promise<TemplateRow>;
  /** Update a library template. Returns undefined when the id is unknown. */
  updateTemplate(id: string, input: TemplateUpdateInput): Promise<TemplateRow | undefined>;
  /**
   * Delete a library template. Returns false when the id is unknown.
   * Throws TemplateInUseError when the template is attached to a workspace.
   */
  deleteTemplate(id: string): Promise<boolean>;
  /** List templates attached to a specific workspace. */
  listForWorkspace(workspaceId: string): Promise<TemplateRow[]>;
  /** Attach a template to a workspace. Throws TemplateAlreadyAttachedError when already attached. */
  attach(workspaceId: string, templateId: string): Promise<boolean>;
  /** Detach a template from a workspace. Returns false when not attached. */
  detach(workspaceId: string, templateId: string): Promise<boolean>;
  /** True when the templateId exists in the prompt_templates table. */
  templateExists(templateId: string): Promise<boolean>;
}

/** Thrown by attach() when the template is already attached. */
export class TemplateAlreadyAttachedError extends Error {
  constructor(templateId: string, workspaceId: string) {
    super(`Template ${templateId} is already attached to workspace ${workspaceId}`);
    this.name = "TemplateAlreadyAttachedError";
  }
}

/** Thrown by deleteTemplate() when workspace attachments still reference the template. */
export class TemplateInUseError extends Error {
  constructor(templateId: string) {
    super(`Template ${templateId} is attached to one or more workspaces`);
    this.name = "TemplateInUseError";
  }
}

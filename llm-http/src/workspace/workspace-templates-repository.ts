export interface TemplateRow {
  id: string;
  slug: string;
  title: string | null;
  category: string | null;
  icon: string | null;
  authorName: string | null;
  uses: number;
  description: string | null;
}

export interface WorkspaceTemplatesRepository {
  /** List all templates in the org library. */
  listLibrary(): Promise<TemplateRow[]>;
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

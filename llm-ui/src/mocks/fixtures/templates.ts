import type { Template } from '@/schemas/template';

/**
 * Member-facing templates for `wsp_acme` (admin workspace in the demo org).
 * Covers UC-032 main + A3 (defaultModelId not assigned to the workspace).
 */
export const DEMO_WS_ACME_TEMPLATES: Template[] = [
  {
    id: 'tpl_ws_brand_voice',
    name: 'Brand Voice Reply',
    scope: 'workspace',
    body: 'Reply in our brand voice — friendly, concise, plain English.',
  },
  {
    id: 'tpl_ws_meeting_summary',
    name: 'Meeting Summary',
    scope: 'workspace',
    body: 'Summarize this meeting transcript into Decisions / Actions / Risks.',
  },
  {
    id: 'tpl_suggested_admin_okr',
    name: 'Quarterly OKR Draft',
    scope: 'suggested',
    role: 'admin',
    body: 'Draft 3 OKRs for the quarter from the notes below.',
  },
  {
    id: 'tpl_personal_daily_standup',
    name: 'Daily Standup',
    scope: 'personal',
    body: 'Yesterday / Today / Blockers, 3 bullets each.',
  },
  {
    id: 'tpl_personal_unassigned_model',
    name: 'Tone Lift',
    scope: 'personal',
    body: 'Rewrite to a confident, warmer tone without losing meaning.',
    defaultModelId: 'mdl_not_assigned_demo',
  },
];

/**
 * Member workspace fixture — exercises UC-032 A2 (role-empty suggested group).
 */
export const DEMO_WS_RESEARCH_TEMPLATES: Template[] = [
  {
    id: 'tpl_ws_research_brief',
    name: 'Research Brief',
    scope: 'workspace',
    body: 'Summarize the source into background / question / method / risks.',
  },
  // Note: no `scope: 'suggested'` with `role: 'member'` — keeps that group empty.
];

export const TEMPLATES_BY_WORKSPACE: Record<string, Template[]> = {
  wsp_acme: DEMO_WS_ACME_TEMPLATES,
  wsp_research: DEMO_WS_RESEARCH_TEMPLATES,
  wsp_personal: [],
};

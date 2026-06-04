import { useCallback } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { toast } from 'sonner';

import { useComposerDraftStore } from '@/stores/composer-draft-store';
import { useChatModelStore } from '@/stores/chat-model-store';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import { useWorkspaceResources } from '@/hooks/use-workspace-resources';
import type { Template } from '@/schemas/template';

/**
 * BR-108: opening a template seeds a NEW chat by default. If a chat is already
 * open, the template body is INSERTED into the active composer without
 * discarding the in-progress message. UC-032 A3: if the template's
 * defaultModelId is not assigned to the workspace, still apply the text but
 * surface a notice.
 */
export function useApplyTemplate() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { conversationId?: string };
  const push = useComposerDraftStore((s) => s.push);
  const workspaceId = useActiveWorkspaceStore((s) => s.activeWorkspaceId);
  const setModel = useChatModelStore((s) => s.setModel);
  const resourcesQuery = useWorkspaceResources(workspaceId);

  return useCallback(
    (template: Template) => {
      const inOpenChat = Boolean(params.conversationId);

      if (template.defaultModelId && workspaceId) {
        const assignedModelIds = new Set<string>();
        for (const provider of resourcesQuery.data?.providers ?? []) {
          for (const m of provider.models ?? []) {
            assignedModelIds.add(m.id);
          }
        }
        if (assignedModelIds.has(template.defaultModelId)) {
          // Best-effort default model — keep current providerId if we can find one.
          const provider = (resourcesQuery.data?.providers ?? []).find((p) =>
            (p.models ?? []).some((m) => m.id === template.defaultModelId),
          );
          if (provider) {
            setModel(workspaceId, {
              providerId: provider.id,
              modelId: template.defaultModelId,
            });
          }
        } else {
          toast.message(
            "This template's default model isn't assigned to this workspace. The text was applied; pick a model to send.",
          );
        }
      }

      if (inOpenChat) {
        push({ text: template.body, mode: 'insert' });
        return;
      }

      push({ text: template.body, mode: 'seed' });
      void navigate({ to: '/chat' });
    },
    [
      navigate,
      params.conversationId,
      push,
      resourcesQuery.data,
      setModel,
      workspaceId,
    ],
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatRail } from "@/components/chat/rail/chat-rail";
import { EmptyConversation } from "@/components/chat/rail/empty-conversation";
import { Composer } from "@/components/chat/composer";
import { ConversationHeader } from "@/components/chat/conversation-header";
import { MessageList } from "@/components/chat/message-list";
import { NewChatDialog } from "@/components/chat/new-chat-dialog";
import { SocketIndicator } from "@/components/chat/socket-indicator";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { useTransientChatError } from "@/hooks/use-transient-chat-error";
import { getToken, getWsUrl } from "@/lib/auth-token";
import { useChatStore } from "@/lib/chat-context";
import type { Msg } from "@/lib/chat-types";
import {
  getConversationMessages,
  listMyConversations,
  type ConversationSummary,
  type WireMessage,
} from "@/lib/conversations-api";
import { getMyDefaultModel } from "@/lib/my-default-model-api";
import { listMyWorkspaces, type MyWorkspace } from "@/lib/my-workspaces-api";
import { listAttachedTemplates, type PromptTemplate } from "@/lib/workspace-templates-api";

function toMsg(m: WireMessage): Msg {
  return { localId: m.id, role: m.role, text: m.content, toolCalls: [], status: "complete" };
}

function mostRecentIn(conversations: ConversationSummary[], wsId: string): ConversationSummary | undefined {
  return conversations
    .filter((c) => c.workspaceId === wsId)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

export function ChatScreen() {
  const [memberships, setMemberships] = useState<MyWorkspace[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [defaultModel, setDefaultModel] = useState<string | null>(null);
  const [activeWsId, setActiveWsId] = useState<string | null>(null);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  // Template picked for a not-yet-persisted conversation; the server creates
  // the conversation on first send.
  const [draftTemplateId, setDraftTemplateId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const token = useMemo(() => getToken(), []);
  const wsUrl = useMemo(() => getWsUrl(), []);
  const { state, dispatch } = useChatStore();

  const { send, abort, socketState } = useChatSocket({
    url: wsUrl,
    token,
    onConversationCreated: (conv) => {
      setConversations((cs) => [
        {
          id: conv.id,
          workspaceId: conv.workspaceId,
          title: conv.title ?? "",
          templateId: conv.templateId ?? null,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        },
        ...cs,
      ]);
      setActiveConvId(conv.id);
      setDraftTemplateId(null);
    },
  });

  const errorBanner = useTransientChatError(state.messages);

  // Guards against a slow history fetch landing after the user has already
  // switched to another conversation.
  const activeConvIdRef = useRef<string | null>(null);
  const openConversation = useCallback(
    (id: string) => {
      abort(); // no-op when idle — stops a stream left running in the previous thread
      setActiveConvId(id);
      setDraftTemplateId(null);
      activeConvIdRef.current = id;
      getConversationMessages(id)
        .then((msgs) => {
          if (activeConvIdRef.current !== id) return;
          dispatch({ type: "LOAD_HISTORY", messages: msgs.map(toMsg) });
        })
        .catch(() => {
          if (activeConvIdRef.current !== id) return;
          dispatch({ type: "LOAD_HISTORY", messages: [] });
        });
    },
    [abort, dispatch],
  );

  const clearThread = useCallback(() => {
    abort();
    activeConvIdRef.current = null;
    dispatch({ type: "LOAD_HISTORY", messages: [] });
  }, [abort, dispatch]);

  useEffect(() => {
    let cancelled = false;
    // allSettled: a failing default-model lookup must not blank the rail,
    // and vice versa — each slice degrades independently.
    Promise.allSettled([listMyWorkspaces(), listMyConversations(), getMyDefaultModel()])
      .then(([ws, convs, model]) => {
        if (cancelled) return;
        const memberships = ws.status === "fulfilled" ? ws.value : [];
        const conversations = convs.status === "fulfilled" ? convs.value : [];
        setMemberships(memberships);
        setConversations(conversations);
        if (model.status === "fulfilled") setDefaultModel(model.value);
        const first = memberships[0];
        if (first) {
          setActiveWsId(first.id);
          const recent = mostRecentIn(conversations, first.id);
          if (recent) openConversation(recent.id);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [openConversation]);

  useEffect(() => {
    if (!activeWsId) return;
    let cancelled = false;
    listAttachedTemplates(activeWsId)
      .then((list) => {
        if (!cancelled) setTemplates(list);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeWsId]);

  const templatesById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates]);
  const activeWorkspace = memberships.find((m) => m.id === activeWsId) ?? null;
  const activeConv = activeConvId ? conversations.find((c) => c.id === activeConvId) ?? null : null;
  const template = activeConv
    ? activeConv.templateId
      ? templatesById.get(activeConv.templateId)
      : undefined
    : draftTemplateId
      ? templatesById.get(draftTemplateId)
      : undefined;
  const title = activeConv
    ? activeConv.title || template?.title || "Trò chuyện"
    : template?.title ?? "Trò chuyện mới";

  function switchWorkspace(wsId: string) {
    setActiveWsId(wsId);
    setDraftTemplateId(null);
    const recent = mostRecentIn(conversations, wsId);
    if (recent) openConversation(recent.id);
    else {
      setActiveConvId(null);
      clearThread();
    }
  }

  function startChat(wsId: string, templateId: string) {
    setNewOpen(false);
    setActiveWsId(wsId);
    setActiveConvId(null);
    setDraftTemplateId(templateId);
    clearThread();
  }

  function handleSend(text: string) {
    if (!defaultModel) return;
    if (activeConvId) {
      send({ text, model: defaultModel, conversationId: activeConvId });
      setConversations((cs) => cs.map((c) => (c.id === activeConvId ? { ...c, updatedAt: Date.now() } : c)));
    } else if (activeWsId && draftTemplateId) {
      send({ text, model: defaultModel, workspaceId: activeWsId, templateId: draftTemplateId });
    }
  }

  if (!loading && memberships.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          Bạn chưa thuộc workspace nào. Hãy liên hệ quản trị viên để được thêm vào một workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {activeWorkspace && (
        <ChatRail
          memberships={memberships}
          activeWorkspace={activeWorkspace}
          conversations={conversations}
          templatesById={templatesById}
          activeConversationId={activeConvId}
          onSelectWorkspace={switchWorkspace}
          onSelectConversation={openConversation}
          onNewChat={() => setNewOpen(true)}
        />
      )}
      {newOpen && activeWorkspace && (
        <NewChatDialog workspace={activeWorkspace} onPick={startChat} onClose={() => setNewOpen(false)} />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {!activeWorkspace || (!activeConv && !draftTemplateId) ? (
          activeWorkspace && <EmptyConversation workspace={activeWorkspace} onNew={() => setNewOpen(true)} />
        ) : (
          <>
            <ConversationHeader title={title} workspace={activeWorkspace} template={template} />
            {!defaultModel && !loading && (
              <div className="border-b bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
                Chưa có model khả dụng — bật một provider có API key và model mặc định.
              </div>
            )}
            {errorBanner && (
              <div className="border-b bg-destructive/10 px-4 py-2 text-xs text-destructive">
                Lỗi từ máy chủ ({errorBanner.errorCode}): {errorBanner.errorMessage}
              </div>
            )}
            <div className="flex justify-end px-4 pt-2 empty:hidden">
              <SocketIndicator state={socketState} hasToken={!!token} />
            </div>
            <MessageList template={template} />
            <Composer
              workspace={activeWorkspace}
              template={template ?? null}
              templates={templates}
              templateRequired={!activeConv}
              canSend={!!defaultModel}
              socketState={socketState}
              onSend={handleSend}
              onPickTemplate={activeConv ? undefined : (id) => setDraftTemplateId(id)}
              onAbort={abort}
            />
          </>
        )}
      </div>
    </div>
  );
}

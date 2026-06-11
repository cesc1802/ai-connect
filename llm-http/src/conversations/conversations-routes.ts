import { Router } from "express";
import type {
  ConversationRepository,
  MessageRepository,
} from "@ai-connect/shared";

/**
 * Read-only `/conversations` resource for the chat screen:
 * - GET /            → caller's conversations, newest first
 * - GET /:id/messages → ordered messages of a conversation the caller owns
 */
export function createConversationsRoutes(
  convRepo: ConversationRepository,
  msgRepo: MessageRepository
): Router {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      if (!req.user) {
        res.status(401).json({
          code: "missing_token",
          message: "Authorization header required",
        });
        return;
      }

      const conversations = await convRepo.listByUser(req.user.id);
      res.json({
        conversations: conversations.map((c) => ({
          id: c.id,
          workspaceId: c.workspaceId,
          title: c.title ?? "",
          templateId: c.templateId ?? null,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id/messages", async (req, res, next) => {
    try {
      if (!req.user) {
        res.status(401).json({
          code: "missing_token",
          message: "Authorization header required",
        });
        return;
      }

      const conversation = await convRepo.get(req.params.id);
      if (!conversation) {
        res
          .status(404)
          .json({ code: "not_found", message: "Conversation not found" });
        return;
      }
      if (conversation.userId !== req.user.id) {
        res.status(403).json({ code: "forbidden", message: "Access denied" });
        return;
      }

      const messages = await msgRepo.listByConversation(conversation.id);
      res.json({
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

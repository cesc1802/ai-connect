import { Router } from "express";
import { z } from "zod";
import type { AppContainer } from "../container.js";

const bodySchema = z.object({
  model: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system", "tool"]),
        content: z.union([z.string(), z.array(z.any())]),
      })
    )
    .min(1),
  maxTokens: z.number().int().positive().max(8192).default(4096),
  temperature: z.number().min(0).max(2).optional(),
});

export function createChatRestRoutes(container: AppContainer): Router {
  const router = Router();

  router.post("/", async (req, res, next) => {
    const parsed = bodySchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        code: "invalid_body",
        message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
      return;
    }

    try {
      const { model, messages, maxTokens, temperature } = parsed.data;
      const chatRequest = { model, messages, maxTokens, ...(temperature !== undefined && { temperature }) };
      const response = await container.oneShotChatUseCase.execute(chatRequest);
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

import type { Instrumentation } from "next";

/**
 * Every uncaught server error (route handlers, server components, server
 * actions) lands here. Forwards it to Telegram — see lib/notify/telegram.ts.
 * Node runtime only; the alert helper uses server-only env.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { notifyCaught } = await import("@/lib/notify/telegram");
  await notifyCaught(`server ${context.routeType}`, err, {
    yol: `${request.method} ${request.path.split("?")[0]}`,
    rota: context.routePath,
    digest: (err as { digest?: string }).digest,
  });
};

import { createFileRoute } from "@tanstack/react-router";
import { runCollection, SUPPORTED_SOURCES, isSourceReady } from "@/lib/collector.server";
import { getQuestions, getSettings, createCollectionRun, updateCollectionRun } from "@/lib/geo.server";

export const Route = createFileRoute("/api/public/collect")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["COLLECT_CRON_SECRET"];
        const provided = request.headers.get("x-cron-secret");

        if (!expected || provided !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) {
          return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const [settings, questions] = await Promise.all([
          getSettings(supabaseAdmin),
          getQuestions(supabaseAdmin),
        ]);

        const activeSourceIds = SUPPORTED_SOURCES.filter(
          (s) => settings[`source_${s.id}`] === "true" && isSourceReady(s),
        ).map((s) => s.id);

        if (activeSourceIds.length === 0) {
          return Response.json({ ok: true, message: "No active sources" });
        }

        const runId = await createCollectionRun(supabaseAdmin, questions.length);

        // Fire-and-forget collection; cron callers don't need to wait
        runCollection(supabaseAdmin, key, activeSourceIds, runId).catch((err) => {
          console.error("Cron collection failed", err);
          updateCollectionRun(supabaseAdmin, runId, {
            status: "failed",
            finished_at: new Date().toISOString(),
            logs: [`cron collection failed: ${err instanceof Error ? err.message : String(err)}`],
          }).catch(() => {});
        });

        return Response.json({ ok: true, runId, sources: activeSourceIds, totalQuestions: questions.length });
      },
    },
  },
});

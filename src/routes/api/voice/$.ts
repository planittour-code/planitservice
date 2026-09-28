import { createFileRoute } from "@tanstack/react-router";
import { bookSlot, listOpenSlots, notifyOwnerTransfer, openProjectLead } from "@/lib/housefile/booking";

/**
 * Tools for the existing Grok voice agent.
 * The agent keeps its voice and transfer. These endpoints are the calendar and the file.
 *
 * Auth: Authorization: Bearer <VOICE_AGENT_SECRET>
 *   POST /api/voice/check_availability   {}
 *   POST /api/voice/book_appointment     { start, service, name, email, phone?, address? }
 *   POST /api/voice/start_project        { name, email, phone?, addressLine, city?, state?, zip?, workId }
 *   POST /api/voice/transfer_to_owner    { callerName, callerPhone, note }
 */

function authorized(request: Request) {
  const secret = process.env.VOICE_AGENT_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function readJson(request: Request) {
  try {
    return (await request.json()) as Record<string, string>;
  } catch {
    return {};
  }
}

export const Route = createFileRoute("/api/voice/$")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!authorized(request)) {
          return Response.json({ error: "Voice agent secret required." }, { status: 401 });
        }
        const tool = params._splat ?? "";
        const body = await readJson(request);
        try {
          if (tool === "check_availability") {
            const data = await listOpenSlots();
            return Response.json({
              calendar: data.calendar,
              googleConnected: data.googleConnected,
              slots: data.slots.map((slot) => ({
                start: slot.start,
                end: slot.end,
                say: slot.label,
              })),
            });
          }
          if (tool === "book_appointment") {
            const booked = await bookSlot({
              start: body.start ?? "",
              service: body.service || "cleaning",
              name: body.name ?? "",
              email: body.email ?? "",
              phone: body.phone,
              address: body.address,
              source: "voice",
            });
            return Response.json({
              ...booked,
              say: `You're booked for ${booked.when}. Confirmation ${booked.confirmationCode}.`,
            });
          }
          if (tool === "start_project") {
            const opened = await openProjectLead({
              name: body.name ?? "",
              email: body.email ?? "",
              phone: body.phone,
              addressLine: body.addressLine || body.address || "",
              city: body.city,
              state: body.state,
              zip: body.zip,
              workId: body.workId || "gutters",
              source: "voice",
            });
            return Response.json(opened);
          }
          if (tool === "transfer_to_owner") {
            const sent = await notifyOwnerTransfer({
              callerName: body.callerName || body.name || "",
              callerPhone: body.callerPhone || body.phone || "",
              note: body.note || "",
            });
            return Response.json(sent);
          }
          return Response.json({ error: "Unknown tool." }, { status: 404 });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not complete that.";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});

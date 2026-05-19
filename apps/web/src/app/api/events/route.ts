import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  // Create a ReadableStream that generates SSE
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial heartbeat
      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: ${JSON.stringify({ status: "ok" })}\n\n`,
        ),
      );

      // Simulate a heartbeat every 5 seconds
      const interval = setInterval(() => {
        const payload = JSON.stringify({ timestamp: new Date().toISOString() });
        controller.enqueue(
          encoder.encode(`event: heartbeat\ndata: ${payload}\n\n`),
        );
      }, 5000);

      // Clean up when the client disconnects
      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable NGINX buffering if applicable
    },
  });
}

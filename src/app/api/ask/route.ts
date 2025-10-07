import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    const isMultipart = contentType.includes("multipart/form-data");
    const isJson = contentType.includes("application/json");
    console.log(`[next-api] /api/ask called contentType=${contentType} isMultipart=${isMultipart} isJson=${isJson}`);

    // Check if streaming is requested
    let shouldStream = false;
    let backendUrl = env.BACKEND_API_URL;
    
    if (isJson) {
      const body = await req.json().catch(() => ({}));
      shouldStream = body.stream === true;
      
      // Use the streaming agent endpoint if streaming is requested
      if (shouldStream) {
        // The agent streaming endpoint is mounted at /agent
        backendUrl = env.BACKEND_API_URL.replace('/ask', '/agent/');
        console.log(`[next-api] streaming requested, using agent endpoint: ${backendUrl}`);
        
        // Format the request for the agent endpoint
        const agentRequest = {
          toolsQuery: body.query,
          messages: [{ role: "user", content: body.query }],
          chatSettings: {}
        };
        
        // Use fetch with extended timeout for streaming
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes timeout
        
        try {
          const backendResponse = await fetch(backendUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(agentRequest),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!backendResponse.ok) {
            console.log(`[next-api] backend error: ${backendResponse.status}`);
            return NextResponse.json(
              { error: backendResponse.statusText },
              { status: backendResponse.status }
            );
          }

          // Create a custom ReadableStream to properly forward SSE
          const reader = backendResponse.body?.getReader();
          if (!reader) {
            throw new Error("No reader available from backend");
          }

          const stream = new ReadableStream({
            async start(controller) {
              const decoder = new TextDecoder();
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) {
                    console.log(`[next-api] stream completed`);
                    controller.close();
                    break;
                  }
                  
                  // Decode and immediately forward the chunk
                  const chunk = decoder.decode(value, { stream: true });
                  console.log(`[next-api] forwarding chunk: ${chunk.substring(0, 100)}...`);
                  controller.enqueue(new TextEncoder().encode(chunk));
                }
              } catch (error) {
                console.error(`[next-api] stream error:`, error);
                controller.error(error);
              }
            },
          });

          // Stream the response back to the client
          console.log(`[next-api] streaming response from backend`);
          return new NextResponse(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
              "X-Accel-Buffering": "no",
            },
          });
        } catch (error) {
          clearTimeout(timeoutId);
          if ((error as Error).name === 'AbortError') {
            console.log(`[next-api] request timeout after 10 minutes`);
            return NextResponse.json(
              { error: "Request timeout" },
              { status: 504 }
            );
          }
          throw error;
        }
      }
      
      // Non-streaming JSON request
      console.log(`[next-api] forwarding json to ${env.BACKEND_API_URL}`, body);
      const backendResponse = await fetch(env.BACKEND_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const backendContentType = backendResponse.headers.get("content-type") || "";
      const backendIsJson = backendContentType.includes("application/json");

      if (!backendResponse.ok) {
        const payload = backendIsJson ? await backendResponse.json().catch(() => undefined) : await backendResponse.text().catch(() => undefined);
        console.log(`[next-api] backend error:`, payload);
        return NextResponse.json(
          { error: typeof payload === "string" ? payload : payload || backendResponse.statusText },
          { status: backendResponse.status }
        );
      }

      if (backendIsJson) {
        const data = await backendResponse.json();
        console.log(`[next-api] returning json data:`, data);
        return NextResponse.json(data);
      }

      const text = await backendResponse.text();
      console.log(`[next-api] backend returned non-json text:`, text);
      return new NextResponse(text, { headers: { "content-type": "text/plain" } });
    }
    
    // Handle multipart form data (file uploads)
    if (isMultipart) {
      const formData = await req.formData();
      console.log(`[next-api] forwarding multipart to ${env.BACKEND_API_URL}`);
      const backendResponse = await fetch(env.BACKEND_API_URL, {
        method: "POST",
        body: formData as unknown as BodyInit,
      });

      const backendContentType = backendResponse.headers.get("content-type") || "";
      const backendIsJson = backendContentType.includes("application/json");

      if (!backendResponse.ok) {
        const payload = backendIsJson ? await backendResponse.json().catch(() => undefined) : await backendResponse.text().catch(() => undefined);
        console.log(`[next-api] backend error:`, payload);
        return NextResponse.json(
          { error: typeof payload === "string" ? payload : payload || backendResponse.statusText },
          { status: backendResponse.status }
        );
      }

      if (backendIsJson) {
        const data = await backendResponse.json();
        console.log(`[next-api] returning json data:`, data);
        return NextResponse.json(data);
      }

      const text = await backendResponse.text();
      return new NextResponse(text, { headers: { "content-type": "text/plain" } });
    }

    // Fallback: stream raw body
    console.log(`[next-api] forwarding raw body to ${env.BACKEND_API_URL}`);
    const backendResponse = await fetch(env.BACKEND_API_URL, {
      method: "POST",
      headers: { "content-type": contentType },
      body: req.body as unknown as BodyInit,
    });

    const backendContentType = backendResponse.headers.get("content-type") || "";
    const backendIsJson = backendContentType.includes("application/json");

    if (!backendResponse.ok) {
      const payload = backendIsJson ? await backendResponse.json().catch(() => undefined) : await backendResponse.text().catch(() => undefined);
      console.log(`[next-api] backend error:`, payload);
      return NextResponse.json(
        { error: typeof payload === "string" ? payload : payload || backendResponse.statusText },
        { status: backendResponse.status }
      );
    }

    if (backendIsJson) {
      const data = await backendResponse.json();
      return NextResponse.json(data);
    }

    const text = await backendResponse.text();
    return new NextResponse(text, { headers: { "content-type": "text/plain" } });
  } catch (error) {
    console.error(`[next-api] error:`, error);
    return NextResponse.json({ error: (error as Error).message || "Unknown error" }, { status: 500 });
  }
}

// proxies to your backend RAG/scraping service
"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { askRag } from "@/features/rag/lib/client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAgentSteps } from "@/features/rag/hooks/use-agent-steps";

type Props = {
  onResult: (answer: string) => void;
  onLoadingChange?: (loading: boolean) => void;
};

export default function SearchForm({ onResult, onLoadingChange }: Props) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const { resetSteps, setAgentSteps } = useAgentSteps();
  
  useEffect(() => setMounted(true), []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    onLoadingChange?.(true);
    
    // Reset steps at the beginning of a new query
    resetSteps();
    
    try {
      // Check if we should use streaming (when calling the agent endpoint)
      const shouldStream = files.length === 0; // Stream only when no files
      
      if (shouldStream) {
        // Use streaming to get real-time steps from the agent
        await handleStreamingRequest(query);
      } else {
        // Use regular request for file uploads
        const res = await askRag({ query, files });
        onResult(res.answer);
      }
    } catch (err) {
      setError((err as Error).message || "Request failed");
    } finally {
      onLoadingChange?.(false);
    }
  }

  async function handleStreamingRequest(userQuery: string) {
    try {
      // Call the agent API endpoint with streaming
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          query: userQuery,
          stream: true // Indicate we want streaming
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      let finalResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode the chunk
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const jsonString = line.slice(6).trim();
              if (jsonString) {
                const data = JSON.parse(jsonString);

                // Handle steps from the agent
                if (data.steps && data.steps.length > 0) {
                  setAgentSteps(prev => [...prev, ...data.steps]);
                }

                // Handle final response
                if (data.response) {
                  finalResponse = data.response;
                }
              }
            } catch (parseError) {
              console.error("JSON parsing error:", parseError);
            }
          }
        }
      }

      // Set the final answer
      if (finalResponse) {
        onResult(finalResponse);
      }
    } catch (err) {
      throw err;
    }
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex w-full flex-1 items-center gap-3">
        <div className="relative flex-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask your question..."
            aria-label="Query"
            className="pr-12"
          />

          {mounted ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                aria-label="Files"
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                className="hidden"
              />
              <button
                type="button"
                aria-label="Attach files"
                title={files.length ? `${files.length} file${files.length > 1 ? "s" : ""} selected` : "Attach files"}
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-y-0 right-2 my-auto flex h-8 w-8 items-center justify-center rounded-md text-foreground/60 hover:bg-foreground/10 hover:text-foreground/80"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </button>
            </>
          ) : null}
        </div>

        <Button type="submit" disabled={!query.trim() && files.length === 0}>Ask</Button>
      </div>

      {/* Display uploaded files */}
      {files.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md border border-foreground/15 bg-background/50 p-3">
          <div className="text-xs font-medium text-foreground/70">
            {files.length} file{files.length > 1 ? 's' : ''} selected:
          </div>
          <div className="flex flex-col gap-1.5">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-2 rounded-md bg-foreground/5 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-foreground/60">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span className="truncate text-foreground/80">{file.name}</span>
                  <span className="text-xs text-foreground/50 flex-shrink-0">
                    ({formatFileSize(file.size)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  aria-label={`Remove ${file.name}`}
                  className="flex-shrink-0 rounded-md p-1 text-foreground/50 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error ? <div className="text-sm text-red-500">{error}</div> : null}
    </form>
  );
}



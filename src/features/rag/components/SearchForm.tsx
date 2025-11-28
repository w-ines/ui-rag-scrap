"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAgentSteps } from "@/features/rag/hooks/use-agent-steps";

type Props = {
  onResult: (answer: string) => void;
  onLoadingChange?: (loading: boolean) => void;
};

export default function SearchForm({ onResult, onLoadingChange }: Props) {
  // ============================================================================
  // STATE LOCAL
  // ============================================================================
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mounted, setMounted] = useState(false);
  
  // Hook pour gérer les steps de l'agent (affichage en temps réel)
  const { resetSteps, addStep, updateSteps, finishDisplaying } = useAgentSteps();
  
  // S'assure que le composant est monté côté client (évite les erreurs SSR)
  useEffect(() => setMounted(true), []);

  // ============================================================================
  // FONCTION PRINCIPALE : Soumission du formulaire
  // ============================================================================
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    onLoadingChange?.(true);
    
    // Reset les steps affichés avant de commencer une nouvelle requête
    resetSteps();
    
    try {
      const hasFiles = files.length > 0;
      
      if (hasFiles) {
        // CAS 1: Avec fichiers → Streaming pour voir l'upload + indexation
        console.log("[SearchForm] Mode: Upload + RAG avec streaming");
        await handleStreamingWithFiles(query, files);
      } else {
        // CAS 2: Sans fichiers → Streaming aussi (backend retourne NDJSON)
        console.log("[SearchForm] Mode: Web search avec streaming");
        await handleStreamingJsonQuery(query);
      }
    } catch (err) {
      console.error("[SearchForm] Error:", err);
      setError((err as Error).message || "Request failed");
    } finally {
      onLoadingChange?.(false);
    }
  }

  // ============================================================================
  // CAS 1: STREAMING POUR REQUÊTE JSON (sans fichiers)
  // ============================================================================
  async function handleStreamingJsonQuery(userQuery: string) {
    try {
      console.log("[SearchForm] Sending JSON query with streaming...");
      
      // Appel API avec Content-Type JSON
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: userQuery }),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      // Le backend retourne maintenant du NDJSON pour tout
      const contentType = response.headers.get("content-type") || "";
      console.log("[SearchForm] Response content-type:", contentType);

      // Le backend retourne toujours du NDJSON maintenant
      if (contentType.includes("application/x-ndjson")) {
        await handleNDJSONStream(response);
      } else {
        // Fallback pour compatibilité (ne devrait plus arriver)
        const data = await response.json();
        console.log("[SearchForm] Fallback JSON response:", data);
        
        if (data.steps && Array.isArray(data.steps)) {
          updateSteps(data.steps);
        }
        if (data.answer) {
          onResult(data.answer);
        }
      }
      
    } catch (err) {
      console.error("[SearchForm] Streaming JSON request error:", err);
      throw err;
    }
  }

  // ============================================================================
  // CAS 2: STREAMING (avec fichiers uploadés)
  // ============================================================================
  async function handleStreamingWithFiles(userQuery: string, uploadFiles: File[]) {
    try {
      // Prépare le FormData avec query + fichiers
      const formData = new FormData();
      formData.append("query", userQuery);
      for (const file of uploadFiles) {
        formData.append("files", file);
      }

      console.log("[SearchForm] Sending multipart with streaming...");

      // Appel API avec streaming
      const response = await fetch("/api/ask", {
        method: "POST",
        body: formData,
        // Pas de Content-Type ici, le browser le gère automatiquement
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      // Vérifie le type de réponse
      const contentType = response.headers.get("content-type") || "";
      console.log("[SearchForm] Response content-type:", contentType);

      // Si c'est du NDJSON (streaming), on lit ligne par ligne
      if (contentType.includes("application/x-ndjson") || contentType.includes("text/event-stream")) {
        await handleNDJSONStream(response);
      } else {
        // Sinon, c'est une réponse JSON classique
        const data = await response.json();
        console.log("[SearchForm] Regular JSON response:", data);
        
        if (data.steps) {
          updateSteps(data.steps);
        }
        if (data.answer) {
          onResult(data.answer);
        }
      }
      
    } catch (err) {
      console.error("[SearchForm] Streaming request error:", err);
      throw err;
    }
  }

  // ============================================================================
  // LECTURE DU STREAM NDJSON (newline-delimited JSON)
  // ============================================================================
  async function handleNDJSONStream(response: Response) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No reader available");

    const decoder = new TextDecoder();
    let buffer = ""; // Buffer pour les lignes incomplètes
    let finalAnswer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("[SearchForm] Stream completed");
          break;
        }

        // Décode le chunk et ajoute au buffer
        buffer += decoder.decode(value, { stream: true });

        // Traite toutes les lignes complètes dans le buffer
        const lines = buffer.split("\n");
        
        // Garde la dernière ligne incomplète dans le buffer
        buffer = lines.pop() || "";

        // Parse chaque ligne complète
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue; // Skip les lignes vides

          try {
            // Handle SSE format: "data: {...}" - strip prefix if present (v2)
            let jsonStr = trimmedLine;
            console.log("[SearchForm] Raw line:", trimmedLine.substring(0, 50));
            if (trimmedLine.startsWith('data:')) {
              jsonStr = trimmedLine.slice(5).trim();
              console.log("[SearchForm] Stripped to:", jsonStr.substring(0, 50));
            }
            
            // Skip if not valid JSON (e.g., just "data:" without content, or empty)
            if (!jsonStr || jsonStr === "") continue;
            
            const data = JSON.parse(jsonStr);
            console.log("[SearchForm] Received chunk:", data);

            // TRAITEMENT DES DIFFÉRENTS TYPES DE MESSAGES

            // 1. Steps progressifs (pendant l'upload/indexation)
            if (data.step && typeof data.step === "string") {
              console.log("[SearchForm] Adding step:", data.step);
              addStep(data.step);
            }

            // 2. Erreur - handle gracefully without throwing
            if (data.error) {
              const errorMessage = typeof data.error === 'string' 
                ? data.error 
                : (typeof data.error === 'boolean' 
                    ? 'An unknown error occurred' 
                    : JSON.stringify(data.error));
              console.error("[SearchForm] Stream error:", errorMessage);
              console.error("[SearchForm] Full error data:", data);
              // Set error as the final answer instead of throwing
              finishDisplaying();
              finalAnswer = `❌ Error: ${errorMessage}`;
              // Don't throw - continue to display the error gracefully
              break; // Exit the parsing loop
            }

            // 3. Steps de l'agent (array avec un ou plusieurs steps)
            if (data.steps && Array.isArray(data.steps)) {
              console.log("[SearchForm] Received steps:", data.steps);
              // Add each step individually for progressive display
              data.steps.forEach((step: unknown) => {
                if (step && typeof step === "string") {
                  addStep(step);
                }
              });
            }

            // 4. Réponse finale
            if (data.response && !data.error) {
              finalAnswer = data.response;
              console.log("[SearchForm] Final response received:", finalAnswer.substring(0, 100));
            }
            
            // Legacy support for "answer" field
            if (data.answer) {
              finalAnswer = data.answer;
              console.log("[SearchForm] Final answer received:", finalAnswer.substring(0, 100));
            }

          } catch (parseError) {
            console.warn("[SearchForm] Failed to parse line:", line, parseError);
            // Continue avec la ligne suivante
          }
        }
      }

      // Affiche la réponse finale
      if (finalAnswer) {
        finishDisplaying(); // Stop showing "Agent is thinking..."
        onResult(finalAnswer);
      } else {
        console.warn("[SearchForm] No final answer received from stream");
      }

    } catch (err) {
      console.error("[SearchForm] Stream reading error:", err);
      // Don't re-throw - set error as final answer
      finishDisplaying();
      const errorMsg = (err as Error).message || "Stream reading failed";
      onResult(`❌ Error: ${errorMsg}`);
      return; // Exit gracefully
    }
  }

  // ============================================================================
  // GESTION DES FICHIERS
  // ============================================================================
  
  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {/* Input Query + Bouton Attach */}
      <div className="flex w-full flex-1 items-center gap-3">
        <div className="relative flex-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask your question..."
            aria-label="Query"
            className="pr-12"
          />

          {/* Bouton pour attacher des fichiers (seulement côté client) */}
          {mounted ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt"
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
                {/* Icône de trombone */}
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </button>
            </>
          ) : null}
        </div>

        {/* Bouton Submit */}
        <Button type="submit" disabled={!query.trim() && files.length === 0}>
          Ask
        </Button>
      </div>

      {/* Liste des fichiers sélectionnés */}
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
                  {/* Icône fichier */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-foreground/60">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span className="truncate text-foreground/80">{file.name}</span>
                  <span className="text-xs text-foreground/50 flex-shrink-0">
                    ({formatFileSize(file.size)})
                  </span>
                </div>
                {/* Bouton supprimer */}
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

      {/* Affichage des erreurs */}
      {error ? (
        <div className="rounded-md border border-red-500/20 bg-red-50/50 dark:bg-red-950/20 p-3 text-sm text-red-600 dark:text-red-400">
          ❌ {error}
        </div>
      ) : null}
    </form>
  );
}
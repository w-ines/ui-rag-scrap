"use client";

import { useState } from "react";
import SearchForm from "@/features/rag/components/SearchForm";
import Result from "@/features/rag/components/Result";
import AgentStepsDisplay from "@/features/rag/components/AgentStepsDisplay";
import { AgentStepsProvider } from "@/features/rag/hooks/use-agent-steps";

export default function RagPageContent() {
  const [answer, setAnswer] = useState<string>("");
  const [loading, setLoading] = useState(false);

  return (
    <AgentStepsProvider>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SearchForm onResult={setAnswer} onLoadingChange={setLoading} />
        <AgentStepsDisplay />
        <Result answer={answer} loading={loading} />
      </div>
    </AgentStepsProvider>
  );
}



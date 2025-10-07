import RagPageContent from "@/components/RagPageContent";

export default function Page() {
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: 16 }}>
      <h1 style={{ marginTop: 0 }}>RAG Query</h1>
      <RagPageContent />
    </main>
  );
}

//renders your input + button and displays results.
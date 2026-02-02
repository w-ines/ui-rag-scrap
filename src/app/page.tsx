import RagPageContent from "@/components/RagPageContent";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-10%] h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-blue-500/20 blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] h-[32rem] w-[32rem] rounded-full bg-purple-500/10 blur-3xl"></div>
      </div>

      <section className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Agent Assistant</h1>
        <p className="max-w-2xl text-balance text-sm text-foreground/70 sm:text-base">
            Ask a precise question for better results.
        </p>
      </section>

      <section className="mx-auto w-full max-w-3xl px-6 pb-24">
        <div className="rounded-2xl border border-foreground/10 bg-background/60 p-6 shadow-xl backdrop-blur-md sm:p-8">
          <RagPageContent />
        </div>

      </section>
    </main>
  );
}

// Désactiver le SSR pour éviter les problèmes avec File API
export const dynamic = 'force-dynamic';

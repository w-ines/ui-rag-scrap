type Props = {
  answer?: string;
  loading?: boolean;
};

export default function Result({ answer, loading }: Props) {
  if (loading) {
    return (
      <div className="mt-4 text-sm text-foreground/70">
        <div className="inline-flex items-center gap-2">
          <span className="h-2 w-2 animate-ping rounded-full bg-blue-500"></span>
          <span>Generating answer…</span>
        </div>
      </div>
    );
  }
  if (!answer) {
    return (
      <div className="mt-4 text-xs text-foreground/50">
        {/* Tip: ask a precise question for better results. */}
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-lg border border-foreground/10 bg-background/60 p-4">
      <h3 className="mb-2 text-sm font-semibold">Answer</h3>
      <div className="whitespace-pre-wrap text-sm leading-relaxed">
        {answer}
      </div>
    </div>
  );
}



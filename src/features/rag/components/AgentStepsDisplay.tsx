"use client";

import { useAgentSteps } from "@/features/rag/hooks/use-agent-steps";
import { ReactNode } from "react";

// Simple markdown-like renderer without external dependencies
function MarkdownRenderer({ content }: { content: string }) {
  // Parse simple markdown patterns
  const renderContent = (text: string) => {
    const parts: ReactNode[] = [];
    let currentIndex = 0;
    let key = 0;

    // Match **bold** text
    const boldRegex = /\*\*(.+?)\*\*/g;
    // Match `code` text
    const codeRegex = /`([^`]+)`/g;
    // Match code blocks ```language\ncode\n```
    const codeBlockRegex = /```(\w+)?\n([\s\S]+?)\n```/g;

    // First, handle code blocks
    let match;
    const codeBlocks: Array<{ start: number; end: number; content: string; language?: string }> = [];
    while ((match = codeBlockRegex.exec(text)) !== null) {
      codeBlocks.push({
        start: match.index,
        end: match.index + match[0].length,
        language: match[1],
        content: match[2]
      });
    }

    // Process text with inline formatting
    const processInline = (str: string, startKey: number) => {
      const elements: ReactNode[] = [];
      let lastIndex = 0;
      let localKey = startKey;

      // Combine bold and code patterns
      const combinedRegex = /(\*\*(.+?)\*\*)|(`([^`]+)`)/g;
      let inlineMatch;

      while ((inlineMatch = combinedRegex.exec(str)) !== null) {
        // Add text before match
        if (inlineMatch.index > lastIndex) {
          elements.push(str.substring(lastIndex, inlineMatch.index));
        }

        if (inlineMatch[2]) {
          // Bold text
          elements.push(
            <strong key={`bold-${localKey++}`} className="font-semibold text-foreground">
              {inlineMatch[2]}
            </strong>
          );
        } else if (inlineMatch[4]) {
          // Inline code
          elements.push(
            <code key={`code-${localKey++}`} className="rounded bg-gray-200 dark:bg-gray-800 px-1 py-0.5 text-xs">
              {inlineMatch[4]}
            </code>
          );
        }

        lastIndex = inlineMatch.index + inlineMatch[0].length;
      }

      // Add remaining text
      if (lastIndex < str.length) {
        elements.push(str.substring(lastIndex));
      }

      return elements.length > 0 ? elements : str;
    };

    // Process text with code blocks
    if (codeBlocks.length > 0) {
      codeBlocks.forEach((block, idx) => {
        // Add text before code block
        if (block.start > currentIndex) {
          const textBefore = text.substring(currentIndex, block.start);
          parts.push(
            <span key={`text-${key++}`}>
              {processInline(textBefore, key)}
            </span>
          );
        }

        // Add code block
        parts.push(
          <pre key={`block-${key++}`} className="mt-2 overflow-x-auto rounded bg-gray-900 p-2 text-xs">
            <code className="text-gray-100">{block.content}</code>
          </pre>
        );

        currentIndex = block.end;
      });

      // Add remaining text
      if (currentIndex < text.length) {
        const textAfter = text.substring(currentIndex);
        parts.push(
          <span key={`text-${key++}`}>
            {processInline(textAfter, key)}
          </span>
        );
      }
    } else {
      // No code blocks, just process inline
      return <>{processInline(text, 0)}</>;
    }

    return <>{parts}</>;
  };

  return <div className="whitespace-pre-wrap">{renderContent(content)}</div>;
}

export default function AgentStepsDisplay() {
  const { agentSteps, isDisplayingSteps } = useAgentSteps();

  if (agentSteps.length === 0 && !isDisplayingSteps) {
    return null;
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">
          🤖 Agent Reasoning Steps
        </h3>
        {agentSteps.length > 0 && (
          <span className="text-xs text-foreground/60">
            {agentSteps.length} step{agentSteps.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {agentSteps.map((step, index) => (
          <div
            key={index}
            className="animate-fadeIn rounded-lg border border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20 p-3 text-sm transition-all hover:border-blue-500/40"
          >
            <div className="flex items-start gap-2">
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400 mt-0.5">
                #{index + 1}
              </span>
              <div className="flex-1">
                <MarkdownRenderer content={step} />
              </div>
            </div>
          </div>
        ))}
        {isDisplayingSteps && (
          <div className="flex items-center gap-2 text-xs text-foreground/60 px-3 py-2">
            <span className="h-2 w-2 animate-ping rounded-full bg-blue-500"></span>
            <span>Agent is thinking...</span>
          </div>
        )}
      </div>
    </div>
  );
}

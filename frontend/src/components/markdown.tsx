"use client";

import ReactMarkdown from "react-markdown";

interface MarkdownProps {
  content: string;
  className?: string;
  mentions?: string[];  // Valid mentions to highlight
}

function processMentions(content: string, mentions: string[] = []): string {
  if (!mentions.length) return content;
  
  // Only highlight @mentions that are in the valid mentions list
  // Replace @validName with a styled span (using markdown link syntax)
  let processed = content;
  for (const name of mentions) {
    // Use a special marker that won't be escaped by markdown
    const regex = new RegExp(`@${name}\\b`, 'g');
    processed = processed.replace(regex, `**[@${name}](/u/${name})**`);
  }
  return processed;
}

export function Markdown({ content, className = "", mentions = [] }: MarkdownProps) {
  const processedContent = processMentions(content, mentions);
  
  return (
    <div className={`prose prose-invert prose-sm max-w-none ${className}`}>
      <ReactMarkdown
        components={{
          // Style overrides for dark theme
          h1: ({ children }) => <h1 className="text-xl font-bold text-white mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-semibold text-white mt-3 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-medium text-white mt-2 mb-1">{children}</h3>,
          p: ({ children }) => <p className="text-zinc-300 mb-3 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside text-zinc-300 mb-3 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside text-zinc-300 mb-3 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-zinc-300">{children}</li>,
          a: ({ href, children }) => (
            <a href={href} className="text-red-400 hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          code: ({ className, children }) => {
            const isInline = !className;
            if (isInline) {
              return <code className="bg-zinc-800 text-red-300 px-1.5 py-0.5 rounded text-sm">{children}</code>;
            }
            return (
              <code className="block bg-zinc-800 p-3 rounded-lg overflow-x-auto text-sm text-zinc-300">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="bg-zinc-800 p-3 rounded-lg overflow-x-auto mb-3">{children}</pre>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-red-500 pl-4 text-zinc-400 italic my-3">
              {children}
            </blockquote>
          ),
          strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
          em: ({ children }) => <em className="text-zinc-300 italic">{children}</em>,
          hr: () => <hr className="border-zinc-700 my-4" />,
          table: ({ children }) => (
            <div className="overflow-x-auto mb-3">
              <table className="min-w-full border border-zinc-700 text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border border-zinc-700 px-3 py-2 bg-zinc-800 text-white">{children}</th>,
          td: ({ children }) => <td className="border border-zinc-700 px-3 py-2 text-zinc-300">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

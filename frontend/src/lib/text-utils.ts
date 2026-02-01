/**
 * Strip markdown formatting from text for preview display.
 */
export function stripMarkdown(text: string): string {
  return text
    // Remove headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '[code]')
    .replace(/`([^`]+)`/g, '$1')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Remove list markers
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Collapse multiple newlines
    .replace(/\n{2,}/g, ' ')
    // Collapse multiple spaces
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Truncate text to a maximum length with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Get a clean preview of markdown content.
 */
export function getPreview(content: string, maxLength: number = 150): string {
  return truncate(stripMarkdown(content), maxLength);
}

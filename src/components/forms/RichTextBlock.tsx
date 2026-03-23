"use client";

import { useMemo } from "react";

interface RichTextBlockProps {
  text: string;
  className?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function applyInlineMarkdown(raw: string): string {
  let output = escapeHtml(raw);

  // Bold: **text** or __text__
  output = output.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // Italic: *text* or _text_
  output = output.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  output = output.replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");

  return output;
}

function markdownToHtml(markdown: string): string {
  const normalized = markdown.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return "";

  const lines = normalized.split("\n");
  const chunks: string[] = [];
  let index = 0;

  while (index < lines.length) {
    if (!lines[index].trim()) {
      index += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(lines[index])) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        const item = lines[index].replace(/^\s*[-*]\s+/, "");
        items.push(`<li>${applyInlineMarkdown(item.trim())}</li>`);
        index += 1;
      }
      chunks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(lines[index])) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        const item = lines[index].replace(/^\s*\d+\.\s+/, "");
        items.push(`<li>${applyInlineMarkdown(item.trim())}</li>`);
        index += 1;
      }
      chunks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^\s*[-*]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index])
    ) {
      paragraphLines.push(lines[index].trimEnd());
      index += 1;
    }

    chunks.push(
      `<p>${paragraphLines.map((line) => applyInlineMarkdown(line)).join("<br />")}</p>`
    );
  }

  return chunks.join("");
}

export function RichTextBlock({ text, className = "" }: RichTextBlockProps) {
  const html = useMemo(() => markdownToHtml(text), [text]);

  if (!html) return null;

  return (
    <div
      className={[
        "rich-text-block text-sm leading-relaxed",
        "[&_p]:mb-2 [&_p:last-child]:mb-0",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ul:last-child]:mb-0",
        "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_ol:last-child]:mb-0",
        className,
      ].join(" ")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

"use client";

import { ChevronRight } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

type ToolDataTreeProps = {
  value: unknown;
};

type DataKind = "array" | "boolean" | "null" | "number" | "object" | "string" | "unknown";

const acronymLabels: Record<string, string> = {
  api: "API",
  id: "ID",
  isbn: "ISBN",
  sku: "SKU",
  url: "URL",
  usd: "USD",
};

const markdownComponents: Components = {
  a({ node, children, ...props }) {
    void node;
    return <a {...props} target="_blank" rel="noreferrer">{children}</a>;
  },
};

function dataKind(value: unknown): DataKind {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "unknown";
}

function typeLabel(kind: DataKind) {
  switch (kind) {
    case "array": return "List";
    case "boolean": return "Yes / No";
    case "null": return "Empty";
    case "number": return "Number";
    case "object": return "Group";
    case "string": return "Text";
    default: return "Value";
  }
}

function humanizeKey(key: string) {
  if (/^\d+$/.test(key)) return `Item ${Number(key) + 1}`;

  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((word) => acronymLabels[word.toLocaleLowerCase("en-US")] ?? word.toLocaleLowerCase("en-US"));

  if (words.length === 0) return "Value";
  return words
    .map((word, index) => index === 0 && !Object.values(acronymLabels).includes(word)
      ? `${word.charAt(0).toLocaleUpperCase("en-US")}${word.slice(1)}`
      : word)
    .join(" ");
}

function childEntries(value: unknown): Array<[string, unknown]> {
  if (Array.isArray(value)) return value.map((entry, index) => [String(index), entry]);
  if (value && typeof value === "object") return Object.entries(value as Record<string, unknown>);
  return [];
}

function collectionCount(kind: DataKind, count: number) {
  if (kind === "array") return `${count} ${count === 1 ? "item" : "items"}`;
  return `${count} ${count === 1 ? "field" : "fields"}`;
}

function isLongFormText(value: string) {
  const wordCount = value.trim().split(/\s+/).filter(Boolean).length;
  return value.includes("\n") || (value.length >= 96 && wordCount >= 8);
}

function displayScalar(value: unknown, kind: DataKind) {
  if (kind === "null") return "Not provided";
  if (kind === "boolean") return value ? "Yes" : "No";
  if (kind === "number" && typeof value === "number") {
    if (!Number.isFinite(value)) return String(value);
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(value);
  }
  if (kind === "string") return value as string || "Empty text";
  return String(value);
}

function DataEntry({ entryKey, value, depth }: { entryKey: string; value: unknown; depth: number }) {
  const kind = dataKind(value);
  const label = humanizeKey(entryKey);

  if (kind === "array" || kind === "object") {
    const entries = childEntries(value);
    return (
      <details className={`tool-data-branch data-kind-${kind}`} open={depth < 2}>
        <summary>
          <ChevronRight className="tool-data-chevron" size={13} aria-hidden="true" />
          <span className="tool-data-key">{label}</span>
          <span className="tool-data-type">{typeLabel(kind)}</span>
          <span className="tool-data-count">{collectionCount(kind, entries.length)}</span>
        </summary>
        <div className="tool-data-children">
          {entries.length > 0
            ? entries.map(([key, entry]) => <DataEntry key={key} entryKey={key} value={entry} depth={depth + 1} />)
            : <div className="tool-data-empty">No values</div>}
        </div>
      </details>
    );
  }

  const longForm = kind === "string" && isLongFormText(value as string);
  return (
    <div className={`tool-data-row data-kind-${kind} ${longForm ? "is-long-form" : ""}`}>
      <div className="tool-data-row-heading">
        <span className="tool-data-indent" aria-hidden="true" />
        <span className="tool-data-key">{label}</span>
        <span className="tool-data-type">{typeLabel(kind)}</span>
        {!longForm && <span className="tool-data-value">{displayScalar(value, kind)}</span>}
      </div>
      {longForm && (
        <div className="tool-data-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {value as string}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

export function ToolDataTree({ value }: ToolDataTreeProps) {
  const kind = dataKind(value);
  const entries = childEntries(value);

  if (kind === "array" || kind === "object") {
    if (entries.length === 0) return <div className="tool-data-empty">No values</div>;
    return (
      <div className="tool-data-tree">
        {entries.map(([key, entry]) => <DataEntry key={key} entryKey={key} value={entry} depth={0} />)}
      </div>
    );
  }

  return (
    <div className="tool-data-tree">
      <DataEntry entryKey="value" value={value} depth={0} />
    </div>
  );
}

import { randomUUID } from "node:crypto";
import type { BooklyDatabase } from "./database";

export type ConversationRole = "user" | "assistant";
export type ConversationModality = "text" | "voice";

export function saveMessage(
  db: BooklyDatabase,
  input: {
    id?: string;
    sessionId: string;
    role: ConversationRole;
    content: string;
    modality: ConversationModality;
  },
) {
  const id = input.id || randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO conversation_messages (id, session_id, role, content, modality, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, input.sessionId, input.role, input.content, input.modality, createdAt);
  return { id, createdAt };
}

export function saveToolRun(
  db: BooklyDatabase,
  input: {
    sessionId: string;
    callId: string;
    toolName: string;
    toolInput: unknown;
    toolOutput: unknown;
    status: "completed" | "failed";
    durationMs: number;
  },
) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO tool_runs (
      id, session_id, call_id, tool_name, input_json, output_json,
      status, duration_ms, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.sessionId,
    input.callId,
    input.toolName,
    JSON.stringify(input.toolInput),
    JSON.stringify(input.toolOutput),
    input.status,
    input.durationMs,
    createdAt,
  );
  return { id, createdAt };
}

export function getHistory(db: BooklyDatabase, sessionId: string) {
  const messages = db.prepare(`
    SELECT id, role, content, modality, created_at AS createdAt
    FROM conversation_messages
    WHERE session_id = ?
    ORDER BY created_at, id
    LIMIT 100
  `).all(sessionId);
  const toolRuns = (db.prepare(`
    SELECT
      id,
      call_id AS callId,
      tool_name AS toolName,
      input_json AS inputJson,
      output_json AS outputJson,
      status,
      duration_ms AS durationMs,
      created_at AS createdAt
    FROM tool_runs
    WHERE session_id = ?
    ORDER BY created_at, id
    LIMIT 100
  `).all(sessionId) as Array<{
    id: string;
    callId: string;
    toolName: string;
    inputJson: string;
    outputJson: string;
    status: string;
    durationMs: number;
    createdAt: string;
  }>).map((run) => ({
    id: run.id,
    callId: run.callId,
    toolName: run.toolName,
    input: JSON.parse(run.inputJson),
    output: JSON.parse(run.outputJson),
    status: run.status,
    durationMs: run.durationMs,
    createdAt: run.createdAt,
  }));
  return { messages, toolRuns };
}

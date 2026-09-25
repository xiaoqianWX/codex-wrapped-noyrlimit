import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectCodexUsageDataFromFiles } from "./collector";

function line(timestamp: string, type: string, payload: Record<string, unknown>): string {
  return JSON.stringify({ timestamp, type, payload });
}

function userMessage(
  timestamp: string,
  id: string,
  text: string,
  createTime: string,
  kinds: string[] = ["user.text"]
): string {
  return line(timestamp, "response_item", {
    type: "message",
    role: "user",
    id,
    content: [{ type: "input_text", text }],
    internal_chat_message_metadata_passthrough: {
      create_time: Date.parse(createTime) / 1000,
      content_item_kinds: kinds,
    },
  });
}

describe("collectCodexUsageDataFromFiles", () => {
  test("counts real user prompts by creation date without replaying fork history", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codex-wrapped-collector-"));
    const parentPath = join(dir, "parent.jsonl");
    const forkPath = join(dir, "fork.jsonl");
    const legacyPath = join(dir, "legacy.jsonl");
    const original = "2026-09-20T12:00:00.000Z";
    const forked = "2026-09-22T12:00:00.000Z";

    try {
      await writeFile(parentPath, [
        line(original, "session_meta", { id: "parent", cwd: "/project" }),
        userMessage(original, "msg_context", "<environment_context>injected</environment_context>", original, ["environments.environment_context"]),
        userMessage(original, "msg_prompt", "Actual prompt", original),
      ].join("\n"));

      await writeFile(forkPath, [
        line(forked, "session_meta", { id: "fork", forked_from_id: "parent", cwd: "/project" }),
        userMessage(forked, "msg_prompt", "Actual prompt", original),
        userMessage(forked, "msg_followup", "Follow-up", forked),
      ].join("\n"));

      await writeFile(legacyPath, [
        line("2026-09-19T12:00:00.000Z", "session_meta", { id: "legacy", cwd: "/legacy" }),
        line("2026-09-19T12:00:00.000Z", "response_item", {
          type: "message", role: "user", content: [{ type: "input_text", text: "# AGENTS.md instructions\nInjected" }],
        }),
        line("2026-09-19T12:00:00.000Z", "response_item", {
          type: "message", role: "user", content: [{ type: "input_text", text: "Legacy prompt" }],
        }),
      ].join("\n"));

      const data = await collectCodexUsageDataFromFiles(2026, [forkPath, legacyPath, parentPath]);

      expect(data.totalSessions).toBe(3);
      expect(data.totalMessages).toBe(3);
      expect([...data.dailyActivity]).toEqual([
        ["2026-09-19", 1],
        ["2026-09-20", 1],
        ["2026-09-22", 1],
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("uses a UUIDv7 message ID when replayed history lacks create_time", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codex-wrapped-collector-"));
    const path = join(dir, "replay.jsonl");
    const created = "2026-09-20T12:00:00.000Z";
    const hexTime = Date.parse(created).toString(16).padStart(12, "0");
    const id = `msg_${hexTime.slice(0, 8)}-${hexTime.slice(8)}-7000-8000-000000000000`;

    try {
      await writeFile(path, [
        line("2026-09-22T12:00:00.000Z", "session_meta", { id: "replay", cwd: "/project" }),
        line("2026-09-22T12:00:00.000Z", "response_item", {
          type: "message", role: "user", id, content: [{ type: "input_text", text: "Earlier prompt" }],
        }),
      ].join("\n"));

      const data = await collectCodexUsageDataFromFiles(2026, [path]);

      expect(data.totalMessages).toBe(1);
      expect([...data.dailyActivity]).toEqual([["2026-09-20", 1]]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

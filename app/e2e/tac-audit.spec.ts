import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { expect, test } from "@playwright/test";

import {
  recentPurchaseDate,
  submitRequestAndWaitForDecision,
} from "./helpers";

interface CountRow {
  count: number;
}

interface SessionStatusRow {
  status: string;
}

interface FirstMessageRow {
  role: string;
  parts: string;
}

const DB_DIR = path.resolve(process.cwd(), "data");
const SECRET_KEY_PATTERN = /sk-(?:or-v1|proj)-[A-Za-z0-9_-]{20,}/;

test.describe("Technical acceptance audits", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only audit spec");
  });

  test("TAC-03, TAC-003-02, TAC-003-05 pass on a real happy path", async ({
    page,
  }) => {
    test.setTimeout(150_000);

    const baselineAnalyzedSessions = countAnalyzedSessions();
    const browserOpenRouterRequests: string[] = [];
    const servedJsBodies: Array<Promise<string>> = [];
    page.on("request", (request) => {
      if (request.url().includes("openrouter.ai")) {
        browserOpenRouterRequests.push(request.url());
      }
    });
    page.on("response", (response) => {
      const contentType = response.headers()["content-type"] ?? "";
      if (
        contentType.includes("javascript") ||
        response.url().includes("/_next/static/")
      ) {
        servedJsBodies.push(
          response.text().catch(() => ""),
        );
      }
    });

    const decisionCategory = await submitRequestAndWaitForDecision(page, {
      requestType: "Zwrot",
      category: "Laptop",
      productName: "Lenovo ThinkPad X1 TAC",
      purchaseDate: recentPurchaseDate(5),
      imagePath: "e2e/fixtures/clean-product.jpg",
    });

    const cleanInWindowReachedApproveOrMoreInfo =
      decisionCategory === "APPROVE" || decisionCategory === "MORE_INFO";

    const sessionId = new URL(page.url()).pathname.split("/").filter(Boolean).pop();
    expect(sessionId).toBeTruthy();

    const jsBodies = await Promise.all(servedJsBodies);
    const keyPatternFound = jsBodies.some((body) => SECRET_KEY_PATTERN.test(body));
    expect(browserOpenRouterRequests).toHaveLength(0);
    expect(keyPatternFound).toBe(false);
    console.log(
      `[tac-audit][TAC-03] browser openrouter.ai requests: ${browserOpenRouterRequests.length}`,
    );
    console.log(
      `[tac-audit][TAC-03] API key pattern in served JS: ${keyPatternFound}`,
    );

    const dbPath = findSqliteDbPath();
    const db = new Database(dbPath, { readonly: true });
    try {
      const analyzedCount = db
        .prepare("select count(*) as count from sessions where status = 'analyzed'")
        .get() as CountRow;
      const currentSession = db
        .prepare("select status from sessions where id = ?")
        .get(sessionId) as SessionStatusRow | undefined;
      const initialDecisionCount = db
        .prepare(
          "select count(*) as count from decisions where session_id = ? and source = 'initial'",
        )
        .get(sessionId) as CountRow;
      const firstMessage = db
        .prepare(
          "select role, parts from messages where session_id = ? order by created_at asc limit 1",
        )
        .get(sessionId) as FirstMessageRow | undefined;

      expect(currentSession?.status).toBe("analyzed");
      expect(analyzedCount.count).toBeGreaterThanOrEqual(
        baselineAnalyzedSessions + 1,
      );
      expect(initialDecisionCount.count).toBe(1);
      expect(firstMessage?.role).toBe("assistant");
      expect(firstMessage?.parts).toContain("To jest wstępna ocena");

      console.log(`[tac-audit][TAC-003-02] DB path: ${dbPath}`);
      console.log(
        `[tac-audit][TAC-003-02] baseline analyzed sessions: ${baselineAnalyzedSessions}`,
      );
      console.log(
        `[tac-audit][TAC-003-02] analyzed sessions in current DB: ${analyzedCount.count}`,
      );
      console.log(
        `[tac-audit][TAC-003-02] current session ${sessionId} status: ${currentSession?.status}`,
      );
      console.log(
        `[tac-audit][TAC-003-02] current session initial decision rows: ${initialDecisionCount.count}`,
      );
      console.log(
        `[tac-audit][TAC-003-02] first message role: ${firstMessage?.role}`,
      );
    } finally {
      db.close();
    }

    const runtimeStatus = execFileSync(
      "git",
      ["status", "--short", "--", "data", ".next"],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(runtimeStatus.trim()).toBe("");
    console.log(
      `[tac-audit][TAC-003-05] git status --short -- data .next: ${JSON.stringify(runtimeStatus.trim())}`,
    );
    console.log(
      `[tac-audit][F-7] clean in-window decision category: ${decisionCategory}`,
    );
    console.log(
      `[tac-audit][F-7] clean in-window reached APPROVE/MORE_INFO: ${cleanInWindowReachedApproveOrMoreInfo}`,
    );
  });
});

function findSqliteDbPath(): string {
  const entries = fs.existsSync(DB_DIR) ? fs.readdirSync(DB_DIR) : [];
  const sqliteFiles = entries
    .filter((entry) => entry.endsWith(".sqlite"))
    .map((entry) => path.join(DB_DIR, entry));

  expect(sqliteFiles.length).toBeGreaterThanOrEqual(1);
  const copilotDb = sqliteFiles.find((file) => path.basename(file) === "copilot.sqlite");
  return copilotDb ?? sqliteFiles[0]!;
}

function countAnalyzedSessions(): number {
  const dbPath = path.join(DB_DIR, "copilot.sqlite");
  if (!fs.existsSync(dbPath)) {
    return 0;
  }

  const db = new Database(dbPath, { readonly: true });
  try {
    const row = db
      .prepare("select count(*) as count from sessions where status = 'analyzed'")
      .get() as CountRow;
    return row.count;
  } finally {
    db.close();
  }
}

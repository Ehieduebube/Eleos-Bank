import { NextResponse, type NextRequest } from "next/server";
import { formatDateTime, lagosDayKey } from "@/lib/format";
import { STATUS_LABELS, TYPE_LABELS, counterpartyLabel } from "@/lib/transaction-meta";
import { getSessionUser } from "@/server/auth/session";
import { getRepository } from "@/server/context";
import { parseTransactionQuery } from "@/server/repository/query";

/** Neutralise spreadsheet formula injection and quote every cell. */
function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const naira = (kobo: number) => (kobo / 100).toFixed(2);

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const query = parseTransactionQuery(params);
  const repo = await getRepository();
  const rows = await repo.exportTransactions(user.id, query);

  const header = ["Date", "Reference", "Type", "Description", "Counterparty", "Direction", "Status", "Amount (NGN)", "Fee (NGN)", "Total (NGN)", "Balance after (NGN)", "Narration", "Simulated"];
  const lines = [header.map(csvCell).join(",")];
  for (const t of rows) {
    lines.push(
      [
        formatDateTime(t.createdAt),
        t.reference,
        TYPE_LABELS[t.type],
        t.description,
        counterpartyLabel(t),
        t.direction,
        STATUS_LABELS[t.status],
        naira(t.amount),
        naira(t.fee),
        naira(t.total),
        t.balanceAfter === null ? "" : naira(t.balanceAfter),
        t.narration ?? "",
        t.isDemo ? "yes" : "no",
      ]
        .map(csvCell)
        .join(","),
    );
  }

  const filename = `eleos-demo-transactions-${lagosDayKey(new Date())}.csv`;
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

import { formatDateTime, formatPhone } from "./format";
import { formatNaira } from "./money";
import { STATUS_LABELS, TYPE_LABELS } from "./transaction-meta";
import type { SummaryRow, Transaction } from "./types";

/** Service-specific "who / what" rows for a transaction. */
export function counterpartyRows(txn: Transaction): SummaryRow[] {
  const d = txn.details;
  const rows: SummaryRow[] = [];
  const push = (label: string, value: string | number | boolean | undefined, mono = false) => {
    if (value !== undefined && value !== "" && value !== null) rows.push({ label, value: String(value), mono });
  };
  switch (txn.type) {
    case "transfer":
      push("Recipient", d.recipientName);
      push("Bank", d.bankName);
      push("Account number", d.accountNumberMasked, true);
      break;
    case "credit":
      push("From", d.senderName);
      push("Sender bank", d.bankName);
      break;
    case "airtime":
    case "data":
      push("Network", d.networkName);
      push("Phone number", d.phone ? formatPhone(String(d.phone)) : undefined, true);
      push("Bundle", d.planName);
      push("Validity", d.validity);
      break;
    case "card":
      push("Merchant", d.merchant);
      push("Category", d.merchantCategory);
      push("Card", d.cardLast4 ? `Virtual card •••• ${d.cardLast4}` : undefined);
      break;
    default:
      push(txn.type === "betting" ? "Platform" : "Provider", d.providerName);
      push("Customer", d.customerName);
      push(txn.type === "betting" ? "Customer ID" : txn.type === "electricity" ? "Meter number" : "Customer ID", d.customerId, true);
      push("Meter type", d.meterType ? (d.meterType === "prepaid" ? "Prepaid" : "Postpaid") : undefined);
      push("Plan", d.planName);
      push("Units", d.units);
  }
  return rows;
}

/** Full receipt rows (used by the detail dialog, receipt page and success screens). */
export function receiptRows(txn: Transaction): SummaryRow[] {
  const rows: SummaryRow[] = [
    { label: "Status", value: STATUS_LABELS[txn.status] },
    { label: "Type", value: TYPE_LABELS[txn.type] },
    { label: "Date", value: formatDateTime(txn.createdAt) },
    ...counterpartyRows(txn),
    { label: "Amount", value: formatNaira(txn.amount) },
  ];
  if (txn.direction === "debit") {
    rows.push({ label: "Fee", value: txn.fee > 0 ? formatNaira(txn.fee) : "Free" });
    rows.push({ label: "Total debited", value: formatNaira(txn.total), emphasis: true });
  } else {
    rows.push({ label: "Total credited", value: formatNaira(txn.total), emphasis: true });
  }
  if (txn.narration) rows.push({ label: "Narration", value: txn.narration });
  rows.push({ label: "Reference", value: txn.reference, mono: true });
  if (txn.providerReference) rows.push({ label: "Provider reference", value: txn.providerReference, mono: true });
  return rows;
}

export function resultHeadline(txn: Transaction): string {
  const verb = txn.direction === "credit" ? "Credit" : TYPE_LABELS[txn.type] === "Transfer" ? "Transfer" : "Payment";
  switch (txn.status) {
    case "successful":
      return `${verb} successful`;
    case "pending":
      return `${verb} pending`;
    case "failed":
      return `${verb} failed`;
    case "reversed":
      return `${verb} reversed`;
  }
}

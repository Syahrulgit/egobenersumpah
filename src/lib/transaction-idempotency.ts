import type { TransactionStatus, TransactionType } from "../types/ego";

export const TRANSACTION_REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidTransactionRequestId(value: unknown): value is string {
  return typeof value === "string" && TRANSACTION_REQUEST_ID_PATTERN.test(value);
}

export interface ConfirmedTransactionRequest {
  transaction_type: TransactionType;
  source_account_id: string | null;
  destination_account_id: string | null;
  amount: number;
  transaction_date: string;
  category: string | null;
  description: string | null;
  status: TransactionStatus;
  owner_confirmed: boolean;
}

/** A retry is safe only when the persisted row is the same posted, confirmed transaction. */
export function isSameConfirmedTransactionRequest(
  existing: (Omit<ConfirmedTransactionRequest, "amount"> & { amount: number | string }) | null | undefined,
  requested: ConfirmedTransactionRequest
): boolean {
  return Boolean(
    existing &&
      requested.status === "posted" &&
      requested.owner_confirmed === true &&
      existing.transaction_type === requested.transaction_type &&
      existing.source_account_id === requested.source_account_id &&
      existing.destination_account_id === requested.destination_account_id &&
      Number(existing.amount) === requested.amount &&
      existing.transaction_date === requested.transaction_date &&
      existing.category === requested.category &&
      existing.description === requested.description &&
      existing.status === "posted" &&
      existing.owner_confirmed === true
  );
}

export interface DebtPaymentRequestIdentity {
  request_id: string;
  debt_id: string;
  amount: number;
  source_account_id: string;
  notes: string | null;
}

interface ExistingDebtPaymentLog {
  request_id?: string | null;
  debt_id: string;
  amount: number | string;
  notes: string | null;
  transaction_id: string | null;
}

interface ExistingDebtPaymentTransaction {
  transaction_type: string;
  source_account_id: string | null;
  amount: number | string;
  category: string | null;
  status: string;
  owner_confirmed: boolean;
}

export function isSameDebtPaymentRequest(
  log: ExistingDebtPaymentLog | null | undefined,
  transaction: ExistingDebtPaymentTransaction | null | undefined,
  request: DebtPaymentRequestIdentity
): boolean {
  return Boolean(
    log &&
      transaction &&
      log.request_id === request.request_id &&
      log.debt_id === request.debt_id &&
      Number(log.amount) === request.amount &&
      (log.notes ?? null) === (request.notes ?? null) &&
      transaction.transaction_type === "expense" &&
      transaction.source_account_id === request.source_account_id &&
      Number(transaction.amount) === request.amount &&
      transaction.category === "Utang & Cicilan" &&
      transaction.status === "posted" &&
      transaction.owner_confirmed === true
  );
}

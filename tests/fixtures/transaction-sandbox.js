export const createSandbox = () => ({
  accounts: [
    { id: "cash", name: "Dompet Uji", balance: 1_000_000 },
    { id: "bank", name: "Bank Uji", balance: 500_000 },
  ],
  transactions: [],
});

export function submitSandboxTransaction(state, input) {
  if (!input.ownerConfirmed) throw new Error("Konfirmasi Owner wajib.");
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new Error("Nominal harus bilangan bulat lebih besar dari Rp 0.");
  }
  if (!["expense", "income", "transfer"].includes(input.type)) {
    throw new Error("Jenis transaksi tidak valid.");
  }

  const source = input.sourceId
    ? state.accounts.find((account) => account.id === input.sourceId)
    : null;
  const destination = input.destinationId
    ? state.accounts.find((account) => account.id === input.destinationId)
    : null;

  if (input.type !== "income" && !source) throw new Error("Akun sumber tidak ditemukan.");
  if (input.type !== "expense" && !destination) throw new Error("Akun tujuan tidak ditemukan.");
  if (input.type === "transfer" && source.id === destination.id) {
    throw new Error("Akun sumber dan tujuan tidak boleh sama.");
  }
  if (source && source.balance < input.amount) throw new Error("Saldo uji tidak mencukupi.");

  const id = input.id ?? `sandbox-${state.transactions.length + 1}`;
  if (state.transactions.some((transaction) => transaction.id === id)) {
    throw new Error("ID transaksi uji sudah digunakan.");
  }

  if (source) source.balance -= input.amount;
  if (destination) destination.balance += input.amount;

  const transaction = {
    id,
    type: input.type,
    amount: input.amount,
    sourceId: source?.id ?? null,
    destinationId: destination?.id ?? null,
    status: "posted",
  };
  state.transactions.push(transaction);
  return transaction;
}

export function cancelSandboxTransaction(state, id) {
  const transaction = state.transactions.find((item) => item.id === id);
  if (!transaction || transaction.status !== "posted") {
    throw new Error("Transaksi uji aktif tidak ditemukan.");
  }
  const source = transaction.sourceId
    ? state.accounts.find((account) => account.id === transaction.sourceId)
    : null;
  const destination = transaction.destinationId
    ? state.accounts.find((account) => account.id === transaction.destinationId)
    : null;

  if (source) source.balance += transaction.amount;
  if (destination) destination.balance -= transaction.amount;
  transaction.status = "cancelled";
  return transaction;
}

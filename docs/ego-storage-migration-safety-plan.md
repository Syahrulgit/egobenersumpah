# EGO Storage Migration Safety Plan

Status: design-only; no production data or schema has been changed.

## Scope and safety boundary

- Target test project: `EGO-TEST` (`vtfqmofkbovlnumpcadc`).
- Production project: `EGO-PERSONAL` (`teudnrqmadbrxpguoqug`) is out of scope and must remain untouched until the Owner explicitly approves a separately reviewed cutover.
- Use synthetic test records only. Never copy the Owner's real vault into EGO-TEST.
- Preserve `data/ego-vault.json` as an untouched rollback artifact throughout any future migration.
- No paid infrastructure, project, branch, or plan upgrades without explicit approval.

## Verified current state

- Application persistence is currently `data/ego-vault.json` through `loadVault()` / `saveVault()`.
- Supabase Auth is used by `verifyOwnerToken()` to verify Supabase tokens; the local session fallback still reads the local vault.
- `createAuthedSupabaseClient(token)` exists, but the inspected routes do not establish Supabase as the financial-data source of truth.
- The current app data model in `src/types/ego.ts` contains accounts, transactions, assets, debts, debt payment logs, owner commands, recurring bills, savings goals, reminders/logs, category budgets/logs, what-if scenarios, and financial-health snapshots.
- EGO-TEST is active, has one baseline migration, and its five inspected tables (accounts, transactions, assets, debts, owner_commands) contain zero rows.
- All five EGO-TEST tables have RLS enabled. Policies are owner-scoped with `auth.uid()`; owner_commands has separate insert/select/update policies.
- Schema/model mismatches exist and must be resolved before application cutover:
  - accounts DB allows `other`, while the app AccountType currently lists cash/bank/ewallet.
  - transactions DB requires category, while the app type allows category null; DB also has extra recorded_at/source_command fields.
  - debts DB status is unpaid/partial/paid, while the app type uses active/paid; app has optional debt metadata absent from the inspected DB table.
  - assets DB lacks the app's `unit` field.
  - owner_commands DB lacks the app's `parsed_draft` field and uses different status names.
  - app collections for debt_payment_logs, recurring_bills, savings_goals, financial_reminders, financial_reminder_logs, category_budgets, budget_alert_logs, whatif_scenarios, and financial_health_scores are not present in the inspected EGO-TEST schema.
- A view named `account_balances` exists in EGO-TEST; its security_invoker behavior and grants must be verified before use.

## Proposed target architecture

1. Supabase Postgres becomes the durable financial-data store only after a staged, tested cutover.
2. Define one canonical schema from the application's TypeScript domain model. Resolve naming, nullability, enum/status mapping, optional fields, timestamps, and foreign keys before writing migration SQL.
3. Keep `owner_id` on every owner-owned row and enforce ownership using RLS. No client may supply another owner's identity.
4. Use the authenticated Owner JWT and user-scoped Supabase client for database access where possible. The local-session fallback is not automatically a valid Supabase JWT; decide whether to migrate that auth path or implement a separately reviewed server-side authorization boundary before enabling DB writes. Never expose a service-role key to the browser.
5. Use database transactions/RPCs for operations that span multiple records:
   - transaction create/approve/cancel;
   - transfer as one atomic operation;
   - debt payment: transaction + debt balance update + payment log;
   - command approval + resulting posted transaction.
6. Enforce explicit Owner confirmation at the database boundary for posting financial transactions. Use unique request/idempotency keys to prevent duplicate submissions.
7. Derive balances from opening balances and posted ledger entries (or prove any materialized balance update is atomic). Transfers must debit and credit in the same database transaction.
8. Review views for RLS behavior (Postgres 15+ views should use `security_invoker = true` where appropriate), grants, and all policies. Do not rely on RLS alone if a privileged backend path bypasses it.

## Migration sequence

### Phase A — schema reconciliation (no data movement)
- Compare every field in `src/types/ego.ts` and `VaultDatabase` with the EGO-TEST schema.
- Agree canonical names, nullable fields, enums/status transitions, JSONB payloads, timestamps, and FK behavior.
- Produce versioned SQL migrations and review RLS/policies/views/functions.
- Keep all changes confined to EGO-TEST until test results are reviewed.

### Phase B — synthetic test data and behavior
- Seed only clearly synthetic accounts and transactions in EGO-TEST.
- Test income, expense, transfer, pending/posted/cancelled, owner confirmation, and invalid account ownership.
- Test atomic debt payments, duplicate request IDs, concurrent writes, rollback on injected failure, and balance reconciliation.
- Test Owner A cannot read or mutate Owner B rows; test unauthenticated access is denied.
- Test view access does not leak rows across owners.
- Test backup/export and restore into an isolated test target, then compare row counts and deterministic checksums.
- Run Supabase security/performance advisors and automated application tests.

### Phase C — non-destructive import rehearsal
- Take a read-only snapshot of the local vault; never edit or delete the source file.
- Validate the snapshot against the canonical schema before importing.
- Map the local Owner identity to the intended Supabase Auth user explicitly; do not assume local IDs are Auth user IDs.
- Import to EGO-TEST only, preserving stable IDs where safe and recording a migration batch ID.
- Compare per-collection counts, monetary totals, account balances, debt balances, and deterministic checksums.
- Rehearse rollback by switching the test app back to the unchanged JSON snapshot.

### Phase D — production decision (separate approval required)
- Do not touch EGO-PERSONAL until Phases A-C pass and the Owner reviews the evidence.
- Before any production write, obtain explicit approval for the exact migration/cutover operation.
- Back up the production vault and verify restore first.
- Use a short controlled write freeze for final snapshot/import/verification; avoid unproven dual-write.
- Switch reads/writes only after parity checks pass; retain the original vault and a documented rollback route.

## Required acceptance tests

- [ ] Schema parity: every persisted app collection and field is represented or deliberately excluded with rationale.
- [ ] RLS: cross-owner read/write attempts fail for every owner-owned table.
- [ ] Confirmation: a transaction cannot become posted without explicit Owner confirmation.
- [ ] Atomicity: failed transfer/debt payment leaves no partial ledger, account, debt, or log changes.
- [ ] Idempotency: retrying the same request does not duplicate a transaction or debt payment.
- [ ] Concurrency: simultaneous writes do not lose updates or create duplicate effects.
- [ ] Reconciliation: account balances, cash flow, debt balances, and payment logs match ledger-derived totals.
- [ ] Recovery: backup can be restored and verified in an isolated test target.
- [ ] Compatibility: existing UI and local-vault fallback behavior are unchanged until cutover is separately approved.
- [ ] Cost: all chosen resources remain within the free-first constraint; any nonzero cost requires prior Owner approval.

## Current decision

Design only. No DDL has been applied to EGO-TEST, no records have been inserted, no production project has been queried for mutation, and no app code has been changed. The next implementation unit is a reviewed schema-reconciliation migration for EGO-TEST, not a production cutover.

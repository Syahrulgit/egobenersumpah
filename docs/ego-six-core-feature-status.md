# EGO Six Core Systems — Status and Delivery Plan

Date: 2026-11-27
Repository: `Syahrulgit/egobenersumpah`
Canonical runtime: EGO-PERSONAL (`teudnrqmadbrxpguoqug`)
Development branch: `feat/ego-security-backup-core-2026-11-27`
Production changes in this work: **none**

## Owner-approved priority

1. Security Center
2. Transaction Integrity
3. Smart Budget Monitor
4. Debt Manager
5. Cashflow Forecast
6. Backup & Recovery

## Current implementation inventory

| System | Verified current implementation | Delivery status |
|---|---|---|
| Security Center | Pengaturan has PIN/password controls and basic diagnostics. The current UI hardcodes an RLS-success message based on client configuration; it cannot actually inspect database policies or grants. | **Gap:** make the posture truthful and provide safe, read-only verified status. |
| Transaction Integrity | Owner-confirmed RPCs, retry/idempotency checks, debt-payment cancellation guard, and available-balance checks. PRs #40–#46 are merged. | **Implemented; preserve and regression-test.** |
| Smart Budget Monitor | `/anggaran`, category budgets, 50/75/90/100/>100% thresholds, deduplicated alert history, and Supabase tables. | **Implemented; preserve and regression-test.** |
| Debt Manager | `/utang`, debt payment logs, atomic payment RPC, and snowball/avalanche payoff simulation. | **Implemented; preserve and regression-test.** |
| Cashflow Forecast | `computeCashflowForecast` supports 7/30/90/365-day horizons and is consumed by the dashboard. | **Implemented; preserve and regression-test.** |
| Backup & Recovery | Settings and reports export CSV and a complete JSON vault snapshot. No validated import/restore flow was found. | **Gap:** add validated preview and safe, Owner-confirmed recovery. |

## Live read-only Supabase observations (2026-11-27)

- EGO-PERSONAL reports `ACTIVE_HEALTHY` on Postgres 17.12.
- Migration history includes `20261127045035 enforce_available_account_balance`. Do not rerun it.
- All inspected public tables have RLS enabled.
- Security Advisor reports six authenticated-callable SECURITY DEFINER functions and leaked-password protection disabled. These are review findings, not proof of exploitability. Inspect each function's `auth.uid()`/ownership checks, fixed search_path, and EXECUTE grants before proposing any change. Do not blindly revoke or convert finance RPCs.
- Performance Advisor reports seven unindexed foreign keys, two RLS init-plan warnings, and five unused-index INFO findings. Treat these as separate performance work; do not drop indexes automatically.

## Delivery plan

### A. Security Center
- Replace hardcoded "RLS active" client diagnostics with explicit states: verified, warning, and not verifiable from the client.
- Keep privileged catalog/advisor inspection server-side; never expose service-role credentials or privileged SQL endpoints to the browser.
- Review the six SECURITY DEFINER functions individually and document the exact rationale and least-privilege grants.
- Do not change Auth settings or production grants without a separate Owner-approved change.

### B. Backup & Recovery
- Validate app identifier, supported backup version, timestamps, required arrays, row shapes, and duplicate IDs before any write.
- Show a read-only preview with record counts and conflicts.
- Default to additive recovery; never silently overwrite or delete existing Owner rows.
- Require explicit Owner confirmation immediately before restore.
- Use an atomic, tested server/database operation or a demonstrably safe rollback strategy; do not perform a sequence of partial browser writes.
- Add tests for malformed/unsupported files, duplicate IDs, conflicting rows, missing referenced records, and failure rollback.

### C. Regression protection
- Keep Transaction Integrity, Smart Budget Monitor, Debt Manager, and Cashflow Forecast behavior unchanged.
- Run app checks and isolated database integration tests.
- Open a Draft PR with diffs and reproducible test evidence before merge/deploy.

## Safety boundaries

- EGO-PERSONAL is the canonical runtime; EGO-TEST is reference/test only.
- Use synthetic fixtures and disposable isolated tests only.
- Do not reset either database or alter existing Owner financial rows.
- No production SQL, Auth configuration, deploy, paid service, or subscription change is authorized by this plan.

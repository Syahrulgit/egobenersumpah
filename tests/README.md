# Isolated transaction UI sandbox

This is a disposable browser-only UI fixture. It is intentionally separate from the EGO production application.

## Run locally

From the repository root:

```sh
python3 -m http.server 4179 --directory tests/fixtures
```

Open `http://localhost:4179/transaction-ui-sandbox.html`.

## Isolation guarantees

- Uses fictional accounts and balances declared in the fixture.
- Stores transactions only in JavaScript memory; reloading resets the fixture.
- Does not import Supabase, read environment variables, use Owner credentials, or make network/API requests.
- Does not alter production application routes or transaction hooks.
- The UI requires explicit confirmation before the in-memory submit action.
- Tests cover income, expense, transfer, validation, insufficient funds, duplicate request IDs, and cancellation/reversal.

This is a safe isolated UI-flow fixture, **not** an end-to-end test of the production React screen. Production UI integration still needs a separately provisioned local app + disposable Supabase/Auth stack.

#!/usr/bin/env bash
set -euo pipefail

export PGPASSWORD=ego_test_only
PSQL=(psql -h localhost -U ego_test -d ego_finance_test -v ON_ERROR_STOP=1 -q)
OWNER=11111111-1111-4111-8111-111111111111
DEBT=ffffffff-ffff-4fff-8fff-ffffffffffff
ACCOUNT=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
REQUEST=61616161-6161-4161-8161-616161616161

SQL="SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','${OWNER}',FALSE);
SELECT public.ego_pay_debt_atomic('${REQUEST}','${DEBT}',20.00,'${ACCOUNT}',TRUE,DATE '2026-11-26','same concurrent retry');"

"${PSQL[@]}" -c "$SQL" >/tmp/ego-personal-concurrent-a.log 2>&1 &
PID_A=$!
"${PSQL[@]}" -c "$SQL" >/tmp/ego-personal-concurrent-b.log 2>&1 &
PID_B=$!

set +e
wait "$PID_A"; RC_A=$?
wait "$PID_B"; RC_B=$?
set -e

if [[ $RC_A -ne 0 || $RC_B -ne 0 ]]; then
  cat /tmp/ego-personal-concurrent-a.log /tmp/ego-personal-concurrent-b.log
  echo "Concurrent identical retries should both succeed; got A=$RC_A B=$RC_B"
  exit 1
fi

RESULT=$("${PSQL[@]}" -Atc "SELECT d.outstanding_balance::text || '|' ||
  (SELECT count(*) FROM public.debt_payment_logs l WHERE l.debt_id=d.id)::text || '|' ||
  (SELECT count(*) FROM public.transactions t WHERE t.description='Pembayaran utang ke Concurrent creditor')::text
  FROM public.debts d WHERE d.id='${DEBT}'")

if [[ "$RESULT" != "30.00|1|1" ]]; then
  echo "Unexpected concurrent retry result: $RESULT"
  cat /tmp/ego-personal-concurrent-a.log /tmp/ego-personal-concurrent-b.log
  exit 1
fi

echo "Concurrent identical debt-payment retry passed: one ledger transaction, one log, one balance update."

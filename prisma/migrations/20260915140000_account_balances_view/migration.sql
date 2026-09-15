-- CreateIndex
CREATE INDEX "ledger_lines_accountId_idx" ON "ledger_lines"("accountId");

-- CreateIndex
CREATE INDEX "ledger_lines_transactionId_idx" ON "ledger_lines"("transactionId");


-- account_balances: a relational view computing each account's running
-- balance from the ledger directly (no cached/materialized column to keep
-- in sync), using the accountId index above instead of a full table scan.
CREATE VIEW "account_balances" AS
SELECT
  a.id AS account_id,
  a.code,
  a.name,
  a.type,
  a."isSystem" AS is_system,
  COALESCE(SUM(CASE WHEN ll.direction = 'DEBIT' THEN ll.amount ELSE 0 END), 0) AS total_debits,
  COALESCE(SUM(CASE WHEN ll.direction = 'CREDIT' THEN ll.amount ELSE 0 END), 0) AS total_credits,
  CASE
    WHEN a.type IN ('ASSET', 'EXPENSE') THEN
      COALESCE(SUM(CASE WHEN ll.direction = 'DEBIT' THEN ll.amount ELSE -ll.amount END), 0)
    ELSE
      COALESCE(SUM(CASE WHEN ll.direction = 'CREDIT' THEN ll.amount ELSE -ll.amount END), 0)
  END AS balance
FROM "accounts" a
LEFT JOIN "ledger_lines" ll ON ll."accountId" = a.id
GROUP BY a.id, a.code, a.name, a.type, a."isSystem";

-- Zero-variance enforcement, at the database level: lib/ledger.ts already
-- refuses to write an unbalanced entry, but this is a deferred constraint
-- trigger as a second line of defense -- it re-checks every ledger
-- transaction's debit/credit sums at COMMIT time (not per-row, so it
-- correctly sees the full set of lines a transaction writes together) and
-- aborts the whole commit if they don't match exactly, regardless of what
-- code path wrote the rows.
CREATE OR REPLACE FUNCTION enforce_ledger_zero_variance()
RETURNS TRIGGER AS $$
DECLARE
  debit_total DECIMAL(14,2);
  credit_total DECIMAL(14,2);
  affected_transaction_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    affected_transaction_id := OLD."transactionId";
  ELSE
    affected_transaction_id := NEW."transactionId";
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN direction = 'DEBIT' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE 0 END), 0)
  INTO debit_total, credit_total
  FROM "ledger_lines"
  WHERE "transactionId" = affected_transaction_id;

  IF debit_total <> credit_total THEN
    RAISE EXCEPTION 'Unbalanced ledger transaction %: debits % != credits %',
      affected_transaction_id, debit_total, credit_total;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ledger_lines_zero_variance
  AFTER INSERT OR UPDATE OR DELETE ON "ledger_lines"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION enforce_ledger_zero_variance();

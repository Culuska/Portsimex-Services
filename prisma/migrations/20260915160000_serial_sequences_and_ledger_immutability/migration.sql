-- Atomic document numbering: replaces the previous "COUNT(*) + 1" scheme
-- (a genuine race condition under concurrent creates -- two requests can
-- read the same count and collide) with native Postgres sequences, whose
-- nextval() is atomic and immune to double-allocation under concurrent
-- traffic. Each sequence is advanced past any existing rows so numbering
-- continues where the old scheme left off rather than reusing a number.
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;
CREATE SEQUENCE IF NOT EXISTS quote_number_seq;
CREATE SEQUENCE IF NOT EXISTS purchase_request_number_seq;
CREATE SEQUENCE IF NOT EXISTS shipment_reference_seq;

DO $$
DECLARE existing_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO existing_count FROM "invoices";
  IF existing_count > 0 THEN
    PERFORM setval('invoice_number_seq', existing_count);
  END IF;

  SELECT COUNT(*) INTO existing_count FROM "quotes";
  IF existing_count > 0 THEN
    PERFORM setval('quote_number_seq', existing_count);
  END IF;

  SELECT COUNT(*) INTO existing_count FROM "purchase_requests";
  IF existing_count > 0 THEN
    PERFORM setval('purchase_request_number_seq', existing_count);
  END IF;

  SELECT COUNT(*) INTO existing_count FROM "shipments";
  IF existing_count > 0 THEN
    PERFORM setval('shipment_reference_seq', existing_count);
  END IF;
END $$;

-- Ledger immutability: once a journal entry is posted it can only ever be
-- corrected by a new balancing entry, never edited or removed in place --
-- enforced here so it holds regardless of what code path attempts it, not
-- just because our own app code happens not to call update/delete.
CREATE OR REPLACE FUNCTION forbid_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Ledger rows are immutable: % on % is not permitted (post a new balancing entry instead)',
    TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_transactions_immutable
  BEFORE UPDATE OR DELETE ON "ledger_transactions"
  FOR EACH ROW
  EXECUTE FUNCTION forbid_ledger_mutation();

CREATE TRIGGER ledger_lines_immutable
  BEFORE UPDATE OR DELETE ON "ledger_lines"
  FOR EACH ROW
  EXECUTE FUNCTION forbid_ledger_mutation();

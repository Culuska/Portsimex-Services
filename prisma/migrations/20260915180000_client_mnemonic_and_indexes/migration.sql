-- Client mnemonic: a 5-character uppercase alphanumeric code derived from
-- the client name (see src/lib/client-mnemonic.ts), assigned once and
-- never changed afterward. Added nullable first so existing rows can be
-- backfilled with the same derivation + collision-resolution algorithm
-- the app uses for new clients, before the column is locked down.
ALTER TABLE "clients" ADD COLUMN "mnemonic" TEXT;

DO $$
DECLARE
  client_row RECORD;
  base TEXT;
  candidate TEXT;
  digit INT;
  letter_code INT;
  found BOOLEAN;
BEGIN
  FOR client_row IN SELECT id, name FROM "clients" ORDER BY "createdAt" ASC LOOP
    -- Same rule as deriveMnemonicBase(): strip everything but letters and
    -- digits, uppercase, take the first 5 characters, pad short names
    -- with X.
    base := upper(regexp_replace(client_row.name, '[^a-zA-Z0-9]', '', 'g'));
    base := rpad(left(base, 5), 5, 'X');

    candidate := base;
    found := NOT EXISTS (SELECT 1 FROM "clients" WHERE mnemonic = candidate);

    IF NOT found THEN
      digit := 2;
      WHILE NOT found AND digit <= 9 LOOP
        candidate := left(base, 4) || digit::text;
        found := NOT EXISTS (SELECT 1 FROM "clients" WHERE mnemonic = candidate);
        digit := digit + 1;
      END LOOP;
    END IF;

    IF NOT found THEN
      letter_code := 65;
      WHILE NOT found AND letter_code <= 90 LOOP
        candidate := left(base, 4) || chr(letter_code);
        found := NOT EXISTS (SELECT 1 FROM "clients" WHERE mnemonic = candidate);
        letter_code := letter_code + 1;
      END LOOP;
    END IF;

    IF NOT found THEN
      RAISE EXCEPTION 'Could not find a free client mnemonic for client % (name: %)', client_row.id, client_row.name;
    END IF;

    UPDATE "clients" SET mnemonic = candidate WHERE id = client_row.id;
  END LOOP;
END $$;

ALTER TABLE "clients" ALTER COLUMN "mnemonic" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "clients_mnemonic_key" ON "clients"("mnemonic");

-- CreateIndex
CREATE INDEX "invoices_clientId_status_idx" ON "invoices"("clientId", "status");

-- CreateIndex
CREATE INDEX "purchase_requests_clientId_status_idx" ON "purchase_requests"("clientId", "status");

-- CreateIndex
CREATE INDEX "quotes_clientId_status_idx" ON "quotes"("clientId", "status");

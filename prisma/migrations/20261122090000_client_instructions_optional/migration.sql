-- "Client instructions / documents" becomes optional (data only, no schema
-- change): in the service catalog, and on open jobs still waiting for it.
-- Received documents and closed / cancelled jobs are left as they are.
UPDATE "service_definitions"
SET "documents" = (
  SELECT jsonb_agg(
    CASE WHEN d->>'name' = 'Client instructions / documents' THEN jsonb_set(d, '{required}', 'false'::jsonb) ELSE d END
    ORDER BY ord
  )
  FROM jsonb_array_elements("documents") WITH ORDINALITY AS t(d, ord)
)
WHERE "documents" @> '[{"name": "Client instructions / documents"}]'::jsonb;

UPDATE "job_documents"
SET "required" = false
WHERE "name" = 'Client instructions / documents'
  AND "received" = false
  AND "isOutput" = false
  AND "jobId" IN (SELECT "id" FROM "jobs" WHERE "status" NOT IN ('CLOSED', 'CANCELLED'));

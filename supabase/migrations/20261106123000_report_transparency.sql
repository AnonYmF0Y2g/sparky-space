-- Sparky's Space: member-visible report transparency
-- Apply this migration in the Supabase SQL Editor after reviewing it.
-- Existing report rows and staff_notes are preserved.

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS outcome_message text;

-- Members must not read the reports table directly: it contains staff_notes.
-- Staff retain table access through the staff-only SELECT policy.
DROP POLICY IF EXISTS "Members view own reports" ON public.reports;
DROP POLICY IF EXISTS "Staff view reports" ON public.reports;

-- Keep the canonical staff SELECT policy ("Staff read reports").
-- The remaining "Staff read reports" policy checks public.is_staff().

-- Return only member-safe fields for the signed-in reporter.
CREATE OR REPLACE FUNCTION public.get_my_reports()
RETURNS TABLE (
  id uuid,
  category text,
  details text,
  status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  outcome_message text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT
    r.id,
    r.category,
    r.details,
    r.status,
    r.created_at,
    r.reviewed_at,
    r.outcome_message
  FROM public.reports AS r
  WHERE r.reporter_id = (SELECT auth.uid())
  ORDER BY r.created_at DESC
  LIMIT 50;
$function$;

REVOKE ALL ON FUNCTION public.get_my_reports() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_reports() TO authenticated;

-- Record the first time staff move a report out of the open state.
CREATE OR REPLACE FUNCTION public.set_report_reviewed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status <> 'open' THEN
    NEW.reviewed_at := COALESCE(NEW.reviewed_at, now());
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS set_report_reviewed_at ON public.reports;
CREATE TRIGGER set_report_reviewed_at
BEFORE UPDATE OF status ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.set_report_reviewed_at();

COMMENT ON COLUMN public.reports.reviewed_at IS
  'First timestamp when staff moved the report out of open status.';
COMMENT ON COLUMN public.reports.outcome_message IS
  'Member-visible staff explanation. Never put internal notes or private moderation details here.';

-- Verification: inspect the function, trigger, and remaining report policies.

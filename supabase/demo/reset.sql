-- Hosted demo only. The database runs the same reset every night at 02:17
-- UTC with pg_cron (migration 20261124150000_demo_reset_job.sql). Run this
-- file to reset at once, for example right after the hosted seed.
do $$
begin
  if not private.reset_hosted_demo() then
    raise exception 'Hosted demo firms are missing or unexpected. Run the hosted seed first.';
  end if;
end;
$$;

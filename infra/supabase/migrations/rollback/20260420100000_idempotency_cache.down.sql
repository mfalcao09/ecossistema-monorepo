-- Rollback: idempotency_cache (F1-S02)

do $$
begin
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
        if exists (select 1 from cron.job where jobname = 'gc_idempotency_cache') then
            perform cron.unschedule('gc_idempotency_cache');
        end if;
    end if;
end $$;

drop table if exists idempotency_cache;

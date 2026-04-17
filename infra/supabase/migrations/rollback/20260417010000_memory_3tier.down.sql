-- Rollback: memory_3tier
-- Destroi tabelas NOVAS (criadas em 20260417010000). Nenhum dado pré-existente é tocado.
-- pg_trgm é mantido (pode ser usado por outras features).

drop trigger if exists trg_memory_procedural_updated on memory_procedural;
drop function if exists update_memory_procedural_updated_at();

drop policy if exists mem_proc_service_role        on memory_procedural;
drop policy if exists mem_sem_service_role         on memory_semantic;
drop policy if exists mem_ep_service_role          on memory_episodic;
drop policy if exists mem_proc_business_isolation  on memory_procedural;
drop policy if exists mem_sem_business_isolation   on memory_semantic;
drop policy if exists mem_ep_business_isolation    on memory_episodic;

drop table if exists memory_procedural;
drop table if exists memory_semantic;
drop table if exists memory_episodic;

-- Extensão vector NÃO é dropada (usada por ecosystem_memory em prod).

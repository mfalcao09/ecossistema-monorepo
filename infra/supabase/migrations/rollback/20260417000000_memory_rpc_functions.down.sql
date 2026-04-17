-- Rollback: memory_rpc_functions
-- Remove só as funções adicionadas. Não afeta dados em memory_*.
drop function if exists match_memory_episodic(vector, text, text, text, text, text[], int);
drop function if exists match_memory_semantic(vector, text, text, text, text, boolean, int);
drop function if exists match_memory_procedural(vector, text, text, text, int);
drop function if exists memory_episodic_bump_access(uuid[]);

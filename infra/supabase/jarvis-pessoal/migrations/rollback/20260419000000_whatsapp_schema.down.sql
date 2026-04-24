-- Rollback: whatsapp_schema
-- Espelha 20260419000000_whatsapp_schema.sql
--
-- ⚠️ SAFETY CHECK
-- Se `whatsapp_auth_state` tem linhas, REVOGAR o linked device no celular ANTES de rodar:
--   WhatsApp → Dispositivos conectados → Desconectar
-- Senão o número continua pareado a um "fantasma" até expirar.

-- Aborta se há auth state ativo (proteção)
do $$
declare
  n int;
begin
  select count(*) into n from whatsapp_auth_state;
  if n > 0 then
    raise exception 'whatsapp_auth_state tem % linha(s). Revogue o linked device no celular antes de rodar rollback.', n;
  end if;
end$$;

-- Remover do Realtime publication
alter publication supabase_realtime drop table if exists whatsapp_messages;
alter publication supabase_realtime drop table if exists whatsapp_chats;
alter publication supabase_realtime drop table if exists whatsapp_instances;

-- Drop tabelas (ordem: filhas → pais)
drop table if exists whatsapp_messages    cascade;
drop table if exists whatsapp_chats       cascade;
drop table if exists whatsapp_contacts    cascade;
drop table if exists whatsapp_auth_state  cascade;
drop table if exists whatsapp_instances   cascade;

-- Drop função trigger
drop function if exists _wa_set_updated_at() cascade;


-- Etapa 1: Adicionar campos na tabela tenants para API pública e webhooks
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS custom_domain text UNIQUE,
  ADD COLUMN IF NOT EXISTS webhook_url text,
  ADD COLUMN IF NOT EXISTS webhook_secret text;

-- Etapa 3: Função que notifica edge function site-webhook quando imóvel é publicado/atualizado/removido
CREATE OR REPLACE FUNCTION public.notify_property_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant RECORD;
  v_event text;
  v_function_url text;
BEGIN
  -- Determinar o tipo de evento
  IF TG_OP = 'INSERT' THEN
    IF NEW.show_on_website = true AND NEW.status = 'disponivel' THEN
      v_event := 'property.published';
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Publicado agora
    IF NEW.show_on_website = true AND OLD.show_on_website = false THEN
      v_event := 'property.published';
    -- Despublicado agora
    ELSIF (NEW.show_on_website = false AND OLD.show_on_website = true)
       OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status != 'disponivel' AND OLD.show_on_website = true) THEN
      v_event := 'property.unpublished';
    -- Atualizado enquanto publicado
    ELSIF NEW.show_on_website = true AND NEW.status = 'disponivel' THEN
      v_event := 'property.updated';
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.show_on_website = true THEN
      v_event := 'property.unpublished';
    ELSE
      RETURN OLD;
    END IF;
  END IF;

  -- Buscar tenant e verificar se tem webhook configurado
  SELECT id, webhook_url, webhook_secret
  INTO v_tenant
  FROM public.tenants
  WHERE id = COALESCE(NEW.tenant_id, OLD.tenant_id);

  IF v_tenant.webhook_url IS NULL OR v_tenant.webhook_url = '' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Chamar via pg_net (HTTP async)
  PERFORM net.http_post(
    url := v_tenant.webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Webhook-Secret', COALESCE(v_tenant.webhook_secret, '')
    ),
    body := jsonb_build_object(
      'event', v_event,
      'tenant_id', v_tenant.id,
      'property_id', COALESCE(NEW.id, OLD.id),
      'timestamp', now()
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger na tabela properties
DROP TRIGGER IF EXISTS trg_property_webhook ON public.properties;
CREATE TRIGGER trg_property_webhook
  AFTER INSERT OR UPDATE OR DELETE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_property_webhook();

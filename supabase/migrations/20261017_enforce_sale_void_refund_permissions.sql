-- Prevent cashiers from changing sale status to voided/refunded without the matching permission.
CREATE OR REPLACE FUNCTION public.enforce_sale_status_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'voided' AND NOT public.has_permission(NEW.business_id, 'VOID_SALE') THEN
      RAISE EXCEPTION 'VOID_SALE permission required to void a sale'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.status = 'refunded' AND NOT public.has_permission(NEW.business_id, 'REFUND_SALE') THEN
      RAISE EXCEPTION 'REFUND_SALE permission required to refund a sale'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_sale_status_permission ON public.sales;
CREATE TRIGGER trg_enforce_sale_status_permission
  BEFORE UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_sale_status_permission();

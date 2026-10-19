CREATE OR REPLACE FUNCTION public.ensure_ticket_for_reservation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'reserved' THEN
    INSERT INTO public.tickets (reservation_id) VALUES (NEW.id)
    ON CONFLICT (reservation_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ensure_ticket_for_reservation ON public.reservations;
CREATE TRIGGER trg_ensure_ticket_for_reservation
AFTER INSERT OR UPDATE OF status ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.ensure_ticket_for_reservation();

INSERT INTO public.tickets (reservation_id)
SELECT r.id FROM public.reservations r
WHERE r.status = 'reserved'
  AND NOT EXISTS (SELECT 1 FROM public.tickets t WHERE t.reservation_id = r.id)
ON CONFLICT (reservation_id) DO NOTHING;
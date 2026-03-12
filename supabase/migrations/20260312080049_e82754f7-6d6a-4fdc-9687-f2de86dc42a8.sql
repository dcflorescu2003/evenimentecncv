
-- Add is_public flag to events
ALTER TABLE public.events ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;

-- Create public_reservations table
CREATE TABLE public.public_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  reservation_code TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create public_tickets table  
CREATE TABLE public.public_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_reservation_id UUID NOT NULL REFERENCES public.public_reservations(id) ON DELETE CASCADE,
  attendee_name TEXT NOT NULL,
  qr_code_data TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'cancelled', 'present', 'late', 'absent', 'excused')),
  checkin_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.public_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_tickets ENABLE ROW LEVEL SECURITY;

-- Anon can read public events
CREATE POLICY "Anon read public published events"
ON public.events FOR SELECT TO anon
USING (is_public = true AND published = true AND status = 'published');

-- Anon insert public_reservations
CREATE POLICY "Anon insert public reservations"
ON public.public_reservations FOR INSERT TO anon
WITH CHECK (
  EXISTS (SELECT 1 FROM events WHERE id = event_id AND is_public = true AND published = true AND status = 'published')
);

-- Anon select own public_reservations by reservation_code
CREATE POLICY "Anon select own public reservations"
ON public.public_reservations FOR SELECT TO anon
USING (true);

-- Anon insert public_tickets
CREATE POLICY "Anon insert public tickets"
ON public.public_tickets FOR INSERT TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public_reservations pr
    JOIN events e ON e.id = pr.event_id
    WHERE pr.id = public_reservation_id AND e.is_public = true
  )
);

-- Anon select public_tickets (by joining to reservation_code)
CREATE POLICY "Anon select public tickets"
ON public.public_tickets FOR SELECT TO anon
USING (true);

-- Admin full access on both tables
CREATE POLICY "Admins manage public reservations"
ON public.public_reservations FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage public tickets"
ON public.public_tickets FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Coordinators read public_reservations for their events
CREATE POLICY "Coordinators read public reservations"
ON public.public_reservations FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'coordinator_teacher'::app_role)
  AND event_id IN (
    SELECT event_id FROM coordinator_assignments WHERE teacher_id = auth.uid()
  )
);

-- Coordinators read public_tickets for their events
CREATE POLICY "Coordinators read public tickets"
ON public.public_tickets FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'coordinator_teacher'::app_role)
  AND public_reservation_id IN (
    SELECT pr.id FROM public_reservations pr
    JOIN coordinator_assignments ca ON ca.event_id = pr.event_id
    WHERE ca.teacher_id = auth.uid()
  )
);

-- Coordinators update public_tickets status for their events
CREATE POLICY "Coordinators update public tickets"
ON public.public_tickets FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'coordinator_teacher'::app_role)
  AND public_reservation_id IN (
    SELECT pr.id FROM public_reservations pr
    JOIN coordinator_assignments ca ON ca.event_id = pr.event_id
    WHERE ca.teacher_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_public_reservations_event_id ON public.public_reservations(event_id);
CREATE INDEX idx_public_reservations_code ON public.public_reservations(reservation_code);
CREATE INDEX idx_public_tickets_reservation_id ON public.public_tickets(public_reservation_id);
CREATE INDEX idx_public_tickets_qr ON public.public_tickets(qr_code_data);

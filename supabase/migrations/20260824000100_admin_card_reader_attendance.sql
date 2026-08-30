CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS attendance_method TEXT,
  ADD COLUMN IF NOT EXISTS card_uid_hash TEXT,
  ADD COLUMN IF NOT EXISTS card_uid_last4 TEXT,
  ADD COLUMN IF NOT EXISTS reader_id TEXT,
  ADD COLUMN IF NOT EXISTS created_by_admin_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS admin_attendance_reason TEXT;

CREATE TABLE IF NOT EXISTS public.card_readers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected')),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_card_uid_hash TEXT,
  last_card_uid_last4 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_uid_hash TEXT NOT NULL,
  card_uid_last4 TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'lost', 'revoked')),
  registered_by UUID NOT NULL REFERENCES auth.users(id),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at TIMESTAMPTZ,
  notes TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS employee_cards_active_uid_idx
ON public.employee_cards (card_uid_hash)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS employee_cards_employee_idx
ON public.employee_cards (employee_id, status);

CREATE TABLE IF NOT EXISTS public.card_reader_attendance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID REFERENCES public.attendance(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('scan', 'register_card', 'check_in', 'check_out', 'duplicate', 'unknown_card')),
  attendance_method TEXT NOT NULL DEFAULT 'ADMIN_CARD_READER',
  card_uid_hash TEXT NOT NULL,
  card_uid_last4 TEXT,
  reader_id TEXT,
  reader_name TEXT,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS card_reader_attendance_events_created_idx
ON public.card_reader_attendance_events (created_at DESC);

CREATE INDEX IF NOT EXISTS card_reader_attendance_events_employee_idx
ON public.card_reader_attendance_events (employee_id, created_at DESC);

ALTER TABLE public.card_readers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_reader_attendance_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage card readers" ON public.card_readers;
CREATE POLICY "admins manage card readers"
ON public.card_readers FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins manage employee cards" ON public.employee_cards;
CREATE POLICY "admins manage employee cards"
ON public.employee_cards FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins view card reader attendance events" ON public.card_reader_attendance_events;
CREATE POLICY "admins view card reader attendance events"
ON public.card_reader_attendance_events FOR SELECT
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins create card reader attendance events" ON public.card_reader_attendance_events;
CREATE POLICY "admins create card reader attendance events"
ON public.card_reader_attendance_events FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.card_uid_hash(_card_uid TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT encode(extensions.digest(upper(regexp_replace(COALESCE(_card_uid, ''), '\s+', '', 'g')), 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.card_uid_last4(_card_uid TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT right(upper(regexp_replace(COALESCE(_card_uid, ''), '\s+', '', 'g')), 4);
$$;

CREATE OR REPLACE FUNCTION public.mask_card_uid(_card_uid TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN length(upper(regexp_replace(COALESCE(_card_uid, ''), '\s+', '', 'g'))) <= 4
      THEN repeat('*', length(upper(regexp_replace(COALESCE(_card_uid, ''), '\s+', '', 'g'))))
    ELSE repeat('*', GREATEST(length(upper(regexp_replace(COALESCE(_card_uid, ''), '\s+', '', 'g'))) - 4, 0)) || public.card_uid_last4(_card_uid)
  END;
$$;

CREATE OR REPLACE FUNCTION public.admin_card_reader_status(
  _reader_id TEXT,
  _reader_name TEXT DEFAULT 'Admin RFID/NFC Reader'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reader public.card_readers;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorized admins or HR users can access card reader attendance';
  END IF;

  IF COALESCE(BTRIM(_reader_id), '') = '' THEN
    RAISE EXCEPTION 'Reader ID is required';
  END IF;

  INSERT INTO public.card_readers (id, name, status, last_seen_at, updated_at)
  VALUES (BTRIM(_reader_id), COALESCE(NULLIF(BTRIM(_reader_name), ''), 'Admin RFID/NFC Reader'), 'connected', now(), now())
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      status = 'connected',
      last_seen_at = now(),
      updated_at = now()
  RETURNING * INTO v_reader;

  RETURN jsonb_build_object(
    'connected', true,
    'reader_id', v_reader.id,
    'reader_name', v_reader.name,
    'status', v_reader.status,
    'last_seen_at', v_reader.last_seen_at,
    'last_card_uid', CASE WHEN v_reader.last_card_uid_last4 IS NULL THEN NULL ELSE '****' || v_reader.last_card_uid_last4 END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_card_reader_scan(
  _card_uid TEXT,
  _reader_id TEXT,
  _reader_name TEXT DEFAULT 'Admin RFID/NFC Reader'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT := public.card_uid_hash(_card_uid);
  v_last4 TEXT := public.card_uid_last4(_card_uid);
  v_employee public.profiles;
  v_attendance public.attendance;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorized admins or HR users can scan employee cards';
  END IF;

  IF COALESCE(BTRIM(_card_uid), '') = '' THEN
    RAISE EXCEPTION 'Card UID is required';
  END IF;

  PERFORM public.admin_card_reader_status(_reader_id, _reader_name);

  UPDATE public.card_readers
  SET last_card_uid_hash = v_hash,
      last_card_uid_last4 = v_last4,
      last_seen_at = now(),
      updated_at = now()
  WHERE id = BTRIM(_reader_id);

  SELECT p.* INTO v_employee
  FROM public.employee_cards c
  JOIN public.profiles p ON p.user_id = c.employee_id
  WHERE c.card_uid_hash = v_hash
    AND c.status = 'active'
    AND p.approval_status = 'approved'
    AND p.is_suspended = false
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.card_reader_attendance_events (
      employee_id, admin_id, action, card_uid_hash, card_uid_last4, reader_id, reader_name, reason
    )
    VALUES (
      NULL, auth.uid(), 'unknown_card', v_hash, v_last4, BTRIM(_reader_id), COALESCE(NULLIF(BTRIM(_reader_name), ''), 'Admin RFID/NFC Reader'), 'Card not registered'
    );

    RETURN jsonb_build_object(
      'status', 'unknown_card',
      'message', 'Card not registered.',
      'card_uid', public.mask_card_uid(_card_uid),
      'reader_id', BTRIM(_reader_id),
      'reader_name', COALESCE(NULLIF(BTRIM(_reader_name), ''), 'Admin RFID/NFC Reader')
    );
  END IF;

  SELECT * INTO v_attendance
  FROM public.attendance
  WHERE user_id = v_employee.user_id
    AND date = CURRENT_DATE
    AND deleted_at IS NULL
  LIMIT 1;

  INSERT INTO public.card_reader_attendance_events (
    attendance_id, employee_id, admin_id, action, card_uid_hash, card_uid_last4, reader_id, reader_name, reason
  )
  VALUES (
    v_attendance.id, v_employee.user_id, auth.uid(), 'scan', v_hash, v_last4, BTRIM(_reader_id), COALESCE(NULLIF(BTRIM(_reader_name), ''), 'Admin RFID/NFC Reader'), 'Card scanned'
  );

  RETURN jsonb_build_object(
    'status', CASE
      WHEN v_attendance.id IS NOT NULL AND v_attendance.check_in_time IS NOT NULL AND v_attendance.check_out_time IS NOT NULL THEN 'completed'
      ELSE 'employee_found'
    END,
    'message', CASE
      WHEN v_attendance.id IS NOT NULL AND v_attendance.check_in_time IS NOT NULL AND v_attendance.check_out_time IS NOT NULL THEN 'Attendance already completed for today.'
      ELSE 'Employee found'
    END,
    'card_uid', public.mask_card_uid(_card_uid),
    'reader_id', BTRIM(_reader_id),
    'reader_name', COALESCE(NULLIF(BTRIM(_reader_name), ''), 'Admin RFID/NFC Reader'),
    'employee', jsonb_build_object(
      'user_id', v_employee.user_id,
      'employee_code', v_employee.employee_code,
      'full_name', v_employee.full_name,
      'department', v_employee.department,
      'position', v_employee.position,
      'avatar_url', v_employee.avatar_url
    ),
    'attendance', CASE WHEN v_attendance.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_attendance.id,
      'date', v_attendance.date,
      'status', v_attendance.status,
      'check_in_time', v_attendance.check_in_time,
      'check_out_time', v_attendance.check_out_time,
      'work_hours', v_attendance.work_hours
    ) END,
    'available_action', CASE
      WHEN v_attendance.id IS NULL OR v_attendance.check_in_time IS NULL THEN 'check_in'
      WHEN v_attendance.check_out_time IS NULL THEN 'check_out'
      ELSE 'completed'
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.register_employee_card(
  _employee_id UUID,
  _card_uid TEXT,
  _reader_id TEXT DEFAULT NULL,
  _reason TEXT DEFAULT 'Registered from Admin Card Reader Attendance'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT := public.card_uid_hash(_card_uid);
  v_last4 TEXT := public.card_uid_last4(_card_uid);
  v_employee public.profiles;
  v_existing public.employee_cards;
  v_card public.employee_cards;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorized admins or HR users can register cards';
  END IF;

  IF COALESCE(BTRIM(_card_uid), '') = '' THEN
    RAISE EXCEPTION 'Card UID is required';
  END IF;

  SELECT * INTO v_employee
  FROM public.profiles
  WHERE user_id = _employee_id
    AND approval_status = 'approved'
    AND is_suspended = false
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found or not active';
  END IF;

  SELECT * INTO v_existing
  FROM public.employee_cards
  WHERE card_uid_hash = v_hash
    AND status = 'active'
  LIMIT 1;

  IF FOUND AND v_existing.employee_id <> _employee_id THEN
    RAISE EXCEPTION 'This card is already assigned to another active employee';
  END IF;

  UPDATE public.employee_cards
  SET status = 'inactive',
      deactivated_at = now(),
      notes = COALESCE(notes, '') || E'\nReplaced by new active card registration.'
  WHERE employee_id = _employee_id
    AND status = 'active'
    AND card_uid_hash <> v_hash;

  INSERT INTO public.employee_cards (
    employee_id, card_uid_hash, card_uid_last4, status, registered_by, notes
  )
  VALUES (
    _employee_id, v_hash, v_last4, 'active', auth.uid(), NULLIF(BTRIM(_reason), '')
  )
  ON CONFLICT (card_uid_hash) WHERE status = 'active' DO UPDATE
  SET employee_id = EXCLUDED.employee_id,
      registered_by = auth.uid(),
      registered_at = now(),
      card_uid_last4 = EXCLUDED.card_uid_last4,
      notes = EXCLUDED.notes
  RETURNING * INTO v_card;

  INSERT INTO public.card_reader_attendance_events (
    employee_id, admin_id, action, card_uid_hash, card_uid_last4, reader_id, reason
  )
  VALUES (
    _employee_id, auth.uid(), 'register_card', v_hash, v_last4, NULLIF(BTRIM(_reader_id), ''), COALESCE(NULLIF(BTRIM(_reason), ''), 'Registered employee card')
  );

  INSERT INTO public.activity_logs (user_id, action, details)
  VALUES (
    auth.uid(),
    'register_employee_card',
    jsonb_build_object('employee_id', _employee_id, 'card_uid', '****' || v_last4, 'reader_id', _reader_id)
  );

  RETURN jsonb_build_object(
    'status', 'registered',
    'employee_id', _employee_id,
    'employee_name', v_employee.full_name,
    'card_uid', '****' || v_last4,
    'card_id', v_card.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_card_reader_record_attendance(
  _employee_id UUID,
  _card_uid TEXT,
  _reader_id TEXT,
  _action TEXT,
  _reason TEXT DEFAULT 'Employee missed normal attendance'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT := public.card_uid_hash(_card_uid);
  v_last4 TEXT := public.card_uid_last4(_card_uid);
  v_employee public.profiles;
  v_attendance public.attendance;
  v_old_snapshot JSONB;
  v_new public.attendance;
  v_admin_name TEXT;
  v_late_time TIME;
  v_office_end TIME;
  v_now TIMESTAMPTZ := now();
  v_status public.attendance_status;
  v_work_hours NUMERIC;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorized admins or HR users can record card reader attendance';
  END IF;

  IF _action NOT IN ('check_in', 'check_out') THEN
    RAISE EXCEPTION 'Invalid attendance action';
  END IF;

  IF COALESCE(BTRIM(_reason), '') = '' THEN
    RAISE EXCEPTION 'Reason is required';
  END IF;

  SELECT p.* INTO v_employee
  FROM public.employee_cards c
  JOIN public.profiles p ON p.user_id = c.employee_id
  WHERE c.employee_id = _employee_id
    AND c.card_uid_hash = v_hash
    AND c.status = 'active'
    AND p.approval_status = 'approved'
    AND p.is_suspended = false
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registered active card not found for this employee';
  END IF;

  SELECT full_name INTO v_admin_name FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  SELECT late_after_time::time, office_end_time::time
  INTO v_late_time, v_office_end
  FROM public.settings
  LIMIT 1;

  SELECT * INTO v_attendance
  FROM public.attendance
  WHERE user_id = _employee_id
    AND date = CURRENT_DATE
    AND deleted_at IS NULL
  FOR UPDATE;

  IF _action = 'check_in' THEN
    IF FOUND AND v_attendance.check_in_time IS NOT NULL THEN
      INSERT INTO public.card_reader_attendance_events (
        attendance_id, employee_id, admin_id, action, card_uid_hash, card_uid_last4, reader_id, reason
      )
      VALUES (v_attendance.id, _employee_id, auth.uid(), 'duplicate', v_hash, v_last4, BTRIM(_reader_id), 'Duplicate check-in prevented');
      RAISE EXCEPTION 'Employee already checked in today';
    END IF;

    v_status := CASE WHEN v_now::time > COALESCE(v_late_time, '09:15'::time) THEN 'late' ELSE 'present' END;

    IF FOUND THEN
      v_old_snapshot := public.attendance_edit_snapshot(v_attendance);

      UPDATE public.attendance
      SET check_in_time = v_now,
          status = v_status,
          is_late = v_status = 'late',
          work_location = COALESCE(NULLIF(work_location, ''), 'Office'),
          remarks = COALESCE(NULLIF(remarks, ''), BTRIM(_reason)),
          attendance_method = 'ADMIN_CARD_READER',
          card_uid_hash = v_hash,
          card_uid_last4 = v_last4,
          reader_id = BTRIM(_reader_id),
          created_by_admin_id = auth.uid(),
          admin_attendance_reason = BTRIM(_reason),
          is_edited = true,
          updated_at = now()
      WHERE id = v_attendance.id
      RETURNING * INTO v_new;
    ELSE
      INSERT INTO public.attendance (
        user_id,
        date,
        check_in_time,
        status,
        is_late,
        work_location,
        remarks,
        attendance_method,
        card_uid_hash,
        card_uid_last4,
        reader_id,
        created_by_admin_id,
        admin_attendance_reason,
        is_edited
      )
      VALUES (
        _employee_id,
        CURRENT_DATE,
        v_now,
        v_status,
        v_status = 'late',
        'Office',
        BTRIM(_reason),
        'ADMIN_CARD_READER',
        v_hash,
        v_last4,
        BTRIM(_reader_id),
        auth.uid(),
        BTRIM(_reason),
        true
      )
      RETURNING * INTO v_new;

      v_old_snapshot := '{}'::jsonb;
    END IF;
  ELSE
    IF NOT FOUND OR v_attendance.check_in_time IS NULL THEN
      RAISE EXCEPTION 'Employee has not checked in today';
    END IF;
    IF v_attendance.check_out_time IS NOT NULL THEN
      INSERT INTO public.card_reader_attendance_events (
        attendance_id, employee_id, admin_id, action, card_uid_hash, card_uid_last4, reader_id, reason
      )
      VALUES (v_attendance.id, _employee_id, auth.uid(), 'duplicate', v_hash, v_last4, BTRIM(_reader_id), 'Duplicate check-out prevented');
      RAISE EXCEPTION 'Attendance already completed for today';
    END IF;

    v_old_snapshot := public.attendance_edit_snapshot(v_attendance);
    v_work_hours := public.calculate_attendance_work_hours(v_attendance.check_in_time, v_now);

    UPDATE public.attendance
    SET check_out_time = v_now,
        work_hours = v_work_hours,
        is_early_checkout = v_now::time < COALESCE(v_office_end, '18:00'::time),
        attendance_method = 'ADMIN_CARD_READER',
        card_uid_hash = v_hash,
        card_uid_last4 = v_last4,
        reader_id = BTRIM(_reader_id),
        created_by_admin_id = auth.uid(),
        admin_attendance_reason = BTRIM(_reason),
        remarks = COALESCE(NULLIF(remarks, ''), BTRIM(_reason)),
        is_edited = true,
        updated_at = now()
    WHERE id = v_attendance.id
    RETURNING * INTO v_new;
  END IF;

  INSERT INTO public.attendance_audit_logs (
    attendance_id,
    employee_id,
    employee_name,
    original_value,
    updated_value,
    edited_by,
    edited_by_name,
    reason,
    source
  )
  VALUES (
    v_new.id,
    _employee_id,
    COALESCE(v_employee.full_name, 'Unknown employee'),
    v_old_snapshot,
    public.attendance_edit_snapshot(v_new) || jsonb_build_object(
      'attendance_method', 'ADMIN_CARD_READER',
      'card_uid', '****' || v_last4,
      'reader_id', BTRIM(_reader_id),
      'action', _action
    ),
    auth.uid(),
    COALESCE(v_admin_name, 'Administrator'),
    BTRIM(_reason),
    'admin_card_reader'
  );

  INSERT INTO public.card_reader_attendance_events (
    attendance_id, employee_id, admin_id, action, card_uid_hash, card_uid_last4, reader_id, reason
  )
  VALUES (
    v_new.id, _employee_id, auth.uid(), _action, v_hash, v_last4, BTRIM(_reader_id), BTRIM(_reason)
  );

  INSERT INTO public.activity_logs (user_id, action, details)
  VALUES (
    auth.uid(),
    'admin_card_reader_attendance',
    jsonb_build_object(
      'employee_id', _employee_id,
      'attendance_id', v_new.id,
      'action', _action,
      'reader_id', BTRIM(_reader_id),
      'card_uid', '****' || v_last4,
      'reason', BTRIM(_reason)
    )
  );

  RETURN jsonb_build_object(
    'status', 'success',
    'action', _action,
    'attendance', jsonb_build_object(
      'id', v_new.id,
      'date', v_new.date,
      'status', v_new.status,
      'check_in_time', v_new.check_in_time,
      'check_out_time', v_new.check_out_time,
      'work_hours', v_new.work_hours
    ),
    'employee', jsonb_build_object(
      'user_id', v_employee.user_id,
      'employee_code', v_employee.employee_code,
      'full_name', v_employee.full_name,
      'department', v_employee.department,
      'position', v_employee.position,
      'avatar_url', v_employee.avatar_url
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_card_reader_audit_history(_limit INT DEFAULT 50)
RETURNS TABLE (
  id UUID,
  attendance_id UUID,
  employee_id UUID,
  employee_code TEXT,
  employee_name TEXT,
  admin_id UUID,
  admin_name TEXT,
  action TEXT,
  attendance_method TEXT,
  card_uid TEXT,
  reader_id TEXT,
  reader_name TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.attendance_id,
    e.employee_id,
    employee.employee_code,
    COALESCE(employee.full_name, 'Unknown employee') AS employee_name,
    e.admin_id,
    COALESCE(admin.full_name, 'Administrator') AS admin_name,
    e.action,
    e.attendance_method,
    '****' || e.card_uid_last4 AS card_uid,
    e.reader_id,
    e.reader_name,
    e.reason,
    e.created_at
  FROM public.card_reader_attendance_events e
  LEFT JOIN public.profiles employee ON employee.user_id = e.employee_id
  LEFT JOIN public.profiles admin ON admin.user_id = e.admin_id
  WHERE public.is_admin(auth.uid())
    AND e.action IN ('check_in', 'check_out', 'register_card', 'unknown_card', 'duplicate')
  ORDER BY e.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 50), 1), 200);
$$;

GRANT EXECUTE ON FUNCTION public.admin_card_reader_status(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_card_reader_scan(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_employee_card(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_card_reader_record_attendance(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_card_reader_audit_history(INT) TO authenticated;

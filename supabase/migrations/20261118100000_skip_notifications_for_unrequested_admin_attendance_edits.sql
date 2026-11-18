-- Attendance notifications should only be emitted for employee-requested
-- corrections. A direct admin edit sets the audit context to `admin_edit`;
-- at the point this AFTER UPDATE trigger runs, a pending correction request
-- still exists when the edit was initiated from an employee request.
CREATE OR REPLACE FUNCTION public.queue_whatsapp_attendance_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    settings RECORD;
    employee_profile RECORD;
    is_late_event boolean := false;
    is_early_checkout_event boolean := false;
    target_type text;
    target_template text;
    office_start text;
    existing_record uuid;
BEGIN
    -- Do not notify an employee when an admin independently corrects their
    -- attendance. Keep notifications for edits tied to a pending employee
    -- correction request.
    IF TG_OP = 'UPDATE'
       AND current_setting('attendance.audit_context', true) = 'admin_edit'
       AND NOT EXISTS (
           SELECT 1
           FROM public.attendance_correction_requests request
           WHERE request.attendance_id = NEW.id
             AND request.user_id = NEW.user_id
             AND request.status = 'pending'
       ) THEN
        RETURN NEW;
    END IF;

    -- 1. Check if WhatsApp is globally enabled
    SELECT * INTO settings FROM public.whatsapp_settings LIMIT 1;
    IF NOT FOUND OR NOT settings.is_enabled THEN
        RETURN NEW;
    END IF;

    -- 2. Check employee preferences
    SELECT * INTO employee_profile FROM public.profiles WHERE id = NEW.user_id;
    IF NOT FOUND OR employee_profile.whatsapp_number IS NULL OR employee_profile.whatsapp_number = '' OR NOT employee_profile.whatsapp_notifications THEN
        RETURN NEW;
    END IF;

    SELECT office_start_time INTO office_start FROM settings LIMIT 1;
    IF office_start IS NULL THEN
        office_start := '09:00';
    END IF;

    -- 3. Detect check-in
    IF NEW.check_in_time IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.check_in_time IS DISTINCT FROM NEW.check_in_time) THEN
        IF NEW.is_late THEN
            target_type := 'ATTENDANCE_LATE';
            target_template := 'attendance_late_checkin';
        ELSE
            target_type := 'ATTENDANCE_CHECK_IN';
            target_template := 'attendance_checkin';
        END IF;

        IF (target_type = 'ATTENDANCE_LATE' AND settings.send_late AND employee_profile.whatsapp_late) OR
           (target_type = 'ATTENDANCE_CHECK_IN' AND settings.send_checkin AND employee_profile.whatsapp_checkin) THEN
            BEGIN
                INSERT INTO public.whatsapp_notifications (
                    employee_id, attendance_id, notification_type, recipient_number, template_name, template_parameters
                ) VALUES (
                    NEW.user_id, NEW.id, target_type, employee_profile.whatsapp_number, target_template,
                    jsonb_build_object(
                        'employee_name', employee_profile.full_name,
                        'date', NEW.date,
                        'check_in_time', NEW.check_in_time,
                        'status', NEW.status,
                        'office_start_time', office_start
                    )
                );
            EXCEPTION WHEN unique_violation THEN
                NULL;
            END;
        END IF;
    END IF;

    -- 4. Detect check-out
    IF NEW.check_out_time IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.check_out_time IS DISTINCT FROM NEW.check_out_time) THEN
        IF NEW.is_early_checkout THEN
            target_type := 'ATTENDANCE_EARLY_CHECKOUT';
            target_template := 'attendance_early_checkout';
        ELSE
            target_type := 'ATTENDANCE_CHECK_OUT';
            target_template := 'attendance_checkout';
        END IF;

        IF (target_type = 'ATTENDANCE_EARLY_CHECKOUT' AND settings.send_early AND employee_profile.whatsapp_early) OR
           (target_type = 'ATTENDANCE_CHECK_OUT' AND settings.send_checkout AND employee_profile.whatsapp_checkout) THEN
            BEGIN
                INSERT INTO public.whatsapp_notifications (
                    employee_id, attendance_id, notification_type, recipient_number, template_name, template_parameters
                ) VALUES (
                    NEW.user_id, NEW.id, target_type, employee_profile.whatsapp_number, target_template,
                    jsonb_build_object(
                        'employee_name', employee_profile.full_name,
                        'date', NEW.date,
                        'check_out_time', NEW.check_out_time,
                        'working_duration',
                            CASE
                                WHEN NEW.check_in_time IS NOT NULL THEN
                                    floor(EXTRACT(EPOCH FROM (NEW.check_out_time::time - NEW.check_in_time::time))/3600)::text || 'h ' ||
                                    floor((EXTRACT(EPOCH FROM (NEW.check_out_time::time - NEW.check_in_time::time))::numeric % 3600) / 60)::text || 'm'
                                ELSE 'Unknown'
                            END
                    )
                );
            EXCEPTION WHEN unique_violation THEN
                NULL;
            END;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

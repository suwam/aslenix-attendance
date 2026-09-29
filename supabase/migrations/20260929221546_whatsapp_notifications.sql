-- Migration to add WhatsApp integration tables and logic

-- 1. Update profiles table with WhatsApp preferences
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_number text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_notifications boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_checkin boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_checkout boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_late boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_early boolean DEFAULT true;

-- 2. Add WhatsApp Global Settings table
CREATE TABLE IF NOT EXISTS whatsapp_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    is_enabled boolean DEFAULT false,
    provider text DEFAULT 'cloud_api',
    send_checkin boolean DEFAULT true,
    send_checkout boolean DEFAULT true,
    send_late boolean DEFAULT true,
    send_early boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Ensure there is only one global settings row by using a trigger or just inserting one
INSERT INTO whatsapp_settings (is_enabled) SELECT false WHERE NOT EXISTS (SELECT 1 FROM whatsapp_settings);

-- 3. Add WhatsApp Notifications table (Queue / History)
CREATE TABLE IF NOT EXISTS whatsapp_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    attendance_id uuid REFERENCES attendance(id) ON DELETE CASCADE,
    notification_type text NOT NULL,
    recipient_number text,
    template_name text,
    template_parameters jsonb,
    provider_message_id text,
    status text DEFAULT 'PENDING',
    error_message text,
    attempt_count int DEFAULT 0,
    sent_at timestamptz,
    delivered_at timestamptz,
    read_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT whatsapp_notifications_unique_event UNIQUE (attendance_id, notification_type)
);

-- Add indexes for history/dashboard queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_employee_id ON whatsapp_notifications(employee_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_created_at ON whatsapp_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_status ON whatsapp_notifications(status);

-- Enable RLS
ALTER TABLE whatsapp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_notifications ENABLE ROW LEVEL SECURITY;

-- Admins can view/update settings
CREATE POLICY "Admins can view whatsapp settings" ON whatsapp_settings FOR SELECT USING (true);
CREATE POLICY "Admins can update whatsapp settings" ON whatsapp_settings FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.department = 'admin' OR profiles.department = 'HR')
  )
);
CREATE POLICY "Admins can insert whatsapp settings" ON whatsapp_settings FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.department = 'admin' OR profiles.department = 'HR')
  )
);

-- Notifications RLS
CREATE POLICY "Admins can manage notifications" ON whatsapp_notifications FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.department = 'admin' OR profiles.department = 'HR')
  )
);

-- Employees can view their own notifications
CREATE POLICY "Employees view own notifications" ON whatsapp_notifications FOR SELECT USING (employee_id = auth.uid());

-- 4. Create Database Trigger to queue WhatsApp notifications
-- This function gets called AFTER INSERT OR UPDATE on `attendance`
CREATE OR REPLACE FUNCTION queue_whatsapp_attendance_notification()
RETURNS TRIGGER AS $$
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
    -- 1. Check if WhatsApp is globally enabled
    SELECT * INTO settings FROM whatsapp_settings LIMIT 1;
    IF NOT FOUND OR NOT settings.is_enabled THEN
        RETURN NEW;
    END IF;

    -- 2. Check Employee Preferences
    SELECT * INTO employee_profile FROM profiles WHERE id = NEW.user_id;
    IF NOT FOUND OR employee_profile.whatsapp_number IS NULL OR employee_profile.whatsapp_number = '' OR NOT employee_profile.whatsapp_notifications THEN
        RETURN NEW;
    END IF;

    -- Retrieve office settings for late/early checks
    SELECT office_start_time INTO office_start FROM settings LIMIT 1;
    IF office_start IS NULL THEN
        office_start := '09:00';
    END IF;

    -- 3. Detect CHECK-IN
    -- Triggers if it's a new row with check_in, or check_in was just added
    IF NEW.check_in_time IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.check_in_time IS DISTINCT FROM NEW.check_in_time) THEN
        
        -- Determine if it's late
        IF NEW.is_late THEN
            target_type := 'ATTENDANCE_LATE';
            target_template := 'attendance_late_checkin';
        ELSE
            target_type := 'ATTENDANCE_CHECK_IN';
            target_template := 'attendance_checkin';
        END IF;

        -- Check if employee wants this specific notification and global setting allows it
        IF (target_type = 'ATTENDANCE_LATE' AND settings.send_late AND employee_profile.whatsapp_late) OR
           (target_type = 'ATTENDANCE_CHECK_IN' AND settings.send_checkin AND employee_profile.whatsapp_checkin) THEN
            
            -- Insert into queue (will ignore if duplicate due to unique constraint)
            BEGIN
                INSERT INTO whatsapp_notifications (
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
                -- Do nothing, already queued
            END;
        END IF;
    END IF;

    -- 4. Detect CHECK-OUT
    -- Triggers if check_out_time was just added
    IF NEW.check_out_time IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.check_out_time IS DISTINCT FROM NEW.check_out_time) THEN
        
        IF NEW.is_early_checkout THEN
            target_type := 'ATTENDANCE_EARLY_CHECKOUT';
            target_template := 'attendance_early_checkout';
        ELSE
            target_type := 'ATTENDANCE_CHECK_OUT';
            target_template := 'attendance_checkout';
        END IF;

        -- Check preferences
        IF (target_type = 'ATTENDANCE_EARLY_CHECKOUT' AND settings.send_early AND employee_profile.whatsapp_early) OR
           (target_type = 'ATTENDANCE_CHECK_OUT' AND settings.send_checkout AND employee_profile.whatsapp_checkout) THEN
            
            BEGIN
                INSERT INTO whatsapp_notifications (
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
                                    -- simple calculation for display string "8h 30m"
                                    floor(EXTRACT(EPOCH FROM (NEW.check_out_time::time - NEW.check_in_time::time))/3600)::text || 'h ' || 
                                    floor((EXTRACT(EPOCH FROM (NEW.check_out_time::time - NEW.check_in_time::time))::numeric % 3600) / 60)::text || 'm'
                                ELSE 'Unknown'
                            END
                    )
                );
            EXCEPTION WHEN unique_violation THEN
                -- Do nothing
            END;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to attendance table
DROP TRIGGER IF EXISTS trg_queue_whatsapp_attendance ON attendance;
CREATE TRIGGER trg_queue_whatsapp_attendance
AFTER INSERT OR UPDATE ON attendance
FOR EACH ROW
EXECUTE FUNCTION queue_whatsapp_attendance_notification();

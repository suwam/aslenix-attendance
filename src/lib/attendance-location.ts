import { supabase } from "@/integrations/supabase/client";

type AttendanceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  distanceMeters: number;
  radiusMeters: number;
};

type LocationSettings = {
  office_latitude: number | null;
  office_longitude: number | null;
  attendance_radius_meters: number | null;
};

export async function getVerifiedAttendanceLocation(): Promise<AttendanceLocation> {
  if (!("geolocation" in navigator)) {
    throw new Error("Location is not supported by this browser.");
  }

  const { data: settings, error } = await supabase
    .from("settings")
    .select("office_latitude,office_longitude,attendance_radius_meters")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const locationSettings = settings as LocationSettings | null;
  const officeLatitude = locationSettings?.office_latitude;
  const officeLongitude = locationSettings?.office_longitude;
  const radiusMeters = locationSettings?.attendance_radius_meters ?? 20;

  if (officeLatitude == null || officeLongitude == null) {
    throw new Error("Office location is not configured yet.");
  }

  const position = await getCurrentPosition();
  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;
  const accuracy = Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null;
  const distanceMeters = distanceBetweenMeters(officeLatitude, officeLongitude, latitude, longitude);

  if (distanceMeters > radiusMeters) {
    throw new Error(
      `You are ${Math.round(distanceMeters)}m from the office. Attendance is allowed within ${radiusMeters}m.`,
    );
  }

  return { latitude, longitude, accuracy, distanceMeters, radiusMeters };
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
    });
  });
}

function distanceBetweenMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusMeters = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return earthRadiusMeters * 2 * Math.asin(Math.sqrt(a));
}

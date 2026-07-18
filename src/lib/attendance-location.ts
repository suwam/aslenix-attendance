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

let cachedSettings: { value: LocationSettings | null; expiresAt: number } | null = null;

export async function preloadAttendanceLocationSettings() {
  await loadLocationSettings();
}

export async function getVerifiedAttendanceLocation(): Promise<AttendanceLocation> {
  if (!("geolocation" in navigator)) {
    throw new Error("Location is not supported by this browser.");
  }

  const settingsPromise = loadLocationSettings();
  const positionPromise = getCurrentPosition();

  const locationSettings = await settingsPromise;
  const officeLatitude = locationSettings?.office_latitude;
  const officeLongitude = locationSettings?.office_longitude;
  const radiusMeters = locationSettings?.attendance_radius_meters ?? 20;

  if (officeLatitude == null || officeLongitude == null) {
    throw new Error("Office location is not configured yet.");
  }

  const position = await positionPromise;
  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;
  const accuracy = Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null;
  const distanceMeters = distanceBetweenMeters(
    officeLatitude,
    officeLongitude,
    latitude,
    longitude,
  );
  const maxAccuracyMeters = Math.max(50, radiusMeters * 2);

  if (accuracy == null || accuracy > maxAccuracyMeters) {
    throw new Error(
      `Location accuracy is too low (${accuracy ? `${Math.round(accuracy)}m` : "unknown"}). Please enable precise GPS and try again near the office.`,
    );
  }

  if (distanceMeters > radiusMeters) {
    throw new Error(
      `You are ${Math.round(distanceMeters)}m from the office. Attendance is allowed within ${radiusMeters}m.`,
    );
  }

  return { latitude, longitude, accuracy, distanceMeters, radiusMeters };
}

async function loadLocationSettings(): Promise<LocationSettings | null> {
  const now = Date.now();
  if (cachedSettings && cachedSettings.expiresAt > now) return cachedSettings.value;

  const { data: settings, error } = await supabase
    .from("settings")
    .select("office_latitude,office_longitude,attendance_radius_meters")
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.message.includes("office_latitude")) {
      throw new Error("Attendance location database migration is not applied yet.");
    }

    throw new Error(error.message);
  }

  cachedSettings = {
    value: settings as LocationSettings | null,
    expiresAt: now + 5 * 60 * 1000,
  };
  return cachedSettings.value;
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, (error) => reject(locationError(error)), {
      enableHighAccuracy: true,
      maximumAge: 120000,
      timeout: 7000,
    });
  });
}

function locationError(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return new Error("Location permission was denied. Please allow location access and try again.");
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return new Error("Current location is unavailable. Please check GPS/location services.");
  }

  if (error.code === error.TIMEOUT) {
    return new Error("Location request timed out. Please try again near a clearer GPS signal.");
  }

  return new Error(error.message || "Unable to verify location.");
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

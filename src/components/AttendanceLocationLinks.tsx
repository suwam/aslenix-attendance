import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { MapPin } from "lucide-react";

type AttendanceLocationLinksProps = {
  checkInLatitude?: number | null;
  checkInLongitude?: number | null;
  checkInAccuracyMeters?: number | null;
  checkOutLatitude?: number | null;
  checkOutLongitude?: number | null;
  checkOutAccuracyMeters?: number | null;
};

type OfficeLocation = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

export function AttendanceLocationLinks({
  checkInLatitude,
  checkInLongitude,
  checkInAccuracyMeters,
  checkOutLatitude,
  checkOutLongitude,
  checkOutAccuracyMeters,
}: AttendanceLocationLinksProps) {
  const [officeLocation, setOfficeLocation] = useState<OfficeLocation | null>(null);
  const hasCheckIn = hasLocation(checkInLatitude, checkInLongitude);
  const hasCheckOut = hasLocation(checkOutLatitude, checkOutLongitude);

  useEffect(() => {
    supabase
      .from("settings")
      .select("office_latitude,office_longitude,attendance_radius_meters")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const settings = data as {
          office_latitude: number | null;
          office_longitude: number | null;
          attendance_radius_meters: number | null;
        } | null;

        if (settings?.office_latitude == null || settings.office_longitude == null) return;

        setOfficeLocation({
          latitude: settings.office_latitude,
          longitude: settings.office_longitude,
          radiusMeters: settings.attendance_radius_meters ?? 20,
        });
      });
  }, []);

  if (!hasCheckIn && !hasCheckOut) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {hasCheckIn && (
        <LocationButton
          label={locationLabel(checkInLatitude, checkInLongitude, officeLocation)}
          latitude={checkInLatitude}
          longitude={checkInLongitude}
          accuracyMeters={checkInAccuracyMeters}
        />
      )}
      {hasCheckOut && (
        <LocationButton
          label={locationLabel(checkOutLatitude, checkOutLongitude, officeLocation)}
          latitude={checkOutLatitude}
          longitude={checkOutLongitude}
          accuracyMeters={checkOutAccuracyMeters}
        />
      )}
    </div>
  );
}

function LocationButton({
  label,
  latitude,
  longitude,
  accuracyMeters,
}: {
  label: string;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  accuracyMeters: number | null | undefined;
}) {
  if (!hasLocation(latitude, longitude)) return null;

  return (
    <div className="space-y-1">
      <Button asChild variant="outline" size="sm" className="h-8 px-2">
        <a href={mapUrl(latitude, longitude)} target="_blank" rel="noreferrer">
          <MapPin size={14} />
          {label}
        </a>
      </Button>
      {accuracyMeters != null && (
        <div className="text-[10px] text-muted-foreground">+/-{Math.round(accuracyMeters)}m</div>
      )}
    </div>
  );
}

function hasLocation(latitude: number | null | undefined, longitude: number | null | undefined) {
  return typeof latitude === "number" && typeof longitude === "number";
}

function mapUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function locationLabel(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  officeLocation: OfficeLocation | null,
) {
  if (!hasLocation(latitude, longitude) || !officeLocation) return "View";

  const distanceMeters = distanceBetweenMeters(
    officeLocation.latitude,
    officeLocation.longitude,
    latitude,
    longitude,
  );

  return distanceMeters <= officeLocation.radiusMeters ? "Office" : "Map";
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

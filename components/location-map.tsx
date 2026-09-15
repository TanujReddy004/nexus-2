
"use client";

import { useEffect, useRef, useState } from "react";

import {
  Map as NexusMap,
  MapFullscreenControl,
  MapLocateControl,
  MapMarker,
  MapTileLayer,
  MapZoomControl,
} from "@/components/ui/map";
import {
  getGoogleMapsConstructors,
  isGoogleMapsConfigured,
  loadGoogleMaps,
  type GoogleMapInstance,
  type GoogleMarkerInstance,
  type NexusMapPoint,
} from "@/lib/maps-google";

type LocationMapProvider = "auto" | "google" | "leaflet";

export default function LocationMap({
  location,
  height = 280,
  provider = "auto",
}: {
  location: NexusMapPoint | null;
  height?: number;
  provider?: LocationMapProvider;
}) {
  const useLeaflet =
    provider === "leaflet" ||
    (provider === "auto" && !isGoogleMapsConfigured());

  const [googleStatus, setGoogleStatus] = useState<
    "loading" | "ready" | "error"
  >(provider === "leaflet" ? "error" : "loading");

  const [googleError, setGoogleError] = useState("");

  useEffect(() => {
    if (useLeaflet) {
      return;
    }

    let cancelled = false;

    const initializeGoogleMaps = async () => {
      try {
        await loadGoogleMaps();

        if (!cancelled) {
          setGoogleStatus("ready");
        }
      } catch (error) {
        console.error(
          "[NEXUS-MAPS] Failed to initialize Google Maps:",
          error
        );

        if (!cancelled) {
          setGoogleStatus("error");
          setGoogleError(
            error instanceof Error
              ? error.message
              : "Unable to load Google Maps."
          );
        }
      }
    };

    void initializeGoogleMaps();

    return () => {
      cancelled = true;
    };
  }, [useLeaflet]);

  /*
   * Auto mode:
   * Google Maps is preferred when configured.
   * Otherwise NEXUS uses shadcn-map / Leaflet.
   */
  if (useLeaflet) {
    return (
      <LeafletLocationMap
        location={location}
        height={height}
      />
    );
  }

  /*
   * If Google Maps fails in auto mode,
   * gracefully fall back to Leaflet.
   */
  if (googleStatus === "error") {
    if (provider === "auto") {
      return (
        <LeafletLocationMap
          location={location}
          height={height}
        />
      );
    }

    return (
      <div
        className="grid place-items-center rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 text-center"
        style={{ height }}
      >
        <div>
          <p className="text-xs font-semibold text-amber-300">
            Google Maps unavailable
          </p>

          <p className="mt-1 text-[10px] leading-4 text-zinc-500">
            {googleError || "Unable to load Google Maps."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <GoogleLocationMap
      location={location}
      height={height}
      status={googleStatus}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Google Maps                                                                 */
/* -------------------------------------------------------------------------- */

function GoogleLocationMap({
  location,
  height,
  status,
}: {
  location: NexusMapPoint | null;
  height: number;
  status: "loading" | "ready";
}) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);

  const mapRef = useRef<GoogleMapInstance | null>(null);

  const markerRef = useRef<GoogleMarkerInstance | null>(null);

  const [mapReady, setMapReady] = useState(false);

  /*
   * Initialize Google Maps once when the API is ready.
   *
   * The initial location is intentionally handled by the
   * separate location-update effect below. This prevents
   * the entire map from being recreated whenever the
   * user's location changes.
   */
  useEffect(() => {
    if (status !== "ready" || !mapElementRef.current) {
      return;
    }

    const mapElement = mapElementRef.current;

    const { Map } = getGoogleMapsConstructors();

    const map = new Map(mapElement, {
      center: {
        lat: 20,
        lng: 0,
      },
      zoom: 2,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      clickableIcons: true,
      gestureHandling: "greedy",
    });

    mapRef.current = map;
    setMapReady(true);

    return () => {
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
      setMapReady(false);
    };
  }, [status]);

  /*
   * Update the map center and marker when the location changes.
   */
  useEffect(() => {
    if (!mapReady || !mapRef.current || !location) {
      return;
    }

    const point = {
      lat: location.latitude,
      lng: location.longitude,
    };

    mapRef.current.setCenter(point);
    mapRef.current.setZoom(15);

    if (markerRef.current) {
      markerRef.current.setPosition(point);
      return;
    }

    try {
      const { Marker } = getGoogleMapsConstructors();

      markerRef.current = new Marker({
        position: point,
        map: mapRef.current,
        title: "NEXUS current location",
      });
    } catch (error) {
      console.error(
        "[NEXUS-MAPS] Failed to create Google Maps marker:",
        error
      );
    }
  }, [location, mapReady]);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border"
      style={{
        borderColor: "var(--nexus-border)",
      }}
    >
      {status === "loading" && (
        <div
          className="absolute inset-0 z-10 grid place-items-center bg-[#0c0c11] text-[10px] text-zinc-500"
          style={{ height }}
        >
          Loading Google Maps...
        </div>
      )}

      <div
        ref={mapElementRef}
        data-nexus-google-map
        style={{
          height,
          width: "100%",
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* shadcn-map / Leaflet                                                        */
/* -------------------------------------------------------------------------- */

function LeafletLocationMap({
  location,
  height,
}: {
  location: NexusMapPoint | null;
  height: number;
}) {
  const center: [number, number] = location
    ? [location.latitude, location.longitude]
    : [20, 0];

  return (
    <div
      className="relative overflow-hidden rounded-2xl border"
      style={{
        borderColor: "var(--nexus-border)",
        height,
      }}
    >
      <NexusMap
        center={center}
        zoom={location ? 15 : 2}
        className="min-h-0 h-full rounded-none"
      >
        <MapTileLayer name="NEXUS" />

        <MapZoomControl />

        <MapFullscreenControl />

        <MapLocateControl />

        {location && (
          <MapMarker
            position={[
              location.latitude,
              location.longitude,
            ]}
            title="NEXUS current location"
          />
        )}
      </NexusMap>
    </div>
  );
}
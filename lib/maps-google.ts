let mapsLoadPromise: Promise<void> | null = null;

export type NexusMapPoint = {
  latitude: number;
  longitude: number;
};

export type NexusGoogleMapPoint = {
  lat: number;
  lng: number;
};

type GoogleMapConstructor = new (
  element: HTMLElement,
  options: Record<string, unknown>
) => GoogleMapInstance;

type GoogleMarkerConstructor = new (
  options: Record<string, unknown>
) => GoogleMarkerInstance;

type GoogleMapsApi = {
  Map?: GoogleMapConstructor;
  Marker?: GoogleMarkerConstructor;
  importLibrary?: (
    libraryName: "maps" | "marker"
  ) => Promise<Record<string, unknown>>;
};

type GoogleMapsWindow = Window & {
  google?: {
    maps?: GoogleMapsApi;
  };
};

let googleMapConstructor: GoogleMapConstructor | null = null;
let googleMarkerConstructor: GoogleMarkerConstructor | null = null;

export type GoogleMapInstance = {
  setCenter: (point: NexusGoogleMapPoint) => void;
  setZoom: (zoom: number) => void;
};

export type GoogleMarkerInstance = {
  setPosition: (point: NexusGoogleMapPoint) => void;
  setMap: (map: GoogleMapInstance | null) => void;
};

export function getGoogleMapsApiKey(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
}

export function isGoogleMapsConfigured(): boolean {
  const apiKey = getGoogleMapsApiKey();

  if (!apiKey) {
    return false;
  }

  const placeholderKeys = new Set([
    "YOUR_GOOGLE_MAPS_API_KEY",
    "your_google_maps_api_key",
  ]);

  return !placeholderKeys.has(apiKey);
}

export async function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error(
      "Google Maps can only be loaded in a browser environment."
    );
  }

  if (
    googleMapConstructor &&
    googleMarkerConstructor
  ) {
    return;
  }

  const googleWindow = window as GoogleMapsWindow;

  /*
   * If Google Maps is already available and exposes usable
   * constructors, use the existing API instead of loading
   * another script.
   */
  const existingMaps = googleWindow.google?.maps;

  if (
    existingMaps?.Map &&
    existingMaps?.Marker &&
    typeof existingMaps.Map === "function" &&
    typeof existingMaps.Marker === "function"
  ) {
    googleMapConstructor = existingMaps.Map;
    googleMarkerConstructor = existingMaps.Marker;
    return;
  }

  if (!mapsLoadPromise) {
    const apiKey = getGoogleMapsApiKey();

    if (!apiKey) {
      throw new Error(
        "Google Maps is not configured. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local."
      );
    }

    mapsLoadPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-nexus-google-maps="true"]'
      );

      if (existingScript) {
        /*
         * The script may already have finished loading.
         * Check immediately before attaching listeners.
         */
        const currentMaps = (
          window as GoogleMapsWindow
        ).google?.maps;

        if (
          currentMaps?.Map &&
          currentMaps?.Marker &&
          typeof currentMaps.Map === "function" &&
          typeof currentMaps.Marker === "function"
        ) {
          resolve();
          return;
        }

        const handleLoad = () => {
          resolve();
        };

        const handleError = () => {
          reject(
            new Error("Google Maps failed to load.")
          );
        };

        existingScript.addEventListener(
          "load",
          handleLoad,
          { once: true }
        );

        existingScript.addEventListener(
          "error",
          handleError,
          { once: true }
        );

        return;
      }

      const script = document.createElement("script");

      script.async = true;
      script.defer = true;
      script.dataset.nexusGoogleMaps = "true";

      script.src =
        `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
          apiKey
        )}&loading=async&v=weekly`;

      script.onload = () => {
        resolve();
      };

      script.onerror = () => {
        reject(
          new Error("Google Maps failed to load.")
        );
      };

      document.head.appendChild(script);
    }).catch((error) => {
      mapsLoadPromise = null;
      throw error;
    });
  }

  await mapsLoadPromise;

  const maps = (window as GoogleMapsWindow).google?.maps;

  if (!maps) {
    mapsLoadPromise = null;

    throw new Error(
      "Google Maps loaded, but the Maps JavaScript API is unavailable."
    );
  }

  /*
   * Modern Google Maps API.
   */
  if (typeof maps.importLibrary === "function") {
    try {
      const mapsLibrary = await maps.importLibrary("maps");
      const markerLibrary = await maps.importLibrary("marker");

      const MapConstructor = mapsLibrary.Map as
        | GoogleMapConstructor
        | undefined;

      const MarkerConstructor = markerLibrary.Marker as
        | GoogleMarkerConstructor
        | undefined;

      if (
        typeof MapConstructor === "function" &&
        typeof MarkerConstructor === "function"
      ) {
        googleMapConstructor = MapConstructor;
        googleMarkerConstructor = MarkerConstructor;
        return;
      }
    } catch (error) {
      console.warn(
        "[NEXUS-MAPS] Modern Google Maps library loading failed. Trying existing constructors.",
        error
      );
    }
  }

  /*
   * Compatibility fallback for an already-loaded Google Maps API.
   */
  if (
    typeof maps.Map === "function" &&
    typeof maps.Marker === "function"
  ) {
    googleMapConstructor = maps.Map;
    googleMarkerConstructor = maps.Marker;
    return;
  }

  mapsLoadPromise = null;

  throw new Error(
    "Google Maps loaded, but usable Map and Marker constructors are unavailable."
  );
}

export function getGoogleMapsConstructors(): {
  Map: GoogleMapConstructor;
  Marker: GoogleMarkerConstructor;
} {
  if (
    !googleMapConstructor ||
    !googleMarkerConstructor
  ) {
    throw new Error(
      "Google Maps libraries are not ready. Call loadGoogleMaps() first."
    );
  }

  return {
    Map: googleMapConstructor,
    Marker: googleMarkerConstructor,
  };
}
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import { ArrowLeft } from "lucide-react";
import { GoogleMap, InfoWindow, Marker, useJsApiLoader } from "@react-google-maps/api";
import { api } from "../api/client";
import { Box } from "../components/Box";

type MapPoint = {
  resellerId: string;
  name: string;
  companyName?: string;
  city?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  devicesCount: number;
  consignmentsCount: number;
  debtBalanceCents: number;
};

const BUENOS_AIRES_CENTER = { lat: -37.2, lng: -60 };
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

function ResellersMapGoogle({ geolocated }: { points: MapPoint[]; geolocated: MapPoint[]; error: string | null }) {
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    preventGoogleFontsLoading: true
  });

  const onMapLoad = useCallback((map: google.maps.Map) => {
    googleMapRef.current = map;
    if (geolocated.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      geolocated.forEach((p) => bounds.extend({ lat: p.latitude!, lng: p.longitude! }));
      map.fitBounds(bounds, 60);
    }
  }, [geolocated]);

  const onMapUnmount = useCallback(() => {
    googleMapRef.current = null;
  }, []);

  if (!isLoaded) {
    return (
      <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--silva-bg)" }}>
        Cargando mapa…
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={MAP_CONTAINER_STYLE}
      center={geolocated.length ? { lat: geolocated[0].latitude!, lng: geolocated[0].longitude! } : BUENOS_AIRES_CENTER}
      zoom={geolocated.length ? 6 : 5}
      onLoad={onMapLoad}
      onUnmount={onMapUnmount}
      options={{ mapTypeControl: true, streetViewControl: false, fullscreenControl: true, zoomControl: true }}
    >
      {geolocated.map((point) => (
        <Marker
          key={point.resellerId}
          position={{ lat: point.latitude!, lng: point.longitude! }}
          onClick={() => setSelectedPoint(point)}
          title={point.name}
        />
      ))}
      {selectedPoint && (
        <InfoWindow
          position={{ lat: selectedPoint.latitude!, lng: selectedPoint.longitude! }}
          onCloseClick={() => setSelectedPoint(null)}
        >
          <div style={{ padding: 4, minWidth: 200 }}>
            <strong>{selectedPoint.name}</strong>
            <br />
            {selectedPoint.companyName && <>{selectedPoint.companyName}<br /></>}
            {selectedPoint.city && <>{selectedPoint.city}{selectedPoint.address ? ` - ${selectedPoint.address}` : ""}<br /></>}
            Equipos: {selectedPoint.devicesCount} | Consignación: {selectedPoint.consignmentsCount}
            <br />
            Deuda: {(selectedPoint.debtBalanceCents / 100).toFixed(2)} USD
            <br />
            <Link to={`/resellers/${selectedPoint.resellerId}`} className="silva-link">Abrir perfil</Link>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}

function ResellersMapLeaflet({ geolocated }: { geolocated: MapPoint[] }) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    const center: [number, number] = geolocated.length
      ? [geolocated[0].latitude!, geolocated[0].longitude!]
      : [-34.6037, -58.3816];
    if (!leafletMapRef.current) {
      leafletMapRef.current = L.map(mapRef.current).setView(center, 6);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(leafletMapRef.current);
    }
    const map = leafletMapRef.current;
    map.setView(center, 6);
    map.eachLayer((layer: L.Layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });
    for (const point of geolocated) {
      const marker = L.marker([point.latitude!, point.longitude!]).addTo(map);
      marker.bindPopup(
        `<strong>${point.name}</strong><br/>${point.companyName ?? "-"}<br/>${point.city ?? ""} ${
          point.address ? `- ${point.address}` : ""
        }<br/>Equipos: ${point.devicesCount}<br/>Consignación activa: ${point.consignmentsCount}<br/>Deuda: ${(
          point.debtBalanceCents / 100
        ).toFixed(2)} USD<br/><a href="/resellers/${point.resellerId}">Abrir perfil</a>`
      );
    }
  }, [geolocated]);

  return <div ref={mapRef} style={{ height: "100%", width: "100%" }} />;
}

export function ResellersMapPage() {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  useEffect(() => {
    api
      .get("/resellers/map/overview")
      .then((res) => setPoints(res.data.points ?? []))
      .catch(() => setError("No se pudo cargar el mapa de revendedores."));
  }, []);

  const geolocated = useMemo(
    () => points.filter((p) => typeof p.latitude === "number" && typeof p.longitude === "number"),
    [points]
  );

  const useGoogle = Boolean(googleMapsApiKey);

  return (
    <div>
      <div className="silva-page-header">
        <Link to="/resellers" className="silva-btn" style={{ marginBottom: 8, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={18} /> Volver a revendedores
        </Link>
        <h2 className="silva-page-title">Mapa de revendedores</h2>
        {!googleMapsApiKey && (
          <p className="silva-helper" style={{ marginTop: 4 }}>
            Usando OpenStreetMap. Para Google Maps, configurá <code>VITE_GOOGLE_MAPS_API_KEY</code> en <code>.env</code>.
          </p>
        )}
        {points.length > 0 && geolocated.length === 0 && (
          <p className="silva-alert" style={{ marginTop: 8 }}>
            Ningún revendedor tiene ubicación en el mapa. Agregá ciudad en cada perfil y usá &quot;Geocodificar&quot;, o ejecutá desde la API: <code>npx tsx apps/api/src/scripts/updateResellerLocations.ts</code>
          </p>
        )}
      </div>
      {error && <div className="silva-alert">{error}</div>}

      <Box className="mb-6">
        <div style={{ height: "420px", borderRadius: "12px", overflow: "hidden" }}>
          {useGoogle ? (
            <ResellersMapGoogle points={points} geolocated={geolocated} error={error} />
          ) : (
            <ResellersMapLeaflet geolocated={geolocated} />
          )}
        </div>
      </Box>

      <Box className="p-0 overflow-hidden">
        <div className="silva-table-wrap">
          <table className="silva-table">
            <thead>
              <tr>
                <th>Revendedor</th>
                <th>Empresa</th>
                <th>Ciudad</th>
                <th>Equipos</th>
                <th>Consignación</th>
                <th>Deuda</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.resellerId}>
                  <td>{p.name}</td>
                  <td>{p.companyName ?? "-"}</td>
                  <td>{p.city ?? "-"}</td>
                  <td>{p.devicesCount}</td>
                  <td>{p.consignmentsCount}</td>
                  <td>{(p.debtBalanceCents / 100).toFixed(2)} USD</td>
                  <td>
                    <Link to={`/resellers/${p.resellerId}`} className="silva-btn">
                      Ver perfil
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Box>
    </div>
  );
}

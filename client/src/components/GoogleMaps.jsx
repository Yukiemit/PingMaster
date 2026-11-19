// Real Google maps for the session screens (Maps JavaScript API via @vis.gl/react-google-maps).
import { useEffect, useState } from 'react';
import { APIProvider, AdvancedMarker, Map, Polyline, useMap } from '@vis.gl/react-google-maps';
import { getConfig } from '../lib/config.js';

// Returns the browser key once loaded: undefined while loading, '' when maps are off.
export function useMapsKey() {
  const [key, setKey] = useState();
  useEffect(() => { getConfig().then((c) => setKey(c.mapsEnabled ? c.mapsKey : '')); }, []);
  return key;
}

export function MapsProvider({ apiKey, children }) {
  return <APIProvider apiKey={apiKey} language="en" region="PH">{children}</APIProvider>;
}

// Zooms the map so every point is visible.
function FitBounds({ points }) {
  const map = useMap();
  const sig = points.map((p) => `${p.lat},${p.lng}`).join('|');
  useEffect(() => {
    if (!map || !points.length || !window.google?.maps) return;
    if (points.length === 1) { map.setCenter(points[0]); map.setZoom(16); return; }
    const b = new window.google.maps.LatLngBounds();
    points.forEach((p) => b.extend(p));
    map.fitBounds(b, 48);
  }, [map, sig]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

const MeetupPin = () => <div className="gm-pin gm-pin--meet" aria-label="Meetup spot"><span>You</span></div>;

function BaseMap({ center, children, className = '' }) {
  return (
    <Map
      className={`gmap ${className}`}
      mapId="DEMO_MAP_ID"
      defaultCenter={center}
      defaultZoom={15}
      gestureHandling="cooperative"
      disableDefaultUI
      zoomControl
      clickableIcons={false}
    >
      {children}
    </Map>
  );
}

// Matching step: the meetup spot plus a numbered pin for each match.
export function MatchesMap({ meetup, matches, activeId, onSelect }) {
  const points = [meetup, ...matches.map((r) => ({ lat: r.lat, lng: r.lng }))];
  return (
    <BaseMap center={meetup}>
      <FitBounds points={points} />
      <AdvancedMarker position={meetup} title={meetup.label || 'Meetup spot'} zIndex={1000}><MeetupPin /></AdvancedMarker>
      {matches.map((r, i) => (
        <AdvancedMarker key={r.id} position={{ lat: r.lat, lng: r.lng }} title={r.name} onClick={() => onSelect?.(r.id)} zIndex={r.id === activeId ? 999 : i}>
          <div className={`gm-pin${r.id === activeId ? ' gm-pin--active' : ''}`}><span>{i + 1}</span></div>
        </AdvancedMarker>
      ))}
    </BaseMap>
  );
}

// Results step: walking route from the meetup spot to the picked place.
export function RouteMap({ from, to, polyline }) {
  return (
    <BaseMap center={from} className="gmap--route">
      <FitBounds points={[from, to]} />
      {polyline && <Polyline encodedPath={polyline} strokeColor="#1e6340" strokeOpacity={0.95} strokeWeight={6} />}
      <AdvancedMarker position={from} title={from.label || 'Meetup spot'}><MeetupPin /></AdvancedMarker>
      <AdvancedMarker position={to} title={to.name}><div className="gm-pin gm-pin--dest" aria-label={to.name} /></AdvancedMarker>
    </BaseMap>
  );
}

// Meetup picker: shows the chosen spot; drag the pin to fix it.
export function SpotMap({ spot, onMove }) {
  return (
    <BaseMap center={spot} className="gmap--spot">
      <FitBounds points={[spot]} />
      <AdvancedMarker
        position={spot}
        draggable
        title="Drag to adjust the meetup spot"
        onDragEnd={(e) => e.latLng && onMove({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
      >
        <MeetupPin />
      </AdvancedMarker>
    </BaseMap>
  );
}

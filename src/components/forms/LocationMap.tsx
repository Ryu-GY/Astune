"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./LocationMap.module.css";

export type MapCoordinates = { latitude: number; longitude: number };

export default function LocationMap({ latitude, longitude, onChoose }: MapCoordinates & {
  onChoose: (point: MapCoordinates) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const initialPoint = useRef({ latitude, longitude });
  const chooseRef = useRef(onChoose);
  const [tileError, setTileError] = useState(false);

  useEffect(() => { chooseRef.current = onChoose; }, [onChoose]);

  useEffect(() => {
    if (!container.current) return;
    const initial = initialPoint.current;
    const map = L.map(container.current, {
      center: [initial.latitude, initial.longitude], zoom: 7, minZoom: 2, maxZoom: 18,
      scrollWheelZoom: false, worldCopyJump: true,
    });
    mapRef.current = map;
    L.tileLayer(process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 18, keepBuffer: 1,
    }).on("tileerror", () => setTileError(true)).addTo(map);
    const marker = L.marker([initial.latitude, initial.longitude], {
      draggable: true, title: "선택한 출생 위치", alt: "선택한 출생 위치",
      icon: L.divIcon({ className: styles.marker, html: "<span></span>", iconSize: [26, 26], iconAnchor: [13, 13] }),
    }).addTo(map);
    markerRef.current = marker;
    const choose = (point: L.LatLng) => {
      const wrapped = point.wrap();
      const coords = { latitude: Number(Math.max(-90, Math.min(90, wrapped.lat)).toFixed(6)), longitude: Number(wrapped.lng.toFixed(6)) };
      marker.setLatLng([coords.latitude, coords.longitude]);
      chooseRef.current(coords);
    };
    map.on("click", event => choose(event.latlng));
    marker.on("dragend", () => choose(marker.getLatLng()));
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return;
    markerRef.current?.setLatLng([latitude, longitude]);
    const map = mapRef.current;
    if (map && !map.getBounds().contains([latitude, longitude])) map.panTo([latitude, longitude], { animate: false });
  }, [latitude, longitude]);

  return <div className={styles.picker}>
    <p className={styles.help} id="map-help">지도를 확대해 태어난 곳을 누르세요. 위도·경도와 시간대를 함께 채워요.</p>
    <div ref={container} className={styles.map} role="region" aria-label="출생 위치 선택 지도" aria-describedby="map-help" />
    <div className={styles.tools}>
      <button type="button" className={styles.centerButton} onClick={() => {
        const center = mapRef.current?.getCenter().wrap();
        if (center) onChoose({ latitude: Number(center.lat.toFixed(6)), longitude: Number(center.lng.toFixed(6)) });
      }}>지도 중심 위치 선택</button>
      <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">지도 오류 제보</a>
    </div>
    <p className={styles.help}>지도에 초점을 맞추고 방향키로 이동하거나 + / − 키로 확대·축소할 수 있어요.</p>
    {tileError ? <p className={styles.help} role="status">지도 일부를 불러오지 못했어요. 아래에서 좌표를 직접 입력할 수 있습니다.</p> : null}
  </div>;
}

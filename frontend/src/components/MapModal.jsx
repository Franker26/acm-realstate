import React, { useEffect, useState } from 'react'

export default function MapModal({ address, onClose }) {
  const [coords, setCoords] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!address) return
    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&countrycodes=ar&format=json&limit=1`,
      { headers: { 'Accept-Language': 'es', 'User-Agent': 'ACMRealEstate/1.0' } }
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.length === 0) { setError('No se encontró la dirección en el mapa.'); return }
        setCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) })
      })
      .catch(() => setError('No se pudo cargar el mapa.'))
  }, [address])

  const mapSrc = coords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${coords.lon - 0.012},${coords.lat - 0.008},${coords.lon + 0.012},${coords.lat + 0.008}&layer=mapnik&marker=${coords.lat},${coords.lon}`
    : null

  return (
    <div className="map-modal-backdrop" onClick={onClose}>
      <div className="map-modal" onClick={(e) => e.stopPropagation()}>
        <div className="map-modal__header">
          <span className="map-modal__title">{address}</span>
          <button type="button" className="map-modal__close" onClick={onClose}>×</button>
        </div>
        <div className="map-modal__body">
          {!coords && !error && (
            <div className="map-modal__loading">
              <span className="spinner" />
              <span>Buscando dirección…</span>
            </div>
          )}
          {error && <div className="map-modal__error">{error}</div>}
          {mapSrc && (
            <iframe
              src={mapSrc}
              title="Mapa de la dirección"
              className="map-modal__iframe"
              loading="lazy"
            />
          )}
        </div>
        {coords && (
          <div className="map-modal__footer">
            <a
              href={`https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lon}#map=16/${coords.lat}/${coords.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="map-modal__osm-link"
            >
              Abrir en OpenStreetMap ↗
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

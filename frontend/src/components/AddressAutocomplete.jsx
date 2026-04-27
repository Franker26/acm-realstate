import React, { useEffect, useRef, useState } from 'react'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function AddressAutocomplete({ value, onChange, placeholder, tabIndex, name }) {
  const [query, setQuery] = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef(null)
  const debouncedQuery = useDebounce(query, 450)

  // Sync external value changes (e.g. form reset)
  useEffect(() => { setQuery(value || '') }, [value])

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 4) {
      setSuggestions([])
      setOpen(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(debouncedQuery)}&countrycodes=ar&format=json&limit=6&addressdetails=1`,
      {
        signal: controller.signal,
        headers: { 'Accept-Language': 'es', 'User-Agent': 'ACMRealEstate/1.0' },
      }
    )
      .then((r) => r.json())
      .then((data) => {
        setSuggestions(data)
        setOpen(data.length > 0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [debouncedQuery])

  // Close on outside click
  useEffect(() => {
    function onOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  function formatLabel(s) {
    // Shorten Nominatim's verbose display_name to something readable
    const parts = s.display_name.split(', ')
    // Keep first 4 meaningful parts
    return parts.slice(0, 4).join(', ')
  }

  function select(s) {
    const label = formatLabel(s)
    setQuery(label)
    onChange(label)
    setSuggestions([])
    setOpen(false)
  }

  function handleInput(e) {
    const v = e.target.value
    setQuery(v)
    onChange(v)
  }

  return (
    <div className="ac-wrapper" ref={containerRef}>
      <input
        type="text"
        name={name}
        value={query}
        tabIndex={tabIndex}
        placeholder={placeholder}
        onChange={handleInput}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        autoComplete="off"
      />
      {loading && <div className="ac-loading">Buscando…</div>}
      {open && suggestions.length > 0 && (
        <ul className="ac-dropdown">
          {suggestions.map((s, i) => (
            <li key={i} onMouseDown={() => select(s)}>
              <span className="ac-icon">📍</span>
              {formatLabel(s)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

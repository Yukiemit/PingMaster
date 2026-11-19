// Type-ahead place search (Google Places Autocomplete through our server).
// Suggestions appear after 2 letters; pick with the mouse or the arrow keys + Enter.
import { useEffect, useId, useRef, useState } from 'react';
import { get } from '../lib/api.js';
import { distance } from '../lib/format.js';

const newToken = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);

export default function PlaceSearch({ near, onPick, onError, disabled, placeholder = 'Or type a place (e.g. UP Diliman)' }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(false);
  const token = useRef(null); // one billing session per search, from first letter to pick
  const box = useRef(null);
  const listId = useId();

  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) { setItems([]); setLoading(false); return undefined; }
    token.current ||= newToken();
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const nearQ = near ? `&lat=${near.lat}&lng=${near.lng}` : '';
        const { suggestions } = await get(`/places/autocomplete?q=${encodeURIComponent(text)}&token=${token.current}${nearQ}`);
        if (cancelled) return;
        setItems(suggestions);
        setActive(suggestions.length ? 0 : -1);
        setOpen(true);
      } catch (e) {
        if (!cancelled) { setItems([]); onError?.(e.message); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close when clicking elsewhere.
  useEffect(() => {
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const pick = async (item) => {
    setOpen(false);
    setPicking(true);
    onError?.('');
    try {
      const { place } = await get(`/places/details/${encodeURIComponent(item.placeId)}?token=${token.current || ''}`);
      token.current = null;
      setQ('');
      setItems([]);
      await onPick({ ...place, label: item.main || place.label });
    } catch (e) { onError?.(e.message); } finally { setPicking(false); }
  };

  const onKey = (e) => {
    if (!open || !items.length) { if (e.key === 'ArrowDown' && items.length) setOpen(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + items.length) % items.length); }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[active]) pick(items[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  const showList = open && q.trim().length >= 2;
  return (
    <div className="psearch" ref={box}>
      <input
        className="input psearch__input"
        placeholder={picking ? 'Getting the location…' : placeholder}
        value={q}
        disabled={disabled || picking}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => items.length && setOpen(true)}
        onKeyDown={onKey}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        aria-label="Search for a meetup spot"
        autoComplete="off"
      />
      {loading && <span className="psearch__spin" aria-hidden="true" />}
      {showList && (
        <ul className="psearch__list" id={listId} role="listbox">
          {items.map((it, i) => (
            <li
              key={it.placeId}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(it); }}
            >
              <span className="psearch__pin" aria-hidden="true">📍</span>
              <span className="psearch__text">
                <strong>{it.main}</strong>
                {it.secondary && <small>{it.secondary}</small>}
              </span>
              {it.distanceMeters != null && near && <em>{distance(it.distanceMeters)}</em>}
            </li>
          ))}
          {!loading && items.length === 0 && <li className="psearch__empty" role="presentation">No places found. Try another name.</li>}
          <li className="psearch__credit" role="presentation">Powered by Google</li>
        </ul>
      )}
    </div>
  );
}

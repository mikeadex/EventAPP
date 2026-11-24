'use client';

/**
 * How an event is attended. The database never modelled this as one field —
 * `isOnline`, `venueId` and `onlineUrl` are independent — so a hybrid event is
 * simply one with both a venue and a stream. Only the forms forced an
 * either/or, which is why hybrids could not be created.
 */
export const LOCATION_MODES = [
  { value: 'in_person', label: 'In person', hint: 'People come to a venue.' },
  { value: 'online', label: 'Online', hint: 'Streamed only — no venue.' },
  { value: 'hybrid', label: 'Both', hint: 'People can come along or watch the stream.' },
] as const;

export type LocationMode = (typeof LOCATION_MODES)[number]['value'];

/** Derives the mode from a stored event. */
export function modeOf(e: { isOnline: boolean; venue?: unknown }): LocationMode {
  if (e.isOnline && e.venue) return 'hybrid';
  return e.isOnline ? 'online' : 'in_person';
}

export function LocationModePicker({
  value,
  onChange,
  disabled,
}: {
  value: LocationMode;
  onChange: (next: LocationMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span id="location-mode-label" className="label">
        How can people attend?
      </span>
      <div role="radiogroup" aria-labelledby="location-mode-label" className="flex flex-wrap gap-2">
        {LOCATION_MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={value === m.value}
            disabled={disabled}
            onClick={() => onChange(m.value)}
            className={`chip disabled:opacity-50 ${value === m.value ? 'on' : ''}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <span className="hint">{LOCATION_MODES.find((m) => m.value === value)?.hint}</span>
    </div>
  );
}

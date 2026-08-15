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
    <div>
      <span className="text-sm font-medium text-ink-700">How can people attend?</span>
      <div className="mt-2 flex gap-2">
        {LOCATION_MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(m.value)}
            className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors disabled:opacity-50 ${
              value === m.value
                ? 'border-ink-900 bg-ink-900 text-white'
                : 'border-ink-200 text-ink-700 hover:bg-ink-100'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <span className="mt-1 block text-xs text-ink-400">
        {LOCATION_MODES.find((m) => m.value === value)?.hint}
      </span>
    </div>
  );
}

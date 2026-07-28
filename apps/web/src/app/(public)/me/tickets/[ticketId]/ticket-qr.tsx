'use client';

import QRCode from 'react-qr-code';

/**
 * Wrapper around react-qr-code so the page component stays a server component
 * while we keep the SVG renderer client-side (avoids dragging React DOM diffs
 * into RSC streaming).
 *
 * `size` defaults to 224 (full ticket page); pass 72 for inline list cards.
 */
export function TicketQr({ value, size = 224 }: { value: string; size?: number }) {
  return (
    <QRCode
      value={value}
      size={size}
      // High error-correction makes the code scan reliably even on a phone
      // screen with reflections or partial smudges.
      level="H"
      bgColor="#FFFFFF"
      fgColor="#16140F"
    />
  );
}

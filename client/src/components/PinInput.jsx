import { useRef } from 'react';

// Four single-digit boxes that behave like one field (typing, backspace, paste).
export default function PinInput({ value, onChange, label = 'Four-digit PIN', className = '' }) {
  const refs = useRef([]);
  const digits = Array.from({ length: 4 }, (_, i) => value[i] || '');

  const set = (i, d) => {
    const next = digits.slice();
    next[i] = d;
    onChange(next.join('').slice(0, 4));
  };

  return (
    <div className={`pin ${className}`} role="group" aria-label={label}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          aria-label={`PIN digit ${i + 1}`}
          value={d}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(-1);
            set(i, v);
            if (v && i < 3) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
          }}
          onPaste={(e) => {
            const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
            if (p) { e.preventDefault(); onChange(p); refs.current[Math.min(p.length, 3)]?.focus(); }
          }}
        />
      ))}
    </div>
  );
}

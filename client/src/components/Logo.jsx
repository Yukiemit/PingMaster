// Saan Tayo? mark: a three-part plate (red, green, yellow) with a question mark.
const C = { cx: 50, cy: 55, r: 41 };
const pt = (deg) => {
  const a = (deg * Math.PI) / 180;
  return `${(C.cx + C.r * Math.sin(a)).toFixed(2)} ${(C.cy - C.r * Math.cos(a)).toFixed(2)}`;
};
const sector = (from, to) => `M${C.cx} ${C.cy} L${pt(from)} A${C.r} ${C.r} 0 ${to - from > 180 ? 1 : 0} 1 ${pt(to)} Z`;

export function LogoMark({ size = 40, title = 'Saan Tayo? logo' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={title}>
      <circle cx={C.cx} cy={C.cy} r={C.r + 4} fill="#FBEDC8" />
      <g stroke="#FBEDC8" strokeWidth="3.5" strokeLinejoin="round">
        <path d={sector(0, 120)} fill="#1E6340" />
        <path d={sector(120, 240)} fill="#F8B94C" />
        <path d={sector(240, 360)} fill="#D9362B" />
      </g>
      <path d="M41 6 L59 6 L50 20 Z" fill="#D9362B" stroke="#FBEDC8" strokeWidth="3" strokeLinejoin="round" />
      <path d="M35.5 45 A15 15 0 1 1 57 58 Q50 62 50 70" fill="none" stroke="#FBEDC8" strokeWidth="11" strokeLinecap="round" />
      <circle cx="50" cy="84" r="6.5" fill="#FBEDC8" />
    </svg>
  );
}

export default function Logo({ size = 40, tone = 'green', className = '' }) {
  return (
    <span className={`logo logo--${tone} ${className}`}>
      <LogoMark size={size} />
      <span className="logo__word">SAAN TAYO?</span>
    </span>
  );
}

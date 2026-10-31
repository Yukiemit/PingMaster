// Small inline icon set (stroke icons follow currentColor).
const S = ({ children, size = 24, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    {children}
  </svg>
);

// Chunky chevron used on the CTA buttons in the mockups.
export const Chevron = ({ size = 24, dir = 'right', ...p }) => (
  <svg className="chev" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ transform: dir === 'left' ? 'scaleX(-1)' : dir === 'down' ? 'rotate(90deg)' : undefined }} {...p}>
    <path d="M5 2h7l9 10-9 10H5l9-10z" fill="currentColor" />
  </svg>
);

export const User = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <circle cx="12" cy="8.2" r="4.4" />
    <path d="M3.6 20.5c.9-4.2 4.3-6.6 8.4-6.6s7.5 2.4 8.4 6.6c-2.2 1.9-5.1 3-8.4 3s-6.2-1.1-8.4-3z" />
  </svg>
);
export const UserCircle = (p) => (
  <S {...p}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="10" r="3" /><path d="M6.2 18.4a7 7 0 0 1 11.6 0" /></S>
);
export const Users = (p) => (
  <S {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" /><path d="M18 14.8c2 .7 3.3 2.5 3.6 5.2" /></S>
);
export const Heart = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}><path d="M12 21s-8.5-5.3-8.5-11.4A4.9 4.9 0 0 1 12 6.4a4.9 4.9 0 0 1 8.5 3.2C20.5 15.7 12 21 12 21z" /></svg>
);
export const Utensils = (p) => (
  <S {...p}><path d="M7 2v8a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2M9 12v10M9 2v6" /><path d="M17 22V2c-2.2 0-3.5 2.5-3.5 6s1.3 5 3.5 5" /></S>
);
export const Bolt = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
);
export const CalendarCheck = (p) => (
  <S {...p}><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M8 2.5v4M16 2.5v4M3 9.5h18M8.5 15l2.5 2.5 4.5-5" /></S>
);
export const CalendarIcon = (p) => (
  <S {...p}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M8 2.5v4M16 2.5v4M3 9.5h18" /><path d="M7.5 13h.01M12 13h.01M16.5 13h.01M7.5 16.5h.01M12 16.5h.01M16.5 16.5h.01" strokeWidth="2.6" /></S>
);
export const Receipt = (p) => (
  <S {...p}><path d="M5 2.5h14v19l-2.3-1.5-2.4 1.5-2.3-1.5-2.3 1.5-2.4-1.5L5 21.5z" /><path d="M12 7v9M14.5 8.5h-3.3a1.7 1.7 0 0 0 0 3.4h1.6a1.7 1.7 0 0 1 0 3.4H9.5" /></S>
);
export const Doc = (p) => (
  <S {...p}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></S>
);
export const Equals = (p) => (<S {...p}><path d="M5 9h14M5 15h14" /></S>);
export const Plus = (p) => (<S {...p}><path d="M12 5v14M5 12h14" /></S>);
export const Close = (p) => (<S {...p}><path d="M6 6l12 12M18 6 6 18" /></S>);
export const Caret = ({ up, ...p }) => (<S {...p}><path d={up ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} /></S>);
export const Check = (p) => (<S {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></S>);
export const CheckCircle = (p) => (<S {...p}><circle cx="12" cy="12" r="9.5" /><path d="m8 12.3 2.8 2.8L16.2 9.6" /></S>);
export const Info = (p) => (<S {...p}><circle cx="12" cy="12" r="9.5" /><path d="M12 11v5.5M12 7.6h.01" /></S>);
export const ArrowRight = (p) => (<S {...p}><path d="M5 12h14M13 6l6 6-6 6" /></S>);
export const Pin = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}><path d="M12 22s7-6.6 7-12.2A7 7 0 0 0 5 9.8C5 15.4 12 22 12 22z" fill="currentColor" /><circle cx="12" cy="9.8" r="2.7" fill="#fff" /></svg>
);
export const Copy = (p) => (<S {...p}><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></S>);
export const Warn = (p) => (<S {...p}><path d="M12 3 2 20h20z" /><path d="M12 10v4.5M12 17.4h.01" /></S>);

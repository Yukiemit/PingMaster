// Stylised street map (matches the mockup look) with a walking route to the pick.
// Swap for a real map (Google Maps / Leaflet) when an API key is available.
export default function MapPreview({ label }) {
  return (
    <svg className="map" viewBox="0 0 774 376" role="img" aria-label={`Map showing the route to ${label}`} preserveAspectRatio="xMidYMid slice">
      <rect width="774" height="376" fill="#f4f1e4" />
      <g fill="#b5e8b7">
        <path d="M0 0h120l-60 60H0z" /><path d="M470 0h90l-30 90-80-20z" /><path d="M250 250l110 25-25 90-115-20z" />
        <path d="M700 230l74 20v126h-100z" /><path d="M610 60l70 15-20 60-60-15z" />
      </g>
      <g fill="none" stroke="#9ec2f7" strokeLinecap="round">
        <path d="M0 260c70-30 120-70 160-120s80-110 100-140" strokeWidth="26" />
        <path d="M400 0c80 50 200 70 374 160" strokeWidth="14" />
        <path d="M250 70c30 100 60 170 120 230" strokeWidth="7" />
        <path d="M600 140c-40 60-80 150-100 236" strokeWidth="7" />
      </g>
      <g fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="9">
        <path d="M0 40l120 30 50 70-30 90" /><path d="M130 0l-20 120 110 90 220 40" /><path d="M300 0l-20 160" />
        <path d="M380 40l-70 210 40 126" /><path d="M450 60l200 70 124 30" /><path d="M520 0l-60 270 260 60" />
        <path d="M680 0l-70 170 30 120" /><path d="M0 330l280-90 210 80 120 56" /><path d="M560 230l214-40" />
        <path d="M720 0l54 60" />
      </g>
      <g fill="none" stroke="#f1e575" strokeLinecap="round" strokeWidth="14">
        <path d="M0 330L774 0" /><path d="M380 0l240 280 50 96" />
      </g>
      <path d="M150 300c60-20 120-60 190-100s110-60 140-95" fill="none" stroke="#1e6340" strokeWidth="6" strokeDasharray="2 12" strokeLinecap="round" />
      <circle cx="150" cy="300" r="12" fill="#1e6340" stroke="#fff" strokeWidth="4" />
      <text x="150" y="338" textAnchor="middle" fontFamily="Poppins, sans-serif" fontWeight="700" fontSize="18" fill="#1e6340">You</text>
      <g transform="translate(482 108)">
        <path d="M0 0c-16-18-26-32-26-46a26 26 0 0 1 52 0c0 14-10 28-26 46z" fill="#e2281f" stroke="#fff" strokeWidth="3" />
        <circle cy="-46" r="9" fill="#fff" />
      </g>
    </svg>
  );
}

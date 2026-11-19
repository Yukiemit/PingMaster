export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const peso = (n) => '₱' + (Number(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function time12(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ampm}`;
}

export const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const priceRange = (r) => (r.priceKnown === false ? 'Price not listed' : `PHP ${r.priceMin}-PHP ${r.priceMax}`);
export const distance = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`);
export const mins = (n) => `${n} min${n === 1 ? '' : 's'}`;
// Real places show distance plus an estimated walk; sample places only have the walk time.
export const walk = (r) => (r.distanceM != null ? `${distance(r.distanceM)} · ~${mins(r.walkMins)} walk` : `${mins(r.walkMins)} walk`);

const DIET_LABELS = {
  vegetarian: 'Vegetarian', vegan: 'Vegan', dairyFree: 'Dairy Free', seafoodAllergy: 'Seafood Allergy',
  glutenFree: 'Gluten-Free', nutAllergy: 'Nut Allergy', noPork: 'No Pork',
};
export const dietLabel = (k) => DIET_LABELS[k] || k;

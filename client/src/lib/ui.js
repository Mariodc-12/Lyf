export const CATEGORY_META = {
  venue: { icon: 'building', label: 'Venue', tone: '#4F5BD5' },
  'aso-ebi': { icon: 'shirt', label: 'Aso-ebi', tone: '#D93A64' },
  food: { icon: 'utensils', label: 'Food and drinks', tone: '#E9822B' },
  photography: { icon: 'camera', label: 'Photography', tone: '#1E9E6A' },
  makeup: { icon: 'sparkles', label: 'Makeup and hair', tone: '#B04BC9' },
  decoration: { icon: 'gift', label: 'Decoration', tone: '#0E9AA7' },
  dj: { icon: 'music', label: 'DJ and MC', tone: '#7A5AF8' },
  miscellaneous: { icon: 'dots', label: 'Miscellaneous', tone: '#6B7280' },
};

export const catMeta = (c) => CATEGORY_META[c] || CATEGORY_META.miscellaneous;
export const catLabel = (c) =>
  CATEGORY_META[c]?.label || String(c).charAt(0).toUpperCase() + String(c).slice(1);

export const EVENT_TYPES = {
  wedding: {
    icon: 'heart', tone: '#D93A64', tint: '#FCE4EB', label: 'Wedding',
    blurb: 'Venue, aso-ebi, food and more', example: "Victor and Sarah's wedding",
  },
  birthday: {
    icon: 'cake', tone: '#E9822B', tint: '#FDEBD9', label: 'Birthday',
    blurb: 'Food, venue and good music', example: "Tola's 30th birthday",
  },
  graduation: {
    icon: 'cap', tone: '#4F5BD5', tint: '#E5E8FB', label: 'Graduation',
    blurb: 'Photos, food and outfits', example: 'Class of 2026 celebration',
  },
  party: {
    icon: 'star', tone: '#1E9E6A', tint: '#DDF3E8', label: 'Party',
    blurb: 'DJ, drinks and a place to be', example: 'House party',
  },
};

export const TYPE_LIST = ['wedding', 'birthday', 'graduation', 'party'];
export const VENDOR_CATEGORIES = ['venue', 'food', 'photography', 'makeup', 'dj', 'aso-ebi', 'decoration'];

export const tint = (hex) => `${hex}1F`;

export function daysUntil(value) {
  if (!value) return null;
  const d = new Date(value);
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const n = new Date();
  const b = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  return Math.round((a - b) / 86400000);
}

export function countdownText(value) {
  const n = daysUntil(value);
  if (n === null) return 'No date set yet';
  if (n > 1) return `${n} days to go`;
  if (n === 1) return 'Tomorrow';
  if (n === 0) return 'Today';
  return 'This event has passed';
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export const AVATAR_TONES = ['#4F5BD5', '#D93A64', '#E9822B', '#1E9E6A', '#B04BC9', '#0E9AA7'];

export function toneFor(name = '') {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

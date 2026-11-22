import { ageParts } from './age.js';
export const T = {
  en: {
    title: 'Nepal Flood, Glacial Lake & Earthquake Map',
    short: 'Nepal Hazard Map',
    disclaimer: 'Not an official warning. For alerts, follow DHM, NEMRC, the Nepal Government and local authorities.',
    nav: { map: 'Map', data: 'Latest data', glof: 'Lake burst', quake: 'Earthquake', about: 'About' },
    search: 'Search a place, district, river station or lake', noResults: 'No matching place',
    kinds: { d: 'District', m: 'Local level', s: 'River station', l: 'Glacial lake' },
    layers: { rivers: 'River levels', rain: 'Rainfall', quakes: 'Earthquakes', incidents: 'Floods' },
    sources: 'Data sources', copied: 'copied', newest: 'newest reading', ago: 'ago', fresh: 'up to date', stale: 'old', failed: 'last copy failed — showing previous copy',
    origin: { 'DHM via BIPAD': 'DHM via BIPAD', 'NEMRC via BIPAD': 'NEMRC via BIPAD', BIPAD: 'BIPAD' },
    feeds: { rivers: 'River levels', rain: 'Rainfall', quakes: 'Earthquakes', incidents: 'Flood & GLOF reports' },
    quakeAgeNote: 'Earthquakes are irregular: a long gap can mean a quiet period or a stopped feed.',
    unit: { min: 'min', h: 'h', d: 'days', mo: 'months', y: 'years' },
    status: { 'BELOW WARNING LEVEL': 'Below warning', 'WARNING LEVEL': 'Warning level', 'DANGER LEVEL': 'Danger level' },
    trend: { STEADY: 'steady', RISING: 'rising', FALLING: 'falling' },
    level: 'Level', warn: 'Warning', danger: 'Danger', m: 'm', mm: 'mm', rain1: 'Last 1 h', rain24: 'Last 24 h',
    mag: 'Magnitude', loadOlder: 'Load older', noOlder: 'No older records', loading: 'Loading…', hazard: { 11: 'Flood', 26: 'Glacial lake outburst', 28: 'Inundation', 8: 'Earthquake' },
    loss: 'Loss record', verified: 'verified', filter: 'Filter by name',
    glof: {
      h: 'What if a glacial lake bursts?', lead: 'Choose a lake, or tap the map, then set how much water it could release.',
      lake: 'Lake', custom: 'Point on map', volume: 'Water released (million m³)', from: 'from', to: 'to',
      run: 'Run scenario', play: 'Play', pause: 'Pause', time: 'Hours after burst',
      result: 'Result', place: 'Place on the path', dist: 'Distance', arrival: 'Arrival (earliest – latest)', peak: 'Peak flow (m³/s)', depth: 'Water depth (m)',
      ends: 'The path ends where the river reaches the plains (below 120 m). There, water spreads out and this model cannot say where it goes.',
      tap: 'Tap the map to choose a starting point.',
    },
    quake: {
      h: 'What if a big earthquake hits?', lead: 'Choose where it starts and how strong it is. Colours show the likely shaking band.',
      epi: 'Epicentre', mag: 'Magnitude', strike: 'Fault direction (°)', run: 'Show shaking', replay: 'Replay',
      result: 'Shaking by district', district: 'District', band: 'Likely shaking (intensity)', tap: 'Tap the map to move the epicentre.',
      legend: 'Shaking intensity (Modified Mercalli)', mmi: { 2: 'Weak', 4: 'Light', 5: 'Moderate', 6: 'Strong', 7: 'Very strong', 8: 'Severe', 9: 'Violent', 10: 'Extreme' },
    },
    print: 'Print result', printed: 'Printed', assumptions: 'Assumptions', method: 'Method',
    km: 'km', hr: 'h', near: 'near',
    about: 'About this site',
  },
  ne: {
    title: 'नेपाल बाढी, हिमताल र भूकम्प नक्सा',
    short: 'नेपाल विपद् नक्सा',
    disclaimer: 'यो आधिकारिक चेतावनी होइन। सूचनाका लागि जल तथा मौसम विज्ञान विभाग, राष्ट्रिय भूकम्प मापन केन्द्र, नेपाल सरकार र स्थानीय निकायलाई पछ्याउनुहोस्।',
    nav: { map: 'नक्सा', data: 'ताजा तथ्यांक', glof: 'हिमताल विस्फोट', quake: 'भूकम्प', about: 'बारेमा' },
    search: 'ठाउँ, जिल्ला, नदी केन्द्र वा हिमताल खोज्नुहोस्', noResults: 'मिल्ने ठाउँ भेटिएन',
    kinds: { d: 'जिल्ला', m: 'स्थानीय तह', s: 'नदी मापन केन्द्र', l: 'हिमताल' },
    layers: { rivers: 'नदीको सतह', rain: 'वर्षा', quakes: 'भूकम्प', incidents: 'बाढी' },
    sources: 'तथ्यांक स्रोत', copied: 'प्रतिलिपि', newest: 'पछिल्लो मापन', ago: 'अघि', fresh: 'अद्यावधिक', stale: 'पुरानो', failed: 'पछिल्लो प्रतिलिपि असफल — अघिल्लो प्रतिलिपि देखाइँदै',
    origin: { 'DHM via BIPAD': 'जल तथा मौसम विज्ञान विभाग (बिपद पोर्टल मार्फत)', 'NEMRC via BIPAD': 'राष्ट्रिय भूकम्प मापन केन्द्र (बिपद पोर्टल मार्फत)', BIPAD: 'बिपद पोर्टल' },
    feeds: { rivers: 'नदीको सतह', rain: 'वर्षा', quakes: 'भूकम्प', incidents: 'बाढी र हिमताल विस्फोट घटना' },
    quakeAgeNote: 'भूकम्प अनियमित हुन्छन्: लामो अन्तरको अर्थ शान्त समय वा रोकिएको तथ्यांक दुवै हुन सक्छ।',
    unit: { min: 'मिनेट', h: 'घण्टा', d: 'दिन', mo: 'महिना', y: 'वर्ष' },
    status: { 'BELOW WARNING LEVEL': 'चेतावनी तहभन्दा तल', 'WARNING LEVEL': 'चेतावनी तह', 'DANGER LEVEL': 'खतरा तह' },
    trend: { STEADY: 'स्थिर', RISING: 'बढ्दो', FALLING: 'घट्दो' },
    level: 'सतह', warn: 'चेतावनी', danger: 'खतरा', m: 'मि.', mm: 'मि.मि.', rain1: 'पछिल्लो १ घण्टा', rain24: 'पछिल्लो २४ घण्टा',
    mag: 'म्याग्निच्युड', loadOlder: 'पुराना हेर्नुहोस्', noOlder: 'थप पुराना अभिलेख छैनन्', loading: 'लोड हुँदैछ…', hazard: { 11: 'बाढी', 26: 'हिमताल विस्फोटन', 28: 'डुबान', 8: 'भूकम्प' },
    loss: 'क्षति अभिलेख', verified: 'प्रमाणित', filter: 'नामबाट छान्नुहोस्',
    glof: {
      h: 'हिमताल फुटे के हुन्छ?', lead: 'हिमताल छान्नुहोस् वा नक्सामा थिच्नुहोस्, अनि कति पानी निस्कन सक्छ राख्नुहोस्।',
      lake: 'हिमताल', custom: 'नक्साको बिन्दु', volume: 'निस्कने पानी (दस लाख घन मिटर)', from: 'देखि', to: 'सम्म',
      run: 'परिदृश्य चलाउनुहोस्', play: 'चलाउनुहोस्', pause: 'रोक्नुहोस्', time: 'फुटेपछिको घण्टा',
      result: 'नतिजा', place: 'बाटोको ठाउँ', dist: 'दूरी', arrival: 'आइपुग्ने समय (छिटो – ढिलो)', peak: 'उच्चतम बहाव (घन मि./से.)', depth: 'पानीको गहिराइ (मि.)',
      ends: 'नदी समथर भूभाग (१२० मिटरभन्दा तल) पुगेपछि बाटो रोकिन्छ। त्यहाँ पानी फैलिन्छ र यो मोडेलले दिशा भन्न सक्दैन।',
      tap: 'सुरु बिन्दु छान्न नक्सामा थिच्नुहोस्।',
    },
    quake: {
      h: 'ठूलो भूकम्प गए के हुन्छ?', lead: 'केन्द्र र शक्ति छान्नुहोस्। रङले सम्भावित कम्पनको दायरा देखाउँछ।',
      epi: 'केन्द्रबिन्दु', mag: 'म्याग्निच्युड', strike: 'फल्टको दिशा (°)', run: 'कम्पन देखाउनुहोस्', replay: 'फेरि हेर्नुहोस्',
      result: 'जिल्लाअनुसार कम्पन', district: 'जिल्ला', band: 'सम्भावित कम्पन (तीव्रता)', tap: 'केन्द्रबिन्दु सार्न नक्सामा थिच्नुहोस्।',
      legend: 'कम्पनको तीव्रता (परिमार्जित मर्काली)', mmi: { 2: 'कमजोर', 4: 'हल्का', 5: 'मध्यम', 6: 'बलियो', 7: 'धेरै बलियो', 8: 'गम्भीर', 9: 'प्रचण्ड', 10: 'अत्यन्त' },
    },
    print: 'नतिजा प्रिन्ट गर्नुहोस्', printed: 'प्रिन्ट गरिएको', assumptions: 'मान्यताहरू', method: 'विधि',
    km: 'कि.मि.', hr: 'घण्टा', near: 'नजिक',
    about: 'यस साइटको बारेमा',
  },
};
export let lang = 'en';
export const setLang = (l) => { lang = l; document.documentElement.lang = l === 'ne' ? 'ne' : 'en'; };
export const t = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), T[lang]) ?? path.split('.').reduce((o, k) => (o == null ? o : o[k]), T.en) ?? path;
// Own Nepali formatting: many phone browsers ship without Nepali locale data.
const DEV = '०१२३४५६७८९';
export const digits = (str) => (lang === 'ne' ? String(str).replace(/[0-9]/g, (d) => DEV[d]) : String(str));
const nf = {};
export const num = (x, d = 0) => (x == null || Number.isNaN(x) ? '–' : digits((nf[d] ??= new Intl.NumberFormat('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })).format(x)));
const MON = { en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], ne: ['जनवरी', 'फेब्रुअरी', 'मार्च', 'अप्रिल', 'मे', 'जुन', 'जुलाई', 'अगस्ट', 'सेप्टेम्बर', 'अक्टोबर', 'नोभेम्बर', 'डिसेम्बर'] };
export const when = (iso) => {
  if (!iso) return '–';
  const n = new Date(Date.parse(iso) + 345 * 60000); // Nepal Time = UTC+05:45, no daylight saving
  const hm = `${String(n.getUTCHours()).padStart(2, '0')}:${String(n.getUTCMinutes()).padStart(2, '0')}`;
  return lang === 'ne' ? digits(`${n.getUTCFullYear()} ${MON.ne[n.getUTCMonth()]} ${n.getUTCDate()}, ${hm}`) + ' (नेपाली समय)' : `${n.getUTCDate()} ${MON.en[n.getUTCMonth()]} ${n.getUTCFullYear()}, ${hm} NPT`;
};
export const age = (iso, now = Date.now()) => { if (!iso) return '–'; const [n, u] = ageParts(iso, now); return `${num(n)} ${t('unit.' + u)} ${t('ago')}`; };
export const name = (o) => (lang === 'ne' && o.ne ? o.ne : o.en);

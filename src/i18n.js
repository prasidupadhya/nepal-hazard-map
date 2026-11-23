import { ageParts } from './age.js';
export const T = {
  en: {
    title: 'Nepal Flood, Glacial Lake & Earthquake Map',
    short: 'Nepal Hazard Map',
    disclaimer: 'Not an official warning. For alerts, follow DHM, NEMRC, the Nepal Government and local authorities.',
    disclaimerShort: 'Not an official warning. Follow DHM, NEMRC and local authorities.',
    mapLead: 'Today’s river levels, rain and hazard reports from official sources, on a relief model of Nepal. Tap anything on the map to read it.',
    edition: 'How old the data is', edNote: 'Copied from the official sources every morning.',
    aboveWarn: 'Rivers at warning or danger level', noneAbove: 'No river station is at warning or danger level.',
    tryGlof: 'Try a lake burst', tryQuake: 'Try an earthquake', allData: 'See all latest data',
    key: 'Layers', north: 'Turn map to north', source: 'Source', trendL: 'Trend', status2: 'Status',
    nav: { map: 'Map', data: 'Latest data', glof: 'Lake burst', quake: 'Earthquake', about: 'About' },
    search: 'Search a place, district, river station or lake', noResults: 'No matching place',
    kinds: { d: 'District', m: 'Local level', s: 'River gauge', l: 'Glacial lake' },
    layers: { network: 'Rivers', lakes: 'Dangerous glacial lakes', rivers: 'River gauges', rain: 'Rainfall', quakes: 'Earthquakes', incidents: 'Flood reports' },
    river: {
      tap: 'Tap a river, or anywhere on the land, to follow the water downstream.', traceBtn: 'Trace downstream from this gauge', unnamed: 'River', becomes: 'Named along the way',
      length: 'Followed for', drop: 'Height', from: 'from', to: 'to', gauges: 'River gauges downstream', noGauges: 'No river gauge on this stretch.',
      lakesUp: 'Dangerous glacial lakes upstream', lakesNote: 'An outburst from any of these lakes would flow past this point.', noLakes: 'No dangerous glacial lake drains through this point.',
      near: 'Passes near', ends: 'River directions: HydroSHEDS (Lehner et al. 2008), conditioned with mapped river lines so they hold across the flat Terai. The trace ends where the river leaves Nepal.',
    },
    lake: {
      rank: 'Danger rank', area: 'Water area', rankI: 'I, highest', rankII: 'II', rankIII: 'III', basin: 'River', country: 'Located in', id: 'ICIMOD lake ID',
      volSurvey: 'Surveyed volume (ICIMOD, 2009)', volArea: 'Volume estimated from lake area', volNone: 'No published volume for this lake. Enter a range you think likely.',
      scenario: 'Run a burst scenario for this lake', pickLake: 'Tap one of the lake circles on the map.', source: 'Lakes: ICIMOD (2020) potentially dangerous glacial lakes whose floods would reach Nepal.',
      needVol: 'Enter how much water the lake could release.',
      bigNote: 'This lake is larger than most of the lakes the formula was built from, so the estimate is less certain.',
      frozenNote: 'This lake was frozen in every clear satellite image, so its area was traced on the ice and part of it is missing. The real volume is probably larger: consider raising the upper value.',
    },
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
    glance: {
      h: 'Today at a glance', rivers: 'Rivers', rain: 'Rain', quakes: 'Earthquakes', incidents: 'Flood reports',
      allBelow: (n) => `All ${n} river gauges are below warning level.`, someAbove: (n) => `${n} river gauge${n > 1 ? 's are' : ' is'} at warning or danger level:`,
      wettest: (mm, at) => `Most rain in the last 24 hours: ${mm} mm at ${at}.`, dry: (n, all) => `${n} of ${all} stations recorded no rain.`, noRain: 'No station recorded rain in the last 24 hours.',
      lastQuake: (m, at, ago) => `Latest on record: magnitude ${m}, ${at}, ${ago}.`, lastReport: (ago, n) => `Latest report ${ago}. ${n} in the last 30 days.`,
      updated: (ago, src) => `Newest record ${ago}, from ${src}.`, reports: (n) => `${n} reports`, alerts: 'At warning or danger level', gauges: (n) => `${n} gauges`, noRainList: (n) => `${n} stations with no rain`,
      ofWarn: 'warning', ofDanger: 'danger', noLevels: 'No warning level published', other: 'Other basins', basinsNote: 'Grouped by river basin. Open a basin to see its gauges.',
    },
    glof: {
      h: 'What if a glacial lake bursts?', lead: 'Choose one of the 47 potentially dangerous glacial lakes whose floods would reach Nepal, then set how much water it could release.',
      lake: 'Lake', volume: 'Water released (million m³)', from: 'from', to: 'to',
      run: 'Run scenario', play: 'Play', pause: 'Pause', time: 'Hours after burst',
      result: 'Result', place: 'Place on the path', dist: 'Distance', arrival: 'Arrival (earliest – latest)', peak: 'Peak flow (m³/s)', depth: 'Water depth (m)',
      ends: 'The path follows the river to the Nepal border. * On the flat plains (below 120 m) the flood spreads out sideways, so times and depths there are rougher estimates.',
      tap: 'Or tap a lake circle on the map.',
    },
    quake: {
      h: 'What if a big earthquake hits?', lead: 'Choose where it starts and how strong it is. Colours show the likely shaking band.',
      epi: 'Epicentre', mag: 'Magnitude', strike: 'Fault direction (°)', run: 'Show shaking', replay: 'Replay',
      result: 'Shaking by district', district: 'District', band: 'Likely shaking (intensity)', tap: 'Tap the map to move the epicentre.',
      legend: 'Shaking intensity (Modified Mercalli)', mmi: { 2: 'Weak', 4: 'Light', 5: 'Moderate', 6: 'Strong', 7: 'Very strong', 8: 'Severe', 9: 'Violent', 10: 'Extreme' },
    },
    rp: {
      report: 'Scenario report', kGlof: 'What-if scenario · Glacial lake outburst flood', kQuake: 'What-if scenario · Earthquake', kData: 'Latest official readings',
      tGlof: (n) => `If ${n} bursts`, tQuake: (m) => `A magnitude ${m} earthquake`,
      notWarning: 'This is not a warning.',
      scenario: 'It is a computer model of an imagined event, made to help people plan. A real event can be smaller or larger, faster or slower. Every number is a range from the lowest to the highest model result.',
      dataNote: 'Copied from official sources. Readings change by the hour: check the source before acting.',
      peak: 'Peak flow leaving the lake', border: 'Reaches the Nepal border', downstream: (k) => `${k} km downstream`, places: 'Places on the path', placesSub: 'local levels and gauges within 5 km',
      rupture: 'Fault rupture length', centred: 'centred on the epicentre', atLeast: (w) => `Districts with “${w}” shaking or stronger`, upTo: (n) => `middle estimate; up to ${n} at the upper end`, strongest: 'Strongest shaking',
      mapGlof: 'The flood path from the lake to the Nepal border.', mapQuake: 'Likely shaking, middle estimate.', mapData: 'The map layers that were switched on.', north: 'North is up.',
      lake: 'Glacial lake', path: 'Flood path', rivers: 'Main rivers', epi: 'Epicentre',
      chart: 'When the water could arrive', xAxis: 'Distance from the lake (km)', yAxis: 'Hours after the burst', early: 'Earliest arrival', late: 'Latest arrival', chartNote: 'Numbers match the rows of the table.',
      groups: 'Districts by likely shaking', band: 'Range', sources: 'Sources and method', emergency: 'In an emergency call Police 100 · Fire 101 · Ambulance 102.', dataAsOf: 'Data copied',
    },
    print: 'Print result', printed: 'Printed', assumptions: 'Assumptions', method: 'Method',
    km: 'km', hr: 'h', near: 'near',
    about: 'About this site',
  },
  ne: {
    title: 'नेपाल बाढी, हिमताल र भूकम्प नक्सा',
    short: 'नेपाल विपद् नक्सा',
    disclaimer: 'यो आधिकारिक चेतावनी होइन। सूचनाका लागि जल तथा मौसम विज्ञान विभाग, राष्ट्रिय भूकम्प मापन केन्द्र, नेपाल सरकार र स्थानीय निकायलाई पछ्याउनुहोस्।',
    disclaimerShort: 'यो आधिकारिक चेतावनी होइन। सरकारी निकायको सूचना पछ्याउनुहोस्।',
    mapLead: 'आधिकारिक स्रोतबाट आजको नदीको सतह, वर्षा र विपद् घटना, नेपालको उचाइ नमूनामा। पढ्न नक्सामा कुनै पनि बिन्दु थिच्नुहोस्।',
    edition: 'तथ्यांक कति पुरानो छ', edNote: 'हरेक बिहान आधिकारिक स्रोतबाट प्रतिलिपि गरिन्छ।',
    aboveWarn: 'चेतावनी वा खतरा तहमा रहेका नदी', noneAbove: 'कुनै पनि नदी मापन केन्द्र चेतावनी वा खतरा तहमा छैन।',
    tryGlof: 'हिमताल विस्फोट परिदृश्य', tryQuake: 'भूकम्प परिदृश्य', allData: 'सबै ताजा तथ्यांक हेर्नुहोस्',
    key: 'तहहरू', north: 'नक्सा उत्तरतर्फ फर्काउनुहोस्', source: 'स्रोत', trendL: 'प्रवृत्ति', status2: 'अवस्था',
    nav: { map: 'नक्सा', data: 'ताजा तथ्यांक', glof: 'हिमताल विस्फोट', quake: 'भूकम्प', about: 'बारेमा' },
    search: 'ठाउँ, जिल्ला, नदी केन्द्र वा हिमताल खोज्नुहोस्', noResults: 'मिल्ने ठाउँ भेटिएन',
    kinds: { d: 'जिल्ला', m: 'स्थानीय तह', s: 'नदी मापन केन्द्र', l: 'हिमताल' },
    layers: { network: 'नदी', lakes: 'खतरनाक हिमताल', rivers: 'नदी मापन केन्द्र', rain: 'वर्षा', quakes: 'भूकम्प', incidents: 'बाढी घटना' },
    river: {
      tap: 'पानी तल्लो भागतर्फ कहाँ जान्छ हेर्न नदी वा जमिनको कुनै पनि ठाउँमा थिच्नुहोस्।', traceBtn: 'यो केन्द्रबाट तल्लो भागतर्फ पछ्याउनुहोस्', unnamed: 'नदी', becomes: 'बाटोमा पर्ने नाम',
      length: 'पछ्याइएको दूरी', drop: 'उचाइ', from: 'देखि', to: 'सम्म', gauges: 'तल्लो भागका नदी मापन केन्द्र', noGauges: 'यो खण्डमा नदी मापन केन्द्र छैन।',
      lakesUp: 'माथिल्लो भागका खतरनाक हिमताल', lakesNote: 'यीमध्ये कुनै हिमताल फुटेमा बाढी यही बिन्दु भएर बग्छ।', noLakes: 'यो बिन्दु भएर कुनै खतरनाक हिमतालको पानी बग्दैन।',
      near: 'नजिकैबाट जान्छ', ends: 'नदीको दिशा: HydroSHEDS (Lehner र अन्य, २००८), नक्सांकित नदी रेखासँग मिलाइएको, त्यसैले समथर तराईमा पनि भरपर्दो। नदी नेपालबाट बाहिरिने ठाउँमा बाटो रोकिन्छ।',
    },
    lake: {
      rank: 'खतराको श्रेणी', area: 'पानीको क्षेत्रफल', rankI: 'I, सबैभन्दा उच्च', rankII: 'II', rankIII: 'III', basin: 'नदी', country: 'अवस्थिति', id: 'ICIMOD हिमताल परिचय',
      volSurvey: 'सर्वेक्षण गरिएको आयतन (ICIMOD, २००९)', volArea: 'क्षेत्रफलबाट अनुमान गरिएको आयतन', volNone: 'यो हिमतालको प्रकाशित आयतन छैन। सम्भावित दायरा राख्नुहोस्।',
      scenario: 'यो हिमताल फुटेको परिदृश्य चलाउनुहोस्', pickLake: 'नक्सामा कुनै हिमतालको गोलो थिच्नुहोस्।', source: 'हिमताल: नेपालमा बाढी पुर्‍याउन सक्ने ICIMOD (२०२०) का सम्भावित खतरनाक हिमताल।',
      needVol: 'हिमतालबाट कति पानी निस्कन सक्छ राख्नुहोस्।',
      bigNote: 'यो हिमताल सूत्र बनाउन प्रयोग भएका धेरैजसो हिमतालभन्दा ठूलो छ, त्यसैले अनुमान कम निश्चित छ।',
      frozenNote: 'हरेक सफा स्याटेलाइट तस्बिरमा यो हिमताल जमेको थियो, त्यसैले बरफमा क्षेत्रफल नापिएको छ र केही भाग छुटेको छ। वास्तविक आयतन सम्भवतः बढी छ: माथिल्लो मान बढाउने विचार गर्नुहोस्।',
    },
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
    glance: {
      h: 'आजको संक्षेप', rivers: 'नदी', rain: 'वर्षा', quakes: 'भूकम्प', incidents: 'बाढी घटना',
      allBelow: (n) => `सबै ${n} नदी मापन केन्द्र चेतावनी तहभन्दा तल छन्।`, someAbove: (n) => `${n} नदी मापन केन्द्र चेतावनी वा खतरा तहमा छन्:`,
      wettest: (mm, at) => `पछिल्लो २४ घण्टामा सबैभन्दा बढी वर्षा: ${at} मा ${mm} मि.मि.।`, dry: (n, all) => `${all} मध्ये ${n} केन्द्रमा वर्षा भएन।`, noRain: 'पछिल्लो २४ घण्टामा कुनै केन्द्रमा वर्षा भएन।',
      lastQuake: (m, at, ago) => `पछिल्लो अभिलेख: म्याग्निच्युड ${m}, ${at}, ${ago}।`, lastReport: (ago, n) => `पछिल्लो घटना ${ago}। पछिल्लो ३० दिनमा ${n} वटा।`,
      updated: (ago, src) => `पछिल्लो अभिलेख ${ago}, स्रोत: ${src}।`, reports: (n) => `${n} वटा सूचना`, alerts: 'चेतावनी वा खतरा तहमा', gauges: (n) => `${n} केन्द्र`, noRainList: (n) => `वर्षा नभएका ${n} केन्द्र`,
      ofWarn: 'चेतावनी', ofDanger: 'खतरा', noLevels: 'चेतावनी तह प्रकाशित छैन', other: 'अन्य नदी बेसिन', basinsNote: 'नदी बेसिनअनुसार समूह। केन्द्रहरू हेर्न बेसिन खोल्नुहोस्।',
    },
    glof: {
      h: 'हिमताल फुटे के हुन्छ?', lead: 'नेपालमा बाढी पुर्‍याउन सक्ने ४७ सम्भावित खतरनाक हिमतालमध्ये एउटा छान्नुहोस्, अनि कति पानी निस्कन सक्छ राख्नुहोस्।',
      lake: 'हिमताल', volume: 'निस्कने पानी (दस लाख घन मिटर)', from: 'देखि', to: 'सम्म',
      run: 'परिदृश्य चलाउनुहोस्', play: 'चलाउनुहोस्', pause: 'रोक्नुहोस्', time: 'फुटेपछिको घण्टा',
      result: 'नतिजा', place: 'बाटोको ठाउँ', dist: 'दूरी', arrival: 'आइपुग्ने समय (छिटो – ढिलो)', peak: 'उच्चतम बहाव (घन मि./से.)', depth: 'पानीको गहिराइ (मि.)',
      ends: 'बाटो नेपालको सिमानासम्म नदी पछ्याउँछ। * समथर भूभाग (१२० मिटरभन्दा तल) मा बाढी छेउतिर फैलिन्छ, त्यसैले त्यहाँको समय र गहिराइ मोटामोटी अनुमान हुन्।',
      tap: 'वा नक्सामा हिमतालको गोलो थिच्नुहोस्।',
    },
    quake: {
      h: 'ठूलो भूकम्प गए के हुन्छ?', lead: 'केन्द्र र शक्ति छान्नुहोस्। रङले सम्भावित कम्पनको दायरा देखाउँछ।',
      epi: 'केन्द्रबिन्दु', mag: 'म्याग्निच्युड', strike: 'फल्टको दिशा (°)', run: 'कम्पन देखाउनुहोस्', replay: 'फेरि हेर्नुहोस्',
      result: 'जिल्लाअनुसार कम्पन', district: 'जिल्ला', band: 'सम्भावित कम्पन (तीव्रता)', tap: 'केन्द्रबिन्दु सार्न नक्सामा थिच्नुहोस्।',
      legend: 'कम्पनको तीव्रता (परिमार्जित मर्काली)', mmi: { 2: 'कमजोर', 4: 'हल्का', 5: 'मध्यम', 6: 'बलियो', 7: 'धेरै बलियो', 8: 'गम्भीर', 9: 'प्रचण्ड', 10: 'अत्यन्त' },
    },
    rp: {
      report: 'परिदृश्य प्रतिवेदन', kGlof: 'के भयो भने? परिदृश्य · हिमताल विस्फोट बाढी', kQuake: 'के भयो भने? परिदृश्य · भूकम्प', kData: 'पछिल्लो आधिकारिक तथ्यांक',
      tGlof: (n) => `यदि ${n} फुट्यो भने`, tQuake: (m) => `${m} म्याग्निच्युडको भूकम्प`,
      notWarning: 'यो चेतावनी होइन।',
      scenario: 'यो योजना बनाउन सहयोग गर्न कल्पना गरिएको घटनाको कम्प्युटर मोडेल हो। वास्तविक घटना यसभन्दा सानो वा ठूलो, छिटो वा ढिलो हुन सक्छ। हरेक अङ्क मोडेलको सबैभन्दा कम र सबैभन्दा बढी नतिजाबीचको दायरा हो।',
      dataNote: 'आधिकारिक स्रोतबाट प्रतिलिपि गरिएको। तथ्यांक घण्टैपिच्छे बदलिन्छ: केही गर्नुअघि स्रोत हेर्नुहोस्।',
      peak: 'तालबाट निस्कने उच्चतम बहाव', border: 'नेपालको सिमानामा पुग्ने समय', downstream: (k) => `तल्लो तटतर्फ ${k} कि.मि.`, places: 'बाटोमा पर्ने ठाउँ', placesSub: '५ कि.मि. भित्रका स्थानीय तह र मापन केन्द्र',
      rupture: 'फल्ट फुटेको लम्बाइ', centred: 'केन्द्रबिन्दुको दुवैतिर', atLeast: (w) => `“${w}” वा त्योभन्दा बढी कम्पन हुने जिल्ला`, upTo: (n) => `मध्य अनुमान; माथिल्लो अनुमानमा ${n} सम्म`, strongest: 'सबैभन्दा बढी कम्पन',
      mapGlof: 'तालदेखि नेपालको सिमानासम्म बाढीको बाटो।', mapQuake: 'सम्भावित कम्पन, मध्य अनुमान।', mapData: 'खोलिएका नक्सा तहहरू।', north: 'उत्तर माथि छ।',
      lake: 'हिमताल', path: 'बाढीको बाटो', rivers: 'मुख्य नदी', epi: 'केन्द्रबिन्दु',
      chart: 'पानी कहिले आइपुग्न सक्छ', xAxis: 'तालबाट दूरी (कि.मि.)', yAxis: 'विस्फोटपछिका घण्टा', early: 'सबैभन्दा छिटो', late: 'सबैभन्दा ढिलो', chartNote: 'अङ्कहरू तालिकाका पङ्क्तिसँग मिल्छन्।',
      groups: 'सम्भावित कम्पनअनुसार जिल्ला', band: 'दायरा', sources: 'स्रोत र विधि', emergency: 'आपत्कालमा फोन गर्नुहोस्: प्रहरी १०० · दमकल १०१ · एम्बुलेन्स १०२।', dataAsOf: 'तथ्यांक प्रतिलिपि',
    },
    print: 'नतिजा प्रिन्ट गर्नुहोस्', printed: 'प्रिन्ट गरिएको', assumptions: 'मान्यताहरू', method: 'विधि',
    km: 'कि.मि.', hr: 'घण्टा', near: 'नजिक',
    about: 'यस साइटको बारेमा',
  },
};
export let lang = 'en';
export const setLang = (l) => { lang = l; document.documentElement.lang = l === 'ne' ? 'ne' : 'en'; };
// strings may be functions: tf('glance.dry', n, all)
export const tf = (path, ...a) => { const v = t(path); return typeof v === 'function' ? v(...a) : v; };
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
// date only (for records that carry no time of day)
export const day = (iso) => { const n = new Date(Date.parse(iso) + 345 * 60000); return lang === 'ne' ? digits(`${n.getUTCFullYear()} ${MON.ne[n.getUTCMonth()]} ${n.getUTCDate()}`) : `${n.getUTCDate()} ${MON.en[n.getUTCMonth()]} ${n.getUTCFullYear()}`; };
export const monthYear = (iso) => { const n = new Date(Date.parse(iso) + 345 * 60000); return lang === 'ne' ? digits(`${MON.ne[n.getUTCMonth()]} ${n.getUTCFullYear()}`) : `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][n.getUTCMonth()]} ${n.getUTCFullYear()}`; };
export const age = (iso, now = Date.now()) => { if (!iso) return '–'; const [n, u] = ageParts(iso, now); return `${num(n)} ${t('unit.' + u)} ${t('ago')}`; };
export const name = (o) => (lang === 'ne' && o.ne ? o.ne : o.en);

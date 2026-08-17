import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { SEO } from '@/components/seo';
import { TrendingUp, TrendingDown, Minus, ExternalLink, AlertCircle } from 'lucide-react';

interface IndexEntry {
  id: number;
  name: string;
  nameHi?: string;
  shortName: string;
  publisher: string;
  category: 'Healthcare' | 'Education' | 'Economy' | 'Governance' | 'Environment' | 'Social';
  rank: number;
  total: number;
  score?: string;
  scoreMax?: string;
  scoreUnit?: string;
  scoreUnitHi?: string;
  year: number;
  trend: 'up' | 'down' | 'stable';
  trendNote?: string;
  trendNoteHi?: string;
  interpretation: string;
  interpretationHi?: string;
  rankDirection: 'lower-better' | 'higher-better';
  sourceUrl: string;
  note?: string;
  noteHi?: string;
}

const INDICES: IndexEntry[] = [ // prettier-ignore

  {
    id: 1,
    name: 'Human Development Index',
    nameHi: 'मानव विकास सूचकांक',
    shortName: 'HDI',
    publisher: 'UNDP',
    category: 'Social',
    rank: 134,
    total: 193,
    score: '0.644',
    scoreMax: '1.000',
    year: 2023,
    trend: 'up',
    trendNote: 'Up from 135 in 2022',
    trendNoteHi: '2022 में 135 से ऊपर',
    interpretation: 'Composite of life expectancy, education, and per-capita income',
    interpretationHi: 'जीवन प्रत्याशा, शिक्षा, और प्रति व्यक्ति आय का सम्मिश्रण',
    rankDirection: 'lower-better',
    sourceUrl: 'https://hdr.undp.org/data-center/human-development-index',
  },
  {
    id: 2,
    name: 'Global Hunger Index',
    nameHi: 'वैश्विक भूख सूचकांक',
    shortName: 'GHI',
    publisher: 'IFPRI / Concern Worldwide',
    category: 'Healthcare',
    rank: 102,
    total: 123,
    score: '25.8',
    scoreMax: '100',
    scoreUnit: 'score (lower = less hunger)',
    scoreUnitHi: 'स्कोर (कम = कम भूख)',
    year: 2025,
    trend: 'up',
    trendNote: 'Slight improvement to 102/123 in 2025 (score 25.8 vs 27.0 in 2024); still rated "serious"',
    trendNoteHi: '2025 में 102/123 तक मामूली सुधार (स्कोर 25.8 बनाम 2024 में 27.0); अभी भी "गंभीर" रेटिंग',
    interpretation: 'Hunger levels across child stunting, wasting, and undernourishment',
    interpretationHi: 'बाल कुपोषण, कुपोषण, और कुपोषण स्तरों में भूख की स्थिति',
    rankDirection: 'lower-better',
    sourceUrl: 'https://www.globalhungerindex.org/india.html',
    note: 'India disputes the methodology',
    noteHi: 'भारत पद्धति पर विवाद करता है',
  },
  {
    id: 3,
    name: 'Press Freedom Index',
    nameHi: 'प्रेस स्वतंत्रता सूचकांक',
    shortName: 'PFI',
    publisher: 'Reporters Without Borders (RSF)',
    category: 'Governance',
    rank: 157,
    total: 180,
    score: '31.96',
    scoreMax: '100',
    year: 2026,
    trend: 'down',
    trendNote: 'Worsened to 157/180 in 2026 after brief improvement to 151 in 2025; rated "difficult"',
    trendNoteHi: '2026 में 157/180 तक बिगड़ा, 2025 में 151 तक थोड़ी सुधार के बाद; "कठिन" रेटिंग',
    interpretation: 'Media freedom and journalist safety',
    interpretationHi: 'मीडिया स्वतंत्रता और पत्रकार सुरक्षा',
    rankDirection: 'lower-better',
    sourceUrl: 'https://rsf.org/en/country/india',
  },
  {
    id: 4,
    name: 'Global Peace Index',
    nameHi: 'वैश्विक शांति सूचकांक',
    shortName: 'GPI',
    publisher: 'Institute for Economics & Peace',
    category: 'Governance',
    rank: 127,
    total: 163,
    score: '2.409',
    scoreMax: '5.0',
    scoreUnit: '(lower = more peaceful)',
    scoreUnitHi: '(कम = अधिक शांतिपूर्ण)',
    year: 2026,
    trend: 'down',
    trendNote: 'Dropped to 127/163 in 2026; down 11 positions from 116 in 2024',
    trendNoteHi: '2026 में 127/163 तक गिरा; 2024 में 116 से 11 स्थान नीचे',
    interpretation: 'Peacefulness via conflict, safety, and militarisation metrics',
    interpretationHi: 'संघर्ष, सुरक्षा, और सैन्यीकरण मापदंडों के माध्यम से शांति',
    rankDirection: 'lower-better',
    sourceUrl: 'https://www.visionofhumanity.org/maps/#/',
  },
  {
    id: 5,
    name: 'Corruption Perceptions Index',
    nameHi: 'भ्रष्टाचार धारणा सूचकांक',
    shortName: 'CPI',
    publisher: 'Transparency International',
    category: 'Governance',
    rank: 91,
    total: 182,
    score: '39',
    scoreMax: '100',
    scoreUnit: '(higher = cleaner)',
    scoreUnitHi: '(ज्यादा = अधिक स्वच्छ)',
    year: 2025,
    trend: 'up',
    trendNote: 'Improved to 91/182 in 2025 (score 39, up from 38 in 2024)',
    trendNoteHi: '2025 में 91/182 तक सुधरा (स्कोर 39, 2024 में 38 से ऊपर)',
    interpretation: 'Perceived public-sector corruption',
    interpretationHi: 'सार्वजनिक क्षेत्र में भ्रष्टाचार की धारणा',
    rankDirection: 'lower-better',
    sourceUrl: 'https://www.transparency.org/en/countries/india',
  },
  {
    id: 6,
    name: 'Democracy Index',
    nameHi: 'लोकतंत्र सूचकांक',
    shortName: 'DI',
    publisher: 'Economist Intelligence Unit',
    category: 'Governance',
    rank: 41,
    total: 167,
    score: '7.18',
    scoreMax: '10',
    year: 2023,
    trend: 'down',
    trendNote: 'Classified as "flawed democracy" since 2021',
    trendNoteHi: '2021 से "खराब लोकतंत्र" के रूप में वर्गीकृत',
    interpretation: 'Electoral process, civil liberties, political culture',
    interpretationHi: 'चुनावी प्रक्रिया, नागरिक स्वतंत्रताएँ, राजनीतिक संस्कृति',
    rankDirection: 'lower-better',
    sourceUrl: 'https://www.eiu.com/n/campaigns/democracy-index-2023/',
  },
  {
    id: 7,
    name: 'World Happiness Report',
    nameHi: 'विश्व खुशी रिपोर्ट',
    shortName: 'WHR',
    publisher: 'UN Sustainable Development Solutions Network',
    category: 'Social',
    rank: 118,
    total: 143,
    score: '4.054',
    scoreMax: '10',
    year: 2024,
    trend: 'down',
    trendNote: 'Lowest in recent years; below regional neighbours',
    trendNoteHi: 'हाल के वर्षों में सबसे कम; क्षेत्रीय पड़ोसियों से नीचे',
    interpretation: 'Life satisfaction, social support, freedom, generosity, trust',
    interpretationHi: 'जीवन संतोष, सामाजिक समर्थन, स्वतंत्रता, उदारता, विश्वास',
    rankDirection: 'lower-better',
    sourceUrl: 'https://worldhappiness.report/',
  },
  {
    id: 8,
    name: 'Global Innovation Index',
    nameHi: 'वैश्विक नवाचार सूचकांक',
    shortName: 'GII',
    publisher: 'WIPO',
    category: 'Economy',
    rank: 39,
    total: 133,
    score: '38.3',
    scoreMax: '100',
    year: 2024,
    trend: 'up',
    trendNote: 'Up from 40 in 2023; strong IT & R&D ecosystem',
    trendNoteHi: '2023 में 40 से ऊपर; मजबूत IT और R&D पारिस्थितिकी तंत्र',
    interpretation: 'Innovation inputs (infrastructure, human capital) and outputs (patents, knowledge)',
    interpretationHi: 'नवाचार इनपुट (अवसंरचना, मानव पूंजी) और आउटपुट (पेटेंट, ज्ञान)',
    rankDirection: 'lower-better',
    sourceUrl: 'https://www.wipo.int/global_innovation_index/en/',
  },
  {
    id: 9,
    name: 'Gender Inequality Index',
    nameHi: 'लैंगिक असमानता सूचकांक',
    shortName: 'GII-G',
    publisher: 'UNDP',
    category: 'Social',
    rank: 108,
    total: 193,
    score: '0.437',
    scoreMax: '1.0',
    scoreUnit: '(lower = less inequality)',
    scoreUnitHi: '(कम = कम असमानता)',
    year: 2023,
    trend: 'stable',
    interpretation: "Reproductive health, women's empowerment, labour force participation",
    rankDirection: 'lower-better',
    sourceUrl: 'https://hdr.undp.org/data-center/thematic-composite-indices/gender-inequality-index',
  },
  {
    id: 10,
    name: 'Environmental Performance Index',
    nameHi: 'पर्यावरण प्रदर्शन सूचकांक',
    shortName: 'EPI',
    publisher: 'Yale & Columbia Universities',
    category: 'Environment',
    rank: 176,
    total: 180,
    score: '27.6',
    scoreMax: '100',
    year: 2024,
    trend: 'down',
    trendNote: 'Among the worst globally; poor on air quality & ecosystem vitality',
    trendNoteHi: 'वैश्विक स्तर पर सबसे खराब में से; वायु गुणवत्ता और पारिस्थितिकी तंत्र की जीवंतता में खराब',
    interpretation: 'Air quality, biodiversity, climate, water resources, sanitation',
    interpretationHi: 'वायु गुणवत्ता, जैव विविधता, जलवायु, जल संसाधन, स्वच्छता',
    rankDirection: 'lower-better',
    sourceUrl: 'https://epi.yale.edu/',
    note: "India has strongly contested this ranking's methodology",
  },
  {
    id: 11,
    name: 'Global Food Security Index',
    nameHi: 'वैश्विक खाद्य सुरक्षा सूचकांक',
    shortName: 'GFSI',
    publisher: 'Economist Impact',
    category: 'Healthcare',
    rank: 64,
    total: 113,
    score: '60.0',
    scoreMax: '100',
    year: 2022,
    trend: 'up',
    trendNote: 'Up from 71st in 2021; 2022 was the final edition of this index',
    trendNoteHi: '2021 में 71वें से ऊपर; 2022 इस सूचकांक का अंतिम संस्करण था',
    interpretation: 'Food affordability, availability, quality, safety, and natural resource resilience',
    interpretationHi: 'खाद्य की उपलब्धता, गुणवत्ता, सुरक्षा, और प्राकृतिक संसाधन की स्थिरता',
    rankDirection: 'lower-better',
    sourceUrl: 'https://impact.economist.com/sustainability/project/food-security-index/',
    note: 'Index discontinued by Economist Impact after 2022',
    noteHi: 'Economist Impact द्वारा 2022 के बाद सूचकांक बंद कर दिया गया',
  },
  {
    id: 13,
    name: 'Rule of Law Index',
    nameHi: 'कानून का शासन सूचकांक',
    shortName: 'RLI',
    publisher: 'World Justice Project',
    category: 'Governance',
    rank: 79,
    total: 142,
    score: '0.50',
    scoreMax: '1.0',
    year: 2023,
    trend: 'down',
    trendNote: 'Down from 77 in 2022',
    trendNoteHi: '2022 में 77 से नीचे',
    interpretation: 'Constraints on government, absence of corruption, civil justice, criminal justice',
    interpretationHi: 'सरकार पर प्रतिबंध, भ्रष्टाचार की अनुपस्थिति, नागरिक न्याय, आपराधिक न्याय',
    rankDirection: 'lower-better',
    sourceUrl: 'https://worldjusticeproject.org/rule-of-law-index/',
  },
  {
    id: 14,
    name: 'Ease of Doing Business',
    nameHi: 'व्यवसाय करने में आसानी',
    shortName: 'EDB',
    publisher: 'World Bank',
    category: 'Economy',
    rank: 63,
    total: 190,
    score: '71.0',
    scoreMax: '100',
    year: 2020,
    trend: 'up',
    trendNote: 'Rose from 142nd in 2014 to 63rd in 2020; index discontinued after 2020',
    trendNoteHi: '2014 में 142वें से 2020 में 63वें तक बढ़ा; 2020 के बाद सूचकांक बंद',
    interpretation: 'Starting a business, permits, credit, taxes, trade, contracts',
    interpretationHi: 'व्यवसाय शुरू करना, परमिट, क्रेडिट, कर, व्यापार, अनुबंध',
    rankDirection: 'lower-better',
    sourceUrl: 'https://archive.doingbusiness.org/en/rankings',
    note: 'Index discontinued by World Bank in 2021 following data integrity concerns',
    noteHi: 'डेटा अखंडता की चिंताओं के बाद विश्व बैंक ने 2021 में सूचकांक बंद कर दिया',
  },
  {
    id: 15,
    name: 'Healthcare Access & Quality Index',
    nameHi: 'स्वास्थ्य देखभाल पहुंच और गुणवत्ता सूचकांक',
    shortName: 'HAQ',
    publisher: 'The Lancet / Global Burden of Disease',
    category: 'Healthcare',
    rank: 145,
    total: 195,
    score: '41.9',
    scoreMax: '100',
    year: 2019,
    trend: 'up',
    trendNote: 'Up from 153 in 2016; still below global average',
    trendNoteHi: '2016 में 153 से ऊपर; अभी भी वैश्विक औसत से नीचे',
    interpretation: 'Access to and quality of personal healthcare across 32 causes',
    interpretationHi: '32 कारणों के तहत व्यक्तिगत स्वास्थ्य सेवा की पहुँच और गुणवत्ता',
    rankDirection: 'lower-better',
    sourceUrl: 'https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(18)30994-2/fulltext',
    note: 'Last available edition — GBD HAQ study has not been republished since 2019',
    noteHi: 'अंतिम उपलब्ध संस्करण — GBD HAQ अध्ययन 2019 के बाद से पुनः प्रकाशित नहीं हुआ है',
  },
  {
    id: 16,
    name: 'GDP Per Capita (PPP)',
    nameHi: 'प्रति व्यक्ति GDP (PPP)',
    shortName: 'GDPpc',
    publisher: 'International Monetary Fund',
    category: 'Economy',
    rank: 127,
    total: 191,
    score: '$9,183',
    scoreUnit: 'USD (PPP, current intl $)',
    scoreUnitHi: 'USD (PPP, वर्तमान अंतरराष्ट्रीय $)',
    year: 2024,
    trend: 'up',
    trendNote: 'Growing ~6% annually; 5th largest GDP total but low per capita',
    trendNoteHi: 'लगभग 6% वार्षिक वृद्धि; 5वीं सबसे बड़ी GDP कुल लेकिन प्रति व्यक्ति कम',
    interpretation: 'Output per person adjusted for purchasing power',
    interpretationHi: 'क्रय शक्ति समायोजित प्रति व्यक्ति उत्पादन',
    rankDirection: 'lower-better',
    sourceUrl: 'https://www.imf.org/en/Publications/WEO/weo-database/2024/',
  },
  {
    id: 28,
    name: 'Gini Coefficient',
    nameHi: 'गिनी गुणांक',
    shortName: 'Gini',
    publisher: 'World Bank',
    category: 'Economy',
    rank: 101,
    total: 164,
    score: '35.7',
    scoreMax: '100',
    scoreUnit: '(higher = more unequal)',
    scoreUnitHi: '(ज्यादा = अधिक असमान)',
    year: 2019,
    trend: 'stable',
    trendNote: 'Relatively unchanged; but Gini understates top-end concentration',
    trendNoteHi: 'अपेक्षाकृत अपरिवर्तित; लेकिन गिनी शीर्ष स्तर की सांद्रता को कम दर्शाता है',
    interpretation: 'Income inequality across the full population (0 = perfect equality, 100 = one person owns everything)',
    interpretationHi: 'पूरी आबादी में आय असमानता (0 = पूर्ण समानता, 100 = एक व्यक्ति के पास सब कुछ)',
    rankDirection: 'lower-better',
    sourceUrl: 'https://data.worldbank.org/indicator/SI.POV.GINI?locations=IN',
    note: 'Gini captures mid-distribution inequality poorly — top-1% concentration (see WIR) tells a starker story',
    noteHi: 'गिनी मध्यम-वितरण असमानता को खराब तरीके से दर्शाता है — शीर्ष 1% का संकेंद्रण (देखें WIR) एक अधिक गंभीर कहानी बताता है',
  },
  {
    id: 29,
    name: 'World Inequality Report',
    nameHi: 'विश्व असमानता रिपोर्ट',
    shortName: 'WIR',
    publisher: 'World Inequality Lab — Chancel, Piketty et al.',
    category: 'Economy',
    rank: 0,
    total: 0,
    score: '58%',
    scoreUnit: 'top 10% income share',
    scoreUnitHi: 'शीर्ष 10% आय हिस्सा',
    year: 2026,
    trend: 'up',
    trendNote: 'Inequality at historic highs; India among most unequal major economies globally',
    trendNoteHi: 'असमानता ऐतिहासिक उच्च स्तर पर; भारत वैश्विक स्तर पर सबसे असमान प्रमुख अर्थव्यवस्थाओं में से एक',
    interpretation: 'Income and wealth concentration at the very top vs. what the bottom half receives',
    interpretationHi: 'शीर्ष पर आय और संपत्ति का संकेंद्रण बनाम निचले आधे हिस्से को प्राप्त राशि',
    rankDirection: 'lower-better',
    sourceUrl: 'https://wir2026.wid.world/',
    note: 'Top 10% income: 58% · Bottom 50% income: 15% | Top 1% wealth: 40% · Bottom 50% wealth: 3%',
    noteHi: 'शीर्ष 10% आय: 58% · निचला 50% आय: 15% | शीर्ष 1% संपत्ति: 40% · निचला 50% संपत्ति: 3%',
  },
  {
    id: 30,
    name: 'Global Knowledge Index',
    nameHi: 'वैश्विक ज्ञान सूचकांक',
    shortName: 'GKI',
    publisher: 'UNDP / Mohammed bin Rashid Al Maktoum Knowledge Foundation',
    category: 'Education',
    rank: 101,
    total: 133,
    score: '38.1',
    scoreMax: '100',
    year: 2023,
    trend: 'stable',
    trendNote: 'Stagnant for 3 years; strong ICT sub-index offset by weak research output',
    trendNoteHi: '3 वर्षों से स्थिर; मजबूत ICT उप-सूचकांक कमजोर अनुसंधान उत्पादन से संतुलित',
    interpretation: 'Education, technical/vocational training, research, ICT, innovation, and enabling environment',
    interpretationHi: 'शिक्षा, तकनीकी/व्यावसायिक प्रशिक्षण, अनुसंधान, ICT, नवाचार, और सक्षम वातावरण',
    rankDirection: 'lower-better',
    sourceUrl: 'https://www.globalknowledgeindex.org/',
  },
  {
    id: 31,
    name: 'IMD World Talent Ranking',
    nameHi: 'IMD विश्व प्रतिभा रैंकिंग',
    shortName: 'WTR',
    publisher: 'IMD Business School',
    category: 'Education',
    rank: 56,
    total: 67,
    score: '—',
    year: 2023,
    trend: 'down',
    trendNote: 'Persistent low score on "Appeal" — brain drain remains a major challenge',
    trendNoteHi: '"आकर्षण" पर लगातार कम स्कोर — मस्तिष्क पलायन एक बड़ी चुनौती बनी हुई है',
    interpretation: 'How well countries develop, attract, and retain skilled talent for the workforce',
    interpretationHi: 'देश कितनी अच्छी तरह कुशल प्रतिभा का विकास, आकर्षण, और संरक्षण करते हैं',
    rankDirection: 'lower-better',
    sourceUrl: 'https://www.imd.org/centers/wcc/world-competitiveness-center/rankings/world-talent-ranking/',
    note: 'India ranks high on investment in education but bottom-10 on quality of life and retaining graduates',
    noteHi: 'भारत शिक्षा में निवेश में उच्च स्थान पर है लेकिन जीवन गुणवत्ता और स्नातकों को बनाए रखने में निचले 10 में है',
  },
  {
    id: 17,
    name: 'Global Gender Gap Index',
    nameHi: 'वैश्विक लैंगिक अंतर सूचकांक',
    shortName: 'GGGI',
    publisher: 'World Economic Forum',
    category: 'Social',
    rank: 129,
    total: 146,
    score: '0.644',
    scoreMax: '1.0',
    scoreUnit: '(1.0 = full parity)',
    scoreUnitHi: '(1.0 = पूर्ण समानता)',
    year: 2024,
    trend: 'up',
    trendNote: 'Up from 135 in 2023; strong in political empowerment sub-index (due to past women PMs)',
    trendNoteHi: '2023 में 135 से ऊपर; राजनीतिक सशक्तिकरण उप-सूचकांक में मजबूत (पूर्व महिला प्रधानमंत्रियों के कारण)',
    interpretation: 'Economic participation, educational attainment, health, political empowerment',
    interpretationHi: 'आर्थिक भागीदारी, शैक्षिक उपलब्धि, स्वास्थ्य, राजनीतिक सशक्तिकरण',
    rankDirection: 'lower-better',
    sourceUrl: 'https://www.weforum.org/reports/global-gender-gap-report-2024/',
    note: 'Political sub-index boosted by Indira Gandhi era; economic & health parity ranks are far lower',
    noteHi: 'राजनीतिक उप-सूचकांक इंदिरा गांधी युग से बढ़ा है; आर्थिक और स्वास्थ्य समानता रैंक बहुत कम हैं',
  },
  {
    id: 18,
    name: "Women, Peace & Security Index",
    shortName: 'WPS',
    publisher: 'Georgetown Institute for Women, Peace and Security',
    category: 'Social',
    rank: 128,
    total: 177,
    score: '0.622',
    scoreMax: '1.0',
    year: 2023,
    trend: 'stable',
    interpretation: "Women's inclusion, justice access, and security from violence",
    rankDirection: 'lower-better',
    sourceUrl: 'https://giwps.georgetown.edu/the-index/',
    note: 'India ranked #1 most dangerous country for women in Thomson Reuters 2018 expert poll',
    noteHi: 'थॉमसन रॉयटर्स 2018 विशेषज्ञ सर्वेक्षण में भारत महिलाओं के लिए सबसे खतरनाक देश के रूप में #1 स्थान पर रहा',
  },
  {
    id: 19,
    name: 'Freedom in the World Index',
    nameHi: 'विश्व में स्वतंत्रता सूचकांक',
    shortName: 'FWI',
    publisher: 'Freedom House',
    category: 'Governance',
    rank: 0,
    total: 0,
    score: '63',
    scoreMax: '100',
    scoreUnit: '(higher = more free)',
    scoreUnitHi: '(ज्यादा = अधिक स्वतंत्र)',
    year: 2025,
    trend: 'down',
    trendNote: 'Dropped to 63/100 in 2025 from 66 in 2024; down from 77 in 2014 when BJP came to power',
    trendNoteHi: '2025 में 63/100 तक गिरा, 2024 में 66 से; 2014 में 77 से नीचे जब BJP सत्ता में आया',
    interpretation: 'Political rights and civil liberties',
    interpretationHi: 'राजनीतिक अधिकार और नागरिक स्वतंत्रताएँ',
    rankDirection: 'lower-better',
    sourceUrl: 'https://freedomhouse.org/country/india/freedom-world/2025',
    note: 'Downgraded from "Free" to "Partly Free" in 2021; PR: 31/40, CL: 32/60 in 2025',
    noteHi: '2021 में "स्वतंत्र" से "आंशिक रूप से स्वतंत्र" में डाउनग्रेड किया गया; PR: 31/40, CL: 32/60 2025 में',
  },
  {
    id: 20,
    name: 'Social Progress Index',
    nameHi: 'सामाजिक प्रगति सूचकांक',
    shortName: 'SPI',
    publisher: 'Social Progress Imperative',
    category: 'Social',
    rank: 110,
    total: 170,
    score: '60.19',
    scoreMax: '100',
    year: 2023,
    trend: 'stable',
    trendNote: 'Stagnant for 3 years despite strong GDP growth',
    trendNoteHi: 'मजबूत GDP वृद्धि के बावजूद 3 वर्षों से स्थिर',
    interpretation: 'Basic human needs, wellbeing foundations, and opportunity for all citizens',
    interpretationHi: 'बुनियादी मानव आवश्यकताएँ, कल्याण की नींव, और सभी नागरिकों के लिए अवसर',
    rankDirection: 'lower-better',
    sourceUrl: 'https://www.socialprogress.org/',
  },
  {
    id: 21,
    name: 'Global Health Security Index',
    nameHi: 'वैश्विक स्वास्थ्य सुरक्षा सूचकांक',
    shortName: 'GHSI',
    publisher: 'NTI / Johns Hopkins Bloomberg School',
    category: 'Healthcare',
    rank: 66,
    total: 195,
    score: '42.8',
    scoreMax: '100',
    year: 2021,
    trend: 'up',
    trendNote: 'Up from 57th in 2019; improved detection & rapid response scores',
    trendNoteHi: '2019 में 57वें से ऊपर; बेहतर पहचान और त्वरित प्रतिक्रिया स्कोर',
    interpretation: 'Preparedness for biological threats — prevention, detection, response, health system',
    interpretationHi: 'जैविक खतरों के लिए तैयारी — रोकथाम, पहचान, प्रतिक्रिया, स्वास्थ्य प्रणाली',
    rankDirection: 'lower-better',
    sourceUrl: 'https://www.ghsindex.org/',
  },
  {
    id: 22,
    name: 'Sustainable Development Report',
    nameHi: 'सतत विकास रिपोर्ट',
    shortName: 'SDR',
    publisher: 'Bertelsmann Stiftung / SDSN',
    category: 'Social',
    rank: 109,
    total: 166,
    score: '63.5',
    scoreMax: '100',
    year: 2024,
    trend: 'stable',
    trendNote: 'Major challenges on SDG 2 (hunger), SDG 3 (health), SDG 13 (climate)',
    trendNoteHi: 'SDG 2 (भूख), SDG 3 (स्वास्थ्य), SDG 13 (जलवायु) पर प्रमुख चुनौतियां',
    interpretation: 'Progress across all 17 UN Sustainable Development Goals',
    interpretationHi: 'सभी 17 संयुक्त राष्ट्र सतत विकास लक्ष्यों में प्रगति',
    rankDirection: 'lower-better',
    sourceUrl: 'https://dashboards.sdgindex.org/profiles/india',
  },
  {
    id: 23,
    name: 'Human Freedom Index',
    nameHi: 'मानव स्वतंत्रता सूचकांक',
    shortName: 'HFI',
    publisher: 'Cato Institute / Fraser Institute',
    category: 'Governance',
    rank: 111,
    total: 165,
    score: '6.56',
    scoreMax: '10',
    year: 2023,
    trend: 'down',
    trendNote: 'Falling steadily since 2014; low personal and civil freedom scores',
    trendNoteHi: '2014 से लगातार गिरावट; व्यक्तिगत और नागरिक स्वतंत्रता के कम स्कोर',
    interpretation: 'Personal freedom, economic freedom, and rule of law combined',
    interpretationHi: 'व्यक्तिगत स्वतंत्रता, आर्थिक स्वतंत्रता, और कानून का शासन संयुक्त रूप से',
    rankDirection: 'lower-better',
    sourceUrl: 'https://www.cato.org/human-freedom-index/2023',
  },
  {
    id: 24,
    name: 'Global Terrorism Index',
    nameHi: 'वैश्विक आतंकवाद सूचकांक',
    shortName: 'GTI',
    publisher: 'Institute for Economics & Peace',
    category: 'Governance',
    rank: 13,
    total: 163,
    score: '6.428',
    scoreMax: '10',
    scoreUnit: '(higher = more impacted)',
    scoreUnitHi: '(ज्यादा = अधिक प्रभावित)',
    year: 2026,
    trend: 'down',
    trendNote: 'Worsened to rank 13 in 2026 (score 6.428, up from 5.099 in 2024); J&K and Maoist-affected districts remain active',
    trendNoteHi: '2026 में रैंक 13 तक बिगड़ा (स्कोर 6.428, 2024 में 5.099 से ऊपर); जम्मू-कश्मीर और माओवादी प्रभावित जिले सक्रिय बने हुए हैं',
    interpretation: 'Impact of terrorism — incidents, fatalities, injuries, and property damage',
    interpretationHi: 'आतंकवाद का प्रभाव — घटनाएँ, मृत्यु, चोटें, और संपत्ति क्षति',
    rankDirection: 'lower-better',
    sourceUrl: 'https://www.visionofhumanity.org/maps/global-terrorism-index/',
  },
  {
    id: 25,
    name: 'Logistics Performance Index',
    nameHi: 'लॉजिस्टिक्स प्रदर्शन सूचकांक',
    shortName: 'LPI',
    publisher: 'World Bank',
    category: 'Economy',
    rank: 38,
    total: 139,
    score: '3.40',
    scoreMax: '5.0',
    year: 2023,
    trend: 'up',
    trendNote: 'Up from 44 in 2018; PM Gati Shakti infrastructure push credited',
    trendNoteHi: '2018 में 44 से ऊपर; पीएम गति शक्ति अवसंरचना पहल को श्रेय',
    interpretation: 'Customs efficiency, infrastructure quality, tracking, timeliness of shipments',
    interpretationHi: 'कस्टम दक्षता, अवसंरचना गुणवत्ता, ट्रैकिंग, शिपमेंट की समयबद्धता',
    rankDirection: 'lower-better',
    sourceUrl: 'https://lpi.worldbank.org/',
  },
  {
    id: 26,
    name: 'V-Dem Electoral Democracy Index',
    nameHi: 'V-Dem चुनावी लोकतंत्र सूचकांक',
    shortName: 'V-Dem',
    publisher: 'Varieties of Democracy Institute',
    category: 'Governance',
    rank: 108,
    total: 179,
    score: '0.299',
    scoreMax: '1.0',
    year: 2024,
    trend: 'down',
    trendNote: 'Classified "Electoral Autocracy" since 2018; sharpest decline among large democracies',
    trendNoteHi: '2018 से "चुनावी तानाशाही" के रूप में वर्गीकृत; बड़ी लोकतंत्रों में सबसे तेज गिरावट',
    interpretation: 'Free and fair elections, freedom of expression, media, and civil society',
    interpretationHi: 'स्वतंत्र और निष्पक्ष चुनाव, अभिव्यक्ति की स्वतंत्रता, मीडिया, और नागरिक समाज',
    rankDirection: 'lower-better',
    sourceUrl: 'https://v-dem.net/data/the-v-dem-dataset/',
    note: 'India went from "Electoral Democracy" to "Electoral Autocracy" between 2015 and 2020',
    noteHi: 'भारत 2015 से 2020 के बीच "चुनावी लोकतंत्र" से "चुनावी तानाशाही" में बदल गया',
  },
  {
    id: 27,
    name: 'Internet Freedom Index',
    nameHi: 'इंटरनेट स्वतंत्रता सूचकांक',
    shortName: 'IFI',
    publisher: 'Freedom House',
    category: 'Governance',
    rank: 40,
    total: 72,
    score: '50',
    scoreMax: '100',
    scoreUnit: '(higher = more free)',
    scoreUnitHi: '(ज्यादा = अधिक स्वतंत्र)',
    year: 2024,
    trend: 'down',
    trendNote: 'Score unchanged at 50/100 in 2024; world leader in internet shutdowns for 6+ consecutive years',
    trendNoteHi: '2024 में स्कोर 50/100 अपरिवर्तित; 6+ लगातार वर्षों से इंटरनेट शटडाउन में विश्व नेता',
    interpretation: 'Obstacles to access, limits on content, and violations of user rights online',
    interpretationHi: 'पहुँच में बाधाएँ, सामग्री पर सीमाएँ, और ऑनलाइन उपयोगकर्ता अधिकारों का उल्लंघन',
    rankDirection: 'lower-better',
    sourceUrl: 'https://freedomhouse.org/country/india/freedom-net/2024',
    note: 'India recorded more internet shutdowns than any other country in 2023 and 2024',
    noteHi: 'भारत ने 2023 और 2024 में किसी भी अन्य देश की तुलना में अधिक इंटरनेट शटडाउन दर्ज किए',
  },
];

const CATEGORIES = ['All', 'Healthcare', 'Education', 'Economy', 'Governance', 'Environment', 'Social'] as const;

function rankColor(rank: number, total: number, rankDirection: 'lower-better' | 'higher-better') {
  if (total === 0) return 'text-muted-foreground';
  const pct = rank / total;
  if (rankDirection === 'lower-better') {
    if (pct <= 0.25) return 'text-emerald-500';
    if (pct <= 0.50) return 'text-yellow-500';
    if (pct <= 0.75) return 'text-orange-500';
    return 'text-red-500';
  }
  const inv = 1 - pct;
  if (inv >= 0.75) return 'text-emerald-500';
  if (inv >= 0.50) return 'text-yellow-500';
  if (inv >= 0.25) return 'text-orange-500';
  return 'text-red-500';
}

function rankBg(rank: number, total: number) {
  if (total === 0) return 'bg-muted/50 border-border';
  const pct = rank / total;
  if (pct <= 0.25) return 'bg-emerald-500/5 border-emerald-500/20';
  if (pct <= 0.50) return 'bg-yellow-500/5 border-yellow-500/20';
  if (pct <= 0.75) return 'bg-orange-500/5 border-orange-500/20';
  return 'bg-red-500/5 border-red-500/20';
}

function positionLabel(rank: number, total: number, t: (key: string) => string) {
  if (total === 0) return null;
  const pct = rank / total;
  if (pct <= 0.25) return { label: t('top25Label'), color: 'text-emerald-500 bg-emerald-500/10' };
  if (pct <= 0.50) return { label: t('top50Label'), color: 'text-yellow-500 bg-yellow-500/10' };
  if (pct <= 0.75) return { label: t('bottom50Label'), color: 'text-orange-500 bg-orange-500/10' };
  return { label: t('bottom25Label'), color: 'text-red-500 bg-red-500/10' };
}

const CAT_COLORS: Record<string, string> = {
  Healthcare:  'bg-blue-500/10 text-blue-400',
  Education:   'bg-purple-500/10 text-purple-400',
  Economy:     'bg-emerald-500/10 text-emerald-400',
  Governance:  'bg-orange-500/10 text-orange-400',
  Environment: 'bg-teal-500/10 text-teal-400',
  Social:      'bg-pink-500/10 text-pink-400',
};

export default function DevelopmentIndex() {
  const { t, i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const filtered = activeCategory === 'All'
    ? INDICES
    : INDICES.filter(i => i.category === activeCategory);

  const ranked = INDICES.filter(i => i.total > 0);
  const bottomQuartile = ranked.filter(i => i.rank / i.total > 0.75).length;
  const topHalf = ranked.filter(i => i.rank / i.total <= 0.50).length;

  const CATEGORY_LABELS: Record<string, string> = {
    All: t('allCategory'),
    Healthcare: t('healthcareCategory'),
    Education: t('educationCategory'),
    Economy: t('economyCategory'),
    Governance: t('governanceCategory'),
    Environment: t('environmentCategory'),
    Social: t('socialCategory'),
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <SEO
        title="India's Global Development Rankings 2025"
        description="India's standing across 30 international indices — Human Development, Press Freedom, Hunger, Corruption, Climate, and more. Ranked with sources and trend data."
        path="/development-index"
        ogImage="/og/development-index.jpg"
      />

      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-3xl font-bold text-foreground mb-3">{t('navDevelopmentIndex')}</h1>
          <p className="text-muted-foreground max-w-2xl leading-relaxed">
            {t('intro')}
          </p>

          {/* Summary pills */}
          <div className="flex flex-wrap gap-4 mt-8">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-5 py-3">
              <div className="text-2xl font-bold text-red-500">{bottomQuartile}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t('bottomQuartileLabel')}</div>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-5 py-3">
              <div className="text-2xl font-bold text-yellow-500">{topHalf}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t('topHalfLabel')}</div>
            </div>
            <div className="bg-muted border border-border rounded-lg px-5 py-3">
              <div className="text-2xl font-bold text-foreground">30</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t('trackedLabel')}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                activeCategory === cat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(entry => {
            const TrendIcon = entry.trend === 'up' ? TrendingUp : entry.trend === 'down' ? TrendingDown : Minus;
            const trendColor = entry.trend === 'up' ? 'text-emerald-500' : entry.trend === 'down' ? 'text-red-400' : 'text-muted-foreground';
            const pos = positionLabel(entry.rank, entry.total, t);
            const isRanked = entry.total > 0;

            return (
              <div
                key={entry.id}
                className={`rounded-xl border p-5 flex flex-col gap-3 ${isRanked ? rankBg(entry.rank, entry.total) : 'bg-muted/30 border-border'}`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CAT_COLORS[entry.category]}`}>
                      {CATEGORY_LABELS[entry.category]}
                    </span>
                    <h3 className="font-semibold text-foreground mt-2 leading-snug text-sm">
                      {isHi ? (entry.nameHi ?? entry.name) : entry.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.publisher} · {entry.year}</p>
                  </div>
                  {pos && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${pos.color}`}>
                      {pos.label}
                    </span>
                  )}
                </div>

                {/* Rank / Score */}
                <div className="flex items-end gap-4">
                  {isRanked ? (
                    <div>
                      <div className={`text-3xl font-bold tabular-nums ${rankColor(entry.rank, entry.total, entry.rankDirection)}`}>
                        #{entry.rank}
                      </div>
                      <div className="text-xs text-muted-foreground">{t('outOfCountries', { total: entry.total })}</div>
                    </div>
                  ) : null}
                  {entry.score && (
                    <div className={isRanked ? 'border-l border-border pl-4' : ''}>
                      <div className="text-2xl font-bold text-foreground">
                        {entry.score}
                        {entry.scoreMax && <span className="text-sm text-muted-foreground font-normal">/{entry.scoreMax}</span>}
                      </div>
                      {entry.scoreUnit && (
                        <div className="text-xs text-muted-foreground leading-tight max-w-[140px]">{isHi ? (entry.scoreUnitHi ?? entry.scoreUnit) : entry.scoreUnit}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Progress bar (ranked only) */}
                {isRanked && (
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        entry.rank / entry.total <= 0.25 ? 'bg-emerald-500' :
                        entry.rank / entry.total <= 0.50 ? 'bg-yellow-500' :
                        entry.rank / entry.total <= 0.75 ? 'bg-orange-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${(entry.rank / entry.total) * 100}%` }}
                    />
                  </div>
                )}

                {/* Interpretation */}
                <p className="text-xs text-muted-foreground leading-relaxed">{isHi ? (entry.interpretationHi ?? entry.interpretation) : entry.interpretation}</p>

                {/* Trend */}
                {entry.trendNote && (
                  <div className={`flex items-start gap-1.5 text-xs ${trendColor}`}>
                    <TrendIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{isHi ? (entry.trendNoteHi ?? entry.trendNote) : entry.trendNote}</span>
                  </div>
                )}

                {/* Note */}
                {entry.note && (
                  <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/60 rounded-md px-2.5 py-2">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-yellow-500" />
                    <span>{isHi ? (entry.noteHi ?? entry.note) : entry.note}</span>
                  </div>
                )}

                {/* Source link */}
                <a
                  href={entry.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline mt-auto"
                >
                  <ExternalLink className="w-3 h-3" />
                  {t('viewSource')}
                </a>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground mt-10 pb-6 text-center max-w-2xl mx-auto">
          {t('methodology')}
        </p>
      </div>
    </div>
  );
}

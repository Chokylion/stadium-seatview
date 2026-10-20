export type Lang = 'th' | 'en';

const S = {
  tapZone: { th: 'แตะเพื่อเลือกโซน', en: 'Tap a zone' },
  pickSeat: { th: 'เลือกที่นั่ง', en: 'Pick a seat' },
  back: { th: 'ย้อนกลับ', en: 'Back' },
  enterView: { th: 'เข้าสู่มุมมองที่นั่ง', en: 'Enter seat view' },
  getTickets: { th: 'ซื้อบัตร', en: 'Get tickets' },
  share: { th: 'แชร์', en: 'Share' },
  row: { th: 'แถว', en: 'Row' },
  seat: { th: 'ที่นั่ง', en: 'Seat' },
  toStage: { th: 'ระยะถึงเวที', en: 'To stage' },
  nearestStair: { th: 'บันไดใกล้สุด', en: 'Nearest stair' },
  nearestExit: { th: 'ทางออกใกล้สุด', en: 'Nearest exit' },
  recenter: { th: 'จัดกึ่งกลาง', en: 'Re-center' },
  price: { th: 'ราคา', en: 'Price' },
  disclaimer: {
    th: 'มุมมองเป็นค่าประมาณ ไม่ได้มีส่วนเกี่ยวข้องกับสนาม ผู้จัด หรือศิลปิน',
    en: 'Views are approximate. Not affiliated with the stadium, promoters, or artists.',
  },
} as const;

export type Key = keyof typeof S;

let lang: Lang = 'th';
export function setLang(l: Lang) { lang = l; }
export function getLang(): Lang { return lang; }
export function t(key: Key): string { return S[key][lang]; }

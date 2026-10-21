// 디자인 시안의 댓글 아바타 색. 호칭별로 항상 같은 색이 나오게 한다
const KNOWN: Record<string, string> = {
  할머니: '#F2D9A6',
  할아버지: '#D9E4F2',
  아빠: '#CFE3D6',
  엄마: '#F4D3C4',
  큰딸: '#E3DCF2',
  막내: '#F7E7A9',
};
const PALETTE = ['#F2D9A6', '#D9E4F2', '#CFE3D6', '#F4D3C4', '#E3DCF2', '#F7E7A9', '#E6E1D6'];

export function avatarColor(name: string) {
  if (KNOWN[name]) return KNOWN[name];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

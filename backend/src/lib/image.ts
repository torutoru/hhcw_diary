import sharp from 'sharp';

const TARGET_MAX_BYTES = 400 * 1024;
// 긴 변 기준. 첫 단계에서 목표 용량을 못 맞추면 다음 크기로 줄인다
const EDGE_STEPS = [2048, 1600, 1280, 1024];
const QUALITY_MIN = 50;
const QUALITY_MAX = 88;
// 품질은 4단위로 찾는다 (1단위는 눈으로 구분되지 않고 인코딩 횟수만 늘어난다)
const QUALITY_STEP = 4;
// WebP 압축 노력(0~6). 2는 4보다 약 30% 빠르고 같은 화질에서 파일이 2%쯤 커진다.
// Render 무료(0.1 CPU)에서 변환이 Netlify 프록시 제한(26초)을 넘지 않게 낮췄다 (2026-10-26, 고해상도 아이폰 사진 업로드 실패)
const EFFORT = 2;

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
  bytes: number;
}

/**
 * 업로드 이미지를 리사이즈 + WebP 변환한다.
 * 목표는 400KB 이하에서 가장 높은 품질 (보통 200~400KB).
 * 원본이 작으면 200KB 아래로 나올 수 있고, 일부러 키우지는 않는다.
 * EXIF 회전은 적용하고, 위치정보 등 메타데이터는 제거된다.
 */
export async function toWebp(input: Buffer): Promise<ProcessedImage> {
  let last: ProcessedImage | null = null;

  for (const edge of EDGE_STEPS) {
    // 디코딩/리사이즈는 크기 단계마다 한 번만 하고, 품질 탐색은 raw 픽셀로 반복
    const { data: raw, info } = await sharp(input, { failOn: 'none' })
      .rotate()
      .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const encode = (quality: number) =>
      sharp(raw, { raw: { width: info.width, height: info.height, channels: info.channels } })
        .webp({ quality, effort: EFFORT })
        .toBuffer();
    const result = (data: Buffer): ProcessedImage => ({
      data,
      width: info.width,
      height: info.height,
      bytes: data.length,
    });

    // 대부분의 사진은 최고 품질 한 번으로 끝난다
    const top = await encode(QUALITY_MAX);
    if (top.length <= TARGET_MAX_BYTES) return result(top);

    // 최저 품질로도 넘으면 이 크기에서는 찾을 필요 없이 바로 다음 크기로
    const min = await encode(QUALITY_MIN);
    last = result(min);
    if (min.length > TARGET_MAX_BYTES) continue;

    // 400KB 이하가 되는 가장 높은 품질을 4단위로 이진 탐색 (QUALITY_MIN 은 이미 통과)
    let lo = QUALITY_MIN + QUALITY_STEP;
    let hi = QUALITY_MAX - QUALITY_STEP;
    let best = min;
    while (lo <= hi) {
      const mid = lo + Math.floor((hi - lo) / QUALITY_STEP / 2) * QUALITY_STEP;
      const buf = await encode(mid);
      if (buf.length <= TARGET_MAX_BYTES) {
        best = buf;
        lo = mid + QUALITY_STEP;
      } else {
        hi = mid - QUALITY_STEP;
      }
    }
    return result(best);
  }

  // 모든 단계에서 400KB를 넘으면 가장 작은 결과를 사용
  return last!;
}

// 리스트용 사진: 메인 피드 카드·상세 가로 스크롤·작성 미리보기에 쓴다 (크게 보기는 원본).
// 1080px = 3배율 휴대폰에서 카드 폭(약 360pt)을 선명하게 채우는 크기. 보통 80~130KB
const THUMB_EDGE = 1080;
const THUMB_QUALITY = 72;

/** 업로드할 때 원본 WebP로 리스트용 WebP를 만든다 (기능 추가 전 사진은 만들지 않고 원본을 대신 쓴다) */
export async function toThumb(input: Buffer): Promise<ProcessedImage> {
  const { data, info } = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY, effort: EFFORT })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, bytes: data.length };
}

/** 원본 키 → 리스트용 키: images/2026-10/<id>.webp → images/2026-10/<id>_thumb.webp */
export const thumbKeyFor = (key: string) => key.replace(/\.webp$/, '_thumb.webp');

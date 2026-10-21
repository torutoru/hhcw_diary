import sharp from 'sharp';

const TARGET_MAX_BYTES = 400 * 1024;
// 긴 변 기준. 첫 단계에서 목표 용량을 못 맞추면 다음 크기로 줄인다
const EDGE_STEPS = [2048, 1600, 1280, 1024];
const QUALITY_MIN = 50;
const QUALITY_MAX = 88;

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
        .webp({ quality, effort: 4 })
        .toBuffer();

    const top = await encode(QUALITY_MAX);
    if (top.length <= TARGET_MAX_BYTES) {
      return { data: top, width: info.width, height: info.height, bytes: top.length };
    }

    // 400KB 이하가 되는 가장 높은 품질을 이진 탐색
    let lo = QUALITY_MIN;
    let hi = QUALITY_MAX - 1;
    let best: Buffer | null = null;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const buf = await encode(mid);
      if (buf.length <= TARGET_MAX_BYTES) {
        best = buf;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (best) {
      return { data: best, width: info.width, height: info.height, bytes: best.length };
    }

    const fallback = await encode(QUALITY_MIN);
    last = { data: fallback, width: info.width, height: info.height, bytes: fallback.length };
  }

  // 모든 단계에서 400KB를 넘으면 가장 작은 결과를 사용
  return last!;
}

// 업로드 전 1차 축소. 최종 리사이즈/WebP 변환(200~400KB)은 서버가 한다.
// 휴대폰 원본(수 MB)을 그대로 보내지 않아 업로드가 빨라진다.
const MAX_EDGE = 2560;
const SKIP_UNDER_BYTES = 1.5 * 1024 * 1024;

export async function preShrink(file: File): Promise<Blob> {
  if (file.size <= SKIP_UNDER_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    // 브라우저가 디코딩하지 못하는 형식이면 원본을 보내고 서버에 맡긴다
    return file;
  }
}

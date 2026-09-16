// src/lib/thumb.ts
export function getThumbPath(imgPath: string): string {
  return imgPath.replace(/(\.\w+)$/, '-thumb.webp');
}
import sharp from "sharp";
import { JPEG_QUALITY, MAX_DIMENSION_PX } from "./constants";

/**
 * Compresses an uploaded image buffer per ADR-003 D3-04 / PRD AC-08:
 *
 * - auto-rotate based on EXIF orientation, then discard the orientation tag
 *   (`autoOrient`, confirmed via Context7 `/lovell/sharp` docs)
 * - resize to fit within `MAX_DIMENSION_PX` on the longest edge, without
 *   upscaling images that are already smaller (`fit: "inside"` +
 *   `withoutEnlargement: true`)
 * - re-encode as JPEG at `JPEG_QUALITY`
 * - strip all remaining metadata — sharp's default behavior when
 *   `keepMetadata()`/`withMetadata()` is not called (confirmed via
 *   Context7 docs: "default behaviour ... is to ... strip all metadata")
 *
 * Only the compressed buffer is ever produced; the caller is responsible
 * for persisting it (see `./store`). The original bytes passed in are never
 * written anywhere by this function.
 *
 * @throws if `input` is not a decodable image.
 */
export async function compressImage(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .autoOrient()
    .resize({
      width: MAX_DIMENSION_PX,
      height: MAX_DIMENSION_PX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}

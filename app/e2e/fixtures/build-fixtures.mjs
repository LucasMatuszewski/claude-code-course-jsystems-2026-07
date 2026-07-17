// Build the three E2E fixtures from the real device photos in
// assets/example-images-for-tests (Lucas's own NBP-course hardware photos):
//   clean-product.jpg   <- laptop-2.webp  (intact Lenovo ThinkPad, powered on)
//   damaged-product.jpg <- phone-1.jpg    (iPhone with a shattered screen)
//   unusable-blurry.jpg <- phone-2.jpeg   (intact iPhone back, destroyed by blur)
// Processed through the project's own sharp: EXIF-rotated, resized <=1280,
// recompressed to small JPEGs so they stay git-friendly.
// Run from anywhere: node app/e2e/fixtures/build-fixtures.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// repo-root/assets/example-images-for-tests <- .../app/e2e/fixtures
const ASSETS = path.resolve(__dirname, "../../../assets/example-images-for-tests");
const OUT = __dirname;

async function save(src, dst, transform) {
  let img = sharp(path.join(ASSETS, src)).rotate();
  img = img.resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true });
  if (transform) img = transform(img);
  const info = await img.jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(OUT, dst));
  console.log(dst, "<-", src, `${info.width}x${info.height}`, `${(info.size / 1024).toFixed(0)}KB`);
}

await save("laptop-2.webp", "clean-product.jpg");
await save("phone-1.jpg", "damaged-product.jpg");
await save("phone-2.jpeg", "unusable-blurry.jpg", (img) => img.blur(22));
console.log("Done.");

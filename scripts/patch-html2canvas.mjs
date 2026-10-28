import fs from "node:fs";
import path from "node:path";

const targetFiles = [
  "node_modules/html2canvas/dist/html2canvas.esm.js",
  "node_modules/html2canvas/dist/html2canvas.js",
  "node_modules/html2canvas/dist/lib/css/types/color.js",
  "node_modules/.vite/deps/html2canvas.js",
];

let totalPatched = 0;

for (const relPath of targetFiles) {
  const fullPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) continue;

  try {
    let content = fs.readFileSync(fullPath, "utf8");
    const needle1 = 'throw new Error("Attempting to parse an unsupported color function \\"" + value.name + "\\"");';
    const needle2 = "throw new Error('Attempting to parse an unsupported color function \"' + value.name + '\"');";

    let modified = false;
    if (content.includes(needle1)) {
      content = content.replaceAll(needle1, "return COLORS.TRANSPARENT;");
      modified = true;
    }
    if (content.includes(needle2)) {
      content = content.replaceAll(needle2, "return COLORS.TRANSPARENT;");
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(fullPath, content, "utf8");
      console.log(`[patch-html2canvas] Successfully patched ${relPath}`);
      totalPatched++;
    } else {
      console.log(`[patch-html2canvas] Already patched or pattern not found in ${relPath}`);
    }
  } catch (err) {
    console.warn(`[patch-html2canvas] Failed to patch ${relPath}:`, err.message);
  }
}

console.log(`[patch-html2canvas] Done. Total files patched: ${totalPatched}`);


import fs from "node:fs";
import path from "node:path";

function findJsFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findJsFiles(fullPath, fileList);
    } else if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".mjs"))) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const filesToScan = new Set([
  ...findJsFiles(path.resolve(process.cwd(), "node_modules/html2canvas")),
  ...findJsFiles(path.resolve(process.cwd(), "node_modules/.vite")),
]);

let totalPatched = 0;

for (const fullPath of filesToScan) {
  try {
    let content = fs.readFileSync(fullPath, "utf8");
    if (!content.includes("unsupported color function")) continue;

    let modified = false;

    // Pattern 1: unminified double quotes
    const needle1 = 'throw new Error("Attempting to parse an unsupported color function \\"" + value.name + "\\"");';
    if (content.includes(needle1)) {
      content = content.replaceAll(needle1, "return (typeof COLORS !== 'undefined' ? COLORS.TRANSPARENT : 0);");
      modified = true;
    }

    // Pattern 2: unminified single quotes
    const needle2 = "throw new Error('Attempting to parse an unsupported color function \"' + value.name + '\"');";
    if (content.includes(needle2)) {
      content = content.replaceAll(needle2, "return (typeof COLORS !== 'undefined' ? COLORS.TRANSPARENT : 0);");
      modified = true;
    }

    // Pattern 3: minified html2canvas (e.g. min.js)
    const minifiedNeedle = /throw new Error\(['"]Attempting to parse an unsupported color function [^)]+\);?/g;
    if (minifiedNeedle.test(content)) {
      content = content.replace(minifiedNeedle, "return 0;");
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(fullPath, content, "utf8");
      const relPath = path.relative(process.cwd(), fullPath);
      console.log(`[patch-html2canvas] Successfully patched ${relPath}`);
      totalPatched++;
    }
  } catch (err) {
    console.warn(`[patch-html2canvas] Failed to check ${fullPath}:`, err.message);
  }
}

console.log(`[patch-html2canvas] Done. Total files patched: ${totalPatched}`);

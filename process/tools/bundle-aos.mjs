import { bundle } from './lua-bundler.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mainFilePath = '../' + (process.argv[2] || 'src/aos.lua');
const outputFilePath = '../' + (process.argv[3] || 'dist/process.lua');

async function main() {
  console.log('🔧 Bundling Lua...');

  console.log('👀 Input file:', mainFilePath);
  console.log('📦 Output file:', outputFilePath);
  // Bundle the main Lua file
  const bundledLua = bundle(path.join(__dirname, mainFilePath));

  // Read the LICENSE file
  const licensePath = path.join(__dirname, '../LICENSE');
  const rawLicense = fs.readFileSync(licensePath, 'utf8');
  const licenseText = `--[[\n${rawLicense}\n]]\n\n`;

  // Concatenate LICENSE and bundled Lua
  const luaWithLicense = `${licenseText}\n\n${bundledLua}`;

  // Ensure the dist directory exists
  const distPath = path.join(__dirname, outputFilePath);
  const distDir = path.dirname(distPath);
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Write the concatenated content to the output file
  fs.writeFileSync(path.join(distPath), luaWithLicense);
  console.log('🚀 Done!');
}

main();

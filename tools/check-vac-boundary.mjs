import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const scanRoots = ["src", "src-tauri/src"];
const extensions = new Set([".ts", ".tsx", ".js", ".mjs", ".rs"]);
const forbidden = [
  /ReadProcessMemory/i,
  /WriteProcessMemory/i,
  /OpenProcess/i,
  /CreateRemoteThread/i,
  /SetWindowsHookEx/i,
  /SendInput/i,
  /process_vm_(readv|writev)/i,
  /ptrace\s*\(/i,
  /dota2\.exe/i,
  /client\.dll/i,
  /engine2\.dll/i,
  /packet\s*(capture|sniff|inject)/i,
  /memory\s*(scan|read|write)/i
];

const files = [];
function walk(path) {
  for (const entry of readdirSync(path)) {
    const full = join(path, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (extensions.has(extname(full))) files.push(full);
  }
}
for (const path of scanRoots) walk(join(root, path));

const findings = [];
for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, index) => {
    for (const pattern of forbidden) {
      if (pattern.test(line)) findings.push(`${relative(root, file)}:${index + 1}: ${pattern}`);
    }
  });
}

if (findings.length) {
  console.error("VAC safety boundary violated:\n" + findings.join("\n"));
  process.exit(1);
}
console.log(`VAC boundary check passed (${files.length} source files scanned).`);

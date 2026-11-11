import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const pasta = dirname(fileURLToPath(import.meta.url));
const origem = pathToFileURL(join(pasta, "curriculo.html")).href;
const destino = resolve(
  pasta,
  "../../public/Curriculo-Eduardo-Ferreira-2026.pdf",
);

const navegadores = [
  process.env.NAVEGADOR,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

const navegador = navegadores.find((caminho) => existsSync(caminho));
if (!navegador) {
  console.error(
    "Nenhum Chrome ou Edge encontrado. Informe o caminho em NAVEGADOR.",
  );
  process.exit(1);
}

execFileSync(navegador, [
  "--headless",
  "--disable-gpu",
  "--no-pdf-header-footer",
  "--virtual-time-budget=8000",
  `--print-to-pdf=${destino}`,
  origem,
]);

process.stdout.write(`Currículo gerado em ${destino}
`);

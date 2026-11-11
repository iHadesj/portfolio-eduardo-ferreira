# Plano V2 — "cair no buraco negro"

Refatoração inspirada em [fojcikdominik.com](https://fojcikdominik.com): a técnica
e a sensação dele (mundo 3D guiado pelo scroll, retrato que se desfaz no mouse,
estética CRT/dot-matrix), com a identidade daqui (terminal + buraco negro).
Nada de asset, texto ou modelo dele — só a ideia.

## Como o site dele funciona (referência)

| Peça      | Dele                                                                                                                                                                                                                               | Aqui                                                                                                                                                                           |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework | Astro 6 + View Transitions                                                                                                                                                                                                         | Next 16 (fica)                                                                                                                                                                 |
| 3D        | three.js **WebGPU** + TSL, num **Web Worker** (OffscreenCanvas)                                                                                                                                                                    | WebGL2 escrito à mão (já temos `three/gl-utils.ts`)                                                                                                                            |
| Scroll    | Lenis → `scrollProgress` → câmera com `lerp`/`damp` num corredor GLB                                                                                                                                                               | Lenis (já temos) → câmera caindo no buraco negro                                                                                                                               |
| Retrato   | `GlitchPortrait`: vídeo com profundidade (`.af` + `VideoDecoder`) virando grade de voxels; o mouse é um raio 3D (`uCursorRayOrigin/Direction`) que empurra os voxels com a velocidade do cursor; clique solta onda (`uWaveOrigin`) | Foto (`minha-foto.webp`) virando grade de partículas em meio-tom; mouse empurra/gira, partícula energizada vira glifo e esquenta pra cor do disco; clique = onda gravitacional |
| Pós       | blur gaussiano, glow, grade de cor, pixel ratio adaptativo                                                                                                                                                                         | CRT: scanline, glow, pixel                                                                                                                                                     |
| Tipo      | Doto + OffBit (dot-matrix)                                                                                                                                                                                                         | Geist Mono + uma dot-matrix nos títulos                                                                                                                                        |
| UI        | menu tela cheia numerado, pontos piscando, permissão de giroscópio                                                                                                                                                                 | idem, com cara de terminal                                                                                                                                                     |

## Fases

Cada fase fecha com `pnpm lint && pnpm typecheck && pnpm build` verdes e um commit.
Tudo respeita `prefers-reduced-motion` (fica a versão estática) e Save-Data.

### Fase 1 — Retrato que desintegra ✅ em andamento

- `three/photo-dust.ts`: simulação de partículas (CPU, ~8k pontos, dorme quando
  parado) + render WebGL2 em `gl.POINTS`.
- A foto vira meio-tom: tamanho do ponto = luminância (invertido no tema claro).
- Mouse: empurra, arrasta com a velocidade e gira as partículas em volta do
  cursor; elas voltam por mola. Energizada → vira glifo ASCII e esquenta
  (`--color-hole-flame`). Clique/toque → onda gravitacional.
- Primeira vez que aparece na tela: as partículas se montam vindas de um redemoinho.
- `sections/portrait-dust.tsx` envolve o `<Portrait>` (que continua sendo o poster
  SSR, o `alt` e o fallback de reduced-motion).
- Futuro (1b, opcional): mapa de profundidade da foto pra dar relevo 3D.

### Fase 2 — Tipografia e detalhes de UI

- Fonte dot-matrix (Doto, OFL) nos títulos de display; Geist Mono no resto.
- Pontos piscando (`step-end`) nos status; títulos `( assim )`.
- Menu de tela cheia numerado (`01 home`, `02 projetos`…), com o shell/⌘K mantidos.

### Fase 3 — Filtro CRT

- Overlay global leve: scanlines, vinheta, glow no texto (`text-shadow` por token).
- No WebGL: passe de pixel/glow opcional, desligado em telas fracas.

### Fase 4 — Palco persistente

- O canvas do buraco negro sai do hero e vira um palco `position: fixed` no
  layout, que não desmonta nas trocas de rota (view transitions).
- O hero passa a ser HTML por cima do palco.

### Fase 5 — Câmera caindo

- Lenis → progresso 0–1 da home → a câmera se aproxima/orbita o buraco negro
  com `damp`. Cada seção é uma "parada" da queda; no contato, horizonte de eventos.
- Poeira/detritos (`black-hole-dust.ts`, `debris.ts`) reaproveitados como parallax.

### Fase 6 — Projetos orbitando

- Os cards de projeto viram painéis de terminal no disco de acreção; hover
  aproxima, clique entra no case study com transição.

### Fase 7 — Mouse e giroscópio

- Cena inclina com o mouse; no celular, pedido de permissão de
  Motion & Orientation (iOS) com "permitir / recusar" lembrado.

### Fase 8 — Preloader e transições

- Boot sequence vira o preloader do palco (progresso real de shader/fontes).

### Fase 9 — Gates

- Lighthouse/axe, orçamento de JS do palco, pixel ratio adaptativo, testes.

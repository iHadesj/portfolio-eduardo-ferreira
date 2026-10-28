/**
 * Canonical dictionary. `en.ts` is typed `satisfies Dictionary`, so anything
 * added here fails the build until it is translated there too.
 *
 * Rules for this file:
 * - Pure data. The client slice crosses the RSC boundary, so no functions and
 *   no JSX — interpolate with `{placeholders}` + `fill()` from `../format`.
 * - Emphasis inside prose is expressed as `{ em: "…" }` segments and rendered
 *   by `<RichText>`; that keeps markup decisions out of the copy.
 */

export type RichNode = string | { readonly em: string };
export type Rich = readonly RichNode[];

export const pt = {
  meta: {
    title: "Edu Ferreira — Desenvolvedor Fullstack Java & React/TypeScript",
    description:
      "Dev fullstack: React e TypeScript no front, Java no back. Ajudei a construir do zero o Portal VTT e sigo testando ideias em projetos próprios.",
    ogEyebrow: "portfólio",
  },

  common: {
    /**
     * Both of these describe the locale being *offered*, not the current one,
     * and are written in that target language: a reader who cannot read this
     * page still recognises the way out. Keeping them in the active
     * dictionary avoids pulling the other one into the client bundle.
     */
    otherLocaleShort: "EN",
    switchLanguage: "View in English",
    emailCopied: "E-mail copiado",
    downloadingCv: "Baixando currículo…",
    themeToggle: "Alternar tema",
    themeToDark: "Ativar tema escuro",
    themeToLight: "Ativar tema claro",
  },

  nav: {
    main: "Navegação principal",
    footer: "Rodapé",
    home: "Início — Edu Ferreira",
    commands: "Comandos",
    openCommands: "Abrir paleta de comandos",
    openMenu: "Abrir menu",
    closeMenu: "Fechar menu",
    menuLabel: "Menu de navegação",
    skipToContent: "Pular para o conteúdo",
  },

  hero: {
    prompt: "whoami",
    role: "Full stack dev. React, Next.js e TypeScript no front, Java no back.",
    location: "grajaú, zona sul de sp",
    stackLabel: "stack",
    deliveriesLabel: "entregas",
    deliveries: [
      {
        id: "vtt",
        name: "VTT",
        detail:
          "20 meses construindo o Portal VTT do zero: painel de gestão de PDV e editor de jogos pra totens",
      },
      {
        id: "api-java",
        name: "API Java + PostgreSQL",
        detail: "JPA/Hibernate, camadas MVC e regra testada com JUnit",
      },
      {
        id: "levva",
        name: "Levva",
        detail:
          "e-commerce PWA offline-first: 400 produtos, carteira em centavos, 29 testes",
      },
      {
        id: "bernardo",
        name: "Um abraço, Bernardo",
        detail:
          "loja mobile-first com urso 3D que reage ao toque e pedido direto no WhatsApp",
      },
    ],
    ctaProjects: "ver projetos",
    ctaCv: "baixar cv",
    ctaCvAria: "Baixar currículo em PDF",
    availabilityOpen: "Aberto a oportunidades",
    availabilityClosed: "Sem disponibilidade no momento",
    availabilityAria: "Disponibilidade profissional",
    // The black hole's microcopy: a system readout, revealed as the pointer
    // nears it, and the hold's countdown.
    hole: {
      tag: "anomalia interativa",
      detected: "horizonte de eventos detectado.",
      how: "segure a singularidade por 3 s para colapsar o sistema.",
      orbitMouse: "arraste para orbitar",
      orbitTouch: "deslize para orbitar",
      idle: "segure para colapsar",
      holding: "horizonte de eventos",
      collapsing: "colapso",
      rebooting: "reiniciando o sistema",
      cancelled: "colapso cancelado",
      restored: "sistema restaurado",
      keyLabel:
        "Efeito visual: segure Espaço ou Enter por 3 segundos para colapsar o topo da página. Solte antes para cancelar.",
      statusCollapsing: "Colapso em andamento.",
      statusRestored: "Sistema restaurado.",
      // The kernel log the hero reboots from; "source:" leads each line.
      console: {
        absorbed: "singularidade: {count} objetos absorvidos",
        stable: "horizonte de eventos: estável",
        restoring: "reconstruindo ~/hero a partir do log",
      },
    },
  },

  about: {
    eyebrow: "sobre",
    // Spoken label for why.txt, which is quoted in English on every locale.
    whyLabel: "why.txt, o README do meu GitHub",
    paragraphs: [
      [
        "Comecei pelo back-end, com Java, Spring e banco de dados, porque queria entender o que acontece ",
        { em: "atrás da tela" },
        ". Modelar os dados, separar as camadas, escrever um teste e ver ele pegar o erro antes de mim: foi aí que caiu a ficha.",
      ],
      [
        "Depois fui pro front com React e TypeScript, e foi nele que passei a maior parte do estágio na VTT, ajudando a construir um portal do zero. Hoje gosto dos dois lados. Este site é minha área de ",
        { em: "experimentos" },
        ": está tudo no GitHub, o que ficou pronto e o que eu ainda quero melhorar.",
      ],
    ] as readonly Rich[],
    facts: [
      { key: "onde", value: "São Paulo - Zona Sul" },
      { key: "no dia a dia", value: "Java · Spring · React · TS" },
      { key: "aprendendo", value: "Angular · JUnit · Machine Learning" },
    ],
    statusLabel: "status",
    portraitAlt: "Retrato de Edu Ferreira",
    portraitPending: "foto a caminho",
  },

  projects: {
    eyebrow: "projetos",
    title: "Coisas que eu construí.",
    description:
      "Em cada um eu conto o que queria resolver, como resolvi e o que faria diferente hoje.",
    moreOnGithub: "Tem mais coisa no meu GitHub ↓",
    indexLabel: "outros",
    caseStudy: "Case study →",
    repoAria: "Repositório de {title}",
    demoAria: "Demo de {title}",
    coverAlt: "Tela do projeto {title}",
    statuses: {
      shipped: "no ar",
      "in-progress": "em progresso",
      archived: "arquivado",
    },
  },

  experience: {
    eyebrow: "xp",
    title: "Como eu cheguei até aqui.",
    items: [
      {
        period: "fev 2025 — out 2026",
        role: "Estagiário de Desenvolvimento Web",
        org: "VTT",
        bullets: [
          "Ajudei a construir o Portal VTT do zero: painel de gestão de PDV, cadastros, ferramentas internas e um módulo de chamados",
          "A parte de que mais me orgulho é o editor de jogos pra totens de evento (memória, quiz, roleta, formulário): a pessoa monta tudo no navegador e baixa um .zip pronto pro totem",
          "Fiquei mais no front, mas também escrevi servlets e endpoints em Java pra alimentar dashboards com dados reais",
          "Primeira vez com prazo, gente usando de verdade e código que não é só meu. Bem diferente de estudar sozinho",
        ],
        stack: ["React", "TypeScript", "Three.js", "Java", "SVN"],
      },
      {
        period: "fev 2025 — jul 2027 (previsão)",
        role: "Análise e Desenvolvimento de Sistemas",
        org: "Estácio",
        bullets: [
          "Fiz faculdade e estágio juntos por quase dois anos: o que eu via na aula costumava aparecer no trabalho na semana seguinte",
          "É onde eu pego a base que não dá pra aprender só no tutorial: estruturas de dados, banco e arquitetura",
        ],
        stack: ["Estruturas de dados", "POO", "SQL"],
      },
      {
        period: "2024 — agora",
        role: "Desenvolvedor Fullstack",
        org: "projetos próprios",
        bullets: [
          'Onde eu testo ideia sem medo de quebrar nada: StudyQuest, LIFE/MAINTENANCE, DevTrack, "Um abraço, Bernardo" e este site',
          "Offline-first virou quase um padrão meu: IndexedDB, service worker e app que abre sem internet",
          "Banco de dados fora do slide, aprendendo na tentativa e erro com PostgreSQL e MySQL",
        ],
        stack: ["React", "TypeScript", "Next.js", "IndexedDB", "PostgreSQL"],
      },
      {
        period: "set 2023 — out 2024",
        role: "Curso livre Back-End Java",
        org: "EBAC",
        bullets: [
          "Foi aqui que o Java virou minha base: POO, JPA/Hibernate e persistência com PostgreSQL",
          "Muito CRUD em MVC com JUnit, que acabou virando o projeto API Java + PostgreSQL ali em cima",
        ],
        stack: ["Java", "JPA/Hibernate", "PostgreSQL", "JUnit"],
      },
    ],
  },

  github: {
    eyebrow: "github",
    title: "Meu GitHub, ao vivo.",
    description:
      "Puxado direto da API, então é o que está lá de verdade — inclusive os dias em que eu não commitei nada.",
    contributionsSuffix: "contribuições no último ano",
    contributionsAria: "{total} contribuições no último ano",
    feed: {
      error: "O oráculo do GitHub não respondeu.",
      retry: "Tentar de novo",
      showArchive: "Ver repositórios anteriores",
      loadMore: "Carregar mais",
      loading: "Carregando…",
      archiveLabel: "~/arquivo",
      endOfArchive: "fim do arquivo — por enquanto.",
      loadError: "não consegui carregar mais agora.",
      emptyWindow: "nenhum repositório com push nos últimos {months} meses.",
      noDescription: "Sem descrição.",
    },
  },

  contact: {
    eyebrow: "contato",
    title: "Quer entrar em contato?",
    description:
      "Vaga, freela, uma dúvida — pode chamar. Back-end, front-end ou os dois.",
    preferEmail: "Prefere e-mail? Clica que já copia:",
    replyTime: "Costumo responder de um a dois dias.",
    form: {
      name: "Nome",
      email: "E-mail",
      message: "Mensagem",
      submit: "Enviar mensagem",
      sending: "Enviando…",
      honeypot: "Não preencha este campo",
      fallbackSuccess: "Mensagem enviada.",
    },
  },

  /** Server-action copy. Resolved on the server from the submitted locale. */
  contactAction: {
    success: "Mensagem enviada. Respondo em até 48h.",
    successDev: "Mensagem enviada (modo dev). Respondo em até 48h.",
    invalid: "Confira os campos destacados.",
    rateLimited: "Muitas tentativas. Tente novamente em alguns minutos.",
    sendError: "Não consegui enviar agora. Tente novamente em instantes.",
    emailSubject: "Novo contato de {name}",
    validation: {
      nameShort: "Nome muito curto",
      emailInvalid: "E-mail inválido",
      messageShort: "Conte um pouco mais (mín. 10 caracteres)",
    },
  },

  footer: {
    blurb:
      "Dev fullstack: Java no back, React e TypeScript no front. Aprendendo um pouco mais todo dia.",
    copyright:
      "© {year} Edu Ferreira — feito com Next.js, persistência e muito café 🙏.",
    viewSource: "ver código-fonte ↗",
  },

  commandMenu: {
    label: "Paleta de comandos",
    placeholder: "Buscar ou navegar…",
    empty: "Nenhum resultado.",
    groupNav: "Navegar",
    groupActions: "Ações",
    groupSecret: "Secreto",
    copyEmail: "Copiar e-mail",
    downloadCv: "Baixar CV",
    openGithub: "Abrir GitHub",
    switchTheme: "Mudar tema",
    switchLanguage: "Read in English",
    descend: "Descer ao submundo",
    descendToast: "Você desceu ao submundo.",
    /** cmdk matches against these, so keep the synonyms generous. */
    keywords: {
      nav: "navegar",
      copyEmail: "copiar email contato",
      downloadCv: "baixar cv curriculo",
      openGithub: "abrir github",
      switchTheme: "mudar tema claro escuro",
      switchLanguage: "idioma lingua ingles english",
      descend: "hades descer ao submundo underworld",
    },
  },

  notFound: {
    metaTitle: "Alma perdida",
    eyebrow: "~/404",
    title: "Alma perdida",
    description:
      "Essa alma se perdeu no submundo. A página que você procura não existe — ou foi engolida pelo Estige.",
    cta: "Voltar à superfície",
  },

  // The first visit's terminal boot (layout/boot-sequence.tsx). Each line
  // is "status · text"; the last one is the system coming up.
  boot: {
    title: "hades-os v2.6 · boot",
    lines: [
      "montando ~/projetos",
      "carregando stack: react · next.js · java · spring",
      "abrindo o histórico de entregas",
      "calibrando o horizonte de eventos",
      "7 anomalias não catalogadas",
    ],
    ready: "sistema pronto. bem-vindo.",
    skip: "qualquer tecla para pular",
  },

  // Hidden interactions to find (lib/anomalies.ts).
  anomalies: {
    found: "// anomalia {count}/{total} — {name}",
    names: {
      collapse: "colapso do sistema",
      orbit: "órbita manual",
      underworld: "o submundo",
      secret: "o nome secreto",
      terminal: "shell aberto",
      why: "cat why.txt",
      sudo: "privilégios de root",
    },
  },

  easterEggs: {
    consoleHint:
      "// procurando easter eggs? manda um oi: {email}  ·  ↑↑↓↓←→←→ B A",
    tabTitle: "👁 o submundo aguarda…",
    toUnderworld: "Você desceu ao submundo. (konami pra voltar)",
    toSurface: "De volta à superfície.",
    gate: {
      eyebrow: "// eco encontrado",
      ariaEnter: "Mantenha pressionado para entrar no submundo",
      ariaExit: "Mantenha pressionado para voltar à superfície",
      titleEnter: "Há algo sob a superfície",
      titleExit: "Retornar à superfície",
      hint: "mantenha pressionado",
      hintEnter: "O símbolo responde à pressão. Mantenha-o pressionado.",
      hintExit:
        "O caminho de volta exige que você mantenha o selo pressionado.",
      toastEnter: "O selo se rompeu. Bem-vindo ao submundo.",
      toastExit: "A superfície te aceita de volta.",
    },
  },

  projectPage: {
    /** Eyebrow burned into the generated Open Graph card. */
    ogEyebrow: "case study",
    back: "Voltar",
    repo: "Repositório",
    demo: "Demo ao vivo",
    decisionsEyebrow: "decisions.log",
    decisionsTitle: "Decisões que moldaram o projeto.",
    decisionsDescription:
      "O que eu escolhi, o que descartei junto e o preço que isso cobrou.",
    chose: "escolhi",
    instead: "em vez de",
    because: "porque",
    cost: "custou",
    /**
     * Rendered above the MDX body when non-empty. The long-form case studies
     * are authored in PT, so only the EN dictionary fills this in — an empty
     * string means "this locale reads the body natively, show nothing".
     */
    translationNotice: "",
  },
};

/**
 * Deliberately NOT `as const`: the shape is the contract, the literals are not.
 * `en.ts` satisfies this, so a missing key breaks the build while a different
 * translation of the same key does not.
 */
export type Dictionary = typeof pt;

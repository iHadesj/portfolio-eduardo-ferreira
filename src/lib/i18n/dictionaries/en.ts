import type { Dictionary, Rich } from "@/lib/i18n/dictionaries/pt";

/**
 * English translation. `satisfies Dictionary` is the parity gate: add a key to
 * `pt.ts` and this file stops compiling until it is translated.
 */
export const en = {
  meta: {
    title: "Edu Ferreira — Fullstack Developer, Java & React/TypeScript",
    description:
      "Fullstack dev: React and TypeScript on the front, Java on the back. Helped build the VTT Portal from scratch and keeps testing ideas in personal projects.",
    ogEyebrow: "portfolio",
  },

  common: {
    otherLocaleShort: "PT",
    switchLanguage: "Ver em português",
    emailCopied: "E-mail copied",
    downloadingCv: "Downloading CV…",
    themeToggle: "Toggle theme",
    themeToDark: "Switch to dark theme",
    themeToLight: "Switch to light theme",
  },

  nav: {
    main: "Main navigation",
    footer: "Footer",
    home: "Home — Edu Ferreira",
    commands: "Commands",
    openCommands: "Open command palette",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    menuLabel: "Navigation menu",
    skipToContent: "Skip to content",
  },

  hero: {
    prompt: "whoami",
    role: "Full stack dev. React, Next.js and TypeScript on the front, Java on the back.",
    location: "grajaú, south side of são paulo",
    stackLabel: "stack",
    deliveriesLabel: "shipped",
    deliveries: [
      {
        id: "vtt",
        name: "VTT",
        detail:
          "20 months building the VTT Portal from scratch: point-of-sale management and a game editor for event kiosks",
      },
      {
        id: "api-java",
        name: "Java API + PostgreSQL",
        detail:
          "JPA/Hibernate, MVC layering and business rules tested with JUnit",
      },
      {
        id: "levva",
        name: "Levva",
        detail:
          "offline-first PWA store: 400 products, a wallet in integer cents, 29 tests",
      },
      {
        id: "bernardo",
        name: "Um abraço, Bernardo",
        detail:
          "mobile-first shop with a 3D bear that reacts to touch, orders straight to WhatsApp",
      },
    ],
    ctaProjects: "see projects",
    ctaCv: "download cv",
    ctaCvAria: "Download résumé as PDF",
    availabilityOpen: "Open to opportunities",
    availabilityClosed: "Not available right now",
    availabilityAria: "Professional availability",
    hole: {
      tag: "interactive anomaly",
      detected: "event horizon detected.",
      how: "hold the singularity for 3 s to collapse the system.",
      orbitMouse: "drag to orbit",
      orbitTouch: "swipe to orbit",
      idle: "hold to collapse",
      holding: "event horizon",
      collapsing: "collapse",
      rebooting: "rebooting the system",
      cancelled: "collapse aborted",
      restored: "system restored",
      keyLabel:
        "Visual effect: hold Space or Enter for 3 seconds to collapse the top of the page. Let go early to cancel.",
      statusCollapsing: "Collapse in progress.",
      statusRestored: "System restored.",
      console: {
        absorbed: "singularity: {count} objects absorbed",
        stable: "event horizon: stable",
        restoring: "rebuilding ~/hero from the log",
      },
    },
  },

  about: {
    eyebrow: "about",
    whyLabel: "why.txt, the README of my GitHub profile",
    paragraphs: [
      [
        "I started on the back end — Java, Spring, databases — because I wanted to understand what happens ",
        { em: "behind the screen" },
        ". Modelling the data, separating the layers, writing a test and watching it catch the bug before I did: that's when it clicked.",
      ],
      [
        "Then I moved to the front with React and TypeScript, which is where I spent most of my internship at VTT, helping build a portal from scratch. Today I enjoy both sides. This site is my ",
        { em: "playground" },
        ": it's all on GitHub, what's finished and what I still want to improve.",
      ],
    ] as readonly Rich[],
    facts: [
      { key: "based in", value: "São Paulo, BR" },
      { key: "day to day", value: "Java · Spring · React · TS" },
      { key: "learning", value: "Angular · JUnit · Machine Learning" },
    ],
    statusLabel: "status",
    portraitAlt: "Portrait of Edu Ferreira",
    portraitPending: "photo coming soon",
  },

  projects: {
    eyebrow: "projects",
    title: "Things I've built.",
    description:
      "{decisions} decisions across {projects} projects, each with the alternative it beat and the price it charged.",
    moreOnGithub: "There's more on my GitHub ↗",
    indexLabel: "more",
    caseStudy: "Case study →",
    repoAria: "Repository for {title}",
    demoAria: "Live demo of {title}",
    coverAlt: "Screenshot of {title}",
    decision: {
      legend: "decision 1 of {total}",
      sides: { chose: "chose", dropped: "dropped", code: "code" },
      all: "see all {total} decisions →",
    },
    statuses: {
      shipped: "shipped",
      "in-progress": "in progress",
      archived: "archived",
    },
  },

  experience: {
    eyebrow: "xp",
    title: "How I got here.",
    description:
      "The way git would tell it: a course, a degree, an internship and projects running side by side, each on its own branch, each project a commit.",
    graph: {
      command: "git log --graph --oneline",
      head: "HEAD → {lane}",
      merge: "merge {lane}",
      branch: "branch {lane}",
      init: "init {lane}",
      commit: "feat: {title}",
      now: "now",
      lanes: {
        projetos: "projects",
        ebac: "ebac",
        vtt: "vtt",
        estacio: "estacio",
      },
    },
    items: [
      {
        id: "vtt",
        period: "Feb 2025 — Oct 2026",
        role: "Web Development Intern",
        org: "VTT",
        bullets: [
          "Helped build the VTT Portal from scratch: point-of-sale management, records, internal tools and a ticketing module",
          "The part I'm proudest of is the game editor for event kiosks (memory, quiz, wheel, lead form): people set everything up in the browser and download a .zip ready for the kiosk",
          "Mostly front end, but I also wrote Java servlets and endpoints to feed dashboards with real data",
          "My first time with deadlines, real users and code that isn't only mine. Nothing like studying on your own",
        ],
        stack: ["React", "TypeScript", "Three.js", "Java", "SVN"],
      },
      {
        id: "estacio",
        period: "Feb 2025 — Jul 2027 (expected)",
        role: "Systems Analysis and Development",
        org: "Estácio",
        bullets: [
          "Studied and interned at the same time for almost two years: what I saw in class usually showed up at work the week after",
          "It's where I pick up the foundation you can't get from tutorials alone: data structures, databases and architecture",
        ],
        stack: ["Data structures", "OOP", "SQL"],
      },
      {
        id: "projetos",
        period: "2024 — now",
        role: "Fullstack Developer",
        org: "personal projects",
        bullets: [
          'Where I test ideas without fear of breaking anything: StudyQuest, LIFE/MAINTENANCE, DevTrack, "Um abraço, Bernardo" and this site',
          "Offline-first has become almost a habit: IndexedDB, service workers and apps that open without internet",
          "Databases outside the slides, learned by trial and error with PostgreSQL and MySQL",
        ],
        stack: ["React", "TypeScript", "Next.js", "IndexedDB", "PostgreSQL"],
      },
      {
        id: "ebac",
        period: "Sep 2023 — Oct 2024",
        role: "Java Back-End course",
        org: "EBAC",
        bullets: [
          "This is where Java became my foundation: OOP, JPA/Hibernate and persistence with PostgreSQL",
          "A lot of MVC CRUD with JUnit, which turned into the Java API + PostgreSQL project above",
        ],
        stack: ["Java", "JPA/Hibernate", "PostgreSQL", "JUnit"],
      },
    ],
  },

  status: {
    eyebrow: "status",
    title: "What's up right now.",
    description:
      "Every 10 minutes the server knocks on each demo and writes down the HTTP status, the response time and each project's last commit.",
    checked: "last checked at {time}, Brasília time",
    rows: { state: "state", commit: "commit" },
    states: { up: "up", down: "down", none: "no public demo" },
    noAnswer: "no answer",
    noCommit: "no public commits",
    commitAgo: "commit {when}",
    lineLabel: "demo status right now:",
    contributionsSuffix: "contributions in the last year",
    contributionsAria: "{total} contributions in the last year",
  },

  contact: {
    eyebrow: "contact",
    title: "Want to get in touch?",
    description:
      "A role, freelance work, a question — reach out. Back end, front end or both.",
    preferEmail: "Prefer e-mail? Click to copy it:",
    replyTime: "I usually reply within a day or two.",
    form: {
      name: "Name",
      email: "E-mail",
      message: "Message",
      submit: "Send message",
      sending: "Sending…",
      honeypot: "Do not fill in this field",
      fallbackSuccess: "Message sent.",
    },
  },

  contactAction: {
    success: "Message sent. I'll reply within 48h.",
    successDev: "Message sent (dev mode). I'll reply within 48h.",
    invalid: "Check the highlighted fields.",
    rateLimited: "Too many attempts. Try again in a few minutes.",
    sendError: "I couldn't send it right now. Try again in a moment.",
    emailSubject: "New message from {name}",
    validation: {
      nameShort: "Name is too short",
      emailInvalid: "Invalid e-mail",
      messageShort: "Tell me a bit more (min. 10 characters)",
    },
  },

  footer: {
    blurb:
      "Fullstack dev: Java on the back, React and TypeScript on the front. Learning a bit more every day.",
    copyright:
      "© {year} Edu Ferreira — built with Next.js, stubbornness and a lot of coffee 🙏.",
    viewSource: "view source ↗",
  },

  commandMenu: {
    label: "Command palette",
    placeholder: "Search or navigate…",
    empty: "No results.",
    groupNav: "Navigate",
    groupActions: "Actions",
    groupSecret: "Secret",
    copyEmail: "Copy e-mail",
    downloadCv: "Download CV",
    openGithub: "Open GitHub",
    switchTheme: "Switch theme",
    switchLanguage: "Ler em português",
    descend: "Descend to the underworld",
    descendToast: "You have descended to the underworld.",
    keywords: {
      nav: "navigate go to",
      copyEmail: "copy email contact address",
      downloadCv: "download cv resume curriculum",
      openGithub: "open github profile",
      switchTheme: "switch change theme light dark",
      switchLanguage: "language portuguese portugues idioma",
      descend: "hades descend underworld secret",
    },
  },

  notFound: {
    metaTitle: "Lost soul",
    eyebrow: "~/404",
    title: "Lost soul",
    description:
      "This soul got lost in the underworld. The page you're looking for doesn't exist — or the Styx swallowed it.",
    cta: "Back to the surface",
  },

  boot: {
    title: "hades-os v2.6 · boot",
    lines: [
      "mounting ~/projects",
      "loading stack: react · next.js · java · spring",
      "opening the delivery log",
      "calibrating the event horizon",
      "7 uncatalogued anomalies",
    ],
    ready: "system ready. welcome.",
    skip: "any key to skip",
  },

  anomalies: {
    found: "// anomaly {count}/{total} — {name}",
    names: {
      collapse: "system collapse",
      orbit: "manual orbit",
      underworld: "the underworld",
      secret: "the secret name",
      terminal: "shell opened",
      why: "cat why.txt",
      sudo: "root privileges",
    },
  },

  easterEggs: {
    consoleHint: "// hunting for easter eggs? say hi: {email}  ·  ↑↑↓↓←→←→ B A",
    tabTitle: "👁 the underworld awaits…",
    toUnderworld: "You have descended to the underworld. (konami to return)",
    toSurface: "Back to the surface.",
    gate: {
      eyebrow: "// echo found",
      ariaEnter: "Press and hold to enter the underworld",
      ariaExit: "Press and hold to return to the surface",
      titleEnter: "There's something beneath the surface",
      titleExit: "Return to the surface",
      hint: "press and hold",
      hintEnter: "The symbol answers to pressure. Hold it down.",
      hintExit: "The way back demands that you hold the seal down.",
      toastEnter: "The seal is broken. Welcome to the underworld.",
      toastExit: "The surface takes you back.",
    },
  },

  projectPage: {
    ogEyebrow: "case study",
    back: "Back",
    repo: "Repository",
    demo: "Live demo",
    decisionsEyebrow: "decisions.log",
    decisionsTitle: "Decisions that shaped the project.",
    decisionsDescription:
      "What I picked, what I dropped along with it, and the price that came attached.",
    chose: "chose",
    instead: "instead of",
    because: "because",
    cost: "cost",
    snippetAria: "Code from {file}",
    translationNotice:
      "The decision log and summary above are in English. The long-form write-up below is still in Portuguese.",
  },
} satisfies Dictionary;

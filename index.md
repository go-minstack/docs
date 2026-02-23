---
layout: home

hero:
  name: "MinStack"
  text: "Minimal, composable Go modules."
  tagline: Build backend services by combining small, focused modules — no bloat, no magic.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Browse Modules
      link: /modules/core

features:
  - title: Dependency Injection by Uber FX
    details: MinStack is built on top of Uber FX — a production-grade DI framework used at Uber. Constructors are wired automatically. Lifecycle hooks (start/stop) are managed for you. If a dependency is missing, the app won't start.
  - title: Composable by design
    details: Each module does one thing. Combine only what you need — core, gin, cli, mysql, postgres, sqlite. No module forces another on you.
  - title: Minimal API surface
    details: No magic, no hidden config. Every module exposes a single Module() function. Your constructors go in Provide(), your startup logic goes in Invoke().
---

import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'MinStack',
  description: 'Minimal, composable Go modules for building backend services.',
  vite: {
    server: {
      allowedHosts: ['go-minstack.toquinha.online'],
    },
  },
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'Modules', link: '/modules/core' },
      { text: 'GitHub', link: 'https://github.com/go-minstack/docs' },
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Introduction', link: '/guide/introduction' },
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Domain Structure', link: '/guide/domain-structure' },
          { text: 'Testing', link: '/guide/testing' },
        ],
      },
      {
        text: 'Modules',
        items: [
          { text: 'core', link: '/modules/core' },
          { text: 'gin', link: '/modules/gin' },
          { text: 'cli', link: '/modules/cli' },
          { text: 'mysql', link: '/modules/mysql' },
          { text: 'postgres', link: '/modules/postgres' },
          { text: 'sqlite', link: '/modules/sqlite' },
          { text: 'repository', link: '/modules/repository' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/go-minstack' },
    ],
  },
})

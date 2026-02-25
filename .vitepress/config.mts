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
      { text: 'Tutorials', link: '/tutorials/task-api/' },
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
          { text: 'logger', link: '/modules/logger' },
          { text: 'auth', link: '/modules/auth' },
        ],
      },
      {
        text: 'Tutorials',
        items: [
          {
            text: 'Task API',
            collapsed: false,
            items: [
              { text: 'Overview', link: '/tutorials/task-api/' },
              { text: '1. Project Setup', link: '/tutorials/task-api/setup' },
              { text: '2. Users domain', link: '/tutorials/task-api/users' },
              { text: '3. Auth domain', link: '/tutorials/task-api/auth' },
              { text: '4. Tasks domain', link: '/tutorials/task-api/tasks' },
              { text: '5. Bootstrap', link: '/tutorials/task-api/bootstrap' },
            ],
          },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/go-minstack' },
    ],
  },
})

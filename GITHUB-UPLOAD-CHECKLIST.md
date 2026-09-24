# Manual GitHub upload checklist

Upload the contents of this project so these files are directly visible in the repository root:

```text
package.json
netlify.toml
vite.config.ts
tsconfig.json
tsconfig.node.json
client/index.html
client/src/App.tsx
client/src/index.css
client/src/main.tsx
client/src/pages/Home.tsx
netlify/functions/market-data.mjs
server/index.ts
shared/const.ts
```

The final repository must look like this:

```text
repository-root/
├── client/
├── netlify/
│   └── functions/
│       └── market-data.mjs
├── server/
├── shared/
├── package.json
├── netlify.toml
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
└── README.md
```

Do not upload `node_modules`, `dist`, `.manus`, or other local build/cache folders.

In Netlify use:

```text
Base directory: blank
Build command: npm run build
Publish directory: dist/public
```

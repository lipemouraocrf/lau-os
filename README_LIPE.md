# LauOS v77 - Base limpa

Versão de estabilização estrutural.

A navegação antiga acumulada foi removida dos principais blocos conflitantes, e agora o app usa um único roteador em `scripts/lauos-shell-v77.js`.

Arquivos principais novos:

- `styles/lauos-shell-v77.css`
- `scripts/lauos-shell-v77.js`

Arquivos removidos do pacote limpo:

- `.git`
- `.vercel`
- `node_modules`
- `.env*`
- módulos antigos de testes v63/v64/v65/v75/v76

Teste local:

```bash
node server-local.js
```

Abra:

```txt
http://localhost:3000
```

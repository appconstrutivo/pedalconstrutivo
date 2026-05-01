# Pedal Construtivo — Gestão

Sistema inicial para gestão da loja de bicicletas: cadastro de fornecedores e cotação de pedidos pelo menor preço.

## Funcionalidades

- **Fornecedores**: cadastrar, editar e excluir fornecedores (dados salvos no navegador).
- **Cotação**: adicionar itens e informar o preço em cada fornecedor; o sistema monta o pedido indicando o fornecedor mais barato por item e o total.

## Como rodar

```bash
npm install
npm run dev
```

Acesse o endereço exibido no terminal (geralmente `http://localhost:5173`).

## Build para produção

```bash
npm run build
npm run preview
```

Os arquivos de produção ficam na pasta `dist/`.

## Deploy (Vercel)

O projeto está publicado na Vercel. Ao realizar `git push` na branch de produção, um novo deploy é criado automaticamente.

## Tecnologias

- React 19 + TypeScript
- Vite 7
- Tailwind CSS 3
- Persistência em `localStorage` (sem backend por enquanto)

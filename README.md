# Tendel Production

Projeto preparado para deploy na Vercel com frontend estatico em HTML/CSS/JS, funcoes serverless em `api/` e persistencia no Supabase.

## Estrutura

- `public/`: frontend estatico servido pela Vercel
- `api/`: rotas backend para auth, admin, pedidos e bootstrap
- `supabase/migrations/`: schema SQL para provisionar o banco
- `scripts/`: checagens e utilitarios locais

## Variaveis de ambiente

Copie `.env.example` para `.env` em desenvolvimento local e configure os valores reais:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `WHATSAPP_NUMBER`
- `BUSINESS_TIMEZONE`

`SUPABASE_SERVICE_ROLE_KEY` deve existir apenas no backend. Nunca exponha no navegador.

## Banco de dados

Opcao recomendada:

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Execute `supabase/migrations/001_initial_schema.sql`.

Opcao alternativa:

- Configure as variaveis de ambiente e rode `npm run db:setup`.

As funcoes tambem conseguem criar a estrutura inicial automaticamente no primeiro acesso, mas para producao a migracao manual e mais previsivel.

## Desenvolvimento local

1. Instale dependencias com `npm install`.
2. Configure o arquivo `.env`.
3. Rode `vercel dev`.

## Deploy

1. Suba este repositorio para o GitHub.
2. Importe o repositorio na Vercel.
3. Escolha o preset `Other`.
4. Confirme a raiz do projeto como `/`.
5. Configure todas as variaveis de ambiente da `.env.example`.
6. Faça o deploy.
7. Teste `https://SEU-DOMINIO/api/health`.
8. Acesse `/admin.html` e entre com `ADMIN_USERNAME` e `ADMIN_PASSWORD`.

## Validacao

- `npm run check`: valida a estrutura minima esperada


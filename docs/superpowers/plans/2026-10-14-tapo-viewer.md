# Tapo Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar uma aplicação local para ver o vídeo ao vivo da Tapo C500 no navegador de um PC Windows.

**Architecture:** Um servidor HTTP local em TypeScript recebe a configuração e supervisiona o go2rtc. O go2rtc lê o RTSP da câmera e fornece o player do navegador por um proxy local limitado. A página apresenta configuração, vídeo, estados de conexão e reconexão.

**Tech Stack:** Node.js 20+, TypeScript, `tsx`, testes nativos do Node.js, HTML/CSS/JavaScript e go2rtc para Windows.

**Spec:** `docs/superpowers/specs/2026-10-14-tapo-viewer-design.md`

## Global Constraints

- Primeira versão: somente vídeo ao vivo da Tapo C500 por `stream1` na rede local; iCSee fica para depois.
- Servidor e portas de mídia escutam apenas em `127.0.0.1`.
- Credenciais ficam em memória, passam ao go2rtc por variáveis de ambiente e nunca entram em arquivos do projeto, URL da página, respostas ou logs.
- Não há assinatura, nuvem da aplicação, gravação, acesso remoto, áudio bidirecional, controle de movimento ou persistência de credenciais.
- Usar a branch `main`. Preparar commits coesos com `$commit-pr-writer` e `$conventional-commit`, sem trailer de coautoria de IA. Não abrir PR.

## Review Focus

- IP fora de uma rede privada ou malformado: rejeitar antes de iniciar o processo.
- Caracteres especiais em usuário/senha: codificar corretamente a origem RTSP e não revelar a senha.
- Duas tentativas rápidas de conexão: manter apenas um processo go2rtc e deixar o último pedido ativo.
- Processo go2rtc encerrado inesperadamente: refletir estado de erro e permitir reconexão.
- Fechamento do servidor: encerrar o processo filho e não deixar stream ativo.

---

## Mapa de arquivos

- `package.json`, `tsconfig.json`: scripts e configuração TypeScript.
- `src/config.ts`: validar IP e credenciais; compor valores seguros para a ponte.
- `src/bridge.ts`: iniciar, acompanhar e encerrar o go2rtc.
- `src/server.ts`: API local e arquivos estáticos.
- `config/go2rtc.yaml`: configuração não secreta com variáveis de ambiente.
- `public/index.html`, `public/app.js`, `public/styles.css`: formulário, player e estados.
- `scripts/setup-go2rtc.ps1`: instalar binário oficial no diretório local ignorado pelo Git.
- `test/config.test.ts`, `test/bridge.test.ts`, `test/server.test.ts`: comportamento e sigilo.
- `README.md`, `.gitignore`: configuração e uso no Windows.

### Task 1: Configuração segura da câmera

**Files:** `package.json`, `tsconfig.json`, `src/config.ts`, `config/go2rtc.yaml`, `test/config.test.ts`, `.gitignore`

**Interfaces:** `parseCameraConfig(input: unknown): CameraConfig` retorna `{ ip, username, password }` ou erro de validação; `bridgeEnvironment(config: CameraConfig): Record<string,string>` fornece valores codificados para `CAMERA_IP`, `CAMERA_USER` e `CAMERA_PASSWORD`.

- [ ] **Step 1: Escrever testes falhando** para IP IPv4 privado válido, IP público/malformado, campos vazios e credenciais com `@`, `:` e `#`; conferir que `bridgeEnvironment` codifica os caracteres reservados.
- [ ] **Step 2: Rodar** `npm test -- test/config.test.ts` e confirmar falha pela implementação ausente.
- [ ] **Step 3: Implementar** `parseCameraConfig` e `bridgeEnvironment`; configurar `go2rtc.yaml` com `api.listen=127.0.0.1:1984`, `webrtc.listen=127.0.0.1:8555`, RTSP server desligado e origem `tapo-c500` via variáveis de ambiente.
- [ ] **Step 4: Rodar** `npm test -- test/config.test.ts` e confirmar passagem.
- [ ] **Step 5: Usar `$commit-pr-writer` / `$conventional-commit`** para um commit coeso, após apresentar a mensagem para confirmação.

### Task 2: Ciclo de vida da ponte

**Files:** `src/bridge.ts`, `test/bridge.test.ts`

**Interfaces:** `BridgeManager.connect(config: CameraConfig): Promise<void>`, `disconnect(): Promise<void>`, `status(): BridgeStatus`; `BridgeStatus` contém `state: 'disconnected'|'connecting'|'live'|'error'` e mensagem pública opcional, sem credenciais.

- [ ] **Step 1: Escrever testes falhando** com processo filho simulado: início, dois pedidos rápidos com substituição de conexão, encerramento inesperado, fechamento e ausência de senha em status/erros.
- [ ] **Step 2: Rodar** `npm test -- test/bridge.test.ts` e confirmar falha.
- [ ] **Step 3: Implementar** a supervisão do processo go2rtc, injeção de variáveis, sonda local da API e limpeza no encerramento; garantir apenas um processo ativo.
- [ ] **Step 4: Rodar** `npm test -- test/bridge.test.ts` e confirmar passagem.
- [ ] **Step 5: Usar `$commit-pr-writer` / `$conventional-commit`** para o commit da ponte, após confirmação da mensagem.

### Task 3: Aplicação local e experiência de visualização

**Files:** `src/server.ts`, `public/index.html`, `public/app.js`, `public/styles.css`, `test/server.test.ts`

**Interfaces:** `createServer(manager: BridgeManager): Server` expõe `POST /api/connect`, `POST /api/disconnect`, `GET /api/status`, os arquivos de `public/` e as rotas necessárias ao player em `/player/`; as respostas JSON nunca incluem credenciais. A página só mostra “Ao vivo” quando o vídeo começa a reproduzir.

- [ ] **Step 1: Escrever testes falhando** para validação HTTP, rotas de estado, rejeição de método e ausência de senha em respostas.
- [ ] **Step 2: Rodar** `npm test -- test/server.test.ts` e confirmar falha.
- [ ] **Step 3: Implementar** servidor e interface com estados desconectado/conectando/ao vivo/erro, formulário, player, reconexão e mensagens legíveis sem senha.
- [ ] **Step 4: Rodar** `npm test -- test/server.test.ts` e confirmar passagem; abrir a interface e verificar o fluxo com fonte RTSP de teste.
- [ ] **Step 5: Usar `$commit-pr-writer` / `$conventional-commit`** para o commit da experiência de visualização, após confirmação da mensagem.

### Task 4: Instalação, documentação e publicação

**Files:** `scripts/setup-go2rtc.ps1`, `README.md`, `.gitignore`

**Interfaces:** `npm run setup:go2rtc` instala a versão Windows do go2rtc a partir do release oficial em `vendor/` ignorado pelo Git; `npm start` inicia o servidor local.

- [ ] **Step 1: Criar um teste de execução** que verifica instalação do binário, inicialização em loopback e fechamento limpo, sem usar a câmera real.
- [ ] **Step 2: Rodar o teste e confirmar falha** antes de criar o script de instalação.
- [ ] **Step 3: Implementar o script e o README** com Conta da Câmera, obtenção do IP, instalação, inicialização e diagnóstico.
- [ ] **Step 4: Rodar todos os testes**, iniciar a aplicação e verificar o smoke test local. Registrar que a transmissão com a Tapo C500 real depende de teste na rede do usuário.
- [ ] **Step 5: Usar `$commit-pr-writer` / `$conventional-commit`** para o commit de instalação e documentação, após confirmação da mensagem.
- [ ] **Step 6: Criar repositório público `tapo-viewer` no GitHub, definir `main` e publicar o código autorizado pelo usuário.** Verificar o conteúdo remoto e confirmar ausência de credenciais ou binários locais.

## Handoff

Executar na própria sessão, na branch `main`, após revisão deste plano. Não há tarefas independentes que justifiquem subagentes: a interface usa a ponte e a API definidas nas tarefas anteriores.

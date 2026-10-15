# Tapo Viewer

Visualizador local da transmissão ao vivo da **Tapo C500** em um navegador no Windows. O PC e a câmera precisam estar na mesma rede de casa. A aplicação não exige assinatura, não grava vídeos e não expõe a transmissão na internet.

## Antes de começar

1. Instale o [Node.js 20 ou mais recente](https://nodejs.org/) no PC.
2. No app Tapo, abra a câmera → **Configurações** → **Configurações avançadas** → **Conta da Câmera** e crie um usuário e senha próprios. Eles são diferentes da conta principal Tapo.
3. Veja o IP em **Configurações** → **Informações do dispositivo**. Anote apenas o IP; não compartilhe senha ou número de série.

A [TP-Link documenta esse procedimento](https://www.tp-link.com/br/support/faq/2680/). O visualizador usa o fluxo RTSP `stream1` da C500.

## Instalar e abrir

No PowerShell, dentro desta pasta:

```powershell
npm install
npm run setup:go2rtc
npm start
```

Abra **http://127.0.0.1:4173** no navegador, informe o IP e a Conta da Câmera, e clique em **Iniciar transmissão**. Deixe o terminal aberto enquanto assiste. Para encerrar, pressione `Ctrl+C`.

O comando de setup baixa o [go2rtc para Windows](https://github.com/AlexxIT/go2rtc/releases/tag/v1.9.14), verifica o SHA-256 do arquivo e instala o executável em `vendor/`. Essa pasta é ignorada pelo Git. As credenciais ficam apenas na memória durante a sessão e precisam ser informadas novamente depois de reiniciar a aplicação.

## Se a imagem não aparecer

- Confirme que PC e câmera estão na mesma rede e que o IP continua igual no app Tapo.
- Confirme o usuário e a senha em **Conta da Câmera**; o login principal da Tapo não serve para RTSP.
- Aguarde alguns segundos e use **Tentar novamente**. Se o IP da câmera mudou, informe o novo IP.
- Se o setup falhar, execute novamente `npm run setup:go2rtc` e confira se `vendor/go2rtc.exe` existe.
- Não abra portas do roteador para tentar resolver uma falha local.

## Desenvolvimento

```powershell
npm test
npm run typecheck
```

O projeto usa um servidor HTTP em TypeScript e o player do go2rtc em loopback (`127.0.0.1`). O navegador só indica **Ao vivo** quando o player começa a reproduzir vídeo e recebe progresso. O código está organizado para permitir outra fonte de vídeo RTSP depois que o modelo da câmera usada com iCSee for identificado. A transmissão com uma câmera real ainda precisa ser validada na rede onde ela está instalada.

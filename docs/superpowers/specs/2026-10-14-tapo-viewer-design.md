# Visualizador local da Tapo C500 — desenho da primeira versão

## Objetivo

Permitir que Lucas veja, em tempo real e sem assinatura, a Tapo C500 em um navegador no PC Windows conectado à mesma rede local da câmera. A primeira versão cobre um único fluxo de vídeo ao vivo. A câmera usada pelo iCSee entra em uma etapa futura, após identificação do modelo e do protocolo disponível.

## Critérios de sucesso

- O usuário informa o IP e as credenciais da **Conta da Câmera** criada no app Tapo e inicia a transmissão.
- O vídeo aparece em uma página local, com estado visível de conexão, erro e reconexão.
- Ao perder a conexão, a página informa a falha e permite tentar novamente sem reiniciar a aplicação.
- O acesso à aplicação e ao serviço de vídeo fica restrito ao próprio PC.
- O projeto pode receber outras fontes de vídeo RTSP no futuro sem reescrever a interface de visualização.

## Escopo desta versão

- Visualização ao vivo da Tapo C500, inicialmente pelo fluxo RTSP de alta qualidade (`stream1`).
- Formulário local para IP, usuário e senha da Conta da Câmera.
- Reprodução em navegador, estado da conexão, mensagens de erro úteis e reconexão manual.
- Instruções de instalação, execução e configuração da Conta da Câmera.

Gravação, reprodução de arquivos antigos, áudio bidirecional, controle de movimento, acesso remoto, descoberta automática de câmeras, persistência de credenciais e integração com iCSee ficam fora desta primeira versão. A interface e a configuração poderão crescer para duas câmeras sem alterar o fluxo principal.

## Abordagem escolhida

Uma aplicação web local em TypeScript serve uma interface simples e coordena uma instância local do **go2rtc**. A Tapo fornece o vídeo via RTSP; o go2rtc o entrega em um formato reproduzível no navegador. O serviço inicia e supervisiona o go2rtc, valida a configuração informada e expõe apenas o estado e as ações necessárias à interface. A página usa a identidade lógica `tapo-c500`, sem montar URLs RTSP com senha no navegador.

O serviço web e as portas de mídia devem escutar apenas em `127.0.0.1`. As credenciais permanecem em memória durante a sessão e são passadas à ponte por variáveis de ambiente do processo filho, usando a substituição de variáveis da configuração do go2rtc. O serviço codifica caracteres especiais das credenciais antes de compor a origem RTSP. Senhas não entram em URL de página, logs ou arquivos do projeto. Não há conta externa nem serviço em nuvem da aplicação.

## Componentes e fluxo

1. **Interface web:** recebe IP e credenciais, apresenta o vídeo e os estados `desconectado`, `conectando`, `ao vivo` e `erro`.
2. **Serviço local:** valida IP e campos, inicia ou reinicia o processo de mídia, reporta o estado sem expor a senha e limpa recursos ao encerrar.
3. **Ponte de mídia:** consome `rtsp://<IP>:554/stream1` com as credenciais da Conta da Câmera e disponibiliza o fluxo ao navegador em endereço local.

O serviço envia a configuração à ponte de mídia localmente. A interface solicita a reprodução pelo nome lógico da câmera e não recebe as credenciais depois do envio inicial. O serviço limita tentativas de conexão e não varre a rede.

## Falhas e recuperação

- IP inválido ou campos ausentes: validação antes de tentar conectar.
- Senha incorreta, câmera offline ou porta indisponível: erro legível, sem exibir credenciais; botão para tentar novamente ou editar os dados.
- Perda do sinal durante a reprodução: indicar interrupção e oferecer reconexão.
- go2rtc indisponível ou encerrado: o serviço informa falha da ponte e permite reiniciá-la.
- Falha de reprodução no navegador: informar o problema e permitir nova tentativa. A primeira versão não inclui transcodificação automática.

## Validação

- Testes locais do serviço para validação de entrada, ciclo de vida da ponte e ausência de senha nas respostas e logs.
- Teste da interface com uma fonte RTSP de teste para confirmar reprodução e estados de erro.
- Teste manual na rede do usuário com a Tapo C500, incluindo conexão, senha inválida, câmera temporariamente offline e reconexão. A aplicação não pode ser declarada validada com a câmera real antes desse teste.

## Implantação local

O projeto terá instruções para instalar as dependências gratuitas, iniciar o serviço no Windows e abrir o endereço local no navegador. Nesta fase, a execução pode usar o ambiente de desenvolvimento instalado no PC; empacotar um instalador fica para depois da validação da transmissão real.

## Referências técnicas

- [TP-Link: visualizar câmeras Tapo por RTSP/ONVIF](https://www.tp-link.com/br/support/faq/2680/) — Conta da Câmera, rede local e fluxo `stream1`.
- [go2rtc: documentação e versão Windows](https://github.com/AlexxIT/go2rtc/blob/master/README.md) — ponte RTSP e reprodução no navegador.
- [go2rtc: variáveis de ambiente na configuração](https://github.com/AlexxIT/go2rtc/wiki/Configuration) — passagem de credenciais sem gravá-las no projeto.

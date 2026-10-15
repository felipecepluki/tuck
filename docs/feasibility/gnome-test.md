# Validação manual — GNOME/Wayland

Este roteiro valida o **modo limitado sem extensão** do Tuck: captura ao abrir/focar,
não um histórico contínuo enquanto oculto. Windows fica para outro dia. Resultados
não se estendem automaticamente a outra versão do GNOME, X11 ou outro compositor.
A [matriz do Gate 0](../gate0-feasibility.md) permanece aberta até registrar evidência.

## Preparação

Execute na raiz do projeto, em terminais da sessão gráfica. Use somente as fixtures
abaixo; não envie bancos, histórico pessoal ou conteúdo da área de transferência.
O helper GTK não lê o clipboard automaticamente, não salva conteúdo e não usa rede.
Os botões da fonte substituem o clipboard por textos sintéticos quando clicados.
O Tuck pode salvar essas fixtures no histórico normal; exclua-as individualmente
após o teste. Não limpe todo o histórico para preparar a validação.

```sh
python3 scripts/gate0-diagnostics.py --output /tmp/tuck-gnome-environment.json
```

O Python do sistema precisa ter PyGObject/GTK 3, como o probe existente. Se o helper
informar dependência ausente, registre o erro; não é uma dependência do produto.
Feche Tuck com **Sair**, inclusive uma instância iniciada antes pelo dev server.
Inicie explicitamente o backend do app nesta rodada:

```sh
GDK_BACKEND=wayland bun run tauri dev
```

Em outros dois terminais:

```sh
GDK_BACKEND=wayland python3 scripts/gnome-clipboard-fixture.py --role source
```

```sh
GDK_BACKEND=wayland python3 scripts/gnome-clipboard-fixture.py --role destination
```

O helper exibe o tipo real do display GDK na janela e no terminal (normalmente
`GdkWaylandDisplay`). Ele confirma seu próprio backend, não o de um Tuck iniciado
anteriormente. Não permita que o plugin de instância única encaminhe a rodada para
um app antigo com outro backend. Falha de inicialização é um resultado, não um passe.

## Testes — faça primeiro a rodada nativa

1. **Captura e cópia de volta:** ative registro; clique “Copiar A” na fonte, abra
   Tuck, encontre A, clique no texto e cole com Ctrl+V no destino. Confirme Unicode,
   quebra de linha e espaços; o popup deve aparecer só depois da cópia bem-sucedida.
   Repita copiando A com Enter na lista. A original está no helper, sem truncamento.
2. **Tray:** copie A pelo menu de recentes/favoritos e cole no destino. Confirme
   conteúdo e notificação, ou popup no app se houver fallback. Registre se o modo
   Não Perturbe estiver ativo; ausência de banner nesse caso não prova falha de cópia.
3. **Pausa:** pause registro; copie PAUSA na fonte e volte ao app. Ela não deve
   entrar automaticamente na lista. Retome, copie B, volte ao app: B deve aparecer.
   Não use “Capturar clipboard atual” neste teste; captura manual é uma ação distinta.
4. **Oculto:** feche a janela para o tray, sem Sair. Na fonte copie A, B e C,
   sem voltar ao Tuck entre elas. Ao abrir, o esperado é o texto atual C; não exige
   registrar a sequência. Se A/B já existiam, não use sua presença para provar
   captura oculta. Confira recência e anote o comportamento observado.
5. **Deduplicação e persistência:** favorite A, atribua uma categoria e copie A
   novamente. Deve continuar um item com favorito/categoria. Exclua B; pause para
   impedir sua recaptura; use Sair e reabra. A e seus metadados devem persistir,
   B continuar excluído e pausa ser lembrada. Retome ao terminar.
6. **Fechamento da fonte:** com registro pausado e o Tuck ainda vivo, copie C na
   fonte e feche a fonte antes de capturar. Retome/abra o app e registre se C ainda
   pode ser lido. Depois copie um item já salvo pelo Tuck e cole no destino: isso
   deve usar o payload persistido, independentemente da fonte encerrada. Reabra a
   fonte para os outros testes. Disponibilidade da oferta após fechamento depende
   da sessão/gestores; registre perda separadamente de perda do histórico salvo.
7. **Ownership ao sair:** copie A pelo Tuck, use Sair e cole no destino, que ficou
   aberto. Registre se o clipboard sobrevive ao encerramento. Reabra Tuck e confira
   A no SQLite. Falha após Sair não é perda de SQLite, mas limita a promessa de
   copiar/sair/colar e precisa ser documentada ou corrigida antes de anunciá-la.
8. **Ativação:** esconda Tuck no tray; execute `sh scripts/tuck-show.sh` na raiz.
   Deve reabrir a mesma instância. Registre separadamente “janela visível”, “foco
   recebido” e “segunda janela/processo persistente”. Wayland pode negar foco.
   O script exige o binário debug já compilado; não instala atalho global.

## Rodada XWayland e cruzada

Use Sair nas janelas do Tuck e feche os helpers. Repita os comandos acima com
`GDK_BACKEND=x11`; o helper deve mostrar `GdkX11Display`. Repita os testes e registre
uma coluna separada. É **XWayland na sessão Wayland**, não uma sessão X11 real.

Depois confira interoperabilidade em dois sentidos: fonte nativa Wayland → Tuck
XWayland → destino nativo Wayland, e fonte XWayland → Tuck nativo Wayland → destino
XWayland. Inicie cada processo com seu backend explícito e sempre encerre o Tuck
anterior antes de trocar seu backend. Não pressuponha que o resultado de um sentido
prova o outro. Falta de acesso ao display/backend permanece não testado ou falhou.

## Confirmação recebida — 2026-10-14

O autor confirmou a inicialização dos três processos com `GDK_BACKEND=wayland`
e a cópia direta entre os helpers. Em seguida confirmou também o fluxo
**fonte → histórico do Tuck → cópia no Tuck → destino**, e a cópia **pelo tray**.
Esses dois caminhos de cópia/colagem estão aprovados por relato manual nesta rodada.
O autor confirmou em seguida mais três testes: pausa impediu o registro e retomada
permitiu nova captura; A permaneceu favorito após Sair/reabrir; copiar pelo Tuck,
usar Sair e colar no destino funcionou. Enter, popup/notificação, preservação
detalhada de Unicode/espaços e fechamento da fonte continuam não confirmados. O tipo GDK exibido pelos processos
também não foi informado. Não há alegação de passe completo do roteiro nem de uma
nova execução automatizada.

## Registro dos resultados

Copie esta tabela para seu relato; não marque passos ainda não executados. Use
**passou / falhou / não testado / limitação observada**, com erro redigido sem payload
pessoal. Fonte de resultados: confirmação manual do autor, sem automatização nativa
alegada. Registre data, versão/build do app e OS/GNOME/WebKit do relatório.

| Teste | Rodada com GDK_BACKEND=wayland | XWayland | Observação |
| --- | --- | --- | --- |
| Inicialização do Tuck e dos dois helpers | Passou (relato do autor) | Não testado | Backend solicitado; tipo GDK não informado |
| Cópia/colagem básica entre janelas | Passou (relato do autor) | Não testado | Diretamente entre helpers; fluxo pelo Tuck confirmado em seguida |
| A: captura → cópia no Tuck → destino | Passou (relato do autor) | Não testado | Enter e fidelidade detalhada ainda não confirmados |
| Enter / popup no app | Não testado | Não testado | |
| Tray: copiar → colar no destino | Passou (relato do autor) | Não testado | |
| Tray: notificação/popup | Não testado | Não testado | |
| Pausa/retomada | Passou (relato do autor) | Não testado | Teste automático ao voltar; sem captura manual |
| Oculto: C atual, sem promessa de A/B | Não testado | Não testado | |
| Favorito preservado após Sair/reabrir | Passou (relato do autor) | Não testado | Item A e favorito persistiram |
| Dedup/categoria/exclusão/pausa após restart | Não testado | Não testado | |
| Fonte encerrada / payload salvo | Não testado | Não testado | |
| Colar após Sair | Passou (relato do autor) | Não testado | Conteúdo copiado pelo Tuck permaneceu disponível no destino |
| --show: visibilidade/foco/instância | Não testado | Não testado | |
| Fluxo cruzado nos dois sentidos | Não testado | Não testado | |

Podemos fechar **a validação do modo GNOME nesta versão/session** quando esses
resultados estiverem registrados, falhas essenciais resolvidas e limitações
explicadas. Isso não fecha todo o Gate 0 nem certifica Tailwind, outra versão do
webview, Windows/macOS, captura oculta ou um atalho global ainda não implementado.

O probe `scripts/probe-webkit-css.py` já verificou recursos CSS no WebKit atual.
A nova UI Tailwind precisa de validação própria com CSS compilado nesse webview;
o menor OS/webview suportado continuará pendente até ser escolhido e testado.

# 10   Fluxo Variavél IF Else

**URL:** https://youtu.be/yjz15WGxHXA  
**Canal:** Unitec Soluções Tecnológicas  
**Data:** 2025-08-13  
**Objetivo:** Benchmark de plataformas SaaS de atendimento para aprimorar o módulo Atendimento (Nexvy/FIC)  
**Total de frames:** 62

---

## `00:00` — Tela de Conexões da plataforma, mostrando uma conexão ativa.

![Tela de Conexões da plataforma, mostrando uma conexão ativa.](frame_000_00-00.jpg)

## `00:32` — Mostra o menu lateral com a opção "FlowBuilder" selecionada.

![Mostra o menu lateral com a opção "FlowBuilder" selecionada.](frame_001_00-32.jpg)

## `00:35` — Tela de Fluxos de Conversa, mostra uma lista de fluxos existentes e a opção de "Adicionar Fluxo".

![Tela de Fluxos de Conversa, mostra uma lista de fluxos existentes e a opção de "Adicionar Fluxo".](frame_002_00-35.jpg)

## `00:36` — Pop-up "Adicionar Fluxo" onde ele insere o nome "Treinamento Automação".

![Pop-up "Adicionar Fluxo" onde ele insere o nome "Treinamento Automação".](frame_003_00-36.jpg)

## `00:43` — Tela de desenho de fluxo, com o bloco "Início do Fluxo" presente.

![Tela de desenho de fluxo, com o bloco "Início do Fluxo" presente.](frame_004_00-43.jpg)

## `00:50` — Clica no botão de adicionar bloco, seleciona "Conteúdo".

![Clica no botão de adicionar bloco, seleciona "Conteúdo".](frame_005_00-50.jpg)

## `00:52` — Pop-up para adicionar conteúdo, onde ele escreve a mensagem "Olá, seja muito bem-vindo! Para continuarmos, como gostaria de ser chamado?".

![Pop-up para adicionar conteúdo, onde ele escreve a mensagem "Olá, seja muito bem-vindo! Para continuarmos, como gostaria de ser chamado?".](frame_006_00-52.jpg)

## `01:14` — O bloco "Conteúdo" é adicionado ao fluxo, conectado ao "Início do Fluxo".

![O bloco "Conteúdo" é adicionado ao fluxo, conectado ao "Início do Fluxo".](frame_007_01-14.jpg)

## `01:17` — Clica no botão de adicionar bloco, seleciona "Coletar Variável".

![Clica no botão de adicionar bloco, seleciona "Coletar Variável".](frame_008_01-17.jpg)

## `01:20` — Pop-up para configurar a variável do fluxo, onde ele insere "nome" como nome da variável.

![Pop-up para configurar a variável do fluxo, onde ele insere "nome" como nome da variável.](frame_009_01-20.jpg)

## `01:25` — O bloco "Coletar Variável" é adicionado ao fluxo, conectado ao bloco "Conteúdo".

![O bloco "Coletar Variável" é adicionado ao fluxo, conectado ao bloco "Conteúdo".](frame_010_01-25.jpg)

## `01:43` — Clica no botão de adicionar bloco, seleciona "Condição".

![Clica no botão de adicionar bloco, seleciona "Condição".](frame_011_01-43.jpg)

## `01:46` — Pop-up para adicionar condição ao fluxo, seleciona "Hora do dia" e a regra "Antes de" 12:00.

![Pop-up para adicionar condição ao fluxo, seleciona "Hora do dia" e a regra "Antes de" 12:00.](frame_012_01-46.jpg)

## `01:58` — O bloco "Condição" é adicionado ao fluxo, conectado ao bloco "Coletar Variável".

![O bloco "Condição" é adicionado ao fluxo, conectado ao bloco "Coletar Variável".](frame_013_01-58.jpg)

## `02:00` — Edita o bloco "Condição" e muda a regra para "Antes de".

![Edita o bloco "Condição" e muda a regra para "Antes de".](frame_014_02-00.jpg)

## `02:10` — Clica no botão de adicionar bloco, seleciona "Menu".

![Clica no botão de adicionar bloco, seleciona "Menu".](frame_015_02-10.jpg)

## `02:12` — Pop-up para adicionar menu ao fluxo, onde ele escreve a mensagem "Vamos confirmar seu nome? {{nome}} está correto?".

![Pop-up para adicionar menu ao fluxo, onde ele escreve a mensagem "Vamos confirmar seu nome? {{nome}} está correto?".](frame_016_02-12.jpg)

## `02:55` — Adiciona as opções "1. Sim" e "2. Não" ao menu.

![Adiciona as opções "1. Sim" e "2. Não" ao menu.](frame_017_02-55.jpg)

## `03:00` — O bloco "Menu" é adicionado ao fluxo, conectado ao caminho verdadeiro da condição (antes das 12:00).

![O bloco "Menu" é adicionado ao fluxo, conectado ao caminho verdadeiro da condição (antes das 12:00).](frame_018_03-00.jpg)

## `03:20` — Conecta a opção "Não" do menu ao bloco "Coletar Variável" (criando um loop).

![Conecta a opção "Não" do menu ao bloco "Coletar Variável" (criando um loop).](frame_019_03-20.jpg)

## `03:39` — Clica no botão de adicionar bloco, seleciona "Enviar Notificação".

![Clica no botão de adicionar bloco, seleciona "Enviar Notificação".](frame_020_03-39.jpg)

## `03:41` — Pop-up para enviar notificação, onde ele insere o número de telefone e a mensagem "Lead para você Rodrigo!".

![Pop-up para enviar notificação, onde ele insere o número de telefone e a mensagem "Lead para você Rodrigo!".](frame_021_03-41.jpg)

## `03:52` — O bloco "Enviar Notificação" é adicionado ao fluxo, conectado à opção "Sim" do menu.

![O bloco "Enviar Notificação" é adicionado ao fluxo, conectado à opção "Sim" do menu.](frame_022_03-52.jpg)

## `04:00` — Clica no botão de adicionar bloco, seleciona "Randomizador".

![Clica no botão de adicionar bloco, seleciona "Randomizador".](frame_023_04-00.jpg)

## `04:03` — Pop-up para adicionar randomizador ao fluxo, com duas saídas de 50%.

![Pop-up para adicionar randomizador ao fluxo, com duas saídas de 50%.](frame_024_04-03.jpg)

## `04:07` — O bloco "Randomizador" é adicionado ao fluxo, entre o "Menu" e o "Enviar Notificação".

![O bloco "Randomizador" é adicionado ao fluxo, entre o "Menu" e o "Enviar Notificação".](frame_025_04-07.jpg)

## `04:13` — Clica no botão de adicionar bloco, seleciona "Transferir Usuário".

![Clica no botão de adicionar bloco, seleciona "Transferir Usuário".](frame_026_04-13.jpg)

## `04:16` — Pop-up para adicionar um usuário para transferir, seleciona o usuário "Admin" e a fila "Comercial".

![Pop-up para adicionar um usuário para transferir, seleciona o usuário "Admin" e a fila "Comercial".](frame_027_04-16.jpg)

## `04:26` — O bloco "Transferir Usuário" é adicionado ao fluxo, conectado à saída de 50% do randomizador que leva à notificação para Rodrigo.

![O bloco "Transferir Usuário" é adicionado ao fluxo, conectado à saída de 50% do randomizador que leva à notificação para Rodrigo.](frame_028_04-26.jpg)

## `04:33` — Adiciona um novo bloco "Transferir Usuário" para a outra saída do randomizador.

![Adiciona um novo bloco "Transferir Usuário" para a outra saída do randomizador.](frame_029_04-33.jpg)

## `04:35` — Pop-up para adicionar um usuário para transferir, seleciona o usuário "mayara" e a fila "Comercial".

![Pop-up para adicionar um usuário para transferir, seleciona o usuário "mayara" e a fila "Comercial".](frame_030_04-35.jpg)

## `04:47` — O segundo bloco "Transferir Usuário" é adicionado ao fluxo, conectado à outra saída de 50% do randomizador.

![O segundo bloco "Transferir Usuário" é adicionado ao fluxo, conectado à outra saída de 50% do randomizador.](frame_031_04-47.jpg)

## `04:52` — Ele decide adicionar uma notificação também para a Maia.

![Ele decide adicionar uma notificação também para a Maia.](frame_032_04-52.jpg)

## `04:58` — Adiciona um novo bloco "Enviar Notificação".

![Adiciona um novo bloco "Enviar Notificação".](frame_033_04-58.jpg)

## `05:00` — Pop-up para enviar notificação, onde ele insere o mesmo número de telefone e a mensagem "Lead para você Maiara!".

![Pop-up para enviar notificação, onde ele insere o mesmo número de telefone e a mensagem "Lead para você Maiara!".](frame_034_05-00.jpg)

## `05:06` — O segundo bloco "Enviar Notificação" é adicionado ao fluxo, conectado à outra saída de 50% do randomizador, antes do bloco "Transferir Usuário" para Maia.

![O segundo bloco "Enviar Notificação" é adicionado ao fluxo, conectado à outra saída de 50% do randomizador, antes do bloco "Transferir Usuário" para Maia.](frame_035_05-06.jpg)

## `05:15` — Clica em "Salvar" e o fluxo é salvo com sucesso.

![Clica em "Salvar" e o fluxo é salvo com sucesso.](frame_036_05-15.jpg)

## `05:16` — Edita o bloco "Condição" e muda a regra para "Depois de" 18:00.

![Edita o bloco "Condição" e muda a regra para "Depois de" 18:00.](frame_037_05-16.jpg)

## `05:30` — O fluxo é atualizado.

![O fluxo é atualizado.](frame_038_05-30.jpg)

## `05:39` — Volta para a tela de Conexões e seleciona a conexão para testes.

![Volta para a tela de Conexões e seleciona a conexão para testes.](frame_039_05-39.jpg)

## `05:41` — Edita a conexão do WhatsApp.

![Edita a conexão do WhatsApp.](frame_040_05-41.jpg)

## `05:43` — Na aba "Integrações", ele seleciona o fluxo "Treinamento Automação" e salva.

![Na aba "Integrações", ele seleciona o fluxo "Treinamento Automação" e salva.](frame_041_05-43.jpg)

## `05:49` — Vai para a aba de atendimento do WhatsApp Business Web.

![Vai para a aba de atendimento do WhatsApp Business Web.](frame_042_05-49.jpg)

## `05:51` — Abre uma conversa com o contato "Admin".

![Abre uma conversa com o contato "Admin".](frame_043_05-51.jpg)

## `05:53` — Envia a mensagem "Oi".

![Envia a mensagem "Oi".](frame_044_05-53.jpg)

## `05:56` — O bot responde "Olá, seja muito bem-vindo! Para continuarmos, como gostaria de ser chamado?".

![O bot responde "Olá, seja muito bem-vindo! Para continuarmos, como gostaria de ser chamado?".](frame_045_05-56.jpg)

## `06:05` — Ele responde "Rodrigo".

![Ele responde "Rodrigo".](frame_046_06-05.jpg)

## `06:07` — O bot responde "Vamos confirmar seu nome? Rodrigo. Está correto? 1 - Sim, 2 - Não".

![O bot responde "Vamos confirmar seu nome? Rodrigo. Está correto? 1 - Sim, 2 - Não".](frame_047_06-07.jpg)

## `06:17` — Ele responde "1" (Sim).

![Ele responde "1" (Sim).](frame_048_06-17.jpg)

## `06:20` — O bot envia uma notificação "Lead para você Rodrigo" e transfere o atendimento para o usuário Admin.

![O bot envia uma notificação "Lead para você Rodrigo" e transfere o atendimento para o usuário Admin.](frame_049_06-20.jpg)

## `06:20` — Volta para a tela de Fluxos de Conversa e edita o fluxo "Treinamento Automação".

![Volta para a tela de Fluxos de Conversa e edita o fluxo "Treinamento Automação".](frame_050_06-20.jpg)

## `06:26` — Revisa o fluxo criado na tela.

![Revisa o fluxo criado na tela.](frame_051_06-26.jpg)

## `06:32` — Mostra as mensagens trocadas no WhatsApp, confirmando o fluxo.

![Mostra as mensagens trocadas no WhatsApp, confirmando o fluxo.](frame_052_06-32.jpg)

## `06:42` — Volta para o FlowBuilder para explicar o fluxo.

![Volta para o FlowBuilder para explicar o fluxo.](frame_053_06-42.jpg)

## `07:09` — Ele explica a lógica do fluxo, incluindo a coleta de variável, a condição de hora do dia, o menu de confirmação e o randomizador para enviar notificações e transferir para diferentes usuários.

![Ele explica a lógica do fluxo, incluindo a coleta de variável, a condição de hora do dia, o menu de confirmação e o randomizador para enviar notificações e transferir para diferentes usuários.](frame_054_07-09.jpg)

## `08:21` — Ele demonstra como as condições podem ser configuradas para variáveis, hora do dia ou tags.

![Ele demonstra como as condições podem ser configuradas para variáveis, hora do dia ou tags.](frame_055_08-21.jpg)

## `08:50` — Exemplifica a condição de variável, comparando o nome "João" com a variável "{nome}".

![Exemplifica a condição de variável, comparando o nome "João" com a variável "{nome}".](frame_056_08-50.jpg)

## `09:12` — Ele ressalta que são três opções de condição que podem ser utilizadas.

![Ele ressalta que são três opções de condição que podem ser utilizadas.](frame_057_09-12.jpg)

## `09:35` — Demonstra o caminho do fluxo se o cliente escolher "Não" no menu, que o leva de volta para a etapa de conteúdo.

![Demonstra o caminho do fluxo se o cliente escolher "Não" no menu, que o leva de volta para a etapa de conteúdo.](frame_058_09-35.jpg)

## `09:40` — Demonstra o caminho do fluxo se a regra de hora for falsa, adicionando uma tag "Prospecção" e transferindo para a fila "Comercial".

![Demonstra o caminho do fluxo se a regra de hora for falsa, adicionando uma tag "Prospecção" e transferindo para a fila "Comercial".](frame_059_09-40.jpg)

## `10:14` — Faz um resumo geral do fluxo de automação criado, mostrando todas as etapas e condições.

![Faz um resumo geral do fluxo de automação criado, mostrando todas as etapas e condições.](frame_060_10-14.jpg)

## `11:19` — Encerra o vídeo, convidando os usuários a entrar em contato em caso de dúvidas.

![Encerra o vídeo, convidando os usuários a entrar em contato em caso de dúvidas.](frame_061_11-19.jpg)

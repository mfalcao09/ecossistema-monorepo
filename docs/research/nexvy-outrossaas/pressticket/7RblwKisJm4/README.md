# 14   2 Via de Boleto e Notificação de Faturas

**URL:** https://youtu.be/7RblwKisJm4  
**Canal:** Unitec Soluções Tecnológicas  
**Data:** 2025-08-13  
**Objetivo:** Benchmark de plataformas SaaS de atendimento para aprimorar o módulo Atendimento (Nexvy/FIC)  
**Total de frames:** 81

---

## `00:00` — Rodrigo inicia o tutorial sobre a integração da plataforma de multiatendimento com gateways de pagamento

![Rodrigo inicia o tutorial sobre a integração da plataforma de multiatendimento com gateways de pagamento](frame_000_00-00.jpg)

## `00:07` — Rodrigo fala sobre a emissão da segunda via de boleto e o envio de lembretes de vencimento

![Rodrigo fala sobre a emissão da segunda via de boleto e o envio de lembretes de vencimento](frame_001_00-07.jpg)

## `00:15` — Integração com Asaas será utilizada como exemplo no tutorial

![Integração com Asaas será utilizada como exemplo no tutorial](frame_002_00-15.jpg)

## `00:20` — Com a integração, é possível emitir a segunda via de boleto e enviar lembretes de vencimento

![Com a integração, é possível emitir a segunda via de boleto e enviar lembretes de vencimento](frame_003_00-20.jpg)

## `00:30` — Cliente pode acessar o fluxo, escolher a opção “segunda via de boleto” e a plataforma emitirá o boleto automaticamente após o CPF/CNPJ

![Cliente pode acessar o fluxo, escolher a opção “segunda via de boleto” e a plataforma emitirá o boleto automaticamente após o CPF/CNPJ](frame_004_00-30.jpg)

## `00:46` — Em relação aos lembretes, o tutorial mostrará como configurá-los e como inserir a chave API do Asaas

![Em relação aos lembretes, o tutorial mostrará como configurá-los e como inserir a chave API do Asaas](frame_005_00-46.jpg)

## `01:01` — Primeiro passo: acessar a conta Asaas pelo computador

![Primeiro passo: acessar a conta Asaas pelo computador](frame_006_01-01.jpg)

## `01:05` — A tela do Asaas é exibida

![A tela do Asaas é exibida](frame_007_01-05.jpg)

## `01:12` — No Asaas, o usuário deve clicar em “Integrações”

![No Asaas, o usuário deve clicar em “Integrações”](frame_008_01-12.jpg)

## `01:17` — Em integrações, o usuário deve ir em “Chaves de API”

![Em integrações, o usuário deve ir em “Chaves de API”](frame_009_01-17.jpg)

## `01:21` — O usuário deve clicar em “Gerar nova chave” e preencher o nome da chave, data e hora de expiração (opcional)

![O usuário deve clicar em “Gerar nova chave” e preencher o nome da chave, data e hora de expiração (opcional)](frame_010_01-21.jpg)

## `01:29` — Clicar em “Avançar”

![Clicar em “Avançar”](frame_011_01-29.jpg)

## `01:32` — A tela de Validação Token App é exibida

![A tela de Validação Token App é exibida](frame_012_01-32.jpg)

## `01:38` — O usuário deve usar o aplicativo Asaas no smartphone para obter o token e inseri-lo no campo “Informe o código”

![O usuário deve usar o aplicativo Asaas no smartphone para obter o token e inseri-lo no campo “Informe o código”](frame_013_01-38.jpg)

## `01:50` — A chave API foi salva com sucesso

![A chave API foi salva com sucesso](frame_014_01-50.jpg)

## `01:52` — Copiar a chave API

![Copiar a chave API](frame_015_01-52.jpg)

## `02:05` — Retorno à plataforma de multiatendimento

![Retorno à plataforma de multiatendimento](frame_016_02-05.jpg)

## `02:08` — Primeiro passo na plataforma: configurar a segunda via de boleto

![Primeiro passo na plataforma: configurar a segunda via de boleto](frame_017_02-08.jpg)

## `02:14` — O usuário deve ir em “Configurações”

![O usuário deve ir em “Configurações”](frame_018_02-14.jpg)

## `02:17` — Em configurações, o usuário deve ir em “Integração – 2ª Via de Boletos”

![Em configurações, o usuário deve ir em “Integração – 2ª Via de Boletos”](frame_019_02-17.jpg)

## `02:20` — Selecionar o Asaas e ativar a integração

![Selecionar o Asaas e ativar a integração](frame_020_02-20.jpg)

## `02:22` — Colar o token Asaas e clicar em “Salvar”

![Colar o token Asaas e clicar em “Salvar”](frame_021_02-22.jpg)

## `02:27` — A integração foi atualizada com sucesso

![A integração foi atualizada com sucesso](frame_022_02-27.jpg)

## `02:29` — Agora, o usuário deve criar um departamento (fila) específico

![Agora, o usuário deve criar um departamento (fila) específico](frame_023_02-29.jpg)

## `02:35` — O usuário deve ir em “Filas e Chatbot” e em “Filas e Seções”

![O usuário deve ir em “Filas e Chatbot” e em “Filas e Seções”](frame_024_02-35.jpg)

## `02:38` — O nome da fila deve ser “2ª Via de Boletos”

![O nome da fila deve ser “2ª Via de Boletos”](frame_025_02-38.jpg)

## `02:44` — A tela de “Editar fila” é exibida

![A tela de “Editar fila” é exibida](frame_026_02-44.jpg)

## `02:47` — O usuário deve definir o “Nome” da fila como “2ª Via de Boletos”

![O usuário deve definir o “Nome” da fila como “2ª Via de Boletos”](frame_027_02-47.jpg)

## `02:50` — O usuário deve inserir uma mensagem de saudação para o cliente

![O usuário deve inserir uma mensagem de saudação para o cliente](frame_028_02-50.jpg)

## `03:00` — A mensagem de saudação solicita o CPF ou CNPJ para enviar a fatura

![A mensagem de saudação solicita o CPF ou CNPJ para enviar a fatura](frame_029_03-00.jpg)

## `03:09` — Quando o cliente digitar o CPF/CNPJ, a integração buscará os dados da fatura e os enviará

![Quando o cliente digitar o CPF/CNPJ, a integração buscará os dados da fatura e os enviará](frame_030_03-09.jpg)

## `03:12` — A mensagem foi salva com sucesso

![A mensagem foi salva com sucesso](frame_031_03-12.jpg)

## `03:26` — Para quem já fez a videoaula de fluxo:

![Para quem já fez a videoaula de fluxo:](frame_032_03-26.jpg)

## `03:31` — O usuário deve criar a opção “2ª Via de Boletos” no menu de fluxo e transferir para a fila “2ª Via de Boletos”

![O usuário deve criar a opção “2ª Via de Boletos” no menu de fluxo e transferir para a fila “2ª Via de Boletos”](frame_033_03-31.jpg)

## `03:49` — O usuário deve ir em “Flowbuilder”

![O usuário deve ir em “Flowbuilder”](frame_034_03-49.jpg)

## `03:52` — A tela de “Adicionar Fluxo” é exibida

![A tela de “Adicionar Fluxo” é exibida](frame_035_03-52.jpg)

## `03:55` — O usuário deve inserir um nome para o fluxo e clicar em “Adicionar”

![O usuário deve inserir um nome para o fluxo e clicar em “Adicionar”](frame_036_03-55.jpg)

## `04:00` — O fluxo de conversa é exibido

![O fluxo de conversa é exibido](frame_037_04-00.jpg)

## `04:02` — O usuário deve clicar no sinal de mais para adicionar um menu

![O usuário deve clicar no sinal de mais para adicionar um menu](frame_038_04-02.jpg)

## `04:06` — A tela de “Adicionar menu ao fluxo” é exibida

![A tela de “Adicionar menu ao fluxo” é exibida](frame_039_04-06.jpg)

## `04:09` — O usuário deve inserir uma mensagem de boas-vindas

![O usuário deve inserir uma mensagem de boas-vindas](frame_040_04-09.jpg)

## `04:19` — Adicionar a opção “Comercial”

![Adicionar a opção “Comercial”](frame_041_04-19.jpg)

## `04:26` — Adicionar a opção “2ª Via de Boleto/PIX”

![Adicionar a opção “2ª Via de Boleto/PIX”](frame_042_04-26.jpg)

## `04:31` — O menu foi criado

![O menu foi criado](frame_043_04-31.jpg)

## `04:38` — O usuário deve adicionar uma fila ao fluxo

![O usuário deve adicionar uma fila ao fluxo](frame_044_04-38.jpg)

## `04:41` — Selecionar a fila “2ª Via de Boleto”

![Selecionar a fila “2ª Via de Boleto”](frame_045_04-41.jpg)

## `04:53` — A fila “2ª Via de Boleto” foi vinculada

![A fila “2ª Via de Boleto” foi vinculada](frame_046_04-53.jpg)

## `04:58` — O usuário deve vincular a opção “Comercial” à fila “Comercial”

![O usuário deve vincular a opção “Comercial” à fila “Comercial”](frame_047_04-58.jpg)

## `05:01` — O fluxo é exibido com o menu de opções

![O fluxo é exibido com o menu de opções](frame_048_05-01.jpg)

## `05:05` — Quando o cliente escolher a opção “2ª Via de Boleto/PIX”, a integração Asaas será acionada e pedirá o CPF/CNPJ

![Quando o cliente escolher a opção “2ª Via de Boleto/PIX”, a integração Asaas será acionada e pedirá o CPF/CNPJ](frame_049_05-05.jpg)

## `05:10` — Após o CPF/CNPJ, o sistema verificará se há faturas vencidas e enviará a mais próxima ao vencimento ou o boleto

![Após o CPF/CNPJ, o sistema verificará se há faturas vencidas e enviará a mais próxima ao vencimento ou o boleto](frame_050_05-10.jpg)

## `05:25` — O fluxo foi salvo com sucesso

![O fluxo foi salvo com sucesso](frame_051_05-25.jpg)

## `05:37` — Agora, o tutorial mostrará como utilizar o Asaas para lembretes de faturas

![Agora, o tutorial mostrará como utilizar o Asaas para lembretes de faturas](frame_052_05-37.jpg)

## `05:43` — Já foi configurada a emissão, agora será configurado o envio

![Já foi configurada a emissão, agora será configurado o envio](frame_053_05-43.jpg)

## `05:49` — O Asaas cobra R$1,00 pela liquidação da fatura para notificar o cliente via e-mail/SMS e R$0,50 para notificar via WhatsApp

![O Asaas cobra R$1,00 pela liquidação da fatura para notificar o cliente via e-mail/SMS e R$0,50 para notificar via WhatsApp](frame_054_05-49.jpg)

## `06:06` — Utilizando a plataforma, o usuário economiza esses custos e tem o serviço gratuito

![Utilizando a plataforma, o usuário economiza esses custos e tem o serviço gratuito](frame_055_06-06.jpg)

## `06:17` — A tela de “Adicionar integração” é exibida

![A tela de “Adicionar integração” é exibida](frame_056_06-17.jpg)

## `06:21` — O usuário deve selecionar a conexão

![O usuário deve selecionar a conexão](frame_057_06-21.jpg)

## `06:26` — Definir o horário de atendimento para o envio das mensagens

![Definir o horário de atendimento para o envio das mensagens](frame_058_06-26.jpg)

## `06:33` — É importante definir o WhatsApp que já interage com a base de clientes

![É importante definir o WhatsApp que já interage com a base de clientes](frame_059_06-33.jpg)

## `06:47` — Utilizar o próprio número para evitar bloqueios

![Utilizar o próprio número para evitar bloqueios](frame_060_06-47.jpg)

## `06:59` — Inserir o token de integração do Asaas

![Inserir o token de integração do Asaas](frame_061_06-59.jpg)

## `07:05` — Em “Enviar no dia do vencimento?”, o usuário deve selecionar “Sim”

![Em “Enviar no dia do vencimento?”, o usuário deve selecionar “Sim”](frame_062_07-05.jpg)

## `07:15` — Em “Quantos dias antes do vencimento enviar a mensagem?”, o usuário pode definir a quantidade de dias para lembrar o cliente

![Em “Quantos dias antes do vencimento enviar a mensagem?”, o usuário pode definir a quantidade de dias para lembrar o cliente](frame_063_07-15.jpg)

## `07:20` — Definir 3 dias antes do vencimento

![Definir 3 dias antes do vencimento](frame_064_07-20.jpg)

## `07:29` — Em “Após o vencimento enviar a mensagem a cada quantos dias?”, o usuário pode definir a recorrência de cobrança

![Em “Após o vencimento enviar a mensagem a cada quantos dias?”, o usuário pode definir a recorrência de cobrança](frame_065_07-29.jpg)

## `07:46` — Definir 1 dia para cobrar todos os dias

![Definir 1 dia para cobrar todos os dias](frame_066_07-46.jpg)

## `07:54` — Definir 2 dias para cobrar a cada 2 dias

![Definir 2 dias para cobrar a cada 2 dias](frame_067_07-54.jpg)

## `08:00` — Em “Após o vencimento Máximo de dias para enviar?”, o usuário pode definir o período máximo de inadimplência

![Em “Após o vencimento Máximo de dias para enviar?”, o usuário pode definir o período máximo de inadimplência](frame_068_08-00.jpg)

## `08:05` — Definir 60 dias como padrão

![Definir 60 dias como padrão](frame_069_08-05.jpg)

## `08:18` — Em “Mensagem antes do vencimento”, o usuário deve colocar um template com as variáveis

![Em “Mensagem antes do vencimento”, o usuário deve colocar um template com as variáveis](frame_070_08-18.jpg)

## `08:29` — Exemplo de template com variáveis: %Name% (nome), %InvoiceNumber% (número da fatura), %DueDate% (data de vencimento), %Value% (valor total)

![Exemplo de template com variáveis: %Name% (nome), %InvoiceNumber% (número da fatura), %DueDate% (data de vencimento), %Value% (valor total)](frame_071_08-29.jpg)

## `08:59` — A notificação incluirá o link, a data de vencimento, as variáveis e o boleto PDF/PIX automaticamente

![A notificação incluirá o link, a data de vencimento, as variáveis e o boleto PDF/PIX automaticamente](frame_072_08-59.jpg)

## `09:12` — Inserir a mensagem para o dia do vencimento

![Inserir a mensagem para o dia do vencimento](frame_073_09-12.jpg)

## `09:17` — Inserir a mensagem após o vencimento

![Inserir a mensagem após o vencimento](frame_074_09-17.jpg)

## `09:24` — Os templates estarão disponíveis na descrição da videoaula

![Os templates estarão disponíveis na descrição da videoaula](frame_075_09-24.jpg)

## `09:27` — Clicar em “Salvar”

![Clicar em “Salvar”](frame_076_09-27.jpg)

## `09:30` — A integração foi salva com sucesso

![A integração foi salva com sucesso](frame_077_09-30.jpg)

## `09:34` — Com a automatização, o processo financeiro é agilizado, eliminando a necessidade de um profissional enviar mensagens manualmente

![Com a automatização, o processo financeiro é agilizado, eliminando a necessidade de um profissional enviar mensagens manualmente](frame_078_09-34.jpg)

## `09:54` — Essa funcionalidade se estende aos demais gateways de pagamento, como SGA, Harmonit, IXC, SGP, SiproV e MK.AUTH

![Essa funcionalidade se estende aos demais gateways de pagamento, como SGA, Harmonit, IXC, SGP, SiproV e MK.AUTH](frame_079_09-54.jpg)

## `10:11` — Encerramento do tutorial. Rodrigo agradece e convida a entrar em contato com o suporte em caso de dúvidas.

![Encerramento do tutorial. Rodrigo agradece e convida a entrar em contato com o suporte em caso de dúvidas.](frame_080_10-11.jpg)

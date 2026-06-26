# Documento de Requisitos (Completo) - Sistema de Gestão da RX no GTA RP

## 1. Visão Geral do Projeto
Um sistema web fullstack robusto (React + Node.js) desenvolvido para gerenciar todos os aspectos da facção RX de GTA RP. O sistema integra-se ao Discord para automatizar logs, avisos e gestão de cargos, oferecendo controle total sobre membros, baú, finanças e ações táticas.

## 2. Perfis de Usuário (Níveis de Acesso)
* **Gerência (Líderes/Frentes):** Acesso total ao sistema. Podem gerenciar cargos, advertências, aprovar recrutamentos, editar ações e acessar a aba exclusiva da gerência.
* **Membro Elite:** Acesso às funcionalidades padrão + permissão para criar e gerenciar a aba de escalação de ações.
* **Membro Padrão:** Pode visualizar o próprio painel, registrar presença em ações, registrar suas metas.

## 3. Requisitos Funcionais (O que o sistema faz)

### 3.1. Gestão de Membros e Atividade
* **RF01:** O sistema deve permitir o cadastro de novos membros.
* **RF02:** A gerência deve conseguir atribuir e remover cargos dos membros pelo sistema.
* **RF03:** Controle de Atividade: O sistema deve permitir o envio de fotos/prints do painel do jogo para comprovação de atividade.
* **RF04:** Controle de Metas: Acompanhamento individual das metas semanais/mensais dos membros.
* **RF05:** Sistema de Advertências: A gerência pode aplicar advertências que, automaticamente, alteram o cargo do membro no servidor do Discord.

### 3.2. Recrutamento e Relações Externas
* **RF06:** Aba de Recrutamento contendo um formulário para avaliação de novos candidatos.
* **RF07:** Aba de Parcerias para registro e controle de facções/grupos aliados e acordos comerciais.

### 3.3. Comunicação e Integração (Discord)
* **RF08:** Aba de Avisos: A gerência pode redigir comunicados no sistema que são disparados automaticamente via Webhook para um canal específico no Discord.
* **RF09:** Aba exclusiva da Gerência: Espaço restrito para anotações, decisões e pautas da liderança.

### 3.4. Gestão Financeira e Baú (Estoque)
* **RF10:** Controle de Baú: Registro de depósitos e compras de itens da facção. Toda movimentação deve gerar um log automático via Webhook no Discord.
* **RF11:** Pendências/Empréstimos: Área dentro do baú para registrar equipamentos emprestados aos players (quem pegou, o que pegou e data de devolução).
* **RF12:** Aba de Vendas: Formulário para gerentes registrarem vendas de materiais/armas/drogas. O registro deve ser enviado via Webhook para o Discord.

### 3.5. Gestão de Ações (Elite)
* **RF13:** Escalação de Ações: Formulário para planejamento de ações (Tiro ou Fuga). Membros podem colocar o nome para participar; a gerência pode aprovar, adicionar ou remover membros da lista.
* **RF14:** Fechamento e Rateio: Ao finalizar uma ação, informa-se o valor total recebido. O sistema deve calcular e exibir automaticamente quanto deve ser pago para cada membro participante, dividindo os lucros.

## 4. Requisitos Não Funcionais (Como o sistema faz)
* **RNF01:** Frontend em React (Vite) e Backend em Node.js (Express).
* **RNF02:** Banco de dados relacional (PostgreSQL).
* **RNF03:** Integração ativa com a API do Discord (Webhooks para mensagens passivas e Bot/Token para alteração de cargos).
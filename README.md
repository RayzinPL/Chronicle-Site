# Chronicle

Aplicação web para gerenciamento de RPG de mesa, feita por fãs de RPG para fãs de RPG.

## Sobre o projeto

O Chronicle nasceu da vontade de resolver um problema que todo mundo que joga conhece: fichas de papel que se perdem, anotações soltas e planilhas que ninguém consegue acompanhar. O sistema centraliza tudo em um só lugar, permitindo que jogadores criem e mantenham suas fichas de personagem, enquanto os mestres organizam campanhas e sessões, em mesas presenciais ou virtuais.

O foco é o RPG de mesa, e o nível de complexidade do sistema é intermediário, atendendo tanto a grupos veteranos, que buscam mais organização e praticidade durante as sessões, quanto a iniciantes, que estão começando a explorar o hobby e precisam de apoio para entender regras e acompanhar suas campanhas. Como referência, utilizamos livros de regras de diferentes sistemas e fontes variadas, para tornar o projeto flexível e rico em informações.

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Interface | HTML, CSS e JavaScript |
| Lógica e regras do sistema | Python |
| Banco de dados | SQL |

## Usuários e funcionalidades

| Usuário | O que faz |
| --- | --- |
| Jogador | Informa nome e e-mail para se identificar, visualiza as campanhas em que está jogando, visualiza e edita suas fichas e cria e edita suas anotações pessoais de player. |
| Mestre | Cadastra campanhas (nome, descrição, sistema de RPG e status), cadastra os jogadores da campanha, cadastra data e horário das sessões, cria, edita e visualiza fichas e cria e edita suas anotações de mestre. |

Um mesmo usuário pode atuar como jogador em uma campanha e como mestre em outra.

## Escopo do banco de dados

| O banco faz | O banco não faz |
| --- | --- |
| Armazena os usuários (jogadores e mestres) com login e senha criptografada (hash). | Executa a lógica do jogo: cálculo de modificadores, validação de regras e rolagens ficam a cargo do Python. |
| Armazena as campanhas (nome, descrição, sistema de RPG e status) e o vínculo entre campanha, mestre e jogadores participantes. | Gera a interface: a exibição de fichas e telas é feita por HTML, CSS e JavaScript. |
| Registra as sessões (data e resumo). | Substitui o mestre: não cria campanhas, histórias ou decisões de forma automática. |
| Garante a integridade dos dados com chaves primárias e estrangeiras, restrições de valores e backup com possibilidade de restauração. | Atua como sistema de pagamentos ou loja, sem transações financeiras. |

## Minimundo

O sistema permite que o usuário se cadastre informando nome e e-mail, com senha armazenada de forma criptografada, e atue como jogador, como mestre ou como ambos. O mestre cadastra campanhas, define o sistema de RPG utilizado e o status (ativa, pausada ou encerrada), vincula os jogadores participantes e registra as sessões com data, horário e resumo. As fichas de personagem pertencem a uma campanha e seguem o sistema de RPG escolhido por ela. Mestres e jogadores também mantêm suas próprias anotações.

## Requisitos

### Funcionais

| Código | Requisito |
| --- | --- |
| RF01 | Cadastrar campanha: nome, descrição, sistema de RPG e status. |
| RF02 | Cadastrar jogadores na campanha. |
| RF03 | Cadastrar sessão: data, horário e resumo. |
| RF04 | O mestre cria, edita e visualiza fichas de personagem. |
| RF05 | O jogador visualiza e edita as suas fichas. |
| RF06 | O jogador visualiza as campanhas em que está jogando. |
| RF07 | O mestre cria e edita as suas anotações. |
| RF08 | O jogador cria e edita as suas anotações pessoais. |

### Regras de negócio

| Código | Regra |
| --- | --- |
| RN01 | O sistema solicita nome e e-mail do usuário, e a senha é armazenada com hash. |
| RN02 | Um mesmo usuário pode ser jogador em uma campanha e mestre em outra. |
| RN03 | Toda campanha tem um mestre responsável, e os jogadores só visualizam as campanhas às quais estão vinculados. |
| RN04 | O status da campanha deve ser ativa, pausada ou encerrada. |
| RN05 | Toda ficha pertence a uma campanha e segue o sistema de RPG escolhido por ela. |
| RN06 | Toda sessão pertence a uma campanha e registra data e horário. |
| RN07 | As anotações do mestre e as do jogador são visíveis apenas para quem as criou. |
| RN08 | O banco garante os relacionamentos com chaves primárias e estrangeiras e valida campos obrigatórios e valores permitidos. |

### Não funcionais

| Código | Requisito |
| --- | --- |
| RNF01 | Interface em HTML, CSS e JavaScript, lógica em Python e dados em banco SQL. |
| RNF02 | Cálculos, validações de regras e rolagens ficam no Python, e a exibição das telas no HTML, CSS e JavaScript. |
| RNF03 | As senhas não são armazenadas em texto puro. |
| RNF04 | O banco permite backup com possibilidade de restauração. |

## Como executar

> Em breve. Esta seção será preenchida conforme o projeto avançar.

## Status do projeto

Em desenvolvimento.

## Autores

-  Daniel Gonçalves Araújo, GitHub:https://github.com/RayzinPL
-  João Pedro C Souza, GitHub: https://github.com/jpcs120308-cpu 

## Licença

A definir.

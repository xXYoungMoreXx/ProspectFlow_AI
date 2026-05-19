---
slug: cnpj-lookup
name: CNPJ Lookup
description: Busca os dados iniciais de uma empresa pelo CNPJ.
---

# CNPJ Lookup

Esta skill busca dados básicos de uma empresa usando seu CNPJ via a Brasil API.

## Quando utilizar
Utilize esta skill sempre que o usuário fornecer um CNPJ e for necessário verificar a existência da empresa, buscar sua Razão Social, Nome Fantasia ou Endereço básico.

## Como utilizar
O input para esta tool é estritamente o número do CNPJ. Pode conter formatação (`12.345.678/0001-90`) ou ser apenas números (`12345678000190`).
A tool limpa automaticamente a formatação antes de fazer a busca.

## Exemplo de Resposta
A resposta será um JSON em formato string contendo os dados básicos da empresa, ou uma mensagem de erro caso o CNPJ seja inválido ou não encontrado.

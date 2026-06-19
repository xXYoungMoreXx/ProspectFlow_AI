---
title: "A arquitetura da Forja — como os Autômatos funcionam"
char_count: 1198
cta: "Veja o código: https://github.com/xXYoungMoreXx/ProspectFlow_AI"
---

Muita gente pergunta: "mas como funciona por dentro?"

Vou explicar sem enrolação.

O Hefesto tem três camadas que trabalham juntas:

→ A Fornalha
É o motor de processamento. Recebe as configurações que você define — nicho, região, tipo de serviço — e alimenta os Autômatos com contexto e objetivos.

→ Os Autômatos
São os agentes de IA. Cada um tem uma função especializada:

• O Hunter prospecta: busca empresas reais no Google Maps, coleta dados públicos, valida se o CNPJ está ativo.
• O Closer aborda: envia mensagem personalizada via WhatsApp ou e-mail, negocia, apresenta proposta.
• O Builder entrega: gera o site, a campanha, o conteúdo — o serviço que foi vendido.
• O QA valida: confere qualidade antes da entrega chegar ao cliente.

→ A Bigorna
É o painel de controle. Você vê tudo que está acontecendo, aprova ou ajusta o que quiser, e acompanha os resultados.

Nenhuma etapa exige que você esteja presente. Todas permitem que você intervenha se quiser.

Isso não é "automatize sua rotina". Isso é construir um negócio que opera enquanto você não está.

O código é aberto. A arquitetura é pública.

→ github.com/xXYoungMoreXx/ProspectFlow_AI

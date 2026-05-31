# SPEC-08: Delivery Agent — Entrega do Site

> Versão: 2.0.0 | Fase: 2 | Dependências: SPEC-07 (QA), SPEC-11 (Messaging)

---

## Responsabilidade

Gerenciar a entrega final do site ao cliente após aprovação do QA.
Gerar tutorial em vídeo personalizado, documentação de entrega,
notificar o cliente por todos os canais e garantir o follow-up pós-entrega.

---

## Sub-agentes (TUTORIAL + DOC em paralelo; NOTIFIER depende dos dois)

| Sub-agente | Modelo | Modo | Grupo |
|---|---|---|---|
| TUTORIAL_GENERATOR | `claude-haiku-4-5-20251001` | parallel | 1 |
| DOC_GENERATOR | `claude-haiku-4-5-20251001` | parallel | 1 |
| NOTIFIER | `claude-haiku-4-5-20251001` | sequential | — |

---

## Fluxo

```
Trigger: DomainEvent[QAApproved]
│
├─ PARALELO (~2 min):
│   ├─ TUTORIAL_GENERATOR: roteiro + geração via HeyGen API
│   └─ DOC_GENERATOR: PDF de entrega com credenciais
│
├─ NOTIFIER (após ambos concluírem):
│   ├─ WhatsApp: mensagem celebratória + links
│   ├─ E-mail: PDF como anexo + tutorial embutido
│   └─ Telegram (se canal ativo): mesma mensagem do WhatsApp
│
├─ Atualizar CRM:
│   ├─ project.status → DELIVERED
│   ├─ project.deliveredAt → now()
│   ├─ project.deliveryTutorialUrl → URL HeyGen
│   └─ project.deliveryDocUrl → URL PDF
│
├─ Emitir SiteDeliveredToClient
├─ Emitir ProjectDelivered
│
└─ Agendar follow-ups (BullMQ):
    ├─ +7 dias: satisfação pós-entrega
    └─ +30 dias: pesquisa NPS (1–10)
```

---

## TUTORIAL_GENERATOR — HeyGen API

```python
# apps/agent-runtime/src/agents/delivery/sub_agents/tutorial_generator.py

TUTORIAL_SCRIPT_PROMPT = """
Crie um roteiro de vídeo tutorial de 2-3 minutos para o cliente {client_name}.
O tutorial deve ensinar como:
1. Acessar o painel de administração do site
2. Atualizar informações básicas (texto, telefone, horário)
3. Ver as visitas e contatos recebidos
4. Pedir alterações no futuro

Tom: amigável, simples, sem jargão técnico.
O avatar vai falar o script — escreva como fala natural, não como texto formal.
Inclua pausas naturais indicadas por [pausa].
"""

class TutorialGeneratorSubAgent(BaseSubAgent):
    llm_model = 'claude-haiku-4-5-20251001'

    async def execute(self, input: dict) -> dict:
        project = input['project']
        client = input['client']

        # 1. Gerar roteiro com Claude Haiku
        script = await self.generate_script(client, project)

        # 2. Enviar para HeyGen
        video_url = await self.heygen_api.generate_video({
            'avatar_id': env.HEYGEN_AVATAR_ID,
            'voice_language': 'pt-BR',
            'script': script,
            'output_format': 'mp4',
            'resolution': '1280x720',
            'duration_max_seconds': 180,
        })

        return {
            'tutorialUrl': video_url,
            'scriptUsed': script,
            'durationSeconds': await self.heygen_api.get_duration(video_url),
        }

    async def generate_script(self, client: dict, project: dict) -> str:
        site_url = project.get('deliverableUrl', '')
        admin_url = f"{site_url}/admin" if site_url else ''

        return await self.llm.complete(
            model=self.llm_model,
            prompt=f"""
{TUTORIAL_SCRIPT_PROMPT.format(client_name=client['contactName'])}

INFORMAÇÕES DO PROJETO:
- Site: {site_url}
- Painel admin: {admin_url}
- Plataforma: {project.get('deployPlatform', 'Vercel')}
- Tipo de site: {project.get('siteType', 'institucional')}
"""
        )
```

---

## DOC_GENERATOR — PDF de Entrega

```python
# apps/agent-runtime/src/agents/delivery/sub_agents/doc_generator.py

PDF_TEMPLATE = """
# 🎉 Seu site está no ar!

**{business_name}**
Entregue em: {delivery_date}

---

## Acesso ao Site

🌐 **URL do site:** {site_url}
🔧 **Painel administrativo:** {admin_url}

**Credenciais temporárias:**
- Login: {admin_email}
- Senha: {temp_password}

⚠️ *Altere a senha no primeiro acesso.*

---

## Como usar seu site

📹 **Tutorial em vídeo (3 min):** {tutorial_url}

---

## Próximos Passos

1. ✅ Acesse o painel e altere a senha
2. ✅ Compartilhe o link nas suas redes sociais
3. ✅ Adicione o site ao seu Google Meu Negócio
4. ✅ Peça para seus clientes visitarem e avaliarem
5. ✅ Assista ao tutorial para aprender a fazer atualizações

---

## Suporte

💬 WhatsApp: {operator_whatsapp}
📧 Email: {operator_email}

Estamos disponíveis para ajudar com qualquer dúvida!

---

## Scores de Qualidade

- ⚡ Performance: {lighthouse_perf}/100
- ♿ Acessibilidade: {lighthouse_a11y}/100
- 🔍 SEO: {lighthouse_seo}/100
- 🛡️ Segurança: {owasp_status}

---

*Criado com AgentePro — {creation_date}*
"""

class DocGeneratorSubAgent(BaseSubAgent):
    async def execute(self, input: dict) -> dict:
        project = input['project']
        client = input['client']
        operator = input['operator']

        # Gerar senha temporária segura
        temp_password = self.generate_temp_password()

        content = PDF_TEMPLATE.format(
            business_name=client.get('businessName', ''),
            delivery_date=datetime.now().strftime('%d/%m/%Y'),
            site_url=project.get('deliverableUrl', ''),
            admin_url=f"{project.get('deliverableUrl', '')}/admin",
            admin_email=client.get('contactEmail', operator['email']),
            temp_password=temp_password,
            tutorial_url=project.get('deliveryTutorialUrl', 'Em breve'),
            operator_whatsapp=operator.get('phone', ''),
            operator_email=operator.get('email', ''),
            lighthouse_perf=project.get('lighthousePerf', '—'),
            lighthouse_a11y=project.get('lighthouseA11y', '—'),
            lighthouse_seo=project.get('lighthouseSeo', '—'),
            owasp_status='✅ Aprovado' if project.get('owaspScanPassed') else '—',
            creation_date=datetime.now().strftime('%d/%m/%Y'),
        )

        # Gerar PDF via markdown (usando weasyprint ou reportlab)
        pdf_bytes = await self.markdown_to_pdf(content)
        pdf_url = await self.storage.save(
            pdf_bytes,
            f"deliveries/{project['id']}/entrega.pdf"
        )

        return { 'docUrl': pdf_url, 'tempPassword': temp_password }

    def generate_temp_password(self) -> str:
        # 12 chars: letras + números, sem ambíguos (0/O, 1/l/I)
        chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
        return ''.join(secrets.choice(chars) for _ in range(12))
```

---

## NOTIFIER — Mensagem de Entrega

```python
DELIVERY_MESSAGE_TEMPLATES = {
    'whatsapp': """
🎉 *{business_name}, seu site está no ar!*

Acesse agora: {site_url}

📹 Tutorial de como usar: {tutorial_url}
📄 Manual completo: {doc_url}

Qualquer dúvida, é só chamar aqui! 🙌
""",
    'email': {
        'subject': f"🎉 {business_name} — Seu site está no ar!",
        'body': """
Parabéns! Seu site profissional está pronto e publicado.

[Acessar o site →]({site_url})

Em anexo você encontra o manual completo com:
- Credenciais de acesso ao painel
- Tutorial em vídeo (3 minutos)
- Próximos passos recomendados

Obrigado pela confiança!
""",
    },
}
```

---

## Follow-up Automático

```typescript
// Agendado via BullMQ após DeliveryCompleted

// +7 dias: satisfação pós-entrega
const followup7 = {
  message: `Oi {name}! Seu site já está no ar há uma semana 🎉 ` +
           `Tudo certo? Alguma dúvida ou ajuste que precise?`,
  channel: lead.preferredChannel,
};

// +30 dias: NPS
const followup30 = {
  message: `Oi {name}! De 0 a 10, quanto você indicaria nosso serviço ` +
           `para outros empreendedores? Sua opinião vale muito 🙏`,
  channel: lead.preferredChannel,
};
```

---

## Testes Obrigatórios

```python
def test_tutorial_generator_and_doc_generator_run_in_parallel()
def test_notifier_runs_only_after_both_complete()
def test_pdf_contains_site_url()
def test_pdf_contains_temp_password()
def test_pdf_contains_lighthouse_scores()
def test_followup_7_days_scheduled_after_delivery()
def test_followup_30_days_scheduled_after_delivery()
def test_temp_password_is_12_chars_without_ambiguous()
def test_site_delivered_event_emitted()
def test_project_status_updated_to_delivered()
```

---

## Critérios de Aceite

- [ ] TUTORIAL_GENERATOR e DOC_GENERATOR rodam em paralelo
- [ ] NOTIFIER aguarda os dois antes de enviar
- [ ] PDF gerado com: URL do site, credenciais, tutorial, próximos passos, scores Lighthouse
- [ ] Tutorial HeyGen personalizado com nome do cliente e URL do site
- [ ] WhatsApp + E-mail enviados simultaneamente
- [ ] project.status → DELIVERED após entrega
- [ ] Follow-up de 7 dias agendado no BullMQ
- [ ] Follow-up de 30 dias (NPS) agendado no BullMQ
- [ ] SiteDeliveredToClient e ProjectDelivered events emitidos

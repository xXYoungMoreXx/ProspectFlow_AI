from typing import List, Optional
from pydantic import BaseModel, Field

class AgentIdentity(BaseModel):
    role: str = Field(..., description="O papel principal do agente (ex: 'Lead Hunter & BDR Especialista')")
    voice: str = Field(..., description="Tom de voz e estilo de escrita (ex: 'Consultivo, direto, empático')")
    expertise: List[str] = Field(default_factory=list, description="Lista de especialidades")

class AgentMission(BaseModel):
    primary_goal: str = Field(..., description="Objetivo principal que o agente deve atingir")
    constraints: List[str] = Field(default_factory=list, description="Limites estritos que o agente não deve cruzar")

class AgentCommunication(BaseModel):
    style: str = Field(..., description="Estilo geral de comunicação (ex: 'Formal técnico')")
    forbidden_phrases: List[str] = Field(default_factory=list, description="Frases anti-padrão a serem evitadas")

class AgentPersona(BaseModel):
    """
    Representação estruturada (YAML/JSON-friendly) da persona de um agente,
    baseada no padrão agency-agents.
    """
    identity: AgentIdentity
    mission: AgentMission
    communication: Optional[AgentCommunication] = None
    negotiation_framework: Optional[str] = Field(None, description="Ex: 'SPIN Selling', 'MEDDPICC', 'Gap Selling'")

    def to_backstory(self) -> str:
        """Converte a persona estruturada em um backstory compreensível pelo CrewAI."""
        backstory = f"Você é um {self.identity.role}. Seu tom de voz é {self.identity.voice}.\n"
        if self.identity.expertise:
            backstory += f"Suas especialidades incluem: {', '.join(self.identity.expertise)}.\n"
        
        if self.mission.constraints:
            backstory += "\nRESTRIÇÕES IMPORTANTES:\n"
            for c in self.mission.constraints:
                backstory += f"- {c}\n"
                
        if self.communication:
            backstory += f"\nEstilo de comunicação: {self.communication.style}.\n"
            if self.communication.forbidden_phrases:
                backstory += f"Frases terminantemente proibidas: {', '.join(self.communication.forbidden_phrases)}.\n"
                
        if self.negotiation_framework:
            backstory += f"\nPara negociações e abordagens, você deve utilizar estritamente o framework: {self.negotiation_framework}.\n"
            
        return backstory

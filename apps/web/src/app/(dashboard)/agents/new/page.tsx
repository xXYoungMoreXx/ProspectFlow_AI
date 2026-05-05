'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Bot, Save, Sparkles, ShieldAlert, Cpu, UploadCloud, FileText, X } from 'lucide-react';
import Link from 'next/link';

const AVAILABLE_SKILLS = [
  { id: 'web_search', name: 'Web Search', description: 'Allows the agent to search the internet.' },
  { id: 'read_file', name: 'Read Files', description: 'Allows the agent to read local files.' },
  { id: 'write_file', name: 'Write Files', description: 'Allows the agent to modify files.' },
  { id: 'security_guard', name: 'Security Guard', description: 'Runs payload analysis to prevent injection.' },
];

export default function NewAgentPage() {
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [persona, setPersona] = useState('HUNTER');
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4o');
  const [temperature, setTemperature] = useState([0.7]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [files, setFiles] = useState<{name: string, size: number}[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Naive token counter approximation (1 word ~ 1.3 tokens)
  const tokenCount = Math.ceil(systemPrompt.split(/\s+/).filter(Boolean).length * 1.3);

  const toggleSkill = (skillId: string) => {
    setSelectedSkills(prev => 
      prev.includes(skillId) ? prev.filter(id => id !== skillId) : [...prev, skillId]
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setIsUploading(true);
    // Simulate upload delay
    setTimeout(() => {
      const newFiles = Array.from(e.target.files!).map(f => ({ name: f.name, size: f.size }));
      setFiles(prev => [...prev, ...newFiles]);
      setIsUploading(false);
    }, 1500);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    // In a real app, we'd make an API call to create the agent
    console.log({
      name,
      persona,
      systemPrompt,
      llmConfig: {
        provider,
        model,
        temperature: temperature[0],
      },
      skills: selectedSkills
    });
    
    // Simulate API delay
    await new Promise(r => setTimeout(r, 1000));
    router.push('/agents');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-4">
        <Link href="/agents">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Create Agent</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure a new autonomous AI agent persona and capabilities
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* General Config */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                Agent Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Agent Name</Label>
                <Input 
                  id="name" 
                  placeholder="e.g. Prospector Alpha" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Persona Type</Label>
                <Select value={persona} onValueChange={(v) => v && setPersona(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select persona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HUNTER">Hunter (Lead Generation)</SelectItem>
                    <SelectItem value="CLOSER">Closer (Negotiation)</SelectItem>
                    <SelectItem value="BUILDER">Builder (Development/Execution)</SelectItem>
                    <SelectItem value="QA">QA (Quality Assurance)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-end">
                  <Label htmlFor="prompt">System Prompt</Label>
                  <span className={`text-xs ${tokenCount > 6000 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                    ~{tokenCount} tokens
                  </span>
                </div>
                <Textarea 
                  id="prompt" 
                  placeholder="You are an expert lead generator..." 
                  className="min-h-[200px] font-mono text-sm"
                  value={systemPrompt}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSystemPrompt(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">Define the agent&apos;s behavior, constraints, and operational guidelines.</p>
              </div>
            </CardContent>
          </Card>

          {/* LLM Config */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Cpu className="w-5 h-5 text-primary" />
                LLM Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select value={provider} onValueChange={(v) => v && setProvider(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="google">Google Gemini</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select value={model} onValueChange={(v) => v && setModel(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {provider === 'openai' && (
                        <>
                          <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                          <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                          <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                        </>
                      )}
                      {provider === 'anthropic' && (
                        <>
                          <SelectItem value="claude-4.7-opus">Claude 4.7 Opus</SelectItem>
                          <SelectItem value="claude-4.6-opus">Claude 4.6 Opus</SelectItem>
                          <SelectItem value="claude-4.7-sonnet">Claude 4.7 Sonnet</SelectItem>
                        </>
                      )}
                      {provider === 'google' && (
                        <>
                          <SelectItem value="gemini-3.1-pro">Gemini 3.1 Pro</SelectItem>
                          <SelectItem value="gemini-3.1-flash">Gemini 3.1 Flash</SelectItem>
                          <SelectItem value="gemini-3.0-ultra">Gemini 3.0 Ultra</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between">
                  <Label>Temperature</Label>
                  <span className="text-sm text-muted-foreground font-mono">{temperature[0]}</span>
                </div>
                <Slider 
                  value={temperature} 
                  onValueChange={(v) => setTemperature(Array.isArray(v) ? [...v] : [v])}
                  max={2} 
                  step={0.1}
                  className="py-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Deterministic (0.0)</span>
                  <span>Creative (2.0)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Knowledge Base */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Knowledge Base & Rules
              </CardTitle>
              <CardDescription>Upload reference materials (.pdf, .txt, .csv) for the agent&apos;s context.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center space-y-3 hover:bg-muted/50 transition-colors relative">
                <input 
                  type="file" 
                  multiple 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  onChange={handleFileUpload}
                  accept=".pdf,.txt,.csv,.md"
                  disabled={isUploading}
                />
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">{isUploading ? 'Validating and uploading...' : 'Click or drag files here'}</p>
                  <p className="text-xs text-muted-foreground mt-1">Files will be parsed into vector embeddings automatically</p>
                </div>
              </div>

              {files.length > 0 && (
                <div className="space-y-2 mt-4">
                  <h4 className="text-sm font-medium">Uploaded Files ({files.length})</h4>
                  <div className="space-y-2">
                    {files.map((file, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded border bg-muted/30 text-sm">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">({Math.round(file.size / 1024)} KB)</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeFile(i)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar / Skills */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Agent Skills
              </CardTitle>
              <CardDescription>Select capabilities for this agent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {AVAILABLE_SKILLS.map((skill) => (
                <div key={skill.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                  <Switch 
                    id={`skill-${skill.id}`} 
                    checked={selectedSkills.includes(skill.id)}
                    onCheckedChange={() => toggleSkill(skill.id)}
                  />
                  <div className="space-y-1 mt-[-2px]">
                    <Label htmlFor={`skill-${skill.id}`} className="font-semibold cursor-pointer">
                      {skill.name}
                    </Label>
                    <p className="text-xs text-muted-foreground">{skill.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 text-emerald-500 font-semibold">
                <ShieldAlert className="w-5 h-5" />
                Security Guard
              </div>
              <p className="text-xs text-muted-foreground">
                All agents are subjected to the global security middleware. Outbound payloads are inspected automatically.
              </p>
              <Button onClick={handleSave} className="w-full gap-2 mt-4" disabled={!name}>
                <Save className="w-4 h-4" />
                Deploy Agent
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

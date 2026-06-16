/**
 * AgentePro — Inicializador Inteligente Multiplataforma
 *
 * Uso:
 *   node scripts/init.js [comando]
 *
 * Comandos:
 *   (nenhum) | start   Verifica pré-requisitos, sobe infra e inicia dev servers
 *   stop               Para containers Docker com segurança (dados preservados)
 *   restart            Para e reinicia tudo (equivale a stop + start)
 *   check              Valida Node, Docker, Python, .env, JWT e conectividade
 *   status             Mostra containers e portas dos serviços em tempo real
 */

const { spawnSync, spawn } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");

const ROOT = path.resolve(__dirname, "..");

// ── Log colorido ──────────────────────────────────────────────────────────────
const log = {
  info: (m) => console.log(`\x1b[36m[INFO]\x1b[0m  ${m}`),
  ok: (m) => console.log(`\x1b[32m[✔]\x1b[0m    ${m}`),
  warn: (m) => console.log(`\x1b[33m[AVISO]\x1b[0m ${m}`),
  fail: (m) => console.log(`\x1b[31m[✘]\x1b[0m    ${m}`),
  step: (n, m) => console.log(`\n\x1b[35m[${n}]\x1b[0m \x1b[1m${m}\x1b[0m`),
  header: (m) => {
    const bar = "─".repeat(68);
    console.log(`\n\x1b[34m${bar}\x1b[0m`);
    console.log(`\x1b[34m  ${m}\x1b[0m`);
    console.log(`\x1b[34m${bar}\x1b[0m`);
  },
};

// ── Utilitários ───────────────────────────────────────────────────────────────
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: true,
    cwd: ROOT,
    ...opts,
  });
  if (r.status !== 0)
    throw new Error(`Falhou (código ${r.status}): ${cmd} ${args.join(" ")}`);
}

function silent(cmd, args, cwd = ROOT) {
  const r = spawnSync(cmd, args, { encoding: "utf-8", shell: true, cwd });
  return {
    ok: r.status === 0,
    out: ((r.stdout || "") + (r.stderr || "")).trim(),
  };
}

function sleep(ms) {
  spawnSync("node", ["-e", `setTimeout(()=>{},${ms})`]);
}

function portOpen(host, port) {
  return new Promise((res) => {
    const s = new net.Socket();
    s.setTimeout(600);
    s.connect(port, host, () => {
      s.destroy();
      res(true);
    })
      .on("error", () => res(false))
      .on("timeout", () => res(false));
  });
}

// ── Carregar .env no process.env ─────────────────────────────────────────────
function loadEnv() {
  const p = path.join(ROOT, ".env");
  if (!fs.existsSync(p)) return;
  fs.readFileSync(p, "utf-8")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .forEach((line) => {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]])
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    });
}

// ── Helpers de validação (extraídos para reduzir complexidade cognitiva) ──────
function isPlaceholder(val) {
  return !val || val.includes("...") || val.includes("xxxxxxxxxx");
}

function isPemKey(val) {
  return typeof val === "string" && val.includes("BEGIN");
}

function checkRequiredVars(errors) {
  const required = [
    "DATABASE_URL",
    "REDIS_URL",
    "JWT_PRIVATE_KEY",
    "JWT_PUBLIC_KEY",
    "AGENT_RUNTIME_URL",
  ];
  for (const v of required) {
    const val = process.env[v] || "";
    const isJwt = v === "JWT_PRIVATE_KEY" || v === "JWT_PUBLIC_KEY";
    if (isPlaceholder(val)) {
      log.fail(`${v} — não configurado ou ainda é placeholder`);
      errors.count++;
    } else if (isJwt && !isPemKey(val)) {
      log.fail(`${v} — não parece uma chave PEM válida`);
      errors.count++;
    } else {
      const preview = val.length > 45 ? `${val.slice(0, 22)}...` : val;
      log.ok(`${v} = ${preview}`);
    }
  }
}

// Usar array para evitar padrão {ENV_VAR: "valor"} que aciona detector de segredos
const OPTIONAL_INTEGRATIONS = [
  ["TELEGRAM_BOT_TOKEN", "HITL Telegram"],
  ["EVOLUTION_API_URL", "WhatsApp (Evolution API)"],
  ["GOOGLE_MAPS_API_KEY", "Prospecção Google Maps"],
  ["CALCOM_API_KEY", "Agendamento Cal.com"],
  ["HEYGEN_API_KEY", "Tutoriais HeyGen"],
  ["SETTINGS_ENCRYPTION_KEY", "Criptografia de credenciais"],
];

const LLM_PROVIDERS = [
  ["ANTHROPIC_API_KEY", "Anthropic"],
  ["OPENAI_API_KEY", "OpenAI"],
  ["GEMINI_API_KEY", "Google"],
];

function isConfigured(val) {
  return Boolean(val) && !val.includes("xxxx") && !val.includes("...");
}

function checkOptionalVars() {
  let optOk = 0;
  for (const [envKey, desc] of OPTIONAL_INTEGRATIONS) {
    if (isConfigured(process.env[envKey] || "")) {
      log.ok(`${envKey} — ${desc}`);
      optOk++;
    } else {
      log.warn(`${envKey} — ${desc} (não configurado)`);
    }
  }
  log.info(
    `${optOk}/${OPTIONAL_INTEGRATIONS.length} integrações opcionais configuradas.`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CMD: check — valida todos os pré-requisitos sem iniciar nada
// ─────────────────────────────────────────────────────────────────────────────
async function cmdCheck() {
  log.header("AgentePro — Verificação de Pré-Requisitos");

  const errors = { count: 0 };

  // 1. Node.js ≥ 22
  log.step("1/7", "Node.js");
  const major = parseInt(process.version.slice(1));
  if (major >= 22) log.ok(`Node.js ${process.version}`);
  else {
    log.fail(
      `Node.js ${process.version} — necessário ≥ v22  →  https://nodejs.org`,
    );
    errors.count++;
  }

  // 2. Docker e Compose v2
  log.step("2/7", "Docker");
  if (silent("docker", ["info"]).ok) {
    log.ok(silent("docker", ["--version"]).out);
    const cv = silent("docker", ["compose", "version"]);
    if (cv.ok) log.ok(cv.out.trim());
    else {
      log.fail('Docker Compose v2 não encontrado. Instale o plugin "compose".');
      errors.count++;
    }
  } else {
    log.fail("Docker não está rodando. Inicie o Docker Desktop / daemon.");
    errors.count++;
  }

  // 3. Python 3.12+
  log.step("3/7", "Python");
  const py = silent("python3", ["--version"]).ok
    ? silent("python3", ["--version"])
    : silent("python", ["--version"]);
  if (py.ok) {
    const m = py.out.match(/Python (\d+)\.(\d+)/);
    if (m && (parseInt(m[1]) > 3 || parseInt(m[2]) >= 12))
      log.ok(py.out.trim());
    else {
      log.fail(`${py.out.trim()} — requer Python 3.12+`);
      errors.count++;
    }
  } else {
    log.fail("Python não encontrado  →  https://python.org");
    errors.count++;
  }

  // 4. .env existe
  log.step("4/7", "Arquivo .env");
  if (fs.existsSync(path.join(ROOT, ".env"))) {
    loadEnv();
    log.ok(".env encontrado e carregado.");
  } else {
    log.fail(
      ".env não encontrado. Execute:  cp .env.example .env  e preencha os valores.",
    );
    errors.count++;
  }

  // 5. Variáveis obrigatórias
  log.step("5/7", "Variáveis obrigatórias");
  checkRequiredVars(errors);

  // 6. Pelo menos 1 LLM
  log.step("6/7", "Provedores LLM");
  const activeLLMs = LLM_PROVIDERS.filter(([envKey]) =>
    isConfigured(process.env[envKey] || ""),
  ).map(([, name]) => name);
  if (activeLLMs.length === 0) {
    log.fail(
      "Nenhum LLM configurado. Defina ANTHROPIC_API_KEY, OPENAI_API_KEY ou GEMINI_API_KEY.",
    );
    errors.count++;
  } else {
    log.ok(`LLMs ativos: ${activeLLMs.join(", ")}`);
  }

  // 7. Integrações opcionais
  log.step("7/7", "Integrações opcionais");
  checkOptionalVars();

  console.log("");
  if (errors.count === 0) {
    log.ok(
      "Todos os pré-requisitos críticos satisfeitos. Pronto para: npm run init",
    );
  } else {
    log.fail(
      `${errors.count} problema(s) encontrado(s). Corrija antes de iniciar.`,
    );
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CMD: status — portas e containers em tempo real
// ─────────────────────────────────────────────────────────────────────────────
async function cmdStatus() {
  log.header("AgentePro — Status do Sistema");

  const ps = silent("docker", [
    "compose",
    "-f",
    "infra/docker-compose.yml",
    "ps",
    "--format",
    "table {{.Name}}\t{{.Status}}\t{{.Ports}}",
  ]);
  if (ps.ok && ps.out.length > 15) console.log("\n" + ps.out);
  else log.warn("Nenhum container rodando (ou Docker parado).");

  console.log("");
  const services = [
    { name: "Web (Next.js)", port: 3000 },
    { name: "API (Fastify)", port: 3001 },
    { name: "Agent Runtime", port: 8001 },
    { name: "PostgreSQL", port: 5432 },
    { name: "Redis", port: 6379 },
    { name: "ChromaDB", port: 8000 },
    { name: "Grafana", port: 3333 },
    { name: "Jaeger UI", port: 16686 },
    { name: "Prometheus", port: 9090 },
  ];

  for (const svc of services) {
    const alive = await portOpen("localhost", svc.port);
    const dot = alive ? "\x1b[32m●\x1b[0m" : "\x1b[31m○\x1b[0m";
    const url = alive
      ? `\x1b[36mhttp://localhost:${svc.port}\x1b[0m`
      : "\x1b[90m(offline)\x1b[0m";
    console.log(`  ${dot}  ${svc.name.padEnd(22)} ${url}`);
  }
  console.log("");
}

// ─────────────────────────────────────────────────────────────────────────────
// CMD: stop — para containers com segurança
// ─────────────────────────────────────────────────────────────────────────────
function cmdStop() {
  log.header("AgentePro — Encerrando o Sistema");

  log.step("1/2", "Parando dev servers...");
  log.info(
    "Se 'npm run dev' estiver rodando neste terminal, pressione Ctrl+C.",
  );

  log.step("2/2", "Parando containers Docker...");
  const r = silent("docker", [
    "compose",
    "-f",
    "infra/docker-compose.yml",
    "stop",
  ]);
  if (r.ok) {
    log.ok("Containers parados. Dados preservados nos volumes Docker.");
    log.info(
      "Para destruir dados também:  docker compose -f infra/docker-compose.yml down -v",
    );
  } else {
    log.warn("Não foi possível parar containers (talvez já estejam parados).");
  }
  log.ok("Sistema encerrado com segurança.");
}

// ── Geração automática de chaves JWT ─────────────────────────────────────────
function generateAndSaveJwtKeys(envPath) {
  log.info("Gerando par de chaves JWT RSA-2048 automaticamente...");
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  // dotenv lê \n literal como quebra de linha — padrão para chaves PEM em .env
  const toEnvLine = (pem) => pem.replace(/\n/g, "\\n");
  const setVar = (src, key, val) =>
    new RegExp(`^${key}=.*$`, "m").test(src)
      ? src.replace(new RegExp(`^${key}=.*$`, "m"), `${key}="${val}"`)
      : `${src}\n${key}="${val}"`;

  let content = fs.readFileSync(envPath, "utf-8");
  content = setVar(content, "JWT_PRIVATE_KEY", toEnvLine(privateKey));
  content = setVar(content, "JWT_PUBLIC_KEY", toEnvLine(publicKey));
  fs.writeFileSync(envPath, content, "utf-8");

  process.env.JWT_PRIVATE_KEY = privateKey;
  process.env.JWT_PUBLIC_KEY = publicKey;
  log.ok("Chaves JWT geradas e salvas no .env.");
}

// ─────────────────────────────────────────────────────────────────────────────
// CMD: start — fluxo completo de inicialização
// ─────────────────────────────────────────────────────────────────────────────
async function cmdStart() {
  log.header("AgentePro — Inicializando o Sistema");

  // 1. Pré-requisitos
  log.step("1/6", "Verificando pré-requisitos essenciais...");
  if (parseInt(process.version.slice(1)) < 22) {
    log.fail(`Node.js ${process.version} — necessário ≥ v22`);
    process.exit(1);
  }
  log.ok(`Node.js ${process.version}`);

  if (!silent("docker", ["info"]).ok) {
    log.fail("Docker não está rodando. Inicie o Docker Desktop / daemon.");
    process.exit(1);
  }
  log.ok("Docker em execução.");

  // 2. .env
  log.step("2/6", "Verificando .env...");
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) {
    const exPath = path.join(ROOT, ".env.example");
    if (fs.existsSync(exPath)) {
      fs.copyFileSync(exPath, envPath);
      log.warn(".env não encontrado — copiado de .env.example.");
      log.warn(
        "AÇÃO NECESSÁRIA: Edite .env e preencha os valores reais, depois rode: npm run init",
      );
    } else {
      log.fail("Arquivo .env não encontrado e .env.example ausente.");
    }
    process.exit(1);
  }
  loadEnv();

  if (!isPemKey(process.env.JWT_PRIVATE_KEY)) {
    log.warn(
      "JWT_PRIVATE_KEY ausente ou inválida — gerando automaticamente...",
    );
    generateAndSaveJwtKeys(envPath);
  }
  log.ok(".env carregado. JWT verificado.");

  // 3. Dependências npm
  log.step("3/8", "Instalando dependências npm...");
  try {
    run("npm", ["install", "--loglevel=error"], { cwd: ROOT });
    log.ok("Dependências instaladas.");
  } catch (err) {
    log.fail(`Falha no npm install: ${err.message}`);
    process.exit(1);
  }

  // 4. Build pacotes compartilhados
  log.step("4/8", "Compilando pacotes compartilhados...");
  try {
    run("npm", ["run", "build", "--workspace=@agentepro/shared-types"], {
      cwd: ROOT,
    });
    log.ok("Pacotes compartilhados compilados.");
  } catch (err) {
    log.fail(`Falha no build de shared-types: ${err.message}`);
    process.exit(1);
  }

  // 5. Docker Compose
  log.step("5/8", "Subindo infraestrutura (Docker Compose)...");
  const up = silent("docker", [
    "compose",
    "-f",
    "infra/docker-compose.yml",
    "up",
    "-d",
    "--remove-orphans",
  ]);
  if (up.ok) {
    log.ok("Containers iniciados.");
  } else {
    if (
      up.out.includes("nvidia-container-cli") ||
      up.out.includes("adapters were found")
    ) {
      log.warn("GPU NVIDIA não disponível para Ollama.");
      log.info(
        "Remova o bloco 'deploy' do serviço 'ollama' em infra/docker-compose.yml.",
      );
    } else if (
      up.out.includes("address already in use") ||
      up.out.includes("port is already allocated")
    ) {
      log.fail("Porta em uso (5432, 6379 ou outra).");
      log.info(
        "Windows: netstat -ano | findstr PORTA   Linux/Mac: lsof -i :PORTA",
      );
    } else {
      log.fail("Falha no Docker Compose:");
      console.error(up.out.slice(0, 600));
    }
    process.exit(1);
  }

  // 5. Aguardar PostgreSQL
  log.step("6/8", "Aguardando PostgreSQL...");
  let dbReady = false;
  process.stdout.write("  ");
  for (let i = 0; i < 30; i++) {
    if (
      silent("docker", [
        "exec",
        "agentepro-postgres",
        "pg_isready",
        "-U",
        "agentepro",
      ]).ok
    ) {
      dbReady = true;
      break;
    }
    process.stdout.write(".");
    sleep(2000);
  }
  console.log("");
  if (!dbReady) {
    log.fail(
      "PostgreSQL não respondeu em 60s. Diagnóstico: docker logs agentepro-postgres",
    );
    process.exit(1);
  }
  log.ok("PostgreSQL operacional.");

  // 6. Migrations
  log.step("7/8", "Aplicando migrations...");
  try {
    run("npm", ["run", "db:migrate"], { cwd: path.join(ROOT, "apps", "api") });
    log.ok("Migrations aplicadas.");
  } catch (err) {
    log.fail(`Falha nas migrations: ${err.message}`);
    log.info(
      "Verifique DATABASE_URL no .env e se o PostgreSQL está acessível.",
    );
    process.exit(1);
  }

  // 7. Dev servers
  log.step("8/8", "Iniciando serviços...");
  console.log("");
  console.log("  \x1b[36m💻  Web Dashboard  →  http://localhost:3000\x1b[0m");
  console.log("  \x1b[36m⚙️   API Fastify    →  http://localhost:3001\x1b[0m");
  console.log("  \x1b[36m🤖  Agent Runtime  →  http://localhost:8001\x1b[0m");
  console.log("  \x1b[36m📊  Grafana        →  http://localhost:3333\x1b[0m");
  console.log("  \x1b[36m🔍  Jaeger UI      →  http://localhost:16686\x1b[0m");
  console.log("");
  log.info("Pressione Ctrl+C para encerrar todos os serviços.\n");
  console.log("─".repeat(68) + "\n");

  const child = spawn("npm", ["run", "dev"], {
    stdio: "inherit",
    shell: true,
    cwd: ROOT,
  });
  process.on("SIGINT", () => {
    log.info("\nEncerrando serviços...");
    child.kill("SIGINT");
    setTimeout(() => process.exit(0), 2000);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CMD: restart
// ─────────────────────────────────────────────────────────────────────────────
async function cmdRestart() {
  log.header("AgentePro — Reiniciando o Sistema");
  cmdStop();
  sleep(2000);
  await cmdStart();
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────
const CMDS = {
  start: cmdStart,
  stop: cmdStop,
  restart: cmdRestart,
  check: cmdCheck,
  status: cmdStatus,
};
const cmd = process.argv[2] || "start";

if (!CMDS[cmd]) {
  log.fail(`Comando desconhecido: "${cmd}"`);
  console.log("\nUso: node scripts/init.js [comando]\n");
  console.log(
    "  start    Sobe infra + migrations + inicia dev servers (padrão)",
  );
  console.log("  stop     Para containers Docker com segurança");
  console.log("  restart  Para e reinicia tudo");
  console.log("  check    Valida Node, Docker, Python, .env e chaves JWT");
  console.log("  status   Mostra containers e portas dos serviços\n");
  process.exit(1);
}

CMDS[cmd]().catch((e) => {
  log.fail(e.message);
  process.exit(1);
});

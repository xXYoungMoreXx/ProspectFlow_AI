const { spawnSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// Helper para log colorido
const log = {
  info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
  warn: (msg) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
  error: (msg) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  step: (msg) => console.log(`\n\x1b[35m[➤]\x1b[0m \x1b[1m${msg}\x1b[0m`),
};

// Executa comandos síncronos e retorna sucesso ou falha
function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true, cwd: ROOT_DIR, ...options });
  if (result.status !== 0) {
    throw new Error(`O comando falhou com status ${result.status}: ${command} ${args.join(' ')}`);
  }
  return result;
}

// Executa comandos síncronos mas captura saída
function runSilent(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf-8', shell: true, cwd: ROOT_DIR });
  const output = (result.stdout || '') + '\n' + (result.stderr || '');
  return { success: result.status === 0, output: output.trim() };
}

async function main() {
  log.step('Iniciando ProspectFlow AI (Inicializador Multiplataforma)');

  // 1. Verificar Variáveis de Ambiente
  log.info('Verificando .env...');
  const envPath = path.join(ROOT_DIR, '.env');
  const envExamplePath = path.join(ROOT_DIR, '.env.example');
  
  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
      log.warn('Arquivo .env não encontrado. Copiando de .env.example...');
      fs.copyFileSync(envExamplePath, envPath);
      log.success('Arquivo .env criado com sucesso.');
    } else {
      log.error('Nem o .env nem o .env.example foram encontrados!');
      process.exit(1);
    }
  } else {
    log.success('Arquivo .env encontrado.');
  }

  // 2. Verificar Docker
  log.step('Iniciando Infraestrutura (Docker)...');
  const dockerCheck = runSilent('docker', ['info']);
  if (!dockerCheck.success) {
    log.error('O Docker não parece estar rodando ou instalado. Por favor, inicie o Docker Desktop/Daemon.');
    process.exit(1);
  }

  try {
    // 3. Subir o Docker Compose
    log.info('Subindo contêineres em background...');
    const upResult = runSilent('docker', ['compose', '-f', 'infra/docker-compose.yml', 'up', '-d']);
    if (!upResult.success) {
      log.error('Falha ao subir a infraestrutura com Docker Compose.');
      if (upResult.output.includes('nvidia-container-cli') || upResult.output.includes('adapters were found')) {
        log.warn('>> DIAGNÓSTICO: Seu Docker não conseguiu alocar recursos de GPU para o contêiner Ollama.');
        log.warn('>> AÇÃO RECOMENDADA: Abra o arquivo `infra/docker-compose.yml` e remova/comente o bloco `deploy` sob o serviço `ollama` que requisita NVIDIA GPU, ou garanta que o NVIDIA Container Toolkit está corretamente configurado no seu WSL/Linux.');
      } else if (upResult.output.includes('address already in use') || upResult.output.includes('port is already allocated')) {
        log.warn('>> DIAGNÓSTICO: Alguma porta requisitada pelos serviços (ex: 5432, 6379, 3000) já está em uso na sua máquina.');
        log.warn('>> AÇÃO RECOMENDADA: Pare os serviços locais concorrentes ou modifique os mapeamentos de porta no `infra/docker-compose.yml`.');
      } else {
        console.error(upResult.output);
      }
      process.exit(1);
    }
    log.success('Docker Compose finalizou o bootstrap.');

    // 4. Aguardar o banco (Postgres)
    log.info('Aguardando o PostgreSQL aceitar conexões (healthcheck)...');
    let dbReady = false;
    for (let i = 0; i < 30; i++) {
      const ping = runSilent('docker', ['exec', 'agentepro-postgres', 'pg_isready', '-U', 'agentepro']);
      if (ping.success) {
        dbReady = true;
        break;
      }
      // Sleep sincrono de 2 segundos
      spawnSync('node', ['-e', 'setTimeout(()=>{}, 2000)']);
    }

    if (!dbReady) {
      log.error('O banco de dados PostgreSQL (agentepro-postgres) não ficou pronto no tempo esperado.');
      log.info('Dica: Verifique os logs com "docker logs agentepro-postgres". Uma possível causa é a porta 5432 já estar em uso.');
      process.exit(1);
    }
    log.success('Banco de dados operacional!');

    // 5. Rodar migrações
    log.step('Aplicando Migrations no Banco de Dados...');
    try {
      runCommand('npm', ['run', 'db:push'], { cwd: path.join(ROOT_DIR, 'apps', 'api') });
      log.success('Migrações aplicadas com sucesso.');
    } catch (err) {
      log.error('Houve um erro ao rodar as migrações. Verifique o output acima.');
      process.exit(1);
    }

    // 6. Spawnar o servidor principal e acoplar a este terminal
    log.step('Inicializando todos os serviços (Turbo Dev)...');
    log.info('A partir de agora, os logs dos sistemas aparecerão aqui. Pressione Ctrl+C para encerrar tudo.');
    console.log('--------------------------------------------------------------------------------\n');
    
    const child = spawn('npm', ['run', 'dev'], { 
      stdio: 'inherit', 
      shell: true, 
      cwd: ROOT_DIR 
    });

    child.on('close', (code) => {
      log.info(`Servidor foi encerrado (código ${code}).`);
    });

  } catch (error) {
    log.error('Erro durante a inicialização:');
    console.error(error.message);
    process.exit(1);
  }
}

main();

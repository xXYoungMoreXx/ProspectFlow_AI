// Enforces CLAUDE.md §17 — Conventional Commits
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2,'always',['feat','fix','test','refactor','docs','chore','security','perf','ci']],
    'scope-empty': [2, 'never'],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-max-length': [2, 'always', 72],
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
    'header-max-length': [2, 'always', 100],
  },
};

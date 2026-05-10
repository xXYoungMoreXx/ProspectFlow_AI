import { defineConfig } from 'vitest/config';

/**
 * Integration & Security test config — requires Docker infra:
 *   docker compose -f infra/docker-compose.yml up -d
 *
 * Run: npm run test:integration | npm run test:security
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    hookTimeout: 30000,
    testTimeout: 60000,
    env: {
      DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/agentepro',
      REDIS_URL: 'redis://localhost:6379',
      NODE_ENV: 'test',
      JWT_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCgCq+JIoKG3jhK\nlFifRHXdt8uCDzkATyDMUXwKfZuhpNLNswnzYkW+iiUiANXqkkBmmreb76a0MVbl\ntAcjHxKxclN77ElTPi++7EMurnE/ELbsIENxVf3Th5UkfDARusRRJVSQT4AFx0fR\nguemsSfASI2iZydKvPCRuJLXrRnzvS8QQ5PEt/T4n/ZHae+13srbXK5Yow1EkRQr\n5Ga0tdUwFr1/qQevT4Jovf9FTJH3GxdQSTMDE3P6XVJi5ZpfX/uqzFUnaaLrjZW8\nIqiPl71rIxjWTm9Duiadqj63dNAFGz2eAq8IVQaQh5yj3q7OHPXwBo0waOt+QKQ+\nxmvS9K2fAgMBAAECggEAAQHt32n4sSySbrxmAaZi1NesciqIH60np/9LVAhPk2Rz\nnPNquJ7MsD0g8Nz7mv9Sd36ao0NQC/3gA7wj+FZ8xAeoOZ9mNyqT++7XR/iJ86Jr\nf7TDgtuiwXJBjgN9pbAY+cMreYItpKN5goQmzLQxZVX2nrGOxkFipEg2EO/fT+em\nJ2U+KKPH93leeScaaWiWtipTkOqbVQRY72pxLYRBFIJZCR0b4j4gftqfSdx31+SW\n1u9pi5gevSfw8hTer+WYqxT1rrw7JY4drZUaKvSdP3kwAuUrhNUpYT8W3JQp0MtU\nA8IMxpzCrjfhzZ+f3psq+DrlcaaDcsUvL4u/8DYMAQKBgQDNeOsevq3gEq1E52iC\ngOuRcDgqLlDowFKsDbxi4dH1KhdNnenQynMuIqQ/63RsMoXamy+OKNWf/g7LHhFq\nSJXq8Uxc6Ym9HzpwzVJOAsc9PJWC54eggwp94ODGoDvaG7rZTT4ciLaIzY6FsCmH\nKI0pRn4EnHY+9CfzYD/RPWUogQKBgQDHZcdrvm8pNzQxiRlOI0n0wjaCozEOxqrS\nvqf6xO0Zey8l8LM3Dd23qwOYIJvTpAy7RvuvGAr7/nUd1YeegybRC5p+ZMLS1QuV\niEyLLxNyU1w0579/mjAScyDQUE5bYONe47xPnu5Cpdb+1UfusS0eg9+Sh5CXpT8/\nlHyiDeHGHwKBgA1STqQiprFFZLh37F2xsBQw22NYt2Qvu+xtw44BqBQmE3azy0n/\nJjKSimWehWDScb03nICyAw+pcBoZK/XhGN8vn8zSU1zQnoBbv39RTMualvLywedV\nN6PrpYcbMmY0sAuQp3tAHd2GvjvKrRaXOXe4m0j/P+da+xAbaGfPfDSBAoGBAI0w\nJz3GcSWo/h8ZKb7nQ+W4YyqrbQA+chSZhY4ORKinTeI6hlu0SMtVn0znwg7g+Vbe\nUzZO+vAl5D3Exavax/B7m+BlboIk8nfmM/TV15o7Jm4brsAmqGVX+eMnCeSwPS8i\naGOkcKbmkM6OrMl50S3rSLKTpTGLg7Z8aKfC1pwXAoGBAIEvFWDjn8NHkq003AWA\nXZcn3a696xPMis5qBphSgVdZQiRhvuYJwoT6+0i5w5h3xnxEPhN/QRQh9F/0g1pM\n1ynfIeMHnP/+trMD0SCeKSMmZxVcXmZzHMt7ArPD6RdgL1z0EumMqsfJEjPyYob9\nRm+wy7pRLUEr+KbXO7Z9WMiI\n-----END PRIVATE KEY-----',
      JWT_PUBLIC_KEY: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoAqviSKCht44SpRYn0R1\n3bfLgg85AE8gzFF8Cn2boaTSzbMJ82JFvoolIgDV6pJAZpq3m++mtDFW5bQHIx8S\nsXJTe+xJUz4vvuxDLq5xPxC27CBDcVX904eVJHwwEbrEUSVUkE+ABcdH0YLnprEn\nwEiNomcnSrzwkbiS160Z870vEEOTxLf0+J/2R2nvtd7K21yuWKMNRJEUK+RmtLXV\nMBa9f6kHr0+CaL3/RUyR9xsXUEkzAxNz+l1SYuWaX1/7qsxVJ2mi642VvCKoj5e9\nayMY1k5vQ7omnao+t3TQBRs9ngKvCFUGkIeco96uzhz18AaNMGjrfkCkPsZr0vSt\nnwIDAQAB\n-----END PUBLIC KEY-----',
    },
  },
});

import type { Container } from "./container.js";

declare module "fastify" {
  export interface FastifyInstance {
    container: Container;
  }
}

// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',           // SSR habilitado
  site: 'https://unafit.com.br',
  security: {
    // CSRF desabilitado porque a app roda atrás de Traefik (reverse proxy).
    // O Astro compara Origin vs request.url internamente, mas o container
    // vê http://0.0.0.0:4321 enquanto o browser envia Origin: https://unafit.com.br.
    // TODO: Implementar CSRF manual via token nos formulários,
    //       ou configurar Traefik para repassar X-Forwarded-Host/Proto
    //       e habilitar trust-proxy no adapter.
    checkOrigin: false,
  },
  adapter: node({
    mode: 'standalone',
  }),
});

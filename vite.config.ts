import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  /*
   * Caminho relativo por padrão: serve para o dev, para o preview e para abrir
   * o `dist` direto do disco.
   *
   * A publicação no GitHub Pages passa BASE_PATH=/<repo>/ para gerar caminhos
   * absolutos. Com caminho relativo, uma URL sem barra final
   * (`/pixelhub` em vez de `/pixelhub/`) faz os assets resolverem contra a raiz
   * do domínio, dando 404 e página em branco — sem nenhum erro de JS.
   */
  base: process.env.BASE_PATH || './',
})

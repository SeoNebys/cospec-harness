import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({ plugins:[react()], root:fileURLToPath(new URL('.', import.meta.url)), build:{outDir:'dist',emptyOutDir:true}, server:{port:5173,proxy:{'/api':'http://127.0.0.1:4000','/saved':'http://127.0.0.1:4000'}} });

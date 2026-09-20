import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode})=>{
  const env=loadEnv(mode,'.','');
  return {plugins:[react()],server:{proxy:{'/dify-api':{
    target:env.DIFY_API_URL||'https://dify.high33light.cn',changeOrigin:true,
    rewrite:(p:string)=>p.replace(/^\/dify-api/,'/v1'),
    configure:(proxy:any)=>proxy.on('proxyReq',(req:any)=>{if(env.DIFY_API_KEY)req.setHeader('Authorization',`Bearer ${env.DIFY_API_KEY}`);}),
  }}}};
});

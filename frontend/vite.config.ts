import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode})=>{
  const env=loadEnv(mode,'.','');
  return {plugins:[react()],server:{proxy:{
    '/dify-api':{
    target:env.DIFY_API_URL||'https://dify.high33light.cn',changeOrigin:true,
    rewrite:(p:string)=>p.replace(/^\/dify-api/,'/v1'),
    configure:(proxy:any)=>proxy.on('proxyReq',(req:any)=>{if(env.DIFY_API_KEY)req.setHeader('Authorization',`Bearer ${env.DIFY_API_KEY}`);}),
  },
    // B3 转派动作：开发环境直连本地 Mock 服务
    '/mock-api':{
    target:env.MOCK_API_URL||'http://127.0.0.1:8002',changeOrigin:true,
    rewrite:(p:string)=>p.replace(/^\/mock-api/,''),
    configure:(proxy:any)=>proxy.on('proxyReq',(req:any)=>{if(env.MOCK_API_KEY)req.setHeader('X-API-Key',env.MOCK_API_KEY);}),
  }
  }}};
});

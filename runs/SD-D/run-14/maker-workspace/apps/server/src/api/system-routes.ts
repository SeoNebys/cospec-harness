import type {FastifyInstance}from'fastify';export async function systemRoutes(app:FastifyInstance){app.get('/health',async()=>({status:'ok'}));app.get('/ready',async()=>({status:'ready'}));}

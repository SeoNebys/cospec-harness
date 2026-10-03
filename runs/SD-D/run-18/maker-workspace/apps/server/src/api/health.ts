import type { FastifyInstance } from 'fastify';
export const registerHealth=(app:FastifyInstance,worker:{status:()=>unknown})=>app.get('/api/health',async()=>({status:'ok',worker:worker.status()}));

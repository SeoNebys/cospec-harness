import type { FastifyInstance } from 'fastify';
import type { AuthService } from '../services/auth/auth-service.js';
import type { MetadataService } from '../services/metadata/metadata-service.js';
import { SESSION_COOKIE } from '../security/session.js';

export async function metadataRoutes(app:FastifyInstance,auth:AuthService,metadata:MetadataService){app.post('/api/v1/metadata/preview',async(request:any,reply)=>{const user=auth.authenticate(request.cookies[SESSION_COOKIE]);if(!user)return reply.code(401).send({error:{code:'UNAUTHORIZED',message:'Sign in to continue.'}});try{return reply.send(await metadata.preview(user.id,String(request.body?.url??'')));}catch(error){return reply.code(422).send({error:{code:'VALIDATION_ERROR',message:error instanceof Error?error.message:'Enter a valid web address.',field:'url'}});}});}

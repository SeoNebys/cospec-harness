import type { FastifyInstance } from 'fastify';
import type { AuthService } from '../services/auth/auth-service.js';
import type { TagRepository } from '../repositories/tag-repository.js';
import { SESSION_COOKIE } from '../security/session.js';
export async function tagRoutes(app:FastifyInstance,auth:AuthService,tags:TagRepository){app.get('/api/v1/tags',(request:any,reply)=>{const user=auth.authenticate(request.cookies[SESSION_COOKIE]);if(!user)return reply.code(401).send({error:{code:'UNAUTHORIZED',message:'Sign in to continue.'}});return {items:tags.suggestions(user.id,String(request.query?.suggest??''),Number(request.query?.limit??10))};});}

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import { createLabel, deleteLabel, listLabels, renameLabel } from '../db/repositories/labels.js';
import { problem, requireUser } from '../auth/plugin.js';

const nameSchema=z.object({name:z.string().min(1).max(50)});

export async function labelRoutes(app:FastifyInstance,db:Db):Promise<void>{
  for(const kind of ['tags','collections'] as const){
    app.get(`/api/${kind}`,async(request)=>{const user=requireUser(request);const suggest=kind==='tags'?String((request.query as any)?.suggest||''):'';return listLabels(db,user.id,kind,suggest);});
    app.post(`/api/${kind}`,async(request,reply)=>{const user=requireUser(request);const parsed=nameSchema.safeParse(request.body);if(!parsed.success)return reply.code(422).send(problem(422,'Validation failed','Name must be between 1 and 50 characters.'));try{return reply.code(201).send(createLabel(db,user.id,kind,parsed.data.name));}catch(error){return reply.code(409).send(problem(409,'Name already exists',error instanceof Error?error.message:'Choose another name.'));}});
    app.patch(`/api/${kind}/:id`,async(request,reply)=>{const user=requireUser(request);const parsed=nameSchema.safeParse(request.body);if(!parsed.success)return reply.code(422).send(problem(422,'Validation failed','Name must be between 1 and 50 characters.'));try{const item=renameLabel(db,user.id,kind,(request.params as any).id,parsed.data.name);return item??reply.code(404).send(problem(404,'Not found','That label is unavailable.'));}catch(error){return reply.code(409).send(problem(409,'Name already exists',error instanceof Error?error.message:'Choose another name.'));}});
    app.delete(`/api/${kind}/:id`,async(request,reply)=>{const user=requireUser(request);const expected=Number((request.query as any)?.expectedCount);if(!Number.isInteger(expected)||expected<0)return reply.code(422).send(problem(422,'Validation failed','An expected count is required.'));try{const ok=deleteLabel(db,user.id,kind,(request.params as any).id,expected);return ok?reply.code(204).send():reply.code(404).send(problem(404,'Not found','That label is unavailable.'));}catch(error:any){return reply.code(409).send(problem(409,'Count changed',error.message));}});
  }
}

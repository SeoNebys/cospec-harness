import type { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { zodFieldErrors } from '../../shared/schemas/api.ts';
import { UrlValidationError } from '../../shared/url/normalize.ts';
import { ConflictError, NotFoundError } from '../services/bookmark-service.ts';

export function requestId(req:Request,res:Response,next:NextFunction){res.locals.requestId=req.header('x-request-id')??randomUUID();res.setHeader('x-request-id',res.locals.requestId);next();}
export const errorHandler:ErrorRequestHandler=(error,_req,res,_next)=>{void _next;
  const base={type:'about:blank',requestId:res.locals.requestId};
  if(error instanceof ZodError)return res.status(422).type('application/problem+json').json({...base,title:'Validation failed',status:422,errors:zodFieldErrors(error)});
  if(error instanceof UrlValidationError)return res.status(422).type('application/problem+json').json({...base,title:'Validation failed',status:422,errors:{url:[error.message]}});
  if(error instanceof NotFoundError)return res.status(404).type('application/problem+json').json({...base,title:'Not found',status:404,detail:error.message});
  if(error instanceof ConflictError)return res.status(409).type('application/problem+json').json({...base,title:'Conflict',status:409,detail:error.message,existingBookmarkId:error.existingBookmarkId});
  console.error('request_failed',{requestId:res.locals.requestId,error:error instanceof Error?error.message:'unknown'});return res.status(500).type('application/problem+json').json({...base,title:'Something went wrong',status:500,detail:'Please try again.'});
};

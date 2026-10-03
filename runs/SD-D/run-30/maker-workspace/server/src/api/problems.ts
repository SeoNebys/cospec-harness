import type { NextFunction,Request,Response } from 'express';
import { ZodError } from 'zod';
import { SearchSyntaxError } from '../search/parser.js';
export class HttpProblem extends Error{constructor(public status:number,public code:string,message:string,public extra:Record<string,unknown>={}){super(message)}}
export function errorHandler(error:unknown,_req:Request,res:Response,_next:NextFunction){
 let status=500,code='INTERNAL_ERROR',message='Something went wrong',extra={};
 if(error instanceof HttpProblem){({status,code,message,extra}=error)}else if(error instanceof ZodError){status=422;code='VALIDATION_ERROR';message='Check the highlighted fields';extra={issues:error.issues.map(i=>({field:i.path.join('.'),message:i.message}))}}else if(error instanceof SearchSyntaxError){status=400;code='INVALID_SEARCH_QUERY';message=error.message;extra={issues:[{field:'q',message:error.message,start:error.start,end:error.end}]}}else if(error instanceof Error&&error.message.includes('UNIQUE constraint failed: bookmarks.normalized_url')){status=409;code='DUPLICATE_BOOKMARK';message='This bookmark already exists'}
 res.status(status).type('application/problem+json').json({code,message,...extra});
}

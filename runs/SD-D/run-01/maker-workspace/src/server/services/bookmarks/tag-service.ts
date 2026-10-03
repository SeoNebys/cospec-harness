import { TagRepository } from '../../repositories/tag-repository.js';
export class TagService { constructor(private tags:TagRepository){} suggest(userId:string,q?:string,limit?:number){return {items:this.tags.suggestions(userId,q,limit)}} }

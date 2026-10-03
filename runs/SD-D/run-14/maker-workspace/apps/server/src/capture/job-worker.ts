import type { DB } from '../db/client.js';
import { CaptureService } from './capture-service.js';
export class JobWorker {private timer?:NodeJS.Timeout;private active=0;constructor(private db:DB,private service:CaptureService,private concurrency=2){}
  start(){this.timer=setInterval(()=>void this.tick(),400);void this.tick();}
  async tick(){while(this.active<this.concurrency){const job=this.db.prepare("SELECT * FROM capture_jobs WHERE status='pending' AND available_at<=? ORDER BY created_at LIMIT 1").get(Date.now()) as any;if(!job)return;const claimed=this.db.prepare("UPDATE capture_jobs SET status='processing',started_at=?,attempt_count=attempt_count+1 WHERE id=? AND status='pending'").run(Date.now(),job.id);if(!claimed.changes)continue;this.active++;void this.service.run(job.bookmark_id,!!job.replace_user_metadata).finally(()=>{this.active--;});}}
  async stop(){if(this.timer)clearInterval(this.timer);const end=Date.now()+5000;while(this.active&&Date.now()<end)await new Promise(r=>setTimeout(r,50));this.db.prepare("UPDATE capture_jobs SET status='pending',started_at=NULL WHERE status='processing'").run();}
}

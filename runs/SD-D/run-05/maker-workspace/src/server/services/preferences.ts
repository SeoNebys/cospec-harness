import {db} from "@/server/db/client"; import type {Preferences} from "@/lib/types";
export function getPreferences(){return db.prepare("SELECT default_sort defaultSort,page_size pageSize,text_size textSize FROM preferences WHERE id=1").get() as Preferences;}
export function setPreferences(p:Preferences){db.prepare("UPDATE preferences SET default_sort=?,page_size=?,text_size=?,updated_at=? WHERE id=1").run(p.defaultSort,p.pageSize,p.textSize,new Date().toISOString());return getPreferences();}

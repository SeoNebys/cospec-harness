export function logEvent(event:string,details:Record<string,string|number|boolean>={}) { console.info(JSON.stringify({event,...details})); }

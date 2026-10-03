export const captureLog=(event:string,fields:Record<string,string|number|boolean|null>={})=>console.log(JSON.stringify({time:new Date().toISOString(),component:'capture-worker',event,...fields}));

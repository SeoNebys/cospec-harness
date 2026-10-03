export function normalizeUrl(input:string):{url:string;normalizedUrl:string}{
  const raw=input.trim(); let parsed:URL;
  try{parsed=new URL(raw);}catch{throw new Error('Enter a valid web address');}
  if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password) throw new Error('Only http and https addresses without embedded credentials are supported');
  parsed.protocol=parsed.protocol.toLowerCase(); parsed.hostname=parsed.hostname.toLowerCase();
  return {url:parsed.toString(),normalizedUrl:parsed.toString()};
}

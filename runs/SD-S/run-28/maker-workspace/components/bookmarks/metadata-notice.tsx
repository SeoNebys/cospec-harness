export function MetadataNotice({message}:{message:string|null}){return message?<p className="status-line" role="status">{message}</p>:null;}

export function StatusMessage({children,tone="info"}:{children?:React.ReactNode;tone?:"info"|"success"|"error"}){
  if(!children)return null; return <p className={`status status-${tone}`} role={tone==="error"?"alert":"status"}>{children}</p>;
}

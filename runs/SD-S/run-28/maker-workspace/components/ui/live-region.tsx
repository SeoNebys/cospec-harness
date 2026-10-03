export function announce(message:string){const region=document.getElementById("global-live");if(region){region.textContent="";requestAnimationFrame(()=>{region.textContent=message;});}}

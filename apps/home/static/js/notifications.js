/* Local reusable snackbar. Errors persist; success expires; no orphan timers. */
window.AgataNotifications={create(host){
 let timer=null;const text=document.createElement('span');text.className='agata-toast-text';
 const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Fechar notificação');
 const copy=document.createElement('button');copy.type='button';copy.textContent='Copiar';
 host.replaceChildren(text,copy,close);host.setAttribute('role','status');
 const hide=()=>{clearTimeout(timer);timer=null;host.hidden=true;};
 close.onclick=hide;copy.onclick=()=>window.Vela?.platform?.clipboard?.writeText(text.textContent);
 return {show(value,{error=false}={}){hide();text.textContent=value||'';text.title=value||'';host.hidden=!value;host.setAttribute('role',error?'alert':'status');host.dataset.error=String(error);copy.hidden=!window.Vela?.platform?.clipboard?.writeText;
 if(value&&!error)timer=setTimeout(hide,4000);},dispose(){hide();close.onclick=null;copy.onclick=null;}};
}};

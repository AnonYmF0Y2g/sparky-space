(() => {
  "use strict";
  const SUPABASE_URL = "https://wuwvazwrqmdqiztyxfrs.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_KfdFoBj7R-Zf5vQv6L4NYA_rKhju2oj";
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const $ = id => document.getElementById(id);
  let user = null;
  let activeTicketId = null;
  let ticketCache = [];
  const categoryNames = {general:"General question",account:"Account or sign-in",website_bug:"Website problem",privacy:"Privacy or security",device_help:"Device or IT help",other:"Something else"};
  const statusNames = {open:"Open",in_progress:"In progress",waiting_user:"Waiting for your reply",resolved:"Resolved",closed:"Closed"};
  function node(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
  function dateText(value){const date=new Date(value);return Number.isNaN(date.getTime())?"":date.toLocaleString();}
  function setStatus(id,text){$(id).textContent=text;}
  function showSignedIn(value){$("support-signed-out").classList.toggle("hidden",value);$("support-signed-in").classList.toggle("hidden",!value);}
  async function loadTickets(){
    if(!user)return;
    const target=$("support-ticket-list");
    const {data,error}=await db.from("support_tickets").select("id,subject,category,status,created_at,updated_at").eq("user_id",user.id).order("updated_at",{ascending:false}).limit(50);
    if(error){target.replaceChildren(node("p","Could not load your tickets right now. Please try again.","section-note"));return;}
    ticketCache=data||[];target.replaceChildren();
    if(!ticketCache.length)target.append(node("p","You have no support tickets yet.","section-note"));
    for(const ticket of ticketCache){
      const button=node("button",undefined,"support-ticket-button"+(ticket.id===activeTicketId?" active":""));button.type="button";
      button.append(node("strong",ticket.subject),node("span",(categoryNames[ticket.category]||"Support")+" · "+(statusNames[ticket.status]||ticket.status)),node("small","Updated "+dateText(ticket.updated_at)));
      button.addEventListener("click",()=>openTicket(ticket.id));target.append(button);
    }
    const current=ticketCache.find(t=>t.id===activeTicketId);
    if(current){
      $("support-active-title").textContent=current.subject;
      $("support-active-meta").textContent=(categoryNames[current.category]||"Support")+" · "+(statusNames[current.status]||current.status);
      $("support-reply-form").classList.toggle("hidden",current.status==="closed");
      if(current.status==="closed")setStatus("support-reply-status","This ticket is closed. Contact support if it needs to be reopened.");
    }
  }
  async function openTicket(id){activeTicketId=id;await loadTickets();await loadMessages();}
  async function loadMessages(){
    if(!activeTicketId)return;
    const target=$("support-messages");
    const {data,error}=await db.from("support_messages").select("id,body,is_staff,created_at").eq("ticket_id",activeTicketId).order("created_at",{ascending:true}).limit(200);
    if(error){target.replaceChildren(node("p","Could not load this conversation. Please refresh and try again.","section-note"));return;}
    target.replaceChildren();if(!data?.length)target.append(node("p","No messages yet.","section-note"));
    for(const item of data||[]){const bubble=node("article",undefined,"support-message"+(item.is_staff?" staff":" member"));bubble.append(node("strong",item.is_staff?"Sparky's Space Support":"You"),node("p",item.body),node("small",dateText(item.created_at)));target.append(bubble);}
    target.scrollTop=target.scrollHeight;
  }
  $("support-new-form").addEventListener("submit",async event=>{
    event.preventDefault();if(!user)return;
    const button=$("support-create"),subject=$("support-subject").value.trim(),body=$("support-first-message").value.trim();
    if(subject.length<5||body.length<10)return;
    button.disabled=true;setStatus("support-new-status","Creating your ticket…");
    try{
      const {data:ticket,error:ticketError}=await db.from("support_tickets").insert({user_id:user.id,subject,category:$("support-category").value}).select("id").single();
      if(ticketError)throw ticketError;
      const {error:messageError}=await db.from("support_messages").insert({ticket_id:ticket.id,sender_id:user.id,body});
      if(messageError)throw messageError;
      $("support-new-form").reset();activeTicketId=ticket.id;setStatus("support-new-status","Ticket created. You can follow replies here.");await loadTickets();await loadMessages();
    }catch(error){setStatus("support-new-status",error?.message?.includes("limit")?error.message:"We could not create the ticket. Please try again later.");}
    finally{button.disabled=false;}
  });
  $("support-reply-form").addEventListener("submit",async event=>{
    event.preventDefault();if(!user||!activeTicketId)return;
    const body=$("support-reply").value.trim();if(!body)return;
    const button=$("support-reply-send");button.disabled=true;setStatus("support-reply-status","Sending reply…");
    const {error}=await db.from("support_messages").insert({ticket_id:activeTicketId,sender_id:user.id,body});button.disabled=false;
    if(error){setStatus("support-reply-status",error.message.includes("closed")?"This ticket is closed.":"Your reply could not be sent. Please try again.");return;}
    $("support-reply").value="";setStatus("support-reply-status","Reply sent.");await loadTickets();await loadMessages();
  });
  $("support-refresh").addEventListener("click",async()=>{await loadTickets();await loadMessages();});
  async function start(){const {data,error}=await db.auth.getUser();if(error){showSignedIn(false);return;}user=data?.user||null;showSignedIn(Boolean(user));if(user)await loadTickets();}
  db.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;showSignedIn(Boolean(user));if(user)loadTickets();else{activeTicketId=null;ticketCache=[];}});
  start();
  window.setInterval(async()=>{if(!user||document.hidden)return;await loadTickets();if(activeTicketId)await loadMessages();},30000);
})();
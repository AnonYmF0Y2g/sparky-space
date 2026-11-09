(() => {
"use strict";
const db=window.supabase.createClient("https://wuwvazwrqmdqiztyxfrs.supabase.co","sb_publishable_KfdFoBj7R-Zf5vQv6L4NYA_rKhju2oj");
const $=id=>document.getElementById(id); let user=null;
const say=(id,msg)=>{if($(id))$(id).textContent=msg;};
const item=(root,title,body,meta="")=>{const el=document.createElement("article");el.className="feature-item";const h=document.createElement("strong");h.textContent=title;const p=document.createElement("p");p.textContent=body;el.append(h,p);if(meta){const s=document.createElement("small");s.textContent=meta;el.append(s);}root.append(el);};
const petAccessories={
  none:"",
  bow:'<g class="pet-accessory" stroke="#7c4a9f" stroke-width="5" stroke-linejoin="round"><path d="M188 73 Q155 42 148 76 Q153 100 188 91Z" fill="#f4a6d2"/><path d="M192 73 Q225 42 232 76 Q227 100 192 91Z" fill="#f4a6d2"/><circle cx="190" cy="80" r="10" fill="#ffd7ed"/></g>',
  star:'<g class="pet-accessory" fill="#ffe18a" stroke="#9b78c7" stroke-width="4"><path d="M190 30 L202 58 L232 61 L210 82 L216 112 L190 97 L164 112 L170 82 L148 61 L178 58Z"/><circle cx="190" cy="72" r="5" fill="#fff7d4" stroke="none"/></g>',
  scarf:'<g class="pet-accessory" fill="none" stroke="#f18abd" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><path d="M120 247 Q190 273 264 245"/><path d="M235 250 L249 307 Q252 316 265 306 L279 294" /></g>',
  headphones:'<g class="pet-accessory" fill="none" stroke="#ff9dce" stroke-width="12" stroke-linecap="round"><path d="M99 155 Q83 24 190 22 Q297 24 281 155"/><path d="M95 138 L95 171 M285 138 L285 171"/></g>'
};
const petColorFilters={pink:"none",purple:"hue-rotate(18deg)",blue:"hue-rotate(188deg)",cyan:"hue-rotate(158deg)",teal:"hue-rotate(138deg)",green:"hue-rotate(112deg)",orange:"hue-rotate(-42deg)",red:"hue-rotate(-72deg)"};
const petSpeciesLabels={protogen:"Protogen",cat:"Cat-inspired",fox:"Fox-inspired",dragon:"Dragon-inspired",blob:"Blob-inspired"};
function installPetStyles(){
 if(document.getElementById("custom-pet-styles"))return;
 const style=document.createElement("style");style.id="custom-pet-styles";
 style.textContent=".pet-preview{display:grid;justify-items:center;gap:4px;min-height:220px;padding:6px 0 14px;overflow:hidden}.pet-stage{width:min(100%,300px);display:grid;place-items:center;filter:drop-shadow(0 12px 20px rgba(0,0,0,.22))}.pet-illustration{display:block;width:100%;height:auto;max-height:270px;overflow:visible;transition:filter .2s ease,transform .2s ease}.pet-preview:hover .pet-illustration{transform:translateY(-3px)}.pet-nameplate{margin:0;text-align:center;color:var(--accent);font-weight:750}.pet-caption{margin:0;text-align:center;color:var(--muted);font-size:12px}@media(prefers-reduced-motion:reduce){.pet-illustration{transition:none!important}.pet-preview:hover .pet-illustration{transform:none}}";
 document.head.append(style);
}
function petPreview(){
 installPetStyles();
 const species=$("pet-species")?.value||"protogen";
 const accessory=$("pet-accessory")?.value||"none";
 const color=$("pet-color")?.value||"pink";
 const preview=$("pet-preview");
 const extra=petAccessories[accessory]||"";
 preview.replaceChildren();
 const stage=document.createElement("div");stage.className="pet-stage";
 stage.innerHTML=`<svg class="pet-illustration" viewBox="0 0 380 360" role="img" aria-label="Custom illustrated cyber companion">
 <defs>
  <linearGradient id="petFur" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffaff"/><stop offset=".55" stop-color="#ded5ff"/><stop offset="1" stop-color="#a79be8"/></linearGradient>
  <linearGradient id="petArmor" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#34334f"/><stop offset=".5" stop-color="#191c32"/><stop offset="1" stop-color="#45416d"/></linearGradient>
  <linearGradient id="petVisor" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#242a48"/><stop offset=".5" stop-color="#090f22"/><stop offset="1" stop-color="#292340"/></linearGradient>
  <linearGradient id="petGlow" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#81f5ff"/><stop offset=".55" stop-color="#65cfff"/><stop offset="1" stop-color="#efa9ff"/></linearGradient>
 </defs>
 <!-- fluffy tail -->
 <path d="M263 252 Q326 211 342 260 Q357 306 308 331 Q272 348 250 320 Q288 318 294 288 Q282 271 251 285Z" fill="url(#petFur)" stroke="#8175be" stroke-width="5" stroke-linejoin="round"/>
 <path d="M295 298 Q326 285 334 260" fill="none" stroke="#8deaff" stroke-width="9" stroke-linecap="round"/>
 <!-- ears -->
 <path d="M93 130 Q56 65 76 22 Q118 36 143 103Z" fill="url(#petFur)" stroke="#7469ae" stroke-width="6" stroke-linejoin="round"/>
 <path d="M92 96 Q77 54 82 43 Q105 57 119 103Z" fill="#79e8ff" stroke="#8178c1" stroke-width="4"/>
 <path d="M237 103 Q265 39 307 22 Q326 68 288 132Z" fill="url(#petFur)" stroke="#7469ae" stroke-width="6" stroke-linejoin="round"/>
 <path d="M262 103 Q285 59 303 43 Q308 72 286 111Z" fill="#f5a8d6" stroke="#8178c1" stroke-width="4"/>
 <!-- body and little arms -->
 <path d="M107 224 Q110 191 147 188 L232 188 Q269 196 275 236 L294 306 Q291 333 264 333 L113 333 Q87 327 92 302Z" fill="url(#petFur)" stroke="#7469ae" stroke-width="6"/>
 <path d="M139 207 Q190 181 242 208 L259 300 Q255 311 241 313 L138 313 Q121 308 123 294Z" fill="url(#petArmor)" stroke="#5a5785" stroke-width="5"/>
 <path d="M115 230 Q86 231 78 266 Q75 290 98 294 L126 281Z" fill="url(#petFur)" stroke="#7469ae" stroke-width="5"/>
 <path d="M263 231 Q295 233 302 269 Q303 290 279 294 L254 281Z" fill="url(#petFur)" stroke="#7469ae" stroke-width="5"/>
 <!-- fluffy head -->
 <path d="M87 116 Q91 79 131 72 Q151 57 174 67 Q194 47 218 66 Q250 61 266 87 Q296 95 294 132 L286 191 Q270 229 190 230 Q111 227 92 190Z" fill="url(#petFur)" stroke="#7469ae" stroke-width="6"/>
 <path d="M131 77 Q139 54 157 70 Q170 42 190 67 Q210 43 224 72 Q244 53 255 83" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round"/>
 <!-- visor -->
 <rect x="78" y="106" width="224" height="116" rx="48" fill="url(#petVisor)" stroke="#aaa2e3" stroke-width="8"/>
 <path d="M105 125 Q149 104 208 114" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="8" stroke-linecap="round"/>
 <path d="M118 156 L137 140 L157 156 L157 173 L139 173 L139 161 L130 168 L130 181 L118 181Z" fill="url(#petGlow)"/>
 <path d="M222 156 L241 140 L261 156 L261 173 L243 173 L243 161 L234 168 L234 181 L222 181Z" fill="url(#petGlow)"/>
 <path d="M174 184 Q190 198 206 184" fill="none" stroke="#79e9ff" stroke-width="5" stroke-linecap="round"/>
 <path d="M99 183 L111 191 M269 191 L281 183" stroke="#f2a7dc" stroke-width="6" stroke-linecap="round"/>
 <!-- headset cups -->
 <rect x="63" y="140" width="34" height="57" rx="14" fill="url(#petArmor)" stroke="#8eeeff" stroke-width="5"/>
 <rect x="283" y="140" width="34" height="57" rx="14" fill="url(#petArmor)" stroke="#f49bd2" stroke-width="5"/>
 <path d="M73 156 L87 156 M293 156 L307 156" stroke="#fff" stroke-opacity=".75" stroke-width="4" stroke-linecap="round"/>
 <!-- chest heart and paws -->
 <path d="M190 248 C174 228 145 241 155 262 C163 278 190 293 190 293 Q218 274 225 261 C235 240 206 228 190 248Z" fill="#f59bd0" stroke="#ffd7ee" stroke-width="4"/>
 <path d="M105 307 Q132 291 157 311 Q165 331 144 342 L112 340 Q91 333 105 307Z" fill="url(#petFur)" stroke="#7469ae" stroke-width="5"/>
 <path d="M224 311 Q250 291 275 307 Q290 333 268 342 L237 340 Q216 333 224 311Z" fill="url(#petFur)" stroke="#7469ae" stroke-width="5"/>
 <path d="M120 324 L125 334 M139 322 L142 334 M244 322 L241 334 M263 324 L258 334" stroke="#8c80c6" stroke-width="4" stroke-linecap="round"/>
 <!-- little tech details -->
 <path d="M122 253 L130 266 M258 253 L250 266" stroke="#70e4fa" stroke-width="6" stroke-linecap="round"/>
 <circle cx="190" cy="308" r="5" fill="#83edff"/>
 ${extra}
 </svg>`;
 const art=stage.querySelector(".pet-illustration");
 art.style.filter=petColorFilters[color]||"none";
 const name=document.createElement("p");name.className="pet-nameplate";
 name.textContent=($("pet-name")?.value.trim()||"Sparky")+" · "+(petSpeciesLabels[species]||"Companion");
 const caption=document.createElement("p");caption.className="pet-caption";
 caption.textContent=accessory==="none"?"Your little companion":"Accessory: "+({bow:"Bow",star:"Star",scarf:"Scarf",headphones:"Headphones"}[accessory]||"None");
 preview.append(stage,name,caption);
}

async function init(){
const auth=await db.auth.getUser();user=auth.data?.user||null;
say("hub-auth",user?"Signed in as @"+(user.user_metadata?.username||"member"):"Sign in on the Account page to post, react, and save your companion.");
await loadCategories();await loadThreads();await loadBadges();await loadPet();await loadGuestbook();await loadStaffFeed();await loadSecurityCenter();
}
async function loadCategories(){const {data,error}=await db.from("forum_categories").select("id,name,is_locked").order("sort_order");const select=$("forum-category");select.replaceChildren();for(const c of data||[]){const o=document.createElement("option");o.value=c.id;o.textContent=c.name+(c.is_locked?" (locked)":"");o.disabled=c.is_locked;select.append(o);}if(error)say("forum-list",error.message);}
async function loadThreads(){const root=$("forum-list");root.replaceChildren();const {data,error}=await db.from("forum_threads").select("id,title,body,created_at,author_id,forum_categories(name)").eq("status","visible").order("is_pinned",{ascending:false}).order("created_at",{ascending:false}).limit(25);if(error){say("forum-list",error.message);return;}for(const t of data||[]){const row=document.createElement("article");row.className="feature-item";const h=document.createElement("strong");h.textContent=t.title;const p=document.createElement("p");p.textContent=t.body;const m=document.createElement("small");m.textContent=(t.forum_categories?.name||"Forum")+" · "+new Date(t.created_at).toLocaleString();const react=document.createElement("button");react.textContent="♡ Like";react.addEventListener("click",async()=>{if(!user){say("forum-list","Sign in to react.");return;}const {error}=await db.from("forum_reactions").insert({user_id:user.id,thread_id:t.id,reaction:"like"});say("forum-list",error?error.message:"Reaction added.");});row.append(h,p,m,react);root.append(row);}if(!data?.length)root.textContent="No discussions yet—start one!";}
$("forum-submit").addEventListener("click",async()=>{if(!user){say("forum-list","Sign in to start a discussion.");return;}const title=$("forum-title").value.trim(),body=$("forum-body").value.trim();if(title.length<4||!body){say("forum-list","Add a title (at least 4 characters) and message.");return;}const {error}=await db.from("forum_threads").insert({category_id:$("forum-category").value,author_id:user.id,title,body});say("forum-list",error?error.message:"Discussion posted.");if(!error){$("forum-title").value="";$("forum-body").value="";loadThreads();}});
async function loadGuestbook(profileId=user?.id){const root=$("guestbook-list");root.replaceChildren();if(!user){root.textContent="Sign in to use the guestbook.";return;}if(!profileId){root.textContent="Choose a member username to view their guestbook.";return;}const {data,error}=await db.rpc("get_public_guestbook",{p_profile_id:profileId});if(error){root.textContent="Guestbook is temporarily unavailable.";return;}for(const e of data||[])item(root,"Guestbook note · "+(e.author_name||"Community member"),e.message,new Date(e.created_at).toLocaleString());if(!data?.length)root.textContent=profileId===user.id?"Your guestbook is empty so far.":"This guestbook has no entries yet.";}
$("guestbook-submit").addEventListener("click",async()=>{if(!user){say("guestbook-list","Sign in first.");return;}const username=$("guestbook-username").value.trim().replace(/^@/,"");const message=$("guestbook-message").value.trim();if(!username||!message){say("guestbook-list","Enter a username and message.");return;}const {data:profile,error:lookup}=await db.from("public_profiles").select("id").eq("username",username).maybeSingle();if(lookup||!profile){say("guestbook-list","Couldn't find a public profile with that username.");return;}const {error}=await db.from("guestbook_entries").insert({profile_id:profile.id,author_id:user.id,message});say("guestbook-list",error?error.message:"Guestbook entry posted.");$("guestbook-message").value="";loadGuestbook(profile.id);});
function petPreview(){const species=$("pet-species").value;const accessory=$("pet-accessory").value;say("pet-preview",pets[species]+" "+(accessory==="none"?"":({bow:"🎀",star:"⭐",scarf:"🧣",headphones:"🎧"}[accessory])));}
["pet-species","pet-accessory","pet-color","pet-name"].forEach(id=>$(id).addEventListener(id==="pet-name"?"input":"change",petPreview));
async function loadPet(){if(!user){petPreview();say("hub-auth","Sign in on the Account page to save your companion.");return;}const {data,error}=await db.from("member_pets").select("*").eq("user_id",user.id).maybeSingle();if(error){say("hub-auth","Your account is signed in, but the companion couldn't be loaded.");petPreview();return;}if(data){$("pet-name").value=data.pet_name;$("pet-species").value=data.species;$("pet-color").value=data.color;$("pet-accessory").value=data.accessory;}petPreview();}
$("pet-save").addEventListener("click",async()=>{if(!user){say("hub-auth","Sign in to save your companion.");return;}const button=$("pet-save");button.disabled=true;const values={user_id:user.id,pet_name:$("pet-name").value.trim()||"Sparky",species:$("pet-species").value,color:$("pet-color").value,accessory:$("pet-accessory").value,updated_at:new Date().toISOString()};const {error}=await db.from("member_pets").upsert(values);if(!error){$("pet-name").value=values.pet_name;petPreview();say("hub-auth","Your custom companion has been saved.");}else say("hub-auth","Couldn't save your companion: "+error.message);button.disabled=false;});
async function loadBadges(){const root=$("badge-list");root.replaceChildren();const {data,error}=await db.from("badges").select("name,description,icon").order("name");if(error){root.textContent=error.message;return;}for(const b of data||[])item(root,(b.icon||"✦")+" "+b.name,b.description);if(!data?.length)root.textContent="No badges yet.";}
async function loadStaffFeed(){const root=$("staff-feed");if(!user)return;const {data:role}=await db.from("staff_roles").select("role").eq("user_id",user.id).maybeSingle();if(!role){root.textContent="Staff access required.";return;}root.replaceChildren();const {data,error}=await db.from("moderation_actions").select("action_type,reason,created_at").order("created_at",{ascending:false}).limit(20);if(error){root.textContent="Unable to load staff activity.";return;}for(const a of data||[])item(root,String(a.action_type).replaceAll("_"," "),a.reason||"No reason recorded",new Date(a.created_at).toLocaleString());if(!data?.length)root.textContent="No recent moderation actions.";}
async function loadSecurityCenter(){if(!user)return;const {data:role}=await db.from("staff_roles").select("role").eq("user_id",user.id).maybeSingle();if(!["owner","admin"].includes(role?.role))return;$("security-panel").hidden=false;const root=$("security-events");root.replaceChildren();const {data,error}=await db.from("security_events").select("event_type,source,created_at").order("created_at",{ascending:false}).limit(20);if(error){root.textContent="Unable to load security events.";return;}for(const event of data||[])item(root,String(event.event_type).replaceAll("_"," "),event.source||"Source not recorded",new Date(event.created_at).toLocaleString());if(!data?.length)root.textContent="No recent security events recorded.";}
petPreview();
init();
})();
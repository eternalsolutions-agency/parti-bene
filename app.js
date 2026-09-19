import { APPWRITE_CONFIG, functions } from "./appwrite-config.js";
import { getDestinationImage } from "./destination-images.js";

const cards=document.getElementById("cards");
const filters=document.getElementById("filters");
const empty=document.getElementById("empty");
let professionals=[],activeFilter="all";

function escapeHtml(value=""){return String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));}
function initials(name=""){return name.split(" ").filter(Boolean).map(x=>x[0]).slice(0,2).join("").toUpperCase()||"PB";}
function modeFilter(p){if(activeFilter==="all")return true;if(activeFilter==="online")return p.disponibile_online;if(activeFilter==="local")return Boolean(p.comune);const hay=(p.specializzazioni||[]).join(" ").toLowerCase();return activeFilter==="crociere"?hay.includes("croci"):activeFilter==="nozze"?hay.includes("nozze"):true;}
function renderCards(){
 if(!cards)return;
 const list=professionals.filter(modeFilter).slice(0,6);
 cards.innerHTML=list.map(p=>{
  const tags=[...(p.specializzazioni||[]),...(p.destinazioni||[])].slice(0,3);
  const verified=p.profilo_verificato?"✓ Profilo verificato":"Profilo registrato";
  return '<article class="card"><div class="card-top" style="background-image:url('+getDestinationImage(p.destinazioni,p.nome+" "+(p.descrizione||""))+')"><div class="avatar">'+initials(p.nome)+'</div><div class="verified">'+verified+'</div></div><div class="card-body"><h3>'+escapeHtml(p.nome)+'</h3><div class="meta">'+escapeHtml([p.comune,p.provincia,p.disponibile_online?"Online":null].filter(Boolean).join(" · ")||"Consulenza di viaggio")+'</div><div class="tags">'+tags.map(t=>'<span class="tag">'+escapeHtml(t)+'</span>').join("")+'</div><div class="card-actions"><a class="btn btn-ghost" href="profilo.html?slug='+encodeURIComponent(p.slug)+'">Vedi profilo</a><a class="btn btn-primary" href="richiedi-proposte.html?professionista='+encodeURIComponent(p.slug)+'">Richiedi consulenza</a></div></div></article>';
 }).join("");
 if(empty){empty.style.display=list.length?"none":"block";if(!list.length)empty.innerHTML="<h3>Stiamo selezionando nuovi professionisti</h3><p>Usa il Travel Match: ti mostreremo i profili disponibili e compatibili con il tuo viaggio.</p>";}
}
async function loadProfessionals(){
 try{
  const execution=await functions.createExecution({functionId:APPWRITE_CONFIG.travelRequestFunctionId,body:JSON.stringify({action:"public-professionals"}),async:false,path:"/",method:"POST",headers:{"content-type":"application/json"}});
  const result=JSON.parse(execution.responseBody||"{}");
  if(Number(execution.responseStatusCode||0)>=400)throw new Error();
  professionals=result.items||[];
 }catch(_){professionals=[];}
 renderCards();
}
filters?.addEventListener("click",e=>{const chip=e.target.closest(".chip");if(!chip)return;activeFilter=chip.dataset.filter;filters.querySelectorAll(".chip").forEach(c=>c.classList.toggle("active",c===chip));renderCards();});
document.getElementById("pathGeo")?.addEventListener("click",()=>{location.href="professionisti.html";});
loadProfessionals();

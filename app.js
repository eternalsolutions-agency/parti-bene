
    const professionals = [
      {name:"Orizzonte Viaggi Roma", initials:"OV", image:"https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=900&q=80", city:"Roma", lat:41.9028, lon:12.4964, modes:["local","online"], tags:["Giappone","Tour organizzati","Famiglie"], filters:["local","online"], rating:"Profilo dimostrativo"},
      {name:"Elena Travel Designer", initials:"ET", image:"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80", city:"Milano · Online in tutta Italia", lat:45.4642, lon:9.1900, modes:["online"], tags:["Viaggi di nozze","Maldive","Su misura"], filters:["online","nozze"], rating:"Profilo dimostrativo"},
      {name:"Rotte Blu Crociere", initials:"RB", image:"https://images.unsplash.com/photo-1548574505-5e239809ee19?auto=format&fit=crop&w=900&q=80", city:"Napoli", lat:40.8518, lon:14.2681, modes:["local","online"], tags:["Crociere","Mediterraneo","Gruppi"], filters:["local","online","crociere"], rating:"Profilo dimostrativo"},
      {name:"Toscana Travel Lab", initials:"TL", image:"https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=900&q=80", city:"Firenze", lat:43.7696, lon:11.2558, modes:["local"], tags:["Europa","Weekend","Famiglie"], filters:["local"], rating:"Profilo dimostrativo"},
      {name:"Marco Viaggi Accessibili", initials:"MV", image:"https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=900&q=80", city:"Bologna · Online", lat:44.4949, lon:11.3426, modes:["local","online"], tags:["Turismo accessibile","Italia","Su misura"], filters:["local","online"], rating:"Profilo dimostrativo"},
      {name:"Sicilia Mondo Tour", initials:"SM", image:"https://images.unsplash.com/photo-1489493585363-d69421e0edd3?auto=format&fit=crop&w=900&q=80", city:"Palermo", lat:38.1157, lon:13.3615, modes:["local","online"], tags:["Sicilia","Incoming","Tour di gruppo"], filters:["local","online"], rating:"Profilo dimostrativo"}
    ];
    let activeFilter = "all";
    let userPosition = null;
    let searchTerm = "";

    function distanceKm(a,b,c,d){
      const R=6371, toRad=x=>x*Math.PI/180;
      const dLat=toRad(c-a), dLon=toRad(d-b);
      const q=Math.sin(dLat/2)**2+Math.cos(toRad(a))*Math.cos(toRad(c))*Math.sin(dLon/2)**2;
      return 2*R*Math.asin(Math.sqrt(q));
    }

    function renderCards(){
      const cards=document.getElementById("cards");
      let list=professionals.map(p=>({...p,distance:userPosition?distanceKm(userPosition.lat,userPosition.lon,p.lat,p.lon):null}));
      if(userPosition) list.sort((a,b)=>a.distance-b.distance);
      list=list.filter(p=>{
        const filterOk=activeFilter==="all"||p.filters.includes(activeFilter);
        const hay=(p.name+" "+p.city+" "+p.tags.join(" ")).toLowerCase();
        return filterOk&&(!searchTerm||hay.includes(searchTerm));
      });
      cards.innerHTML=list.map(p=>
        '<article class="card">'+
          '<div class="card-top" style="background-image:url('+p.image+')"><div class="avatar">'+p.initials+'</div><div class="verified">✓ Verificabile</div></div>'+
          '<div class="card-body"><h3>'+p.name+'</h3><div class="meta">'+p.city+' · '+p.rating+'</div>'+
          '<div class="tags">'+p.tags.map(t=>'<span class="tag">'+t+'</span>').join("")+'</div>'+
          '<div class="distance">'+(p.distance!==null?p.distance.toFixed(1)+' km dalla tua posizione':p.modes.includes("online")?'Disponibile anche online':'Disponibile in sede')+'</div>'+
          '<div class="card-actions"><a class="btn btn-ghost" href="profilo.html">Vedi profilo</a><a class="btn btn-primary" href="contatti.html">Preventivo</a></div></div>'+
        '</article>'
      ).join("");
      document.getElementById("empty").style.display=list.length?"none":"block";
    }

    function askPosition(){
      const status=document.getElementById("geoStatus");
      if(!navigator.geolocation){status.textContent="Il tuo browser non supporta la geolocalizzazione.";return}
      status.textContent="Ricerca della posizione in corso…";
      navigator.geolocation.getCurrentPosition(
        pos=>{
          userPosition={lat:pos.coords.latitude,lon:pos.coords.longitude};
          document.getElementById("assistance").value="local";
          activeFilter="local";
          document.querySelectorAll(".chip").forEach(c=>c.classList.toggle("active",c.dataset.filter==="local"));
          status.textContent="Posizione rilevata. I risultati sono ordinati per distanza.";
          renderCards();
          document.getElementById("professionisti").scrollIntoView({behavior:"smooth"});
        },
        err=>{
          const messages={1:"Permesso non concesso. Puoi cercare manualmente per città o CAP.",2:"Posizione non disponibile. Riprova oppure inserisci la città.",3:"La richiesta è scaduta. Riprova tra qualche istante."};
          status.textContent=messages[err.code]||"Non è stato possibile rilevare la posizione.";
        },
        {enableHighAccuracy:false,timeout:10000,maximumAge:300000}
      );
    }

    document.getElementById("geoButton").addEventListener("click",askPosition);
    document.getElementById("pathGeo").addEventListener("click",askPosition);
    document.getElementById("filters").addEventListener("click",e=>{
      if(!e.target.matches(".chip"))return;
      activeFilter=e.target.dataset.filter;
      document.querySelectorAll(".chip").forEach(c=>c.classList.toggle("active",c===e.target));
      renderCards();
    });
    document.getElementById("searchForm").addEventListener("submit",e=>{
      e.preventDefault();
      searchTerm=document.getElementById("destination").value.trim().toLowerCase();
      const assistance=document.getElementById("assistance").value;
      activeFilter=assistance;
      document.querySelectorAll(".chip").forEach(c=>c.classList.toggle("active",c.dataset.filter===activeFilter));
      renderCards();
      document.getElementById("professionisti").scrollIntoView({behavior:"smooth"});
    });
    renderCards();
  
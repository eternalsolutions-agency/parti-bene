import { Client, TablesDB, ID, Query } from "node-appwrite";
import crypto from "node:crypto";

const DATABASE_ID = "6aa8e1a70039d07d09d6";
const PROFESSIONALS_TABLE_ID = "6aa8e22900034b468dc2";
const TRAVEL_REQUESTS_TABLE_ID = "6aa96117003d70271c30";
const ASSIGNMENTS_TABLE_ID = "6aa963d800048778c6e3";
const PROFILE_CLAIMS_TABLE_ID = "6ab15516003be8ca1a02";

function adminClient(req) {
  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
  const project = process.env.APPWRITE_FUNCTION_PROJECT_ID || "6aa8e03b000fb4dd909e";
  // Appwrite exposes the dynamic server key as an execution header and, in
  // current runtimes, as APPWRITE_FUNCTION_API_KEY. Prefer the environment
  // variable because Console executions may not surface the header uniformly.
  const key = process.env.PARTI_BENE_SERVER_API_KEY || process.env.APPWRITE_FUNCTION_API_KEY || req.headers["x-appwrite-key"];
  if (!key) throw new Error("Chiave server Appwrite non disponibile per questa esecuzione.");
  return new Client().setEndpoint(endpoint).setProject(project).setKey(key);
}

function cleanText(value, max = 500) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function travelerSecret() {
  const secret = process.env.PARTI_BENE_TRAVELER_SECRET;
  if (!secret || secret.length < 32) throw new Error("PARTI_BENE_TRAVELER_SECRET non configurato o troppo corto.");
  return secret;
}

function travelerToken(requestId, email) {
  return crypto.createHmac("sha256", travelerSecret()).update(String(requestId) + ":" + String(email).trim().toLowerCase()).digest("base64url");
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a || "")); const y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function publicRequest(request, accepted) {
  const base = {
    $id: request.$id,
    tipologia_viaggio: request.tipologia_viaggio,
    destinazione: request.destinazione,
    partenza_da: request.partenza_da,
    periodo: request.periodo,
    adulti: request.adulti,
    bambini: request.bambini,
    durata: request.durata,
    budget: request.budget,
    assistenza: request.assistenza,
    dettagli: request.dettagli
  };
  if (accepted) {
    base.nome_cliente = request.nome_cliente;
    base.email = request.email;
    base.telefono = request.telefono;
  }
  return base;
}

export default async ({ req, res, error }) => {
  if (req.method !== "POST") return res.json({ error: "Metodo non consentito." }, 405);

  let body;
  try {
    body = req.bodyJson || JSON.parse(req.bodyText || "{}");
  } catch {
    return res.json({ error: "Payload non valido." }, 400);
  }

  const action = body.action || "create";
  // Appwrite injects this header only when an authenticated user invokes the Function.
  // Never trust a user ID supplied in the request body.
  const userId = req.headers["x-appwrite-user-id"] || null;

  try {
    const tables = new TablesDB(adminClient(req));

    if (action === "create") {
      const source = body.request || {};
      const required = ["tipologia_viaggio", "destinazione", "periodo", "assistenza", "nome_cliente", "telefono", "email"];
      if (required.some((key) => !cleanText(source[key], 500))) {
        return res.json({ error: "Completa tutti i campi obbligatori." }, 400);
      }

      const payload = {
        tipologia_viaggio: cleanText(source.tipologia_viaggio, 120),
        destinazione: cleanText(source.destinazione, 180),
        partenza_da: cleanText(source.partenza_da, 180) || "",
        periodo: cleanText(source.periodo, 180),
        adulti: Math.max(1, Number(source.adulti) || 1),
        bambini: Math.max(0, Number(source.bambini) || 0),
        assistenza: cleanText(source.assistenza, 80),
        nome_cliente: cleanText(source.nome_cliente, 180),
        telefono: cleanText(source.telefono, 80),
        email: cleanText(source.email, 254),
        stato: "nuova",
        numero_assegnazioni: 0,
        privacy_accettata: source.privacy_accettata === true
      };
      for (const key of ["durata", "budget", "dettagli", "professionista_preferito"]) {
        const value = cleanText(source[key], key === "dettagli" ? 2000 : 300);
        if (value) payload[key] = value;
      }
      if (!payload.privacy_accettata) return res.json({ error: "È necessario accettare l'informativa privacy." }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return res.json({ error: "Inserisci un indirizzo email valido." }, 400);

      // Lightweight abuse protection without exposing PII or requiring a public table.
      // Block immediate duplicates and excessive submissions from the same contact.
      const recent = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: TRAVEL_REQUESTS_TABLE_ID,
        queries: [Query.orderDesc("$createdAt"), Query.limit(100)]
      });
      const now = Date.now();
      const emailKey = payload.email.toLowerCase();
      const phoneKey = payload.telefono.replace(/\\D/g, "");
      const sameContact = (recent.rows || []).filter(row => {
        const rowEmail = String(row.email || "").trim().toLowerCase();
        const rowPhone = String(row.telefono || "").replace(/\\D/g, "");
        return rowEmail === emailKey || (phoneKey.length >= 7 && rowPhone === phoneKey);
      });
      const immediateDuplicate = sameContact.some(row => now - new Date(row.$createdAt).getTime() < 2 * 60 * 1000);
      if (immediateDuplicate) return res.json({ error: "Questa richiesta risulta già inviata. Attendi qualche minuto prima di riprovare." }, 429);
      const recentCount = sameContact.filter(row => now - new Date(row.$createdAt).getTime() < 30 * 60 * 1000).length;
      if (recentCount >= 4) return res.json({ error: "Hai inviato troppe richieste in poco tempo. Riprova più tardi." }, 429);

      let professional = null;
      if (payload.professionista_preferito) {
        const profiles = await tables.listRows({
          databaseId: DATABASE_ID,
          tableId: PROFESSIONALS_TABLE_ID,
          queries: [
            Query.equal("slug", [payload.professionista_preferito]),
            Query.equal("stato", ["pubblicato"]),
            Query.limit(1)
          ]
        });
        professional = profiles.rows?.[0] || null;
        if (!professional?.utente_id || professional.accetta_richieste === false) return res.json({ error: "Il professionista selezionato non è più disponibile." }, 409);
      }

      const request = await tables.createRow({
        databaseId: DATABASE_ID,
        tableId: TRAVEL_REQUESTS_TABLE_ID,
        rowId: ID.unique(),
        data: payload
      });

      let assignment = null;
      if (professional) {
        assignment = await tables.createRow({
          databaseId: DATABASE_ID,
          tableId: ASSIGNMENTS_TABLE_ID,
          rowId: ID.unique(),
          data: {
            utente_id: professional.utente_id,
            professionista_id: professional.$id,
            richiesta_id: request.$id,
            ordine: 1,
            stato: "nuova",
            letta: false
          }
        });
        await tables.updateRow({
          databaseId: DATABASE_ID,
          tableId: TRAVEL_REQUESTS_TABLE_ID,
          rowId: request.$id,
          data: { numero_assegnazioni: 1 }
        });
      }

      const accessToken = travelerToken(request.$id, payload.email);
      return res.json({ ok: true, requestId: request.$id, accessToken, assigned: Boolean(assignment) }, 201);
    }

    if (action === "traveler-status") {
      const requestId = cleanText(body.requestId, 80);
      const accessToken = cleanText(body.accessToken, 500);
      if (!requestId || !accessToken) return res.json({ error: "Dati di accesso alla richiesta mancanti." }, 400);
      const request = await tables.getRow({ databaseId: DATABASE_ID, tableId: TRAVEL_REQUESTS_TABLE_ID, rowId: requestId });
      const expectedToken = travelerToken(request.$id, request.email || "");
      if (!safeEqual(accessToken, expectedToken)) return res.json({ error: "Richiesta non trovata." }, 404);
      const allAssignments = await tables.listRows({ databaseId: DATABASE_ID, tableId: ASSIGNMENTS_TABLE_ID, queries: [Query.orderDesc("$createdAt"), Query.limit(100)] });
      const related = (allAssignments.rows || []).filter(row => String(row.richiesta_id || "") === String(requestId));
      const professionalIds = [...new Set(related.map(row => row.professionista_id).filter(Boolean))];
      const professionalNames = {};
      for (const id of professionalIds) {
        try { const p = await tables.getRow({databaseId:DATABASE_ID,tableId:PROFESSIONALS_TABLE_ID,rowId:id}); professionalNames[id] = p.nome || "Professionista"; } catch {}
      }
      const assignments = related.map(row => ({
        $id: row.$id,
        stato: row.stato,
        data_risposta: row.data_risposta || null,
        messaggio_professionista: row.stato === "risposta" ? row.messaggio_professionista || "" : null,
        proposta_economica: row.stato === "risposta" ? row.proposta_economica ?? null : null,
        professionista: professionalNames[row.professionista_id] || "Professionista PARTI BENE"
      }));
      return res.json({ ok:true, request:{ $id:request.$id, tipologia_viaggio:request.tipologia_viaggio, destinazione:request.destinazione, partenza_da:request.partenza_da, periodo:request.periodo, adulti:request.adulti, bambini:request.bambini, budget:request.budget, assistenza:request.assistenza, stato:request.stato, numero_assegnazioni:request.numero_assegnazioni, $createdAt:request.$createdAt }, assignments });
    }

    if (action === "public-professionals") {
      const profiles = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: PROFESSIONALS_TABLE_ID,
        queries: [Query.equal("stato", ["pubblicato"]), Query.limit(100)]
      });
      const items = (profiles.rows || []).map(row => ({
        $id: row.$id,
        nome: row.nome,
        tipologia: row.tipologia,
        slug: row.slug,
        descrizione: row.descrizione,
        comune: row.comune,
        provincia: row.provincia,
        disponibile_online: Boolean(row.disponibile_online),
        cliente_ideale: row.cliente_ideale || [],
        fasce_budget: row.fasce_budget || [],
        accetta_richieste: row.accetta_richieste !== false,
        specializzazioni: row.specializzazioni || [],
        destinazioni: row.destinazioni || [],
        profilo_verificato: Boolean(row.profilo_verificato),
        profilo_rivendicato: Boolean(row.profilo_rivendicato),
        stato: "pubblicato"
      }));
      return res.json({ ok: true, items });
    }

    if (action === "create-profile-claim") {
      if (!userId) return res.json({ error: "Accedi o crea un account PARTI BENE prima di rivendicare il profilo.", code: "CLAIM_AUTH_REQUIRED" }, 401);
      const source = body.claim || {};
      const professionalId = cleanText(source.professionista_id, 80);
      const professionalSlug = cleanText(source.professionista_slug, 150);
      const name = cleanText(source.nome_richiedente, 180);
      const role = cleanText(source.ruolo, 80);
      const email = cleanText(source.email, 254);
      const phone = cleanText(source.telefono, 50);
      const verification = cleanText(source.verifica, 2000);
      if (!professionalId || !professionalSlug || !name || !role || !email || !phone || !verification) {
        return res.json({ error: "Completa tutti i campi obbligatori." }, 400);
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.json({ error: "Inserisci un indirizzo email valido." }, 400);
      const professional = await tables.getRow({databaseId:DATABASE_ID,tableId:PROFESSIONALS_TABLE_ID,rowId:professionalId});
      if (professional.slug !== professionalSlug || professional.stato !== "pubblicato") return res.json({ error: "Il profilo indicato non è disponibile." }, 404);
      if (professional.profilo_rivendicato === true || professional.utente_id) return res.json({ error: "Questo profilo risulta già gestito dal professionista." }, 409);
      const recent = await tables.listRows({databaseId:DATABASE_ID,tableId:PROFILE_CLAIMS_TABLE_ID,queries:[Query.orderDesc("$createdAt"),Query.limit(100)]});
      const duplicate=(recent.rows||[]).some(row=>String(row.professionista_id)===String(professionalId)&&["in_attesa","da_integrare"].includes(row.stato));
      if(duplicate) return res.json({ error: "Esiste già una richiesta di rivendicazione in lavorazione per questo profilo." }, 409);
      const data={
        professionista_id:professional.$id,
        professionista_slug:professional.slug,
        nome_attivita:professional.nome,
        nome_richiedente:name,
        ruolo:role,
        email,
        telefono:phone,
        verifica:verification,
        stato:"in_attesa"
      };
      const website=cleanText(source.sito_web,500); if(website)data.sito_web=website;
      if(userId)data.utente_id=userId;
      const claim=await tables.createRow({databaseId:DATABASE_ID,tableId:PROFILE_CLAIMS_TABLE_ID,rowId:ID.unique(),data});
      return res.json({ok:true,claimId:claim.$id},201);
    }

    if (!userId) return res.json({ error: "Accedi come professionista per continuare." }, 401);

    if (action === "my-profile") {
      const profiles = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: PROFESSIONALS_TABLE_ID,
        queries: [Query.limit(100)]
      });
      const profile = (profiles.rows || []).find(row => String(row.utente_id || "") === String(userId));
      if (!profile) return res.json({ error: "Profilo professionale non trovato." }, 404);
      return res.json({ ok: true, profile });
    }

    if (action === "update-profile") {
      const profiles = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: PROFESSIONALS_TABLE_ID,
        queries: [Query.limit(100)]
      });
      const profile = (profiles.rows || []).find(row => String(row.utente_id || "") === String(userId));
      if (!profile) return res.json({ error: "Profilo professionale non trovato." }, 404);
      const source = body.profile || {};
      const existingPreference = String(profile.descrizione || "").match(/\[Preferenza richieste:\s*(free|paid|both)\]/i)?.[1] || "both";
      const requestedPreference = ["free","paid","both"].includes(source.request_preference) ? source.request_preference : existingPreference;
      let description = cleanText(source.descrizione, 2000) || "";
      description = description.replace(/\s*\[Preferenza richieste:\s*(free|paid|both)\]\s*/gi, " ").trim();
      description += (description ? "\n\n" : "") + "[Preferenza richieste: " + requestedPreference + "]";
      const data = {
        nome: cleanText(source.nome, 180) || profile.nome,
        comune: cleanText(source.comune, 120),
        provincia: cleanText(source.provincia, 20),
        descrizione: description,
        specializzazioni: Array.isArray(source.specializzazioni) ? source.specializzazioni.map(v => cleanText(v, 100)).filter(Boolean).slice(0, 30) : [],
        destinazioni: Array.isArray(source.destinazioni) ? source.destinazioni.map(v => cleanText(v, 100)).filter(Boolean).slice(0, 50) : [],
        disponibile_online: source.disponibile_online === true,
        cliente_ideale: Array.isArray(source.cliente_ideale) ? source.cliente_ideale.map(v => cleanText(v, 50)).filter(Boolean).slice(0, 12) : (profile.cliente_ideale || []),
        fasce_budget: Array.isArray(source.fasce_budget) ? source.fasce_budget.map(v => cleanText(v, 30)).filter(Boolean).slice(0, 8) : (profile.fasce_budget || []),
        accetta_richieste: source.accetta_richieste !== false
      };
      const updated = await tables.updateRow({databaseId:DATABASE_ID,tableId:PROFESSIONALS_TABLE_ID,rowId:profile.$id,data});
      return res.json({ ok: true, profile: updated });
    }

    if (action === "list") {
      // Avoid relying on a table index/query for utente_id while the schema is
      // still being finalized. Read the small assignment set server-side and
      // filter by the authenticated professional ID.
      const assignments = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: ASSIGNMENTS_TABLE_ID,
        queries: [Query.orderDesc("$createdAt"), Query.limit(100)]
      });
      const ownedAssignments = (assignments.rows || []).filter(row => String(row.utente_id || "") === String(userId));
      const items = [];
      for (const assignment of ownedAssignments) {
        const request = await tables.getRow({
          databaseId: DATABASE_ID,
          tableId: TRAVEL_REQUESTS_TABLE_ID,
          rowId: assignment.richiesta_id
        });
        const accepted = ["accettata", "risposta"].includes(assignment.stato);
        items.push({ assignment, request: publicRequest(request, accepted) });
      }
      return res.json({ ok: true, items });
    }

    if (action === "update") {
      const assignmentId = cleanText(body.assignmentId, 80);
      if (!assignmentId) return res.json({ error: "Assegnazione mancante." }, 400);
      const assignment = await tables.getRow({
        databaseId: DATABASE_ID,
        tableId: ASSIGNMENTS_TABLE_ID,
        rowId: assignmentId
      });
      if (assignment.utente_id !== userId) return res.json({ error: "Operazione non autorizzata." }, 403);

      const status = cleanText(body.status, 40);
      if (!["accettata", "rifiutata", "risposta"].includes(status)) {
        return res.json({ error: "Stato non valido." }, 400);
      }
      const update = { stato: status, letta: true, data_risposta: new Date().toISOString() };
      if (status === "rifiutata") update.messaggio_professionista = "Motivo rifiuto: " + (cleanText(body.message, 1000) || "Richiesta non compatibile");
      if (status === "risposta") {
        update.messaggio_professionista = cleanText(body.message, 2000) || "";
        if (body.price !== "" && body.price !== null && body.price !== undefined) update.proposta_economica = Number(body.price) || 0;
      }
      const updated = await tables.updateRow({
        databaseId: DATABASE_ID,
        tableId: ASSIGNMENTS_TABLE_ID,
        rowId: assignmentId,
        data: update
      });
      const request = await tables.getRow({
        databaseId: DATABASE_ID,
        tableId: TRAVEL_REQUESTS_TABLE_ID,
        rowId: assignment.richiesta_id
      });
      return res.json({ ok: true, assignment: updated, request: publicRequest(request, ["accettata", "risposta"].includes(updated.stato)) });
    }

    return res.json({ error: "Azione non riconosciuta." }, 400);
  } catch (err) {
    error(err?.message || String(err));
    return res.json({ error: "Si è verificato un errore durante l'elaborazione della richiesta." }, 500);
  }
};

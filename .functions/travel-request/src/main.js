import { Client, TablesDB, ID, Query } from "node-appwrite";

const DATABASE_ID = "6aa8e1a70039d07d09d6";
const PROFESSIONALS_TABLE_ID = "6aa8e22900034b468dc2";
const TRAVEL_REQUESTS_TABLE_ID = "6aa96117003d70271c30";
const ASSIGNMENTS_TABLE_ID = "6aa963d800048778c6e3";

function adminClient(req) {
  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
  const project = process.env.APPWRITE_FUNCTION_PROJECT_ID || "6aa8e03b000fb4dd909e";
  // Appwrite exposes the dynamic server key as an execution header and, in
  // current runtimes, as APPWRITE_FUNCTION_API_KEY. Prefer the environment
  // variable because Console executions may not surface the header uniformly.
  const key = process.env.APPWRITE_FUNCTION_API_KEY || req.headers["x-appwrite-key"];
  if (!key) throw new Error("Chiave server Appwrite non disponibile per questa esecuzione.");
  return new Client().setEndpoint(endpoint).setProject(project).setKey(key);
}

function cleanText(value, max = 500) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
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
        if (!professional?.utente_id) return res.json({ error: "Il professionista selezionato non è più disponibile." }, 409);
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
            richiesta_id: request.$id,
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

      return res.json({ ok: true, requestId: request.$id, assigned: Boolean(assignment) }, 201);
    }

    if (!userId) return res.json({ error: "Accedi come professionista per continuare." }, 401);

    if (action === "list") {
      const assignments = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: ASSIGNMENTS_TABLE_ID,
        queries: [Query.equal("utente_id", [userId]), Query.orderDesc("$createdAt"), Query.limit(50)]
      });
      const items = [];
      for (const assignment of assignments.rows || []) {
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
    const cause = err?.cause;
    const diagnostic = {
      name: err?.name || null,
      message: err?.message || String(err),
      causeName: cause?.name || null,
      causeMessage: cause?.message || null,
      causeCode: cause?.code || null,
      endpoint: process.env.APPWRITE_FUNCTION_API_ENDPOINT || null,
      hasDynamicKey: Boolean(process.env.APPWRITE_FUNCTION_API_KEY || req.headers["x-appwrite-key"]),
      hasProjectId: Boolean(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    };
    error(JSON.stringify(diagnostic));
    return res.json({ error: diagnostic.message, diagnostic }, 500);
  }
};

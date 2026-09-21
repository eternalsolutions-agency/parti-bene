import {
  Client,
  Account,
  TablesDB,
  Storage,
  Functions,
  ID,
  Permission,
  Role
} from "https://cdn.jsdelivr.net/npm/appwrite/+esm";

export const APPWRITE_CONFIG = Object.freeze({
  endpoint: "https://fra.cloud.appwrite.io/v1",
  projectId: "6aa8e03b000fb4dd909e",
  databaseId: "6aa8e1a70039d07d09d6",
  professionalsTableId: "6aa8e22900034b468dc2",
  applicationsTableId: "6aa8e72c0018ffbfe9f5",
  offersTableId: "6aa9582c00030c21a118",
  travelRequestsTableId: "6aa96117003d70271c30",
  requestAssignmentsTableId: "6aa963d800048778c6e3",
  profileClaimsTableId: "6ab15516003be8ca1a02",
  travelRequestFunctionId: "6aad49000033688eb237",
  mediaBucketId: "6aa8ea22003dda7c03ca"
});

export const client = new Client()
  .setEndpoint(APPWRITE_CONFIG.endpoint)
  .setProject(APPWRITE_CONFIG.projectId);

export const account = new Account(client);
export const tablesDB = new TablesDB(client);
export const storage = new Storage(client);
export const functions = new Functions(client);
export { ID, Permission, Role };

export function readableError(error) {
  if (!error) return "Si è verificato un errore. Riprova.";
  if (error.code === 401 && error.type === "user_invalid_credentials") return "Email o password non corrette.";
  if (error.code === 401) return error.message || "Non hai i permessi necessari per completare questa operazione.";
  if (error.code === 409) return "Esiste già un account associato a questa email.";
  if (error.code === 429) return "Troppi tentativi ravvicinati. Attendi qualche minuto e riprova.";
  return error.message || "Si è verificato un errore. Riprova.";
}

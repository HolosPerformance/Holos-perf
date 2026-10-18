import { createClient } from '@supabase/supabase-js';

// ─── Client Supabase ──────────────────────────────────────────────────────────
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseRaw = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// ─── Table map ────────────────────────────────────────────────────────────────
const TABLE_MAP = {
  User:                    'profiles',
  AthleteProfile:          'athlete_profiles',
  Club:                    'clubs',
  Team:                    'teams',
  Group:                   'groups',
  QuestionnaireTemplate:   'questionnaire_templates',
  QuestionnaireResponse:   'questionnaire_responses',
  QuestionBankItem:        'question_bank_items',
  TrainingLog:             'training_logs',
  Event:                   'events',
  SessionDocument:         'session_documents',
  Message:                 'messages',
  CoachBranding:           'coach_branding',
  StravaToken:             'strava_tokens',
  UserPreference:          'user_preferences',
  AppSetting:              'app_settings',
  Injury:                  'injuries',
};

function parseOrder(orderStr) {
  if (!orderStr) return null;
  const desc = orderStr.startsWith('-');
  return { column: desc ? orderStr.slice(1) : orderStr, ascending: !desc };
}

const realtimeChannels = new Map();

const PAGE_SIZE = 1000;
const IN_CHUNK_SIZE = 50;

/**
 * Lit une requête page par page, jusqu'à `limit` lignes ou épuisement.
 *
 * Supabase plafonne chaque réponse à `max_rows` lignes, 1000 par défaut.
 * Une requête simple tronquait donc silencieusement dès qu'une table dépassait
 * ce seuil : aucune erreur, juste les premières lignes de l'ordre demandé. Les
 * totaux affichés aux coachs étaient faussés et les exports incomplets.
 *
 * Le tri est complété par `id` pour départager les égalités : sans cet ordre
 * stable, une même ligne pourrait apparaître sur deux pages, ou n'apparaître
 * sur aucune.
 *
 * @param {() => object} construireRequete  fabrique une requête neuve à chaque page
 * @param {number|null}  limit              nombre maximum de lignes, null = toutes
 * @param {string}       contexte           préfixe des messages d'erreur
 */
async function lireParPages(construireRequete, limit, contexte) {
  const lignes = [];
  for (let debut = 0; ; debut += PAGE_SIZE) {
    const restant = limit == null ? PAGE_SIZE : Math.min(PAGE_SIZE, limit - lignes.length);
    if (restant <= 0) break;

    const { data, error } = await construireRequete()
      .order('id', { ascending: true })
      .range(debut, debut + restant - 1);

    if (error) throw new Error(`[${contexte}: ${error.message}`);
    lignes.push(...(data || []));
    if (!data || data.length < restant) break;
  }
  return lignes;
}

function makeEntity(entityName) {
  const table = TABLE_MAP[entityName];
  if (!table) { console.warn(`Entité inconnue : ${entityName}`); return null; }

  return {
    // `limit` null = toutes les lignes. Voir lireParPages ci-dessus : une requête
    // simple tronquait silencieusement au-delà de 1000 lignes.
    async list(orderBy = '-created_at', limit = null) {
      const order = parseOrder(orderBy);
      return lireParPages(() => {
        let q = supabaseRaw.from(table).select('*');
        if (order) q = q.order(order.column, { ascending: order.ascending });
        return q;
      }, limit, `${table}] list`);
    },

    async filter(conditions = {}, orderBy = '-created_at', limit = null) {
      const order = parseOrder(orderBy);
      return lireParPages(() => {
        let q = supabaseRaw.from(table).select('*');
        for (const [col, val] of Object.entries(conditions)) q = q.eq(col, val);
        if (order) q = q.order(order.column, { ascending: order.ascending });
        return q;
      }, limit, `${table}] filter`);
    },

    // Toutes les lignes dont `column` vaut l'une des `values`, sans limite :
    // valeurs découpées en lots (longueur de l'URL) et résultats lus par pages
    // (Supabase plafonne chaque réponse à 1000 lignes).
    // `range` (optionnel) : { column, from, to } bornes incluses, ex. sur une date.
    async filterIn(column, values = [], orderBy = '-created_at', range = null) {
      const unique = [...new Set(values)].filter(Boolean);
      if (unique.length === 0) return [];
      const order = parseOrder(orderBy);
      const rows = [];
      for (let i = 0; i < unique.length; i += IN_CHUNK_SIZE) {
        const chunk = unique.slice(i, i + IN_CHUNK_SIZE);
        for (let from = 0; ; from += PAGE_SIZE) {
          let q = supabaseRaw.from(table).select('*').in(column, chunk);
          if (range?.from != null) q = q.gte(range.column, range.from);
          if (range?.to != null) q = q.lte(range.column, range.to);
          if (order) q = q.order(order.column, { ascending: order.ascending });
          q = q.order('id', { ascending: true }).range(from, from + PAGE_SIZE - 1);
          const { data, error } = await q;
          if (error) throw new Error(`[${table}] filterIn: ${error.message}`);
          rows.push(...(data || []));
          if (!data || data.length < PAGE_SIZE) break;
        }
      }
      if (order) {
        const dir = order.ascending ? 1 : -1;
        rows.sort((a, b) => (a[order.column] < b[order.column] ? -dir : a[order.column] > b[order.column] ? dir : 0));
      }
      return rows;
    },

    async get(id) {
      const { data, error } = await supabaseRaw
        .from(table).select('*').eq('id', id).single();
      if (error) throw new Error(`[${table}] get: ${error.message}`);
      return data;
    },

    async create(payload) {
      const { data, error } = await supabaseRaw.from(table).insert(payload).select().single();
      if (error) throw new Error(`[${table}] create: ${error.message}`);
      return data;
    },

    async bulkCreate(rows) {
      const { data, error } = await supabaseRaw.from(table).insert(rows).select();
      if (error) throw new Error(`[${table}] bulkCreate: ${error.message}`);
      return data;
    },

    async update(id, payload) {
      const { data, error } = await supabaseRaw
        .from(table).update(payload).eq('id', id).select();
      if (error) throw new Error(`[${table}] update: ${error.message}`);
      if (!data || data.length === 0) throw new Error(`[${table}] update: accès refusé par les règles de sécurité (RLS). Vérifiez les policies Supabase.`);
      return data[0];
    },

    async delete(id) {
      const { error } = await supabaseRaw.from(table).delete().eq('id', id);
      if (error) throw new Error(`[${table}] delete: ${error.message}`);
      return { success: true };
    },

    subscribe(callback) {
      const channelName = `${table}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const channel = supabaseRaw
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
          const typeMap = { INSERT: 'create', UPDATE: 'update', DELETE: 'delete' };
          callback({
            type: typeMap[payload.eventType] || payload.eventType.toLowerCase(),
            data: payload.new || payload.old,
            old: payload.old,
          });
        })
        .subscribe();
      realtimeChannels.set(channelName, channel);
      return () => { supabaseRaw.removeChannel(channel); realtimeChannels.delete(channelName); };
    },
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
const auth = {
  async me() {
    const { data: { user }, error } = await supabaseRaw.auth.getUser();
    if (error || !user) throw new Error('Non authentifié');
    const { data: profile, error: profileError } = await supabaseRaw
      .from('profiles').select('*').eq('id', user.id).single();
    if (profileError) throw new Error(profileError.message);
    return { id: user.id, email: user.email, ...profile };
  },

  async updateMe(updates) {
    const { data: { user } } = await supabaseRaw.auth.getUser();
    if (!user) throw new Error('Non authentifié');
    const { error } = await supabaseRaw
      .from('profiles').update(updates).eq('id', user.id);
    if (error) throw new Error(error.message);
    const { data } = await supabaseRaw
      .from('profiles').select('*').eq('id', user.id).single();
    return data || updates;
  },

  async isAuthenticated() {
    const { data: { session } } = await supabaseRaw.auth.getSession();
    return !!session;
  },

  async logout() { await supabaseRaw.auth.signOut(); },
  redirectToLogin() { window.location.href = '/'; },
};

// ─── Functions ────────────────────────────────────────────────────────────────
const functions = {
  async invoke(name, payload = {}) {
    const { data, error } = await supabaseRaw.functions.invoke(name, { body: payload });
    if (error) throw new Error(error.message);
    return { data };
  },
};

// ─── Export ───────────────────────────────────────────────────────────────────
export const supabase = {
  entities: new Proxy({}, { get(_, name) { return makeEntity(name); } }),
  auth,
  functions,
};

export default supabase;

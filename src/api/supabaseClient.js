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
};

function parseOrder(orderStr) {
  if (!orderStr) return null;
  const desc = orderStr.startsWith('-');
  return { column: desc ? orderStr.slice(1) : orderStr, ascending: !desc };
}

const realtimeChannels = new Map();

function makeEntity(entityName) {
  const table = TABLE_MAP[entityName];
  if (!table) { console.warn(`Entité inconnue : ${entityName}`); return null; }

  return {
    async list(orderBy = '-created_at', limit = 1000) {
      const order = parseOrder(orderBy);
      let q = supabaseRaw.from(table).select('*').limit(limit);
      if (order) q = q.order(order.column, { ascending: order.ascending });
      const { data, error } = await q;
      if (error) throw new Error(`[${table}] list: ${error.message}`);
      return data || [];
    },

    async filter(conditions = {}, orderBy = '-created_at', limit = 1000) {
      let q = supabaseRaw.from(table).select('*').limit(limit);
      for (const [col, val] of Object.entries(conditions)) q = q.eq(col, val);
      const order = parseOrder(orderBy);
      if (order) q = q.order(order.column, { ascending: order.ascending });
      const { data, error } = await q;
      if (error) throw new Error(`[${table}] filter: ${error.message}`);
      return data || [];
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

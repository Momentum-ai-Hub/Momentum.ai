// app/api/portfolio/route.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET() {
  const { data, error } = await supabase
    .from('portfolio_tickers')
    .select('*')
    .order('secteur', { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Grouper par secteur + dédoublonner
  const grouped = (data || []).reduce((acc, row) => {
    if (!acc[row.secteur]) acc[row.secteur] = [];
    if (!acc[row.secteur].includes(row.name)) {
      acc[row.secteur].push(row.name);
    }
    return acc;
  }, {});

  return Response.json({ data: grouped, raw: data });
}

export async function POST(request) {
  const { tickers } = await request.json();

  const rows = tickers.map(t => ({
    ticker:                 t.ticker,
    name:                   t.name,
    secteur:                t.secteur,
    bourse:                 t.bourse                 || 'AUTRE',
    type:                   t.type                   || 'TITRE DE FOND',
    driver_principal:       t.driver_principal       || '',
    earnings_play:          t.earnings_play          ?? false,
    already_priced_in_risk: t.already_priced_in_risk ?? false,
    matieres_premieres:     t.matieres_premieres     ?? [],
  }));

  const { error } = await supabase
    .from('portfolio_tickers')
    .upsert(rows, { onConflict: 'ticker' });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true, count: rows.length });
}

export async function DELETE(request) {
  const { tickers } = await request.json();

  const { error } = await supabase
    .from('portfolio_tickers')
    .delete()
    .in('ticker', tickers);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}

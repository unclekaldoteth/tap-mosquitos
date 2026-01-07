import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY in environment.');
  process.exit(1);
}

const args = process.argv.slice(2);
const shouldCommit = args.includes('--commit');
const weekArg = args.find((arg) => arg.startsWith('--week='));
const targetWeek = weekArg ? weekArg.split('=')[1] : null;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const normalizeAddress = (address) => (typeof address === 'string' ? address.toLowerCase() : null);

const sanitizeUsername = (username) => {
  if (typeof username !== 'string') return null;
  const trimmed = username.trim();
  if (!trimmed) return null;
  const normalized = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  if (!normalized || normalized.toLowerCase() === 'connected') return null;
  return normalized;
};

const normalizeUsername = (username) => {
  const sanitized = sanitizeUsername(username);
  return sanitized ? sanitized.toLowerCase() : null;
};

const fetchAllRows = async () => {
  const pageSize = 1000;
  let from = 0;
  let allRows = [];
  while (true) {
    let query = supabase.from('leaderboard').select('*').order('id', { ascending: true }).range(from, from + pageSize - 1);
    if (targetWeek) {
      query = query.eq('week_start', targetWeek);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch leaderboard rows: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allRows;
};

const groupRows = (rows) => {
  const groups = new Map();
  for (const row of rows) {
    const normalizedUsername = normalizeUsername(row.username);
    const normalizedAddress = row.wallet_address ? normalizeAddress(row.wallet_address) : null;
    const key = `${row.week_start || 'unknown'}|${normalizedUsername ? `u:${normalizedUsername}` : normalizedAddress ? `a:${normalizedAddress}` : `id:${row.id}`}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(row);
  }
  return groups;
};

const pickKeeper = (rows) => {
  return rows.reduce((best, row) => {
    if (!best) return row;
    const bestScore = best.score || 0;
    const rowScore = row.score || 0;
    if (rowScore !== bestScore) {
      return rowScore > bestScore ? row : best;
    }
    const bestTime = best.created_at ? new Date(best.created_at).getTime() : 0;
    const rowTime = row.created_at ? new Date(row.created_at).getTime() : 0;
    return rowTime > bestTime ? row : best;
  }, null);
};

const buildMerge = (rows, keeper) => {
  const mergedScore = rows.reduce((sum, row) => sum + (row.score || 0), 0);
  const mergedTapped = rows.reduce((sum, row) => sum + (row.tapped || 0), 0);
  const mergedBestCombo = rows.reduce((max, row) => Math.max(max, row.best_combo || 0), 0);
  const mergedUsername = sanitizeUsername(keeper.username) || sanitizeUsername(rows.find(r => r.username)?.username);
  const mergedAddress = keeper.wallet_address ? normalizeAddress(keeper.wallet_address) : null;

  return {
    id: keeper.id,
    wallet_address: mergedAddress || keeper.wallet_address || null,
    username: mergedUsername,
    score: mergedScore,
    tapped: mergedTapped,
    best_combo: mergedBestCombo || 1,
  };
};

const run = async () => {
  console.log(`Leaderboard cleanup ${shouldCommit ? 'COMMIT' : 'DRY RUN'}${targetWeek ? ` for week ${targetWeek}` : ''}`);
  const rows = await fetchAllRows();
  const groups = groupRows(rows);

  let duplicates = 0;
  let updates = 0;
  let deletions = 0;

  for (const groupRows of groups.values()) {
    if (groupRows.length <= 1) continue;
    duplicates += groupRows.length - 1;

    const keeper = pickKeeper(groupRows);
    const merge = buildMerge(groupRows, keeper);
    const deleteIds = groupRows.filter(row => row.id !== keeper.id).map(row => row.id);

    const needsUpdate = (
      merge.wallet_address !== keeper.wallet_address ||
      merge.username !== keeper.username ||
      merge.score !== keeper.score ||
      merge.tapped !== keeper.tapped ||
      merge.best_combo !== keeper.best_combo
    );

    if (needsUpdate) {
      updates++;
      if (shouldCommit) {
        const { error } = await supabase
          .from('leaderboard')
          .update({
            wallet_address: merge.wallet_address,
            username: merge.username,
            score: merge.score,
            tapped: merge.tapped,
            best_combo: merge.best_combo,
          })
          .eq('id', keeper.id);
        if (error) {
          throw new Error(`Failed to update row ${keeper.id}: ${error.message}`);
        }
      }
    }

    if (deleteIds.length) {
      deletions += deleteIds.length;
      if (shouldCommit) {
        const { error } = await supabase
          .from('leaderboard')
          .delete()
          .in('id', deleteIds);
        if (error) {
          throw new Error(`Failed to delete rows [${deleteIds.join(', ')}]: ${error.message}`);
        }
      }
    }
  }

  console.log(`Groups checked: ${groups.size}`);
  console.log(`Duplicate rows found: ${duplicates}`);
  console.log(`Rows to update: ${updates}`);
  console.log(`Rows to delete: ${deletions}`);
  if (!shouldCommit) {
    console.log('Dry run complete. Re-run with --commit to apply changes.');
  }
};

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

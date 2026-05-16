// ============================================
// Task Views API - sledi kdaj je uporabnik
// nazadnje odprl/pogledal nalogo
// ============================================

import { supabase } from '../supabase.js';

// Vrne map: { task_id: last_viewed_at ISO string }
export async function getMyTaskViews(userEmail) {
  if (!userEmail) return {};
  try {
    const { data, error } = await supabase
      .from('task_views')
      .select('task_id, last_viewed_at')
      .eq('user_email', userEmail);
    if (error) throw error;
    const map = {};
    (data || []).forEach(v => {
      map[v.task_id] = v.last_viewed_at;
    });
    return map;
  } catch (e) {
    console.error('Error loading task views:', e);
    return {};
  }
}

// Zabeleži, da je uporabnik pravkar pogledal nalogo
export async function markTaskAsViewed(taskId, userEmail) {
  if (!taskId || !userEmail) return;
  try {
    const { error } = await supabase
      .from('task_views')
      .upsert(
        { task_id: taskId, user_email: userEmail, last_viewed_at: new Date().toISOString() },
        { onConflict: 'task_id,user_email' }
      );
    if (error) throw error;
  } catch (e) {
    console.error('Error marking task as viewed:', e);
  }
}

// Šteje neprebrane komentarje za dano nalogo glede na uporabnikov last_viewed_at
export function countUnreadComments(task, userEmail, lastViewedAt) {
  if (!task?.comments || !Array.isArray(task.comments)) return 0;
  if (!userEmail) return 0;
  return task.comments.filter(c => {
    // Lasten komentar se NE šteje
    if (c.author_email === userEmail) return false;
    // Če nikoli ni odprl naloge → vsak tuj komentar je nov
    if (!lastViewedAt) return true;
    // Sicer: šteje samo komentarje novejše od last_viewed_at
    return new Date(c.created_at) > new Date(lastViewedAt);
  }).length;
}

import { supabase } from './supabase';
import { CallLogRecord, CallType, UserRole } from '../types';

export function formatCallDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

export interface RecordCallParams {
  callId?: string;
  caller_role: UserRole;
  receiver_role: UserRole;
  call_type: CallType;
  status: 'completed' | 'missed' | 'rejected' | 'declined' | 'busy';
  duration: number; // in seconds
  started_at?: number | string;
}

/**
 * Persists a completed, missed, or rejected call to both:
 * 1. public.call_logs table (for persistent history log in 3-dots menu)
 * 2. public.messages table (for in-chat WhatsApp-style notification)
 */
export async function recordCallCompletion({
  callId,
  caller_role,
  receiver_role,
  call_type,
  status,
  duration,
  started_at,
}: RecordCallParams): Promise<void> {
  const roundedDuration = Math.max(0, Math.floor(duration));
  const startedIso = started_at
    ? typeof started_at === 'number'
      ? new Date(started_at).toISOString()
      : started_at
    : new Date().toISOString();
  const endedIso = new Date().toISOString();

  // 1. Insert into persistent call_logs table
  try {
    const { error: logError } = await supabase.from('call_logs').insert([
      {
        caller_role,
        receiver_role,
        call_type,
        status,
        duration: roundedDuration,
        started_at: startedIso,
        ended_at: endedIso,
        created_at: endedIso,
      },
    ]);
    if (logError) {
      console.warn('[CallLogService] Notice inserting call log:', logError);
    }
  } catch (err) {
    console.warn('[CallLogService] Exception inserting call log:', err);
  }

  // 2. Insert WhatsApp-style call bubble into messages table
  try {
    const callText =
      status === 'completed'
        ? `${call_type === 'video' ? '📹 Video' : '📞 Voice'} call • ${formatCallDuration(roundedDuration)}`
        : status === 'missed'
        ? `Missed ${call_type} call`
        : status === 'busy'
        ? `Busy on another call`
        : `Declined ${call_type} call`;

    const { error: msgError } = await supabase.from('messages').insert([
      {
        sender_role: caller_role,
        text: callText,
        created_at: endedIso,
        reactions: {},
        call_log: {
          callId: callId || `call_${Date.now()}`,
          type: call_type,
          status,
          duration: roundedDuration,
          caller_role,
          receiver_role,
        },
      },
    ]);
    if (msgError) {
      console.warn('[CallLogService] Notice inserting in-chat call message:', msgError);
    }
  } catch (err) {
    console.warn('[CallLogService] Exception inserting in-chat call message:', err);
  }
}

/**
 * Fetch all or filtered call logs ordered by newest first
 */
export async function fetchCallLogs(filterType?: 'all' | 'voice' | 'video'): Promise<CallLogRecord[]> {
  try {
    let query = supabase
      .from('call_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (filterType && filterType !== 'all') {
      query = query.eq('call_type', filterType);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[CallLogService] Error fetching call logs:', error);
      return [];
    }
    return (data as CallLogRecord[]) || [];
  } catch (err) {
    console.warn('[CallLogService] Exception fetching call logs:', err);
    return [];
  }
}

/**
 * Delete a single call log entry
 */
export async function deleteCallLog(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('call_logs').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Clear all call logs
 */
export async function clearAllCallLogs(): Promise<boolean> {
  try {
    const { error } = await supabase.from('call_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    return !error;
  } catch {
    return false;
  }
}

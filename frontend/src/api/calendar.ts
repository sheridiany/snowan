// Calendar (日历) client for /api/calendar. Mirrors QwenPaw's proven local-first
// design: the macOS system Calendar is read via AppleScript on the backend (it
// already aggregates iCloud / Gmail / Outlook locally), and .ics text can be
// imported. No OAuth, no cloud — sources + events live in ~/.snowan.
import { api } from './base';

export type CalendarSource = {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string | null;
};

export type CalendarEvent = {
  id: string;
  sourceId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  calendarName: string;
  location: string;
  notes: string;
  attendees?: string[];
  url: string;
  updatedAt: string;
};

export type CalendarData = {
  sources: CalendarSource[];
  events: CalendarEvent[];
  syncStatus?: string;
  syncError?: string;
};

const j = <T>(r: Response): Promise<T> => {
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};

const post = <T>(path: string, body?: unknown): Promise<T> =>
  fetch(api(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  }).then((r) => j<T>(r));

export const getCalendar = () => fetch(api('/api/calendar/sources')).then((r) => j<CalendarData>(r));

export const syncSystem = () => post<CalendarData>('/api/calendar/sync-system');

export const importIcs = (sourceName: string, icsText: string) =>
  // Backend request body is snake_case (server/calendar.py ImportIcsBody);
  // the response payload is camelCase, matching the types above.
  post<CalendarData>('/api/calendar/import-ics', { source_name: sourceName, ics_text: icsText });

// --- formatting helpers (ported from QwenPaw's calendarFormat) ---

export function cleanCalendarField(value?: string | null): string {
  const text = value?.trim() || '';
  return text === 'missing value' ? '' : text;
}

export function formatTimeRange(startsAt?: string, endsAt?: string): string {
  if (!startsAt) return '';
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : null;
  if (Number.isNaN(start.getTime())) return startsAt;
  const allDay =
    start.getHours() === 0 &&
    start.getMinutes() === 0 &&
    end &&
    !Number.isNaN(end.getTime()) &&
    end.getHours() === 23 &&
    end.getMinutes() === 59;
  if (allDay) return '全天';
  const fmt = (d: Date) => d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return end && !Number.isNaN(end.getTime()) ? `${fmt(start)} - ${fmt(end)}` : fmt(start);
}

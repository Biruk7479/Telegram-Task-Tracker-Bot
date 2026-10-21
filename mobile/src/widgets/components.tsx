// Home-screen widgets, built from react-native-android-widget primitives.
// Every widget takes the same data and its own size (in dp) and fits its
// content to that size, so any combination can share one home screen.
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import type { Palette } from '../lib/theme';
import type { Board, DaySummary, Member, Occurrence, RangeReport } from '../lib/types';
import { counterText, myOpenList, shortNumber, statusGlyph } from '../lib/local';
import { ringSvg, splitCellSvg } from './svg';

export interface WidgetData {
  board: Board | null;
  meId: string | null;
  month?: RangeReport | null;
  offline?: boolean;
  loggedOut?: boolean;
}

export interface Size {
  width: number;
  height: number;
}

type P = { data: WidgetData; size: Size; p: Palette };

const ROW = 40;
const PAD = 12;
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const membersOf = (data: WidgetData) => {
  const members = data.board?.members ?? [];
  const meIndex = Math.max(0, members.findIndex((m) => m.userId === data.meId));
  return {
    members,
    me: members[meIndex] as Member | undefined,
    partner: members[1 - meIndex] as Member | undefined,
    colorOf: (userId: string, p: Palette) => (members.findIndex((m) => m.userId === userId) === 0 ? p.zen : p.lily),
  };
};

// ---------- shared pieces ----------

function Shell({ p, children, clickAction = 'OPEN_APP' }: { p: Palette; children: any; clickAction?: string }) {
  return (
    <FlexWidget
      clickAction={clickAction}
      style={{
        height: 'match_parent', width: 'match_parent', backgroundColor: p.widgetGlass,
        borderRadius: 26, borderWidth: 1, borderColor: p.widgetBorder, padding: PAD, flexDirection: 'column',
      }}
    >
      {children}
    </FlexWidget>
  );
}

function Text({ text, p, size = 18, color, bold, maxLines = 1, flex }: {
  text: string; p: Palette; size?: number; color?: `#${string}`; bold?: boolean; maxLines?: number; flex?: number;
}) {
  return (
    <TextWidget
      text={text}
      maxLines={maxLines}
      truncate="END"
      style={{ fontSize: size, color: color ?? p.text, fontWeight: bold ? '700' : '400', ...(flex ? { flex } : {}) }}
    />
  );
}

function Notice({ p, text }: { p: Palette; text: string }) {
  return (
    <Shell p={p}>
      <FlexWidget style={{ flex: 1, width: 'match_parent', justifyContent: 'center', alignItems: 'center' }}>
        <Text p={p} text={text} color={p.muted} maxLines={2} />
      </FlexWidget>
    </Shell>
  );
}

// A horizontal bar of `fraction` filled, drawn at a fixed dp width.
function Bar({ fraction, color, p, width, height = 14 }: { fraction: number; color: `#${string}`; p: Palette; width: number; height?: number }) {
  const filled = Math.round(Math.max(0, Math.min(1, fraction)) * width);
  return (
    <FlexWidget style={{ width, height, backgroundColor: p.widgetTrack, borderRadius: height / 2, flexDirection: 'row' }}>
      {filled > 0 ? <FlexWidget style={{ width: filled, height, backgroundColor: color, borderRadius: height / 2 }} /> : null}
    </FlexWidget>
  );
}

function Header({ p, title, right, offline }: { p: Palette; title: string; right?: string; offline?: boolean }) {
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
      <FlexWidget style={{ flex: 1, marginRight: 8 }}>
        <Text p={p} text={title} bold size={20} />
      </FlexWidget>
      {offline ? <Text p={p} text="offline · " size={15} color={p.warn} /> : null}
      {right ? <Text p={p} text={right} size={17} color={p.muted} /> : null}
      <TextWidget text="  ↻" clickAction="REFRESH" style={{ fontSize: 20, color: p.muted }} />
    </FlexWidget>
  );
}

function DuelRows({ data, p, width, compact }: { data: WidgetData; p: Palette; width: number; compact: boolean }) {
  const { members, colorOf } = membersOf(data);
  const start = data.board?.rules.startXp ?? 100;
  if (compact) {
    const half = (width - 8) / 2;
    return (
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        {members.map((m, i) => (
          <FlexWidget key={m.userId} style={{ width: half, flexDirection: 'column', marginLeft: i ? 8 : 0 }}>
            <FlexWidget style={{ flexDirection: 'row', width: 'match_parent' }}>
              <Text p={p} text={m.name} bold color={colorOf(m.userId, p)} flex={1} size={17} />
              <Text p={p} text={`♥ ${m.weeklyXp}`} bold size={17} />
            </FlexWidget>
            <Bar fraction={m.weeklyXp / start} color={colorOf(m.userId, p)} p={p} width={half} />
          </FlexWidget>
        ))}
      </FlexWidget>
    );
  }
  const barWidth = Math.max(40, width - 210);
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'column' }}>
      {members.map((m) => (
        <FlexWidget key={m.userId} style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', height: ROW }}>
          <FlexWidget style={{ width: 80 }}>
            <Text p={p} text={m.name} bold color={colorOf(m.userId, p)} size={18} />
          </FlexWidget>
          <Bar fraction={m.weeklyXp / start} color={colorOf(m.userId, p)} p={p} width={barWidth} height={16} />
          <FlexWidget style={{ width: 120, alignItems: 'flex-end' }}>
            <Text p={p} text={`♥ ${m.weeklyXp} · L${m.level}`} size={17} />
          </FlexWidget>
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}

function ItemRow({ o, p, clickable, color }: { o: Occurrence; p: Palette; clickable: boolean; color: `#${string}` }) {
  const done = o.status === 'done';
  const failed = o.status === 'missed' || o.status === 'ignored';
  const glyphColor = done ? color : failed ? p.danger : p.muted;
  const meta = [counterText(o), o.time].filter(Boolean).join(' · ');
  return (
    <FlexWidget
      clickAction={clickable && o.status === 'pending' ? 'TOGGLE' : 'OPEN_APP'}
      clickActionData={{ taskId: o.taskId, date: o.date }}
      style={{ width: 'match_parent', height: ROW, flexDirection: 'row', alignItems: 'center' }}
    >
      <FlexWidget style={{ width: 30 }}>
        <Text p={p} text={statusGlyph(o)} bold color={glyphColor} size={20} />
      </FlexWidget>
      <Text p={p} text={o.taskName} flex={1} size={18} color={done || failed ? p.muted : p.text} />
      {meta ? <Text p={p} text={` ${meta}`} size={15} color={p.muted} /> : null}
    </FlexWidget>
  );
}

function Checklist({ list, p, rows, clickable, color }: { list: Occurrence[]; p: Palette; rows: number; clickable: boolean; color: `#${string}` }) {
  if (list.length === 0) return <Text p={p} text="Nothing scheduled" size={17} color={p.muted} />;
  // Open items first so the rows that fit are the ones still asking something of you.
  const sorted = [...list].sort((a, b) => Number(a.status !== 'pending') - Number(b.status !== 'pending'));
  const shown = sorted.slice(0, list.length > rows ? Math.max(0, rows - 1) : rows);
  const hidden = list.length - shown.length;
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'column' }}>
      {shown.map((o) => <ItemRow key={o._id} o={o} p={p} clickable={clickable} color={color} />)}
      {hidden > 0 ? <Text p={p} text={`+${hidden} more`} size={15} color={p.muted} /> : null}
    </FlexWidget>
  );
}

const stateColor = (d: DaySummary | undefined, userId: string | undefined, p: Palette) =>
  (d && userId && d.members[userId] ? p.state[d.members[userId].state] : p.state.none);

function WeekCells({ data, p, cell }: { data: WidgetData; p: Palette; cell: number }) {
  const { members } = membersOf(data);
  const [a, b] = members;
  const days = data.board?.weekDays ?? [];
  return (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
      {days.map((d, i) => (
        <FlexWidget key={d.date} style={{ flexDirection: 'column', alignItems: 'center', marginRight: 4 }}>
          <SvgWidget
            svg={splitCellSvg(stateColor(d, a?.userId, p), stateColor(d, b?.userId, p), cell, d.date === data.board?.today ? p.text : undefined)}
            style={{ width: cell, height: cell }}
          />
          {cell >= 18 ? <Text p={p} text={DAY_LETTERS[i]} size={14} color={p.muted} /> : null}
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}

function GoalLine({ data, p, width }: { data: WidgetData; p: Palette; width: number }) {
  const goal = data.board?.goals[0];
  if (!goal) return null;
  return (
    <FlexWidget style={{ flexDirection: 'column', width }}>
      <Text p={p} text={`💰 ${shortNumber(goal.current)} / ${shortNumber(goal.target)} ${goal.unit}`} size={17} />
      <Bar fraction={goal.percent / 100} color={p.good} p={p} width={width} />
    </FlexWidget>
  );
}

// ---------- the widgets ----------

export function DuelWidget({ data, size, p }: P) {
  if (data.loggedOut) return <Notice p={p} text="Open Lizen to log in" />;
  if (!data.board) return <Notice p={p} text="Loading…" />;
  const inner = size.width - PAD * 2;
  const compact = size.height < 90;
  const owed = data.board.members.flatMap((m) => m.pendingRewards.map((r) => `${m.name} owes: ${r}`));
  return (
    <Shell p={p}>
      {compact ? null : <Header p={p} title="Weekly duel" right={`${data.board.daysLeftInWeek}d left`} offline={data.offline} />}
      <DuelRows data={data} p={p} width={inner} compact={compact} />
      {!compact && owed.length ? <Text p={p} text={`🚨 ${owed[0]}`} size={15} color={p.danger} /> : null}
    </Shell>
  );
}

export function TodayWidget({ data, size, p }: P) {
  if (data.loggedOut) return <Notice p={p} text="Open Lizen to log in" />;
  if (!data.board || !data.meId) return <Notice p={p} text="Loading…" />;
  const { me, colorOf } = membersOf(data);
  const list = myOpenList(data.board, data.meId);
  const rows = Math.max(1, Math.floor((size.height - PAD * 2 - 24) / ROW));
  return (
    <Shell p={p}>
      <Header p={p} title={`My today  ${me?.done ?? 0}/${me?.total ?? 0}`} right={`♥ ${me?.weeklyXp ?? ''}`} offline={data.offline} />
      <Checklist list={list} p={p} rows={rows} clickable color={colorOf(data.meId, p)} />
    </Shell>
  );
}

export function PartnerWidget({ data, size, p }: P) {
  if (data.loggedOut) return <Notice p={p} text="Open Lizen to log in" />;
  if (!data.board) return <Notice p={p} text="Loading…" />;
  const { partner, colorOf } = membersOf(data);
  if (!partner) return <Notice p={p} text="No partner yet" />;
  const color = colorOf(partner.userId, p);
  const last = data.board.feed.find((f) => f.userId === partner.userId);
  const lastText = last ? `${last.status === 'done' ? '✓' : last.status === 'excused' ? '–' : '✗'} ${last.taskName}` : 'Nothing yet today';
  const ring = Math.min(58, size.height - PAD * 2);
  const rows = Math.floor((size.height - PAD * 2 - ring - 4) / ROW);
  return (
    <Shell p={p}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <SvgWidget svg={ringSvg(partner.total ? partner.done / partner.total : 0, color, p.widgetTrack, ring, 7)} style={{ width: ring, height: ring }} />
        <FlexWidget style={{ flex: 1, flexDirection: 'column', marginLeft: 8 }}>
          <FlexWidget style={{ flexDirection: 'row', width: 'match_parent' }}>
            <Text p={p} text={`${partner.name} · ${partner.done}/${partner.total}`} bold color={color} flex={1} />
            <Text p={p} text={`♥ ${partner.weeklyXp}`} size={17} />
          </FlexWidget>
          <Text p={p} text={lastText} size={17} color={p.muted} />
        </FlexWidget>
      </FlexWidget>
      {rows > 0 ? <Checklist list={partner.items} p={p} rows={rows} clickable={false} color={color} /> : null}
    </Shell>
  );
}

export function WeekWidget({ data, size, p }: P) {
  if (data.loggedOut) return <Notice p={p} text="Open Lizen to log in" />;
  if (!data.board) return <Notice p={p} text="Loading…" />;
  const inner = size.width - PAD * 2;
  const cell = Math.max(14, Math.min(30, Math.floor((size.height - PAD * 2 - 12) * 0.9), Math.floor((inner * 0.62) / 7) - 4));
  const goalWidth = Math.max(60, inner - (cell + 4) * 7 - 8);
  return (
    <Shell p={p}>
      <FlexWidget style={{ width: 'match_parent', flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        <WeekCells data={data} p={p} cell={cell} />
        <FlexWidget style={{ flex: 1, flexDirection: 'column', marginLeft: 4 }}>
          <Text p={p} text={`🔥 ${data.board.sharedStreak} together · ${data.board.daysLeftInWeek}d left`} size={15} color={p.muted} />
          <GoalLine data={data} p={p} width={goalWidth} />
        </FlexWidget>
      </FlexWidget>
    </Shell>
  );
}

export function MonthWidget({ data, size, p }: P) {
  if (data.loggedOut) return <Notice p={p} text="Open Lizen to log in" />;
  const month = data.month;
  if (!month) return <Notice p={p} text="Loading…" />;
  const [a, b] = month.members;
  const first = month.days[0]?.date ?? month.today;
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday-first grid
  const cells: (DaySummary | null)[] = [...Array(lead).fill(null), ...month.days];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const gap = 3;
  const cell = Math.max(10, Math.min(
    Math.floor((size.width - PAD * 2 - gap * 6) / 7),
    Math.floor((size.height - PAD * 2 - 22 - gap * (weeks.length - 1)) / weeks.length),
  ));
  const title = new Date(`${first}T00:00:00Z`).toLocaleString('en', { month: 'long', timeZone: 'UTC' });
  return (
    <Shell p={p}>
      <Header p={p} title={title} right={`${a?.name ?? ''} ◤ ◢ ${b?.name ?? ''}`} offline={data.offline} />
      <FlexWidget style={{ flexDirection: 'column', width: 'match_parent', alignItems: 'center' }}>
        {weeks.map((week, wi) => (
          <FlexWidget key={wi} style={{ flexDirection: 'row', marginTop: wi ? gap : 0 }}>
            {week.map((d, di) => (
              <FlexWidget key={di} style={{ width: cell, height: cell, marginLeft: di ? gap : 0 }}>
                {d ? (
                  <SvgWidget
                    svg={splitCellSvg(stateColor(d, a?.userId, p), stateColor(d, b?.userId, p), cell, d.date === month.today ? p.text : undefined)}
                    style={{ width: cell, height: cell }}
                  />
                ) : null}
              </FlexWidget>
            ))}
          </FlexWidget>
        ))}
      </FlexWidget>
    </Shell>
  );
}

// Everything at once: duel, both checklists side by side, the week, savings
// and the next deadline. Sections drop away gracefully as the widget shrinks.
export function BoardWidget({ data, size, p }: P) {
  if (data.loggedOut) return <Notice p={p} text="Open Lizen to log in" />;
  if (!data.board || !data.meId) return <Notice p={p} text="Loading…" />;
  const board = data.board;
  const { me, partner, colorOf } = membersOf(data);
  const inner = size.width - PAD * 2;
  const col = (inner - 10) / 2;
  const showWeek = size.height >= 300;
  const showFooter = size.height >= 400;
  const fixed = 36 + 2 * ROW + (showWeek ? 54 : 0) + (showFooter ? 56 : 0) + 30;
  const rows = Math.max(1, Math.floor((size.height - PAD * 2 - fixed) / ROW));
  const next = board.deadlines[0];
  return (
    <Shell p={p}>
      <Header p={p} title={`Lizen · ${board.today.slice(5).replace('-', '/')}`} right={`${board.daysLeftInWeek} days left`} offline={data.offline} />
      <DuelRows data={data} p={p} width={inner} compact={false} />
      <FlexWidget style={{ width: 'match_parent', flex: 1, flexDirection: 'row', marginTop: 6 }}>
        <FlexWidget style={{ width: col, flexDirection: 'column' }}>
          <Text p={p} text={`${me?.name} · ${me?.done}/${me?.total}`} bold size={17} color={colorOf(data.meId, p)} />
          <Checklist list={myOpenList(board, data.meId)} p={p} rows={rows} clickable color={colorOf(data.meId, p)} />
        </FlexWidget>
        <FlexWidget style={{ width: col, flexDirection: 'column', marginLeft: 10 }}>
          <Text p={p} text={`${partner?.name ?? ''} · ${partner?.done ?? 0}/${partner?.total ?? 0}`} bold size={17} color={partner ? colorOf(partner.userId, p) : p.muted} />
          <Checklist list={partner?.items ?? []} p={p} rows={rows} clickable={false} color={partner ? colorOf(partner.userId, p) : p.muted} />
        </FlexWidget>
      </FlexWidget>
      {showWeek ? (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <WeekCells data={data} p={p} cell={30} />
          <FlexWidget style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text p={p} text={`🔥 ${board.sharedStreak} together`} size={15} color={p.muted} />
          </FlexWidget>
        </FlexWidget>
      ) : null}
      {showFooter ? (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <GoalLine data={data} p={p} width={col} />
          <FlexWidget style={{ width: col, marginLeft: 10, alignItems: 'flex-end' }}>
            <Text p={p} text={next ? `📅 ${next.name} · ${next.daysLeft === 0 ? 'today' : `${next.daysLeft}d`}` : 'No deadlines soon'} size={17} color={next && next.daysLeft <= 2 ? p.danger : p.muted} />
          </FlexWidget>
        </FlexWidget>
      ) : null}
    </Shell>
  );
}

export const WIDGETS = {
  Board: BoardWidget,
  Duel: DuelWidget,
  Today: TodayWidget,
  Partner: PartnerWidget,
  Week: WeekWidget,
  Month: MonthWidget,
} as const;

export type WidgetName = keyof typeof WIDGETS;

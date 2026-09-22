import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useRefreshNews } from '@workspace/api-client-react';
import type { NewsItem } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useSavedStories, type SavedStory } from '@/contexts/SavedStoriesContext';
import { storySentimentTone } from '@/lib/storySentiment';

type Direction = 'positive' | 'negative' | 'mixed';
type Category = 'Sve' | 'Tržišta' | 'Kompanije' | 'Ekonomija' | 'Sektori';

type Story = SavedStory;

const categories: Category[] = ['Sve', 'Tržišta', 'Kompanije', 'Ekonomija', 'Sektori'];

const fallbackStories: Story[] = [
  {
    id: 'fed-patience',
    category: 'Ekonomija',
    source: 'Reuters',
    published: 'Danas, 07:42',
    readTime: '4 min',
    company: 'Američki Fed',
    title: 'Fed poručuje: sa snižavanjem kamata nema žurbe',
    summary:
      'Kamatne stope mogle bi ostati povišene dulje nego što su se ulagači nadali.',
    direction: 'mixed',
    pressure: 'Blagi pritisak prema dolje',
    articleUrl: 'https://www.reuters.com/markets/us/',
    accent: 'lime',
  },
  {
    id: 'nvidia-demand',
    category: 'Kompanije',
    source: 'Financial Times',
    published: 'Jučer, 18:16',
    readTime: '3 min',
    company: 'NVIDIA',
    ticker: 'NVDA',
    title: 'Nvidijini kupci i dalje šire AI kapacitete',
    summary:
      'Cloud igrači nastavljaju ulagati u podatkovne centre, ali očekivanja su visoka.',
    direction: 'positive',
    pressure: 'Mogući pritisak prema gore',
    articleUrl: 'https://www.ft.com/technology',
    accent: 'coral',
  },
  {
    id: 'euro-stoxx',
    category: 'Tržišta',
    source: 'Bloomberg',
    published: 'Jučer, 16:52',
    readTime: '5 min',
    company: 'Euro Stoxx 50',
    ticker: 'SX5E',
    title: 'Europske burze zastale blizu rekorda',
    summary:
      'Ulagači traže potvrdu u rezultatima kompanija, osobito u industriji i bankama.',
    direction: 'mixed',
    pressure: 'Neutralno do blago prema dolje',
    articleUrl: 'https://www.bloomberg.com/markets',
    accent: 'blue',
  },
  {
    id: 'adidas-margin',
    category: 'Kompanije',
    source: 'The Wall Street Journal',
    published: 'Jučer, 14:08',
    readTime: '3 min',
    company: 'Adidas',
    ticker: 'ADS.DE',
    title: 'Adidas podigao očekivanja nakon boljeg trenda prodaje',
    summary:
      'Manji pritisak popusta mogao bi pomoći maržama njemačkog proizvođača.',
    direction: 'positive',
    pressure: 'Mogući pritisak prema gore',
    articleUrl: 'https://www.wsj.com/business',
    accent: 'amber',
  },
];

type MarketDefinition = {
  name: string;
  code: string;
  timeZone: string;
  openHour: number;
  openMinute: number;
  closeHour: number;
  closeMinute: number;
};

const marketRows: MarketDefinition[] = [
  { name: 'London', code: 'LSE', timeZone: 'Europe/London', openHour: 8, openMinute: 0, closeHour: 16, closeMinute: 30 },
  { name: 'Pariz', code: 'EURONEXT', timeZone: 'Europe/Paris', openHour: 9, openMinute: 0, closeHour: 17, closeMinute: 30 },
  { name: 'Milano', code: 'BORSA IT', timeZone: 'Europe/Rome', openHour: 9, openMinute: 0, closeHour: 17, closeMinute: 30 },
  { name: 'New York', code: 'NYSE', timeZone: 'America/New_York', openHour: 9, openMinute: 30, closeHour: 16, closeMinute: 0 },
  { name: 'New York', code: 'NASDAQ', timeZone: 'America/New_York', openHour: 9, openMinute: 30, closeHour: 16, closeMinute: 0 },
  { name: '', code: 'GETTEX', timeZone: 'Europe/Berlin', openHour: 7, openMinute: 30, closeHour: 23, closeMinute: 0 },
];

const MARKET_SCALE_START = 0;
const MARKET_SCALE_END = 24 * 60;
const MARKET_TICK_MINUTES = 30;
const MARKET_TICK_WIDTH = 24;
const marketTicks = Array.from(
  { length: (MARKET_SCALE_END - MARKET_SCALE_START) / MARKET_TICK_MINUTES + 1 },
  (_, index) => MARKET_SCALE_START + index * MARKET_TICK_MINUTES,
);
const marketIntervals = marketTicks.slice(0, -1);
const marketTimelineWidth = marketIntervals.length * MARKET_TICK_WIDTH;
const MARKET_EXTENDED_MINUTES = 60;

type MarketPhase = 'closed' | 'open' | 'extended';

function getTimeZonePart(date: Date, timeZone: string, type: Intl.DateTimeFormatPartTypes): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).find((part) => part.type === type)?.value ?? '';
}

function minutesInTimeZone(date: Date, timeZone: string): number {
  const hour = Number(getTimeZonePart(date, timeZone, 'hour'));
  const minute = Number(getTimeZonePart(date, timeZone, 'minute'));
  return hour * 60 + minute;
}

function isWeekdayInTimeZone(date: Date, timeZone: string): boolean {
  const weekday = getTimeZonePart(date, timeZone, 'weekday');
  return weekday !== 'Sat' && weekday !== 'Sun';
}

function localTimeAsInstant(
  date: Date,
  timeZone: string,
  hour: number,
  minute: number,
  calendarTimeZone = timeZone,
): Date {
  const localYear = Number(getTimeZonePart(date, calendarTimeZone, 'year'));
  const localMonth = Number(getTimeZonePart(date, calendarTimeZone, 'month'));
  const localDay = Number(getTimeZonePart(date, calendarTimeZone, 'day'));
  const targetWall = Date.UTC(localYear, localMonth - 1, localDay, hour, minute);
  const probe = new Date(targetWall);
  const probeLocalWall = Date.UTC(
    Number(getTimeZonePart(probe, timeZone, 'year')),
    Number(getTimeZonePart(probe, timeZone, 'month')) - 1,
    Number(getTimeZonePart(probe, timeZone, 'day')),
    Number(getTimeZonePart(probe, timeZone, 'hour')),
    Number(getTimeZonePart(probe, timeZone, 'minute')),
  );
  const zoneOffset = probeLocalWall - probe.getTime();
  return new Date(targetWall - zoneOffset);
}

function calendarDayNumber(date: Date, timeZone: string): number {
  return Date.UTC(
    Number(getTimeZonePart(date, timeZone, 'year')),
    Number(getTimeZonePart(date, timeZone, 'month')) - 1,
    Number(getTimeZonePart(date, timeZone, 'day')),
  );
}

function minutesOnZagrebTimeline(date: Date, referenceDate: Date): number {
  const dayOffset =
    (calendarDayNumber(date, 'Europe/Zagreb') - calendarDayNumber(referenceDate, 'Europe/Zagreb')) /
    (24 * 60 * 60 * 1000);
  return minutesInTimeZone(date, 'Europe/Zagreb') + dayOffset * 24 * 60;
}

function marketWindowInZagreb(
  market: MarketDefinition,
  now: Date,
): { open: number; close: number } | null {
  if (!isWeekdayInTimeZone(now, market.timeZone)) return null;
  return {
    open: minutesOnZagrebTimeline(
      localTimeAsInstant(now, market.timeZone, market.openHour, market.openMinute, 'Europe/Zagreb'),
      now,
    ),
    close: minutesOnZagrebTimeline(
      localTimeAsInstant(now, market.timeZone, market.closeHour, market.closeMinute, 'Europe/Zagreb'),
      now,
    ),
  };
}

function formatScaleTime(minutes: number): string {
  if (minutes === MARKET_SCALE_END) return '00:00';
  const hour = Math.floor(minutes / 60).toString().padStart(2, '0');
  const minute = (minutes % 60).toString().padStart(2, '0');
  return `${hour}:${minute}`;
}

function phaseForMarketSegment(
  segmentStart: number,
  window: { open: number; close: number } | null,
): MarketPhase {
  if (!window) return 'closed';
  const premarketStart = Math.max(MARKET_SCALE_START, window.open - MARKET_EXTENDED_MINUTES);
  const postmarketEnd = Math.min(MARKET_SCALE_END, window.close + MARKET_EXTENDED_MINUTES);
  if (segmentStart >= window.open && segmentStart < window.close) return 'open';
  if (
    (segmentStart >= premarketStart && segmentStart < window.open) ||
    (segmentStart >= window.close && segmentStart < postmarketEnd)
  ) {
    return 'extended';
  }
  return 'closed';
}

function categoryForItem(item: NewsItem): Exclude<Category, 'Sve'> {
  const searchable = `${item.originalTitle} ${item.translatedTitle} ${item.company}`.toLowerCase();
  if (
    /(fed|ecb|kamate|kamatn|inflacij|interest rate|central bank|monetary|središnj|bdp|gdp|employment|zaposlen|recession|recesij|currency|valut|forex|exchange rate|tečaj|yield|prinos)/.test(
      searchable,
    )
  ) {
    return 'Ekonomija';
  }
  if (item.ticker || item.company) return 'Kompanije';
  if (
    /(technology|tehnolog|software|chip|čip|semiconductor|poluvodič|bank|bankar|energy|energ|oil|nafta|gas|plin|health|zdrav|pharma|farmac|auto|automobil|ev|electric vehicle|retail|maloprod|industr|consumer|potroša|telecom|telekom|utilities)/.test(
      searchable,
    )
  ) {
    return 'Sektori';
  }
  return 'Tržišta';
}

function formatPublished(value: string | null): string {
  if (!value) return 'Novo';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('hr-HR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatLastUpdated(date: Date): { date: string; time: string } {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  return {
    date: `${day}.${month}.${year}`,
    time: date.toLocaleTimeString('hr-HR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

function mapNewsItem(item: NewsItem, index: number): Story {
  const accents: Story['accent'][] = ['lime', 'coral', 'blue', 'amber', 'violet'];
  return {
    id: item.id,
    category: categoryForItem(item),
    source: item.source,
    published: formatPublished(item.publishedAt),
    readTime: item.readTime,
    company: item.company || 'Tržište',
    ticker: item.ticker ?? undefined,
    title: item.translatedTitle,
    summary: item.summary,
    direction: item.direction,
    pressure: item.pressure,
    articleUrl: item.articleUrl,
    accent: accents[index % accents.length],
  };
}

function DirectionIcon({
  direction,
  color,
}: {
  direction: Direction;
  color: string;
}) {
  if (direction === 'positive') {
    return <Feather name="trending-up" size={15} color={color} />;
  }
  if (direction === 'negative') {
    return <Feather name="trending-down" size={15} color={color} />;
  }
  return <Text style={[styles.directionDash, { color }]}>—</Text>;
}

function PulseMark({ color, backgroundColor }: { color: string; backgroundColor: string }) {
  return (
    <Svg width={34} height={34} viewBox="0 0 34 34">
      <Rect x={1} y={1} width={32} height={32} rx={6} fill={backgroundColor} />
      <Path
        d="M2 18 H8.4 L11.4 10.8 L15.4 23.6 L19.4 8.4 L23.4 18 H27.4"
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={27.4} cy={18} r={4.5} fill={color} opacity={0.16} />
      <Circle cx={27.4} cy={18} r={2.2} fill={color} />
    </Svg>
  );
}

function MarketHoursIcon({ color }: { color: string }) {
  return (
    <View style={styles.marketHoursIcon}>
      <Ionicons name="notifications-outline" size={15} color={color} />
      <Ionicons name="time-outline" size={8} color={color} style={styles.marketHoursClock} />
    </View>
  );
}

function RefreshHourglass({ isRefreshing, color }: { isRefreshing: boolean; color: string }) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isRefreshing) {
      rotation.stopAnimation();
      rotation.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(rotation, {
          toValue: 180,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rotation, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => {
      animation.stop();
      rotation.stopAnimation();
      rotation.setValue(0);
    };
  }, [isRefreshing, rotation]);

  const rotate = rotation.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <Animated.View
      accessibilityLabel={isRefreshing ? 'Osvježavanje u tijeku' : 'Osvježavanje je završeno'}
      testID="refresh-hourglass"
      style={{ transform: [{ rotate }] }}
    >
      <Ionicons name="hourglass-outline" size={20} color={color} />
    </Animated.View>
  );
}

function Header({
  isRefreshing,
  onRefresh,
  lastUpdated,
}: {
  isRefreshing: boolean;
  onRefresh: () => void;
  lastUpdated: Date;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const lastUpdatedParts = formatLastUpdated(lastUpdated);
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <PulseMark color={colors.pulseGreen} backgroundColor={colors.pulseMonitor} />
        </View>
        <View style={styles.brandTextRow}>
          <Text style={[styles.brandName, { color: colors.foreground }]}>Puls</Text>
          <Text style={[styles.brandMonitor, { color: colors.pulseGreen }]}>monitor</Text>
        </View>
      </View>
      <View style={styles.headerActions}>
        <Pressable
          accessibilityLabel="Osvježi pregled"
          onPress={onRefresh}
          disabled={isRefreshing}
          testID="button-refresh-header"
          style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed, isRefreshing && styles.disabled]}
        >
          <RefreshHourglass isRefreshing={isRefreshing} color={colors.hourglass} />
          <Ionicons name="refresh-outline" size={27} color={colors.primary} />
        </Pressable>
        <Text style={[styles.lastUpdatedText, { color: colors.mutedForeground }]}>
          Zadnje ažurirano: {lastUpdatedParts.date}
          <Text style={styles.lastUpdatedTime}> {lastUpdatedParts.time}</Text>
        </Text>
      </View>
    </View>
  );
}

function MarketStatus() {
  const colors = useColors();
  const [now, setNow] = useState(() => new Date());
  const [expanded, setExpanded] = useState(false);
  const timelineScrollRef = useRef<ScrollView | null>(null);
  const zagrebMinutes = minutesInTimeZone(now, 'Europe/Zagreb');
  const nowPosition = Math.min(
    marketTimelineWidth,
    Math.max(0, ((zagrebMinutes - MARKET_SCALE_START) / MARKET_TICK_MINUTES) * MARKET_TICK_WIDTH),
  );

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const timeout = setTimeout(() => {
      timelineScrollRef.current?.scrollTo({
        x: Math.max(0, nowPosition - 110),
        animated: false,
      });
    }, 0);
    return () => clearTimeout(timeout);
  }, [expanded, nowPosition]);

  return (
    <View style={[styles.marketCard, { backgroundColor: colors.marketBackground, borderColor: colors.marketBackground }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={expanded ? 'Zatvori Market Hours' : 'Otvori Market Hours'}
        onPress={() => setExpanded((current) => !current)}
        testID="button-market-hours"
        style={({ pressed }) => [styles.marketHeader, pressed && styles.pressed]}
      >
        <View style={styles.marketHeaderTitle}>
          <MarketHoursIcon color={colors.marketForeground} />
          <Text style={[styles.marketHeaderLabel, { color: colors.marketForeground }]}>MARKET HOURS</Text>
        </View>
        <View style={styles.marketHeaderRight}>
          <Text style={[styles.marketClock, { color: colors.marketForeground }]}>
            {new Intl.DateTimeFormat('hr-HR', {
              timeZone: 'Europe/Zagreb',
              hour: '2-digit',
              minute: '2-digit',
              hourCycle: 'h23',
            }).format(now)}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={17}
            color={colors.marketForeground}
          />
        </View>
      </Pressable>
      {expanded ? (
        <View style={styles.marketExpanded}>
          <Text style={[styles.marketScaleCaption, { color: colors.marketForeground }]}>
            ZAGREB TIME · PODJELE 30 MIN
          </Text>
          <View style={styles.marketTimelineGrid}>
            <View style={styles.marketFixedColumn}>
              <View style={styles.marketColumnHeader}>
                <Text style={[styles.marketColumnHeaderText, { color: colors.marketForeground }]}>BURZA</Text>
              </View>
              {marketRows.map((market) => (
                <View style={styles.marketNameRow} key={market.code}>
                  <Text style={[styles.marketCity, { color: colors.marketForeground }]}>{market.name}</Text>
                  <Text style={[styles.marketCode, { color: colors.marketForeground }]}>{market.code}</Text>
                </View>
              ))}
            </View>
            <View style={styles.marketTimelineViewport}>
              <ScrollView
                ref={timelineScrollRef}
                horizontal
                showsHorizontalScrollIndicator
                nestedScrollEnabled
                contentContainerStyle={{ width: marketTimelineWidth }}
              >
                <View style={{ width: marketTimelineWidth }}>
                  <View style={[styles.marketScale, { width: marketTimelineWidth }]}>
                    {marketTicks.map((tick, index) => (
                      <View style={[styles.marketTick, { left: index * MARKET_TICK_WIDTH }]} key={tick}>
                        {tick % 60 !== 30 ? (
                          <Text
                            style={[
                              styles.marketTickLabel,
                              index === marketTicks.length - 1 && styles.marketTickLabelEnd,
                              { color: colors.marketForeground },
                            ]}
                          >
                            {formatScaleTime(tick)}
                          </Text>
                        ) : null}
                        <View
                          style={[
                            styles.marketTickLine,
                            tick % 60 === 0 && styles.marketTickLineFullHour,
                            tick % 60 !== 0 && styles.marketTickLineNoLabel,
                            { backgroundColor: colors.marketForeground },
                          ]}
                        />
                      </View>
                    ))}
                    <View style={[styles.marketScaleNowLine, { left: nowPosition, backgroundColor: colors.marketNow }]} />
                  </View>
                  {marketRows.map((market) => {
                    const window = marketWindowInZagreb(market, now);
                    return (
                      <View style={[styles.marketTrack, { width: marketTimelineWidth, backgroundColor: colors.marketTrack }]} key={market.code}>
                        <View style={[styles.marketTrackInset, { backgroundColor: colors.marketCell }]}>
                          {marketIntervals.map((segmentStart, index) => {
                            const phase = phaseForMarketSegment(segmentStart, window);
                            const phaseColor =
                              phase === 'open'
                                ? colors.marketOpen
                                : phase === 'extended'
                                  ? colors.marketExtended
                                  : colors.marketClosed;
                            return (
                              <View
                                style={[
                                  styles.marketSegment,
                                  {
                                    left: index * MARKET_TICK_WIDTH,
                                    width: MARKET_TICK_WIDTH,
                                    backgroundColor: phaseColor,
                                  },
                                ]}
                                key={`${market.code}-${segmentStart}`}
                              />
                            );
                          })}
                          {marketTicks.slice(0, -1).map((tick, index) => (
                            <View
                              style={[
                                styles.marketGridTick,
                                { left: index * MARKET_TICK_WIDTH, backgroundColor: colors.marketCell },
                              ]}
                              key={`${market.code}-grid-${tick}`}
                            />
                          ))}
                        </View>
                        <View style={[styles.marketNowLine, { left: nowPosition, backgroundColor: colors.marketNow }]} />
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
            <View style={styles.marketStatusColumn}>
              <View style={styles.marketColumnHeader}>
              </View>
              {marketRows.map((market) => {
                const localMinutes = minutesInTimeZone(now, market.timeZone);
                const open =
                  isWeekdayInTimeZone(now, market.timeZone) &&
                  localMinutes >= market.openHour * 60 + market.openMinute &&
                  localMinutes < market.closeHour * 60 + market.closeMinute;
                const statusColor = open ? colors.marketOpen : colors.marketClosed;
                return (
                  <View style={styles.marketStatusRow} key={market.code}>
                    <Text style={[styles.marketStatusText, { color: statusColor }]}>
                      {open ? 'OTVORENO' : 'ZATVORENO'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
          <View style={styles.marketLegend}>
            <View style={styles.marketLegendItem}>
              <View style={[styles.legendBar, { backgroundColor: colors.marketOpen }]} />
              <Text style={[styles.marketLegendText, { color: colors.marketForeground }]}>OTVORENO</Text>
            </View>
            <View style={styles.marketLegendItem}>
              <View style={[styles.legendBar, { backgroundColor: colors.marketExtended }]} />
              <Text style={[styles.marketLegendText, { color: colors.marketForeground }]}>PRE/POST</Text>
            </View>
            <View style={styles.marketLegendItem}>
              <View style={[styles.legendBar, { backgroundColor: colors.marketClosed }]} />
              <Text style={[styles.marketLegendText, { color: colors.marketForeground }]}>ZATVORENO</Text>
            </View>
            <View style={styles.marketLegendItem}>
              <View style={[styles.legendBar, { backgroundColor: colors.marketNow }]} />
              <Text style={[styles.marketLegendText, { color: colors.marketForeground }]}>SADA</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function FeaturedStory({
  story,
  saved,
  onSave,
  onOpen,
  disabled,
}: {
  story: Story;
  saved: boolean;
  onSave: () => void;
  onOpen: () => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.featuredCard, pressed && styles.cardPressed, { backgroundColor: colors.marketBackground }]}>
      <View style={styles.featuredTopline}>
        <View style={styles.featuredTag}>
          <View style={[styles.liveDot, { backgroundColor: colors.secondary }]} />
          <Text style={[styles.featuredTagText, { color: colors.tint }]}>ISTAKNUTO</Text>
        </View>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onSave();
          }}
          disabled={disabled}
          accessibilityLabel={saved ? 'Ukloni iz spremljenih' : 'Spremi članak'}
          testID={`button-bookmark-${story.id}`}
          style={({ pressed }) => [styles.bookmarkButton, disabled && styles.disabled, pressed && styles.pressed]}
        >
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={colors.marketForeground} />
        </Pressable>
      </View>
      <Text style={[styles.featuredSource, { color: colors.marketForeground }]}>{story.source.toUpperCase()} · {story.published}</Text>
      <Text style={[styles.featuredTitle, { color: colors.marketForeground }]}>{story.title}</Text>
      <Text style={[styles.featuredSummary, { color: colors.marketForeground }]}>{story.summary}</Text>
      <View style={styles.featuredFooter}>
        <View style={styles.featuredPressure}>
          <DirectionIcon direction={story.direction} color={colors.secondary} />
          <Text style={[styles.featuredPressureText, { color: colors.marketForeground }]}>{story.pressure}</Text>
        </View>
        <Feather name="arrow-up-right" size={17} color={colors.secondary} />
      </View>
    </Pressable>
  );
}

function StoryCard({
  story,
  saved,
  onSave,
  onOpen,
  disabled,
}: {
  story: Story;
  saved: boolean;
  onSave: () => void;
  onOpen: () => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  const sentimentTone = storySentimentTone(story);
  const accent =
    sentimentTone === 'positive'
      ? colors.positive
      : sentimentTone === 'positiveSoft'
        ? colors.positiveSoft
        : sentimentTone === 'negative'
          ? colors.destructive
          : sentimentTone === 'warning'
            ? colors.amber
            : colors.mutedForeground;
  const directionColor = accent;
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.storyCard, pressed && styles.cardPressed, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.storyAccent, { backgroundColor: accent }]} />
      <View style={styles.storyContent}>
        <View style={styles.storyTopline}>
          <Text style={[styles.storyCompany, { color: colors.foreground }]}>{story.company}{story.ticker ? ` · ${story.ticker}` : ''}</Text>
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onSave();
            }}
            disabled={disabled}
            accessibilityLabel={saved ? 'Ukloni iz spremljenih' : 'Spremi članak'}
            testID={`button-bookmark-${story.id}`}
            style={({ pressed }) => [styles.storyBookmark, disabled && styles.disabled, pressed && styles.pressed]}
          >
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18} color={saved ? colors.accent : colors.mutedForeground} />
          </Pressable>
        </View>
        <Text style={[styles.storyMeta, { color: colors.mutedForeground }]}>{story.source.toUpperCase()} · {story.published} · {story.readTime}</Text>
        <Text style={[styles.storyTitle, { color: colors.foreground }]}>{story.title}</Text>
        <Text numberOfLines={2} style={[styles.storySummary, { color: colors.mutedForeground }]}>{story.summary}</Text>
        <View style={styles.storyBottomline}>
          <View style={[styles.directionBadge, { backgroundColor: colors.muted }]}>
            <DirectionIcon direction={story.direction} color={directionColor} />
            <Text style={[styles.directionText, { color: directionColor }]}>{story.pressure}</Text>
          </View>
          <Feather name="arrow-up-right" size={16} color={colors.mutedForeground} />
        </View>
      </View>
    </Pressable>
  );
}

function EmptyState() {
  const colors = useColors();
  return (
    <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Feather name="inbox" size={28} color={colors.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nema dostupnih vijesti</Text>
      <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>Pokušaj ponovno dohvatiti najnovije izvore.</Text>
    </View>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [stories, setStories] = useState<Story[]>(fallbackStories);
  const [activeCategory, setActiveCategory] = useState<Category>('Sve');
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const {
    savedStories,
    isReady: savedStoriesReady,
    storageError: savedStorageError,
    isSaved,
    toggleSaved: toggleSavedStory,
  } = useSavedStories();
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const refreshMutation = useRefreshNews();

  const visibleStories = useMemo(
    () => stories.filter((story) => activeCategory === 'Sve' || story.category === activeCategory),
    [activeCategory, stories],
  );

  const refresh = useCallback(() => {
    if (refreshMutation.isPending) return;
    setRefreshError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    refreshMutation.mutate(undefined, {
      onSuccess: (data) => {
        setStories(data.items.map(mapNewsItem));
        setWarnings(data.warnings);
        setLastUpdated(new Date());
      },
      onError: (error) => {
        setRefreshError(error instanceof Error ? error.message : 'Osvježavanje nije uspjelo.');
      },
    });
  }, [refreshMutation]);

  const openArticle = useCallback((url: string) => {
    void Linking.openURL(url);
  }, []);

  const toggleSaved = useCallback((story: Story) => {
    if (!savedStoriesReady) return;
    Haptics.selectionAsync();
    toggleSavedStory(story);
  }, [savedStoriesReady, toggleSavedStory]);

  const featured = visibleStories[0];
  const listStories = featured ? visibleStories.slice(1) : [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Header isRefreshing={refreshMutation.isPending} onRefresh={refresh} lastUpdated={lastUpdated} />
      <FlatList
        data={listStories}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        scrollEnabled={stories.length > 0}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        ListHeaderComponent={
          <View style={styles.content}>
            <MarketStatus />
            <View style={styles.sectionHeading}>
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>Pregled dana</Text>
              <Pressable
                accessibilityLabel={`Otvori spremljene vijesti, ${savedStories.length} spremljeno`}
                accessibilityRole="button"
                disabled={!savedStoriesReady}
                onPress={() => router.push('/saved')}
                testID="button-open-saved-stories"
                style={({ pressed }) => [
                  styles.savedCollectionButton,
                  pressed && styles.pressed,
                  !savedStoriesReady && styles.disabled,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Ionicons name="bookmark" size={18} color={colors.accent} />
                <Text style={[styles.savedCollectionText, { color: colors.foreground }]}>{savedStories.length}</Text>
                <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {refreshError ? (
              <View style={[styles.feedback, { backgroundColor: colors.errorSurface, borderColor: colors.accent }]}>
                <Feather name="alert-circle" size={16} color={colors.destructive} />
                <Text style={[styles.feedbackText, { color: colors.destructive }]}>{refreshError}</Text>
              </View>
            ) : null}
            {savedStorageError ? (
              <View style={[styles.feedback, { backgroundColor: colors.errorSurface, borderColor: colors.accent }]}>
                <Feather name="alert-circle" size={16} color={colors.destructive} />
                <Text style={[styles.feedbackText, { color: colors.destructive }]}>
                  Spremljene vijesti se trenutno ne mogu sačuvati na uređaju.
                </Text>
              </View>
            ) : null}
            {warnings.length > 0 ? (
              <View style={[styles.warning, { backgroundColor: colors.muted }]}>
                <Feather name="info" size={15} color={colors.mutedForeground} />
                <Text numberOfLines={2} style={[styles.warningText, { color: colors.mutedForeground }]}>{warnings[0]}</Text>
              </View>
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              {categories.map((category) => {
                const selected = category === activeCategory;
                return (
                  <Pressable
                    key={category}
                    onPress={() => {
                      setActiveCategory(category);
                      Haptics.selectionAsync();
                    }}
                    testID={`button-category-${category}`}
                    style={({ pressed }) => [
                      styles.categoryButton,
                      pressed && styles.pressed,
                      { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border },
                    ]}
                  >
                    <Text style={[styles.categoryText, { color: selected ? colors.primaryForeground : colors.mutedForeground }]}>{category}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {featured ? (
              <FeaturedStory
                story={featured}
                saved={isSaved(featured.id)}
                onSave={() => toggleSaved(featured)}
                onOpen={() => openArticle(featured.articleUrl)}
                disabled={!savedStoriesReady}
              />
            ) : null}
            <View style={styles.listHeading}>
              <Text style={[styles.listTitle, { color: colors.primary }]}>Najnovije</Text>
              <Text style={[styles.listCount, { color: colors.mutedForeground }]}>{visibleStories.length} priča</Text>
            </View>
            {visibleStories.length === 0 ? <EmptyState /> : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.listItem}>
            <StoryCard
              story={item}
              saved={isSaved(item.id)}
              onSave={() => toggleSaved(item)}
              onOpen={() => openArticle(item.articleUrl)}
              disabled={!savedStoriesReady}
            />
          </View>
        )}
        ListEmptyComponent={visibleStories.length > 0 ? <View style={styles.listEmptySpacer} /> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  disabled: { opacity: 0.55 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  brandTextRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  headerActions: { alignItems: 'flex-end', gap: 1 },
  brandMark: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontFamily: 'DMSans_700Bold', fontSize: 20, lineHeight: 22, letterSpacing: -0.7 },
  brandMonitor: { fontFamily: 'DMSans_500Medium', fontSize: 20, lineHeight: 22, letterSpacing: -0.7 },
  refreshButton: { minWidth: 62, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  lastUpdatedText: { fontFamily: 'SpaceMono_400Regular', fontSize: 11.25, lineHeight: 15 },
  lastUpdatedTime: { fontFamily: 'SpaceMono_400Regular', fontSize: 11.25, lineHeight: 15 },
  content: { paddingHorizontal: 20, paddingTop: 16 },
  marketCard: { borderWidth: 1, padding: 14, marginHorizontal: -8, marginBottom: 26 },
  marketHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 27 },
  marketHeaderTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  marketHoursIcon: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  marketHoursClock: { position: 'absolute', right: -1, bottom: -1 },
  marketHeaderLabel: { fontFamily: 'SpaceMono_700Bold', fontSize: 10.8, letterSpacing: 1.25 },
  marketHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  marketClock: { fontFamily: 'SpaceMono_400Regular', fontSize: 10 },
  marketExpanded: { marginTop: 11 },
  marketScaleCaption: { fontFamily: 'SpaceMono_400Regular', fontSize: 8, letterSpacing: 0.7, marginBottom: 7 },
  marketTimelineGrid: { flexDirection: 'row', alignItems: 'flex-start' },
  marketFixedColumn: { width: 78 },
  marketStatusColumn: { width: 57 },
  marketColumnHeader: { height: 32, justifyContent: 'flex-start', paddingTop: 3 },
  marketColumnHeaderText: { fontFamily: 'SpaceMono_700Bold', fontSize: 8, letterSpacing: 0.5 },
  marketNameRow: { height: 35, justifyContent: 'center' },
  marketCity: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
  marketCode: { fontFamily: 'SpaceMono_400Regular', fontSize: 8, marginTop: 2 },
  marketTimelineViewport: { flex: 1, minWidth: 0, overflow: 'hidden' },
  marketScale: { height: 32, position: 'relative' },
  marketTick: { width: 0, height: 32, position: 'absolute', top: 0 },
  marketTickLabel: { position: 'absolute', top: 1, left: -25, width: 50, textAlign: 'center', fontFamily: 'SpaceMono_400Regular', fontSize: 9.6 },
  marketTickLabelEnd: { left: -50, textAlign: 'right' },
  marketTickLine: { position: 'absolute', left: 0, bottom: 0, width: 1, height: 8, opacity: 0.55 },
  marketTickLineFullHour: { height: 11.2 },
  marketTickLineNoLabel: { height: 6.4 },
  marketScaleNowLine: { position: 'absolute', top: 0, bottom: 0, width: 2, zIndex: 3 },
  marketTrack: { height: 35, position: 'relative', justifyContent: 'center', overflow: 'hidden' },
  marketTrackInset: { position: 'absolute', left: 0, right: 0, top: 8, bottom: 8 },
  marketSegment: { position: 'absolute', top: 1, bottom: 1 },
  marketGridTick: { position: 'absolute', top: 0, bottom: 0, width: 1, opacity: 0.35, zIndex: 2 },
  marketNowLine: { position: 'absolute', top: 0, bottom: 0, width: 2, opacity: 0.95, zIndex: 4 },
  marketStatusRow: { width: '100%', height: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  marketStatusText: { fontFamily: 'SpaceMono_700Bold', fontSize: 8, textAlign: 'right' },
  marketLegend: { flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 10 },
  marketLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendBar: { width: 12, height: 3 },
  marketLegendText: { fontFamily: 'SpaceMono_400Regular', fontSize: 8 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontFamily: 'DMSans_700Bold', fontSize: 25, letterSpacing: -0.8 },
  savedCollectionButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 7 },
  savedCollectionText: { fontFamily: 'SpaceMono_700Bold', fontSize: 11 },
  feedback: { borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, marginBottom: 10 },
  feedbackText: { flex: 1, fontFamily: 'DMSans_500Medium', fontSize: 12, lineHeight: 17 },
  feedbackRetry: { padding: 4 },
  warning: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, marginBottom: 10 },
  warningText: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 11, lineHeight: 15 },
  categoryRow: { gap: 8, paddingBottom: 17 },
  categoryButton: { borderWidth: 1, paddingHorizontal: 9, paddingVertical: 8 },
  categoryText: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
  featuredCard: { padding: 18, marginBottom: 25 },
  featuredTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  featuredTag: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 6, height: 6, borderRadius: 6 },
  featuredTagText: { fontFamily: 'SpaceMono_700Bold', fontSize: 9, letterSpacing: 1 },
  bookmarkButton: { padding: 4 },
  featuredSource: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, letterSpacing: 0.4, marginBottom: 11 },
  featuredTitle: { fontFamily: 'DMSans_700Bold', fontSize: 24, lineHeight: 27, letterSpacing: -0.8 },
  featuredSummary: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 19, marginTop: 12 },
  featuredFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 21, paddingTop: 13, borderTopWidth: 1, borderTopColor: 'rgba(247,244,236,0.2)' },
  featuredPressure: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  featuredPressureText: { fontFamily: 'DMSans_500Medium', fontSize: 11, flex: 1 },
  listHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 },
  listTitle: { fontFamily: 'DMSans_700Bold', fontSize: 19, letterSpacing: -0.4 },
  listCount: { fontFamily: 'SpaceMono_400Regular', fontSize: 9 },
  listItem: { paddingHorizontal: 20, marginBottom: 10 },
  storyCard: { flexDirection: 'row', borderWidth: 1, overflow: 'hidden' },
  storyAccent: { width: 5 },
  storyContent: { flex: 1, padding: 14 },
  storyTopline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  storyCompany: { fontFamily: 'DMSans_700Bold', fontSize: 12, flex: 1 },
  storyBookmark: { padding: 3 },
  storyMeta: { fontFamily: 'SpaceMono_400Regular', fontSize: 8, letterSpacing: 0.3, marginTop: 7 },
  storyTitle: { fontFamily: 'DMSans_700Bold', fontSize: 17, lineHeight: 20, letterSpacing: -0.3, marginTop: 9 },
  storySummary: { fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 17, marginTop: 7 },
  storyBottomline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 8 },
  directionBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7, paddingVertical: 5, flex: 1 },
  directionText: { fontFamily: 'DMSans_500Medium', fontSize: 10, flex: 1 },
  directionDash: { fontFamily: 'DMSans_700Bold', fontSize: 17, lineHeight: 15 },
  emptyState: { borderWidth: 1, padding: 24, alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontFamily: 'DMSans_700Bold', fontSize: 17, marginTop: 12 },
  emptyCopy: { fontFamily: 'DMSans_400Regular', fontSize: 12, textAlign: 'center', marginTop: 6 },
  retryButton: { paddingHorizontal: 14, paddingVertical: 10, marginTop: 16 },
  retryText: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
  listEmptySpacer: { height: 20 },
  pressed: { opacity: 0.72 },
  cardPressed: { opacity: 0.88 },
});

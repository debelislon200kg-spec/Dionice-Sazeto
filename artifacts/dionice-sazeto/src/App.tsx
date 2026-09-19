import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRefreshNews } from '@workspace/api-client-react';
import type { NewsItem } from '@workspace/api-client-react';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  ExternalLink,
  Filter,
  Mail,
  Menu,
  RefreshCw,
  Search,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';

type Direction = 'positive' | 'negative' | 'mixed';
type Category = 'Sve' | 'Tržišta' | 'Kompanije' | 'Makro' | 'Regija';

type Story = {
  id: string;
  category: Exclude<Category, 'Sve'>;
  source: string;
  sourceShort: string;
  published: string;
  readTime: string;
  company: string;
  ticker?: string;
  original: string;
  title: string;
  summary: string;
  direction: Direction;
  pressure: string;
  why: string;
  risks: string;
  confidence: string;
  accent: string;
  featured?: boolean;
  link: string;
};

const stories: Story[] = [
  {
    id: 'fed-patience',
    category: 'Makro',
    source: 'Reuters',
    sourceShort: 'REUTERS',
    published: 'Danas, 07:42',
    readTime: '4 min',
    company: 'Američki Fed',
    original: 'Fed officials signal patience on rate cuts as inflation stays sticky',
    title: 'Fed poručuje: sa snižavanjem kamata nema žurbe',
    summary:
      'Najnoviji komentari dužnosnika američke središnje banke sugeriraju da će kamatne stope ostati povišene dulje nego što su se ulagači nadali.',
    direction: 'mixed',
    pressure: 'Blagi pritisak prema dolje za rastuće dionice',
    why: 'Više kamate podižu prinos na obveznice i povećavaju diskontnu stopu kojom se vrednuju buduće zarade.',
    risks: 'Jedan podatak o inflaciji može brzo promijeniti očekivanja. Tržište već velikim dijelom uračunava oprezniji Fed.',
    confidence: 'Srednja sigurnost',
    accent: 'lime',
    featured: true,
    link: 'https://www.reuters.com/markets/us/',
  },
  {
    id: 'nvidia-demand',
    category: 'Kompanije',
    source: 'Financial Times',
    sourceShort: 'FT',
    published: 'Jučer, 18:16',
    readTime: '3 min',
    company: 'NVIDIA',
    ticker: 'NVDA',
    original: 'Nvidia customers keep building AI capacity despite chip supply easing',
    title: 'Nvidijini kupci i dalje šire AI kapacitete, ali letvica je sve viša',
    summary:
      'Veliki cloud igrači nastavljaju ulagati u podatkovne centre. To podupire potražnju za čipovima, no očekivanja oko rasta više nisu skromna.',
    direction: 'positive',
    pressure: 'Mogući pritisak prema gore, uz visoka očekivanja',
    why: 'Kontinuirana kapitalna ulaganja najvećih cloud kompanija stvaraju vidljivost za prihod od AI infrastrukture.',
    risks: 'Valuacija ostavlja manje prostora za razočaranje. Izvozna ograničenja i koncentracija kupaca ostaju ključne nepoznanice.',
    confidence: 'Srednje-visoka sigurnost',
    accent: 'coral',
    link: 'https://www.ft.com/technology',
  },
  {
    id: 'euro-stoxx',
    category: 'Tržišta',
    source: 'Bloomberg',
    sourceShort: 'BLOOMBERG',
    published: 'Jučer, 16:52',
    readTime: '5 min',
    company: 'Euro Stoxx 50',
    ticker: 'SX5E',
    original: 'European stocks pause near highs as investors reassess earnings outlook',
    title: 'Europske burze zastale blizu rekorda; fokus se vraća na zarade',
    summary:
      'Nakon snažnog početka mjeseca ulagači uzimaju predah i traže potvrdu u rezultatima kompanija, osobito u industriji i bankama.',
    direction: 'mixed',
    pressure: 'Neutralno do blago prema dolje',
    why: 'Cijene već traže konkretan rast dobiti, a prostor za pozitivno iznenađenje sužava se kako indeksi rastu.',
    risks: 'Kretanje prinosa i geopolitičke vijesti mogu nadjačati mikro sliku pojedinih kompanija.',
    confidence: 'Srednja sigurnost',
    accent: 'blue',
    link: 'https://www.bloomberg.com/markets',
  },
  {
    id: 'adidas-margin',
    category: 'Kompanije',
    source: 'The Wall Street Journal',
    sourceShort: 'WSJ',
    published: 'Jučer, 14:08',
    readTime: '3 min',
    company: 'Adidas',
    ticker: 'ADS.DE',
    original: 'Adidas lifts outlook as full-price sales improve in North America',
    title: 'Adidas podigao očekivanja nakon boljeg trenda prodaje po punoj cijeni',
    summary:
      'Njemački proizvođač sportske opreme vidi zdraviju prodaju u Sjevernoj Americi i manji pritisak popusta, što bi moglo pomoći maržama.',
    direction: 'positive',
    pressure: 'Mogući pritisak prema gore',
    why: 'Prodaja po punoj cijeni izravnije se prelijeva u bruto maržu od rasta prihoda kroz akcije.',
    risks: 'Potrošačka potražnja ostaje osjetljiva na kamate, a usporedna baza postaje teža u drugoj polovici godine.',
    confidence: 'Srednja sigurnost',
    accent: 'amber',
    link: 'https://www.wsj.com/business',
  },
  {
    id: 'eu-cars',
    category: 'Regija',
    source: 'CNBC',
    sourceShort: 'CNBC',
    published: 'Jučer, 11:31',
    readTime: '4 min',
    company: 'Europska auto-industrija',
    original: 'Europe weighs new flexibility for automakers on EV targets',
    title: 'Bruxelles razmatra fleksibilniji put do ciljeva za električna vozila',
    summary:
      'Moguće prilagodbe rasporeda dale bi proizvođačima više vremena za prijelaz, ali ne rješavaju pitanje slabe potražnje i kineske konkurencije.',
    direction: 'mixed',
    pressure: 'Moguće kratkoročno olakšanje',
    why: 'Više fleksibilnosti može smanjiti rizik kazni i neprodanih zaliha, posebno za proizvođače s manjim EV portfeljem.',
    risks: 'Regulatorni prijedlog još nije konačan, a dugoročni trošak ulaganja u elektrifikaciju ostaje nepromijenjen.',
    confidence: 'Niža sigurnost',
    accent: 'violet',
    link: 'https://www.cnbc.com/europe/',
  },
  {
    id: 'oil-route',
    category: 'Tržišta',
    source: 'Reuters',
    sourceShort: 'REUTERS',
    published: 'Jučer, 09:05',
    readTime: '2 min',
    company: 'Brent nafta',
    ticker: 'BRN',
    original: 'Oil steadies as traders weigh supply risks against softer demand signals',
    title: 'Nafta miruje: rizik ponude suprotstavlja se mekšoj potražnji',
    summary:
      'Cijena Brenta ostaje u uskom rasponu. Trgovci važu moguće poremećaje opskrbe i signale usporavanja industrijske potražnje.',
    direction: 'mixed',
    pressure: 'Nejasan smjer za energetske dionice',
    why: 'Nafta je važan ulazni trošak za industriju, ali i izvor prihoda za proizvođače energije.',
    risks: 'Jedna geopolitička vijest može naglo proširiti raspon kretanja. Potražnja ovisi o globalnom rastu.',
    confidence: 'Niža sigurnost',
    accent: 'navy',
    link: 'https://www.reuters.com/business/energy/',
  },
];

const categories: Category[] = ['Sve', 'Tržišta', 'Kompanije', 'Makro', 'Regija'];
const queryClient = new QueryClient();

function sourceShortName(source: string): string {
  const shortcuts: Record<string, string> = {
    'Yahoo Finance': 'YAHOO',
    Investopedia: 'INVESTOPEDIA',
    Bloomberg: 'BLOOMBERG',
    Benzinga: 'BENZINGA',
    'Stock Analysis': 'STOCK ANALYSIS',
    'Investing.com': 'INVESTING',
  };
  return shortcuts[source] ?? source.toUpperCase();
}

function categoryForItem(item: NewsItem): Exclude<Category, 'Sve'> {
  const searchable = `${item.originalTitle} ${item.translatedTitle} ${item.company}`.toLowerCase();
  if (/(fed|ecb|kamate|inflacij|interest rate|central bank|monetary)/.test(searchable)) {
    return 'Makro';
  }
  if (/(europe|europa|eurozone|germany|njema|brussels|bruxelles)/.test(searchable)) {
    return 'Regija';
  }
  if (item.ticker || item.company) {
    return 'Kompanije';
  }
  return 'Tržišta';
}

function publishedLabel(publishedAt: string | null): string {
  if (!publishedAt) return 'Novo';
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return publishedAt;
  return date.toLocaleString('hr-HR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function mapNewsItem(item: NewsItem, index: number): Story {
  const accents = ['lime', 'coral', 'blue', 'amber', 'violet', 'navy'] as const;
  return {
    id: item.id,
    category: categoryForItem(item),
    source: item.source,
    sourceShort: sourceShortName(item.source),
    published: publishedLabel(item.publishedAt),
    readTime: item.readTime,
    company: item.company || 'Tržište',
    ticker: item.ticker ?? undefined,
    original: item.originalTitle,
    title: item.translatedTitle,
    summary: item.summary,
    direction: item.direction,
    pressure: item.pressure,
    why: item.why,
    risks: item.risks,
    confidence: item.confidence,
    accent: accents[index % accents.length],
    featured: index === 0,
    link: item.articleUrl,
  };
}

function DirectionMark({ direction }: { direction: Direction }) {
  if (direction === 'positive') return <TrendingUp size={14} strokeWidth={2.5} />;
  if (direction === 'negative') return <TrendingDown size={14} strokeWidth={2.5} />;
  return <span className="direction-dash">—</span>;
}

function StoryMeta({ story }: { story: Story }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
      <span className="font-mono-ui font-bold text-foreground">{story.sourceShort}</span>
      <span className="h-1 w-1 rounded-full bg-border" />
      <span>{story.published}</span>
      <span className="h-1 w-1 rounded-full bg-border" />
      <span className="inline-flex items-center gap-1"><Clock3 size={11} /> {story.readTime}</span>
    </div>
  );
}

function BookmarkButton({
  saved,
  onClick,
  id,
}: {
  saved: boolean;
  onClick: () => void;
  id: string;
}) {
  return (
    <button
      type="button"
      className={`bookmark-button ${saved ? 'is-saved' : ''}`}
      onClick={onClick}
      aria-label={saved ? 'Ukloni iz spremljenih' : 'Spremi članak'}
      data-testid={`button-bookmark-${id}`}
    >
      {saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
    </button>
  );
}

function NewsHome() {
  const [activeCategory, setActiveCategory] = useState<Category>('Sve');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [currentStories, setCurrentStories] = useState<Story[]>(stories);
  const [savedStories, setSavedStories] = useState<string[]>([]);
  const [expandedStory, setExpandedStory] = useState<string | null>(null);
  const [refreshLabel, setRefreshLabel] = useState('Osvježi pregled');
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [sourceWarnings, setSourceWarnings] = useState<string[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [newsletterSent, setNewsletterSent] = useState(false);
  const refreshMutation = useRefreshNews();

  const filteredStories = useMemo(() => {
    const normalized = searchQuery.toLowerCase().trim();
    return currentStories.filter((story) => {
      const matchesCategory = activeCategory === 'Sve' || story.category === activeCategory;
      const searchable = `${story.title} ${story.original} ${story.company} ${story.source}`.toLowerCase();
      return matchesCategory && (!normalized || searchable.includes(normalized));
    });
  }, [activeCategory, currentStories, searchQuery]);

  const toggleSaved = (id: string) => {
    setSavedStories((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const refreshBriefing = () => {
    if (refreshMutation.isPending) return;
    setRefreshError(null);
    setRefreshLabel('Provjeravam izvore…');
    refreshMutation.mutate(undefined, {
      onSuccess: (data) => {
        setCurrentStories(data.items.map(mapNewsItem));
        setSourceWarnings(data.warnings);
        setRefreshLabel(`Osvježeno u ${new Date(data.refreshedAt).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}`);
        window.setTimeout(() => setRefreshLabel('Osvježi pregled'), 2600);
      },
      onError: (error) => {
        const message = error instanceof Error ? error.message : 'Osvježavanje nije uspjelo.';
        setRefreshError(message);
        setRefreshLabel('Pokušaj ponovno');
      },
    });
  };

  const submitNewsletter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;
    setNewsletterSent(true);
  };

  return (
      <div className="min-h-[100dvh] overflow-x-hidden">
      <div className="topline">
        <div className="shell flex items-center justify-between gap-4">
          <p><span className="live-dot" /> Jutarnji pregled · Ručno osvježavanje izvora</p>
          <p className="hidden sm:block">Sadržaj je informativan, ne financijski savjet</p>
        </div>
      </div>

      <header className="site-header">
        <div className="shell header-inner">
          <a href="#vrh" className="brand" data-testid="link-home">
            <span className="brand-mark">DS</span>
            <span className="brand-copy"><strong>Dionice</strong><em>sažeto</em></span>
          </a>
          <nav className="desktop-nav" aria-label="Glavna navigacija">
            <a href="#pregled" data-testid="link-nav-pregled">Pregled dana</a>
            <a href="#price" data-testid="link-nav-price">Cijene</a>
            <a href="#objašnjeno" data-testid="link-nav-objasnjeno">Objašnjeno</a>
            <a href="#newsletter" data-testid="link-nav-newsletter">Newsletter</a>
          </nav>
          <div className="header-actions">
            {searchOpen && (
              <div className="search-field-wrap animate-rise">
                <Search size={16} />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Pretraži priče"
                  aria-label="Pretraži priče"
                  autoFocus
                  data-testid="input-search"
                />
                <button type="button" onClick={() => { setSearchOpen(false); setSearchQuery(''); }} aria-label="Zatvori pretragu" data-testid="button-close-search"><X size={15} /></button>
              </div>
            )}
            {!searchOpen && (
              <button type="button" className="icon-button" onClick={() => setSearchOpen(true)} aria-label="Otvori pretragu" data-testid="button-open-search"><Search size={19} /></button>
            )}
             <button type="button" className="refresh-button header-refresh" onClick={refreshBriefing} disabled={refreshMutation.isPending} data-testid="button-refresh-header">
               <RefreshCw size={15} className={refreshMutation.isPending ? 'spin' : ''} />
              <span className="hidden sm:inline">{refreshLabel}</span>
            </button>
            <button type="button" className="icon-button mobile-menu-trigger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Otvori izbornik" data-testid="button-mobile-menu">
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <nav className="mobile-nav shell animate-rise" aria-label="Mobilna navigacija">
            <a href="#pregled" onClick={() => setMobileMenuOpen(false)} data-testid="link-mobile-pregled">Pregled dana</a>
            <a href="#price" onClick={() => setMobileMenuOpen(false)} data-testid="link-mobile-price">Cijene</a>
            <a href="#objašnjeno" onClick={() => setMobileMenuOpen(false)} data-testid="link-mobile-objasnjeno">Objašnjeno</a>
            <a href="#newsletter" onClick={() => setMobileMenuOpen(false)} data-testid="link-mobile-newsletter">Newsletter</a>
          </nav>
        )}
      </header>

      <main id="vrh">
        <section className="market-strip" id="price">
          <div className="shell market-strip-inner">
            <div className="market-label"><BarChart3 size={15} /> Brzi pogled</div>
            <div className="market-items">
              <div><span>S&P 500</span><strong>5.447,87</strong><b className="up">+0,25%</b></div>
              <div><span>NASDAQ</span><strong>17.608,44</strong><b className="up">+0,36%</b></div>
              <div><span>STOXX 600</span><strong>518,78</strong><b className="down">−0,18%</b></div>
              <div className="market-item-desktop"><span>EUR / USD</span><strong>1,0734</strong><b className="down">−0,12%</b></div>
              <div className="market-item-desktop"><span>Brent</span><strong>82,14</strong><b className="up">+0,42%</b></div>
            </div>
            <span className="market-time">Podaci · 08:02 CET</span>
          </div>
        </section>

        <section className="hero shell" id="pregled">
          <div className="hero-intro animate-rise">
            <div>
              <p className="eyebrow"><span className="eyebrow-line" /> Prije prvog sastanka</p>
              <h1>Što danas<br /><i>pomjera</i> tržište?</h1>
            </div>
            <div className="hero-note">
              <p>Bez buke. Bez predviđanja koja glume sigurnost. Samo kontekst koji možete pročitati uz prvu kavu.</p>
              <button type="button" onClick={refreshBriefing} className="text-link" data-testid="button-refresh-hero">
                 {refreshMutation.isPending ? 'Dohvaćam izvore…' : 'Osvježi jutarnji pregled'} <ArrowRight size={15} />
              </button>
            </div>
          </div>

          <div className="hero-grid">
            <article className="lead-story animate-rise animate-rise-delay-1">
              <div className="story-art">
                <div className="art-grid" />
                <div className="art-orbit art-orbit-one" />
                <div className="art-orbit art-orbit-two" />
                <div className="art-label">MARKET<br />OPEN</div>
                <span className="art-number">01</span>
              </div>
              <div className="lead-story-body">
                 <StoryMeta story={currentStories[0]} />
                <div className="story-heading-row">
                  <div>
                     <span className="category-label">{currentStories[0].category} · {currentStories[0].company}</span>
                     <h2>{currentStories[0].title}</h2>
                  </div>
                   <BookmarkButton saved={savedStories.includes(currentStories[0].id)} onClick={() => toggleSaved(currentStories[0].id)} id={currentStories[0].id} />
                </div>
                 <p className="original-headline">“{currentStories[0].original}”</p>
                 <p className="story-summary">{currentStories[0].summary}</p>
                <div className="impact-row">
                   <span className={`direction-pill ${currentStories[0].direction}`}><DirectionMark direction={currentStories[0].direction} /> {currentStories[0].direction === 'mixed' ? 'MJEŠOVITO' : currentStories[0].direction === 'negative' ? 'NEGATIVNO' : 'POZITIVNO'}</span>
                   <span className="impact-copy">{currentStories[0].pressure}</span>
                </div>
                 <button type="button" className="story-link" onClick={() => setExpandedStory(expandedStory === currentStories[0].id ? null : currentStories[0].id)} data-testid="button-expand-fed-patience">
                   {expandedStory === currentStories[0].id ? 'Sakrij analizu' : 'Pročitaj analizu'} <ArrowUpRight size={16} />
                </button>
                 {expandedStory === currentStories[0].id && <Analysis story={currentStories[0]} />}
              </div>
            </article>

            <aside className="side-brief animate-rise animate-rise-delay-2">
              <div className="section-kicker"><span>Danas u fokusu</span><span className="font-mono-ui">03 priče</span></div>
              <div className="side-brief-list">
                 {currentStories.slice(1, 4).map((story, index) => (
                  <article className="mini-story" key={story.id}>
                    <span className={`mini-index mini-${story.accent}`}>0{index + 2}</span>
                    <div className="min-w-0">
                      <StoryMeta story={story} />
                      <h3>{story.title}</h3>
                      <span className="mini-company">{story.company}{story.ticker ? ` · ${story.ticker}` : ''}</span>
                    </div>
                    <BookmarkButton saved={savedStories.includes(story.id)} onClick={() => toggleSaved(story.id)} id={story.id} />
                  </article>
                ))}
              </div>
              <div className="side-note">
                <CircleAlert size={17} />
                 <p>{sourceWarnings.length > 0 ? sourceWarnings[0] : 'Kliknite osvježavanje za dohvat najnovijih vijesti iz odabranih izvora.'}</p>
              </div>
            </aside>
          </div>
        </section>

        <section className="signal-band">
          <div className="shell signal-grid">
            <div className="signal-intro"><span className="eyebrow-line" /><span>Na radaru</span></div>
            <div className="signal-item"><span>01</span><strong>Kamate</strong><p>Fed ostaje oprezan</p></div>
            <div className="signal-item"><span>02</span><strong>AI ulaganja</strong><p>Potražnja još drži</p></div>
            <div className="signal-item"><span>03</span><strong>Europa</strong><p>Zarade su test</p></div>
            <div className="signal-quote">“Prvo razumij. Onda odluči.”</div>
          </div>
        </section>

        <section className="shell latest-section" id="objašnjeno">
          <div className="section-header">
            <div>
              <p className="eyebrow"><span className="eyebrow-line" /> Sve na jednom mjestu</p>
              <h2>Najnovije, <i>sažeto.</i></h2>
            </div>
            <div className="section-actions">
              <span className="saved-count"><Bookmark size={14} /> {savedStories.length} spremljeno</span>
               <button type="button" className="refresh-button" onClick={refreshBriefing} disabled={refreshMutation.isPending} data-testid="button-refresh-latest">
                 <RefreshCw size={15} className={refreshMutation.isPending ? 'spin' : ''} /> <span>{refreshLabel}</span>
              </button>
            </div>
          </div>
           {refreshError && <div className="refresh-error" role="alert"><CircleAlert size={15} /> {refreshError}</div>}

          <div className="filter-row">
            <div className="category-filters" role="tablist" aria-label="Filtriraj po kategoriji">
              {categories.map((category) => (
                <button
                  type="button"
                  key={category}
                  className={activeCategory === category ? 'filter-chip active' : 'filter-chip'}
                  onClick={() => setActiveCategory(category)}
                  role="tab"
                  aria-selected={activeCategory === category}
                  data-testid={`button-filter-${category.toLowerCase()}`}
                >
                  {category}
                </button>
              ))}
            </div>
             <div className="filter-label"><Filter size={14} /> {filteredStories.length} od {currentStories.length} priča</div>
          </div>

          {filteredStories.length > 0 ? (
            <div className="stories-list">
              {filteredStories.map((story, index) => (
                <article className={`story-row story-accent-${story.accent} ${expandedStory === story.id ? 'is-expanded' : ''}`} key={story.id} data-testid={`card-story-${story.id}`}>
                  <div className="story-row-index">{String(index + 1).padStart(2, '0')}</div>
                  <div className="story-row-main">
                    <StoryMeta story={story} />
                    <div className="story-row-title">
                      <div>
                        <span className="category-label">{story.category} <span className="dot-separator">·</span> {story.company}{story.ticker ? ` / ${story.ticker}` : ''}</span>
                        <h3>{story.title}</h3>
                      </div>
                      <BookmarkButton saved={savedStories.includes(story.id)} onClick={() => toggleSaved(story.id)} id={story.id} />
                    </div>
                    <p className="original-line">{story.original}</p>
                    <p className="story-summary">{story.summary}</p>
                    <div className="story-row-footer">
                      <span className={`direction-pill ${story.direction}`}><DirectionMark direction={story.direction} /> {story.direction === 'positive' ? 'POZITIVNO' : story.direction === 'negative' ? 'NEGATIVNO' : 'MJEŠOVITO'}</span>
                      <span className="pressure-text">{story.pressure}</span>
                      <button type="button" className="analysis-toggle" onClick={() => setExpandedStory(expandedStory === story.id ? null : story.id)} data-testid={`button-analysis-${story.id}`}>
                        {expandedStory === story.id ? 'Sakrij' : 'Analiza'} <ChevronDown size={14} className={expandedStory === story.id ? 'rotate-180' : ''} />
                      </button>
                      <a className="source-link" href={story.link} target="_blank" rel="noreferrer" data-testid={`link-source-${story.id}`}>Izvor <ExternalLink size={12} /></a>
                    </div>
                    {expandedStory === story.id && <Analysis story={story} />}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-results">
              <Search size={22} />
              <h3>Nema priča za ovaj filter</h3>
              <p>Pokušajte s drugim pojmom ili vratite sve kategorije.</p>
              <button type="button" className="text-link" onClick={() => { setSearchQuery(''); setActiveCategory('Sve'); }} data-testid="button-reset-filters">Očisti filtere <ArrowRight size={15} /></button>
            </div>
          )}
        </section>

        <section className="disclaimer-section shell">
           <div className="disclaimer-card">
            <div className="disclaimer-icon"><ShieldAlert size={22} /></div>
            <div>
              <p className="eyebrow">Kako čitati ovaj pregled</p>
              <h2>Smjer nije prognoza.</h2>
              <p>Oznake pozitivno, negativno i mješovito opisuju mogući pritisak na sentiment, ne garantiraju kretanje cijene. Svaka analiza je informativna i nije financijski savjet.</p>
            </div>
             <div className="disclaimer-stat"><strong>6</strong><span>izvora<br />u praćenju</span></div>
          </div>
        </section>

        <section className="newsletter-section" id="newsletter">
          <div className="shell newsletter-inner">
            <div className="newsletter-copy">
              <p className="eyebrow"><span className="eyebrow-line" /> Dnevno, prije tržišta</p>
              <h2>Vaših <i>10 minuta</i><br />za pametniji početak.</h2>
              <p>Jedan jasan email s pričama koje vrijedi razumjeti. Bez spam-a, bez signala za kupnju.</p>
            </div>
            {newsletterSent ? (
              <div className="newsletter-success animate-rise" data-testid="status-newsletter-success">
                <span className="success-mark"><Check size={19} /></span>
                <div><strong>Vidimo se u inboxu.</strong><p>Demo prijava za <b>{email}</b> je zapamćena na ovoj stranici.</p></div>
              </div>
            ) : (
              <form className="newsletter-form" onSubmit={submitNewsletter}>
                <label htmlFor="newsletter-email">Vaša email adresa</label>
                <div className="newsletter-input-row">
                  <Mail size={17} />
                  <input id="newsletter-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ime@email.com" required data-testid="input-newsletter-email" />
                  <button type="submit" data-testid="button-newsletter-submit">Prijavi me <ArrowRight size={16} /></button>
                </div>
                <small>Jednom dnevno, radnim danom. Odjava jednim klikom.</small>
              </form>
            )}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="shell footer-inner">
          <a href="#vrh" className="brand footer-brand" data-testid="link-footer-home"><span className="brand-mark">DS</span><span className="brand-copy"><strong>Dionice</strong><em>sažeto</em></span></a>
          <p>Čitaj manje. Razumij više.</p>
          <div className="footer-meta"><span>© 2026 Dionice sažeto</span><span>Osvježavanje po kliku · AI sažetak</span></div>
        </div>
      </footer>
      </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NewsHome />
    </QueryClientProvider>
  );
}

function Analysis({ story }: { story: Story }) {
  return (
    <div className="analysis-box animate-rise" data-testid={`panel-analysis-${story.id}`}>
      <div className="analysis-header"><span><BarChart3 size={15} /> Kako to čitamo</span><span className={`confidence ${story.direction}`}>{story.confidence}</span></div>
      <div className="analysis-grid">
        <div><span>Zašto je važno</span><p>{story.why}</p></div>
        <div><span>Rizici i nepoznanice</span><p>{story.risks}</p></div>
      </div>
      <div className="analysis-disclaimer"><ShieldAlert size={14} /> Procjena je oprezna interpretacija javnih informacija, ne preporuka za ulaganje.</div>
    </div>
  );
}

export default App;
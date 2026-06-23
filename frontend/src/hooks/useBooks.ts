import { useCallback, useEffect, useState } from 'react';
import {
  ask as askBook,
  deleteBook,
  generateArtifact,
  generateCover,
  getArtifacts,
  getBook,
  listBooks,
  overview as fetchOverview,
  saveInsight as saveInsightApi,
  skeleton as fetchSkeleton,
  startMode as startModeApi,
  syntopical as syntopicalApi,
  uploadBook,
  type ArtifactKind,
  type AskSource,
  type AskTurn,
  type BookDetail,
  type BookOut,
  type CompanionMode,
  type SyntopicalResult,
} from '../api/books';

// One chat turn in the AI 伴读 panel: user questions have no sources, AI answers
// carry the cited chapters. The conversation spans the whole selected book.
export type ChatMessage = { role: 'user' | 'ai'; text: string; sources?: AskSource[] };

// Prior chat turns become {role,text} history for mode-aware asks; 'ai' → 'assistant'.
const toHistory = (msgs: ChatMessage[]): AskTurn[] =>
  msgs.map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', text: m.text }));

// Each 伴读 mode (问答 / 苏格拉底 / 费曼) owns its own conversation thread.
const emptyChats = (): Record<CompanionMode, ChatMessage[]> => ({ qa: [], socratic: [], feynman: [] });

// View-local state for the books pane: the shelf, the selected book (detail with
// chapter TOC), its generated 速览/精读骨架, and the per-mode 伴读 chats. Server-backed,
// no localStorage — fetch + useState, the workspace re-derives from activeId.
export function useBooks() {
  const [books, setBooks] = useState<BookOut[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [book, setBook] = useState<BookDetail | null>(null);
  const [overview, setOverview] = useState<string | null>(null);
  const [skeleton, setSkeleton] = useState<string | null>(null);
  const [mode, setModeState] = useState<CompanionMode>('qa');
  // Per-mode chat threads (separate tabs); the visible `chat` is the active mode's.
  const [chats, setChats] = useState<Record<CompanionMode, ChatMessage[]>>(emptyChats);
  const chat = chats[mode];
  const [listLoading, setListLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [overviewBusy, setOverviewBusy] = useState(false);
  const [skeletonBusy, setSkeletonBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  // 学习物料: cached artifact Markdown per kind + a per-kind generating flag.
  const [artifacts, setArtifacts] = useState<Partial<Record<ArtifactKind, string>>>({});
  const [artifactBusy, setArtifactBusy] = useState<Record<ArtifactKind, boolean>>({
    glossary: false,
    mindmap: false,
    summary: false,
  });
  // 主题阅读 (syntopical / cross-book): a shelf-level session, separate from the
  // single-book select() state. syntSelected = chosen book ids ([] = whole shelf).
  const [syntopicalMode, setSyntopicalMode] = useState(false);
  const [syntSelected, setSyntSelected] = useState<string[]>([]);
  const [syntQuestion, setSyntQuestion] = useState('');
  const [syntResult, setSyntResult] = useState<SyntopicalResult | null>(null);
  const [syntBusy, setSyntBusy] = useState(false);

  const load = useCallback(() => {
    setListLoading(true);
    listBooks()
      .then(setBooks)
      .catch(() => setBooks([]))
      .finally(() => setListLoading(false));
  }, []);

  useEffect(load, [load]);

  // Selecting a book swaps the whole workspace: load its detail and reset the
  // per-book AI state (速览/骨架/chat don't carry across books).
  const select = useCallback((id: string) => {
    setActiveId(id);
    setOverview(null);
    setSkeleton(null);
    setChats(emptyChats());
    setModeState('qa');
    setArtifacts({});
    getBook(id)
      .then(setBook)
      .catch(() => setBook(null));
    // Hydrate cached 学习物料 for the selected book.
    getArtifacts(id)
      .then(setArtifacts)
      .catch(() => setArtifacts({}));
  }, []);

  const upload = (file: File) => {
    setUploading(true);
    return uploadBook(file.name, file)
      .then((b) => {
        load();
        setActiveId(b.id);
        setBook(b);
        setOverview(null);
        setSkeleton(null);
        setChats(emptyChats());
        setModeState('qa');
        setArtifacts({});
        return b;
      })
      .finally(() => setUploading(false));
  };

  const genCover = (id: string) => {
    setCoverBusy(true);
    return generateCover(id)
      .then((r) => {
        load(); // a freshly generated cover flips cover_url on the shelf row
        return r.cover_url;
      })
      .finally(() => setCoverBusy(false));
  };

  const runOverview = () => {
    if (!activeId) return Promise.resolve(null);
    setOverviewBusy(true);
    return fetchOverview(activeId)
      .then((r) => {
        setOverview(r.overview);
        return r.overview;
      })
      .finally(() => setOverviewBusy(false));
  };

  const runSkeleton = () => {
    if (!activeId) return Promise.resolve(null);
    setSkeletonBusy(true);
    return fetchSkeleton(activeId)
      .then((r) => {
        setSkeleton(r.skeleton);
        return r.skeleton;
      })
      .finally(() => setSkeletonBusy(false));
  };

  const ask = (question: string) => {
    const text = question.trim();
    if (!activeId || !text || asking) return Promise.resolve();
    const m = mode; // pin the thread this ask belongs to (mode may switch mid-flight)
    const history = toHistory(chats[m]);
    setChats((prev) => ({ ...prev, [m]: [...prev[m], { role: 'user', text }] }));
    setAsking(true);
    return askBook(activeId, { question: text, mode: m, history })
      .then((r) => {
        setChats((prev) => ({ ...prev, [m]: [...prev[m], { role: 'ai', text: r.answer, sources: r.sources }] }));
      })
      .catch(() => {
        setChats((prev) => ({ ...prev, [m]: [...prev[m], { role: 'ai', text: '问答失败,请稍后再试。' }] }));
      })
      .finally(() => setAsking(false));
  };

  // Switching mode just shows that mode's tab — always instant, never blocked. The
  // opening turn (socratic question / feynman prompt) is posted ONCE, only when its
  // thread is still empty; re-entering shows the existing conversation, no pile-up.
  const setMode = (m: CompanionMode) => {
    if (!activeId || m === mode) return Promise.resolve();
    setModeState(m);
    if (m === 'qa' || chats[m].length > 0) return Promise.resolve();
    return startModeApi(activeId, m)
      .then((r) => {
        if (r.answer) setChats((prev) => ({ ...prev, [m]: [...prev[m], { role: 'ai', text: r.answer }] }));
      })
      .catch(() => {});
  };

  // Persist a companion message into the KB vault as a note.
  const saveInsight = (text: string, chapter?: string) => {
    if (!activeId || !text.trim()) return Promise.resolve(null);
    return saveInsightApi(activeId, { text, chapter }).catch(() => null);
  };

  // 学习物料: generate (or regenerate) one artifact kind and cache its Markdown.
  const genArtifact = (kind: ArtifactKind) => {
    if (!activeId) return Promise.resolve(null);
    setArtifactBusy((prev) => ({ ...prev, [kind]: true }));
    return generateArtifact(activeId, kind)
      .then((r) => {
        setArtifacts((prev) => ({ ...prev, [kind]: r.content }));
        return r.content;
      })
      .catch(() => null)
      .finally(() => setArtifactBusy((prev) => ({ ...prev, [kind]: false })));
  };

  // 主题阅读: enter/leave the cross-book mode. Entering keeps any prior selection;
  // leaving keeps the shelf otherwise normal (single-book select() is untouched).
  const toggleSyntopical = () => setSyntopicalMode((prev) => !prev);

  // Add/remove a book id from the syntopical selection ([] = whole shelf).
  const toggleSyntBook = (id: string) =>
    setSyntSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  // Synthesize across the selected books (or the whole shelf when none chosen).
  const runSyntopical = (question: string) => {
    const text = question.trim();
    if (!text || syntBusy) return Promise.resolve();
    setSyntQuestion(text);
    setSyntBusy(true);
    return syntopicalApi(text, syntSelected)
      .then((r) => setSyntResult(r))
      .catch(() => setSyntResult(null))
      .finally(() => setSyntBusy(false));
  };

  const remove = (id: string) =>
    deleteBook(id).then(() => {
      if (activeId === id) {
        setActiveId(null);
        setBook(null);
        setOverview(null);
        setSkeleton(null);
        setChats(emptyChats());
        setModeState('qa');
        setArtifacts({});
      }
      load();
    });

  return {
    books,
    activeId,
    book,
    overview,
    skeleton,
    chat,
    mode,
    listLoading,
    uploading,
    coverBusy,
    overviewBusy,
    skeletonBusy,
    asking,
    artifacts,
    artifactBusy,
    syntopicalMode,
    syntSelected,
    syntQuestion,
    syntResult,
    syntBusy,
    load,
    select,
    upload,
    genCover,
    runOverview,
    runSkeleton,
    ask,
    setMode,
    saveInsight,
    genArtifact,
    toggleSyntopical,
    toggleSyntBook,
    runSyntopical,
    remove,
  };
}

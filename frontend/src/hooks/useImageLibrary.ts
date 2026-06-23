import { useEffect, useState } from 'react';
import {
  generateImage,
  copyToLibrary,
  deleteImage,
  type GenerateRequest,
  type ImgParams,
  type LibraryEntry,
} from '../api/imagegen';
import { readLS } from './useSessions';

const LS_LIBRARY = 'snowan.imagegen.library';

// Thread-less image generation: the chat thread (useChat) owns the conversation;
// this hook only owns the persisted 收藏 library and a fire-and-return generate.
// The backend owns image bytes, so copy-to-library mints an independent id and
// deletes cascade through it before dropping local references.
export function useImageLibrary() {
  const [library, setLibrary] = useState<LibraryEntry[]>(() =>
    readLS<LibraryEntry[]>(LS_LIBRARY, []),
  );

  useEffect(() => {
    localStorage.setItem(LS_LIBRARY, JSON.stringify(library));
  }, [library]);

  // Generate, auto-save each result to the library (copied to an independent id),
  // and return the original generated ids for the chat block to render.
  const generate = async (
    prompt: string,
    params: ImgParams,
    refs: string[],
  ): Promise<string[]> => {
    const req: GenerateRequest = {
      prompt,
      size: params.size,
      n: params.n,
      provider: null,
      model: null,
      reference_images: refs,
    };
    const res = await generateImage(req);
    const ids = res.images.map((im) => im.id);
    for (const id of ids) {
      const { id: previewId } = await copyToLibrary(id);
      setLibrary((prev) => [
        { id: crypto.randomUUID(), prompt, params, previewId },
        ...prev,
      ]);
    }
    return ids;
  };

  const removeLibrary = (entry: LibraryEntry) => {
    deleteImage(entry.previewId).catch(() => {});
    setLibrary((prev) => prev.filter((e) => e.id !== entry.id));
  };

  return { library, generate, removeLibrary };
}

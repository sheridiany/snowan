import { useState } from 'react';

import { type NavProps } from '../shell/ListPane';
import DetailPane from '../../ui/DetailPane';
import ImgSessionList from '../draw/ImgSessionList';
import ImgConversation from '../draw/ImgConversation';
import ImgInputBar from '../draw/ImgInputBar';
import ImgLibraryPanel from '../draw/ImgLibraryPanel';
import { useImagegen, type ImgParams } from '../../hooks/useImagegen';
import { imageFileUrl } from '../../api/imagegen';

const DEFAULT_PARAMS: ImgParams = { size: 'auto', n: 1 };

// Trigger a browser download of a generated image by its backend id.
function download(imageId: string) {
  const a = document.createElement('a');
  a.href = imageFileUrl(imageId);
  a.download = `${imageId}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function DrawView({
  view,
  onView,
  listCollapsed,
}: NavProps & { listCollapsed?: boolean }) {
  const img = useImagegen();
  const [prompt, setPrompt] = useState('');
  const [params, setParams] = useState<ImgParams>(DEFAULT_PARAMS);

  // The active turn is pending while its generate() promise is in flight.
  const busy = img.turns.some((t) => t.status === 'pending');

  const submit = (referenceImages: string[]) => {
    const text = prompt.trim();
    if (!text || busy) return;
    setPrompt('');
    // Provider/model are resolved server-side from active_image when null.
    img.generate(text, params, null, null, referenceImages);
  };

  return (
    <>
      {!listCollapsed && (
        <ImgSessionList
          view={view}
          onView={onView}
          onNewChat={img.addSession}
          sessions={img.sessions}
          activeId={img.activeId}
          onSelect={img.setActiveId}
          onRename={img.rename}
          onDelete={img.removeSession}
          imageCount={img.imageCount}
        />
      )}

      <DetailPane title="画图">
        <ImgConversation
          turns={img.turns}
          onSave={img.saveToLibrary}
          onDownload={download}
          onDelete={img.removeImage}
          onCopyPrompt={setPrompt}
        />
        <ImgInputBar
          value={prompt}
          onChange={setPrompt}
          params={params}
          onParamsChange={setParams}
          busy={busy}
          onSubmit={submit}
        />
      </DetailPane>

      <ImgLibraryPanel
        library={img.library}
        onUsePrompt={setPrompt}
        onDelete={img.removeLibrary}
      />
    </>
  );
}

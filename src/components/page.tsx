import { mergeRefs } from '@solid-primitives/refs';
import { PDFPageProxy } from 'pdfjs-dist';
import {
  ComponentProps,
  createEffect,
  createSignal,
  onCleanup,
  Show,
  splitProps,
} from 'solid-js';
import { useStorage } from '../data/storage';

export default function PdfPage(
  props: {
    page: number;
    width: number;
    setScaleRatio?: (value: number) => void;
  } & ComponentProps<'canvas'>
) {
  const [opts, canvasProps] = splitProps(props, [
    'page',
    'width',
    'ref',
    'children',
    'setScaleRatio',
  ]);
  const { pdf } = useStorage();

  const [page, setPage] = createSignal<PDFPageProxy>();

  // explicit dependencies because page is only used async
  createEffect(() => {
    setPage(undefined);
    if (pdf() === undefined) return;
    void pdf()!
      .getPage(opts.page + 1)
      .then(setPage)
      .catch((e) => console.error('error loading page', opts.page, e));
  });

  let canvas!: HTMLCanvasElement;

  const [dpi, setDpi] = createSignal(window.devicePixelRatio);
  const listener = () => setDpi(window.devicePixelRatio);
  window.addEventListener('resize', listener);
  onCleanup(() => window.removeEventListener('resize', listener));

  createEffect(() => {
    if (!page()) return;

    let viewport = page()!.getViewport({ scale: 1 });
    const scale = opts.width / viewport.width;
    if (scale !== 1) viewport = page()!.getViewport({ scale });
    opts.setScaleRatio?.(scale);

    // canvases don't account for dpi when rendering, so we have to tell it that it's bigger and then css it back to a normal size
    canvas.width = Math.floor(dpi() * viewport.width);
    canvas.height = Math.floor(dpi() * viewport.height);
    canvas.style.width = Math.floor(viewport.width) + 'px';
    canvas.style.height = Math.floor(viewport.height) + 'px';

    const transform = dpi() !== 1 ? [dpi(), 0, 0, dpi(), 0, 0] : undefined;

    const renderContext = {
      canvasContext: canvas.getContext('2d') as CanvasRenderingContext2D,
      transform: transform,
      viewport: viewport,
    };
    page()!.render(renderContext);
  });

  return (
    <Show when={page()}>
      <canvas {...canvasProps} ref={mergeRefs(opts.ref, (el) => (canvas = el))} />
      {opts.children}
    </Show>
  );
}

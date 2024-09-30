import { useParams } from '@solidjs/router';
import { createEffect, createSignal, JSX } from 'solid-js';
import { Alignments, TextOptions, useStorage } from '../data/storage';
import { resolveText } from '../data/variables';

const textAlignments: Record<Alignments, JSX.CSSProperties['text-align']> = {
  Left: 'left',
  Center: 'center',
  Right: 'right',
};

export default function DragText(props: {
  options: TextOptions;
  pageWidth: number;
  pageHeight: number;
  zoom: number;
  preview: boolean;
  selected: boolean;
  select: (index: number) => void;
  scrollable: HTMLDivElement;
}) {
  const { setText, options, exampleInfo } = useStorage();
  const params = useParams();
  const page = () => Number(params.page);

  let scrollX = 0;
  let scrollY = 0;

  const moveDrag = (e: MouseEvent) => {
    setText(page(), props.options.id, (options) => ({
      ...options,
      x: options.x + e.movementX / props.pageWidth,
      y: options.y + e.movementY / props.pageHeight,
    }));
    e.preventDefault();
  };

  const onMoveScroll = () => {
    setText(page(), props.options.id, (options) => ({
      ...options,
      x: options.x + (props.scrollable.scrollLeft - scrollX) / props.pageWidth,
      y: options.y + (props.scrollable.scrollTop - scrollY) / props.pageHeight,
    }));
    scrollX = props.scrollable.scrollLeft;
    scrollY = props.scrollable.scrollTop;
  };

  const [unclampedWidth, setUnclampedWidth] = createSignal(
    props.options.width * props.pageWidth
  );
  const minWidth = () => props.options.fontSize * props.zoom * 0.75;

  createEffect(() =>
    setText(page(), props.options.id, (options) => ({
      ...options,
      width: Math.max(minWidth() / props.pageWidth, options.width),
    }))
  );

  const updateWidth = () =>
    setText(page(), props.options.id, (options) => ({
      ...options,
      width: Math.max(unclampedWidth(), minWidth()) / props.pageWidth,
    }));

  const widthDrag = (e: MouseEvent) => {
    setUnclampedWidth((width) => width + e.movementX);
    updateWidth();
    e.preventDefault();
  };

  const onWidthScroll = () => {
    setUnclampedWidth((width) => width + props.scrollable.scrollLeft - scrollX);
    updateWidth();
    scrollX = props.scrollable.scrollLeft;
  };

  const select = () => props.select(props.options.id);

  // add mouseup to the document, not just the text
  const moveDragStart = () => {
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('mouseup', moveDragEnd);
    scrollX = props.scrollable.scrollLeft;
    scrollY = props.scrollable.scrollTop;
    props.scrollable.addEventListener('scroll', onMoveScroll);
    select();
  };
  const moveDragEnd = () => {
    document.removeEventListener('mousemove', moveDrag);
    document.removeEventListener('mouseup', moveDragEnd);
    props.scrollable.removeEventListener('scroll', onMoveScroll);
  };

  const widthDragStart = () => {
    document.addEventListener('mousemove', widthDrag);
    document.addEventListener('mouseup', widthDragEnd);
    scrollX = props.scrollable.scrollLeft;
    props.scrollable.addEventListener('scroll', onWidthScroll);
    select();
  };
  const widthDragEnd = () => {
    document.removeEventListener('mousemove', widthDrag);
    document.removeEventListener('mouseup', widthDragEnd);
    setUnclampedWidth(Math.max(unclampedWidth(), minWidth()));
    props.scrollable.removeEventListener('scroll', onWidthScroll);
  };

  const fontSize = () => props.options.fontSize * props.zoom;
  const lineHeight = () => props.options.lineSpacing + 1;

  // offset to fix some odd alignment issues with line height (why is 1.3 the magic value?)
  const heightOffset = () => (fontSize() * (1.3 - lineHeight())) / 2;
  const verticalPaddingOffset = () => fontSize() / 12;

  const text = () =>
    props.preview
      ? resolveText(props.options.text, options.variables, exampleInfo())
      : props.options.text;

  return (
    <div
      class="absolute hover break-words p-2 flex"
      style={{
        left: `${props.options.x * props.pageWidth}px`,
        top: `${props.options.y * props.pageHeight + verticalPaddingOffset()}px`,
        // fix position/width being offset by padding, which doesn't scale with page size
        width: `${props.options.width * props.pageWidth + 16}px`,
        transform: `translate(-8px, -8px)`,
        // other styles
        'font-size': `${fontSize()}px`,
        'line-height': lineHeight(),
        'min-height': `${fontSize() * 1.2 + 16}px`,
        // transform: `translate(0, -${props.options.fontSize * props.zoom * 1.5}px)`,
        'text-align': textAlignments[props.options.align],
        color: props.options.color,
        // guarantee same results as pdf gen
        'line-break': 'strict',
        'font-family': 'helvetica',
      }}
    >
      <div
        class="hover-hide absolute top-0 left-0 right-2 h-full cursor-move rounded-l-md"
        onMouseDown={moveDragStart}
      />
      <div
        class="hover-hide absolute top-0 right-0 h-full w-2 cursor-ew-resize rounded-r-md"
        onMouseDown={widthDragStart}
      />
      <div
        classList={{ 'hover-hide': !props.selected }}
        class="border-hl border-2 border-r-4 absolute top-0 left-0 w-full h-full rounded-md pointer-events-none bg-white bg-opacity-75"
      />
      <text
        class="relative pointer-events-none whitespace-pre-wrap w-full"
        style={{
          'margin-top': `${heightOffset() - verticalPaddingOffset()}px`,
          'margin-bottom': `${heightOffset() - verticalPaddingOffset()}px`,
        }}
      >
        {text()}
      </text>
    </div>
  );
}

import { createMemo, createSignal, ParentProps, Show } from 'solid-js';
import { createPersistentSignal } from '../data/storage';

export default function Resizable(
  props: {
    direction: 'up' | 'down' | 'left' | 'right';
    size: number;
    minSize?: number;
    maxSize?: number;
    draggerClass?: string;
    persistenceKey?: string;
  } & ParentProps
) {
  const vertical = createMemo(() => props.direction == 'up' || props.direction == 'down');
  const before = createMemo(() => props.direction == 'up' || props.direction == 'left');

  const flexDir = createMemo(() => (vertical() ? 'col' : 'row'));
  const sizeClass = createMemo(() => (vertical() ? 'h-1' : 'w-1'));
  const cursor = createMemo(() => (vertical() ? 'cursor-ns-resize' : 'cursor-ew-resize'));

  // not reactive
  const [size, setSize] = props.persistenceKey
    ? createPersistentSignal(props.persistenceKey, () => props.size, Number)
    : createSignal(props.size);

  const clamp = (size: number) => {
    size = Math.max(size, props.minSize ?? 4);
    if (props.maxSize) size = Math.min(size, props.maxSize);
    return size;
  };

  // clamp here, not in mouse event, to keep the edge and the real mouse position in sync
  const style = createMemo(() => {
    const s = clamp(size());
    return vertical() ? { height: `${s}px` } : { width: `${s}px` };
  });

  const move = (event: MouseEvent) => {
    let movement = vertical() ? event.movementY : event.movementX;
    if (before()) movement = -movement;
    setSize((prev) => prev + movement);
    event.preventDefault();
  };

  // add mouseup to the document, not just the resizer
  const remove = () => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', remove);
    // clamp here as well
    setSize(clamp(size()));
  };
  const add = () => {
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', remove);
  };

  const dragger = (
    <div
      class={`${props.draggerClass ?? 'b3'} ${sizeClass()} ${cursor()}`}
      onMouseDown={add}
      role="none"
    />
  );

  // children are responsible for doing { width/height: 100% } themselves
  return (
    <div class={`flex flex-${flexDir()}`} style={style()}>
      <Show when={before()}>{dragger}</Show>
      <div class="flex-1" classList={{ 'min-w-0': !vertical(), 'min-h-0': vertical() }}>
        {props.children}
      </div>
      <Show when={!before()}>{dragger}</Show>
    </div>
  );
}

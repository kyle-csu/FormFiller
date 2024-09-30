import { createResizeObserver } from '@solid-primitives/resize-observer';
import { useNavigate, useParams } from '@solidjs/router';
import UpIcon from '@suid/icons-material/ArrowUpward';
import CloseIcon from '@suid/icons-material/Clear';
import HomeIcon from '@suid/icons-material/Home';
import PrevIcon from '@suid/icons-material/NavigateBefore';
import NextIcon from '@suid/icons-material/NavigateNext';
import {
  Button,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Modal,
  Select,
  Switch,
  TextField,
} from '@suid/material';
import { SelectChangeEvent } from '@suid/material/Select';
import { DefaultColorPicker } from '@thednp/solid-color-picker';
import '@thednp/solid-color-picker/style.css';
import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js';
import PdfPage from '../components/page';
import Resizable from '../components/resizable';
import DragText from '../components/text';
import { savePdf } from '../data/pdf';
import {
  Alignments,
  AlignmentStrings,
  createPersistentSignal,
  TextOptions,
  useStorage,
} from '../data/storage';
import Variables from '../pages/variables';

function SelectionColumn(props: {
  selectedId?: number;
  remove: () => void;
  deselect: () => void;
}) {
  const { darkMode, options, setText } = useStorage();
  const params = useParams();
  const page = () => Number(params.page);

  const text = () =>
    props.selectedId !== undefined
      ? options.pages[page()].texts.find(({ id }) => id === props.selectedId)
      : undefined;

  const setOption = <K extends keyof TextOptions>(key: K, value: TextOptions[K]) =>
    setText(page(), props.selectedId!, (options) => ({ ...options, [key]: value }));

  const content = () => text()?.text ?? '';
  const setContent = (_: unknown, value: string) => setOption('text', value);

  const fontSize = () => text()?.fontSize ?? 0;
  // keep separate signal so that characters aren't discarded
  const [fontSizeInput, setFontSizeInput] = createSignal('');
  // reset value on new text
  createEffect(on([text], () => setFontSizeInput(String(fontSize()))));
  // set text to values as typed
  const setFontSize = (_: unknown, value: string) => {
    setFontSizeInput(value);
    setOption('fontSize', Number(value));
  };

  const lineSpace = () => text()?.lineSpacing ?? 0;
  // same as font size
  const [lineSpaceInput, setLineSpaceInput] = createSignal('');
  createEffect(on([text], () => setLineSpaceInput(String(lineSpace()))));
  const setLineSpace = (_: unknown, value: string) => {
    setLineSpaceInput(value);
    setOption('lineSpacing', Number(value));
  };

  const color = () => text()?.color ?? '#000000';
  const setColor = (value: string) => setOption('color', value);

  const align = () => text()?.align ?? 'Left';
  const setAlign = (e: SelectChangeEvent) =>
    setOption('align', e.target.value as Alignments);

  return (
    <Show when={text()}>
      <div class="w-full h-full flex flex-col gap-4 p-2">
        <TextField
          label="Text"
          variant="standard"
          multiline
          maxRows={4}
          value={content()}
          onChange={setContent}
        />
        <InputLabel variant="standard" shrink class="-mb-4 shrink-0">
          Color
        </InputLabel>
        <DefaultColorPicker
          theme={darkMode() ? 'dark' : 'light'}
          value={color()}
          onChange={setColor}
        />
        <TextField
          label="Font Size"
          variant="standard"
          type="number"
          value={fontSizeInput()}
          onChange={setFontSize}
        />
        <TextField
          label="Line Spacing"
          variant="standard"
          type="number"
          value={lineSpaceInput()}
          onChange={setLineSpace}
        />
        <FormControl variant="standard">
          <InputLabel id="color-label">Alignment</InputLabel>
          {/* why is the menu misaligned without ml-2? */}
          <Select
            labelId="color-label"
            variant="standard"
            MenuProps={{ class: 'ml-2' }}
            value={align()}
            onChange={setAlign}
          >
            <For each={AlignmentStrings}>
              {(option) => <MenuItem value={option}>{option}</MenuItem>}
            </For>
          </Select>
        </FormControl>
        <Button onClick={props.deselect}>Deselect</Button>
        <Button onClick={props.remove}>Remove</Button>
      </div>
    </Show>
  );
}

export default function Edit() {
  const params = useParams();
  const page = () => Number(params.page);
  const { pdf, options, exampleInfo, setTexts, addText, removeText } = useStorage();

  const navigate = useNavigate();

  const [variablesOpen, setVariablesOpen] = createSignal(false);

  const [width, setWidth] = createPersistentSignal('pageZoomedWidth', () => 800, Number);

  const zoomIn = () => setWidth((w) => w + 100);
  const zoomOut = () => setWidth((w) => Math.max(w - 100, 100));

  const [pageWidth, setPageWidth] = createSignal(0);
  let content!: HTMLDivElement;
  onMount(() => createResizeObserver(content, ({ width }) => setPageWidth(width)));

  const [canvasHeight, setCanvasHeight] = createSignal(0);

  const [pdfZoom, setPdfZoom] = createSignal(1);

  const [selected, setSelected] = createSignal<number>();

  const [preview, setPreview] = createPersistentSignal(
    'previewTexts',
    () => true,
    (val: string) => val === 'true'
  );

  let scrollable!: HTMLDivElement;

  const select = (textId: number) => {
    if (textId === selected()) return;
    deselect();
    setSelected(textId);
    setTexts(page(), (texts) => [
      ...texts.filter(({ id }) => id !== textId),
      texts.find(({ id }) => id === textId)!,
    ]);
  };

  const deselect = () => {
    if (!selected()) return;
    const selectedText = options.pages[page()].texts.find(({ id }) => id === selected())!;
    if (!selectedText) return;
    if (selectedText.text.trim() !== '') {
      setTexts(page(), (texts) => [
        selectedText,
        ...texts.filter(({ id }) => id !== selected()),
      ]);
      setSelected(undefined);
    } else remove();
  };

  const remove = () => {
    if (!selected()) return;
    removeText(page(), selected()!);
    setSelected(undefined);
  };

  // make sure added text is always in view
  const add = () => {
    addText(
      page(),
      (scrollable.scrollLeft + 20) / width(),
      (scrollable.scrollTop + 20) / canvasHeight()
    );
    select(options.pages[page()].texts.at(-1)!.id);
  };

  const keypress = (e: KeyboardEvent) => {
    if (
      !(e.target instanceof Element) ||
      new Set(['TEXTAREA', 'INPUT']).has(e.target.tagName)
    )
      return;
    if (e.key === 'Escape' && variablesOpen()) {
      setVariablesOpen(false);
    } else if (selected()) {
      if (e.key === 'Escape') deselect();
      else if (e.key === 'Delete') remove();
      else return;
    } else return;
    e.preventDefault();
  };

  onMount(() => document.addEventListener('keyup', keypress));
  onCleanup(() => document.removeEventListener('keyup', keypress));

  return (
    <>
      <Modal open={variablesOpen()} disablePortal>
        <div class="b2 absolute z-10 top-5 right-5 rounded-full">
          <IconButton onClick={() => setVariablesOpen(false)}>
            <CloseIcon />
          </IconButton>
        </div>
        <div class="bg">
          <Variables />
        </div>
      </Modal>
      <div class="flex flex-col h-screen">
        <div class="b1 flex items-center p-2 gap-2">
          <Button variant="contained" size="small" onClick={zoomIn}>
            +
          </Button>
          <Button variant="contained" size="small" onClick={zoomOut}>
            -
          </Button>
          <Button
            size="small"
            sx={{ marginLeft: '10px', marginTop: '2px' }}
            onClick={add}
          >
            Add Text
          </Button>
          <Button
            size="small"
            sx={{ marginRight: '10px', marginTop: '2px' }}
            onClick={() => setVariablesOpen(true)}
          >
            Variables
          </Button>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={preview()}
                onChange={() => setPreview(!preview())}
              />
            }
            label="Preview"
          />
          <span class="grow" />
          <Show when={import.meta.env.DEV}>
            <Button
              size="small"
              sx={{ marginTop: '2px' }}
              onClick={() =>
                savePdf('out.pdf', options.pages, options.variables, exampleInfo())
              }
            >
              Test Save
            </Button>
          </Show>
          <IconButton
            size="small"
            disabled={page() === 0 || !pdf()}
            onClick={() => navigate(`/edit/${Math.max(page() - 1, 0)}`)}
          >
            <PrevIcon />
          </IconButton>
          Page {page() + 1}
          <IconButton
            size="small"
            disabled={page() === (pdf() ? pdf()!.numPages - 1 : true)}
            onClick={() => navigate(`/edit/${Math.min(page() + 1, pdf()!.numPages - 1)}`)}
          >
            <NextIcon />
          </IconButton>
          <IconButton size="small" onClick={() => navigate('/form')}>
            <UpIcon />
          </IconButton>
          <IconButton size="small" onClick={() => navigate('/')}>
            <HomeIcon />
          </IconButton>
        </div>
        <span class="b3 w-full h-1 min-h-1" />
        <div class="flex w-full min-h-0 flex-grow flex-shrink" ref={content}>
          <div
            class="relative overflow-auto flex-grow-[9999] flex-shrink-[9999]"
            ref={scrollable}
          >
            <PdfPage
              // https://github.com/solidjs/solid/issues/2005#issuecomment-1875692521
              ref={(el) =>
                createResizeObserver(el, ({ height }) => setCanvasHeight(height))
              }
              page={page()}
              width={width()}
              setScaleRatio={setPdfZoom}
            >
              <For each={options.pages[page()]?.texts ?? []}>
                {(textOptions) => (
                  <DragText
                    options={textOptions}
                    pageWidth={width()}
                    pageHeight={canvasHeight()}
                    zoom={pdfZoom()}
                    preview={preview()}
                    selected={selected() === textOptions.id}
                    select={select}
                    scrollable={scrollable}
                  />
                )}
              </For>
            </PdfPage>
          </div>
          <Resizable
            size={250}
            minSize={Math.max(pageWidth() / 8, 100)}
            maxSize={Math.min(pageWidth() / 2, 500)}
            direction="left"
            draggerClass="b2"
            persistenceKey="editColumnWidth"
          >
            <SelectionColumn
              selectedId={selected()}
              deselect={deselect}
              remove={remove}
            />
          </Resizable>
        </div>
      </div>
    </>
  );
}

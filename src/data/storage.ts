import {
  BaseDirectory,
  copyFile,
  exists,
  readBinaryFile,
  readTextFile,
  writeTextFile,
} from '@tauri-apps/api/fs';
import { resolveResource } from '@tauri-apps/api/path';
import { getDocument, GlobalWorkerOptions, PDFDocumentProxy } from 'pdfjs-dist';
// import pdfWorker from 'pdfjs-dist/build/pdf.worker?worker&url';
import {
  createContext,
  createEffect,
  createSignal,
  Signal,
  SignalOptions,
  useContext,
} from 'solid-js';
import { createStore } from 'solid-js/store';
import { z } from 'zod';
import defaultExample from '../data/example';
import { defaultVariables, Variables, VariablesSchema } from './variables';

export const resourcesBase = 'stored/';
export const settingsFile = 'settings.json';
export const pdfFile = 'form.pdf';
export const exampleFile = 'lastinfo.json';

export const AlignmentStrings = ['Left', 'Center', 'Right'] as const;

const AlignmentsSchema = z.enum(AlignmentStrings);

export type Alignments = z.infer<typeof AlignmentsSchema>;

const TextOptionsSchema = z.object({
  id: z.number(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  text: z.string(),
  fontSize: z.number(),
  lineSpacing: z.number(),
  color: z.string(),
  align: AlignmentsSchema,
});

export type TextOptions = z.infer<typeof TextOptionsSchema>;

const PageOptionsSchema = z.object({
  texts: z.array(TextOptionsSchema),
});

export type PageOptions = z.infer<typeof PageOptionsSchema>;

const OptionsSchema = z.object({
  pages: z.array(PageOptionsSchema).default([]),
  variables: VariablesSchema.default(defaultVariables()),
});

export type Options = z.infer<typeof OptionsSchema>;

function newText(texts: TextOptions[], x: number, y: number): TextOptions {
  return {
    id: texts.reduce((prev, { id }) => Math.max(prev, id), 0) + 1,
    x,
    y,
    width: 0.1,
    text: '',
    fontSize: 9,
    lineSpacing: 0.3,
    color: 'rgb(0, 0, 0)',
    align: 'Left',
  };
}

function newVariable(variables: Variables) {
  const baseName = 'New Variable';
  let num = 0;
  const usedName = () => (num === 0 ? baseName : baseName + ' ' + num);
  while (variables.find(({ name }) => name === usedName())) num++;
  return { name: usedName(), value: '' };
}

export function createPersistentSignal<T>(
  key: string,
  defaultVal: () => T,
  fromString?: (value: string) => T,
  toString?: (value: T) => string,
  options?: SignalOptions<T>
): Signal<T> {
  const stored = localStorage.getItem(key);
  const [val, setVal] = createSignal(
    stored ? (fromString?.(stored) ?? (stored as T)) : defaultVal(),
    options
  );
  createEffect(() => {
    localStorage.setItem(key, toString ? toString(val()) : String(val()));
  });
  return [val, setVal];
}

async function loadStorageFile<T extends boolean>(
  file: string,
  binary: T
): Promise<T extends true ? Uint8Array : string> {
  const hasFile = await exists(file, { dir: BaseDirectory.AppLocalData });
  if (!hasFile) {
    const storedFilePath = await resolveResource(resourcesBase + file);
    await copyFile(storedFilePath, file, { dir: BaseDirectory.AppLocalData });
  }
  let ret: unknown;
  if (binary) ret = await readBinaryFile(file, { dir: BaseDirectory.AppLocalData });
  else ret = await readTextFile(file, { dir: BaseDirectory.AppLocalData });
  return ret as T extends true ? Uint8Array : string;
}

export function createStorage() {
  // store in local storage to avoid delay on startup
  const [darkMode, setDarkMode] = createPersistentSignal(
    'darkMode',
    () => false,
    (val: string) => val === 'true'
  );

  const [pdf, setPdf] = createSignal<PDFDocumentProxy>();

  const [options, setOptions] = createStore<Options>({
    pages: [],
    variables: defaultVariables(),
  });

  const reloadPdf = () => {
    setPdf(undefined);
    void loadStorageFile(pdfFile, true)
      .then((data) => getDocument(data).promise)
      .then(setPdf)
      .catch((e) => console.error('error loading pdf', e));
  };
  void import('pdfjs-dist/build/pdf.worker?worker&url')
    .then(({ default: pdfWorker }) => {
      GlobalWorkerOptions.workerSrc = pdfWorker;
    })
    .then(reloadPdf);

  const [exampleInfo, setExampleInfo] =
    createSignal<Record<string, unknown>>(defaultExample);

  const setExample = (info: Record<string, unknown>) => {
    setExampleInfo(info);
    return writeTextFile(exampleFile, JSON.stringify(info), {
      dir: BaseDirectory.AppLocalData,
    });
  };

  void loadStorageFile(exampleFile, false)
    .then((text) => JSON.parse(text) as Record<string, unknown>)
    .then(setExampleInfo)
    .catch((e) => console.error('error loading example info', e));

  createEffect(() => {
    if (!pdf() || options.pages.length >= pdf()!.numPages) return;
    // fill the pages array as needed
    setOptions('pages', (pages) =>
      pages.concat(
        Array.from({ length: pdf()!.numPages - pages.length }, () => ({
          texts: [],
        }))
      )
    );
  });

  const setTexts = (
    idx: number,
    texts: TextOptions[] | ((current: TextOptions[]) => TextOptions[])
  ) => setOptions('pages', [idx], 'texts', texts);

  const addText = (idx: number, x: number = 0.01, y: number = 0.01) =>
    setTexts(idx, (texts) => [...texts, newText(texts, x, y)]);

  const setText = (
    idx: number,
    id: number,
    text: TextOptions | ((current: TextOptions) => TextOptions)
  ) => setOptions('pages', [idx], 'texts', (el) => el.id === id, text);

  const removeText = (idx: number, id: number) =>
    setOptions('pages', [idx], 'texts', (texts) =>
      texts.filter(({ id: elementId }) => id !== elementId)
    );

  const addVariable = () =>
    setOptions('variables', (variables) => [...variables, newVariable(variables)]);

  const setVariableName = (
    idx: number,
    newName: string | ((current: string) => string)
  ) => setOptions('variables', idx, 'name', newName);

  const setVariableValue = (
    idx: number,
    value: string | string[] | ((current: string | string[]) => string | string[])
  ) => setOptions('variables', idx, 'value', value);

  const setVariablePart = (
    idx: number,
    partIdx: number,
    value: string | ((current: string) => string)
  ) => setOptions('variables', idx, 'value', partIdx, value);

  const removeVariablePart = (idx: number, partIdx: number) =>
    setOptions('variables', idx, 'value', (value) => {
      if (typeof value === 'string') return value;
      const newValue = [...value];
      newValue.splice(partIdx, 1);
      return newValue;
    });

  const removeVariable = (idx: number) =>
    setOptions('variables', (variables) =>
      variables.filter((_, varIdx) => idx !== varIdx)
    );

  // don't overwrite settings before they're loaded
  const [loaded, setLoaded] = createSignal(false);

  void loadStorageFile(settingsFile, false)
    .then((text) => setOptions(OptionsSchema.parse(JSON.parse(text))))
    .catch((err) => console.error('error reading settings:', err))
    .finally(() => setLoaded(true));

  createEffect(() => {
    if (loaded())
      void writeTextFile(settingsFile, JSON.stringify(options), {
        dir: BaseDirectory.AppLocalData,
      }).catch((err) => console.error('error saving settings:', err));
  });

  return {
    darkMode,
    setDarkMode,
    pdf,
    setPdf,
    exampleInfo,
    setExample,
    reloadPdf,
    options,
    setOptions,
    setTexts,
    addText,
    setText,
    removeText,
    addVariable,
    removeVariable,
    setVariableName,
    setVariableValue,
    setVariablePart,
    removeVariablePart,
  };
}

export const StorageContext = createContext<ReturnType<typeof createStorage>>();

export const useStorage = () => useContext(StorageContext)!;

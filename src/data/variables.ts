import { z } from 'zod';

export const VariablesSchema = z.array(
  z.object({ name: z.string(), value: z.union([z.string(), z.array(z.string())]) })
);

export type Variables = z.infer<typeof VariablesSchema>;

export const defaultVariables: () => Variables = () => [
  { name: 'Street Address', value: ['Property Location', 'Property Address', '0'] },
  {
    name: 'City/State/Zip',
    value: ['Property Location', 'Property City & Zip', '{:<-1}, FL {:-1}'],
  },
  { name: 'Seller', value: ['Owner', '0'] },
  { name: 'Seller Street Address', value: ['Owner', '-2'] },
  { name: 'Seller City/State/Zip', value: ['Owner', '-1'] },
  { name: 'Legal Description', value: ['Legal Description', 'Long Legal'] },
  {
    name: 'Section',
    value: ['General Parcel Information', 'Section/Township/Range', '{-:0}'],
  },
  {
    name: 'Township',
    value: ['General Parcel Information', 'Section/Township/Range', '{-:1}'],
  },
  {
    name: 'Range',
    value: ['General Parcel Information', 'Section/Township/Range', '{-:2}'],
  },
  {
    name: 'Parcel Number',
    value: ['Parcel ID'],
  },
];

// {(split?):(dir?)index}
const transformMatcher = /\{([^:]*?):([<>]?)(-?\d+)\}/gm;

function doTransform(transform: string, value: string) {
  const replace = (_: string, split: string, dir: string, index: string) => {
    if (split === '') split = ' ';

    const parts = value.split(split);

    let i = Number(index);
    while (i < 0) i = parts.length + i;
    if (i >= parts.length) i = parts.length - 1;

    if (dir === '<') return parts.slice(0, i).join(split);
    else if (dir === '>') return parts.slice(i).join(split);
    return parts[i];
  };

  return transform.replaceAll(transformMatcher, replace);
}

function resolveVariable(name: string, variables: Variables, info: unknown) {
  const variable = variables.find(({ name: varName }) => name === varName);
  if (!variable) {
    console.warn('variable', name, 'not found - using name (use \\{ to keep brackets)');
    return name;
  }
  if (typeof variable.value === 'string') return variable.value;
  for (const step of variable.value) {
    try {
      if (Array.isArray(info) && Number.isNaN(Number(step))) {
        if (typeof info[0] === 'string') info = info.join('\n');
        else info = info[0];
      }
      if (step.match(transformMatcher)) info = doTransform(step, info as string);
      else if (Array.isArray(info) && !Number.isNaN(Number(step)))
        info = info.at(Number(step));
      else info = (info as Record<string, unknown>)[step];
    } catch (e) {
      console.warn('failed in resolution of', name, 'with:', e);
      break;
    }
  }
  if (typeof info !== 'string') {
    console.warn('variable', name, 'resolved to non string:', info);
    return name;
  }
  return info;
}

export function resolveText(
  text: string,
  variables: Variables,
  info: Record<string, unknown>
) {
  const replace = (_: string, group: string) => resolveVariable(group, variables, info);

  text = text.replaceAll(/(?<!\\)(?:\\\\)*{(.*?)(?<!\\)(?:\\\\)*}/gm, replace);
  text = text.replaceAll('\\{', '{');
  text = text.replaceAll('\\}', '}');
  return text;
}

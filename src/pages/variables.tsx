import { useLocation, useNavigate } from '@solidjs/router';
import AddIcon from '@suid/icons-material/Add';
import RemoveIcon from '@suid/icons-material/Clear';
import HomeIcon from '@suid/icons-material/Home';
import InfoIcon from '@suid/icons-material/Info';
import {
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@suid/material';
import { SelectChangeEvent } from '@suid/material/Select';
import { For, Index, Show } from 'solid-js';
import { useStorage } from '../data/storage';
import { defaultVariables } from '../data/variables';

function VariableRow(props: { index: number; name: string; value: string | string[] }) {
  const {
    removeVariable,
    setVariableName,
    setVariableValue,
    setVariablePart,
    removeVariablePart,
  } = useStorage();

  const varType = () => (typeof props.value === 'string' ? 0 : 1);

  const remove = () => removeVariable(props.index);
  const setName = (_: unknown, value: string) => setVariableName(props.index, value);
  const setType = (e: SelectChangeEvent<number>) =>
    setVariableValue(props.index, e.target.value === 0 ? '' : []);
  const add = () => setVariableValue(props.index, (value) => [...value, '']);

  return (
    <div class="b1 flex gap-2 items-center p-2 rounded-md no-shrink w-max">
      <IconButton onClick={remove} size="small">
        <RemoveIcon />
      </IconButton>
      <TextField
        value={props.name}
        onChange={setName}
        label="Name"
        variant="standard"
        size="small"
      />
      <FormControl variant="standard">
        <InputLabel id="type-label">Variable Type</InputLabel>
        <Select
          value={varType()}
          onChange={setType}
          labelId="type-label"
          variant="standard"
          size="small"
        >
          <MenuItem value={0}>Constant</MenuItem>
          <MenuItem value={1}>Retrieved</MenuItem>
        </Select>
      </FormControl>
      <Show
        when={varType() === 1}
        fallback={
          <TextField
            value={props.value}
            onChange={(_, typed) => setVariableValue(props.index, typed)}
            label="Value"
            variant="standard"
            size="small"
          />
        }
      >
        <Index each={props.value as string[]}>
          {(value, index) => (
            <div class="flex flex-col items-start self-stretch">
              <IconButton
                onClick={() => removeVariablePart(props.index, index)}
                sx={{ width: '8px', height: '8px', padding: '7px' }}
              >
                <RemoveIcon sx={{ width: '13px', height: '13px' }} />
              </IconButton>
              <span class="grow" />
              <TextField
                value={value()}
                onChange={(_, typed) => setVariablePart(props.index, index, typed)}
                variant="standard"
                size="small"
              />
            </div>
          )}
        </Index>
        <IconButton onClick={add} size="small">
          <AddIcon />
        </IconButton>
      </Show>
    </div>
  );
}

export default function Variables() {
  const location = useLocation();
  const navigate = useNavigate();
  const { options, setOptions, addVariable } = useStorage();

  let scrollable!: HTMLDivElement;

  const restore = () =>
    setOptions('variables', (variables) => [
      ...defaultVariables(),
      ...variables.filter(
        ({ name: existName }) =>
          !defaultVariables().find(({ name: defaultName }) => defaultName === existName)
      ),
    ]);

  const add = () => {
    addVariable();
    scrollable.scrollTo({
      behavior: 'instant',
      left: 0,
      top: scrollable.scrollHeight,
    });
  };

  return (
    <>
      <Show when={location.pathname === '/vars'}>
        <div class="b2 absolute z-10 top-5 right-5 rounded-full">
          <IconButton onClick={() => navigate('/')}>
            <HomeIcon />
          </IconButton>
        </div>
      </Show>
      <div
        ref={scrollable}
        class="overflow-auto flex flex-col h-screen p-3 gap-2 content-start items-start"
      >
        <div class="flex gap-3 mb-1 items-center">
          <div class="b2 p-2 rounded-md flex gap-2 w-fit">
            <InfoIcon />
            Variables can be referenced in the form with the syntax
            <code class="mt-[0.5px]">
              {'{'}Variable Name{'}'}
            </code>
          </div>
          <Button onClick={restore}>Restore Defaults</Button>
        </div>
        <For each={options.variables}>
          {/* don't destructure the store! */}
          {(variable, index) => (
            <VariableRow index={index()} name={variable.name} value={variable.value} />
          )}
        </For>
        <div class="b1 p-2 rounded-md">
          <IconButton onClick={add} size="small">
            <AddIcon />
          </IconButton>
        </div>
      </div>
    </>
  );
}

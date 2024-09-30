import { useNavigate } from '@solidjs/router';
import MenuIcon from '@suid/icons-material/Menu';
import {
  Button,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Input,
  Menu,
  MenuItem,
  Switch,
} from '@suid/material';
import { save } from '@tauri-apps/api/dialog';
import { open } from '@tauri-apps/api/shell';
import { createEffect, createSignal, For, Show } from 'solid-js';
import { savePdf } from '../data/pdf';
import { AddressInfo, searchAddress } from '../data/scraper';
import { createPersistentSignal, useStorage } from '../data/storage';

function AddressCell(props: { address: AddressInfo }) {
  const { options, setExample } = useStorage();

  const use = () => {
    void setExample(props.address.info);
    save({
      title: 'Save Form',
      defaultPath: `${props.address.address.replaceAll(' ', '-')}-form.pdf`,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    })
      .then((file) => {
        if (file) savePdf(file, options.pages, options.variables, props.address.info);
      })
      .catch((e) => console.log('error saving form:', e));
  };
  const openMaps = () => void open(props.address.mapsLink);

  return (
    <div class="b2 flex flex-col gap-1 p-1 rounded-sm min-w-72">
      <span class="ml-2 select-text">{props.address.address}</span>
      <span class="grow" />
      <div class="flex">
        <Button onClick={use}>Use</Button>
        <Button onClick={openMaps}>Open Maps</Button>
      </div>
    </div>
  );
}

export default function Search() {
  const { darkMode, setDarkMode } = useStorage();
  const navigate = useNavigate();

  const [anchorEl, setAnchorEl] = createSignal<null | HTMLElement>(null);
  const open = () => Boolean(anchorEl());
  const close = () => setAnchorEl(null);

  const form = () => {
    close();
    navigate('/form');
  };
  const variables = () => {
    close();
    navigate('/vars');
  };

  const [address, setAddress] = createPersistentSignal('addressInput', () => '');

  const [loading, setLoading] = createSignal(false);
  const [candidates, setCandidates] = createSignal<AddressInfo[]>();
  createEffect(() => {
    if (candidates()) setLoading(false);
  });

  const search = () => {
    setLoading(true);
    setCandidates(undefined);
    searchAddress(address())
      .then(setCandidates)
      .catch((e) => console.error('error searching addresses', e));
  };

  return (
    <>
      <div class="absolute-center max-h-[80vh] w-max h-fit flex flex-col gap-5 items-center">
        <div class="b1 w-[50vw] p-2 rounded-md">
          <Input
            class="w-full"
            placeholder="Enter Address"
            value={address()}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void search();
                e.preventDefault();
              }
            }}
          />
        </div>
        <Show
          when={candidates()}
          fallback={
            <Show when={loading()}>
              <div class="b1 p-3 rounded-md flex">
                <CircularProgress size={25} />
              </div>
            </Show>
          }
        >
          <Show
            when={candidates()!.length > 0}
            fallback={<div class="b1 p-2 rounded-md">No Results</div>}
          >
            <div
              class="b1 overflow-y-auto p-2 rounded-md grid gap-1"
              style={{
                'max-width': '75vw',
                'max-height': '50vh',
                'grid-template-columns': 'repeat(auto-fit, minmax(18rem, 1fr))',
              }}
            >
              <For each={candidates()}>
                {(candidate) => <AddressCell address={candidate} />}
              </For>
            </div>
          </Show>
        </Show>
      </div>
      <div class="absolute top-5 left-5 b2 rounded-full">
        <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
          <MenuIcon />
        </IconButton>
      </div>
      <Menu anchorEl={anchorEl()} open={open()} onClose={close}>
        <MenuItem onClick={form}>Edit Form</MenuItem>
        <MenuItem onClick={variables}>Edit Variables</MenuItem>
        <FormControlLabel
          label="Dark Mode"
          sx={{ margin: '0 10px 0 0', userSelect: 'none' }}
          control={
            <Switch checked={darkMode()} onChange={() => setDarkMode(!darkMode())} />
          }
        />
      </Menu>
    </>
  );
}

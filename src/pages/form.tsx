import { useNavigate } from '@solidjs/router';
import HomeIcon from '@suid/icons-material/Home';
import UploadIcon from '@suid/icons-material/UploadFile';
import { IconButton } from '@suid/material';
import { open } from '@tauri-apps/api/dialog';
import { BaseDirectory, copyFile } from '@tauri-apps/api/fs';
import { Index, Show } from 'solid-js';
import PdfPage from '../components/page';
import { pdfFile, useStorage } from '../data/storage';

function PageDisplay(props: { page: number; width: number }) {
  const navigate = useNavigate();

  return (
    <div class="relative">
      <PdfPage
        page={props.page}
        width={props.width}
        class="cursor-pointer"
        onClick={() => navigate(`/edit/${props.page}`)}
      />
      <div class="b1 absolute top-2 left-2 pl-1 pr-1 rounded-md z-10 pointer-events-none">
        {props.page + 1}
      </div>
    </div>
  );
}

export default function Form() {
  const navigate = useNavigate();

  const { pdf, reloadPdf } = useStorage();

  const upload = () =>
    open({ title: 'Upload New Form', filters: [{ name: 'PDF Files', extensions: ['pdf'] }] })
      .then((selected) => {
        console.log('uploaded pdf', selected);
        if (selected && typeof selected === 'string')
          void copyFile(selected, pdfFile, { dir: BaseDirectory.AppLocalData }).then(
            reloadPdf
          );
      })
      .catch((e) => console.error('error opening file', e));

  return (
    <>
      <div class="b2 absolute z-10 top-5 right-5 rounded-full">
        <IconButton onClick={() => void upload()}>
          <UploadIcon />
        </IconButton>
        <IconButton onClick={() => navigate('/')}>
          <HomeIcon />
        </IconButton>
      </div>
      <div class="overflow-auto flex flex-wrap h-screen p-5 gap-2 content-start">
        <Show when={pdf()}>
          <Index each={new Array(pdf()?.numPages ?? 0)}>
            {(_, index) => <PageDisplay page={index} width={300} />}
          </Index>
        </Show>
      </div>
    </>
  );
}

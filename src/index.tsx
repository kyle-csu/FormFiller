import { RouteDefinition, Router } from '@solidjs/router';
import { createPalette, createTheme, ThemeProvider } from '@suid/material/styles';
import { createEffect, createMemo, lazy } from 'solid-js';
import { render } from 'solid-js/web';
import { createStorage, StorageContext, useStorage } from './data/storage';
import './index.css';

function AppRouter() {
  const { darkMode } = useStorage();

  createEffect(() => {
    if (darkMode() && !document.body.classList.contains('dark'))
      document.body.classList.add('dark');
    else document.body.classList.remove('dark');
  });

  const palette = createMemo(() => {
    return createPalette({ mode: darkMode() ? 'dark' : 'light' });
  });
  // avoid losing reactivity
  const theme = createTheme({ palette: palette });

  const routes: RouteDefinition[] = [
    { path: '/', component: lazy(() => import('./pages/search')) },
    { path: '/vars', component: lazy(() => import('./pages/variables')) },
    { path: '/form', component: lazy(() => import('./pages/form')) },
    {
      path: '/edit/:page',
      component: lazy(() => import('./pages/edit')),
      matchFilters: { page: /^\d+$/ },
    },
  ];

  return (
    <div id="wrapper">
      <ThemeProvider theme={theme}>
        <Router>{routes}</Router>
      </ThemeProvider>
    </div>
  );
}

render(
  () => {
    const storage = createStorage();

    return (
      <StorageContext.Provider value={storage}>
        <AppRouter />
      </StorageContext.Provider>
    );
  },
  document.getElementById('root') as HTMLElement
);

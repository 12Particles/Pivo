/**
 * App - Minimal root component
 */

import { AppProviders } from './app/AppProviders';
import { AppShell } from './app/AppShell';

function App() {
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  );
}

export default App;
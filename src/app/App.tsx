/**
 * App - Minimal root component
 */

import { AppProviders } from './AppProviders';
import { AppShell } from './AppShell';

function App() {
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  );
}

export default App;
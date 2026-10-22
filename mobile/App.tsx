/**
 * Native adaptation of the existing achievement viewer.
 * Steam's dark blue surfaces, readable system type, and blue actions frame
 * a task-first app: sign in, inspect progress, browse a library, open a game.
 * Native navigation and virtualized lists replace desktop navigation/grids.
 * Login leads with Steam, with separate read-only profile and sample modes.
 */
import './global.css';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthContext';
import MobileApp from './src/screens/MobileApp';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider><MobileApp /></AuthProvider>
    </SafeAreaProvider>
  );
}

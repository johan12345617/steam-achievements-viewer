import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../auth/AuthContext';
import { Icon, IconName, Loading, Screen } from '../components/ui';
import { RootStackParams } from '../lib/types';
import LoginScreen from './LoginScreen';
import DashboardScreen from './DashboardScreen';
import LibraryScreen from './LibraryScreen';
import RetroScreen from './RetroScreen';
import AccountScreen from './AccountScreen';
import GameScreen from './GameScreen';
import RetroGameScreen from './RetroGameScreen';
import AchievementScreen from './AchievementScreen';

const Stack = createNativeStackNavigator<RootStackParams>();
const Tab = createBottomTabNavigator();
const tabIcons: Record<string, IconName> = { Progress: 'stats-chart-outline', Library: 'grid-outline', Retro: 'game-controller-outline', Account: 'person-circle-outline' };
const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: '#171a21', card: '#1b2838', primary: '#66c0f4', text: '#c7d5e0', border: '#34485e' } };

function TabBar({ state, navigation }: BottomTabBarProps) {
  return <SafeAreaView edges={['bottom', 'left', 'right']} className="border-t border-steam-border bg-steam-navy"><View className="mx-auto w-full max-w-3xl flex-row">
    {state.routes.map((route, index) => {
      const selected = state.index === index;
      return <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={route.name} accessibilityState={{ selected }} onPress={() => {
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (!selected && !event.defaultPrevented) navigation.navigate(route.name);
      }} onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })} className="min-h-16 flex-1 items-center justify-center gap-1 py-2 active:bg-steam-panel">
        <Icon name={tabIcons[route.name]} color={selected ? '#66c0f4' : '#9aafbf'} size={23} /><Text className={`text-xs font-medium ${selected ? 'text-steam-accent' : 'text-steam-muted'}`}>{route.name}</Text>
      </Pressable>;
    })}
  </View></SafeAreaView>;
}

function Tabs() {
  return <Tab.Navigator screenOptions={{ headerShown: false, lazy: true }} tabBar={props => <TabBar {...props} />}>
    <Tab.Screen name="Progress" component={DashboardScreen} /><Tab.Screen name="Library" component={LibraryScreen} /><Tab.Screen name="Retro" component={RetroScreen} /><Tab.Screen name="Account" component={AccountScreen} />
  </Tab.Navigator>;
}

export default function MobileApp() {
  const { ready, mode, user } = useAuth();
  if (!ready) return <Screen><StatusBar style="light" /><Loading label="Opening your achievements…" /></Screen>;
  return <><StatusBar style="light" />{mode ? <NavigationContainer key={`${mode}:${user?.steamId ?? 'demo'}`} theme={theme}>
    <Stack.Navigator screenOptions={{ headerShown: false }}><Stack.Screen name="Home" component={Tabs} /><Stack.Screen name="Game" component={GameScreen} /><Stack.Screen name="RetroGame" component={RetroGameScreen} /><Stack.Screen name="Achievement" component={AchievementScreen} /></Stack.Navigator>
  </NavigationContainer> : <LoginScreen />}</>;
}

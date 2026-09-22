import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DefaultTheme, DarkTheme, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, TouchableOpacity, View } from 'react-native';
import { AwardsScreen } from '../screens/AwardsScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { UserDetailScreen } from '../screens/UserDetailScreen';
import { UsersScreen } from '../screens/UsersScreen';
import { UserFormModal } from '../components/UserFormModal';
import { useTheme } from '../lib/ThemeContext';
import { useState } from 'react';
import type { RootStackParamList, TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['com.anonymous.mobile://', 'mobile://', 'exp+mobile://'],
  config: {
    screens: {
      Tabs: {
        screens: {
          Leaderboard: 'board/:category?',
          Awards: 'awards',
          Athletes: 'athletes',
        },
      },
      UserDetail: 'users/:id/:category?',
    },
  },
};

function TabIcon({ label, focused, color }: { label: string; focused: boolean; color: string }) {
  const icons: Record<string, string> = { Leaderboard: '🏆', Awards: '🎖', Athletes: '👥' };
  return <Text style={{ fontSize: focused ? 18 : 16, opacity: focused ? 1 : 0.65, color }}>{icons[label] ?? '•'}</Text>;
}

function MainTabs() {
  const { colors, mode, toggle } = useTheme();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerStyle: { backgroundColor: colors.bg },
          headerTitleStyle: { color: colors.text, fontWeight: '600' },
          headerShadowVisible: false,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
          tabBarIcon: ({ focused, color }) => <TabIcon label={route.name} focused={focused} color={color} />,
          headerRight: () => (
            <TouchableOpacity onPress={toggle} style={{ marginRight: 12, padding: 6 }}>
              <Text style={{ fontSize: 16 }}>{mode === 'dark' ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>
          ),
        })}
      >
        <Tab.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Board' }} />
        <Tab.Screen name="Awards" component={AwardsScreen} />
        <Tab.Screen
          name="Athletes"
          component={UsersScreen}
          options={{
            headerRight: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 12 }}>
                <TouchableOpacity onPress={toggle} style={{ padding: 6 }}>
                  <Text style={{ fontSize: 16 }}>{mode === 'dark' ? '☀️' : '🌙'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAddOpen(true)} style={{ padding: 6 }}>
                  <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>+ Add</Text>
                </TouchableOpacity>
              </View>
            ),
          }}
        />
      </Tab.Navigator>
      <UserFormModal visible={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

export function RootNavigator() {
  const { colors, mode, toggle } = useTheme();
  const navTheme = mode === 'dark'
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg, card: colors.surface, text: colors.text, border: colors.border, primary: colors.accent } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.surface, text: colors.text, border: colors.border, primary: colors.accent } };

  return (
    <NavigationContainer theme={navTheme} linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="UserDetail"
          component={UserDetailScreen}
          options={{
            title: 'Profile',
            headerBackTitle: 'Back',
            headerRight: () => (
              <TouchableOpacity onPress={toggle} style={{ marginRight: 12, padding: 6 }}>
                <Text style={{ fontSize: 16 }}>{mode === 'dark' ? '☀️' : '🌙'}</Text>
              </TouchableOpacity>
            ),
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

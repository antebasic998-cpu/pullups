import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DefaultTheme, DarkTheme, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AwardsScreen } from '../screens/AwardsScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { UserDetailScreen } from '../screens/UserDetailScreen';
import { UsersScreen } from '../screens/UsersScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ArenaTabBar } from '../components/TabBar';
import { useTheme } from '../lib/ThemeContext';
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
          Settings: 'settings',
        },
      },
      UserDetail: 'users/:id/:category?',
    },
  },
};

/** Screens draw their own Arena headers, so the navigators never show one. */
function MainTabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      tabBar={(props) => <ArenaTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Board' }} />
      <Tab.Screen name="Awards" component={AwardsScreen} />
      <Tab.Screen name="Athletes" component={UsersScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { colors, mode } = useTheme();
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.bg,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme} linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="Tabs" component={MainTabs} />
        <Stack.Screen name="UserDetail" component={UserDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

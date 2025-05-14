// app/(tabs)/_layout.tsx - Optimisé pour le mode paysage

import { Tabs } from 'expo-router';
import {
  LayoutGrid,
  UtensilsCrossed,
  Receipt,
  Settings,
  BarChart3,
  FileText,
  DollarSign,
} from 'lucide-react-native';
import { View, StyleSheet } from 'react-native';

export default function TabLayout() {
  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            height: 60,
            paddingBottom: 8,
            backgroundColor: 'white',
            borderTopWidth: 1,
            borderTopColor: '#e0e0e0',
          },
          tabBarLabelStyle: {
            fontSize: 12,
          },
          tabBarActiveTintColor: '#2196F3',
          tabBarInactiveTintColor: '#757575',
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Tables',
            tabBarIcon: ({ size, color }) => (
              <LayoutGrid size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="menu"
          options={{
            title: 'Menu',
            tabBarIcon: ({ size, color }) => (
              <UtensilsCrossed size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="bills"
          options={{
            title: 'Additions',
            tabBarIcon: ({ size, color }) => (
              <Receipt size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="table-plan"
          options={{
            title: 'Plan',
            tabBarIcon: ({ size, color }) => (
              <FileText size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="z-report"
          options={{
            title: 'Z',
            tabBarIcon: ({ size, color }) => (
              <DollarSign size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Paramètres',
            tabBarIcon: ({ size, color }) => (
              <Settings size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});
